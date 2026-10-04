import {
  applyCommand,
  createGame,
  getFutureCards,
  resolveReaction,
  CARD_COUNTS,
  type GameState,
  type Random,
} from "../shared/engine";
import {
  NOPE_WINDOW_MS,
  CONNECTION_TIMEOUT_MS,
  ROOM_TTL_MS,
  errorMessage,
  type Capacity,
  type ClientCommand,
  type CommandResult,
  type RoomAction,
  type RoomSnapshot,
} from "../shared/protocol";

export type Member = {
  id: string;
  name: string;
  tokenHash: string;
  ready: boolean;
  connectionId: string | null;
  lastSeen: number | null;
  receipts: { command: ClientCommand; result: CommandResult }[];
};
export type RoomState = {
  schemaVersion: 1;
  rulesVersion: "original-2022";
  gameId: string | null;
  lastActivity: number;
  pause: null | { since: number; remainingNopeMs: number | null };
  roomId: string;
  version: number;
  capacity: Capacity;
  hostId: string;
  hostTransferPending: boolean;
  lastPlay?: RoomSnapshot["lastPlay"];
  members: Member[];
  game: GameState | null;
  reaction: null | { deadline: number; passedIds: string[] };
};

export function playerName(value: unknown): string {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value))
    throw new Error("INVALID_NAME");
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 32) throw new Error("INVALID_NAME");
  return name;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function fields(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function identifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}
export function parseCommand(value: unknown): ClientCommand {
  if (
    !record(value) ||
    !fields(value, ["type", "id", "version", "action"]) ||
    value.type !== "command" ||
    !identifier(value.id) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 0 ||
    !record(value.action)
  )
    throw new Error("INVALID_COMMAND");
  const action = value.action;
  let parsed: RoomAction;
  switch (action.type) {
    case "start":
    case "cancel_game":
    case "leave":
    case "draw":
    case "close_future":
    case "pass":
      if (!fields(action, ["type"])) throw new Error("INVALID_COMMAND");
      parsed = { type: action.type };
      break;
    case "ready":
      if (
        !fields(action, ["type", "ready"]) ||
        typeof action.ready !== "boolean"
      )
        throw new Error("INVALID_COMMAND");
      parsed = { type: "ready", ready: action.ready };
      break;
    case "set_capacity":
      if (
        !fields(action, ["type", "capacity"]) ||
        ![3, 4, 5].includes(action.capacity as number)
      )
        throw new Error("INVALID_COMMAND");
      parsed = { type: "set_capacity", capacity: action.capacity as Capacity };
      break;
    case "kick":
      if (!fields(action, ["type", "targetId"]) || !identifier(action.targetId))
        throw new Error("INVALID_COMMAND");
      parsed = { type: "kick", targetId: action.targetId };
      break;
    case "nope":
    case "give":
      if (!fields(action, ["type", "cardId"]) || !identifier(action.cardId))
        throw new Error("INVALID_COMMAND");
      parsed = { type: action.type, cardId: action.cardId };
      break;
    case "insert_bomb":
      if (
        !fields(action, ["type", "position"]) ||
        !Number.isSafeInteger(action.position) ||
        (action.position as number) < 0
      )
        throw new Error("INVALID_COMMAND");
      parsed = { type: "insert_bomb", position: action.position as number };
      break;
    case "play":
      if (
        !fields(action, ["type", "cardIds", "targetId", "requestedType"]) ||
        !Array.isArray(action.cardIds) ||
        action.cardIds.length < 1 ||
        action.cardIds.length > 3 ||
        !action.cardIds.every(identifier) ||
        (action.targetId !== undefined && !identifier(action.targetId)) ||
        (action.requestedType !== undefined &&
          (typeof action.requestedType !== "string" ||
            !Object.hasOwn(CARD_COUNTS, action.requestedType)))
      )
        throw new Error("INVALID_COMMAND");
      parsed = {
        type: "play",
        cardIds: action.cardIds,
        ...(action.targetId === undefined ? {} : { targetId: action.targetId }),
        ...(action.requestedType === undefined
          ? {}
          : {
              requestedType: action.requestedType as keyof typeof CARD_COUNTS,
            }),
      };
      break;
    default:
      throw new Error("INVALID_COMMAND");
  }
  return {
    type: "command",
    id: value.id,
    version: value.version as number,
    action: parsed,
  };
}

