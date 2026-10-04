export const CARD_COUNTS = {
  exploding_kitten: 4,
  defuse: 6,
  attack: 4,
  skip: 4,
  favor: 4,
  shuffle: 4,
  see_future: 5,
  nope: 5,
  tacocat: 4,
  cattermelon: 4,
  hairy_potato_cat: 4,
  beard_cat: 4,
  rainbow_ralphing_cat: 4,
} as const;

export type CardType = keyof typeof CARD_COUNTS;
export type Card = { id: string; type: CardType };
export type Random = () => number;
export type Player = { id: string; alive: boolean; hand: Card[] };

type Action = { playerId: string } & (
  | { type: "attack" | "skip" | "shuffle" | "see_future" }
  | { type: "favor" | "pair"; targetId: string }
  | { type: "triple"; targetId: string; requestedType: CardType }
);

export type Phase =
  | { kind: "turn" }
  | {
      kind: "reaction";
      action: Action;
      nopeCount: number;
      lastNopePlayerId?: string;
    }
  | { kind: "favor"; playerId: string; targetId: string }
  | { kind: "future"; playerId: string }
  | { kind: "defuse"; playerId: string; bomb: Card }
  | { kind: "finished"; winnerId: string };

export type GameState = {
  players: Player[];
  drawPile: Card[];
  discardPile: Card[];
  removedCards: Card[];
  turn: { playerId: string; remaining: number; attacked: boolean };
  phase: Phase;
};

export type GameCommand = { playerId: string } & (
  | { type: "draw" }
  | {
      type: "play";
      cardIds: string[];
      targetId?: string;
      requestedType?: CardType;
    }
  | { type: "nope"; cardId: string }
  | { type: "give"; cardId: string }
  | { type: "close_future" }
  | { type: "insert_bomb"; position: number }
);

export function createDeck(): Card[] {
  return Object.entries(CARD_COUNTS).flatMap(([type, count]) =>
    Array.from({ length: count }, (_, index) => ({
      id: `${type}-${index + 1}`,
      type: type as CardType,
    })),
  );
}

function shuffle(cards: Card[], random: Random): void {
  for (let index = cards.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }
}

export function createGame(playerIds: string[], random: Random): GameState {
  if (![3, 4, 5].includes(playerIds.length)) {
    throw new Error("INVALID_PLAYER_COUNT");
  }
  if (
    new Set(playerIds).size !== playerIds.length ||
    playerIds.some((id) => id.length === 0)
  ) {
    throw new Error("INVALID_PLAYER_IDS");
  }

  const deck = createDeck();
  const bombs = deck.filter((card) => card.type === "exploding_kitten");
  const defuses = deck.filter((card) => card.type === "defuse");
  const drawPile = deck.filter(
    (card) => card.type !== "exploding_kitten" && card.type !== "defuse",
  );
  const players = playerIds.map((id, index) => ({
    id,
    alive: true,
    hand: [defuses[index]],
  }));
  const extras = defuses.slice(players.length);
  const returnedDefuses = players.length === 3 ? extras.slice(0, 2) : extras;

  // Luật 2022 bước 3–4: Gỡ Bom dư có thể nằm trong 7 lá được chia thêm.
  drawPile.push(...returnedDefuses);
  shuffle(drawPile, random);
  for (const player of players) player.hand.push(...drawPile.splice(0, 7));
  drawPile.push(...bombs.slice(0, players.length - 1));
  shuffle(drawPile, random);

  return {
    players,
    drawPile,
    discardPile: [],
    removedCards: [
      ...bombs.slice(players.length - 1),
      ...extras.slice(returnedDefuses.length),
    ],
    turn: {
      playerId: players[Math.floor(random() * players.length)].id,
      remaining: 1,
      attacked: false,
    },
    phase: { kind: "turn" },
  };
}

function livingPlayer(state: GameState, playerId: string): Player {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player?.alive) throw new Error("PLAYER_NOT_ALIVE");
  return player;
}

