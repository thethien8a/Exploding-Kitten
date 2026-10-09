import { describe, expect, test, vi } from "vitest";
import {
  applyCommand,
  createDeck,
  createGame,
  getFutureCards,
  resolveReaction,
  type Card,
  type CardType,
  type GameCommand,
  type GameState,
  type Random,
} from "../shared/engine";

const seats = ["an", "binh", "chi", "dung", "em"];

function fixture(hands: CardType[][], deck: CardType[]): GameState {
  let nextId = 0;
  const card = (type: CardType): Card => ({ id: `fixture-${++nextId}`, type });
  return {
    players: hands.map((hand, index) => ({
      id: seats[index],
      alive: true,
      hand: hand.map(card),
    })),
    drawPile: deck.map(card),
    discardPile: [],
    removedCards: [],
    turn: { playerId: "an", remaining: 1, attacked: false },
    phase: { kind: "turn" },
  };
}

function inventory(game: GameState): Card[] {
  return [
    ...game.players.flatMap((player) => player.hand),
    ...game.drawPile,
    ...game.discardPile,
    ...game.removedCards,
    ...(game.phase.kind === "defuse" ? [game.phase.bomb] : []),
  ].sort((left, right) => left.id.localeCompare(right.id));
}

function expectInvariants(game: GameState, previous: GameState): void {
  const cards = inventory(game);
  expect(new Set(cards.map((card) => card.id)).size).toBe(cards.length);
  expect(cards).toEqual(inventory(previous));
  expect(game.removedCards).toEqual(previous.removedCards);
  for (const player of game.players) {
    if (!player.alive) expect(player.hand).toEqual([]);
  }
  const current = game.players.find(
    (player) => player.id === game.turn.playerId,
  );
  expect(current?.alive).toBe(true);
  if (game.phase.kind === "finished") {
    expect(
      game.players.filter((player) => player.alive).map((player) => player.id),
    ).toEqual([game.phase.winnerId]);
    expect(game.turn.remaining).toBe(0);
  } else {
    expect(game.turn.remaining).toBeGreaterThan(0);
    expect(Number.isInteger(game.turn.remaining)).toBe(true);
  }
}

function move(game: GameState, command: GameCommand): GameState {
  const before = structuredClone(game);
  const result = applyCommand(game, command);
  expect(game).toEqual(before);
  expectInvariants(result, before);
  return result;
}

function settle(game: GameState, random: Random = () => 0): GameState {
  const before = structuredClone(game);
  const result = resolveReaction(game, random);
  expect(game).toEqual(before);
  expectInvariants(result, before);
  return result;
}

function play(
  game: GameState,
  type: CardType,
  options: { count?: number; targetId?: string; requestedType?: CardType } = {},
): GameState {
  const player = game.players.find(
    (player) => player.id === game.turn.playerId,
  )!;
  const cardIds = player.hand
    .filter((card) => card.type === type)
    .slice(0, options.count ?? 1)
    .map((card) => card.id);
  return move(game, { type: "play", playerId: player.id, cardIds, ...options });
}

function seededRandom(seed: number): Random {
  let value = seed;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0x1_0000_0000;
  };
}

describe("bộ cơ bản pha mở rộng và số bài theo số người", () => {
  test("67 ID duy nhất, 16 loại và thêm 2 Gỡ Bom", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(67);
    expect(new Set(deck.map((card) => card.id)).size).toBe(67);
    const counts = Object.fromEntries(
      [...new Set(deck.map((card) => card.type))].map((type) => [
        type,
        deck.filter((card) => card.type === type).length,
      ]),
    );
    expect(counts).toEqual({
      exploding_kitten: 4,
      defuse: 8,
      attack: 4,
      skip: 4,
      favor: 4,
      shuffle: 4,
      see_future: 5,
      alter_future: 3,
      reverse: 3,
      draw_bottom: 3,
      nope: 5,
      tacocat: 4,
      cattermelon: 4,
      hairy_potato_cat: 4,
      beard_cat: 4,
      rainbow_ralphing_cat: 4,
    });
  });

  test.each([
    {
      players: 3,
      deck: 49,
      bombs: 2,
      defuses: 7,
      removed: 3,
      total: 67,
      extraCopies: 0,
    },
    {
      players: 4,
      deck: 60,
      bombs: 3,
      defuses: 8,
      removed: 1,
      total: 81,
      extraCopies: 1,
    },
    {
      players: 5,
      deck: 70,
      bombs: 4,
      defuses: 8,
      removed: 0,
      total: 95,
      extraCopies: 2,
    },
  ])("$players người: chồng $deck lá, $bombs bom", (expected) => {
    const ids = seats.slice(0, expected.players);
    const game = createGame(ids, seededRandom(149));
    expect(game.players.map((player) => player.id)).toEqual(ids);
    for (const player of game.players) {
      expect(player.hand).toHaveLength(5);
      expect(player.hand.some((card) => card.type === "defuse")).toBe(true);
      expect(player.hand.some((card) => card.type === "exploding_kitten")).toBe(
        false,
      );
      expect(player.hand.some((card) => card.id.startsWith("extra-"))).toBe(
        false,
      );
      expect(player.alive).toBe(true);
    }
    expect(game.drawPile).toHaveLength(expected.deck);
    expect(
      game.drawPile.filter((card) => card.type === "exploding_kitten"),
    ).toHaveLength(expected.bombs);
    expect(
      [
        ...game.drawPile,
        ...game.players.flatMap((player) => player.hand),
      ].filter((card) => card.type === "defuse"),
    ).toHaveLength(expected.defuses);
    expect(game.removedCards).toHaveLength(expected.removed);
    expect(
      game.removedCards.every(
        (card) => card.type === "defuse" || card.type === "exploding_kitten",
      ),
    ).toBe(true);
    expect(game.discardPile).toEqual([]);
    expect(game.phase).toEqual({ kind: "turn" });
    expect(game.turn.remaining).toBe(1);
    expect(game.turn.attacked).toBe(false);
    const cards = inventory(game);
    expect(cards).toHaveLength(expected.total);
    expect(new Set(cards.map((card) => card.id)).size).toBe(expected.total);
    expect(cards.filter((card) => !card.id.startsWith("extra-"))).toEqual(
      createDeck().sort((a, b) => a.id.localeCompare(b.id)),
    );
    const extra = game.drawPile.filter((card) => card.id.startsWith("extra-"));
    expect(extra).toHaveLength(expected.total - 67);
    expect(
      Object.fromEntries(
        [...new Set(extra.map((card) => card.type))].map((type) => [
          type,
          extra.filter((card) => card.type === type).length,
        ]),
      ),
    ).toEqual(
      expected.extraCopies === 0
        ? {}
        : {
            attack: expected.extraCopies,
            skip: expected.extraCopies,
            favor: expected.extraCopies,
            shuffle: expected.extraCopies,
            see_future: expected.extraCopies,
            alter_future: expected.extraCopies,
            reverse: expected.extraCopies,
            draw_bottom: expected.extraCopies,
            nope: expected.extraCopies,
            tacocat: expected.extraCopies,
            cattermelon: expected.extraCopies,
            hairy_potato_cat: expected.extraCopies,
            beard_cat: expected.extraCopies,
            rainbow_ralphing_cat: expected.extraCopies,
          },
    );
  });

  test("Gỡ Bom dư được trộn trước khi chia, không đảm bảo mỗi tay chỉ có một", () => {
    let samples = 0;
    const game = createGame(seats.slice(0, 3), () =>
      samples++ === 0 ? 0 : 0.9999,
    );
    expect(
      game.players[0].hand.filter((card) => card.type === "defuse"),
    ).toHaveLength(2);
    expect(game.players[0].hand).toHaveLength(5);
    expect(game.drawPile).toHaveLength(49);
  });

  test.each([
    [0, "an"],
    [0.5, "chi"],
    [0.9999, "em"],
  ] as const)("mẫu random %s chọn người đầu %s", (sample, expected) => {
    expect(createGame(seats, () => sample).turn.playerId).toBe(expected);
  });

  test("seed tái lập ván, không sửa danh sách ghế", () => {
    const ids = [...seats];
    const first = createGame(ids, seededRandom(481));
    expect(createGame(ids, seededRandom(481))).toEqual(first);
    expect(createGame(ids, seededRandom(482)).drawPile).not.toEqual(
      first.drawPile,
    );
    expect(ids).toEqual(seats);
  });

  test.each([0, 1, 2, 6])("từ chối %i người", (count) => {
    expect(() =>
      createGame(
        Array.from({ length: count }, (_, i) => `${i}`),
        () => 0,
      ),
    ).toThrow("INVALID_PLAYER_COUNT");
  });

  test.each([{ ids: ["an", "an", "chi"] }, { ids: ["", "binh", "chi"] }])(
    "từ chối ID ghế trùng/rỗng $ids",
    ({ ids }) => {
      expect(() => createGame(ids, () => 0)).toThrow("INVALID_PLAYER_IDS");
    },
  );
});

