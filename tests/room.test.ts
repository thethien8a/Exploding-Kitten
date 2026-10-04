import { describe, expect, test, vi } from "vitest";
import { Room, parseCommand, playerName, type RoomState } from "../worker/room";
import {
  CONNECTION_TIMEOUT_MS,
  ROOM_TTL_MS,
  type ClientCommand,
  type RoomAction,
} from "../shared/protocol";

let sequence = 0;
function lobby() {
  const room = new Room({
    roomId: "room-a",
    capacity: 3,
    hostId: "",
    version: 0,
    members: [],
    game: null,
    reaction: null,
  });
  for (const id of ["a", "b", "c"]) {
    room.addMember(id, "Cùng tên", "secret-" + id);
    room.connect(id, "socket-" + id);
  }
  return room;
}
function fixture() {
  const room = lobby();
  room.state.game = {
    players: [
      {
        id: "a",
        alive: true,
        hand: [
          { id: "skip-1", type: "skip" },
          { id: "future-1", type: "see_future" },
          { id: "favor-1", type: "favor" },
          { id: "shuffle-1", type: "shuffle" },
        ],
      },
      {
        id: "b",
        alive: true,
        hand: [
          { id: "nope-1", type: "nope" },
          { id: "defuse-1", type: "defuse" },
          { id: "taco-1", type: "tacocat" },
        ],
      },
      {
        id: "c",
        alive: true,
        hand: [
          { id: "nope-2", type: "nope" },
          { id: "taco-2", type: "tacocat" },
        ],
      },
    ],
    drawPile: [
      { id: "attack-4", type: "attack" },
      { id: "rainbow-2", type: "rainbow_ralphing_cat" },
      { id: "favor-4", type: "favor" },
      { id: "bomb-4", type: "exploding_kitten" },
    ],
    discardPile: [],
    removedCards: [],
    turn: { playerId: "a", remaining: 1, attacked: false },
    phase: { kind: "turn" },
  };
  return room;
}
function envelope(room: Room, action: RoomAction): ClientCommand {
  return {
    type: "command",
    id: "command-" + sequence++,
    version: room.state.version,
    action,
  };
}
function send(room: Room, playerId: string, action: RoomAction, now = 1000) {
  return room.process(playerId, envelope(room, action), now, () => 0.37);
}
function passAll(room: Room, now = 1200) {
  for (const id of ["a", "b", "c"])
    expect(send(room, id, { type: "pass" }, now).ok).toBe(true);
}

describe("phòng chờ và quyền", () => {
  test.each([3, 4, 5] as const)(
    "chỉ bắt đầu khi đúng %i ghế, online và ready",
    (capacity) => {
      const room = lobby();
      expect(send(room, "a", { type: "set_capacity", capacity }).ok).toBe(true);
      for (let index = 3; index < capacity; index++) {
        const id = "seat-" + index;
        room.addMember(id, id, id);
        room.connect(id, id);
      }
      expect(send(room, "a", { type: "start" }).code).toBe("NOT_READY");
      for (const member of room.state.members)
        send(room, member.id, { type: "ready", ready: true });
      expect(send(room, "b", { type: "start" }).code).toBe("NOT_HOST");
      room.disconnect("b", "socket-b");
      expect(send(room, "a", { type: "start" }).code).toBe("NOT_READY");
      room.connect("b", "new-b");
      expect(send(room, "a", { type: "start" }).ok).toBe(true);
      expect(
        room.state.game!.players.map((player) => player.hand.length),
      ).toEqual(Array(capacity).fill(8));
      expect(room.state.game!.drawPile).toHaveLength(
        { 3: 29, 4: 23, 5: 16 }[capacity],
      );
    },
  );
  test("thiếu ghế dù mọi người ready cũng không bắt đầu", () => {
    const room = lobby();
    send(room, "a", { type: "set_capacity", capacity: 4 });
    for (const id of ["a", "b", "c"])
      send(room, id, { type: "ready", ready: true });
    expect(send(room, "a", { type: "start" }).code).toBe("NOT_READY");
  });
  test("đổi số ghế xóa ready và không giảm dưới số người", () => {
    const room = lobby();
    send(room, "b", { type: "ready", ready: true });
    expect(send(room, "b", { type: "set_capacity", capacity: 4 }).code).toBe(
      "NOT_HOST",
    );
    send(room, "a", { type: "set_capacity", capacity: 4 });
    expect(room.state.members.every((member) => !member.ready)).toBe(true);
    room.addMember("d", "D", "hash-d");
    expect(send(room, "a", { type: "set_capacity", capacity: 3 }).code).toBe(
      "CAPACITY_TOO_SMALL",
    );
  });
  test("trùng tên tạo ghế riêng, phòng đầy bị chặn", () => {
    const room = lobby();
    expect(new Set(room.state.members.map((member) => member.id)).size).toBe(3);
    expect(() => room.addMember("d", "Cùng tên", "hash-d")).toThrow(
      "ROOM_FULL",
    );
  });
  test("chủ phòng rời chuyển cho người online theo thứ tự ghế", () => {
    const room = lobby();
    room.disconnect("b", "socket-b");
    expect(send(room, "a", { type: "leave" }).ok).toBe(true);
    expect(room.state.hostId).toBe("c");
    expect(room.state.members.map((member) => member.id)).toEqual(["b", "c"]);
  });
  test("mất kết nối giữ quyền, tab cũ đóng không làm tab mới offline", () => {
    const room = lobby();
    room.connect("a", "replacement");
    expect(room.disconnect("a", "socket-a")).toBe(false);
    expect(room.view("a").members[0].connected).toBe(true);
    room.disconnect("a", "replacement");
    expect(room.state.hostId).toBe("a");
  });
  test("kick đúng quyền, vô hiệu ghế cũ và không kick giữa ván", () => {
    const room = lobby();
    expect(send(room, "b", { type: "kick", targetId: "c" }).code).toBe(
      "NOT_HOST",
    );
    expect(send(room, "a", { type: "kick", targetId: "a" }).code).toBe(
      "INVALID_TARGET",
    );
    expect(send(room, "a", { type: "kick", targetId: "b" }).ok).toBe(true);
    expect(() => send(room, "b", { type: "ready", ready: true })).toThrow(
      "INVALID_SESSION",
    );
    const game = fixture();
    expect(send(game, "a", { type: "kick", targetId: "b" }).code).toBe(
      "GAME_STARTED",
    );
    expect(() => game.addMember("d", "D", "hash-d")).toThrow("GAME_STARTED");
  });
});