type LegacyRoomState = Omit<
  RoomState,
  | "schemaVersion"
  | "rulesVersion"
  | "gameId"
  | "lastActivity"
  | "hostTransferPending"
  | "pause"
  | "members"
> & { members: Omit<Member, "lastSeen">[] };

export class Room {
  state: RoomState;

  constructor(saved: RoomState | LegacyRoomState, now = Date.now()) {
    if (
      "schemaVersion" in saved &&
      (saved.schemaVersion !== 1 || saved.rulesVersion !== "original-2022")
    )
      throw new Error("UNSUPPORTED_SCHEMA");
    this.state = {
      ...saved,
      schemaVersion: 1,
      rulesVersion: "original-2022",
      gameId:
        "gameId" in saved
          ? saved.gameId
          : saved.game
            ? crypto.randomUUID()
            : null,
      lastActivity: "lastActivity" in saved ? saved.lastActivity : now,
      pause: "pause" in saved ? saved.pause : null,
      lastPlay: saved.lastPlay ?? null,
      hostTransferPending:
        "hostTransferPending" in saved ? saved.hostTransferPending : false,
      members: saved.members.map((member) => ({
        ...member,
        lastSeen:
          "lastSeen" in member
            ? member.lastSeen
            : member.connectionId
              ? now
              : null,
      })),
    };
    const phase = this.state.game?.phase;
    if (
      phase?.kind === "reaction" &&
      phase.nopeCount > 0 &&
      phase.lastNopePlayerId === undefined &&
      this.state.lastPlay?.cards.at(-1)?.type === "nope"
    ) {
      this.state.game = {
        ...this.state.game!,
        phase: { ...phase, lastNopePlayerId: this.state.lastPlay.playerId },
      };
    }
  }

  addMember(
    id: string,
    name: string,
    tokenHash: string,
    now = Date.now(),
  ): void {
    if (this.state.game) throw new Error("GAME_STARTED");
    if (this.state.members.length >= this.state.capacity)
      throw new Error("ROOM_FULL");
    this.state.members.push({
      id,
      name: playerName(name),
      tokenHash,
      ready: false,
      connectionId: null,
      lastSeen: null,
      receipts: [],
    });
    if (!this.state.hostId) this.state.hostId = id;
    this.state.lastActivity = now;
    this.state.version++;
  }

  connect(playerId: string, connectionId: string, now = Date.now()): void {
    const member = this.member(playerId);
    member.connectionId = connectionId;
    member.lastSeen = now;
    if (this.state.hostTransferPending) {
      this.state.hostId = playerId;
      this.state.hostTransferPending = false;
    }
    this.state.lastActivity = now;
    this.updatePause(now);
    this.state.version++;
  }

  disconnect(
    playerId: string,
    connectionId: string,
    now = Date.now(),
  ): boolean {
    const member = this.state.members.find((member) => member.id === playerId);
    if (!member || member.connectionId !== connectionId) return false;
    member.connectionId = null;
    member.lastSeen = null;
    this.updatePause(now);
    this.state.version++;
    return true;
  }

  private missingIds(): string[] {
    return this.state.game?.phase.kind === "finished"
      ? []
      : (this.state.game?.players
          .filter(
            (player) => player.alive && !this.member(player.id).connectionId,
          )
          .map((player) => player.id) ?? []);
  }

  private updatePause(now: number): void {
    if (this.missingIds().length) {
      this.state.pause ??= {
        since: now,
        remainingNopeMs: this.state.reaction
          ? Math.max(0, this.state.reaction.deadline - now)
          : null,
      };
    } else if (this.state.pause) {
      if (this.state.reaction)
        this.state.reaction.deadline =
          now + (this.state.pause.remainingNopeMs ?? 0);
      this.state.pause = null;
    }
  }

  reconcileConnections(connections: Map<string, number>, now: number): void {
    for (const member of this.state.members) {
      if (!member.connectionId) continue;
      const lastSeen = connections.get(member.connectionId);
      if (lastSeen === undefined || now >= lastSeen + CONNECTION_TIMEOUT_MS)
        this.disconnect(member.id, member.connectionId, now);
    }
    const pause = this.state.pause;
    this.updatePause(now);
    if (pause !== this.state.pause) this.state.version++;
  }