describe("Alter the Future, Reverse và Draw from the Bottom", () => {
  test("sắp kín đúng 3 lá, không sửa phần còn lại hoặc kết thúc lượt", () => {
    const initial = fixture(
      [["alter_future"], [], []],
      ["skip", "exploding_kitten", "favor", "defuse"],
    );
    const pending = play(initial, "alter_future");
    expect(getFutureCards(pending, "an")).toEqual([]);
    const future = settle(pending);
    expect(getFutureCards(future, "an")).toEqual(initial.drawPile.slice(0, 3));
    expect(getFutureCards(future, "binh")).toEqual([]);
    expect(() =>
      move(future, {
        type: "reorder_future",
        playerId: "binh",
        order: [2, 0, 1],
      }),
    ).toThrow("NOT_YOUR_CHOICE");
    expect(() =>
      move(future, { type: "close_future", playerId: "an" }),
    ).toThrow("NO_FUTURE");
    const reordered = move(JSON.parse(JSON.stringify(future)), {
      type: "reorder_future",
      playerId: "an",
      order: [2, 0, 1],
    });
    expect(reordered.drawPile).toEqual([
      initial.drawPile[2],
      initial.drawPile[0],
      initial.drawPile[1],
      initial.drawPile[3],
    ]);
    expect(reordered.turn).toEqual(initial.turn);
    expect(reordered.phase).toEqual({ kind: "turn" });
    expect(getFutureCards(reordered, "an")).toEqual([]);
    expect(
      move(reordered, { type: "draw", playerId: "an" }).players[0].hand,
    ).toEqual([initial.drawPile[2]]);
  });

  test.each(
    [[], [0, 1], [0, 0, 2], [0, 1, 3], [-1, 0, 1], [0, 1, 1.5]].map(
      (order) => ({ order }),
    ),
  )("từ chối thứ tự thiếu/trùng/ngoài phạm vi %j", ({ order }) => {
    const future = settle(
      play(
        fixture([["alter_future"], [], []], ["skip", "favor", "defuse"]),
        "alter_future",
      ),
    );
    expect(() =>
      move(future, { type: "reorder_future", playerId: "an", order }),
    ).toThrow("INVALID_FUTURE_ORDER");
  });

  test.each([0, 1, 2])("chỉ sắp %i lá khi chồng còn ít hơn 3", (count) => {
    const game = fixture(
      [["alter_future"], [], []],
      (["skip", "favor"] as CardType[]).slice(0, count),
    );
    const future = settle(play(game, "alter_future"));
    const order = count === 2 ? [1, 0] : count === 1 ? [0] : [];
    expect(
      move(future, { type: "reorder_future", playerId: "an", order }).drawPile,
    ).toEqual([...game.drawPile].reverse());
  });

  test("Reverse đổi chiều lâu dài, Attack dùng chiều mới và bỏ qua ghế đã chết", () => {
    let game = fixture(
      [["reverse", "reverse"], ["skip"], ["tacocat"], ["attack"]],
      ["favor", "defuse"],
    );
    game.players[2].alive = false;
    game.players[2].hand = [];
    game = settle(play(game, "reverse"));
    expect(game.direction).toBe(-1);
    expect(game.turn.playerId).toBe("dung");
    game = settle(play(game, "attack"));
    expect(game.turn).toEqual({
      playerId: "binh",
      remaining: 2,
      attacked: true,
    });
    game = settle(play(game, "skip"));
    expect(game.turn.remaining).toBe(1);
    game = move(game, { type: "draw", playerId: "binh" });
    expect(game.turn.playerId).toBe("an");
    game = settle(play(game, "reverse"));
    expect(game.direction).toBe(1);
    expect(game.turn.playerId).toBe("binh");
  });

  test("Reverse chỉ trả một lượt Attack; rút và bị loại tiếp tục theo chiều đảo", () => {
    let game = fixture(
      [["reverse"], ["skip"], ["favor"]],
      ["exploding_kitten", "defuse"],
    );
    game.turn = { playerId: "an", remaining: 2, attacked: true };
    game = settle(play(game, "reverse"));
    expect(game.turn).toEqual({ playerId: "an", remaining: 1, attacked: true });
    game = move(game, { type: "draw", playerId: "an" });
    expect(game.players[0].alive).toBe(false);
    expect(game.turn.playerId).toBe("chi");
  });

  test("còn 2 người, Reverse kết thúc lượt như Skip", () => {
    const game = fixture([["reverse"], [], ["favor"]], ["defuse"]);
    game.players[1].alive = false;
    const result = settle(play(game, "reverse"));
    expect(result.turn.playerId).toBe("chi");
    expect(result.drawPile).toEqual(game.drawPile);
  });

  test("Rút Đáy tránh bom ở đầu và chỉ trả một lượt Attack", () => {
    const game = fixture(
      [["draw_bottom"], [], []],
      ["exploding_kitten", "skip", "favor"],
    );
    game.turn = { playerId: "an", remaining: 2, attacked: true };
    const result = settle(play(game, "draw_bottom"));
    expect(result.players[0].hand).toEqual([game.drawPile[2]]);
    expect(result.drawPile).toEqual(game.drawPile.slice(0, 2));
    expect(result.turn).toEqual({
      playerId: "an",
      remaining: 1,
      attacked: true,
    });
  });

  test.each([true, false])(
    "bom dưới đáy xử lý Gỡ Bom/loại đúng (có Gỡ Bom: %s)",
    (defusing) => {
      const game = fixture(
        [["draw_bottom", ...(defusing ? ["defuse" as const] : [])], [], []],
        ["skip", "exploding_kitten"],
      );
      game.direction = -1;
      const result = settle(play(game, "draw_bottom"));
      expect(result.drawPile).toEqual([game.drawPile[0]]);
      if (defusing) {
        expect(result.phase).toEqual({
          kind: "defuse",
          playerId: "an",
          bomb: game.drawPile[1],
        });
        expect(
          move(result, { type: "insert_bomb", playerId: "an", position: 1 })
            .turn.playerId,
        ).toBe("chi");
      } else {
        expect(result.players[0].alive).toBe(false);
        expect(result.turn.playerId).toBe("chi");
      }
    },
  );

  test.each(["alter_future", "reverse", "draw_bottom"] as const)(
    "Nope chặn %s, không lộ/sắp/rút/đổi chiều",
    (type) => {
      const game = fixture(
        [[type], ["nope"], []],
        ["skip", "favor", "exploding_kitten"],
      );
      const pending = play(game, type);
      const result = settle(
        move(pending, {
          type: "nope",
          playerId: "binh",
          cardId: game.players[1].hand[0].id,
        }),
      );
      expect(result.phase).toEqual({ kind: "turn" });
      expect(result.turn).toEqual(game.turn);
      expect(result.direction).toBe(game.direction);
      expect(result.drawPile).toEqual(game.drawPile);
      expect(getFutureCards(result, "an")).toEqual([]);
    },
  );
});

