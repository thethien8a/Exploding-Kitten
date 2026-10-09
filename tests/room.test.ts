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
  room.state.idle = { playerId: "a", deadline: 61000 };
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
      ).toEqual(Array(capacity).fill(5));
      expect(room.state.game!.drawPile).toHaveLength(
        { 3: 49, 4: 60, 5: 70 }[capacity],
      );
      expect(room.state.rulesVersion).toBe("original-2022-mixed");
      expect(room.view(null).game!.idle).toEqual({
        playerId: room.state.game!.turn.playerId,
        deadline: 61000,
      });
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

describe("60 giây không hoạt động và các lá mở rộng", () => {
  test.each([60999, 61000, 61001])(
    "lệnh tới sát hạn %i chỉ được rút đúng một lần",
    (now) => {
      const room = fixture();
      const draw = envelope(room, { type: "draw" });
      const ack = room.process("a", draw, now, () => 0);
      expect(ack.ok).toBe(now < 61000);
      if (now >= 61000) expect(ack.code).toBe("STALE_VERSION");
      expect(room.view("a").game!.hand.at(-1)?.id).toBe("attack-4");
      expect(room.view(null).game!.drawCount).toBe(3);
      expect(room.view(null).game!.idle).toEqual({
        playerId: "b",
        deadline: now + 60000,
      });
      expect(room.process("a", draw, now + 1, () => 0.99)).toEqual(ack);
      expect(room.expire(now + 1, () => 0.99)).toBe(false);
    },
  );

  test("lệnh lỗi, ACK replay, heartbeat và tab thay thế không gia hạn", () => {
    const room = fixture();
    const play = envelope(room, { type: "play", cardIds: ["shuffle-1"] });
    const ack = room.process("a", play, 30000, () => 0.5);
    passAll(room, 31000);
    expect(room.view(null).game!.idle).toEqual({
      playerId: "a",
      deadline: 91000,
    });
    expect(send(room, "b", { type: "draw" }, 50000).code).toBe("NOT_YOUR_TURN");
    expect(
      send(room, "a", { type: "play", cardIds: ["not-owned"] }, 55000).code,
    ).toBe("CARD_NOT_IN_HAND");
    expect(room.process("a", play, 60000, () => 0)).toEqual(ack);
    room.connect("a", "replacement-a", 70000);
    room.reconcileConnections(
      new Map([
        ["replacement-a", 80000],
        ["socket-b", 80000],
        ["socket-c", 80000],
      ]),
      80000,
    );
    expect(room.view(null).game!.idle).toEqual({
      playerId: "a",
      deadline: 91000,
    });
    expect(room.expire(90999, () => 0)).toBe(false);
    expect(room.expire(91000, () => 0)).toBe(true);
    expect(room.view(null).game!.turn.playerId).toBe("b");
    expect(room.state.lastActivity).toBe(70000);
  });

  test("offline/restart giữ hạn, tự rút một lần và không rút bù qua nhiều lượt", () => {
    let room = fixture();
    room.reconcileConnections(new Map(), 21000);
    expect(room.view("a").pause).toBeNull();
    expect(room.nextAlarm(new Map())).toBe(61000);
    room = new Room(JSON.parse(JSON.stringify(room.state)), 200000);
    expect(room.view("a").game!.idle?.deadline).toBe(61000);
    expect(room.expire(400000, () => 0)).toBe(true);
    expect(room.view("a").game!.drawCount).toBe(3);
    expect(room.view("a").game!.hand.at(-1)?.id).toBe("attack-4");
    expect(room.view("a").game!.idle).toEqual({
      playerId: "b",
      deadline: 460000,
    });
    expect(room.expire(400000, () => 0)).toBe(false);
    room.connect("a", "returned-a", 410000);
    expect(room.view("a").game!.idle?.deadline).toBe(460000);
    expect(send(room, "a", { type: "draw" }, 410001).code).toBe(
      "NOT_YOUR_TURN",
    );
    expect(room.view("a").game!.drawCount).toBe(3);
  });

  test("alarm chọn hạn idle khi heartbeat còn khỏe; cancel xóa timer", () => {
    const room = fixture();
    const times = new Map([
      ["socket-a", 60000],
      ["socket-b", 59000],
      ["socket-c", 58000],
    ]);
    expect(room.nextAlarm(times)).toBe(61000);
    send(room, "a", { type: "cancel_game" }, 60500);
    expect(room.state.idle).toBeNull();
    expect(room.expire(61000, () => 0)).toBe(false);
    expect(room.nextAlarm(times)).toBe(83000);
  });

  test("tự rút bom, tự cài ngẫu nhiên và trả từng lượt Attack", () => {
    const room = fixture();
    const game = room.state.game!;
    game.turn = { playerId: "b", remaining: 2, attacked: true };
    game.drawPile.reverse();
    room.state.idle = { playerId: "b", deadline: 61000 };
    room.disconnect("b", "socket-b");
    expect(room.expire(61000, () => 0.9999)).toBe(true);
    expect(room.view(null).lastBomb).toMatchObject({
      playerId: "b",
      outcome: "defusing",
    });
    expect(room.view(null).game!.phase).toEqual({
      kind: "defuse",
      playerId: "b",
    });
    expect(room.view(null).game!.turn.remaining).toBe(2);
    expect(room.expire(121000, () => 0.9999)).toBe(true);
    expect(room.state.game!.drawPile.at(-1)?.id).toBe("bomb-4");
    expect(room.view(null).lastBomb).toMatchObject({
      playerId: "b",
      outcome: "defused",
    });
    expect(room.view(null).game!.turn).toEqual({
      playerId: "b",
      remaining: 1,
      attacked: true,
    });
    expect(JSON.stringify(room.view(null))).not.toMatch(/bomb-4|position/);
    expect(room.expire(181000, () => 0)).toBe(true);
    expect(room.view(null).game!.turn.playerId).toBe("c");
  });

  test.each(["future", "alter_future", "favor"] as const)(
    "lựa chọn %s hết giờ không kẹt ván hoặc lộ bài",
    (phase) => {
      const room = fixture();
      if (phase === "alter_future")
        room.state.game!.players[0].hand.push({
          id: "alter-a",
          type: "alter_future",
        });
      send(
        room,
        "a",
        {
          type: "play",
          cardIds: [
            phase === "future"
              ? "future-1"
              : phase === "alter_future"
                ? "alter-a"
                : "favor-1",
          ],
          ...(phase === "favor" ? { targetId: "b" } : {}),
        },
        2000,
      );
      passAll(room, 3000);
      expect(room.view(null).game!.idle).toEqual({
        playerId: phase === "favor" ? "b" : "a",
        deadline: 63000,
      });
      room.disconnect(
        phase === "favor" ? "b" : "a",
        phase === "favor" ? "socket-b" : "socket-a",
      );
      const before = structuredClone(room.state.game!);
      expect(room.expire(62999, () => 0.5)).toBe(false);
      expect(room.expire(63000, () => 0.5)).toBe(true);
      if (phase === "favor") {
        expect(room.view("a").game!.hand.at(-1)).toEqual(
          before.players[1].hand[1],
        );
        expect(room.view(null).game!.drawCount).toBe(4);
        expect(room.view(null).game!.idle?.playerId).toBe("a");
      } else {
        expect(room.view("a").game!.hand.at(-1)).toEqual(before.drawPile[0]);
        expect(room.state.game!.drawPile).toEqual(before.drawPile.slice(1));
        expect(room.view(null).game!.idle?.playerId).toBe("b");
      }
      expect(room.view(null).game!.phase.kind).toBe("turn");
      expect(room.view("c").game!.futureCards).toEqual([]);
      expect(room.view(null).game!.futureCards).toEqual([]);
    },
  );

  test("Rút Đáy qua deadline công khai bom, kết thúc ván xóa timer/ready", () => {
    const room = fixture();
    room.state.game!.players[0].hand.push({
      id: "bottom-a",
      type: "draw_bottom",
    });
    room.state.game!.players[2].alive = false;
    room.state.game!.players[2].hand = [];
    for (const member of room.state.members) member.ready = true;
    send(room, "a", { type: "play", cardIds: ["bottom-a"] }, 2000);
    expect(room.expire(6999, () => 0)).toBe(false);
    expect(room.expire(7000, () => 0)).toBe(true);
    expect(room.view(null).lastBomb).toMatchObject({
      playerId: "a",
      outcome: "exploded",
    });
    expect(room.view(null).game!.phase).toEqual({
      kind: "finished",
      winnerId: "b",
    });
    expect(room.view(null).game!.idle).toBeNull();
    expect(room.view(null).members.every((member) => !member.ready)).toBe(true);
  });

  test("Sắp Tương Lai riêng tư, validate order và replay/restore không sắp lần hai", () => {
    let room = fixture();
    room.state.game!.players[0].hand.push({
      id: "alter-a",
      type: "alter_future",
    });
    send(room, "a", { type: "play", cardIds: ["alter-a"] });
    passAll(room);
    const top = room.view("a").game!.futureCards;
    expect(top).toHaveLength(3);
    for (const id of ["b", "c", null])
      expect(room.view(id).game!.futureCards).toEqual([]);
    expect(
      send(room, "b", { type: "reorder_future", order: [2, 0, 1] }).code,
    ).toBe("NOT_YOUR_CHOICE");
    expect(
      send(room, "a", { type: "reorder_future", order: [0, 0, 2] }).code,
    ).toBe("INVALID_FUTURE_ORDER");
    const command = parseCommand(
      envelope(room, { type: "reorder_future", order: [2, 0, 1] }),
    );
    const ack = room.process("a", command, 4000, () => 0);
    expect(ack.ok).toBe(true);
    expect(room.state.game!.drawPile.slice(0, 3)).toEqual([
      top[2],
      top[0],
      top[1],
    ]);
    expect(room.view(null).game!.idle?.deadline).toBe(64000);
    expect(JSON.stringify(ack)).not.toMatch(/order|attack-4|rainbow-2|favor-4/);
    room = new Room(JSON.parse(JSON.stringify(room.state)), 5000);
    expect(room.process("a", command, 6000, () => 0)).toEqual(ack);
    expect(room.view(null).game!.idle?.deadline).toBe(64000);
    expect(send(room, "a", { type: "draw" }, 7000).ok).toBe(true);
    expect(room.view("a").game!.hand.at(-1)).toEqual(top[2]);
  });

  test("snapshot cũ thiếu timer/chiều chơi giữ nguyên bài và thêm 60 giây", () => {
    const room = fixture();
    const { idle: _idle, ...legacy } = structuredClone(room.state);
    const restored = new Room(legacy, 100000);
    expect(restored.state.game).toEqual(room.state.game);
    expect(restored.view(null).game!.direction).toBe(1);
    expect(restored.view(null).game!.idle).toEqual({
      playerId: "a",
      deadline: 160000,
    });
  });
});

