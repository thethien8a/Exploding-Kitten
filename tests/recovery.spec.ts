import {
  test,
  expect,
  type Page,
  type Browser,
  type BrowserContext,
  type APIRequestContext,
} from "@playwright/test";
import { preview, type PreviewServer } from "vite";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Room, type RoomState } from "../worker/room";
import {
  CARD_NAMES,
  ROOM_TTL_MS,
  CONNECTION_TIMEOUT_MS,
  type ClientCommand,
  type CommandResult,
  type RoomAction,
  type RoomMessage,
  type RoomSnapshot,
  type Session,
} from "../shared/protocol";
import type { CardType } from "../shared/engine";

const origin = "http://127.0.0.1:8788";
let server: PreviewServer | undefined;
let statePath: string;
type Wire = {
  socket: WebSocket;
  latest: RoomSnapshot;
  messages: RoomMessage[];
  commands: ClientCommand[];
  dropNextResult: boolean;
  droppedAck: CommandResult | null;
};
type TestWindow = Window & { wire: Wire };
type PendingPhase = "turn" | "reaction" | "favor" | "future" | "defuse";

async function start() {
  server = await preview({
    clearScreen: false,
    preview: { host: "127.0.0.1", port: 8788, strictPort: true },
  });
}
async function stop() {
  await server?.close();
  server = undefined;
}
test.beforeEach(async () => {
  await mkdir(resolve(".amp/in"), { recursive: true });
  statePath = await mkdtemp(resolve(".amp/in/phase-3-state-"));
  process.env.MEONO_STATE_PATH = statePath;
  await start();
});
test.afterEach(async () => {
  await stop();
  await rm(statePath, { recursive: true, force: true });
  delete process.env.MEONO_STATE_PATH;
});

async function databasePath(roomId: string) {
  expect(server).toBeUndefined();
  for (const file of await readdir(statePath, { recursive: true })) {
    if (!file.endsWith(".sqlite")) continue;
    const path = resolve(statePath, file);
    const database = new DatabaseSync(path, { readOnly: true });
    try {
      const table = database
        .prepare(
          "SELECT name FROM sqlite_master WHERE name = 'multiplayer_state'",
        )
        .get();
      if (!table) continue;
      const saved = database
        .prepare("SELECT snapshot FROM multiplayer_state WHERE id = 1")
        .get();
      if (
        saved &&
        (JSON.parse(saved.snapshot as string) as RoomState).roomId === roomId
      )
        return path;
    } finally {
      database.close();
    }
  }
  throw new Error("Missing durable snapshot");
}
async function readStored(roomId: string) {
  const database = new DatabaseSync(await databasePath(roomId), {
    readOnly: true,
  });
  try {
    const saved = database
      .prepare("SELECT snapshot FROM multiplayer_state WHERE id = 1")
      .get()!;
    return JSON.parse(saved.snapshot as string) as RoomState;
  } finally {
    database.close();
  }
}
async function writeStored(state: RoomState) {
  const database = new DatabaseSync(await databasePath(state.roomId));
  try {
    database
      .prepare("UPDATE multiplayer_state SET snapshot = ? WHERE id = 1")
      .run(JSON.stringify(state));
  } finally {
    database.close();
  }
}
function coreCommand(room: Room, playerId: string, action: RoomAction) {
  const result = room.process(
    playerId,
    {
      type: "command",
      id: crypto.randomUUID(),
      version: room.state.version,
      action,
    },
    Date.now(),
    () => 0.271,
  );
  expect(result.ok).toBe(true);
}
function ensureCard(room: Room, type: CardType) {
  const game = room.state.game!;
  const hand = game.players[0].hand;
  const owned = hand.find((card) => card.type === type);
  if (owned) return owned.id;
  for (const pile of [
    game.drawPile,
    ...game.players.slice(1).map((player) => player.hand),
  ]) {
    const index = pile.findIndex((card) => card.type === type);
    if (index < 0) continue;
    [hand[0], pile[index]] = [pile[index], hand[0]];
    return hand[0].id;
  }
  throw new Error("Missing fixture card");
}
async function prepare(
  request: APIRequestContext,
  phase: PendingPhase | "shuffle",
) {
  const created = await request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: "Thảo", capacity: 3 },
  });
  expect(created.status()).toBe(201);
  const sessions = [(await created.json()) as Session];
  for (const name of ["Minh", "An"]) {
    const joined = await request.post(
      "/api/rooms/" + sessions[0].roomId + "/join",
      { headers: { Origin: origin }, data: { name } },
    );
    expect(joined.status()).toBe(201);
    sessions.push((await joined.json()) as Session);
  }
  await stop();
  const room = new Room(await readStored(sessions[0].roomId));
  for (const session of sessions) {
    room.connect(session.playerId, "fixture-" + session.playerId);
    coreCommand(room, session.playerId, { type: "ready", ready: true });
  }
  coreCommand(room, sessions[0].playerId, { type: "start" });
  room.state.game!.turn = {
    playerId: sessions[0].playerId,
    remaining: 3,
    attacked: true,
  };
  if (
    phase === "reaction" ||
    phase === "favor" ||
    phase === "future" ||
    phase === "shuffle"
  ) {
    const type = {
      reaction: "skip",
      favor: "favor",
      future: "see_future",
      shuffle: "shuffle",
    }[phase] as CardType;
    coreCommand(room, sessions[0].playerId, {
      type: "play",
      cardIds: [ensureCard(room, type)],
      ...(phase === "favor" ? { targetId: sessions[1].playerId } : {}),
    });
    if (phase === "favor" || phase === "future")
      for (const session of sessions)
        coreCommand(room, session.playerId, { type: "pass" });
  } else if (phase === "defuse") {
    const pile = room.state.game!.drawPile;
    const bomb = pile.findIndex((card) => card.type === "exploding_kitten");
    [pile[0], pile[bomb]] = [pile[bomb], pile[0]];
    coreCommand(room, sessions[0].playerId, { type: "draw" });
  }
  for (const member of room.state.members)
    room.disconnect(member.id, member.connectionId!);
  expect(room.state.game!.phase.kind).toBe(
    phase === "shuffle" ? "reaction" : phase,
  );
  expect(room.state.pause).not.toBeNull();
  await writeStored(room.state);
  return { sessions, saved: structuredClone(room.state) };
}
async function observe(context: BrowserContext) {
  await context.addInitScript(() => {
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        const wire = {
          socket: this,
          latest: null as RoomSnapshot | null,
          messages: [] as RoomMessage[],
          commands: [] as ClientCommand[],
          dropNextResult: false,
          droppedAck: null as CommandResult | null,
        };
        Object.assign(window, { wire });
        this.addEventListener(
          "message",
          (event) => {
            const message = JSON.parse(String(event.data)) as RoomMessage;
            if (wire.dropNextResult && message.type === "result") {
              wire.dropNextResult = false;
              wire.droppedAck = message;
              event.stopImmediatePropagation();
              this.close();
              return;
            }
            wire.messages.push(message);
            if (message.type === "snapshot") wire.latest = message;
          },
          true,
        );
      }
      override send(data: Parameters<WebSocket["send"]>[0]) {
        if (typeof data === "string") {
          const message = JSON.parse(data) as ClientCommand;
          if (message.type === "command")
            (window as unknown as TestWindow).wire.commands.push(message);
        }
        super.send(data);
      }
    };
  });
}
async function view(page: Page) {
  return page.evaluate(() => (window as unknown as TestWindow).wire.latest);
}
async function openSession(page: Page, session: Session) {
  await page.addInitScript(
    (session) =>
      localStorage.setItem("meono:" + session.roomId, JSON.stringify(session)),
    session,
  );
  await page.goto("/?room=" + session.roomId);
  await expect(
    page.getByRole("status", { name: "Trạng thái kết nối" }),
  ).toHaveText("Đã kết nối");
}
async function group(browser: Browser, sessions: Session[]) {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  for (const [index, session] of sessions.entries()) {
    const context = await browser.newContext({
      viewport:
        index === 1
          ? { width: 390, height: 844 }
          : { width: 1280, height: 900 },
    });
    contexts.push(context);
    await observe(context);
    const page = await context.newPage();
    pages.push(page);
    await openSession(page, session);
  }
  return { contexts, pages };
}
async function resumed(pages: Page[], minimumVersion = 0) {
  for (const page of pages) {
    await expect(
      page.getByRole("status", { name: "Trạng thái kết nối" }),
    ).toHaveText("Đã kết nối");
    await expect
      .poll(async () =>
        page.evaluate((minimumVersion) => {
          const wire = (window as unknown as TestWindow).wire;
          return (
            wire.socket.readyState === WebSocket.OPEN &&
            wire.latest &&
            wire.latest.version >= minimumVersion &&
            wire.latest.pause === null &&
            wire.latest.members.every((member) => member.connected)
          );
        }, minimumVersion),
      )
      .toBe(true);
  }
}
async function command(
  page: Page,
  action: RoomAction,
  override: Partial<Pick<ClientCommand, "id" | "version">> = {},
) {
  const result = await page.evaluate(
    ({ action, override }) =>
      new Promise<CommandResult>((resolveResult, reject) => {
        const wire = (window as unknown as TestWindow).wire;
        const command: ClientCommand = {
          type: "command",
          id: crypto.randomUUID(),
          version: wire.latest.version,
          action,
          ...override,
        };
        const receive = (event: MessageEvent<string>) => {
          const message = JSON.parse(event.data) as RoomMessage;
          if (message.type === "result" && message.id === command.id) {
            wire.socket.removeEventListener("message", receive);
            resolveResult(message);
          } else if (message.type === "error") {
            wire.socket.removeEventListener("message", receive);
            reject(new Error(message.code));
          }
        };
        wire.socket.addEventListener("message", receive);
        wire.socket.send(JSON.stringify(command));
      }),
    { action, override },
  );
  if (action.type !== "leave" || !result.ok)
    await expect
      .poll(async () => (await view(page)).version)
      .toBeGreaterThanOrEqual(result.version);
  return result;
}