describe("lượt, Attack và Skip", () => {
  test("không đánh lá nào: rút đúng lá đầu rồi tới ghế sau", () => {
    const game = fixture(
      [[], ["skip"], ["favor", "nope"]],
      ["beard_cat", "tacocat"],
    );
    const result = move(game, { type: "draw", playerId: "an" });
    expect(result.players[0].hand).toEqual([game.drawPile[0]]);
    expect(result.players[1].hand).toEqual(game.players[1].hand);
    expect(result.drawPile).toEqual([game.drawPile[1]]);
    expect(result.turn).toEqual({
      playerId: "binh",
      remaining: 1,
      attacked: false,
    });
  });

  test("có thể đánh nhiều lá trước khi rút; không giới hạn hand size", () => {
    let game = fixture(
      [
        ["shuffle", "see_future", ...Array<CardType>(21).fill("tacocat")],
        ["skip"],
        ["favor", "nope"],
      ],
      ["beard_cat", "defuse", "cattermelon", "exploding_kitten"],
    );
    game = settle(play(game, "shuffle"), () => 0.9999);
    game = settle(play(game, "see_future"));
    game = move(game, { type: "close_future", playerId: "an" });
    expect(game.turn.playerId).toBe("an");
    const drawn = move(game, { type: "draw", playerId: "an" });
    expect(drawn.players[0].hand).toHaveLength(22);
    expect(drawn.players[0].hand.at(-1)?.type).toBe("beard_cat");
  });

  test.each([1, 2, 4])("Skip trả đúng một trong %i lượt nợ", (remaining) => {
    const game = fixture(
      [["skip"], ["favor"], ["nope", "defuse"]],
      ["tacocat"],
    );
    game.turn = { playerId: "an", remaining, attacked: true };
    const result = settle(play(game, "skip"));
    expect(result.turn).toEqual(
      remaining === 1
        ? { playerId: "binh", remaining: 1, attacked: false }
        : { playerId: "an", remaining: remaining - 1, attacked: true },
    );
    expect(result.drawPile).toEqual(game.drawPile);
  });

  test("Attack nối nhau luôn chuyển đúng 2 lượt, không cộng dồn", () => {
    let game = fixture(
      [["attack"], ["attack", "skip"], ["attack", "favor", "nope"]],
      ["beard_cat", "tacocat"],
    );
    for (const expected of [
      { playerId: "binh", remaining: 2, attacked: true },
      { playerId: "chi", remaining: 2, attacked: true },
      { playerId: "an", remaining: 2, attacked: true },
    ]) {
      game = settle(play(game, "attack"));
      expect(game.turn).toEqual(expected);
      expect(game.drawPile.map((card) => card.type)).toEqual([
        "beard_cat",
        "tacocat",
      ]);
    }
    game = move(game, { type: "draw", playerId: "an" });
    expect(game.turn).toEqual({ playerId: "an", remaining: 1, attacked: true });
    game = move(game, { type: "draw", playerId: "an" });
    expect(game.turn).toEqual({
      playerId: "binh",
      remaining: 1,
      attacked: false,
    });
  });

  test.each(["draw", "skip"] as const)(
    "Attack sau khi %s một lượt nợ vẫn chỉ chuyển 2 lượt",
    (method) => {
      let game = fixture(
        [["attack"], ["attack", "skip"], ["favor", "nope"]],
        ["beard_cat", "defuse"],
      );
      game = settle(play(game, "attack"));
      game =
        method === "draw"
          ? move(game, { type: "draw", playerId: "binh" })
          : settle(play(game, "skip"));
      expect(game.turn).toEqual({
        playerId: "binh",
        remaining: 1,
        attacked: true,
      });
      game = settle(play(game, "attack"));
      expect(game.turn).toEqual({
        playerId: "chi",
        remaining: 2,
        attacked: true,
      });
    },
  );

  test("Nope chặn Attack phản công giữ nguyên 2 lượt của người đang bị Attack", () => {
    let game = fixture(
      [["attack"], ["attack"], ["nope"]],
      ["beard_cat", "tacocat"],
    );
    game = settle(play(game, "attack"));
    const turn = { ...game.turn };
    game = play(game, "attack");
    game = move(game, {
      type: "nope",
      playerId: "chi",
      cardId: game.players[2].hand[0].id,
    });
    game = settle(game);
    expect(game.turn).toEqual(turn);
    expect(game.discardPile.map((card) => card.type)).toEqual([
      "attack",
      "attack",
      "nope",
    ]);
  });

  test("trả hết nợ rồi Attack ở vòng sau chỉ chuyển 2 lượt", () => {
    let game = fixture(
      [
        ["attack", "skip"],
        ["attack", "skip", "skip"],
        ["skip", "nope"],
      ],
      ["beard_cat"],
    );
    game = settle(play(game, "attack"));
    game = settle(play(game, "skip"));
    game = settle(play(game, "skip"));
    game = settle(play(game, "skip"));
    game = settle(play(game, "skip"));
    expect(game.turn).toEqual({
      playerId: "binh",
      remaining: 1,
      attacked: false,
    });
    game = settle(play(game, "attack"));
    expect(game.turn).toEqual({
      playerId: "chi",
      remaining: 2,
      attacked: true,
    });
  });

  test.each(["draw", "attack", "skip"] as const)(
    "%s bỏ qua ghế bị loại và vòng qua ghế cuối",
    (method) => {
      const game = fixture(
        [["attack", "skip"], [], ["favor"]],
        ["beard_cat", "defuse", "tacocat"],
      );
      game.players[1].alive = false;
      let result =
        method === "draw"
          ? move(game, { type: "draw", playerId: "an" })
          : settle(play(game, method));
      expect(result.turn.playerId).toBe("chi");
      result = move(result, { type: "draw", playerId: "chi" });
      if (method === "attack") {
        expect(result.turn).toEqual({
          playerId: "chi",
          remaining: 1,
          attacked: true,
        });
        result = move(result, { type: "draw", playerId: "chi" });
      }
      expect(result.turn.playerId).toBe("an");
    },
  );
});

