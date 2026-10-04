export const ROOM_ID_PATTERN = /^[a-z0-9-]{1,48}$/;

export type RoomSnapshot = {
  type: "snapshot";
  value: number;
};

export type RoomMessage = RoomSnapshot | { type: "error"; message: string };