  nextAlarm(connections: Map<string, number>): number {
    const deadlines = [this.state.lastActivity + ROOM_TTL_MS];
    if (this.state.reaction && !this.state.pause)
      deadlines.push(this.state.reaction.deadline);
    for (const member of this.state.members) {
      if (member.connectionId) {
        const lastSeen =
          connections.get(member.connectionId) ?? member.lastSeen!;
        deadlines.push(lastSeen + CONNECTION_TIMEOUT_MS);
      }
    }
    return Math.min(...deadlines);
  }

  private member(playerId: string): Member {
    const member = this.state.members.find((member) => member.id === playerId);
    if (!member) throw new Error("INVALID_SESSION");
    return member;
  }

  private lobby(): void {
    if (this.state.game) throw new Error("GAME_STARTED");
  }

  private host(playerId: string): void {
    if (this.state.hostId !== playerId) throw new Error("NOT_HOST");
  }

  expire(now: number, random: Random): boolean {
    if (
      this.state.pause ||
      !this.state.reaction ||
      now < this.state.reaction.deadline
    )
      return false;
    this.state.game = resolveReaction(this.state.game!, random);
    this.state.reaction = null;
    this.state.version++;
    return true;
  }

  process(
    playerId: string,
    command: ClientCommand,
    now: number,
    random: Random,
  ): CommandResult {
    const member = this.member(playerId);
    const previous = member.receipts.find(
      (receipt) => receipt.command.id === command.id,
    );
    if (previous) {
      if (JSON.stringify(previous.command) === JSON.stringify(command))
        return structuredClone(previous.result);
      return {
        type: "result",
        id: command.id,
        ok: false,
        version: this.state.version,
        code: "COMMAND_ID_REUSED",
        message: errorMessage("COMMAND_ID_REUSED"),
      };
    }
    const expired = this.expire(now, random);
    let result: CommandResult;
    try {
      if (expired && ["nope", "pass"].includes(command.action.type))
        throw new Error("DEADLINE_PASSED");
      if (command.version !== this.state.version)
        throw new Error("STALE_VERSION");
      this.execute(playerId, command.action, now, random);
      this.state.lastActivity = now;
      if (member.connectionId) member.lastSeen = now;
      if (this.state.game?.phase.kind === "finished")
        for (const candidate of this.state.members) candidate.ready = false;
      this.state.version++;
      result = {
        type: "result",
        id: command.id,
        ok: true,
        version: this.state.version,
      };
    } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_COMMAND";
      result = {
        type: "result",
        id: command.id,
        ok: false,
        version: this.state.version,
        code,
        message: errorMessage(code),
      };
    }
    member.receipts.push({ command: structuredClone(command), result });
    // Lệnh cũ giữ phiên bản cũ nên không được thực hiện lại sau khi bỏ ACK khỏi cache.
    if (member.receipts.length > 256) member.receipts.shift();
    return structuredClone(result);
  }

  private execute(
    playerId: string,
    action: RoomAction,
    now: number,
    random: Random,
  ): void {
    const member = this.member(playerId);
    if (this.state.pause && !["cancel_game", "leave"].includes(action.type))
      throw new Error("GAME_PAUSED");
    switch (action.type) {
      case "cancel_game":
        this.host(playerId);
        if (!this.state.game) throw new Error("GAME_NOT_STARTED");
        this.state.game = null;
        this.state.gameId = null;
        this.state.reaction = null;
        this.state.pause = null;
        this.state.hostTransferPending = false;
        this.state.lastPlay = null;
        for (const candidate of this.state.members) candidate.ready = false;
        return;
      case "ready":
        this.lobby();
        member.ready = action.ready;
        return;
      case "set_capacity":
        this.lobby();
        this.host(playerId);
        if (action.capacity < this.state.members.length)
          throw new Error("CAPACITY_TOO_SMALL");
        this.state.capacity = action.capacity;
        for (const candidate of this.state.members) candidate.ready = false;
        return;
      case "start":
        this.lobby();
        this.host(playerId);
        if (
          this.state.members.length !== this.state.capacity ||
          this.state.members.some(
            (candidate) => !candidate.ready || !candidate.connectionId,
          )
        )
          throw new Error("NOT_READY");
        this.state.game = createGame(
          this.state.members.map((candidate) => candidate.id),
          random,
        );
        this.state.gameId = crypto.randomUUID();
        this.state.lastPlay = null;
        for (const candidate of this.state.members) candidate.ready = false;
        return;
      case "kick":
      case "leave": {
        if (
          action.type === "leave" &&
          this.state.game &&
          this.state.game.phase.kind !== "finished"
        ) {
          member.connectionId = null;
          member.lastSeen = null;
          this.updatePause(now);
          if (this.state.hostId === playerId) {
            const next = this.state.members.find(
              (candidate) => candidate.connectionId,
            );
            this.state.hostId = next?.id ?? playerId;
            this.state.hostTransferPending = !next;
          }
          return;
        }
        if (
          action.type === "leave" &&
          this.state.game?.phase.kind === "finished"
        ) {
          this.state.game = null;
          this.state.gameId = null;
        }
        this.lobby();
        const targetId = action.type === "leave" ? playerId : action.targetId;
        if (action.type === "kick") {
          this.host(playerId);
          if (targetId === playerId) throw new Error("INVALID_TARGET");
        }
        this.member(targetId);
        this.state.members = this.state.members.filter(
          (candidate) => candidate.id !== targetId,
        );
        if (this.state.hostId === targetId)
          this.state.hostId =
            (
              this.state.members.find((candidate) => candidate.connectionId) ??
              this.state.members[0]
            )?.id ?? "";
        return;
      }
      case "pass": {
        if (!this.state.reaction) throw new Error("NO_REACTION");
        if (
          !this.state.game!.players.find((player) => player.id === playerId)
            ?.alive
        )
          throw new Error("PLAYER_NOT_ALIVE");
        if (this.state.reaction.passedIds.includes(playerId))
          throw new Error("ALREADY_PASSED");
        this.state.reaction.passedIds.push(playerId);
        if (
          this.state.game!.players.every(
            (player) =>
              !player.alive ||
              this.state.reaction!.passedIds.includes(player.id),
          )
        ) {
          this.state.game = resolveReaction(this.state.game!, random);
          this.state.reaction = null;
        }
        return;
      }
      default: {
        if (!this.state.game) throw new Error("GAME_NOT_STARTED");
        const next = applyCommand(this.state.game, { ...action, playerId });
        if (action.type === "play" || action.type === "nope") {
          this.state.lastPlay = {
            id: this.state.version + 1,
            playerId,
            cards: next.discardPile.slice(this.state.game.discardPile.length),
            ...(action.type === "play" &&
            next.phase.kind === "reaction" &&
            "targetId" in next.phase.action
              ? { targetId: next.phase.action.targetId }
              : {}),
          };
          this.state.reaction = {
            deadline: now + NOPE_WINDOW_MS,
            passedIds: [],
          };
        }
        this.state.game = next;
      }
    }
  }

  view(playerId: string | null): RoomSnapshot {
    const { state } = this;
    const game = state.game;
    const player = game?.players.find((player) => player.id === playerId);
    return structuredClone({
      type: "snapshot",
      roomId: state.roomId,
      version: state.version,
      capacity: state.capacity,
      hostId: state.hostId,
      you: playerId,
      gameId: state.gameId,
      lastPlay: game ? (state.lastPlay ?? null) : null,
      pause: state.pause
        ? { ...state.pause, missingIds: this.missingIds() }
        : null,
      members: state.members.map((member) => {
        const player = game?.players.find((player) => player.id === member.id);
        return {
          id: member.id,
          name: member.name,
          ready: member.ready,
          connected: member.connectionId !== null,
          alive: player?.alive ?? true,
          cardCount: player?.hand.length ?? 0,
        };
      }),
      game: game
        ? {
            hand: player?.alive ? player.hand : [],
            futureCards: player?.alive ? getFutureCards(game, player.id) : [],
            drawCount: game.drawPile.length,
            discardPile: game.discardPile,
            turn: game.turn,
            phase:
              game.phase.kind === "defuse"
                ? { kind: "defuse", playerId: game.phase.playerId }
                : game.phase,
            reaction: state.reaction,
          }
        : null,
    });
  }
}