describe("Mèo Nổ và Gỡ Bom", () => {
  test("không Gỡ Bom: loại, bỏ toàn bộ tay và bom, không chuyển nợ", () => {
    const game = fixture(
      [["nope", "favor"], ["skip"], ["defuse", "tacocat"]],
      ["exploding_kitten", "beard_cat"],
    );
    game.turn = { playerId: "an", remaining: 4, attacked: true };
    const result = move(game, { type: "draw", playerId: "an" });
    expect(result.players[0]).toEqual({ id: "an", alive: false, hand: [] });
    expect(result.discardPile).toEqual([
      ...game.players[0].hand,
      game.drawPile[0],
    ]);
    expect(result.turn).toEqual({
      playerId: "binh",
      remaining: 1,
      attacked: false,
    });
    expect(result.drawPile).toEqual([game.drawPile[1]]);
  });

  test.each([
    { position: 0, types: ["exploding_kitten", "beard_cat", "favor", "skip"] },
    { position: 1, types: ["beard_cat", "exploding_kitten", "favor", "skip"] },
    { position: 3, types: ["beard_cat", "favor", "skip", "exploding_kitten"] },
  ])(
    "cài bom vị trí $position, giữ nguyên thứ tự các lá khác",
    ({ position, types }) => {
      const game = fixture(
        [["tacocat", "defuse", "defuse"], ["nope"], ["skip", "favor"]],
        ["exploding_kitten", "beard_cat", "favor", "skip"],
      );
      const defusing = move(game, { type: "draw", playerId: "an" });
      expect(defusing.phase).toEqual({
        kind: "defuse",
        playerId: "an",
        bomb: game.drawPile[0],
      });
      expect(defusing.discardPile).toEqual([game.players[0].hand[1]]);
      expect(defusing.players[0].hand).toEqual([
        game.players[0].hand[0],
        game.players[0].hand[2],
      ]);
      const result = move(defusing, {
        type: "insert_bomb",
        playerId: "an",
        position,
      });
      expect(result.drawPile.map((card) => card.type)).toEqual(types);
      expect(result.phase).toEqual({ kind: "turn" });
      expect(result.turn).toEqual({
        playerId: "binh",
        remaining: 1,
        attacked: false,
      });
    },
  );

  test("Gỡ Bom dưới Attack trả một lượt, Attack tiếp chỉ chuyển 2 lượt", () => {
    let game = fixture(
      [["defuse", "attack"], ["nope"], ["skip", "favor"]],
      ["exploding_kitten", "beard_cat"],
    );
    game.turn = { playerId: "an", remaining: 2, attacked: true };
    game = move(game, { type: "draw", playerId: "an" });
    game = move(game, { type: "insert_bomb", playerId: "an", position: 1 });
    expect(game.turn).toEqual({ playerId: "an", remaining: 1, attacked: true });
    game = settle(play(game, "attack"));
    expect(game.turn).toEqual({
      playerId: "binh",
      remaining: 2,
      attacked: true,
    });
  });

  test("bom cuối làm ván kết thúc, người sống cuối thắng, không rút thêm", () => {
    const game = fixture([[], [], ["favor", "nope"]], ["exploding_kitten"]);
    game.players[1].alive = false;
    const result = move(game, { type: "draw", playerId: "an" });
    expect(result.phase).toEqual({ kind: "finished", winnerId: "chi" });
    expect(result.turn).toEqual({
      playerId: "chi",
      remaining: 0,
      attacked: false,
    });
    expect(() =>
      applyCommand(result, { type: "draw", playerId: "chi" }),
    ).toThrow("GAME_FINISHED");
  });

  test("chồng chỉ còn bom: vẫn Gỡ Bom và cài vị trí 0", () => {
    let game = fixture(
      [["defuse"], ["favor"], ["nope", "skip"]],
      ["exploding_kitten"],
    );
    game = move(game, { type: "draw", playerId: "an" });
    expect(game.drawPile).toEqual([]);
    game = move(game, { type: "insert_bomb", playerId: "an", position: 0 });
    expect(game.drawPile.map((card) => card.type)).toEqual([
      "exploding_kitten",
    ]);
    expect(game.turn.playerId).toBe("binh");
  });

  test.each([-1, 4, 0.5, NaN, Infinity])(
    "không nhận vị trí cài %s",
    (position) => {
      const game = move(
        fixture(
          [["defuse"], ["skip"], ["nope"]],
          ["exploding_kitten", "beard_cat", "favor", "skip"],
        ),
        { type: "draw", playerId: "an" },
      );
      const before = structuredClone(game);
      expect(() =>
        applyCommand(game, { type: "insert_bomb", playerId: "an", position }),
      ).toThrow("INVALID_BOMB_POSITION");
      expect(game).toEqual(before);
    },
  );
});

