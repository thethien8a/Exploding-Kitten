import { DurableObject } from "cloudflare:workers";
import { ROOM_ID_PATTERN, type RoomSnapshot } from "../shared/protocol";

interface Env {
  GAME_ROOMS: DurableObjectNamespace<GameRoom>;
  ASSETS: Fetcher;
}

export class GameRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        value INTEGER NOT NULL
      );
      INSERT OR IGNORE INTO room_state (id, value) VALUES (1, 0);
    `);
  }

  private snapshot(): RoomSnapshot {
    const { value } = this.ctx.storage.sql
      .exec<{ value: number }>("SELECT value FROM room_state WHERE id = 1")
      .one();
    return { type: "snapshot", value };
  }

  fetch(request: Request): Response {
    if (!new URL(request.url).pathname.endsWith("/ws")) {
      return Response.json(this.snapshot());
    }

    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Cần kết nối WebSocket.", { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify(this.snapshot()));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    let command: unknown;
    if (typeof message === "string" && message.length <= 256) {
      try {
        command = JSON.parse(message);
      } catch {
        command = null;
      }
    }

    if (
      typeof command !== "object" ||
      command === null ||
      !("type" in command) ||
      command.type !== "increment"
    ) {
      socket.send(
        JSON.stringify({
          type: "error",
          message: "Lệnh thử nghiệm không hợp lệ.",
        }),
      );
      return;
    }

    // Một câu UPDATE tránh mất lượt tăng khi nhiều client gửi cùng lúc.
    const { value } = this.ctx.storage.sql
      .exec<{ value: number }>(
        "UPDATE room_state SET value = value + 1 WHERE id = 1 RETURNING value",
      )
      .one();
    const snapshot: RoomSnapshot = { type: "snapshot", value };
    const payload = JSON.stringify(snapshot);
    for (const peer of this.ctx.getWebSockets()) {
      if (peer.readyState === WebSocket.OPEN) peer.send(payload);
    }
  }
}

export default {
  fetch(request, env): Response | Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    const match = /^\/api\/rooms\/([^/]+)(\/ws)?$/.exec(url.pathname);
    if (!match || !ROOM_ID_PATTERN.test(match[1])) {
      return Response.json(
        { error: "Đường dẫn phòng không hợp lệ." },
        { status: 404 },
      );
    }
    if (request.method !== "GET") {
      return new Response("Chỉ hỗ trợ GET.", {
        status: 405,
        headers: { Allow: "GET" },
      });
    }
    if (match[2] && request.headers.get("Origin") !== url.origin) {
      return new Response("Nguồn kết nối không hợp lệ.", { status: 403 });
    }

    return env.GAME_ROOMS.getByName(match[1]).fetch(request);
  },
} satisfies ExportedHandler<Env>;