describe("phiên bản và chống xử lý trùng", () => {
  test("rút gửi lại cùng ID trả cùng ACK, khác ID cùng phiên bản không rút lần hai", () => {
    const room = fixture();
    const command = envelope(room, { type: "draw" });
    const result = room.process("a", command, 1000, () => 0.3);
    expect(room.process("a", command, 1200, () => 0.9)).toEqual(result);
    expect(
      room.process("a", { ...command, id: "second-draw" }, 1200, () => 0.9)
        .code,
    ).toBe("STALE_VERSION");
    expect(room.state.game!.drawPile.map((card) => card.id)).toEqual([
      "rainbow-2",
      "favor-4",
      "bomb-4",
    ]);
    expect(room.state.game!.players[0].hand.at(-1)?.id).toBe("attack-4");
  });
  test("cùng ID đổi nội dung bị chặn, ID giống nhau của hai ghế không đụng nhau", () => {
    const room = lobby();
    const command = envelope(room, { type: "ready", ready: true });
    room.process("a", command, 1000, () => 0.3);
    expect(
      room.process(
        "a",
        { ...command, action: { type: "leave" } },
        1000,
        () => 0.3,
      ).code,
    ).toBe("COMMAND_ID_REUSED");
    expect(
      room.process(
        "b",
        { ...command, version: room.state.version },
        1000,
        () => 0.3,
      ).ok,
    ).toBe(true);
  });
  test("ACK lỗi không được biến thành thành công khi trạng thái đổi", () => {
    const room = lobby();
    const command = envelope(room, { type: "start" });
    const rejected = room.process("a", command, 1000, () => 0.3);
    for (const id of ["a", "b", "c"])
      send(room, id, { type: "ready", ready: true });
    expect(room.process("a", command, 1000, () => 0.3)).toEqual(rejected);
    expect(room.state.game).toBeNull();
  });
  test("hết cache ACK vẫn chặn retry phiên bản cũ", () => {
    const room = lobby();
    const command = envelope(room, { type: "ready", ready: true });
    room.process("a", command, 1000, () => 0.3);
    for (let index = 0; index < 257; index++)
      send(room, "a", { type: "ready", ready: index % 2 === 0 });
    expect(room.process("a", command, 1000, () => 0.3).code).toBe(
      "STALE_VERSION",
    );
    expect(room.state.members[0].receipts).toHaveLength(256);
  });
  test("retry bỏ qua cuối không xáo bài hoặc gọi random lần hai", () => {
    const room = fixture();
    send(room, "a", { type: "play", cardIds: ["shuffle-1"] });
    send(room, "a", { type: "pass" });
    send(room, "b", { type: "pass" });
    const command = envelope(room, { type: "pass" });
    const random = vi.fn(() => 0.21);
    const result = room.process("c", command, 1200, random);
    const pile = structuredClone(room.state.game!.drawPile);
    const calls = random.mock.calls.length;
    expect(calls).toBe(3);
    expect(room.process("c", command, 1400, random)).toEqual(result);
    expect(random).toHaveBeenCalledTimes(calls);
    expect(room.state.game!.drawPile).toEqual(pile);
  });
});