describe("combo 5 loại đổi bài bỏ không mở cửa sổ Nope", () => {
  const costIds = ["skip-1", "future-1", "favor-1", "defuse-a", "nope-a"];

  function exchangeRoom() {
    const room = fixture();
    const game = room.state.game!;
    game.players[0].hand.push(
      { id: "defuse-a", type: "defuse" },
      { id: "nope-a", type: "nope" },
    );
    game.discardPile.push(
      { id: "discarded-attack", type: "attack" },
      { id: "discarded-bomb-1", type: "exploding_kitten" },
      { id: "discarded-bomb-2", type: "exploding_kitten" },
      { id: "discarded-defuse", type: "defuse" },
    );
    game.turn = { playerId: "a", remaining: 2, attacked: true };
    return room;
  }

  test.each([0, 1, 2, 3])(
    "đổi ngay lá bỏ ở index %i, kể cả bom có ID công khai đã che",
    (discardIndex) => {
      const room = exchangeRoom();
      const before = structuredClone(room.state.game!);
      const costs = costIds.map((id) =>
        before.players[0].hand.find((card) => card.id === id)!,
      );
      const publicCard = room.view("a").game!.discardPile[discardIndex];
      if (publicCard.type === "exploding_kitten") {
        expect(publicCard.id).toBe("public-explosion-" + discardIndex);
        expect(publicCard.id).not.toBe(before.discardPile[discardIndex].id);
      }
      const command = parseCommand(
        envelope(room, { type: "play", cardIds: costIds, discardIndex }),
      );
      const random = vi.fn(() => {
        throw new Error("must not use random");
      });
      const result = room.process("a", command, 1000, random);
      expect(result.ok).toBe(true);
      expect(room.state.game!.players[0].hand).toEqual([
        { id: "shuffle-1", type: "shuffle" },
        before.discardPile[discardIndex],
      ]);
      expect(room.state.game!.players.slice(1)).toEqual(
        before.players.slice(1),
      );
      expect(room.state.game!.discardPile).toEqual([
        ...before.discardPile.filter((_, index) => index !== discardIndex),
        ...costs,
      ]);
      expect(room.state.game!.drawPile).toEqual(before.drawPile);
      expect(room.state.game!.turn).toEqual(before.turn);
      expect(room.state.game!.phase).toEqual({ kind: "turn" });
      expect(room.state.reaction).toBeNull();
      for (const viewer of ["a", "b", "c", null]) {
        const snapshot = room.view(viewer);
        expect(snapshot.lastPlay).toEqual({
          id: result.version,
          playerId: "a",
          cards: costs,
        });
        expect(snapshot.game!.reaction).toBeNull();
        expect(snapshot.game!.futureCards).toEqual([]);
        expect(snapshot.lastTransfer).toBeNull();
        if (viewer !== "a")
          expect(JSON.stringify(snapshot)).not.toContain("discarded-bomb-");
      }
      expect(JSON.stringify(result)).not.toContain("discarded-bomb-");
      expect(
        room.nextAlarm(
          new Map([
            ["socket-a", 1000],
            ["socket-b", 1000],
            ["socket-c", 1000],
          ]),
        ),
      ).toBe(1000 + CONNECTION_TIMEOUT_MS);
      const view = room.view("a");
      expect(send(room, "a", { type: "pass" }, 1200).code).toBe("NO_REACTION");
      expect(
        send(room, "b", { type: "nope", cardId: "nope-1" }, 1300).code,
      ).toBe("NO_REACTION");
      expect(room.expire(6000, random)).toBe(false);
      expect(room.view("a")).toEqual(view);
      expect(random).not.toHaveBeenCalled();
    },
  );

  test("bom lấy về có thể trả trong combo sau, lastPlay và chồng bỏ dùng cùng ID che", () => {
    const room = exchangeRoom();
    expect(
      send(room, "a", { type: "play", cardIds: costIds, discardIndex: 1 }).ok,
    ).toBe(true);
    room.state.game!.players[0].hand.push(
      { id: "defuse-next", type: "defuse" },
      { id: "nope-next", type: "nope" },
      { id: "attack-next", type: "attack" },
    );
    const nextIds = [
      "shuffle-1",
      "defuse-next",
      "nope-next",
      "attack-next",
      "discarded-bomb-1",
    ];
    const costs = nextIds.map((id) =>
      room.state.game!.players[0].hand.find((card) => card.id === id)!,
    );
    expect(
      send(room, "a", { type: "play", cardIds: nextIds, discardIndex: 0 }).ok,
    ).toBe(true);
    expect(room.state.lastPlay!.cards).toEqual(costs);
    expect(room.state.game!.players[0].hand).toEqual([
      { id: "discarded-attack", type: "attack" },
    ]);
    const restored = new Room(
      JSON.parse(JSON.stringify(room.state)) as RoomState,
    );
    for (const viewer of ["a", "b", "c", null]) {
      const snapshot = room.view(viewer);
      const played = snapshot.lastPlay!.cards;
      expect(played).toHaveLength(5);
      expect(played.slice(0, 4)).toEqual(costs.slice(0, 4));
      expect(played.at(-1)).toEqual(snapshot.game!.discardPile.at(-1));
      expect(played.at(-1)!.id).toMatch(/^public-explosion-\d+$/);
      expect(JSON.stringify(snapshot)).not.toContain("discarded-bomb-");
      expect(restored.view(viewer)).toEqual(snapshot);
    }
    const exposed = restored.view("a");
    exposed.lastPlay!.cards.at(-1)!.id = "changed";
    expect(restored.view(null)).toEqual(room.view(null));
  });

  test.each([
    {
      invalid: "types",
      code: "COMBO_MUST_DIFFER",
      message: "Combo 5 lá cần 5 loại bài khác nhau.",
    },
    {
      invalid: "ids",
      code: "DUPLICATE_CARD",
      message: "Mỗi lá bài chỉ được chọn một lần.",
    },
    {
      invalid: "missing",
      code: "DISCARD_INDEX_REQUIRED",
      message: "Hãy chọn một lá đã có trong chồng bài bỏ để đổi combo 5 lá.",
    },
    {
      invalid: "outside",
      code: "INVALID_DISCARD_INDEX",
      message: "Lá bài bỏ được chọn không hợp lệ hoặc không còn trong chồng.",
    },
    {
      invalid: "empty",
      code: "INVALID_DISCARD_INDEX",
      message: "Lá bài bỏ được chọn không hợp lệ hoặc không còn trong chồng.",
    },
  ])(
    "combo sai $invalid báo lỗi dễ đọc và không đổi bài/metadata",
    ({ invalid, code, message }) => {
      const room = exchangeRoom();
      const action: Extract<RoomAction, { type: "play" }> = {
        type: "play",
        cardIds: [...costIds],
        discardIndex: 0,
      };
      if (invalid === "types")
        room.state.game!.players[0].hand.find(
          (card) => card.id === "nope-a",
        )!.type = "defuse";
      if (invalid === "ids") action.cardIds[4] = action.cardIds[3];
      if (invalid === "missing") delete action.discardIndex;
      if (invalid === "outside")
        action.discardIndex = room.state.game!.discardPile.length;
      if (invalid === "empty")
        room.state.game!.removedCards.push(
          ...room.state.game!.discardPile.splice(0),
        );
      const before = room.view("a");
      const game = structuredClone(room.state.game);
      expect(send(room, "a", action)).toMatchObject({
        ok: false,
        code,
        message,
      });
      expect(room.view("a")).toEqual(before);
      expect(room.state.game).toEqual(game);
    },
  );

  test.each([
    { blocked: "turn", code: "NOT_YOUR_TURN" },
    { blocked: "dead", code: "PLAYER_NOT_ALIVE" },
    { blocked: "pending", code: "ACTION_PENDING" },
  ])("combo 5 không được vượt điều kiện $blocked", ({ blocked, code }) => {
    const room = exchangeRoom();
    if (blocked === "turn") room.state.game!.turn.playerId = "b";
    if (blocked === "dead") {
      room.state.game!.players[0].alive = false;
      room.state.game!.discardPile.push(
        ...room.state.game!.players[0].hand.splice(0),
      );
      room.state.game!.turn.playerId = "b";
    }
    if (blocked === "pending")
      expect(send(room, "a", { type: "play", cardIds: ["shuffle-1"] }).ok).toBe(
        true,
      );
    const before = room.view("a");
    const action: RoomAction = {
      type: "play",
      cardIds: costIds,
      discardIndex: 0,
    };
    expect(send(room, "a", action, 1200).code).toBe(code);
    expect(room.view("a")).toEqual(before);
  });

  test("replay giữ một lần đổi và đủ 5 lá; JSON restore tiếp tục trả nợ bằng rút", () => {
    const room = exchangeRoom();
    room.state.gameId = "five-card-game";
    const command = parseCommand(
      envelope(room, { type: "play", cardIds: costIds, discardIndex: 1 }),
    );
    const random = vi.fn(() => {
      throw new Error("must not reroll");
    });
    const ack = room.process("a", command, 1000, random);
    expect(ack.ok).toBe(true);
    const saved = structuredClone(room.state);
    expect(room.process("a", command, 7000, random)).toEqual(ack);
    expect(room.state).toEqual(saved);
    const restored = new Room(JSON.parse(JSON.stringify(saved)) as RoomState);
    expect(restored.view("a")).toEqual(room.view("a"));
    expect(restored.process("a", command, 7000, random)).toEqual(ack);
    expect(restored.state).toEqual(saved);
    expect(
      restored.process(
        "a",
        {
          ...command,
          action: { ...command.action, discardIndex: 2 } as RoomAction,
        },
        7100,
        random,
      ).code,
    ).toBe("COMMAND_ID_REUSED");
    expect(
      restored.process("a", { ...command, id: "second-exchange" }, 7200, random)
        .code,
    ).toBe("STALE_VERSION");
    expect(restored.state.game).toEqual(saved.game);
    expect(restored.view("a").lastPlay!.cards).toHaveLength(5);
    expect(send(restored, "a", { type: "draw" }, 7300).ok).toBe(true);
    expect(restored.state.game!.turn).toEqual({
      playerId: "a",
      remaining: 1,
      attacked: true,
    });
    expect(send(restored, "a", { type: "draw" }, 7400).ok).toBe(true);
    expect(restored.state.game!.turn).toEqual({
      playerId: "b",
      remaining: 1,
      attacked: false,
    });
    expect(restored.state.gameId).toBe("five-card-game");
    expect(restored.state.schemaVersion).toBe(1);
    expect(restored.state.rulesVersion).toBe(saved.rulesVersion);
    const continued = structuredClone(restored.state);
    expect(restored.process("a", command, 7500, random)).toEqual(ack);
    expect(restored.state).toEqual(continued);
    expect(random).not.toHaveBeenCalled();
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

describe("thông báo lấy bài riêng", () => {
  test.each([
    { count: 2, resolution: "pass" },
    { count: 3, resolution: "pass" },
    { count: 2, resolution: "deadline" },
    { count: 3, resolution: "deadline" },
  ])(
    "combo $count qua $resolution chỉ báo đúng lá cho hai bên",
    ({ count, resolution }) => {
      const room = fixture();
      const cards = Array.from({ length: count }, (_, index) => ({
        id: "combo-" + index,
        type: "tacocat" as const,
      }));
      room.state.game!.players[0].hand.push(...cards);
      expect(
        send(room, "a", {
          type: "play",
          cardIds: cards.map((card) => card.id),
          targetId: "b",
          ...(count === 3 ? { requestedType: "defuse" as const } : {}),
        }).ok,
      ).toBe(true);
      expect(room.view("a").lastTransfer).toBeNull();
      if (resolution === "pass") passAll(room);
      else {
        expect(room.expire(5999, () => 0.37)).toBe(false);
        expect(room.view("a").lastTransfer).toBeNull();
        expect(room.expire(6000, () => 0.37)).toBe(true);
      }
      const event = {
        id: room.state.version,
        fromId: "b",
        toId: "a",
        cardType: "defuse",
      };
      expect(room.view("a").game!.hand.at(-1)).toEqual({
        id: "defuse-1",
        type: "defuse",
      });
      expect(room.view("b").game!.hand.map((card) => card.id)).toEqual([
        "nope-1",
        "taco-1",
      ]);
      for (const viewer of ["a", "b"])
        expect(room.view(viewer).lastTransfer).toEqual(event);
      for (const viewer of ["c", null]) {
        expect(room.view(viewer).lastTransfer).toBeNull();
        expect(JSON.stringify(room.view(viewer))).not.toContain("defuse-1");
        expect(JSON.stringify(room.view(viewer))).not.toContain('"cardType"');
      }
      const restored = new Room(
        JSON.parse(JSON.stringify(room.state)) as RoomState,
      );
      expect(restored.view("a").lastTransfer).toEqual(event);
      expect(restored.view("b").lastTransfer).toEqual(event);
      expect(restored.view(null).lastTransfer).toBeNull();
      const exposed = restored.view("a");
      exposed.lastTransfer!.cardType = "attack";
      expect(restored.view("b").lastTransfer).toEqual(event);
      expect(restored.expire(7000, () => 0.99)).toBe(false);
      expect(send(restored, "c", { type: "draw" }).ok).toBe(false);
      expect(restored.view("a").lastTransfer).toEqual(event);
    },
  );

  test.each([1, 2])(
    "%i Nope: không báo chuyển lá bị chặn, phản Nope báo lá thật",
    (nopeCount) => {
      const room = fixture();
      room.state.game!.players[0].hand.push(
        { id: "combo-1", type: "tacocat" },
        { id: "combo-2", type: "tacocat" },
      );
      send(room, "a", {
        type: "play",
        cardIds: ["combo-1", "combo-2"],
        targetId: "b",
      });
      send(room, "b", { type: "nope", cardId: "nope-1" });
      if (nopeCount === 2) send(room, "c", { type: "nope", cardId: "nope-2" });
      passAll(room);
      expect(room.view("a").lastTransfer).toEqual(
        nopeCount === 1
          ? null
          : {
              id: room.state.version,
              fromId: "b",
              toId: "a",
              cardType: "defuse",
            },
      );
      expect(
        room.view("b").game!.hand.some((card) => card.id === "defuse-1"),
      ).toBe(nopeCount === 1);
    },
  );

  test.each([2, 3])(
    "combo %i không lấy được bài vẫn báo kết quả, replay không tạo sự kiện mới",
    (count) => {
      const room = fixture();
      room.state.game!.players[1].hand =
        count === 2 ? [] : [{ id: "skip-b", type: "skip" }];
      room.state.game!.players[0].hand.push(
        ...Array.from({ length: count }, (_, index) => ({
          id: "combo-" + index,
          type: "tacocat" as const,
        })),
      );
      send(room, "a", {
        type: "play",
        cardIds: Array.from({ length: count }, (_, index) => "combo-" + index),
        targetId: "b",
        ...(count === 3 ? { requestedType: "defuse" as const } : {}),
      });
      send(room, "a", { type: "pass" });
      send(room, "b", { type: "pass" });
      const command = envelope(room, { type: "pass" });
      const result = room.process("c", command, 1200, () => 0.37);
      expect(result.ok).toBe(true);
      expect(JSON.stringify(result)).not.toContain("cardType");
      const event = {
        id: room.state.version,
        fromId: "b",
        toId: "a",
        cardType: null,
      };
      expect(room.view("a").lastTransfer).toEqual(event);
      const restored = new Room(structuredClone(room.state));
      expect(restored.process("c", command, 1300, () => 0.99)).toEqual(result);
      expect(restored.view("b").lastTransfer).toEqual(event);
      expect(send(restored, "a", { type: "cancel_game" }).ok).toBe(true);
      expect(restored.state.lastTransfer).toBeNull();
      for (const member of restored.state.members)
        send(restored, member.id, { type: "ready", ready: true });
      expect(send(restored, "a", { type: "start" }).ok).toBe(true);
      expect(restored.view("a").lastTransfer).toBeNull();
      const old = structuredClone(restored.state);
      delete old.lastTransfer;
      expect(new Room(old).view("a").lastTransfer).toBeNull();
    },
  );
});

describe("Mèo Nổ công khai và cài bom ngẫu nhiên phía server", () => {
  function defusingRoom() {
    const room = fixture();
    const game = room.state.game!;
    game.turn.playerId = "b";
    game.drawPile.unshift(game.drawPile.pop()!);
    expect(send(room, "b", { type: "draw" }).ok).toBe(true);
    return room;
  }

  test("mọi góc nhìn nhận người dính bom; lỗi/restart không đổi hoặc lộ bom", () => {
    const room = defusingRoom();
    const event = {
      id: room.state.version,
      playerId: "b",
      outcome: "defusing",
    };
    expect(
      send(room, "a", { type: "insert_bomb", position: "random" }).code,
    ).toBe("NOT_YOUR_CHOICE");
    const restored = new Room(
      JSON.parse(JSON.stringify(room.state)) as RoomState,
    );
    for (const viewer of ["a", "b", "c", null]) {
      expect(restored.view(viewer).lastBomb).toEqual(event);
      expect(JSON.stringify(restored.view(viewer))).not.toMatch(
        /bomb-4|position/,
      );
    }
    const exposed = restored.view(null);
    exposed.lastBomb!.playerId = "a";
    expect(restored.view(null).lastBomb).toEqual(event);
  });

  test.each([
    [0, 0],
    [0.49, 1],
    [0.999999, 3],
  ])("random %s cài tại %i trong cả N+1 vị trí", (sample, position) => {
    const room = defusingRoom();
    const before = structuredClone(room.state.game!);
    const command = parseCommand(
      envelope(room, { type: "insert_bomb", position: "random" }),
    );
    const random = vi.fn(() => sample);
    const ack = room.process("b", command, 1200, random);
    expect(ack.ok).toBe(true);
    expect(random).toHaveBeenCalledTimes(1);
    const inserted = room.state.game!;
    expect(inserted.drawPile.map((card) => card.id)).toEqual([
      ...before.drawPile.slice(0, position).map((card) => card.id),
      "bomb-4",
      ...before.drawPile.slice(position).map((card) => card.id),
    ]);
    expect(inserted.turn).toEqual({
      playerId: "c",
      remaining: 1,
      attacked: false,
    });
    const event = { id: ack.version, playerId: "b", outcome: "defused" };
    for (const viewer of ["a", "b", "c", null]) {
      expect(room.view(viewer).lastBomb).toEqual(event);
      expect(
        JSON.stringify(room.view(viewer)) + JSON.stringify(ack),
      ).not.toMatch(/bomb-4|position/);
    }
    const restored = new Room(
      JSON.parse(JSON.stringify(room.state)) as RoomState,
    );
    const reroll = vi.fn(() => {
      throw new Error("reroll");
    });
    expect(restored.process("b", command, 1300, reroll)).toEqual(ack);
    expect(reroll).not.toHaveBeenCalled();
    expect(restored.state.game).toEqual(inserted);
    expect(restored.view(null).lastBomb).toEqual(event);
  });

  test("chồng rút rỗng vẫn cài ngẫu nhiên được tại vị trí duy nhất", () => {
    const room = defusingRoom();
    room.state.game!.discardPile.push(...room.state.game!.drawPile.splice(0));
    expect(
      send(room, "b", { type: "insert_bomb", position: "random" }).ok,
    ).toBe(true);
    expect(room.state.game!.drawPile).toEqual([
      { id: "bomb-4", type: "exploding_kitten" },
    ]);
  });

  test.each([false, true])(
    "công khai người nổ, kể cả khi kết thúc ván=%s",
    (finishes) => {
      const room = fixture();
      const game = room.state.game!;
      game.drawPile.unshift(game.drawPile.pop()!);
      if (finishes) {
        game.players[2].alive = false;
        game.discardPile.push(...game.players[2].hand.splice(0));
      }
      expect(send(room, "a", { type: "draw" }).ok).toBe(true);
      expect(room.state.game!.phase.kind).toBe(finishes ? "finished" : "turn");
      const event = {
        id: room.state.version,
        playerId: "a",
        outcome: "exploded",
      };
      const restored = new Room(
        JSON.parse(JSON.stringify(room.state)) as RoomState,
      );
      for (const viewer of ["a", "b", "c", null]) {
        const snapshot = restored.view(viewer);
        expect(snapshot.lastBomb).toEqual(event);
        expect(snapshot.members[0].alive).toBe(false);
        expect(snapshot.game!.discardPile.at(-1)?.type).toBe(
          "exploding_kitten",
        );
        expect(JSON.stringify(snapshot)).not.toContain("bomb-4");
      }
      expect(restored.view("a").game!.hand).toEqual([]);
      if (finishes)
        expect(restored.state.game!.phase).toEqual({
          kind: "finished",
          winnerId: "b",
        });
    },
  );

  test("thông báo hết hiệu lực khi có thao tác tiếp theo hoặc hủy/tái đấu", () => {
    const room = defusingRoom();
    send(room, "b", { type: "insert_bomb", position: 3 });
    expect(room.view(null).lastBomb?.outcome).toBe("defused");
    expect(send(room, "c", { type: "draw" }).ok).toBe(true);
    expect(room.view(null).lastBomb).toBeNull();
    const old = structuredClone(room.state);
    delete old.lastBomb;
    expect(new Room(old).view(null).lastBomb).toBeNull();
    room.state.lastBomb = {
      id: room.state.version,
      playerId: "b",
      outcome: "defused",
    };
    expect(send(room, "a", { type: "cancel_game" }).ok).toBe(true);
    expect(room.state.lastBomb).toBeNull();
    for (const member of room.state.members)
      send(room, member.id, { type: "ready", ready: true });
    expect(send(room, "a", { type: "start" }).ok).toBe(true);
    expect(room.view(null).lastBomb).toBeNull();
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

describe("mất kết nối, khôi phục và vòng đời", () => {
  test("Nope vẫn chạy khi người đánh offline, người online được phản ứng", () => {
    const room = fixture();
    send(room, "a", { type: "play", cardIds: ["skip-1"] }, 1000);
    send(room, "b", { type: "pass" }, 1600);
    const game = structuredClone(room.state.game);
    room.disconnect("a", "socket-a");
    room.disconnect("b", "socket-b");
    expect(room.view("c").pause).toBeNull();
    expect(room.view("c").game!.reaction).toEqual({
      deadline: 6000,
      passedIds: ["b"],
    });
    expect(room.state.game).toEqual(game);
    expect(room.state.hostId).toBe("a");
    expect(send(room, "c", { type: "nope", cardId: "nope-2" }, 4700).ok).toBe(
      true,
    );
    expect(room.state.reaction).toEqual({ deadline: 9700, passedIds: [] });
    expect(room.expire(9699, () => 0.3)).toBe(false);
    expect(room.expire(9700, () => 0.3)).toBe(true);
    expect(room.view("c").game!.turn.playerId).toBe("a");
    expect(room.view("c").game!.idle).toEqual({
      playerId: "a",
      deadline: 69700,
    });
    const settled = structuredClone(room.state);
    expect(room.expire(9701, () => 0.9)).toBe(false);
    expect(room.state).toEqual(settled);
    room.connect("a", "return-a", 10000);
    expect(room.view("a").game!.idle?.deadline).toBe(69700);
  });
  test.each(["turn", "reaction"] as const)(
    "ván cũ đang pause %s chỉ chuyển thời gian còn lại một lần",
    (phase) => {
      const room = fixture();
      if (phase === "reaction")
        send(room, "a", { type: "play", cardIds: ["skip-1"] });
      const saved = structuredClone(room.state);
      saved.pause = {
        since: 2100,
        remainingNopeMs: phase === "reaction" ? 3900 : null,
        remainingIdleMs: phase === "turn" ? 40000 : null,
      };
      const before = structuredClone(saved);
      const restored = new Room(saved, 200000);
      expect(saved).toEqual(before);
      expect(restored.view(null).pause).toBeNull();
      expect(restored.state.game).toEqual(saved.game);
      const deadline = phase === "turn" ? 240000 : 203900;
      const running = new Room(structuredClone(restored.state), 201000);
      running.reconcileConnections(new Map(), 201000);
      expect(running.nextAlarm(new Map())).toBe(deadline);
      expect(running.expire(deadline - 1, () => 0)).toBe(false);
      expect(running.expire(deadline, () => 0)).toBe(true);
      expect(running.view(null).game!.turn.playerId).toBe("b");
      expect(running.view(null).game!.drawCount).toBe(phase === "turn" ? 3 : 4);
      expect(running.expire(deadline + 1, () => 0)).toBe(false);
    },
  );
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
        5000,
      );
      restored.reconcileConnections(new Map(), 5000);
      expect(
        restored.view(null).members.every((member) => !member.connected),
      ).toBe(true);
      expect(restored.state.pause).toBeNull();
      expect(
        restored.expire(5000, () => {
          throw new Error("must not reroll");
        }),
      ).toBe(false);
      expect(restored.state.game).toEqual(game);
      for (const id of ["a", "b", "c"]) restored.connect(id, "new-" + id, 5100);
      expect(restored.state.gameId).toBe("persistent-game");
      expect(restored.state.game).toEqual(game);
      expect(restored.view("a").game!.idle).toEqual(room.view("a").game!.idle);
      expect(restored.view("a").game!.reaction).toEqual(
        room.view("a").game!.reaction,
      );
      expect(restored.view("a").game!.futureCards).toEqual(
        room.view("a").game!.futureCards,
      );
      expect(restored.view("c").game!.futureCards).toEqual([]);
    },
  );
  test("hibernation còn socket và heartbeat thật không đổi hạn/phiên bản", () => {
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
    expect(room.state.pause).toBeNull();
    expect(room.view("b").game!.idle?.deadline).toBe(61000);
    expect(room.state.hostId).toBe("a");
  });
  test("người bị loại và chủ phòng bị loại rớt mạng không pause hoặc chuyển quyền", () => {
    const room = fixture();
    room.state.game!.players[0].alive = false;
    room.state.game!.players[0].hand = [];
    room.state.game!.turn.playerId = "b";
    room.state.idle = { playerId: "b", deadline: 61000 };
    const game = structuredClone(room.view("b").game);
    room.disconnect("a", "socket-a");
    expect(room.state.pause).toBeNull();
    expect(room.state.hostId).toBe("a");
    expect(room.view("b").game).toEqual(game);
    expect(send(room, "b", { type: "draw" }, 5000).ok).toBe(true);
  });
  test("tab mới thay tab cũ giữa reaction không đóng băng nhầm", () => {
    const room = fixture();
    send(room, "a", { type: "play", cardIds: ["skip-1"] });
    room.connect("b", "new-b", 2400);
    expect(room.disconnect("b", "socket-b")).toBe(false);
    expect(room.state.pause).toBeNull();
    expect(room.state.reaction!.deadline).toBe(6000);
  });
  test("chủ rời chủ động giữ ghế/bài, chuyển cho người online, chủ mới được hủy", () => {
    const room = fixture();
    const hand = structuredClone(room.state.game!.players[0].hand);
    room.disconnect("b", "socket-b");
    expect(send(room, "a", { type: "leave" }, 2000).ok).toBe(true);
    expect(room.state.hostId).toBe("c");
    expect(room.state.members.map((member) => member.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(room.state.game!.players[0].hand).toEqual(hand);
    expect(room.state.game!.players[0].alive).toBe(true);
    expect(room.view("c").game!.idle?.deadline).toBe(61000);
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
    room.disconnect("b", "socket-b");
    room.disconnect("c", "socket-c");
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
    expect(room.state.game!.drawPile).toHaveLength(60);
  });
  test("alarm vẫn ưu tiên Nope/idle khi tất cả offline; alarm và GET không gia hạn", () => {
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
    room.disconnect("a", "socket-a");
    expect(room.nextAlarm(times)).toBe(6200);
    room.disconnect("b", "socket-b");
    room.disconnect("c", "socket-c");
    expect(room.nextAlarm(new Map())).toBe(6200);
    expect(room.expire(6200, () => 0.1)).toBe(true);
    expect(room.nextAlarm(new Map())).toBe(66200);
    room.view(null);
    room.expire(90000, () => 0.1);
    expect(room.state.lastActivity).toBe(1200);
    expect(room.nextAlarm(new Map())).toBe(150000);
    expect(send(room, "a", { type: "cancel_game" }, 100000).ok).toBe(true);
    expect(room.nextAlarm(new Map())).toBe(100000 + ROOM_TTL_MS);
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
  test.each([
    "original-2022",
    "original-2022-long",
    "original-2022-scaled",
    "original-2022-mixed",
  ] as const)(
    "restart không thêm bài hoặc chia lại ván đã lưu theo %s",
    (rulesVersion) => {
      const room = lobby();
      if (rulesVersion === "original-2022-scaled") {
        send(room, "a", { type: "set_capacity", capacity: 4 });
        room.addMember("d", "D", "hash-d");
        room.connect("d", "socket-d");
      }
      for (const member of room.state.members)
        send(room, member.id, { type: "ready", ready: true });
      expect(send(room, "a", { type: "start" }).ok).toBe(true);
      room.state.rulesVersion = rulesVersion;
      if (rulesVersion !== "original-2022-mixed") {
        const game = room.state.game!;
        const oldCard = (card: { id: string; type: string }) =>
          !["alter_future", "reverse", "draw_bottom"].includes(card.type) &&
          !["defuse-7", "defuse-8"].includes(card.id);
        game.drawPile = game.drawPile.filter(oldCard);
        game.removedCards = game.removedCards.filter(oldCard);
        for (const player of game.players)
          player.hand = player.hand.filter(oldCard);
        delete game.direction;
      }
      if (rulesVersion === "original-2022-long") {
        for (const [type, count] of [
          ["attack", 2],
          ["skip", 3],
          ["favor", 2],
          ["shuffle", 3],
          ["see_future", 2],
          ["nope", 2],
          ["tacocat", 2],
          ["cattermelon", 2],
          ["hairy_potato_cat", 2],
          ["beard_cat", 2],
          ["rainbow_ralphing_cat", 2],
        ] as const) {
          room.state.game!.drawPile.push(
            ...Array.from({ length: count }, (_, index) => ({
              id: `extra-${type}-${index + 1}`,
              type,
            })),
          );
        }
      }
      if (rulesVersion === "original-2022-mixed") {
        const game = room.state.game!;
        for (const player of game.players)
          while (player.hand.length < 8) {
            const index = game.drawPile.findIndex(
              (card) => card.type !== "exploding_kitten",
            );
            player.hand.push(...game.drawPile.splice(index, 1));
          }
      }
      const saved = JSON.parse(JSON.stringify(room.state)) as RoomState;
      const restored = new Room(saved);
      expect(restored.state).toEqual(saved);
    },
  );
});

describe("validation biên mạng", () => {
  test.each([1, 2, 3, 5])("parser nhận đúng lệnh đánh %i lá", (count) => {
    const action: RoomAction = {
      type: "play",
      cardIds: Array.from({ length: count }, (_, index) => "cost-" + index),
      ...(count === 2 || count === 3 ? { targetId: "b" } : {}),
      ...(count === 3 ? { requestedType: "defuse" as const } : {}),
      ...(count === 5 ? { discardIndex: 0 } : {}),
    };
    const command = { type: "command", id: "x", version: 0, action };
    expect(parseCommand(command)).toEqual(command);
  });

  test.each([0, 4, 6, 9])("parser không nhận %i lá", (count) => {
    expect(() =>
      parseCommand({
        type: "command",
        id: "x",
        version: 0,
        action: {
          type: "play",
          cardIds: Array.from({ length: count }, (_, index) => "cost-" + index),
          discardIndex: 0,
        },
      }),
    ).toThrow("INVALID_COMMAND");
  });

  test.each([
    undefined,
    null,
    -1,
    0.5,
    NaN,
    Infinity,
    "0",
    Number.MAX_SAFE_INTEGER + 1,
  ])("parser từ chối discardIndex thiếu/sai %s", (discardIndex) => {
    expect(() =>
      parseCommand({
        type: "command",
        id: "x",
        version: 0,
        action: {
          type: "play",
          cardIds: ["a", "b", "c", "d", "e"],
          discardIndex,
        },
      }),
    ).toThrow(
      discardIndex === undefined
        ? "DISCARD_INDEX_REQUIRED"
        : "INVALID_DISCARD_INDEX",
    );
  });

  test.each([0, 1, Number.MAX_SAFE_INTEGER])(
    "parser nhận index nguyên an toàn %i, engine kiểm tra phạm vi",
    (discardIndex) => {
      const command = {
        type: "command",
        id: "x",
        version: 0,
        action: {
          type: "play",
          cardIds: ["a", "b", "c", "d", "e"],
          discardIndex,
        },
      };
      expect(parseCommand(command)).toEqual(command);
    },
  );

  test.each([1, 2, 3])(
    "discardIndex không liên quan tới combo %i lá bị chặn",
    (count) => {
      expect(() =>
        parseCommand({
          type: "command",
          id: "x",
          version: 0,
          action: {
            type: "play",
            cardIds: Array.from(
              { length: count },
              (_, index) => "cost-" + index,
            ),
            discardIndex: 0,
          },
        }),
      ).toThrow("INVALID_COMMAND");
    },
  );

  test.each([{ targetId: "b" }, { requestedType: "defuse" }])(
    "combo 5 không nhận lựa chọn cho combo khác %j",
    (options) => {
      expect(() =>
        parseCommand({
          type: "command",
          id: "x",
          version: 0,
          action: {
            type: "play",
            cardIds: ["a", "b", "c", "d", "e"],
            discardIndex: 0,
            ...options,
          },
        }),
      ).toThrow("INVALID_COMMAND");
    },
  );

  test("chuẩn hóa combo 5 không đổi fingerprint khi thứ tự thuộc tính thay đổi", () => {
    expect(
      parseCommand({
        action: {
          discardIndex: 0,
          cardIds: ["a", "b", "c", "d", "e"],
          type: "play",
        },
        version: 2,
        id: "x",
        type: "command",
      }),
    ).toEqual({
      type: "command",
      id: "x",
      version: 2,
      action: {
        type: "play",
        cardIds: ["a", "b", "c", "d", "e"],
        discardIndex: 0,
      },
    });
  });

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
      action: { type: "insert_bomb", position: "random", seed: 1 },
    },
    {
      type: "command",
      id: "x",
      version: 0,
      action: { type: "insert_bomb", position: "anything" },
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
