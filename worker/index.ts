import { DurableObject } from "cloudflare:workers";
import {
  ROOM_ID_PATTERN,
  MAX_MESSAGE_BYTES,
  HEARTBEAT_REQUEST,
  HEARTBEAT_RESPONSE,
  ROOM_TTL_MS,
  errorMessage,
  type Session,
  type RoomMessage,
  type CommandResult,
} from "../shared/protocol";
import { Room, parseCommand, playerName, type RoomState } from "./room";

interface Env {
  GAME_ROOMS: DurableObjectNamespace<GameRoom>;
  ASSETS: Fetcher;
}
type Attachment = { playerId: string; connectionId: string };

function failure(code: string, status = 400): Response {
  if (!/^[A-Z_]+$/.test(code)) code = "INVALID_COMMAND";
  return Response.json(
    { code, error: errorMessage(code) },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
function random(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}
async function hash(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw new Error("INVALID_COMMAND");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_COMMAND");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_MESSAGE_BYTES) {
        await reader.cancel();
        throw new Error("INVALID_COMMAND");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("INVALID_COMMAND");
  return value as Record<string, unknown>;
}

export class GameRoom extends DurableObject<Env> {
  private room: Room | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private nextRateLimitCleanup = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const exists =
        ctx.storage.sql
          .exec(
            "SELECT name FROM sqlite_master WHERE name = 'multiplayer_state'",
          )
          .toArray().length > 0;
      const saved = exists
        ? ctx.storage.sql
            .exec<{ snapshot: string }>(
              "SELECT snapshot FROM multiplayer_state WHERE id = 1",
            )
            .toArray()[0]
        : undefined;
      if (saved) {
        await this.mutate(() => {
          this.room = new Room(JSON.parse(saved.snapshot) as RoomState);
          this.room.reconcileConnections(this.connectionTimes(), Date.now());
        });
        ctx.setWebSocketAutoResponse(
          new WebSocketRequestResponsePair(
            HEARTBEAT_REQUEST,
            HEARTBEAT_RESPONSE,
          ),
        );
      }
    });
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }

  private connectionTimes(): Map<string, number> {
    const connections = new Map<string, number>();
    for (const socket of this.ctx.getWebSockets()) {
      if (socket.readyState !== WebSocket.OPEN) continue;
      const attachment = socket.deserializeAttachment() as Attachment;
      const member = this.room?.state.members.find(
        (member) =>
          member.id === attachment.playerId &&
          member.connectionId === attachment.connectionId,
      );
      if (member)
        connections.set(
          attachment.connectionId,
          Math.max(
            member.lastSeen ?? 0,
            this.ctx.getWebSocketAutoResponseTimestamp(socket)?.getTime() ?? 0,
          ),
        );
    }
    return connections;
  }

  private save(snapshot: string, initialize: boolean): void {
    if (initialize) {
      this.ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS multiplayer_state (id INTEGER PRIMARY KEY CHECK (id = 1), snapshot TEXT NOT NULL)",
      );
      this.ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS command_results (player_id TEXT NOT NULL, command_id TEXT NOT NULL, command TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY (player_id, command_id))",
      );
    }
    this.ctx.storage.sql.exec(
      "INSERT INTO multiplayer_state (id, snapshot) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot",
      snapshot,
    );
  }

  private async mutate<T>(operation: () => T): Promise<T> {
    const before = this.room ? JSON.stringify(this.room.state) : null;
    try {
      return await this.ctx.storage.transaction(async () => {
        const result = operation();
        const snapshot = this.room ? JSON.stringify(this.room.state) : null;
        if (before !== snapshot && snapshot !== null)
          this.save(snapshot, before === null);
        if (this.room) {
          const scheduled = await this.ctx.storage.getAlarm();
          const next = this.room.nextAlarm(this.connectionTimes());
          // Moving an existing alarm later during wake-up can cancel its handler and broadcast.
          if (scheduled === null || next < scheduled)
            await this.ctx.storage.setAlarm(next);
        }
        return result;
      });
    } catch (error) {
      this.room = before ? new Room(JSON.parse(before) as RoomState) : null;
      if (error instanceof Error && /^[A-Z_]+$/.test(error.message))
        throw error;
      throw new Error("SAVE_FAILED");
    }
  }

  private async removeExpired(now: number): Promise<boolean> {
    if (!this.room || now < this.room.state.lastActivity + ROOM_TTL_MS)
      return false;
    await this.ctx.storage.deleteAll();
    this.room = null;
    this.nextRateLimitCleanup = 0;
    this.ctx.setWebSocketAutoResponse();
    for (const socket of this.ctx.getWebSockets()) {
      this.send(socket, {
        type: "error",
        code: "ROOM_EXPIRED",
        message: errorMessage("ROOM_EXPIRED"),
      });
      socket.close(4004, "Room expired");
    }
    return true;
  }

  private limit(key: string, maximum: number, interval: number): boolean {
    const now = Date.now();
    const window = Math.floor(now / interval) * interval;
    // Cleanup can be amortized; every request still updates its durable counter.
    if (now >= this.nextRateLimitCleanup) {
      this.ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL)",
      );
      this.ctx.storage.sql.exec(
        "DELETE FROM rate_limits WHERE window < ?",
        now - 120000,
      );
      this.nextRateLimitCleanup = now + 60000;
    }
    const row = this.ctx.storage.sql
      .exec<{ count: number }>(
        "INSERT INTO rate_limits (key, window, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window = excluded.window THEN count + 1 ELSE 1 END, window = excluded.window RETURNING count",
        key,
        window,
      )
      .one();
    return row.count <= maximum;
  }

  private send(socket: WebSocket, message: RoomMessage): void {
    if (socket.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message));
  }

  private broadcast(): void {
    if (!this.room) return;
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as Attachment;
      const member = this.room.state.members.find(
        (member) => member.id === attachment.playerId,
      );
      if (!member) socket.close(4003, "Membership ended");
      else if (member.connectionId === attachment.connectionId)
        this.send(socket, this.room.view(member.id));
      else if (socket.readyState === WebSocket.OPEN)
        socket.close(4000, "Inactive connection");
    }
  }

  async alarm(): Promise<void> {
    return this.serial(async () => {
      const now = Date.now();
      if (await this.removeExpired(now)) return;
      await this.mutate(() => {
        this.room?.reconcileConnections(this.connectionTimes(), now);
        this.room?.expire(now, random);
      });
      this.broadcast();
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/internal/creation-limit") {
      return this.serial(async () => {
        const ip = request.headers.get("X-Rate-Key")!;
        return this.limit("all-creations", 60, 60000) &&
          this.limit(ip, 6, 60000)
          ? new Response(null, { status: 204 })
          : failure("RATE_LIMITED", 429);
      });
    }
    try {
      const creating =
        request.method === "POST" && url.pathname.endsWith("/create");
      const body = request.method === "POST" ? await jsonBody(request) : null;
      const name = body ? playerName(body.name) : "";
      if (
        body &&
        Object.keys(body).some(
          (key) => !["name", ...(creating ? ["capacity"] : [])].includes(key),
        )
      )
        return failure("INVALID_COMMAND");
      if (creating && ![3, 4, 5].includes(body!.capacity as number))
        return failure("INVALID_CAPACITY");
      const protocols = url.pathname.endsWith("/ws")
        ? request.headers
            .get("Sec-WebSocket-Protocol")
            ?.split(",")
            .map((value) => value.trim())
        : null;
      if (url.pathname.endsWith("/ws")) {
        if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket")
          return failure("WEBSOCKET_REQUIRED", 426);
        if (
          !protocols ||
          protocols.length !== 2 ||
          protocols[0] !== "meono" ||
          !/^[0-9a-f]{64}$/.test(protocols[1])
        )
          return failure("INVALID_SESSION", 401);
      }
      const token = body
        ? Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
            byte.toString(16).padStart(2, "0"),
          ).join("")
        : protocols?.[1];
      const tokenHash = token ? await hash(token) : "";
      return await this.serial(async () => {
        const now = Date.now();
        if (await this.removeExpired(now)) return failure("ROOM_EXPIRED", 410);
        if (!creating && !this.room) return failure("ROOM_NOT_FOUND", 404);
        if (body) {
          if (!this.limit("joins", 20, 60000))
            return failure("RATE_LIMITED", 429);
          const playerId = crypto.randomUUID();
          await this.mutate(() => {
            if (creating) {
              if (this.room) throw new Error("INVALID_COMMAND");
              this.room = new Room(
                {
                  roomId: url.pathname.split("/")[3],
                  capacity: body.capacity as 3 | 4 | 5,
                  hostId: "",
                  version: 0,
                  members: [],
                  game: null,
                  reaction: null,
                },
                now,
              );
            }
            this.room!.addMember(playerId, name, tokenHash, now);
          });
          this.broadcast();
          const session: Session = {
            roomId: this.room!.state.roomId,
            playerId,
            token: token!,
          };
          return Response.json(session, {
            status: 201,
            headers: { "Cache-Control": "no-store" },
          });
        }
        if (!url.pathname.endsWith("/ws"))
          return Response.json(this.room!.view(null), {
            headers: { "Cache-Control": "no-store" },
          });
        if (!this.limit("connections", 60, 60000))
          return failure("RATE_LIMITED", 429);
        const member = this.room!.state.members.find(
          (member) => member.tokenHash === tokenHash,
        );
        if (!member) return failure("INVALID_SESSION", 401);
        const attachment: Attachment = {
          playerId: member.id,
          connectionId: crypto.randomUUID(),
        };
        const [client, server] = Object.values(new WebSocketPair());
        await this.mutate(() => {
          this.room!.reconcileConnections(this.connectionTimes(), now);
          this.room!.connect(member.id, attachment.connectionId, now);
        });
        this.ctx.setWebSocketAutoResponse(
          new WebSocketRequestResponsePair(
            HEARTBEAT_REQUEST,
            HEARTBEAT_RESPONSE,
          ),
        );
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment(attachment);
        for (const peer of this.ctx.getWebSockets()) {
          const old = peer.deserializeAttachment() as Attachment;
          if (
            old.playerId === member.id &&
            old.connectionId !== attachment.connectionId
          ) {
            this.send(peer, {
              type: "replaced",
              message:
                "Ghế này đang được điều khiển ở tab mới. Tab cũ đã ngừng kết nối.",
            });
            peer.close(4001, "Replaced by a new tab");
          }
        }
        this.broadcast();
        return new Response(null, {
          status: 101,
          webSocket: client,
          headers: { "Sec-WebSocket-Protocol": "meono" },
        });
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : "SAVE_FAILED";
      return failure(code, code === "SAVE_FAILED" ? 503 : 400);
    }
  }

  async webSocketMessage(
    socket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    return this.serial(async () => {
      if (await this.removeExpired(Date.now())) return;
      const attachment = socket.deserializeAttachment() as Attachment;
      const member = this.room?.state.members.find(
        (member) => member.id === attachment.playerId,
      );
      if (!member || member.connectionId !== attachment.connectionId) {
        socket.close(4001, "Inactive connection");
        return;
      }
      if (!this.limit("commands-" + member.id, 40, 10000)) {
        this.send(socket, {
          type: "error",
          code: "RATE_LIMITED",
          message: errorMessage("RATE_LIMITED"),
        });
        return;
      }
      let command;
      try {
        if (
          typeof message !== "string" ||
          new TextEncoder().encode(message).byteLength > MAX_MESSAGE_BYTES
        )
          throw new Error("INVALID_COMMAND");
        command = parseCommand(JSON.parse(message));
      } catch {
        this.send(socket, {
          type: "error",
          code: "INVALID_COMMAND",
          message: errorMessage("INVALID_COMMAND"),
        });
        return;
      }
      try {
        const result = await this.mutate((): CommandResult => {
          const now = Date.now();
          member.lastSeen = now;
          this.room!.reconcileConnections(this.connectionTimes(), now);
          const fingerprint = JSON.stringify(command);
          const stored = this.ctx.storage.sql
            .exec<{ command: string; result: string }>(
              "SELECT command, result FROM command_results WHERE player_id = ? AND command_id = ?",
              member.id,
              command.id,
            )
            .toArray()[0];
          if (stored) {
            if (stored.command === fingerprint)
              return JSON.parse(stored.result) as CommandResult;
            return {
              type: "result",
              id: command.id,
              ok: false,
              version: this.room!.state.version,
              code: "COMMAND_ID_REUSED",
              message: errorMessage("COMMAND_ID_REUSED"),
            };
          }
          const result = this.room!.process(member.id, command, now, random);
          this.ctx.storage.sql.exec(
            "INSERT INTO command_results (player_id, command_id, command, result) VALUES (?, ?, ?, ?)",
            member.id,
            command.id,
            fingerprint,
            JSON.stringify(result),
          );
          return result;
        });
        this.send(socket, result);
        if (
          result.ok &&
          command.action.type === "leave" &&
          this.room!.state.members.some(
            (candidate) => candidate.id === member.id,
          )
        ) {
          this.send(socket, this.room!.view(member.id));
          socket.close(4002, "Left game; seat retained");
        }
        this.broadcast();
      } catch {
        this.send(socket, {
          type: "error",
          code: "SAVE_FAILED",
          message: errorMessage("SAVE_FAILED"),
        });
      }
    });
  }

  async webSocketClose(
    socket: WebSocket,
    code: number,
    reason: string,
  ): Promise<void> {
    return this.serial(async () => {
      const attachment = socket.deserializeAttachment() as Attachment;
      await this.mutate(() =>
        this.room?.disconnect(attachment.playerId, attachment.connectionId),
      );
      if (
        socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CLOSING
      )
        socket.close(code, reason);
      this.broadcast();
    });
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    return this.webSocketClose(socket, 1011, "Connection error");
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    const creating = url.pathname === "/api/rooms";
    const match = /^\/api\/rooms\/([^/]+)(\/join|\/ws)?$/.exec(url.pathname);
    if (!creating && (!match || !ROOM_ID_PATTERN.test(match[1])))
      return failure("ROOM_NOT_FOUND", 404);
    const expectedMethod = creating || match?.[2] === "/join" ? "POST" : "GET";
    if (request.method !== expectedMethod)
      return new Response("Phương thức không hợp lệ.", {
        status: 405,
        headers: { Allow: expectedMethod },
      });
    if (
      (request.method === "POST" || match?.[2] === "/ws") &&
      request.headers.get("Origin") !== url.origin
    )
      return failure("INVALID_ORIGIN", 403);
    if (creating) {
      const ip = await hash(request.headers.get("CF-Connecting-IP") ?? "local");
      const allowed = await env.GAME_ROOMS.getByName("creation-gate").fetch(
        new Request(url.origin + "/internal/creation-limit", {
          headers: { "X-Rate-Key": ip },
        }),
      );
      if (!allowed.ok) return allowed;
      const roomId = crypto.randomUUID();
      return env.GAME_ROOMS.getByName(roomId).fetch(
        new Request(url.origin + "/api/rooms/" + roomId + "/create", request),
      );
    }
    return env.GAME_ROOMS.getByName(match![1]).fetch(request);
  },
} satisfies ExportedHandler<Env>;