function nextPlayer(state: GameState): Player {
  const seat = state.players.findIndex(
    (player) => player.id === state.turn.playerId,
  );
  for (let offset = 1; offset <= state.players.length; offset++) {
    const player = state.players[(seat + offset) % state.players.length];
    if (player.alive) return player;
  }
  throw new Error("NO_LIVING_PLAYER");
}

function advanceTurn(state: GameState): void {
  state.turn = {
    playerId: nextPlayer(state).id,
    remaining: 1,
    attacked: false,
  };
}

function finishTurn(state: GameState): void {
  if (state.turn.remaining > 1) state.turn.remaining--;
  else advanceTurn(state);
}

function requireTurn(state: GameState, playerId: string): void {
  if (state.phase.kind !== "turn") throw new Error("ACTION_PENDING");
  if (state.turn.playerId !== playerId) throw new Error("NOT_YOUR_TURN");
}

function takeCard(player: Player, cardId: string): Card {
  const index = player.hand.findIndex((card) => card.id === cardId);
  if (index < 0) throw new Error("CARD_NOT_IN_HAND");
  return player.hand.splice(index, 1)[0];
}

function prepareAction(
  state: GameState,
  command: Extract<GameCommand, { type: "play" }>,
): Action {
  const player = livingPlayer(state, command.playerId);
  if (![1, 2, 3].includes(command.cardIds.length)) {
    throw new Error("INVALID_CARD_COUNT");
  }
  if (new Set(command.cardIds).size !== command.cardIds.length) {
    throw new Error("DUPLICATE_CARD");
  }
  const cards = command.cardIds.map((id) => {
    const card = player.hand.find((candidate) => candidate.id === id);
    if (!card) throw new Error("CARD_NOT_IN_HAND");
    return card;
  });
  const type = cards[0].type;
  if (cards.some((card) => card.type !== type)) {
    throw new Error("COMBO_MUST_MATCH");
  }

  if (cards.length > 1 || type === "favor") {
    if (!command.targetId) throw new Error("TARGET_REQUIRED");
    const target = livingPlayer(state, command.targetId);
    if (target.id === player.id) throw new Error("CANNOT_TARGET_SELF");
    if (cards.length === 3) {
      if (
        !command.requestedType ||
        !Object.hasOwn(CARD_COUNTS, command.requestedType)
      ) {
        throw new Error("REQUESTED_TYPE_REQUIRED");
      }
      return {
        type: "triple",
        playerId: player.id,
        targetId: target.id,
        requestedType: command.requestedType,
      };
    }
    return {
      type: cards.length === 2 ? "pair" : "favor",
      playerId: player.id,
      targetId: target.id,
    };
  }

  switch (type) {
    case "attack":
    case "skip":
    case "shuffle":
    case "see_future":
      return { type, playerId: player.id };
    default:
      throw new Error("CARD_REQUIRES_COMBO_OR_SPECIAL_PHASE");
  }
}