describe("cửa sổ Nope phía server", () => {
  test("phải có cả người đánh bỏ qua mới chốt sớm", () => {
    const room = fixture();
    send(room, "a", { type: "play", cardIds: ["skip-1"] });
    send(room, "b", { type: "pass" });
    send(room, "c", { type: "pass" });
    expect(room.state.game!.phase.kind).toBe("reaction");
    expect(send(room, "b", { type: "pass" }).code).toBe("ALREADY_PASSED");
    send(room, "a", { type: "pass" });
    expect(room.state.game!.turn.playerId).toBe("b");
    expect(room.state.reaction).toBeNull();
  });
  test.each([0, 1, 2])("parity %i Nope và cửa sổ mới xóa pass", (count) => {
    const room = fixture();
    send(room, "a", { type: "play", cardIds: ["skip-1"] }, 1000);
    for (let index = 0; index < count; index++) {
      send(room, "a", { type: "pass" }, 1100 + index);
      expect(
        send(
          room,
          index === 0 ? "b" : "c",
          { type: "nope", cardId: "nope-" + (index + 1) },
          2000 + index,
        ).ok,
      ).toBe(true);
      expect(room.state.reaction).toEqual({
        deadline: 7000 + index,
        passedIds: [],
      });
    }
    passAll(room, 3000);
    expect(room.state.game!.turn.playerId).toBe(count % 2 === 0 ? "b" : "a");
    expect(room.state.game!.discardPile).toHaveLength(count + 1);
  });
  test.each([false, true])(
    "tự Nope bị từ chối, phản Nope giữ sau restore (snapshot cũ: %s)",
    (legacy) => {
      let room = fixture();
      room.state.game!.players[0].hand.push({ id: "nope-a", type: "nope" });
      room.state.game!.players[1].hand.push({ id: "nope-b", type: "nope" });
      send(room, "a", { type: "play", cardIds: ["skip-1"] }, 1000);
      send(room, "a", { type: "pass" }, 1100);
      const initial = room.view("a");
      expect(
        send(room, "a", { type: "nope", cardId: "nope-a" }, 1200),
      ).toMatchObject({
        ok: false,
        code: "CANNOT_NOPE_YOURSELF",
        message: "Bạn không thể Nope lá mình vừa đánh.",
      });
      expect(room.view("a")).toEqual(initial);
      expect(send(room, "b", { type: "nope", cardId: "nope-1" }, 1300).ok).toBe(
        true,
      );
      const saved = JSON.parse(JSON.stringify(room.state)) as RoomState;
      if (legacy && saved.game!.phase.kind === "reaction")
        delete saved.game!.phase.lastNopePlayerId;
      room = new Room(saved, 1400);
      expect(room.view("a").game!.phase).toMatchObject({
        nopeCount: 1,
        lastNopePlayerId: "b",
      });
      const before = room.view("b");
      expect(
        send(room, "b", { type: "nope", cardId: "nope-b" }, 1500).code,
      ).toBe("CANNOT_NOPE_YOURSELF");
      expect(room.view("b")).toEqual(before);
      expect(send(room, "a", { type: "nope", cardId: "nope-a" }, 1600).ok).toBe(
        true,
      );
      expect(room.view("a").game!.phase).toMatchObject({
        nopeCount: 2,
        lastNopePlayerId: "a",
      });
      expect(room.state.reaction).toEqual({ deadline: 6600, passedIds: [] });
      passAll(room, 1700);
      expect(room.state.game!.turn.playerId).toBe("b");
    },
  );

  test.each([5999, 6000, 6001])(
    "ranh giới deadline khi lệnh tới lúc %i",
    (now) => {
      const room = fixture();
      send(room, "a", { type: "play", cardIds: ["skip-1"] }, 1000);
      const result = send(room, "b", { type: "nope", cardId: "nope-1" }, now);
      if (now < 6000) {
        expect(result.ok).toBe(true);
        expect(room.state.reaction!.deadline).toBe(10999);
      } else {
        expect(result.code).toBe("DEADLINE_PASSED");
        expect(room.state.game!.turn.playerId).toBe("b");
        expect(room.state.game!.players[1].hand).toHaveLength(3);
      }
    },
  );
  test("timer cũ không chốt cửa sổ mới; expire chạy lại không xử lý hai lần", () => {
    const room = fixture();
    send(room, "a", { type: "play", cardIds: ["skip-1"] }, 1000);
    send(room, "b", { type: "nope", cardId: "nope-1" }, 4000);
    expect(room.expire(6000, () => 0.3)).toBe(false);
    expect(room.expire(9000, () => 0.3)).toBe(true);
    const version = room.state.version;
    expect(room.expire(10000, () => 0.3)).toBe(false);
    expect(room.state.version).toBe(version);
    expect(room.state.game!.turn.playerId).toBe("a");
  });
  test("hai Nope cùng phiên bản: lệnh thứ hai không tiêu bài, thử lại với phiên bản mới mới hợp lệ", () => {
    const room = fixture();
    send(room, "a", { type: "play", cardIds: ["skip-1"] });
    const one = envelope(room, { type: "nope", cardId: "nope-1" });
    const two = envelope(room, { type: "nope", cardId: "nope-2" });
    expect(room.process("b", one, 1200, () => 0.3).ok).toBe(true);
    expect(room.process("c", two, 1200, () => 0.3).code).toBe("STALE_VERSION");
    expect(room.state.game!.players[2].hand).toHaveLength(2);
    expect(send(room, "c", { type: "nope", cardId: "nope-2" }, 1300).ok).toBe(
      true,
    );
    passAll(room, 1400);
    expect(room.state.game!.turn.playerId).toBe("b");
  });
});