describe("Favor, Xem Tương Lai và Shuffle", () => {
  test("Favor chờ người cho tự chọn, không chuyển bài trước khi chốt Nope", () => {
    const game = fixture(
      [["favor"], ["defuse", "skip", "nope"], ["tacocat", "attack"]],
      ["beard_cat"],
    );
    const pending = play(game, "favor", { targetId: "binh" });
    expect(pending.players[1].hand).toEqual(game.players[1].hand);
    const choosing = settle(pending);
    expect(choosing.phase).toEqual({
      kind: "favor",
      playerId: "an",
      targetId: "binh",
    });
    expect(() =>
      applyCommand(choosing, {
        type: "give",
        playerId: "an",
        cardId: game.players[1].hand[1].id,
      }),
    ).toThrow("NOT_YOUR_CHOICE");
    const result = move(choosing, {
      type: "give",
      playerId: "binh",
      cardId: game.players[1].hand[1].id,
    });
    expect(result.players[0].hand).toEqual([game.players[1].hand[1]]);
    expect(result.players[1].hand).toEqual([
      game.players[1].hand[0],
      game.players[1].hand[2],
    ]);
    expect(result.players[2].hand).toEqual(game.players[2].hand);
    expect(result.turn).toEqual(game.turn);
    expect(result.phase).toEqual({ kind: "turn" });
  });

  test.each([0, 1, 2, 3, 4])(
    "Xem Tương Lai với chồng %i lá chỉ lộ tối đa 3 cho người dùng",
    (length) => {
      const deck: CardType[] = [
        "exploding_kitten",
        "beard_cat",
        "skip",
        "defuse",
      ];
      const game = fixture(
        [["see_future"], ["favor"], ["nope", "attack"]],
        deck.slice(0, length),
      );
      const pending = play(game, "see_future");
      expect(getFutureCards(pending, "an")).toEqual([]);
      const viewing = settle(pending);
      expect(viewing.phase).toEqual({ kind: "future", playerId: "an" });
      expect(getFutureCards(viewing, "an")).toEqual(game.drawPile.slice(0, 3));
      expect(getFutureCards(viewing, "binh")).toEqual([]);
      expect(getFutureCards(viewing, "chi")).toEqual([]);
      expect(getFutureCards(viewing, "spectator")).toEqual([]);
      expect(viewing.drawPile).toEqual(game.drawPile);
      const privateCards = getFutureCards(viewing, "an");
      if (privateCards[0]) privateCards[0].type = "favor";
      expect(viewing.drawPile).toEqual(game.drawPile);
      expect(() =>
        applyCommand(viewing, { type: "close_future", playerId: "binh" }),
      ).toThrow("NOT_YOUR_CHOICE");
      const result = move(viewing, { type: "close_future", playerId: "an" });
      expect(getFutureCards(result, "an")).toEqual([]);
      expect(result.drawPile).toEqual(game.drawPile);
      expect(result.turn).toEqual(game.turn);
    },
  );

  test("Shuffle chỉ xáo chồng sau khi chốt, với permutation không đối xứng", () => {
    const game = fixture(
      [["shuffle", "defuse"], ["favor"], ["nope", "skip", "tacocat"]],
      ["exploding_kitten", "beard_cat", "skip", "defuse"],
    );
    const pending = play(game, "shuffle");
    expect(pending.drawPile).toEqual(game.drawPile);
    const random = vi
      .fn()
      .mockReturnValueOnce(0.25)
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0);
    const result = settle(pending, random);
    expect(result.drawPile.map((card) => card.type)).toEqual([
      "defuse",
      "exploding_kitten",
      "skip",
      "beard_cat",
    ]);
    expect(random).toHaveBeenCalledTimes(3);
    expect(result.players).toEqual(pending.players);
    expect(result.turn).toEqual(game.turn);
  });
});

describe("combo cùng tên, không tác dụng riêng", () => {
  test.each([
    "tacocat",
    "attack",
    "skip",
    "favor",
    "shuffle",
    "see_future",
    "defuse",
    "nope",
  ] as const)(
    "cặp %s lấy ngẫu nhiên đúng mục tiêu, không áp tác dụng riêng",
    (type) => {
      const game = fixture(
        [
          [type, "beard_cat", type],
          ["skip", "defuse", "favor"],
          ["nope", "tacocat"],
        ],
        ["exploding_kitten", "cattermelon"],
      );
      const pending = play(game, type, { count: 2, targetId: "binh" });
      expect(pending.players[1].hand).toEqual(game.players[1].hand);
      const random = vi.fn(() => 0.75);
      const result = settle(pending, random);
      expect(result.players[0].hand).toEqual([
        game.players[0].hand[1],
        game.players[1].hand[2],
      ]);
      expect(result.players[1].hand).toEqual(game.players[1].hand.slice(0, 2));
      expect(result.players[2].hand).toEqual(game.players[2].hand);
      expect(result.discardPile).toEqual([
        game.players[0].hand[0],
        game.players[0].hand[2],
      ]);
      expect(result.drawPile).toEqual(game.drawPile);
      expect(result.turn).toEqual(game.turn);
      expect(result.phase).toEqual({ kind: "turn" });
      expect(random).toHaveBeenCalledTimes(1);
    },
  );

  test.each([
    { sample: 0, expected: "skip" },
    { sample: 0.9999, expected: "favor" },
  ] as const)(
    "cặp lấy ở biên random $sample: $expected",
    ({ sample, expected }) => {
      const game = fixture(
        [["cattermelon", "cattermelon"], ["skip", "defuse", "favor"], ["nope"]],
        ["beard_cat"],
      );
      const result = settle(
        play(game, "cattermelon", { count: 2, targetId: "binh" }),
        () => sample,
      );
      expect(result.players[0].hand.map((card) => card.type)).toEqual([
        expected,
      ]);
    },
  );

  test.each(["defuse", "nope", "rainbow_ralphing_cat"] as const)(
    "bộ ba lấy đúng loại được gọi %s, không lấy ngẫu nhiên",
    (requestedType) => {
      const game = fixture(
        [
          ["shuffle", "shuffle", "shuffle", "tacocat"],
          ["skip", requestedType, "favor", requestedType],
          ["nope"],
        ],
        ["exploding_kitten", "beard_cat", "cattermelon"],
      );
      const random = vi.fn(() => 0.99);
      const result = settle(
        play(game, "shuffle", { count: 3, targetId: "binh", requestedType }),
        random,
      );
      expect(result.players[0].hand).toEqual([
        game.players[0].hand[3],
        game.players[1].hand[1],
      ]);
      expect(result.players[1].hand).toEqual([
        game.players[1].hand[0],
        game.players[1].hand[2],
        game.players[1].hand[3],
      ]);
      expect(result.drawPile).toEqual(game.drawPile);
      expect(result.turn).toEqual(game.turn);
      expect(random).not.toHaveBeenCalled();
    },
  );

  test("bộ ba gọi loại không có thì không lấy gì, vẫn mất ba lá", () => {
    const game = fixture(
      [["attack", "attack", "attack", "skip"], ["favor", "tacocat"], ["nope"]],
      ["beard_cat"],
    );
    const result = settle(
      play(game, "attack", {
        count: 3,
        targetId: "binh",
        requestedType: "defuse",
      }),
    );
    expect(result.players[0].hand).toEqual([game.players[0].hand[3]]);
    expect(result.players[1].hand).toEqual(game.players[1].hand);
    expect(result.discardPile).toEqual(game.players[0].hand.slice(0, 3));
    expect(result.turn).toEqual(game.turn);
  });

  test.each(["favor", "pair", "triple"] as const)(
    "%s nhắm tay rỗng chốt không chuyển lá, không kẹt chờ",
    (kind) => {
      const game = fixture(
        [
          ["favor", "hairy_potato_cat", "hairy_potato_cat", "hairy_potato_cat"],
          [],
          ["nope", "skip"],
        ],
        ["beard_cat"],
      );
      const pending =
        kind === "favor"
          ? play(game, "favor", { targetId: "binh" })
          : play(game, "hairy_potato_cat", {
              count: kind === "pair" ? 2 : 3,
              targetId: "binh",
              requestedType: "defuse",
            });
      const random = vi.fn(() => 0.5);
      const result = settle(pending, random);
      expect(result.players).toEqual(pending.players);
      expect(result.phase).toEqual({ kind: "turn" });
      expect(result.turn).toEqual(game.turn);
      expect(random).not.toHaveBeenCalled();
    },
  );
});