for (const drawsBomb of [false, true]) {
  test(
    "rút bài xóa lựa chọn khi " +
      (drawsBomb ? "gặp bom cần gỡ" : "vẫn còn lượt nợ"),
    async ({ browser, request }, testInfo) => {
      const { sessions, saved } = await prepare(request, "turn");
      const pile = saved.game!.drawPile;
      const top = pile.findIndex(
        (card) => (card.type === "exploding_kitten") === drawsBomb,
      );
      expect(top).toBeGreaterThanOrEqual(0);
      [pile[0], pile[top]] = [pile[top], pile[0]];
      await writeStored(saved);
      await start();
      const { contexts, pages } = await group(browser, sessions);
      try {
        await resumed(pages);
        const actor = pages[0];
        const cards = actor.locator('.hand .card:not([data-type="defuse"])');
        await cards.nth(0).click();
        await cards.nth(1).click();
        await actor
          .getByLabel("Mục tiêu (Xin Bài / combo)")
          .selectOption(sessions[1].playerId);
        await expect(
          actor.locator('.hand .card[aria-pressed="true"]'),
        ).toHaveCount(2);
        await expect(actor.locator(".hand .card.selected")).toHaveCount(2);
        await actor.screenshot({
          path: testInfo.outputPath("draw-selected-before.png"),
          fullPage: true,
        });
        await actor
          .getByRole("button", { name: "Rút bài", exact: true })
          .click();
        await expect
          .poll(async () => (await view(actor)).game!.drawCount)
          .toBe(pile.length - 1);
        expect((await view(actor)).game!.turn.playerId).toBe(
          sessions[0].playerId,
        );
        expect((await view(actor)).game!.phase.kind).toBe(
          drawsBomb ? "defuse" : "turn",
        );
        expect((await view(actor)).game!.turn.remaining).toBe(
          drawsBomb ? 3 : 2,
        );
        for (const page of pages) {
          const banner = page.getByRole("alert", { name: "Trạng thái Mèo Nổ" });
          if (drawsBomb) {
            await expect(banner).toContainText("Thảo rút trúng Mèo Nổ!");
            await expect(
              page.locator('[data-player-id="' + sessions[0].playerId + '"]'),
            ).toContainText("Đang gỡ bom");
            expect((await view(page)).lastBomb?.outcome).toBe("defusing");
          } else await expect(banner).toHaveCount(0);
        }
        if (drawsBomb) {
          for (const page of [pages[1], pages[2]])
            await expect(
              page.getByRole("region", { name: "Cài bom kín" }),
            ).toHaveCount(0);
          await pages[1].screenshot({
            path: testInfo.outputPath("bomb-defusing-observer-mobile.png"),
            fullPage: true,
            animations: "disabled",
          });
        }
        await expect(
          actor.locator('.hand .card[aria-pressed="true"]'),
        ).toHaveCount(0);
        await expect(actor.locator(".hand .card.selected")).toHaveCount(0);
        await expect(actor.locator(".card-help")).toHaveCount(0);
        await expect(
          actor.getByLabel("Mục tiêu (Xin Bài / combo)"),
        ).toHaveCount(0);
        await actor.screenshot({
          path: testInfo.outputPath("draw-selected-after.png"),
          fullPage: true,
        });
        if (!drawsBomb) {
          await cards.nth(0).click();
          await expect(
            actor.getByRole("button", { name: "Đánh 1 lá đã chọn" }),
          ).toBeEnabled();
          await expect(
            actor.locator('.hand .card[aria-pressed="true"]'),
          ).toHaveCount(1);
        }
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    },
  );
}

for (const finishes of [false, true]) {
  test(
    "Mèo Nổ công khai khi bị loại" + (finishes ? " và kết thúc ván" : ""),
    async ({ browser, request }, testInfo) => {
      const { sessions, saved } = await prepare(request, "turn");
      const game = saved.game!;
      const actor = game.players[0];
      game.discardPile.push(
        ...actor.hand.filter((card) => card.type === "defuse"),
      );
      actor.hand = actor.hand.filter((card) => card.type !== "defuse");
      const bombIndex = game.drawPile.findIndex(
        (card) => card.type === "exploding_kitten",
      );
      [game.drawPile[0], game.drawPile[bombIndex]] = [
        game.drawPile[bombIndex],
        game.drawPile[0],
      ];
      const bombId = game.drawPile[0].id;
      if (finishes) {
        game.players[2].alive = false;
        game.discardPile.push(...game.players[2].hand.splice(0));
        const otherBomb = game.drawPile.findIndex(
          (card, index) => index > 0 && card.type === "exploding_kitten",
        );
        game.discardPile.push(...game.drawPile.splice(otherBomb, 1));
      }
      await writeStored(saved);
      await start();
      const { contexts, pages } = await group(browser, sessions);
      try {
        await resumed(pages);
        await pages[0]
          .getByRole("button", { name: "Rút bài", exact: true })
          .click();
        const drawCommand = await pages[0].evaluate(() =>
          (window as unknown as TestWindow).wire.commands.at(-1)!,
        );
        for (const page of pages) {
          await expect(
            page.getByRole("alert", { name: "Trạng thái Mèo Nổ" }),
          ).toContainText("Thảo đã nổ và bị loại!");
          const eliminatedSeat = page.locator(
            '[data-player-id="' + sessions[0].playerId + '"]',
          );
          await expect(eliminatedSeat).toContainText("Đã nổ · Bị loại");
          await expect(eliminatedSeat).toHaveCSS(
            "background-color",
            "rgb(36, 36, 36)",
          );
          await expect(eliminatedSeat).toHaveCSS("box-shadow", "none");
          await expect(eliminatedSeat.locator(".player-avatar")).toHaveCSS(
            "background-color",
            "rgb(56, 56, 56)",
          );
          await expect(eliminatedSeat.locator("strong")).toHaveCSS(
            "color",
            "rgb(194, 194, 194)",
          );
          await expect(eliminatedSeat.locator("small")).toHaveCSS(
            "color",
            "rgb(164, 164, 164)",
          );
          const survivorSeat = page.locator(
            '[data-player-id="' + sessions[1].playerId + '"]',
          );
          await expect(page.locator(".player-seat.is-winner")).toHaveCount(
            finishes ? 1 : 0,
          );
          await expect(
            page.getByRole("img", { name: "Vương miện người thắng" }),
          ).toHaveCount(finishes ? 1 : 0);
          if (finishes) {
            await expect(survivorSeat).toHaveClass(/is-winner/);
            await expect(survivorSeat).toHaveCSS(
              "background-color",
              "rgb(255, 243, 203)",
            );
            await expect(survivorSeat.locator(".player-avatar")).toHaveCSS(
              "background-color",
              "rgb(232, 199, 95)",
            );
            await expect(survivorSeat.locator(".winner-tag")).toHaveText(
              "Người thắng",
            );
            await expect(
              survivorSeat.getByRole("img", { name: "Vương miện người thắng" }),
            ).toBeVisible();
          } else {
            await expect(survivorSeat).toHaveCSS(
              "background-color",
              "rgb(255, 253, 247)",
            );
          }
          await expect(
            page.getByRole("region", { name: "Cài bom kín" }),
          ).toHaveCount(0);
          const snapshot = await view(page);
          expect(snapshot.lastBomb).toEqual({
            id: drawCommand.version + 1,
            playerId: sessions[0].playerId,
            outcome: "exploded",
          });
          expect(snapshot.game!.phase.kind).toBe(
            finishes ? "finished" : "turn",
          );
          expect(JSON.stringify(snapshot)).not.toContain('"' + bombId + '"');
        }
        expect((await view(pages[0])).game!.hand).toEqual([]);
        await expect(
          pages[0].getByRole("button", { name: "Rút bài", exact: true }),
        ).toBeDisabled();
        if (finishes)
          await expect(pages[1].locator(".table-turn")).toContainText(
            "Người thắng: Minh",
          );
        const before = await view(pages[0]);
        const publicView = (await (
          await request.get("/api/rooms/" + saved.roomId)
        ).json()) as RoomSnapshot;
        expect(publicView.lastBomb).toEqual(before.lastBomb);
        expect(JSON.stringify(publicView)).not.toContain('"' + bombId + '"');
        await stop();
        expect((await readStored(saved.roomId)).lastBomb).toEqual(
          before.lastBomb,
        );
        await start();
        await resumed(pages, before.version + 1);
        for (const page of pages) {
          expect((await view(page)).lastBomb).toEqual(before.lastBomb);
          await expect(
            page.getByRole("alert", { name: "Trạng thái Mèo Nổ" }),
          ).toContainText("Thảo đã nổ và bị loại!");
          await expect(page.locator(".player-seat.is-winner")).toHaveCount(
            finishes ? 1 : 0,
          );
          await expect(
            page.getByRole("img", { name: "Vương miện người thắng" }),
          ).toHaveCount(finishes ? 1 : 0);
        }
        await pages[0].screenshot({
          path: testInfo.outputPath("bomb-exploded-desktop.png"),
          fullPage: true,
          animations: "disabled",
        });
        for (const width of [390, 320]) {
          await pages[1].setViewportSize({ width, height: 844 });
          expect(
            await pages[1].evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await expect(
            pages[1].locator('[data-player-id="' + sessions[0].playerId + '"]'),
          ).toHaveCSS("background-color", "rgb(36, 36, 36)");
          if (finishes) {
            const crown = pages[1].getByRole("img", {
              name: "Vương miện người thắng",
            });
            await expect(crown).toBeInViewport();
            const overlapsAnnouncement = await crown.evaluate((crown) => {
              const icon = crown.getBoundingClientRect();
              const announcement = document
                .querySelector(".play-announcement")!
                .getBoundingClientRect();
              return (
                icon.left < announcement.right &&
                icon.right > announcement.left &&
                icon.top < announcement.bottom &&
                icon.bottom > announcement.top
              );
            });
            expect(overlapsAnnouncement).toBe(false);
          }
          await pages[1].screenshot({
            path: testInfo.outputPath("bomb-exploded-mobile-" + width + ".png"),
            fullPage: true,
            animations: "disabled",
          });
        }
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    },
  );
}

for (const phase of ["turn", "favor", "future", "defuse"] as const) {
  test(
    "restart runtime giữ " + phase + ", bài riêng và lượt nợ",
    async ({ browser, request }, testInfo) => {
      const { sessions, saved } = await prepare(request, phase);
      const given = saved.game!.players[1].hand[1];
      await start();
      const { contexts, pages } = await group(browser, sessions);
      try {
        await resumed(pages);
        const before = await Promise.all(pages.map(view));
        const origins = await Promise.all(
          pages.map((page) => page.evaluate(() => performance.timeOrigin)),
        );
        expect(before[0].game!.turn.remaining).toBe(3);
        expect(before[0].game!.phase.kind).toBe(phase);
        if (phase === "favor") {
          await expect(
            pages[1].getByRole("alert", { name: "Bạn đang bị nhắm tới" }),
          ).toContainText("Thảo đang xin bạn một lá bài");
          for (const page of [pages[0], pages[2]])
            await expect(
              page.getByRole("alert", { name: "Bạn đang bị nhắm tới" }),
            ).toHaveCount(0);
          await pages[1]
            .locator('.hand .card[data-card-id="' + given.id + '"]')
            .click();
          expect(
            await pages[1].evaluate(
              () => (window as unknown as TestWindow).wire.commands,
            ),
          ).toEqual([]);
          expect((await view(pages[1])).game!.hand).toEqual(
            before[1].game!.hand,
          );
        }
        if (phase === "defuse") {
          await pages[0]
            .getByRole("button", { name: "Ngẫu nhiên", exact: true })
            .click();
          for (const page of pages)
            await expect(
              page.getByRole("alert", { name: "Trạng thái Mèo Nổ" }),
            ).toContainText("Thảo rút trúng Mèo Nổ!");
        }
        await stop();
        const durable = await readStored(saved.roomId);
        expect(durable.schemaVersion).toBe(1);
        expect(durable.gameId).toBe(saved.gameId);
        expect(durable.game).toEqual(saved.game);
        expect(durable.lastPlay).toEqual(saved.lastPlay);
        expect(durable.lastBomb).toEqual(saved.lastBomb);
        await start();
        await resumed(pages, before[0].version + 1);
        for (const [index, page] of pages.entries()) {
          const after = await view(page);
          expect(after.gameId).toBe(saved.gameId);
          expect(after.game).toEqual(before[index].game);
          expect(after.lastPlay).toEqual(before[index].lastPlay);
          expect(after.lastBomb).toEqual(before[index].lastBomb);
          if (phase === "favor")
            await expect(page.getByTestId("last-play")).toHaveText(
              "Thảo vừa đánh Xin Bài nhắm vào Minh",
            );
          await expect(page.locator(".card-arriving")).toHaveCount(0);
          expect(await page.evaluate(() => performance.timeOrigin)).toBe(
            origins[index],
          );
          expect(JSON.stringify(after)).not.toMatch(
            /tokenHash|drawPile|removedCards|receipts|connectionId|bomb-/,
          );
        }
        if (phase === "defuse") {
          await expect(
            pages[0].getByRole("button", { name: "Ngẫu nhiên", exact: true }),
          ).toHaveAttribute("aria-pressed", "true");
          for (const page of pages)
            await expect(
              page.getByRole("alert", { name: "Trạng thái Mèo Nổ" }),
            ).toContainText("Thảo rút trúng Mèo Nổ!");
          for (const page of [pages[1], pages[2]])
            await expect(
              page.getByRole("region", { name: "Cài bom kín" }),
            ).toHaveCount(0);
          for (const width of [1280, 390, 320]) {
            await pages[0].setViewportSize({ width, height: 900 });
            expect(
              await pages[0].evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            await pages[0].screenshot({
              path: testInfo.outputPath("bomb-random-" + width + ".png"),
              fullPage: true,
              animations: "disabled",
            });
          }
        }
        if (phase === "future" || phase === "defuse")
          await pages[0].screenshot({
            path: testInfo.outputPath("phase-3-restored-" + phase + ".png"),
            fullPage: true,
          });
        if (phase === "favor") {
          await expect(
            pages[1].locator('.hand .card[aria-pressed="true"]'),
          ).toHaveCount(1);
          await expect(
            pages[1].locator('.hand .card[data-card-id="' + given.id + '"]'),
          ).toHaveAttribute("aria-pressed", "true");
          await pages[1].screenshot({
            path: testInfo.outputPath("target-favor-mobile.png"),
            fullPage: true,
            animations: "disabled",
          });
          await pages[1].setViewportSize({ width: 1280, height: 900 });
          await pages[1].screenshot({
            path: testInfo.outputPath("favor-confirmation-desktop.png"),
            fullPage: true,
            animations: "disabled",
          });
          await pages[1].setViewportSize({ width: 390, height: 844 });
        }
        if (phase === "turn") {
          expect((await command(pages[0], { type: "draw" })).ok).toBe(true);
          await expect
            .poll(async () => (await view(pages[0])).game!.hand.at(-1)?.id)
            .toBe(saved.game!.drawPile[0].id);
          expect((await view(pages[0])).game!.turn.remaining).toBe(2);
        } else if (phase === "future") {
          expect(before[0].game!.futureCards.map((card) => card.id)).toEqual(
            saved.game!.drawPile.slice(0, 3).map((card) => card.id),
          );
          expect(before[1].game!.futureCards).toEqual([]);
          expect((await command(pages[0], { type: "close_future" })).ok).toBe(
            true,
          );
          await expect
            .poll(async () => (await view(pages[0])).game!.futureCards.length)
            .toBe(0);
        } else if (phase === "favor") {
          const confirm = pages[1].getByRole("button", {
            name: /^Xác nhận đưa/,
          });
          await expect(confirm).toHaveText("Xác nhận");
          await expect(confirm).toHaveAccessibleName(
            "Xác nhận đưa " + CARD_NAMES[given.type] + " cho Thảo",
          );
          await expect(
            pages[1].getByRole("region", { name: "Xác nhận cho bài" }),
          ).toContainText(
            "Bạn muốn đưa " + CARD_NAMES[given.type] + " cho Thảo?",
          );
          await confirm.click();
          await expect
            .poll(async () => (await view(pages[0])).game!.hand.at(-1)?.id)
            .toBe(given.id);
          expect((await view(pages[0])).game!.hand).toHaveLength(
            before[0].game!.hand.length + 1,
          );
          await expect
            .poll(async () => (await view(pages[1])).game!.hand.length)
            .toBe(before[1].game!.hand.length - 1);
          const sent = await pages[1].evaluate(
            () => (window as unknown as TestWindow).wire.commands,
          );
          expect(sent).toHaveLength(1);
          expect(sent[0].action).toEqual({ type: "give", cardId: given.id });
          for (const page of pages) {
            await expect(
              page.getByRole("img", { name: "Đang bị nhắm tới" }),
            ).toHaveCount(0);
            await expect(
              page.getByRole("alert", { name: "Bạn đang bị nhắm tới" }),
            ).toHaveCount(0);
            await expect(page.getByTestId("last-play")).toHaveText(
              "Thảo vừa đánh Xin Bài nhắm vào Minh",
            );
          }
          await expect(
            pages[1].getByRole("region", { name: "Xác nhận cho bài" }),
          ).toHaveCount(0);
          await expect(
            pages[1].locator('.hand .card[aria-pressed="true"]'),
          ).toHaveCount(0);
          expect(JSON.stringify(await view(pages[2]))).not.toContain(
            '"' + given.id + '"',
          );
        } else {
          await pages[0]
            .getByRole("button", { name: "Cài bom ngẫu nhiên", exact: true })
            .click();
          await expect
            .poll(async () => (await view(pages[0])).game!.turn.remaining)
            .toBe(2);
          const sent = await pages[0].evaluate(
            () => (window as unknown as TestWindow).wire.commands,
          );
          expect(sent).toHaveLength(1);
          expect(sent[0].action).toEqual({
            type: "insert_bomb",
            position: "random",
          });
          for (const page of pages) {
            await expect(
              page.getByRole("alert", { name: "Trạng thái Mèo Nổ" }),
            ).toContainText("Thảo đã gỡ bom an toàn");
            const snapshot = await view(page);
            expect(snapshot.lastBomb?.outcome).toBe("defused");
            if (saved.game!.phase.kind === "defuse")
              expect(JSON.stringify(snapshot)).not.toContain(
                '"' + saved.game!.phase.bomb.id + '"',
              );
            expect(snapshot.lastBomb).not.toHaveProperty("position");
          }
          await pages[1].screenshot({
            path: testInfo.outputPath("bomb-defused-observer-mobile.png"),
            fullPage: true,
            animations: "disabled",
          });
          await stop();
          const inserted = await readStored(saved.roomId);
          expect(saved.game!.phase.kind).toBe("defuse");
          if (saved.game!.phase.kind === "defuse") {
            const bomb = saved.game!.phase.bomb;
            expect(
              inserted.game!.drawPile.filter((card) => card.id === bomb.id),
            ).toEqual([bomb]);
            expect(
              inserted.game!.drawPile.filter((card) => card.id !== bomb.id),
            ).toEqual(saved.game!.drawPile);
          }
          await start();
          await resumed(pages);
          expect(
            (
              await command(pages[0], sent[0].action, {
                id: sent[0].id,
                version: sent[0].version,
              })
            ).ok,
          ).toBe(true);
          await stop();
          const replayed = await readStored(saved.roomId);
          expect(replayed.game).toEqual(inserted.game);
          expect(replayed.lastBomb).toEqual(inserted.lastBomb);
        }
        await writeFile(
          testInfo.outputPath("recovery-evidence.json"),
          JSON.stringify(
            {
              phase,
              gameId: saved.gameId,
              debtBefore: 3,
              origins,
              privateHandsPreserved: true,
              durableGamePreserved: true,
              pageReloaded: false,
            },
            null,
            2,
          ),
        );
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    },
  );
}

test("Nope giữ thời gian qua pause, downtime và tab thay thế; không chốt khi thiếu người", async ({
  browser,
  request,
}, testInfo) => {
  const { sessions, saved } = await prepare(request, "reaction");
  await start();
  const { contexts, pages } = await group(browser, sessions);
  try {
    await resumed(pages);
    expect((await command(pages[1], { type: "pass" })).ok).toBe(true);
    expect((await command(pages[2], { type: "leave" })).ok).toBe(true);
    await expect(
      pages[2].getByRole("button", { name: "Quay lại ghế" }),
    ).toBeVisible();
    await expect
      .poll(async () => (await view(pages[0])).pause?.missingIds)
      .toEqual([sessions[2].playerId]);
    const frozen = await view(pages[0]);
    expect(frozen.pause!.remainingNopeMs).toBeGreaterThan(0);
    expect((await command(pages[0], { type: "draw" })).code).toBe(
      "GAME_PAUSED",
    );
    await stop();
    const durable = await readStored(saved.roomId);
    expect(durable.pause!.remainingNopeMs).toBe(frozen.pause!.remainingNopeMs);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 6100));
    await start();
    for (const page of pages.slice(0, 2))
      await expect(
        page.getByRole("status", { name: "Trạng thái kết nối" }),
      ).toHaveText("Đã kết nối");
    await expect
      .poll(async () =>
        (await view(pages[0])).members
          .slice(0, 2)
          .every((member) => member.connected),
      )
      .toBe(true);
    const paused = await view(pages[0]);
    expect(paused.game).toEqual(frozen.game);
    expect(paused.lastPlay).toEqual(frozen.lastPlay);
    expect(paused.pause!.remainingNopeMs).toBe(frozen.pause!.remainingNopeMs);
    expect(paused.hostId).toBe(sessions[0].playerId);
    await expect(
      pages[1].getByRole("region", { name: "Ván tạm dừng" }),
    ).toContainText("Chờ An");
    await expect(
      pages[0].getByRole("button", { name: "Rút bài", exact: true }),
    ).toBeDisabled();
    await pages[0].getByLabel("Tùy chọn phòng").click();
    await expect(
      pages[0].getByRole("button", { name: "Hủy ván về phòng chờ" }),
    ).toBeEnabled();
    await pages[1].screenshot({
      path: testInfo.outputPath("phase-3-paused-mobile.png"),
      fullPage: true,
    });
    await pages[0].screenshot({
      path: testInfo.outputPath("phase-3-paused-desktop.png"),
      fullPage: true,
    });
    await pages[2].getByRole("button", { name: "Quay lại ghế" }).click();
    await resumed(pages);
    const active = await view(pages[0]);
    expect(active.game!.reaction!.passedIds).toEqual([sessions[1].playerId]);
    expect(active.game!.reaction!.deadline).toBeGreaterThan(
      frozen.game!.reaction!.deadline + 6000,
    );
    const replacement = await contexts[1].newPage();
    await replacement.goto(pages[1].url());
    await expect(
      replacement.getByRole("status", { name: "Trạng thái kết nối" }),
    ).toHaveText("Đã kết nối");
    await expect(
      pages[1].getByRole("status", { name: "Trạng thái kết nối" }),
    ).toHaveText("Đã ngừng điều khiển");
    expect((await view(replacement)).pause).toBeNull();
    expect((await view(replacement)).game!.reaction!.deadline).toBe(
      active.game!.reaction!.deadline,
    );
    await expect
      .poll(async () => (await view(pages[0])).game!.phase.kind, {
        timeout: 7000,
      })
      .toBe("turn");
    const settled = await view(pages[0]);
    expect(settled.game!.turn).toEqual({
      playerId: sessions[0].playerId,
      remaining: 2,
      attacked: true,
    });
    expect(settled.game!.discardPile).toHaveLength(1);
    expect((await command(pages[0], { type: "pass" })).ok).toBe(false);
    expect((await view(pages[0])).game!.turn.remaining).toBe(2);
    await writeFile(
      testInfo.outputPath("pause-evidence.json"),
      JSON.stringify(
        {
          frozenMs: frozen.pause!.remainingNopeMs,
          downtimeMs: 6100,
          hostRetained: true,
          allAliveRequired: true,
          passedRetained: true,
          deadlineBefore: frozen.game!.reaction!.deadline,
          deadlineAfter: active.game!.reaction!.deadline,
          remainingDebtAfter: 2,
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

for (const operation of ["draw", "shuffle"] as const) {
  test(
    "mất ACK " +
      operation +
      ": resend sau restart giữ kết quả, không thực hiện lại",
    async ({ browser, request }) => {
      const { sessions, saved } = await prepare(
        request,
        operation === "draw" ? "turn" : "shuffle",
      );
      await start();
      const { contexts, pages } = await group(browser, sessions);
      try {
        await resumed(pages);
        if (operation === "shuffle") {
          expect((await command(pages[0], { type: "pass" })).ok).toBe(true);
          expect((await command(pages[1], { type: "pass" })).ok).toBe(true);
        }
        const actorIndex = operation === "draw" ? 0 : 2;
        const actor = pages[actorIndex];
        const timeOrigin = await actor.evaluate(() => performance.timeOrigin);
        await actor.evaluate(() => {
          (window as unknown as TestWindow).wire.dropNextResult = true;
        });
        await actor
          .getByRole("button", {
            name: operation === "draw" ? "Rút bài" : "Bỏ qua",
            exact: true,
          })
          .click();
        await expect
          .poll(() =>
            actor.evaluate(
              () => (window as unknown as TestWindow).wire.droppedAck?.ok,
            ),
          )
          .toBe(true);
        const lost = await actor.evaluate(() => ({
          ack: (window as unknown as TestWindow).wire.droppedAck!,
          command: (window as unknown as TestWindow).wire.commands.at(-1)!,
        }));
        await stop();
        const durable = await readStored(saved.roomId);
        const count =
          saved.game!.drawPile.length - (operation === "draw" ? 1 : 0);
        expect(durable.game!.drawPile).toHaveLength(count);
        expect(durable.game!.phase.kind).toBe("turn");
        const database = new DatabaseSync(await databasePath(saved.roomId), {
          readOnly: true,
        });
        try {
          const stored = database
            .prepare(
              "SELECT result FROM command_results WHERE player_id = ? AND command_id = ?",
            )
            .get(sessions[actorIndex].playerId, lost.command.id)!;
          expect(JSON.parse(stored.result as string)).toEqual(lost.ack);
        } finally {
          database.close();
        }
        await start();
        await resumed(pages, durable.version + 1);
        const replay = await command(actor, lost.command.action, {
          id: lost.command.id,
          version: lost.command.version,
        });
        expect(replay).toEqual(lost.ack);
        expect((await view(actor)).game!.drawCount).toBe(count);
        expect((await view(actor)).game!.turn.remaining).toBe(
          operation === "draw" ? 2 : 3,
        );
        expect((await view(actor)).game!.hand).toEqual(
          durable.game!.players[actorIndex].hand,
        );
        expect(await actor.evaluate(() => performance.timeOrigin)).toBe(
          timeOrigin,
        );
        if (operation === "draw")
          expect((await view(actor)).game!.hand.at(-1)).toEqual(
            saved.game!.drawPile[0],
          );
        await stop();
        const afterReplay = await readStored(saved.roomId);
        expect(afterReplay.game).toEqual(durable.game);
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    },
  );
}

test("lỗi ghi SQLite rollback cả state và ACK; cùng ID có thể thử lại", async ({
  browser,
  request,
}) => {
  const { sessions, saved } = await prepare(request, "turn");
  const path = await databasePath(saved.roomId);
  const fault = new DatabaseSync(path);
  fault.exec(
    "CREATE TRIGGER test_save_failure BEFORE UPDATE ON multiplayer_state WHEN json_array_length(NEW.snapshot, '$.game.drawPile') < " +
      saved.game!.drawPile.length +
      " BEGIN SELECT RAISE(ABORT, 'TEST_SAVE_FAILURE'); END;",
  );
  fault.close();
  await start();
  const { contexts, pages } = await group(browser, sessions);
  try {
    await resumed(pages);
    await pages[0].locator(".hand .card").nth(0).click();
    await pages[0].locator(".hand .card").nth(1).click();
    await expect(
      pages[0].locator('.hand .card[aria-pressed="true"]'),
    ).toHaveCount(2);
    await pages[0]
      .getByRole("button", { name: "Rút bài", exact: true })
      .click();
    await expect(pages[0].getByRole("alert")).toContainText(
      "Chưa lưu được thao tác",
    );
    await expect(
      pages[0].locator('.hand .card[aria-pressed="true"]'),
    ).toHaveCount(2);
    const failed = await pages[0].evaluate(() =>
      (window as unknown as TestWindow).wire.commands.at(-1)!,
    );
    expect(
      await pages[0].evaluate(
        (id) =>
          (window as unknown as TestWindow).wire.messages.some(
            (message) => message.type === "result" && message.id === id,
          ),
        failed.id,
      ),
    ).toBe(false);
    const publicView = (await (
      await request.get("/api/rooms/" + saved.roomId)
    ).json()) as RoomSnapshot;
    expect(publicView.game!.drawCount).toBe(saved.game!.drawPile.length);
    expect(publicView.game!.turn.remaining).toBe(3);
    await stop();
    const durable = await readStored(saved.roomId);
    expect(durable.game).toEqual(saved.game);
    const database = new DatabaseSync(path);
    try {
      expect(
        database
          .prepare("SELECT result FROM command_results WHERE command_id = ?")
          .all(failed.id),
      ).toEqual([]);
      database.exec("DROP TRIGGER test_save_failure");
    } finally {
      database.close();
    }
    await start();
    await resumed(pages, durable.version + 1);
    await expect(
      pages[0].locator('.hand .card[aria-pressed="true"]'),
    ).toHaveCount(2);
    expect(
      (await command(pages[0], { type: "draw" }, { id: failed.id })).ok,
    ).toBe(true);
    await expect
      .poll(async () => (await view(pages[0])).game!.drawCount)
      .toBe(saved.game!.drawPile.length - 1);
    await expect(
      pages[0].locator('.hand .card[aria-pressed="true"]'),
    ).toHaveCount(0);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("alarm phát hiện tab ngừng JavaScript sau 25 giây; quay lại nối mới, không gia hạn bởi heartbeat", async ({
  browser,
  request,
}, testInfo) => {
  const { sessions, saved } = await prepare(request, "turn");
  await start();
  const { contexts, pages } = await group(browser, sessions);
  const suspended = await contexts[2].newCDPSession(pages[2]);
  try {
    await resumed(pages);
    const active = await view(pages[0]);
    const timeOrigin = await pages[2].evaluate(() => performance.timeOrigin);
    await suspended.send("Emulation.setScriptExecutionDisabled", {
      value: true,
    });
    const connectedAt = Date.now();
    await expect
      .poll(async () => (await view(pages[0])).pause?.missingIds, {
        timeout: 30000,
      })
      .toEqual([sessions[2].playerId]);
    expect(Date.now() - connectedAt).toBeGreaterThan(
      CONNECTION_TIMEOUT_MS - 500,
    );
    const paused = await view(pages[0]);
    expect(paused.hostId).toBe(sessions[0].playerId);
    expect(paused.game).toEqual(active.game);
    expect(paused.members.slice(0, 2).every((member) => member.connected)).toBe(
      true,
    );
    for (const online of pages.slice(0, 2))
      expect(
        await online.evaluate(
          () =>
            (window as unknown as TestWindow).wire.messages.filter(
              (message) => message.type === "pong",
            ).length,
        ),
      ).toBeGreaterThanOrEqual(3);
    await pages[1].screenshot({
      path: testInfo.outputPath("phase-3-heartbeat-pause.png"),
      fullPage: true,
    });
    const returnedAt = Date.now();
    await suspended.send("Emulation.setScriptExecutionDisabled", {
      value: false,
    });
    await pages[2].evaluate(() =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    await resumed(pages, paused.version + 1);
    expect((await view(pages[0])).game).toEqual(active.game);
    expect((await view(pages[2])).game!.hand).toEqual(
      saved.game!.players[2].hand,
    );
    expect(await pages[2].evaluate(() => performance.timeOrigin)).toBe(
      timeOrigin,
    );
    await stop();
    const durable = await readStored(saved.roomId);
    expect(durable.members[0].lastSeen!).toBeLessThanOrEqual(connectedAt);
    expect(durable.members[1].lastSeen!).toBeLessThanOrEqual(connectedAt);
    expect(durable.lastActivity).toBe(durable.members[2].lastSeen);
    expect(durable.lastActivity).toBeGreaterThanOrEqual(returnedAt);
    expect(durable.game).toEqual(saved.game);
  } finally {
    await suspended.send("Emulation.setScriptExecutionDisabled", {
      value: false,
    });
    await suspended.detach();
    await Promise.all(contexts.map((context) => context.close()));
  }
});

for (const count of [2, 3]) {
  test(
    "bàn riêng hiển thị combo " +
      count +
      "/Nope và mục tiêu cho mọi ghế, không phát lại khi reconnect",
    async ({ browser, request }, testInfo) => {
      const { sessions, saved } = await prepare(request, "turn");
      const game = saved.game!;
      const hand = game.players[0].hand;
      for (const pile of [
        game.drawPile,
        ...game.players.slice(1).map((player) => player.hand),
      ]) {
        while (hand.filter((card) => card.type === "tacocat").length < count) {
          const index = pile.findIndex((card) => card.type === "tacocat");
          if (index < 0) break;
          const replacement = hand.findIndex(
            (card) => card.type !== "tacocat" && card.type !== "defuse",
          );
          [hand[replacement], pile[index]] = [pile[index], hand[replacement]];
        }
      }
      const combo = hand
        .filter((card) => card.type === "tacocat")
        .slice(0, count);
      expect(combo).toHaveLength(count);
      const targetHand = game.players[1].hand;
      if (!targetHand.some((card) => card.type === "nope")) {
        for (const pile of [game.drawPile, hand, game.players[2].hand]) {
          const index = pile.findIndex((card) => card.type === "nope");
          if (index < 0) continue;
          [targetHand[1], pile[index]] = [pile[index], targetHand[1]];
          break;
        }
      }
      const nope = targetHand.find((card) => card.type === "nope")!;
      expect(nope).toBeDefined();
      await writeStored(saved);
      await start();
      const { contexts, pages } = await group(browser, sessions);
      try {
        await resumed(pages);
        await pages[1].emulateMedia({ reducedMotion: "reduce" });
        const cards = pages[0].getByRole("button", { name: /Mèo Taco/ });
        for (let index = 0; index < count; index++)
          await cards.nth(index).click();
        await pages[0]
          .getByLabel("Mục tiêu (Xin Bài / combo)")
          .selectOption(sessions[1].playerId);
        if (count === 3)
          await pages[0].getByLabel("Loại bài gọi tên").selectOption("defuse");
        await pages[0]
          .getByRole("button", { name: "Đánh " + count + " lá đã chọn" })
          .click();
        await expect(pages[0].locator(".card-arriving")).toHaveCount(count);
        await expect(pages[0].locator(".card-arriving").first()).toHaveCSS(
          "animation-name",
          "card-arrive",
        );
        await expect(pages[1].locator(".card-arriving")).toHaveCount(count);
        await expect(pages[1].locator(".card-arriving").first()).toHaveCSS(
          "animation-name",
          "none",
        );
        for (const page of pages) {
          await expect(
            page.getByTestId("public-cards").locator(".table-card"),
          ).toHaveCount(count);
          await expect(page.getByTestId("last-play")).toHaveText(
            "Thảo vừa đánh combo " + count + " lá Mèo Taco nhắm vào Minh",
          );
          expect((await view(page)).lastPlay).toMatchObject({
            playerId: sessions[0].playerId,
            targetId: sessions[1].playerId,
            cards: combo,
          });
          await expect(
            page.getByRole("img", { name: "Đang bị nhắm tới" }),
          ).toHaveCount(1);
          await expect(
            page.locator(".player-seat.is-targeted"),
          ).toHaveAttribute("data-player-id", sessions[1].playerId);
          const warning = page.getByRole("alert", {
            name: "Bạn đang bị nhắm tới",
          });
          if (page === pages[1])
            await expect(warning).toContainText(
              "Thảo đang nhắm vào bạn bằng combo " + count + " lá",
            );
          else await expect(warning).toHaveCount(0);
          await expect(
            page.getByRole("region", { name: "Xác nhận cho bài" }),
          ).toHaveCount(0);
        }
        await pages[0].screenshot({
          path: testInfo.outputPath("table-combo-desktop.png"),
          fullPage: true,
          animations: "disabled",
        });
        await pages[1].screenshot({
          path: testInfo.outputPath("target-combo-mobile.png"),
          fullPage: true,
          animations: "disabled",
        });
        await pages[1]
          .getByRole("button", { name: "Nope", exact: true })
          .click();
        for (const page of pages) {
          await expect(
            page.getByTestId("public-cards").locator(".table-card"),
          ).toHaveCount(1);
          await expect(page.getByTestId("last-play")).toHaveText(
            "Minh vừa đánh Chặn — Nope",
          );
          expect((await view(page)).lastPlay).toMatchObject({
            playerId: sessions[1].playerId,
            cards: [nope],
          });
          expect((await view(page)).lastPlay).not.toHaveProperty("targetId");
          await expect(
            page.getByRole("img", { name: "Đang bị nhắm tới" }),
          ).toHaveCount(0);
          await expect(
            page.getByRole("alert", { name: "Bạn đang bị nhắm tới" }),
          ).toHaveCount(0);
        }
        await pages[1].screenshot({
          path: testInfo.outputPath("table-nope-mobile.png"),
          fullPage: true,
          animations: "disabled",
        });
        const latest = (await view(pages[1])).lastPlay;
        await pages[2].reload();
        await resumed(pages);
        expect((await view(pages[2])).lastPlay).toEqual(latest);
        await expect(pages[2].getByTestId("last-play")).toHaveText(
          "Minh vừa đánh Chặn — Nope",
        );
        await expect(pages[2].locator(".card-arriving")).toHaveCount(0);
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    },
  );
}

for (const scenario of [
  { count: 2, succeeds: true },
  { count: 3, succeeds: true },
  { count: 3, succeeds: false },
]) {
  test(
    "tay bài tự gom, thông báo riêng combo " +
      scenario.count +
      (scenario.succeeds ? " lấy được bài" : " không có lá gọi tên"),
    async ({ browser, request }, testInfo) => {
      const { sessions, saved } = await prepare(request, "turn");
      const game = saved.game!;
      const pool = [
        ...game.drawPile,
        ...game.players.flatMap((player) => player.hand),
      ];
      const hands: CardType[][] = [
        [
          "skip",
          "tacocat",
          "defuse",
          "attack",
          "tacocat",
          "nope",
          "tacocat",
          "skip",
        ],
        ["beard_cat"],
        [
          "defuse",
          "favor",
          "see_future",
          "nope",
          "rainbow_ralphing_cat",
          "hairy_potato_cat",
          "cattermelon",
          "shuffle",
        ],
      ];
      for (const [index, types] of hands.entries()) {
        game.players[index].hand = types.map((type) => {
          const position = pool.findIndex((card) => card.type === type);
          expect(position).toBeGreaterThanOrEqual(0);
          return pool.splice(position, 1)[0];
        });
      }
      game.drawPile = pool;
      const actorHand = structuredClone(game.players[0].hand);
      const stolen = game.players[1].hand[0];
      const combo = actorHand
        .filter((card) => card.type === "tacocat")
        .slice(0, scenario.count);
      await writeStored(saved);
      await start();
      const { contexts, pages } = await group(browser, sessions);
      try {
        await resumed(pages);
        const actor = pages[0];
        await expect
          .poll(() =>
            actor
              .locator(".hand .card")
              .evaluateAll((cards) =>
                cards.map((card) => card.getAttribute("data-type")),
              ),
          )
          .toEqual([
            "defuse",
            "attack",
            "skip",
            "skip",
            "nope",
            "tacocat",
            "tacocat",
            "tacocat",
          ]);
        expect((await view(actor)).game!.hand).toEqual(actorHand);
        await actor
          .locator(".table-hand")
          .screenshot({ path: testInfo.outputPath("sorted-hand-before.png") });
        const cats = actor.getByRole("button", {
          name: "LÁ BÀI Mèo Taco",
          exact: true,
        });
        for (let index = 0; index < scenario.count; index++)
          await cats.nth(index).click();
        await actor
          .getByLabel("Mục tiêu (Xin Bài / combo)")
          .selectOption(sessions[1].playerId);
        if (scenario.count === 3)
          await actor
            .getByLabel("Loại bài gọi tên")
            .selectOption(scenario.succeeds ? "beard_cat" : "attack");
        await actor
          .getByRole("button", {
            name: "Đánh " + scenario.count + " lá đã chọn",
          })
          .click();
        await expect
          .poll(async () => (await view(actor)).game!.phase.kind)
          .toBe("reaction");
        const played = await actor.evaluate(() =>
          (window as unknown as TestWindow).wire.commands.at(-1)!,
        );
        expect(played.action).toEqual({
          type: "play",
          cardIds: combo.map((card) => card.id),
          targetId: sessions[1].playerId,
          ...(scenario.count === 3
            ? { requestedType: scenario.succeeds ? "beard_cat" : "attack" }
            : {}),
        });
        for (const page of pages)
          await expect(
            page.getByRole("status", { name: "Kết quả lấy bài" }),
          ).toHaveCount(0);
        await resumed(pages, played.version + 1);
        let settled: CommandResult | undefined;
        for (const page of pages) {
          settled = await command(page, { type: "pass" });
          expect(settled.ok).toBe(true);
          await resumed(pages, settled.version);
        }
        const event = {
          id: settled!.version,
          fromId: sessions[1].playerId,
          toId: sessions[0].playerId,
          cardType: scenario.succeeds ? "beard_cat" : null,
        };
        const messages = [
          scenario.succeeds
            ? "Bạn vừa lấy Mèo Râu từ Minh."
            : "Bạn không lấy được lá nào từ Minh.",
          scenario.succeeds
            ? "Thảo vừa lấy Mèo Râu của bạn."
            : "Thảo không lấy được lá nào của bạn.",
        ];
        for (const [index, message] of messages.entries()) {
          expect((await view(pages[index])).lastTransfer).toEqual(event);
          await expect(
            pages[index]
              .getByRole("status", { name: "Kết quả lấy bài" })
              .locator("p"),
          ).toHaveText(message);
        }
        const expectedHand = actorHand.filter(
          (card) => !combo.some((played) => played.id === card.id),
        );
        if (scenario.succeeds) expectedHand.push(stolen);
        expect((await view(actor)).game!.hand).toEqual(expectedHand);
        expect((await view(pages[1])).game!.hand).toEqual(
          scenario.succeeds ? [] : [stolen],
        );
        await expect(
          actor.locator('.hand .card[data-type="skip"]'),
        ).toHaveCount(2);
        const observer = await view(pages[2]);
        expect(observer.lastTransfer).toBeNull();
        expect(JSON.stringify(observer)).not.toContain(stolen.id);
        expect(JSON.stringify(observer)).not.toContain('"cardType"');
        await expect(
          pages[2].getByRole("status", { name: "Kết quả lấy bài" }),
        ).toHaveCount(0);
        const publicView = (await (
          await request.get("/api/rooms/" + saved.roomId)
        ).json()) as RoomSnapshot;
        expect(publicView.lastTransfer).toBeNull();
        expect(JSON.stringify(publicView)).not.toContain(stolen.id);
        await actor.screenshot({
          path: testInfo.outputPath("transfer-received-desktop.png"),
          fullPage: true,
          animations: "disabled",
        });
        for (const width of [390, 320]) {
          await pages[1].setViewportSize({ width, height: 844 });
          expect(
            await pages[1].evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          await expect(
            pages[1].getByRole("button", { name: "Đóng thông báo lấy bài" }),
          ).toBeInViewport();
          await pages[1].screenshot({
            path: testInfo.outputPath("transfer-lost-mobile-" + width + ".png"),
            fullPage: true,
            animations: "disabled",
          });
        }
        await actor
          .getByRole("button", { name: "Đóng thông báo lấy bài" })
          .click();
        const lastPass = await pages[2].evaluate(() =>
          (window as unknown as TestWindow).wire.commands.at(-1)!,
        );
        expect(
          (
            await command(pages[2], lastPass.action, {
              id: lastPass.id,
              version: lastPass.version,
            })
          ).ok,
        ).toBe(true);
        await expect(
          actor.getByRole("status", { name: "Kết quả lấy bài" }),
        ).toHaveCount(0);
        await stop();
        const durable = await readStored(saved.roomId);
        expect(durable.lastTransfer).toEqual(event);
        await start();
        await resumed(pages, durable.version + 1);
        expect((await view(actor)).game!.hand).toEqual(expectedHand);
        expect((await view(pages[1])).lastTransfer).toEqual(event);
        await expect(
          pages[1]
            .getByRole("status", { name: "Kết quả lấy bài" })
            .locator("p"),
        ).toHaveText(messages[1]);
        await expect(
          actor.getByRole("status", { name: "Kết quả lấy bài" }),
        ).toHaveCount(0);
      } finally {
        await Promise.all(contexts.map((context) => context.close()));
      }
    },
  );
}

test("Attack qua Worker cộng 2, 4, 6 lượt; trả một lượt rồi chuyển 5 + 2 sau restart", async ({
  browser,
  request,
}) => {
  const { sessions, saved } = await prepare(request, "turn");
  const game = saved.game!;
  const attacks = [
    ...game.drawPile,
    ...game.players.flatMap((player) => player.hand),
  ].filter((card) => card.type === "attack");
  expect(attacks).toHaveLength(4);
  game.drawPile = game.drawPile.filter((card) => card.type !== "attack");
  for (const player of game.players) {
    player.hand = player.hand.filter((card) => card.type !== "attack");
    player.hand.push(attacks.shift()!);
  }
  game.players[0].hand.push(...attacks);
  game.turn = { playerId: sessions[0].playerId, remaining: 1, attacked: false };
  const safe = game.drawPile.findIndex(
    (card) => card.type !== "exploding_kitten",
  );
  [game.drawPile[0], game.drawPile[safe]] = [
    game.drawPile[safe],
    game.drawPile[0],
  ];
  await writeStored(saved);
  await start();
  const { contexts, pages } = await group(browser, sessions);
  try {
    await resumed(pages);
    for (const [index, debt] of [2, 4, 6, 7].entries()) {
      if (index === 3) {
        const drawn = await command(pages[0], { type: "draw" });
        expect(drawn.ok).toBe(true);
        await resumed(pages, drawn.version);
        expect((await view(pages[0])).game!.turn).toEqual({
          playerId: sessions[0].playerId,
          remaining: 5,
          attacked: true,
        });
        await stop();
        const durable = await readStored(saved.roomId);
        await start();
        await resumed(pages, durable.version + 1);
        expect((await view(pages[0])).game!.turn).toEqual(durable.game!.turn);
      }
      const actor = pages[index % 3];
      await actor
        .getByRole("button", { name: "LÁ BÀI Tấn Công", exact: true })
        .first()
        .click();
      await actor.getByRole("button", { name: "Đánh 1 lá đã chọn" }).click();
      await expect
        .poll(async () => (await view(actor)).game!.phase.kind)
        .toBe("reaction");
      await resumed(pages, (await view(actor)).version);
      for (const page of pages) {
        const passed = await command(page, { type: "pass" });
        expect(passed.ok).toBe(true);
        await resumed(pages, passed.version);
      }
      const next = (index + 1) % 3;
      for (const page of pages) {
        expect((await view(page)).game!.turn).toEqual({
          playerId: sessions[next].playerId,
          remaining: debt,
          attacked: true,
        });
        await expect(page.locator(".table-turn")).toHaveText(
          "Lượt của " + ["Thảo", "Minh", "An"][next] + " · " + debt + " lượt",
        );
      }
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("không tự Nope nhưng được phản Nope của người khác, kể cả sau restart", async ({
  browser,
  request,
}, testInfo) => {
  const { sessions, saved } = await prepare(request, "reaction");
  const game = saved.game!;
  for (const index of [0, 1]) {
    const hand = game.players[index].hand;
    while (hand.filter((card) => card.type === "nope").length < 2) {
      const source = [
        game.drawPile,
        ...game.players.slice(index + 1).map((player) => player.hand),
      ].find((pile) => pile.some((card) => card.type === "nope"));
      expect(source).toBeDefined();
      const cardIndex = source!.findIndex((card) => card.type === "nope");
      const replacement = hand.findIndex(
        (card) => card.type !== "nope" && card.type !== "defuse",
      );
      [hand[replacement], source![cardIndex]] = [
        source![cardIndex],
        hand[replacement],
      ];
    }
  }
  const ownNopes = game.players[0].hand.filter((card) => card.type === "nope");
  const otherNopes = game.players[1].hand.filter(
    (card) => card.type === "nope",
  );
  await writeStored(saved);
  await start();
  const { contexts, pages } = await group(browser, sessions);
  try {
    await resumed(pages);
    const ownButton = pages[0].getByRole("button", {
      name: "Nope",
      exact: true,
    });
    const otherButton = pages[1].getByRole("button", {
      name: "Nope",
      exact: true,
    });
    await expect(ownButton).toBeDisabled();
    await expect(otherButton).toBeEnabled();
    await expect(
      pages[0].getByText("Không thể Nope bài vừa đánh."),
    ).toBeVisible();
    const before = await view(pages[0]);
    expect(
      await command(pages[0], { type: "nope", cardId: ownNopes[0].id }),
    ).toMatchObject({
      ok: false,
      code: "CANNOT_NOPE_YOURSELF",
    });
    expect(await view(pages[0])).toEqual(before);
    await pages[0].screenshot({
      path: testInfo.outputPath("nope-own-action-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await otherButton.click();
    await expect(ownButton).toBeEnabled();
    await expect(otherButton).toBeDisabled();
    await stop();
    const stored = await readStored(sessions[0].roomId);
    expect(stored.game!.phase).toMatchObject({
      nopeCount: 1,
      lastNopePlayerId: sessions[1].playerId,
    });
    await start();
    await resumed(pages, before.version + 1);
    await expect(ownButton).toBeEnabled();
    await expect(otherButton).toBeDisabled();
    const afterRestart = await view(pages[1]);
    expect(
      await command(pages[1], { type: "nope", cardId: otherNopes[1].id }),
    ).toMatchObject({
      ok: false,
      code: "CANNOT_NOPE_YOURSELF",
    });
    expect(await view(pages[1])).toEqual(afterRestart);
    await pages[1].screenshot({
      path: testInfo.outputPath("nope-own-nope-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    await ownButton.click();
    await expect(otherButton).toBeEnabled();
    await expect(ownButton).toBeDisabled();
    for (const page of pages)
      await expect
        .poll(async () => (await view(page)).game!.phase)
        .toMatchObject({
          nopeCount: 2,
          lastNopePlayerId: sessions[0].playerId,
        });
    const countered = await view(pages[0]);
    expect(
      await command(pages[0], { type: "nope", cardId: ownNopes[1].id }),
    ).toMatchObject({
      ok: false,
      code: "CANNOT_NOPE_YOURSELF",
    });
    expect(await view(pages[0])).toEqual(countered);
    expect(
      countered.game!.hand.filter((card) => card.type === "nope"),
    ).toHaveLength(ownNopes.length - 1);
    for (const page of pages) {
      await resumed(pages);
      expect((await command(page, { type: "pass" })).ok).toBe(true);
    }
    await expect
      .poll(async () => (await view(pages[0])).game!.phase.kind)
      .toBe("turn");
    expect((await view(pages[0])).game!.turn).toEqual({
      playerId: sessions[0].playerId,
      remaining: 2,
      attacked: true,
    });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("chủ rời giữ ghế và chuyển quyền, hủy/tái đấu rồi chơi tới kết thúc", async ({
  browser,
  request,
}, testInfo) => {
  const { sessions, saved } = await prepare(request, "turn");
  await start();
  const { contexts, pages } = await group(browser, sessions);
  try {
    await resumed(pages);
    await pages[0].getByLabel("Tùy chọn phòng").click();
    await pages[0].getByRole("button", { name: "Rời ván (giữ ghế)" }).click();
    await expect(
      pages[0].getByRole("button", { name: "Quay lại ghế" }),
    ).toBeVisible();
    await expect
      .poll(async () => (await view(pages[1])).hostId)
      .toBe(sessions[1].playerId);
    expect((await view(pages[1])).members).toHaveLength(3);
    expect((await view(pages[1])).members[0].cardCount).toBe(
      saved.game!.players[0].hand.length,
    );
    await pages[1].getByLabel("Tùy chọn phòng").click();
    await pages[1]
      .getByRole("button", { name: "Hủy ván về phòng chờ" })
      .click();
    await expect.poll(async () => (await view(pages[1])).game).toBeNull();
    expect(
      (await view(pages[1])).members.every((member) => !member.ready),
    ).toBe(true);
    await pages[0].getByRole("button", { name: "Quay lại ghế" }).click();
    await resumed(pages);
    for (const page of pages)
      expect((await command(page, { type: "ready", ready: true })).ok).toBe(
        true,
      );
    expect((await command(pages[1], { type: "start" })).ok).toBe(true);
    const nextId = (await view(pages[1])).gameId;
    expect(nextId).not.toBe(saved.gameId);
    for (let step = 0; step < 100; step++) {
      const snapshot = await view(pages[1]);
      if (snapshot.game!.phase.kind === "finished") break;
      const actor =
        pages[
          sessions.findIndex(
            (session) => session.playerId === snapshot.game!.turn.playerId,
          )
        ];
      const action: RoomAction =
        snapshot.game!.phase.kind === "defuse"
          ? { type: "insert_bomb", position: 0 }
          : { type: "draw" };
      const result = await command(actor, action);
      expect(result.ok).toBe(true);
      await expect
        .poll(async () => (await view(pages[1])).version)
        .toBeGreaterThanOrEqual(result.version);
    }
    expect((await view(pages[1])).game!.phase.kind).toBe("finished");
    await pages[1].screenshot({
      path: testInfo.outputPath("phase-3-finished-mobile.png"),
      fullPage: true,
    });
    await pages[1].getByLabel("Tùy chọn phòng").click();
    await pages[1]
      .getByRole("button", { name: "Về phòng chờ", exact: true })
      .click();
    await expect.poll(async () => (await view(pages[1])).game).toBeNull();
    await pages[1].getByLabel("Số người trong ván").selectOption("4");
    await expect.poll(async () => (await view(pages[1])).capacity).toBe(4);
    const joined = await request.post("/api/rooms/" + saved.roomId + "/join", {
      headers: { Origin: origin },
      data: { name: "Linh" },
    });
    expect(joined.status()).toBe(201);
    const guest = (await joined.json()) as Session;
    const fourth = await browser.newContext();
    contexts.push(fourth);
    await observe(fourth);
    const fourthPage = await fourth.newPage();
    pages.push(fourthPage);
    await openSession(fourthPage, guest);
    await resumed(pages);
    await expect(
      pages[1].getByLabel("Số người trong ván").locator('option[value="3"]'),
    ).toBeDisabled();
    expect(
      (await command(pages[1], { type: "set_capacity", capacity: 3 })).code,
    ).toBe("CAPACITY_TOO_SMALL");
    for (const page of pages)
      expect((await command(page, { type: "ready", ready: true })).ok).toBe(
        true,
      );
    expect((await command(pages[1], { type: "start" })).ok).toBe(true);
    await expect
      .poll(async () => (await view(pages[1])).game!.drawCount)
      .toBe(34);
    expect((await view(pages[1])).gameId).not.toBe(nextId);
    for (const page of pages) {
      await expect(
        page.getByRole("img", { name: "Vương miện người thắng" }),
      ).toHaveCount(0);
      await expect(
        page.locator(".player-seat.is-winner, .player-seat.is-eliminated"),
      ).toHaveCount(0);
    }
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("phòng hết hạn xóa cả snapshot/journal, phiên cũ có thông báo và không reconnect vô hạn", async ({
  browser,
  request,
}, testInfo) => {
  const { sessions, saved } = await prepare(request, "future");
  const path = await databasePath(saved.roomId);
  saved.lastActivity = Date.now() - ROOM_TTL_MS - 2000;
  await writeStored(saved);
  await start();
  const expired = await request.get("/api/rooms/" + saved.roomId);
  expect([404, 410]).toContain(expired.status());
  expect((await expired.json()).error).toContain("hết hạn");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await observe(context);
  try {
    const page = await context.newPage();
    await page.addInitScript(
      (session) =>
        localStorage.setItem(
          "meono:" + session.roomId,
          JSON.stringify(session),
        ),
      sessions[0],
    );
    await page.goto("/?room=" + saved.roomId);
    await expect(page.getByRole("alert")).toContainText("hết hạn");
    await expect(page.getByRole("alert")).toHaveCount(1);
    await expect(
      page.getByText("Không thể mở phòng từ lời mời này.", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Tạo một phòng mới", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Đang kiểm tra lời mời…", { exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Vào phòng", exact: true }),
    ).toBeDisabled();
    expect(
      await page.evaluate(
        (roomId) => localStorage.getItem("meono:" + roomId),
        saved.roomId,
      ),
    ).toBeNull();
    await page.screenshot({
      path: testInfo.outputPath("phase-3-expired-mobile.png"),
      fullPage: true,
    });
    await stop();
    const database = new DatabaseSync(path, { readOnly: true });
    try {
      expect(
        database
          .prepare(
            "SELECT name FROM sqlite_master WHERE name IN ('multiplayer_state', 'command_results', 'rate_limits')",
          )
          .all(),
      ).toEqual([]);
    } finally {
      database.close();
    }
  } finally {
    await context.close();
  }
});

test("migrate phòng Phase 2 đang xem tương lai, không chia lại và không mất ghế", async ({
  browser,
  request,
}) => {
  const { sessions, saved } = await prepare(request, "future");
  const {
    schemaVersion: _schema,
    rulesVersion: _rules,
    gameId: _id,
    lastActivity: _activity,
    pause: _pause,
    hostTransferPending: _transfer,
    ...legacy
  } = saved;
  const unversioned = {
    ...legacy,
    members: legacy.members.map(({ lastSeen: _seen, ...member }) => member),
  };
  const database = new DatabaseSync(await databasePath(saved.roomId));
  database
    .prepare("UPDATE multiplayer_state SET snapshot = ? WHERE id = 1")
    .run(JSON.stringify(unversioned));
  database.close();
  await start();
  const { contexts, pages } = await group(browser, sessions);
  try {
    await resumed(pages);
    expect(
      (await view(pages[0])).game!.futureCards.map((card) => card.id),
    ).toEqual(saved.game!.drawPile.slice(0, 3).map((card) => card.id));
    expect((await view(pages[1])).game!.futureCards).toEqual([]);
    expect((await view(pages[0])).game!.hand).toEqual(
      saved.game!.players[0].hand,
    );
    await stop();
    const migrated = await readStored(saved.roomId);
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.game).toEqual(saved.game);
    const id = migrated.gameId;
    await start();
    await resumed(pages, migrated.version + 1);
    expect((await view(pages[0])).gameId).toBe(id);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