describe("lá vừa đánh công khai", () => {
  test.each([2, 3])(
    "combo %i lá giữ đủ bài và đúng người; Nope không gộp lượt trước",
    (count) => {
      const room = fixture();
      const cards = Array.from({ length: count }, (_, index) => ({
        id: "combo-" + index,
        type: "tacocat" as const,
      }));
      room.state.game!.players[0].hand.push(...cards);
      room.state.game!.discardPile.push({ id: "older", type: "attack" });
      expect(
        send(room, "a", {
          type: "play",
          cardIds: cards.map((card) => card.id),
          targetId: "b",
          ...(count === 3 ? { requestedType: "defuse" as const } : {}),
        }).ok,
      ).toBe(true);
      const combo = {
        id: room.state.version,
        playerId: "a",
        targetId: "b",
        cards,
      };
      for (const viewer of ["a", "b", "c", null])
        expect(room.view(viewer).lastPlay).toEqual(combo);
      expect(send(room, "b", { type: "nope", cardId: "nope-1" }).ok).toBe(true);
      const nope = {
        id: room.state.version,
        playerId: "b",
        cards: [{ id: "nope-1", type: "nope" }],
      };
      expect(nope.id).toBeGreaterThan(combo.id);
      expect(room.view("c").lastPlay).toEqual(nope);
      expect(room.view("c").game!.discardPile.map((card) => card.id)).toEqual([
        "older",
        ...cards.map((card) => card.id),
        "nope-1",
      ]);
    },
  );
  test("lệnh lỗi và replay ACK sau restart không thay người/lá mới nhất", () => {
    const room = fixture();
    const command = envelope(room, {
      type: "play",
      cardIds: ["favor-1"],
      targetId: "b",
    });
    const ack = room.process("a", command, 1000, () => 0.37);
    expect(ack.ok).toBe(true);
    const played = {
      id: ack.version,
      playerId: "a",
      targetId: "b",
      cards: [{ id: "favor-1", type: "favor" }],
    };
    const restoredPlay = new Room(
      JSON.parse(JSON.stringify(room.state)) as RoomState,
    );
    expect(restoredPlay.view("c").lastPlay).toEqual(played);
    expect(restoredPlay.process("a", command, 1050, () => 0.1)).toEqual(ack);
    const exposedPlay = restoredPlay.view("a");
    exposedPlay.lastPlay!.playerId = "c";
    expect(restoredPlay.view(null).lastPlay).toEqual(played);
    send(room, "b", { type: "nope", cardId: "nope-1" }, 1100);
    const latest = {
      id: room.state.version,
      playerId: "b",
      cards: [{ id: "nope-1", type: "nope" }],
    };
    expect(
      send(room, "c", { type: "play", cardIds: ["not-owned"] }, 1200).ok,
    ).toBe(false);
    expect(room.view("a").lastPlay).toEqual(latest);
    const restored = new Room(
      JSON.parse(JSON.stringify(room.state)) as RoomState,
    );
    expect(restored.view("a").lastPlay).toEqual(latest);
    expect(restored.process("a", command, 1300, () => 0.1)).toEqual(ack);
    expect(restored.view("a").lastPlay).toEqual(latest);
    const exposed = restored.view("a");
    exposed.lastPlay!.cards.pop();
    expect(restored.view(null).lastPlay).toEqual(latest);
  });
  test("bài không nhắm mục tiêu không công bố target client tự gửi", () => {
    const room = fixture();
    expect(
      send(room, "a", { type: "play", cardIds: ["skip-1"], targetId: "c" }).ok,
    ).toBe(true);
    expect(room.view(null).lastPlay).toEqual({
      id: room.state.version,
      playerId: "a",
      cards: [{ id: "skip-1", type: "skip" }],
    });
  });
  test("snapshot cũ thiếu lastPlay vẫn phục hồi, hủy/tái đấu xóa thông báo cũ", () => {
    const room = fixture();
    const old = structuredClone(room.state);
    delete old.lastPlay;
    expect(new Room(old).view("a").lastPlay).toBeNull();
    send(room, "a", { type: "play", cardIds: ["skip-1"] });
    expect(room.view("a").lastPlay?.playerId).toBe("a");
    send(room, "a", { type: "cancel_game" });
    expect(room.view("a").lastPlay).toBeNull();
    for (const member of room.state.members)
      send(room, member.id, { type: "ready", ready: true });
    expect(send(room, "a", { type: "start" }).ok).toBe(true);
    expect(room.view("b").lastPlay).toBeNull();
    expect(room.view("b").game!.discardPile).toEqual([]);
  });
});