describe("combo 5 loại đổi bài bỏ ngay, không thể Nope", () => {
  test("lấy lại bài mình đã đánh, trả cả Gỡ Bom/Nope và giữ nguyên nợ lượt", () => {
    let game = fixture(
      [
        [
          "shuffle",
          "defuse",
          "nope",
          "attack",
          "skip",
          "see_future",
          "tacocat",
        ],
        ["nope"],
        ["favor"],
      ],
      ["beard_cat", "exploding_kitten", "defuse"],
    );
    game.turn = { playerId: "an", remaining: 2, attacked: true };
    game = settle(play(game, "shuffle"), () => 0.9999);
    const costs = game.players[0].hand.slice(0, 5).reverse();
    const result = move(game, {
      type: "play",
      playerId: "an",
      cardIds: costs.map((card) => card.id),
      discardIndex: 0,
    });
    expect(result.players[0].hand).toEqual([
      game.players[0].hand[5],
      game.discardPile[0],
    ]);
    expect(result.players.slice(1)).toEqual(game.players.slice(1));
    expect(result.discardPile).toEqual(costs);
    expect(result.drawPile).toEqual(game.drawPile);
    expect(result.turn).toEqual(game.turn);
    expect(result.phase).toEqual({ kind: "turn" });
    expect(getFutureCards(result, "an")).toEqual([]);
    const before = structuredClone(result);
    expect(() =>
      applyCommand(result, {
        type: "nope",
        playerId: "binh",
        cardId: game.players[1].hand[0].id,
      }),
    ).toThrow("NO_REACTION");
    expect(() => resolveReaction(result, () => 0)).toThrow("NO_REACTION");
    expect(result).toEqual(before);
  });

  test.each(["favor", "tacocat", "exploding_kitten"] as const)(
    "lấy %s do người khác bỏ khi nổ, kể cả chính lá bom",
    (type) => {
      let game = fixture(
        [
          ["defuse", "nope", "attack", "shuffle", "see_future", "skip"],
          ["favor", "tacocat"],
          ["nope"],
        ],
        ["exploding_kitten", "beard_cat", "cattermelon"],
      );
      game.turn.playerId = "binh";
      game = move(game, { type: "draw", playerId: "binh" });
      game = move(game, { type: "draw", playerId: "chi" });
      const discardIndex = game.discardPile.findIndex(
        (card) => card.type === type,
      );
      const result = move(game, {
        type: "play",
        playerId: "an",
        cardIds: game.players[0].hand.slice(0, 5).map((card) => card.id),
        discardIndex,
      });
      expect(result.players[0].hand).toEqual([
        game.players[0].hand[5],
        game.discardPile[discardIndex],
      ]);
      expect(result.players.slice(1)).toEqual(game.players.slice(1));
      expect(result.discardPile).toEqual([
        ...game.discardPile.filter((_, index) => index !== discardIndex),
        ...game.players[0].hand.slice(0, 5),
      ]);
      expect(result.turn).toEqual(game.turn);
      expect(result.drawPile).toEqual(game.drawPile);
      expect(result.phase).toEqual({ kind: "turn" });
    },
  );

  test("phải sở hữu 5 ID duy nhất và 5 loại khác nhau, lỗi không tiêu bài", () => {
    const game = fixture(
      [
        ["attack", "skip", "nope", "defuse", "skip", "see_future"],
        ["favor"],
        ["tacocat"],
      ],
      ["beard_cat"],
    );
    game.discardPile.push(...game.drawPile.splice(0));
    const ids = game.players[0].hand.map((card) => card.id);
    for (const [cardIds, error] of [
      [ids.slice(0, 5), "COMBO_MUST_DIFFER"],
      [[ids[0], ids[1], ids[2], ids[3], ids[3]], "DUPLICATE_CARD"],
      [
        [ids[0], ids[1], ids[2], ids[3], game.players[1].hand[0].id],
        "CARD_NOT_IN_HAND",
      ],
      [[ids[0], ids[1], ids[2], ids[3], "missing"], "CARD_NOT_IN_HAND"],
    ] as [string[], string][]) {
      const before = structuredClone(game);
      expect(() =>
        applyCommand(game, {
          type: "play",
          playerId: "an",
          cardIds,
          discardIndex: 0,
        }),
      ).toThrow(error);
      expect(game).toEqual(before);
      expect(inventory(game)).toEqual(inventory(before));
    }
  });

  test.each([
    undefined,
    -1,
    0.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    2,
  ])(
    "từ chối lựa chọn bài bỏ thiếu/sai %s trước khi trả bài",
    (discardIndex) => {
      const game = fixture(
        [
          ["attack", "skip", "nope", "defuse", "see_future"],
          ["favor"],
          ["tacocat"],
        ],
        ["beard_cat", "cattermelon"],
      );
      game.discardPile.push(...game.drawPile.splice(0));
      const before = structuredClone(game);
      expect(() =>
        applyCommand(game, {
          type: "play",
          playerId: "an",
          cardIds: game.players[0].hand.map((card) => card.id),
          ...(discardIndex === undefined ? {} : { discardIndex }),
        }),
      ).toThrow(
        discardIndex === undefined
          ? "DISCARD_INDEX_REQUIRED"
          : "INVALID_DISCARD_INDEX",
      );
      expect(game).toEqual(before);
    },
  );

  test.each([0, 1])(
    "chồng có %i lá: không được chọn lá sắp trả làm mục tiêu",
    (discardCount) => {
      const game = fixture(
        [
          ["attack", "skip", "nope", "defuse", "see_future"],
          ["favor"],
          ["tacocat"],
        ],
        ["beard_cat", "cattermelon"],
      );
      game.discardPile.push(...game.drawPile.splice(0, discardCount));
      const before = structuredClone(game);
      expect(() =>
        applyCommand(game, {
          type: "play",
          playerId: "an",
          cardIds: game.players[0].hand.map((card) => card.id),
          discardIndex: discardCount,
        }),
      ).toThrow("INVALID_DISCARD_INDEX");
      expect(game).toEqual(before);
    },
  );

  test("combo 5 vẫn cần đúng lượt, còn sống và không có thao tác chờ", () => {
    const game = fixture(
      [
        ["attack", "skip", "nope", "defuse", "see_future"],
        ["favor"],
        ["tacocat"],
      ],
      ["beard_cat"],
    );
    game.discardPile.push(...game.drawPile.splice(0));
    const command: GameCommand = {
      type: "play",
      playerId: "an",
      cardIds: game.players[0].hand.map((card) => card.id),
      discardIndex: 0,
    };
    const otherTurn = structuredClone(game);
    otherTurn.turn.playerId = "binh";
    const pending = structuredClone(game);
    pending.phase = { kind: "future", playerId: "an" };
    const eliminated = structuredClone(otherTurn);
    eliminated.players[0].alive = false;
    eliminated.discardPile.push(...eliminated.players[0].hand.splice(0));
    for (const [state, error] of [
      [otherTurn, "NOT_YOUR_TURN"],
      [pending, "ACTION_PENDING"],
      [eliminated, "PLAYER_NOT_ALIVE"],
    ] as [GameState, string][]) {
      const before = structuredClone(state);
      expect(() => applyCommand(state, command)).toThrow(error);
      expect(state).toEqual(before);
    }
    for (const options of [
      { targetId: "binh" },
      { requestedType: "defuse" as const },
    ]) {
      expect(() => applyCommand(game, { ...command, ...options })).toThrow(
        "INVALID_COMMAND",
      );
    }
    expect(() =>
      applyCommand(game, { ...command, cardIds: [command.cardIds[0]] }),
    ).toThrow("INVALID_COMMAND");
  });
});

