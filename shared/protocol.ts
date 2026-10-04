import type { Card, CardType, GameCommand, GameState, Phase } from "./engine";

export const ROOM_ID_PATTERN = /^[a-z0-9-]{1,48}$/;
export const MAX_MESSAGE_BYTES = 2048;
export const NOPE_WINDOW_MS = 5000;
export const HEARTBEAT_MS = 10000;
export const CONNECTION_TIMEOUT_MS = 25000;
export const ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const HEARTBEAT_REQUEST = '{"type":"ping"}';
export const HEARTBEAT_RESPONSE = '{"type":"pong"}';
export type Capacity = 3 | 4 | 5;
export type Session = { roomId: string; playerId: string; token: string };
type GameAction = GameCommand extends infer Command
  ? Command extends GameCommand
    ? Omit<Command, "playerId">
    : never
  : never;
export type RoomAction =
  | GameAction
  | { type: "ready"; ready: boolean }
  | { type: "set_capacity"; capacity: Capacity }
  | { type: "start" }
  | { type: "cancel_game" }
  | { type: "kick"; targetId: string }
  | { type: "leave" }
  | { type: "pass" };
export type ClientCommand = {
  type: "command";
  id: string;
  version: number;
  action: RoomAction;
};
export type CommandResult = {
  type: "result";
  id: string;
  ok: boolean;
  version: number;
  code?: string;
  message?: string;
};
export type PublicPhase =
  Exclude<Phase, { kind: "defuse" }> | { kind: "defuse"; playerId: string };
export type RoomSnapshot = {
  type: "snapshot";
  roomId: string;
  version: number;
  capacity: Capacity;
  hostId: string;
  you: string | null;
  gameId: string | null;
  lastPlay: null | {
    id: number;
    playerId: string;
    targetId?: string;
    cards: Card[];
  };
  pause: null | {
    since: number;
    missingIds: string[];
    remainingNopeMs: number | null;
  };
  members: {
    id: string;
    name: string;
    ready: boolean;
    connected: boolean;
    alive: boolean;
    cardCount: number;
  }[];
  game: null | {
    hand: Card[];
    futureCards: Card[];
    drawCount: number;
    discardPile: Card[];
    turn: GameState["turn"];
    phase: PublicPhase;
    reaction: null | { deadline: number; passedIds: string[] };
  };
};
export type RoomMessage =
  | RoomSnapshot
  | CommandResult
  | { type: "error"; code: string; message: string }
  | { type: "replaced"; message: string }
  | { type: "pong" };
export const CARD_NAMES: Record<CardType, string> = {
  exploding_kitten: "Mèo Nổ",
  defuse: "Gỡ Bom",
  attack: "Tấn Công",
  skip: "Bỏ Lượt",
  favor: "Xin Bài",
  shuffle: "Xáo Bài",
  see_future: "Xem Tương Lai",
  nope: "Chặn — Nope",
  tacocat: "Mèo Taco",
  cattermelon: "Mèo Dưa Hấu",
  hairy_potato_cat: "Mèo Khoai Tây",
  beard_cat: "Mèo Râu",
  rainbow_ralphing_cat: "Mèo Cầu Vồng",
};
const ERRORS: Record<string, string> = {
  ROOM_NOT_FOUND: "Phòng không tồn tại hoặc đã hết hạn.",
  INVALID_ORIGIN: "Nguồn kết nối không hợp lệ.",
  WEBSOCKET_REQUIRED: "Cần kết nối WebSocket.",
  INVALID_COMMAND: "Lệnh không hợp lệ.",
  INVALID_NAME: "Tên cần 1–32 ký tự, không chứa ký tự điều khiển.",
  INVALID_CAPACITY: "Chỉ chọn phòng 3, 4 hoặc 5 người.",
  ROOM_FULL: "Phòng đã đủ chỗ.",
  GAME_STARTED: "Ván đã bắt đầu, không nhận người chơi mới.",
  NOT_HOST: "Chỉ chủ phòng được thực hiện thao tác này.",
  NOT_READY: "Cần đủ người, tất cả online và sẵn sàng.",
  CAPACITY_TOO_SMALL: "Không thể chọn ít chỗ hơn số người hiện có.",
  INVALID_TARGET: "Không thể chọn người này.",
  INVALID_SESSION: "Phiên không hợp lệ hoặc bạn đã bị mời ra.",
  STALE_VERSION: "Bàn đã thay đổi. Hãy xem trạng thái mới và thử lại.",
  COMMAND_ID_REUSED: "ID lệnh đã được dùng cho thao tác khác.",
  DEADLINE_PASSED: "Cửa sổ Nope đã hết hạn.",
  NO_REACTION: "Không còn hành động chờ Nope.",
  CANNOT_NOPE_YOURSELF: "Bạn không thể Nope lá mình vừa đánh.",
  ALREADY_PASSED: "Bạn đã bỏ qua cửa sổ này.",
  NOT_YOUR_TURN: "Chưa tới lượt của bạn.",
  ACTION_PENDING: "Cần hoàn tất thao tác đang chờ.",
  CARD_NOT_IN_HAND: "Bạn không sở hữu lá bài này.",
  PLAYER_NOT_ALIVE: "Bạn đã bị loại; vẫn có thể xem bàn chơi.",
  RATE_LIMITED: "Thao tác quá nhanh. Hãy chờ một chút.",
  GAME_NOT_STARTED: "Ván chưa bắt đầu.",
  GAME_PAUSED: "Ván đang tạm dừng để chờ người chơi kết nối lại.",
  ROOM_EXPIRED:
    "Phòng đã hết hạn sau 7 ngày không hoạt động. Hãy tạo phòng mới.",
  SAVE_FAILED:
    "Chưa lưu được thao tác. Không xác nhận thành công; hãy kết nối lại và thử lại.",
  NOT_YOUR_CHOICE: "Lựa chọn này thuộc người chơi khác.",
};
export function errorMessage(code: string): string {
  return ERRORS[code] ?? "Thao tác không hợp lệ ở trạng thái hiện tại.";
}