describe("góc nhìn riêng và kết quả sau khi chốt", () => {
  test("payload whitelist không chứa tay người khác, chồng rút, token, receipts", () => {
    const room = fixture();
    expect(room.view("a").game!.hand.map((card) => card.id)).toEqual([
      "skip-1",
      "future-1",
      "favor-1",
      "shuffle-1",
    ]);
    const payload = JSON.stringify(room.view("a"));
    for (const secret of [
      "tokenHash",
      "receipts",
      "secret-a",
      "drawPile",
      "removedCards",
      "nope-1",
      "defuse-1",
      "attack-4",
      "bomb-4",
    ])
      expect(payload).not.toContain(secret);
    expect(room.view("a").members.map((member) => member.cardCount)).toEqual([
      4, 3, 2,
    ]);
    expect(room.view(null).game!.hand).toEqual([]);
  });
  test("Xem Tương Lai chỉ người dùng nhận, không lộ trước khi chốt", () => {
    const room = fixture();
    send(room, "a", { type: "play", cardIds: ["future-1"] });
    expect(room.view("a").game!.futureCards).toEqual([]);
    passAll(room);
    expect(room.view("a").game!.futureCards.map((card) => card.id)).toEqual([
      "attack-4",
      "rainbow-2",
      "favor-4",
    ]);
    expect(room.view("b").game!.futureCards).toEqual([]);
    expect(room.view(null).game!.futureCards).toEqual([]);
    expect(room.view(null).lastPlay?.cards).toEqual([
      { id: "future-1", type: "see_future" },
    ]);
    expect(send(room, "b", { type: "close_future" }).code).toBe(
      "NOT_YOUR_CHOICE",
    );
  });
  test("Xin Bài chờ mục tiêu chọn; ACK và người thứ ba không thấy lá chuyển", () => {
    const room = fixture();
    send(room, "a", { type: "play", cardIds: ["favor-1"], targetId: "b" });
    const announcement = {
      id: room.state.version,
      playerId: "a",
      targetId: "b",
      cards: [{ id: "favor-1", type: "favor" }],
    };
    for (const viewer of ["a", "b", "c", null])
      expect(room.view(viewer).lastPlay).toEqual(announcement);
    expect(JSON.stringify(room.view("a"))).not.toContain("taco-1");
    passAll(room);
    expect(room.state.game!.phase).toEqual({
      kind: "favor",
      playerId: "a",
      targetId: "b",
    });
    expect(send(room, "c", { type: "give", cardId: "taco-2" }).code).toBe(
      "NOT_YOUR_CHOICE",
    );
    const result = send(room, "b", { type: "give", cardId: "taco-1" });
    expect(result.ok).toBe(true);
    expect(room.view("a").game!.hand.at(-1)?.id).toBe("taco-1");
    expect(JSON.stringify(result)).not.toContain("taco-1");
    expect(JSON.stringify(room.view("c"))).not.toContain("taco-1");
    expect(room.view("c").lastPlay).toEqual(announcement);
  });
  test("bom đang xử lý công khai loại phase nhưng không gửi bomb ID/vị trí cài", () => {
    const room = fixture();
    room.state.game!.phase = {
      kind: "defuse",
      playerId: "b",
      bomb: { id: "secret-bomb", type: "exploding_kitten" },
    };
    expect(room.view("a").game!.phase).toEqual({
      kind: "defuse",
      playerId: "b",
    });
    const result = send(room, "b", { type: "insert_bomb", position: 2 });
    expect(result.ok).toBe(true);
    expect(room.state.game!.drawPile[2].id).toBe("secret-bomb");
    expect(room.view("a").lastPlay).toBeNull();
    expect(JSON.stringify(room.view("a")) + JSON.stringify(result)).not.toMatch(
      /secret-bomb|position/,
    );
  });
  test("người bị loại chỉ xem công khai, không pass và không Nope", () => {
    const room = fixture();
    room.state.game!.players[2].alive = false;
    room.state.game!.players[2].hand = [];
    send(room, "a", { type: "play", cardIds: ["skip-1"] });
    expect(room.view("c").game!.hand).toEqual([]);
    expect(room.view("c").game!.futureCards).toEqual([]);
    expect(send(room, "c", { type: "pass" }).code).toBe("PLAYER_NOT_ALIVE");
    expect(send(room, "c", { type: "nope", cardId: "nope-2" }).ok).toBe(false);
    send(room, "a", { type: "pass" });
    send(room, "b", { type: "pass" });
    expect(room.state.game!.phase.kind).toBe("turn");
  });
});