describe("Nope trước khi action bắt đầu", () => {
  test.each([0, 1, 2, 3, 4, 5])(
    "%i Nope: parity chốt Skip, bài đã đánh không quay lại",
    (count) => {
      const game = fixture(
        [["skip", "nope", "nope"], ["nope", "nope"], ["nope"]],
        ["beard_cat"],
      );
      let pending = play(game, "skip");
      for (let index = 0; index < count; index++) {
        const player =
          pending.players[index === 4 ? 2 : index % 2 === 0 ? 1 : 0];
        const card = player.hand.find((card) => card.type === "nope")!;
        pending = move(pending, {
          type: "nope",
          playerId: player.id,
          cardId: card.id,
        });
        expect(pending.turn).toEqual(game.turn);
      }
      expect(pending.phase.kind === "reaction" && pending.phase.nopeCount).toBe(
        count,
      );
      const result = settle(pending);
      expect(result.turn).toEqual({
        playerId: count % 2 ? "an" : "binh",
        remaining: 1,
        attacked: false,
      });
      expect(result.discardPile.map((card) => card.type)).toEqual([
        "skip",
        ...Array(count).fill("nope"),
      ]);
      expect(result.drawPile).toEqual(game.drawPile);
    },
  );

  test.each([1, 2, 3])(
    "không tự Nope bài vừa đánh, kể cả combo %i lá",
    (count) => {
      const game = fixture(
        [["skip", "tacocat", "tacocat", "tacocat", "nope"], ["nope"], []],
        ["beard_cat"],
      );
      const pending =
        count === 1
          ? play(game, "skip")
          : play(game, "tacocat", {
              count,
              targetId: "binh",
              requestedType: "nope",
            });
      const before = structuredClone(pending);
      expect(() =>
        applyCommand(pending, {
          type: "nope",
          playerId: "an",
          cardId: game.players[0].hand[4].id,
        }),
      ).toThrow("CANNOT_NOPE_YOURSELF");
      expect(pending).toEqual(before);
    },
  );

  test("phản Nope của người khác, không tự Nope liên tiếp, giữ qua JSON", () => {
    const game = fixture(
      [["skip", "nope", "nope"], ["nope", "nope"], ["nope"]],
      ["beard_cat"],
    );
    let pending = play(game, "skip");
    pending = move(pending, {
      type: "nope",
      playerId: "binh",
      cardId: game.players[1].hand[0].id,
    });
    pending = JSON.parse(JSON.stringify(pending)) as GameState;
    const before = structuredClone(pending);
    expect(() =>
      applyCommand(pending, {
        type: "nope",
        playerId: "binh",
        cardId: game.players[1].hand[1].id,
      }),
    ).toThrow("CANNOT_NOPE_YOURSELF");
    expect(pending).toEqual(before);
    pending = move(pending, {
      type: "nope",
      playerId: "an",
      cardId: game.players[0].hand[1].id,
    });
    expect(pending.phase).toMatchObject({
      nopeCount: 2,
      lastNopePlayerId: "an",
    });
    expect(() =>
      applyCommand(pending, {
        type: "nope",
        playerId: "an",
        cardId: game.players[0].hand[2].id,
      }),
    ).toThrow("CANNOT_NOPE_YOURSELF");
    pending = move(pending, {
      type: "nope",
      playerId: "binh",
      cardId: game.players[1].hand[1].id,
    });
    expect(settle(pending).turn).toEqual(game.turn);
    expect(pending.discardPile.map((card) => card.type)).toEqual([
      "skip",
      "nope",
      "nope",
      "nope",
    ]);
  });

  test.each([
    "attack",
    "favor",
    "shuffle",
    "see_future",
    "pair",
    "triple",
  ] as const)("Nope chặn %s; không chuyển bài, xáo hoặc xem bài", (kind) => {
    const game = fixture(
      [
        [
          "attack",
          "favor",
          "shuffle",
          "see_future",
          "defuse",
          "defuse",
          "defuse",
        ],
        ["nope", "skip"],
        ["tacocat"],
      ],
      ["exploding_kitten", "beard_cat", "cattermelon"],
    );
    let pending =
      kind === "pair" || kind === "triple"
        ? play(game, "defuse", {
            count: kind === "pair" ? 2 : 3,
            targetId: "binh",
            requestedType: "skip",
          })
        : play(game, kind, { targetId: "binh" });
    pending = move(pending, {
      type: "nope",
      playerId: "binh",
      cardId: game.players[1].hand[0].id,
    });
    const random = vi.fn(() => 0);
    const result = settle(pending, random);
    expect(result.turn).toEqual(game.turn);
    expect(result.players).toEqual(pending.players);
    expect(result.drawPile).toEqual(game.drawPile);
    expect(result.phase).toEqual({ kind: "turn" });
    expect(getFutureCards(result, "an")).toEqual([]);
    expect(random).not.toHaveBeenCalled();
    expect(() => resolveReaction(result, random)).toThrow("NO_REACTION");
  });

  test("Nope không chặn được bom/Gỡ Bom hoặc action đã bắt đầu", () => {
    const game = fixture(
      [["defuse", "favor"], ["nope", "skip"], ["tacocat"]],
      ["exploding_kitten", "beard_cat"],
    );
    const defusing = move(game, { type: "draw", playerId: "an" });
    expect(() =>
      applyCommand(defusing, {
        type: "nope",
        playerId: "binh",
        cardId: game.players[1].hand[0].id,
      }),
    ).toThrow("NO_REACTION");
    const favor = settle(play(game, "favor", { targetId: "binh" }));
    expect(() =>
      applyCommand(favor, {
        type: "nope",
        playerId: "binh",
        cardId: game.players[1].hand[0].id,
      }),
    ).toThrow("NO_REACTION");
  });
});