export function applyCommand(game: GameState, command: GameCommand): GameState {
  if (game.phase.kind === "finished") throw new Error("GAME_FINISHED");
  const state = structuredClone(game);
  const player = livingPlayer(state, command.playerId);

  switch (command.type) {
    case "play": {
      requireTurn(state, player.id);
      const action = prepareAction(state, command);
      for (const cardId of command.cardIds) {
        state.discardPile.push(takeCard(player, cardId));
      }
      state.phase = { kind: "reaction", action, nopeCount: 0 };
      break;
    }
    case "nope": {
      if (state.phase.kind !== "reaction") throw new Error("NO_REACTION");
      const card = player.hand.find((card) => card.id === command.cardId);
      if (!card) throw new Error("CARD_NOT_IN_HAND");
      if (card.type !== "nope") throw new Error("NOT_A_NOPE");
      const lastPlayerId =
        state.phase.nopeCount === 0
          ? state.phase.action.playerId
          : state.phase.lastNopePlayerId;
      if (lastPlayerId === player.id) throw new Error("CANNOT_NOPE_YOURSELF");
      state.discardPile.push(takeCard(player, card.id));
      state.phase.nopeCount++;
      state.phase.lastNopePlayerId = player.id;
      break;
    }
    case "draw": {
      requireTurn(state, player.id);
      const card = state.drawPile.shift();
      if (!card) throw new Error("DRAW_PILE_EMPTY");
      if (card.type !== "exploding_kitten") {
        player.hand.push(card);
        finishTurn(state);
        break;
      }
      const defuse = player.hand.find((card) => card.type === "defuse");
      if (defuse) {
        state.discardPile.push(takeCard(player, defuse.id));
        state.phase = { kind: "defuse", playerId: player.id, bomb: card };
      } else {
        state.discardPile.push(...player.hand, card);
        player.hand = [];
        player.alive = false;
        const survivors = state.players.filter((candidate) => candidate.alive);
        if (survivors.length === 1) {
          const winnerId = survivors[0].id;
          state.phase = { kind: "finished", winnerId };
          state.turn = { playerId: winnerId, remaining: 0, attacked: false };
        } else {
          advanceTurn(state);
        }
      }
      break;
    }
    case "insert_bomb": {
      if (state.phase.kind !== "defuse") throw new Error("NO_BOMB_TO_INSERT");
      if (state.phase.playerId !== player.id)
        throw new Error("NOT_YOUR_CHOICE");
      if (
        !Number.isInteger(command.position) ||
        command.position < 0 ||
        command.position > state.drawPile.length
      ) {
        throw new Error("INVALID_BOMB_POSITION");
      }
      state.drawPile.splice(command.position, 0, state.phase.bomb);
      state.phase = { kind: "turn" };
      finishTurn(state);
      break;
    }
    case "give": {
      if (state.phase.kind !== "favor") throw new Error("NO_FAVOR");
      if (state.phase.targetId !== player.id)
        throw new Error("NOT_YOUR_CHOICE");
      const recipient = livingPlayer(state, state.phase.playerId);
      recipient.hand.push(takeCard(player, command.cardId));
      state.phase = { kind: "turn" };
      break;
    }
    case "close_future": {
      if (state.phase.kind !== "future") throw new Error("NO_FUTURE");
      if (state.phase.playerId !== player.id)
        throw new Error("NOT_YOUR_CHOICE");
      state.phase = { kind: "turn" };
      break;
    }
  }
  return state;
}

export function resolveReaction(game: GameState, random: Random): GameState {
  if (game.phase.kind !== "reaction") throw new Error("NO_REACTION");
  const state = structuredClone(game);
  const { action, nopeCount } = game.phase;
  state.phase = { kind: "turn" };
  if (nopeCount % 2 === 1) return state;

  const player = livingPlayer(state, action.playerId);
  switch (action.type) {
    case "attack": {
      const remaining = state.turn.attacked ? state.turn.remaining + 2 : 2;
      state.turn = {
        playerId: nextPlayer(state).id,
        remaining,
        attacked: true,
      };
      break;
    }
    case "skip":
      finishTurn(state);
      break;
    case "shuffle":
      shuffle(state.drawPile, random);
      break;
    case "see_future":
      state.phase = { kind: "future", playerId: player.id };
      break;
    case "favor": {
      const target = livingPlayer(state, action.targetId);
      if (target.hand.length > 0) {
        state.phase = {
          kind: "favor",
          playerId: player.id,
          targetId: target.id,
        };
      }
      break;
    }
    case "pair": {
      const target = livingPlayer(state, action.targetId);
      if (target.hand.length > 0) {
        const index = Math.floor(random() * target.hand.length);
        player.hand.push(takeCard(target, target.hand[index].id));
      }
      break;
    }
    case "triple": {
      const target = livingPlayer(state, action.targetId);
      const card = target.hand.find(
        (card) => card.type === action.requestedType,
      );
      if (card) player.hand.push(takeCard(target, card.id));
      break;
    }
  }
  return state;
}

export function getFutureCards(game: GameState, playerId: string): Card[] {
  if (game.phase.kind !== "future" || game.phase.playerId !== playerId) {
    return [];
  }
  return game.drawPile.slice(0, 3).map((card) => ({ ...card }));
}