describe("tạm dừng, khôi phục và vòng đời", () => {
  test("đóng băng một lần, giữ pass và chỉ tiếp tục khi đủ người sống", () => {
    const room = fixture();
    send(room, "a", { type: "play", cardIds: ["skip-1"] }, 1000);
    send(room, "b", { type: "pass" }, 1600);
    const game = structuredClone(room.state.game);
    room.disconnect("a", "socket-a", 2700);
    room.disconnect("b", "socket-b", 4700);
    expect(room.view("c").pause).toEqual({
      since: 2700,
      remainingNopeMs: 3300,
      missingIds: ["a", "b"],
    });
    expect(room.state.game).toEqual(game);
    expect(room.state.hostId).toBe("a");
    expect(room.expire(60000, () => 0.3)).toBe(false);
    expect(
      send(room, "c", { type: "nope", cardId: "nope-2" }, 60000).code,
    ).toBe("GAME_PAUSED");
    room.connect("a", "return-a", 61000);
    expect(room.view("a").pause?.missingIds).toEqual(["b"]);
    room.connect("b", "return-b", 65000);
    expect(room.state.pause).toBeNull();
    expect(room.state.reaction).toEqual({ deadline: 68300, passedIds: ["b"] });
    expect(room.expire(68299, () => 0.3)).toBe(false);
    expect(room.expire(68300, () => 0.3)).toBe(true);
    const settled = structuredClone(room.state);
    expect(room.expire(68301, () => 0.9)).toBe(false);
    expect(room.state).toEqual(settled);
  });
  test.each(["turn", "reaction", "favor", "future", "defuse"] as const)(
    "restart giữ phase %s và phần riêng",
    (phase) => {
      const room = fixture();
      room.state.gameId = "persistent-game";
      room.state.game!.turn.remaining = 3;
      room.state.game!.turn.attacked = true;
      if (phase === "reaction")
        send(room, "a", { type: "play", cardIds: ["shuffle-1"] });
      if (phase === "favor" || phase === "future") {
        send(room, "a", {
          type: "play",
          cardIds: [phase === "favor" ? "favor-1" : "future-1"],
          ...(phase === "favor" ? { targetId: "b" } : {}),
        });
        passAll(room);
      }
      if (phase === "defuse")
        room.state.game!.phase = {
          kind: "defuse",
          playerId: "b",
          bomb: { id: "pending-bomb", type: "exploding_kitten" },
        };
      const game = structuredClone(room.state.game);
      const restored = new Room(
        JSON.parse(JSON.stringify(room.state)) as RoomState,
        50000,
      );
      restored.reconcileConnections(new Map(), 50000);
      expect(restored.state.pause).not.toBeNull();
      expect(
        restored.expire(50000, () => {
          throw new Error("must not reroll");
        }),
      ).toBe(false);
      expect(restored.state.game).toEqual(game);
      for (const id of ["a", "b", "c"])
        restored.connect(id, "new-" + id, 51000);
      expect(restored.state.gameId).toBe("persistent-game");
      expect(restored.state.game).toEqual(game);
      expect(restored.state.pause).toBeNull();
      expect(restored.view("a").game!.futureCards).toEqual(
        room.view("a").game!.futureCards,
      );
      expect(restored.view("c").game!.futureCards).toEqual([]);
    },
  );
  test("hibernation còn socket và heartbeat thật không tạo pause/đổi phiên bản", () => {
    const room = fixture();
    send(room, "a", { type: "play", cardIds: ["skip-1"] }, 1000);
    const restored = new Room(structuredClone(room.state), 5000);
    restored.reconcileConnections(
      new Map([
        ["socket-a", 4500],
        ["socket-b", 4700],
        ["socket-c", 4800],
      ]),
      5000,
    );
    expect(restored.state).toEqual(room.state);
    expect(restored.expire(6000, () => 0.3)).toBe(true);
    expect(restored.state.game!.turn.playerId).toBe("b");
  });
  test.each([
    CONNECTION_TIMEOUT_MS - 1,
    CONNECTION_TIMEOUT_MS,
    CONNECTION_TIMEOUT_MS + 1,
  ])("heartbeat biên %i ms", (elapsed) => {
    const room = fixture();
    const seen = new Map([
      ["socket-a", 1000],
      ["socket-b", 1000 + elapsed],
      ["socket-c", 1000 + elapsed],
    ]);
    room.reconcileConnections(seen, 1000 + elapsed);
    expect(room.view("b").members[0].connected).toBe(
      elapsed < CONNECTION_TIMEOUT_MS,
    );
    expect(room.state.pause !== null).toBe(elapsed >= CONNECTION_TIMEOUT_MS);
    expect(room.state.hostId).toBe("a");
  });
  test("người bị loại và chủ phòng bị loại rớt mạng không pause hoặc chuyển quyền", () => {
    const room = fixture();
    room.state.game!.players[0].alive = false;
    room.state.game!.players[0].hand = [];
    room.state.game!.turn.playerId = "b";
    room.disconnect("a", "socket-a", 4000);
    expect(room.state.pause).toBeNull();
    expect(room.state.hostId).toBe("a");
    expect(send(room, "b", { type: "draw" }, 5000).ok).toBe(true);
  });
  test("tab mới thay tab cũ giữa reaction không đóng băng nhầm", () => {
    const room = fixture();
    send(room, "a", { type: "play", cardIds: ["skip-1"] });
    room.connect("b", "new-b", 2400);
    expect(room.disconnect("b", "socket-b", 2500)).toBe(false);
    expect(room.state.pause).toBeNull();
    expect(room.state.reaction!.deadline).toBe(6000);
  });
  test("chủ rời chủ động giữ ghế/bài, chuyển cho người online, chủ mới được hủy", () => {
    const room = fixture();
    const hand = structuredClone(room.state.game!.players[0].hand);
    room.disconnect("b", "socket-b", 1500);
    expect(send(room, "a", { type: "leave" }, 2000).ok).toBe(true);
    expect(room.state.hostId).toBe("c");
    expect(room.state.members.map((member) => member.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(room.state.game!.players[0].hand).toEqual(hand);
    expect(room.state.game!.players[0].alive).toBe(true);
    expect(send(room, "b", { type: "cancel_game" }, 2100).code).toBe(
      "NOT_HOST",
    );
    expect(send(room, "c", { type: "cancel_game" }, 2200).ok).toBe(true);
    expect(room.view("c").game).toBeNull();
    expect(room.state.pause).toBeNull();
    expect(room.state.reaction).toBeNull();
    expect(room.state.members.every((member) => !member.ready)).toBe(true);
  });
  test("chủ rời khi không ai online thì giữ quyền dự phòng và chuyển khi ghế hợp lệ trở lại", () => {
    const room = fixture();
    room.disconnect("b", "socket-b", 2000);
    room.disconnect("c", "socket-c", 2000);
    send(room, "a", { type: "leave" }, 3000);
    expect(room.state.hostId).toBe("a");
    room.connect("b", "return-b", 5000);
    expect(room.state.hostId).toBe("b");
    expect(send(room, "b", { type: "cancel_game" }, 5100).ok).toBe(true);
    expect(room.state.members).toHaveLength(3);
  });
  test("cả nhóm rớt thụ động không đổi chủ khi người khác quay lại trước", () => {
    const room = fixture();
    room.reconcileConnections(new Map(), 3000);
    const restored = new Room(structuredClone(room.state));
    restored.connect("b", "return-b", 5000);
    expect(restored.state.hostId).toBe("a");
    expect(send(restored, "b", { type: "cancel_game" }, 5100).code).toBe(
      "NOT_HOST",
    );
  });
  test("kết thúc xóa ready, giữ nhóm và ID mới sau về lobby/tái đấu", () => {
    const room = fixture();
    room.state.gameId = "old-game";
    for (const member of room.state.members) member.ready = true;
    room.state.game!.players[0].alive = false;
    room.state.game!.players[0].hand = [];
    room.state.game!.players[2].hand = [];
    room.state.game!.turn.playerId = "c";
    room.state.game!.drawPile = [
      { id: "final-bomb", type: "exploding_kitten" },
    ];
    expect(send(room, "c", { type: "draw" }).ok).toBe(true);
    expect(room.state.game!.phase).toEqual({ kind: "finished", winnerId: "b" });
    expect(room.state.members.every((member) => !member.ready)).toBe(true);
    expect(room.state.members).toHaveLength(3);
    send(room, "a", { type: "cancel_game" });
    send(room, "a", { type: "set_capacity", capacity: 4 });
    room.addMember("d", "D", "hash-d");
    room.connect("d", "d");
    expect(send(room, "a", { type: "set_capacity", capacity: 3 }).code).toBe(
      "CAPACITY_TOO_SMALL",
    );
    for (const member of room.state.members)
      send(room, member.id, { type: "ready", ready: true });
    expect(send(room, "a", { type: "start" }).ok).toBe(true);
    expect(room.state.gameId).not.toBe("old-game");
    expect(room.state.game!.players).toHaveLength(4);
    expect(room.state.game!.drawPile).toHaveLength(23);
  });
  test("một alarm ưu tiên Nope, heartbeat, rồi TTL; alarm và GET không gia hạn", () => {
    const room = fixture();
    for (const member of room.state.members)
      room.connect(member.id, "socket-" + member.id, 1000);
    send(room, "a", { type: "play", cardIds: ["skip-1"] }, 1200);
    const times = new Map([
      ["socket-a", 1200],
      ["socket-b", 1000],
      ["socket-c", 1600],
    ]);
    expect(room.nextAlarm(times)).toBe(6200);
    room.disconnect("a", "socket-a", 2500);
    expect(room.nextAlarm(times)).toBe(26000);
    room.disconnect("b", "socket-b", 3000);
    room.disconnect("c", "socket-c", 4000);
    expect(room.nextAlarm(new Map())).toBe(1200 + ROOM_TTL_MS);
    room.view(null);
    room.expire(90000, () => 0.1);
    expect(room.state.lastActivity).toBe(1200);
    expect(room.nextAlarm(new Map())).toBe(1200 + ROOM_TTL_MS);
  });
  test("ACK lưu trước restart giữ random, không chạy lại", () => {
    const room = fixture();
    send(room, "a", { type: "play", cardIds: ["shuffle-1"] });
    send(room, "a", { type: "pass" });
    send(room, "b", { type: "pass" });
    const command = envelope(room, { type: "pass" });
    const ack = room.process("c", command, 2000, () => 0.19);
    const restored = new Room(
      JSON.parse(JSON.stringify(room.state)) as RoomState,
    );
    restored.reconcileConnections(new Map(), 3000);
    const before = structuredClone(restored.state.game);
    const random = vi.fn(() => {
      throw new Error("reroll");
    });
    expect(restored.process("c", command, 60000, random)).toEqual(ack);
    expect(restored.state.game).toEqual(before);
    expect(random).not.toHaveBeenCalled();
  });
  test("migrate snapshot Phase 2 không chia lại; schema/rules lạ không bị ghi đè", () => {
    const room = fixture();
    const {
      schemaVersion: _schema,
      rulesVersion: _rules,
      gameId: _gameId,
      lastActivity: _activity,
      pause: _pause,
      hostTransferPending: _transfer,
      ...legacy
    } = room.state;
    const migrated = new Room(
      {
        ...legacy,
        members: legacy.members.map(({ lastSeen: _seen, ...member }) => member),
      },
      5000,
    );
    expect(migrated.state.game).toEqual(room.state.game);
    expect(migrated.state.gameId).toEqual(expect.any(String));
    expect(migrated.state.schemaVersion).toBe(1);
    expect(migrated.state.hostTransferPending).toBe(false);
    expect(migrated.state.lastActivity).toBe(5000);
    expect(
      migrated.state.members.every((member) => member.lastSeen === 5000),
    ).toBe(true);
    expect(new Room(structuredClone(migrated.state), 10000).state).toEqual(
      migrated.state,
    );
    for (const patch of [{ schemaVersion: 2 }, { rulesVersion: "other-rules" }])
      expect(() => new Room({ ...room.state, ...patch } as RoomState)).toThrow(
        "UNSUPPORTED_SCHEMA",
      );
  });
});

describe("validation biên mạng", () => {
  test.each([
    null,
    [],
    { type: "resolveReaction" },
    { type: "command", id: "x", version: -1, action: { type: "draw" } },
    {
      type: "command",
      id: "x",
      version: 0,
      playerId: "b",
      action: { type: "draw" },
    },
    {
      type: "command",
      id: "x",
      version: 0,
      action: { type: "draw", playerId: "b" },
    },
    {
      type: "command",
      id: "x",
      version: 0,
      action: { type: "draw", drawPile: [] },
    },
    {
      type: "command",
      id: "x",
      version: 0,
      action: { type: "set_capacity", capacity: "3" },
    },
    {
      type: "command",
      id: "x",
      version: 0,
      action: { type: "ready", ready: 1 },
    },
    {
      type: "command",
      id: "x",
      version: 0,
      action: { type: "insert_bomb", position: 1.5 },
    },
    {
      type: "command",
      id: "x",
      version: 0,
      action: { type: "play", cardIds: [1] },
    },
    {
      type: "command",
      id: "x",
      version: 0,
      action: { type: "play", cardIds: ["skip-1"], requestedType: "__proto__" },
    },
  ])("từ chối schema giả mạo %j", (value) => {
    expect(() => parseCommand(value)).toThrow("INVALID_COMMAND");
  });
  test("chuẩn hóa lệnh để đổi thứ tự thuộc tính không đổi fingerprint", () => {
    expect(
      parseCommand({
        action: { ready: true, type: "ready" },
        version: 2,
        id: "x",
        type: "command",
      }),
    ).toEqual({
      type: "command",
      id: "x",
      version: 2,
      action: { type: "ready", ready: true },
    });
  });
  test("tên trim nhưng chặn rỗng, quá dài và ký tự điều khiển", () => {
    expect(playerName("  Thảo   Anh  ")).toBe("Thảo Anh");
    for (const name of [" ", "x".repeat(33), "a\nb", 42])
      expect(() => playerName(name)).toThrow("INVALID_NAME");
  });
});