describe("lệnh sai không làm đổi trạng thái", () => {
  test("lượt người khác, người chết hoặc ID không có không được đánh/rút", () => {
    const game = fixture([["skip"], ["attack"], []], ["beard_cat"]);
    game.players[2].alive = false;
    for (const [command, error] of [
      [{ type: "draw", playerId: "binh" }, "NOT_YOUR_TURN"],
      [
        {
          type: "play",
          playerId: "binh",
          cardIds: [game.players[1].hand[0].id],
        },
        "NOT_YOUR_TURN",
      ],
      [{ type: "draw", playerId: "chi" }, "PLAYER_NOT_ALIVE"],
      [{ type: "draw", playerId: "unknown" }, "PLAYER_NOT_ALIVE"],
    ] as [GameCommand, string][]) {
      const before = structuredClone(game);
      expect(() => applyCommand(game, command)).toThrow(error);
      expect(game).toEqual(before);
    }
  });

  test("combo sai, target sai, lá không sở hữu và số lá không hợp lệ", () => {
    const game = fixture(
      [
        ["skip", "attack", "favor", "tacocat", "tacocat", "tacocat"],
        ["nope", "defuse"],
        [],
      ],
      ["beard_cat"],
    );
    game.players[2].alive = false;
    const ids = game.players[0].hand.map((card) => card.id);
    for (const [selection, extras, error] of [
      [[], {}, "INVALID_CARD_COUNT"],
      [ids.slice(0, 4), { targetId: "binh" }, "INVALID_CARD_COUNT"],
      [ids, { targetId: "binh" }, "INVALID_CARD_COUNT"],
      [[ids[0], ids[0]], { targetId: "binh" }, "DUPLICATE_CARD"],
      [ids.slice(0, 2), { targetId: "binh" }, "COMBO_MUST_MATCH"],
      [[game.players[1].hand[0].id], {}, "CARD_NOT_IN_HAND"],
      [[ids[2]], {}, "TARGET_REQUIRED"],
      [[ids[2]], { targetId: "an" }, "CANNOT_TARGET_SELF"],
      [[ids[2]], { targetId: "chi" }, "PLAYER_NOT_ALIVE"],
      [[ids[2]], { targetId: "missing" }, "PLAYER_NOT_ALIVE"],
      [ids.slice(3), { targetId: "binh" }, "REQUESTED_TYPE_REQUIRED"],
      [
        ids.slice(3),
        { targetId: "binh", requestedType: "constructor" as CardType },
        "REQUESTED_TYPE_REQUIRED",
      ],
    ] as [
      string[],
      { targetId?: string; requestedType?: CardType },
      string,
    ][]) {
      const before = structuredClone(game);
      expect(() =>
        applyCommand(game, {
          type: "play",
          playerId: "an",
          cardIds: selection,
          ...extras,
        }),
      ).toThrow(error);
      expect(game).toEqual(before);
    }
  });

  test.each([
    "defuse",
    "nope",
    "tacocat",
    "cattermelon",
    "hairy_potato_cat",
    "beard_cat",
    "rainbow_ralphing_cat",
  ] as const)("không đánh lá %s lẻ như action thường", (type) => {
    const game = fixture([[type], ["skip"], ["favor"]], ["beard_cat"]);
    expect(() =>
      applyCommand(game, {
        type: "play",
        playerId: "an",
        cardIds: [game.players[0].hand[0].id],
      }),
    ).toThrow("CARD_REQUIRES_COMBO_OR_SPECIAL_PHASE");
  });

  test("đang chờ reaction/favor/future/defuse không rút hoặc đánh tiếp", () => {
    const game = fixture(
      [
        ["favor", "see_future", "defuse", "skip"],
        ["nope", "attack"],
        ["tacocat"],
      ],
      ["exploding_kitten", "beard_cat"],
    );
    const reaction = play(game, "favor", { targetId: "binh" });
    const states = [
      reaction,
      settle(reaction),
      settle(play(game, "see_future")),
      move(game, { type: "draw", playerId: "an" }),
    ];
    for (const state of states) {
      const before = structuredClone(state);
      expect(() =>
        applyCommand(state, { type: "draw", playerId: "an" }),
      ).toThrow("ACTION_PENDING");
      expect(() =>
        applyCommand(state, {
          type: "play",
          playerId: "an",
          cardIds: [game.players[0].hand[3].id],
        }),
      ).toThrow("ACTION_PENDING");
      expect(state).toEqual(before);
    }
  });

  test("Nope phải sở hữu đúng lá, người bị loại không được phản ứng", () => {
    const game = fixture([["skip", "nope"], ["attack"], []], ["beard_cat"]);
    game.players[2].alive = false;
    const pending = play(game, "skip");
    expect(() =>
      applyCommand(pending, {
        type: "nope",
        playerId: "binh",
        cardId: game.players[1].hand[0].id,
      }),
    ).toThrow("NOT_A_NOPE");
    expect(() =>
      applyCommand(pending, {
        type: "nope",
        playerId: "binh",
        cardId: game.players[0].hand[1].id,
      }),
    ).toThrow("CARD_NOT_IN_HAND");
    expect(() =>
      applyCommand(pending, {
        type: "nope",
        playerId: "chi",
        cardId: "missing",
      }),
    ).toThrow("PLAYER_NOT_ALIVE");
  });

  test("chỉ chủ lựa chọn được cài bom; chỉ người cho dùng lá trong tay mình", () => {
    const game = fixture(
      [["defuse", "favor"], ["skip", "nope"], ["attack"]],
      ["exploding_kitten", "beard_cat"],
    );
    const defusing = move(game, { type: "draw", playerId: "an" });
    expect(() =>
      applyCommand(defusing, {
        type: "insert_bomb",
        playerId: "binh",
        position: 0,
      }),
    ).toThrow("NOT_YOUR_CHOICE");
    const favor = settle(play(game, "favor", { targetId: "binh" }));
    expect(() =>
      applyCommand(favor, {
        type: "give",
        playerId: "binh",
        cardId: game.players[2].hand[0].id,
      }),
    ).toThrow("CARD_NOT_IN_HAND");
  });
});

describe("bất biến và dữ liệu thuần", () => {
  test("reaction/favor/future/defuse tiếp tục được sau JSON round-trip", () => {
    const game = fixture(
      [
        ["favor", "see_future", "defuse", "skip"],
        ["nope", "attack"],
        ["tacocat"],
      ],
      ["exploding_kitten", "beard_cat"],
    );
    const reaction = play(game, "favor", { targetId: "binh" });
    const favor = settle(reaction);
    const future = settle(play(game, "see_future"));
    const defuse = move(game, { type: "draw", playerId: "an" });
    const restore = (state: GameState): GameState =>
      JSON.parse(JSON.stringify(state));
    expect(settle(restore(reaction))).toEqual(settle(reaction));
    for (const [state, command] of [
      [
        favor,
        { type: "give", playerId: "binh", cardId: game.players[1].hand[1].id },
      ],
      [future, { type: "close_future", playerId: "an" }],
      [defuse, { type: "insert_bomb", playerId: "an", position: 1 }],
    ] as [GameState, GameCommand][]) {
      expect(move(restore(state), command)).toEqual(move(state, command));
    }
    expect(getFutureCards(restore(future), "an")).toEqual(
      getFutureCards(future, "an"),
    );
  });

  test.each([3, 4, 5] as const)(
    "12 ván %i người: rút/Gỡ Bom tới thắng, không mất/trùng bất kỳ ID nào",
    (count) => {
      for (let seed = 1; seed <= 12; seed++) {
        const random = seededRandom(seed * 1877);
        let game = createGame(seats.slice(0, count), random);
        const initial = structuredClone(game);
        let commands = 0;
        while (game.phase.kind !== "finished" && commands < 100) {
          game =
            game.phase.kind === "defuse"
              ? move(game, {
                  type: "insert_bomb",
                  playerId: game.phase.playerId,
                  position: Math.floor(random() * (game.drawPile.length + 1)),
                })
              : move(game, { type: "draw", playerId: game.turn.playerId });
          expectInvariants(game, initial);
          commands++;
        }
        expect(game.phase.kind).toBe("finished");
        expect(commands).toBeLessThan(100);
        expect(inventory(game)).toHaveLength({ 3: 67, 4: 81, 5: 95 }[count]);
        expect(
          game.discardPile.filter((card) => card.type === "exploding_kitten"),
        ).toHaveLength(count - 1);
        expect(game.players.filter((player) => player.alive)).toHaveLength(1);
      }
    },
  );
});
