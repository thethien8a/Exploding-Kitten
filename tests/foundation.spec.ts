import {
  test,
  expect,
  type Page,
  type BrowserContext,
  type APIRequestContext,
} from "@playwright/test";
import { preview, type PreviewServer } from "vite";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  ClientCommand,
  CommandResult,
  RoomAction,
  RoomMessage,
  RoomSnapshot,
  Session,
} from "../shared/protocol";

let server: PreviewServer | undefined;
let statePath: string;
const origin = "http://127.0.0.1:8788";
type Wire = {
  socket: WebSocket;
  latest: RoomSnapshot;
  messages: RoomMessage[];
};
type TestWindow = Window & { wire: Wire };

test.beforeEach(async () => {
  await mkdir(resolve(".amp/in"), { recursive: true });
  statePath = await mkdtemp(resolve(".amp/in/phase-2-state-"));
  process.env.MEONO_STATE_PATH = statePath;
  server = await preview({
    clearScreen: false,
    preview: { host: "127.0.0.1", port: 8788, strictPort: true },
  });
});
test.afterEach(async () => {
  await server?.close();
  server = undefined;
  await rm(statePath, { recursive: true, force: true });
  delete process.env.MEONO_STATE_PATH;
});
async function observe(context: BrowserContext) {
  await context.addInitScript(() => {
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        const wire = {
          socket: this,
          messages: [] as RoomMessage[],
          latest: null as RoomSnapshot | null,
        };
        Object.assign(window, { wire });
        this.addEventListener("message", (event) => {
          const message = JSON.parse(String(event.data)) as RoomMessage;
          wire.messages.push(message);
          if (message.type === "snapshot") wire.latest = message;
        });
      }
    };
  });
}
async function view(page: Page) {
  return page.evaluate(() => (window as unknown as TestWindow).wire.latest);
}
async function command(
  page: Page,
  action: RoomAction,
  override: Partial<Pick<ClientCommand, "id" | "version">> = {},
) {
  const result = await page.evaluate(
    ({ action, override }) =>
      new Promise<CommandResult>((resolveResult) => {
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
          }
        };
        wire.socket.addEventListener("message", receive);
        wire.socket.send(JSON.stringify(command));
      }),
    { action, override },
  );
  if (action.type !== "leave" || !result.ok) {
    await expect
      .poll(async () => (await view(page)).version)
      .toBeGreaterThanOrEqual(result.version);
  }
  return result;
}
async function rejectedSocket(page: Page, roomId: string, token?: string) {
  return page.evaluate(
    ({ roomId, token }) =>
      new Promise<boolean>((resolveRejected) => {
        const previous = (window as unknown as TestWindow).wire;
        const socket = new WebSocket(
          "ws://" + location.host + "/api/rooms/" + roomId + "/ws",
          token ? ["meono", token] : ["meono"],
        );
        (window as unknown as TestWindow).wire = previous;
        socket.onopen = () => {
          socket.close();
          resolveRejected(false);
        };
        socket.onerror = () => resolveRejected(true);
      }),
    { roomId, token },
  );
}
async function create(
  request: APIRequestContext,
  capacity = 3,
): Promise<Session> {
  const response = await request.post("/api/rooms", {
    headers: { Origin: origin },
    data: { name: "Chủ phòng", capacity },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as Session;
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

for (const capacity of [3, 4, 5]) {
  test(
    capacity +
      " phiên riêng: phòng chờ, chia kín, tách phòng và chống rút trùng",
    async ({ browser }, testInfo) => {
      const contexts: BrowserContext[] = [];
      const pages: Page[] = [];
      const errors: string[] = [];
      try {
        for (let index = 0; index < capacity + 1; index++) {
          const context = await browser.newContext({
            viewport:
              index === 1
                ? { width: 390, height: 844 }
                : { width: 1280, height: 900 },
          });
          contexts.push(context);
          await observe(context);
          const page = await context.newPage();
          page.on("pageerror", (error) => errors.push(error.message));
          pages.push(page);
        }
        const host = pages[0];
        await host.goto("/");
        if (capacity === 3)
          await host.screenshot({
            path: testInfo.outputPath("phase-2-home.png"),
            fullPage: true,
          });
        await host.getByLabel("Tên của bạn").fill("Thảo");
        await host
          .getByLabel("Số người chơi", { exact: true })
          .selectOption(String(capacity));
        await host
          .getByRole("button", { name: "Tạo phòng", exact: true })
          .click();
        await expect(
          host.getByRole("status", { name: "Trạng thái kết nối" }),
        ).toHaveText("Đã kết nối");
        const link = host.url();
        const roomId = new URL(link).searchParams.get("room")!;
        expect(roomId).toMatch(/^[0-9a-f-]{36}$/);
        await expect(
          host.getByRole("button", { name: "Bắt đầu ván" }),
        ).toBeDisabled();
        for (let index = 1; index < capacity; index++) {
          await pages[index].goto(link);
          await pages[index]
            .getByLabel("Tên của bạn")
            .fill(
              capacity === 5 && index === 2
                ? "Bạn chơi tên rất dài"
                : index === 1
                  ? "Thảo"
                  : "Bạn " + (index + 1),
            );
          await pages[index]
            .getByRole("button", { name: "Vào phòng", exact: true })
            .click();
          await expect(
            pages[index].getByRole("status", { name: "Trạng thái kết nối" }),
          ).toHaveText("Đã kết nối");
        }
        for (const page of pages.slice(0, capacity))
          await expect(page.getByTestId("member")).toHaveCount(capacity);
        expect(
          new Set(
            (await Promise.all(pages.slice(0, capacity).map(view))).map(
              (value) => value.you,
            ),
          ).size,
        ).toBe(capacity);
        const full = await contexts[0].request.post(
          "/api/rooms/" + roomId + "/join",
          { headers: { Origin: origin }, data: { name: "Người mới" } },
        );
        expect((await full.json()).code).toBe("ROOM_FULL");
        expect((await command(pages[1], { type: "start" })).code).toBe(
          "NOT_HOST",
        );
        for (let index = 0; index < capacity; index++) {
          await pages[index]
            .getByRole("button", { name: "Sẵn sàng", exact: true })
            .click();
          await expect
            .poll(
              async () =>
                (await view(host)).members.filter((member) => member.ready)
                  .length,
            )
            .toBe(index + 1);
        }
        if (capacity === 3) {
          await host.screenshot({
            path: testInfo.outputPath("phase-2-lobby-desktop.png"),
            fullPage: true,
          });
          await pages[1].screenshot({
            path: testInfo.outputPath("phase-2-lobby-mobile.png"),
            fullPage: true,
          });
        }
        await host.getByRole("button", { name: "Bắt đầu ván" }).click();
        for (const page of pages.slice(0, capacity)) {
          await expect(
            page.getByRole("heading", { name: "Bàn chơi Mèo Nổ" }),
          ).toBeAttached();
          await expect(
            page.getByRole("heading", { name: "Đủ bạn. Sẵn sàng." }),
          ).toHaveCount(0);
          await expect(
            page.getByRole("region", { name: "Tay bài của bạn" }),
          ).toBeVisible();
          await expect(
            page.getByLabel("Người quanh bàn").getByTestId("member"),
          ).toHaveCount(capacity);
          const ownId = (await view(page)).you!;
          await expect(page.getByTestId("member").first()).toHaveAttribute(
            "data-player-id",
            ownId,
          );
          const ownSeat = await page
            .getByTestId("member")
            .first()
            .boundingBox();
          const table = await page
            .getByRole("region", { name: "Bàn chơi", exact: true })
            .boundingBox();
          expect(ownSeat!.y).toBeGreaterThan(table!.y + table!.height * 0.65);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        }
        const snapshots = await Promise.all(pages.slice(0, capacity).map(view));
        for (let index = 0; index < capacity; index++) {
          const snapshot = snapshots[index];
          expect(snapshot.game!.hand).toHaveLength(8);
          expect(snapshot.game!.drawCount).toBe(
            { 3: 29, 4: 23, 5: 16 }[capacity],
          );
          const payload = JSON.stringify(snapshot);
          expect(payload).not.toMatch(
            /token|tokenHash|drawPile|removedCards|receipts|connectionId/,
          );
          for (let other = 0; other < capacity; other++)
            if (other !== index)
              for (const card of snapshots[other].game!.hand)
                expect(payload).not.toContain('"' + card.id + '"');
        }
        const publicView = (await (
          await contexts[0].request.get("/api/rooms/" + roomId)
        ).json()) as RoomSnapshot;
        expect(publicView.you).toBeNull();
        expect(publicView.game!.hand).toEqual([]);
        expect(publicView.game!.futureCards).toEqual([]);
        for (const width of [1280, 390, 320]) {
          const page = width === 1280 ? host : pages[1];
          await page.setViewportSize({
            width,
            height: width === 1280 ? 900 : 844,
          });
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          expect(
            await page.locator(".oval-table").evaluate((table) => {
              const piles = Array.from(
                table.querySelectorAll(".deck-back, .discard-stack"),
                (pile) => pile.getBoundingClientRect(),
              );
              return Array.from(table.querySelectorAll(".player-seat"))
                .filter((seat) => {
                  const rect = seat.getBoundingClientRect();
                  return piles.some(
                    (pile) =>
                      rect.left < pile.right &&
                      rect.right > pile.left &&
                      rect.top < pile.bottom &&
                      rect.bottom > pile.top,
                  );
                })
                .map((seat) => seat.textContent);
            }),
          ).toEqual([]);
          await page.screenshot({
            path: testInfo.outputPath(
              "table-" +
                capacity +
                "-" +
                (width === 1280
                  ? "desktop"
                  : width === 390
                    ? "mobile"
                    : "small-mobile") +
                ".png",
            ),
            fullPage: true,
          });
        }
        await pages[1].setViewportSize({ width: 390, height: 844 });
        const lateJoin = await contexts[0].request.post(
          "/api/rooms/" + roomId + "/join",
          { headers: { Origin: origin }, data: { name: "Người mới" } },
        );
        expect((await lateJoin.json()).code).toBe("GAME_STARTED");
        expect(
          (await command(host, { type: "kick", targetId: snapshots[1].you! }))
            .code,
        ).toBe("GAME_STARTED");
        const other = pages[capacity];
        await other.goto("/");
        await other.getByLabel("Tên của bạn").fill("Phòng khác");
        await other
          .getByRole("button", { name: "Tạo phòng", exact: true })
          .click();
        await expect(
          other.getByRole("status", { name: "Trạng thái kết nối" }),
        ).toHaveText("Đã kết nối");
        const isolated = await view(other);
        expect(isolated.members).toHaveLength(1);
        expect(isolated.game).toBeNull();
        expect(isolated.roomId).not.toBe(roomId);
        const actor =
          pages[
            snapshots.findIndex(
              (snapshot) => snapshot.you === snapshot.game!.turn.playerId,
            )
          ];
        const version = (await view(actor)).version;
        const results = await actor.evaluate(
          () =>
            new Promise<CommandResult[]>((resolveResults) => {
              const wire = (window as unknown as TestWindow).wire;
              const id = crypto.randomUUID();
              const command = {
                type: "command",
                id,
                version: wire.latest.version,
                action: { type: "draw" },
              };
              const results: CommandResult[] = [];
              const receive = (event: MessageEvent<string>) => {
                const message = JSON.parse(event.data) as RoomMessage;
                if (message.type === "result") {
                  results.push(message);
                  if (results.length === 3) {
                    wire.socket.removeEventListener("message", receive);
                    resolveResults(results);
                  }
                }
              };
              wire.socket.addEventListener("message", receive);
              wire.socket.send(JSON.stringify(command));
              wire.socket.send(JSON.stringify(command));
              wire.socket.send(
                JSON.stringify({ ...command, id: crypto.randomUUID() }),
              );
            }),
        );
        expect(results[0]).toEqual(results[1]);
        expect(results[0].ok).toBe(true);
        expect(results[2].code).toBe("STALE_VERSION");
        for (const page of pages.slice(0, capacity))
          await expect
            .poll(async () => (await view(page)).game!.drawCount)
            .toBe({ 3: 28, 4: 22, 5: 15 }[capacity]);
        expect((await view(actor)).version).toBe(version + 1);
        expect(await view(other)).toEqual(isolated);
        for (const page of pages.slice(0, capacity))
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        expect(errors).toEqual([]);
        await writeFile(
          testInfo.outputPath("multiplayer-evidence.json"),
          JSON.stringify(
            {
              capacity,
              independentSessions: snapshots.map((snapshot) => snapshot.you),
              initialHandCounts: snapshots.map(
                (snapshot) => snapshot.game!.hand.length,
              ),
              initialDrawCount: snapshots[0].game!.drawCount,
              duplicateResults: results,
              isolatedRoom: isolated.roomId,
              errors,
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

test("tab mới thay tab cũ, kick vô hiệu token và chủ phòng rời chuyển quyền", async ({
  browser,
  request,
}) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  await observe(a);
  await observe(b);
  try {
    const session = await create(request);
    const first = await a.newPage();
    await openSession(first, session);
    const response = await request.post(
      "/api/rooms/" + session.roomId + "/join",
      { headers: { Origin: origin }, data: { name: "Bạn B" } },
    );
    const guest = (await response.json()) as Session;
    const guestPage = await b.newPage();
    await openSession(guestPage, guest);
    const firstVersion = (await view(first)).version;
    const stored = await command(
      first,
      { type: "ready", ready: false },
      { id: "shared-command" },
    );
    expect(
      (
        await command(
          guestPage,
          { type: "ready", ready: false },
          { id: "shared-command" },
        )
      ).ok,
    ).toBe(true);
    expect(
      await command(
        first,
        { type: "ready", ready: false },
        { id: "shared-command", version: firstVersion },
      ),
    ).toEqual(stored);
    expect(
      (
        await command(
          first,
          { type: "leave" },
          { id: "shared-command", version: firstVersion },
        )
      ).code,
    ).toBe("COMMAND_ID_REUSED");
    const replacement = await a.newPage();
    await replacement.goto(first.url());
    await expect(
      replacement.getByRole("status", { name: "Trạng thái kết nối" }),
    ).toHaveText("Đã kết nối");
    await expect(
      first.getByRole("status", { name: "Trạng thái kết nối" }),
    ).toHaveText("Đã ngừng điều khiển");
    await expect(
      first.getByRole("button", { name: "Sẵn sàng", exact: true }),
    ).toBeDisabled();
    expect(
      (await view(replacement)).members.filter(
        (member) => member.id === session.playerId,
      ),
    ).toHaveLength(1);
    expect(
      (await command(guestPage, { type: "kick", targetId: session.playerId }))
        .code,
    ).toBe("NOT_HOST");
    expect(
      (await command(replacement, { type: "kick", targetId: guest.playerId }))
        .ok,
    ).toBe(true);
    await expect(guestPage.getByRole("alert")).toContainText("mời ra");
    expect(await rejectedSocket(guestPage, session.roomId, guest.token)).toBe(
      true,
    );
    const joined = await request.post(
      "/api/rooms/" + session.roomId + "/join",
      { headers: { Origin: origin }, data: { name: "Bạn B" } },
    );
    const nextGuest = (await joined.json()) as Session;
    await openSession(guestPage, nextGuest);
    expect((await command(replacement, { type: "leave" })).ok).toBe(true);
    await expect
      .poll(async () => (await view(guestPage)).hostId)
      .toBe(nextGuest.playerId);
    expect((await view(guestPage)).members).toHaveLength(1);
  } finally {
    await a.close();
    await b.close();
  }
});

test("transport chặn nguồn, token, schema, binary, kích thước và tần suất", async ({
  browser,
  request,
}) => {
  expect(
    (
      await request.post("/api/rooms", { data: { name: "A", capacity: 3 } })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/not-found")).status()).toBe(404);
  expect((await request.get("/api/rooms/bad_room")).status()).toBe(404);
  expect((await request.get("/api/rooms")).status()).toBe(405);
  const missing = await request.post("/api/rooms/missing/join", {
    headers: { Origin: origin },
    data: { name: "A" },
  });
  expect(missing.status()).toBe(404);
  const session = await create(request);
  const wsUrl = "/api/rooms/" + session.roomId + "/ws";
  expect(
    (
      await request.get(wsUrl, { headers: { Origin: "https://example.com" } })
    ).status(),
  ).toBe(403);
  expect(
    (await request.get(wsUrl, { headers: { Origin: origin } })).status(),
  ).toBe(426);

  const context = await browser.newContext();
  await observe(context);
  try {
    const page = await context.newPage();
    await openSession(page, session);
    for (const token of [undefined, "0".repeat(64)])
      expect(await rejectedSocket(page, session.roomId, token)).toBe(true);
    const before = await view(page);
    const received = await page.evaluate(
      () =>
        new Promise<RoomMessage[]>((resolveMessages) => {
          const wire = (window as unknown as TestWindow).wire;
          const messages: (string | ArrayBuffer)[] = [
            "not-json",
            new Uint8Array([1, 2]).buffer,
            "x".repeat(2049),
            JSON.stringify({
              type: "command",
              id: "forged",
              version: wire.latest.version,
              action: { type: "ready", ready: true, playerId: "victim" },
            }),
            ...Array.from({ length: 100 }, () =>
              JSON.stringify({ type: "replace", drawPile: [] }),
            ),
          ];
          const received: RoomMessage[] = [];
          const receive = (event: MessageEvent<string>) => {
            const message = JSON.parse(event.data) as RoomMessage;
            if (message.type === "error") {
              received.push(message);
              if (received.length === messages.length) {
                wire.socket.removeEventListener("message", receive);
                resolveMessages(received);
              }
            }
          };
          wire.socket.addEventListener("message", receive);
          for (const message of messages) wire.socket.send(message);
        }),
    );
    expect(
      received
        .slice(0, 4)
        .map((message) => message.type === "error" && message.code),
    ).toEqual(Array(4).fill("INVALID_COMMAND"));
    expect(
      received.some(
        (message) =>
          message.type === "error" && message.code === "RATE_LIMITED",
      ),
    ).toBe(true);
    const after = (await (
      await request.get("/api/rooms/" + session.roomId)
    ).json()) as RoomSnapshot;
    expect(after.version).toBe(before.version);
    expect(after.members[0].ready).toBe(false);
    expect(after.game).toBeNull();
    const badName = await request.post(
      "/api/rooms/" + session.roomId + "/join",
      { headers: { Origin: origin }, data: { name: "x".repeat(33) } },
    );
    expect((await badName.json()).code).toBe("INVALID_NAME");
    const oversized = await request.post(
      "/api/rooms/" + session.roomId + "/join",
      { headers: { Origin: origin }, data: { name: "x".repeat(3000) } },
    );
    expect(oversized.status()).toBe(400);
    const statuses: number[] = [];
    for (let index = 0; index < 13; index++)
      statuses.push(
        (
          await request.post("/api/rooms", {
            headers: { Origin: origin },
            data: { name: "Quota", capacity: 3 },
          })
        ).status(),
      );
    expect(statuses).toContain(429);
  } finally {
    await context.close();
  }
});

test("runtime chốt cửa sổ 5 giây và người bị loại chỉ nhận payload công khai", async ({
  browser,
  request,
}, testInfo) => {
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];
  try {
    const host = await create(request);
    const sessions = [host];
    for (let index = 1; index < 3; index++) {
      const response = await request.post(
        "/api/rooms/" + host.roomId + "/join",
        { headers: { Origin: origin }, data: { name: "Bạn " + index } },
      );
      sessions.push((await response.json()) as Session);
    }
    for (const session of sessions) {
      const context = await browser.newContext();
      contexts.push(context);
      await observe(context);
      const page = await context.newPage();
      pages.push(page);
      await openSession(page, session);
    }
    for (const page of pages)
      expect((await command(page, { type: "ready", ready: true })).ok).toBe(
        true,
      );
    expect((await command(pages[0], { type: "start" })).ok).toBe(true);
    let played = false;
    for (let step = 0; step < 60 && !played; step++) {
      const snapshot = await view(pages[0]);
      const phase = snapshot.game!.phase;
      const actorIndex = sessions.findIndex(
        (session) => session.playerId === snapshot.game!.turn.playerId,
      );
      const actor = pages[actorIndex];
      if (phase.kind === "defuse") {
        expect(
          (
            await command(actor, {
              type: "insert_bomb",
              position: snapshot.game!.drawCount,
            })
          ).ok,
        ).toBe(true);
        continue;
      }
      const hand = (await view(actor)).game!.hand;
      const card = hand.find((card) =>
        ["skip", "attack", "shuffle", "see_future", "favor"].includes(
          card.type,
        ),
      );
      if (!card) {
        expect((await command(actor, { type: "draw" })).ok).toBe(true);
        continue;
      }
      const target = sessions[(actorIndex + 1) % 3].playerId;
      expect(
        (
          await command(actor, {
            type: "play",
            cardIds: [card.id],
            ...(card.type === "favor" ? { targetId: target } : {}),
          })
        ).ok,
      ).toBe(true);
      played = true;
      const pending = await view(actor);
      const deadline = pending.game!.reaction!.deadline;
      expect(pending.game!.futureCards).toEqual([]);
      await actor.screenshot({
        path: testInfo.outputPath("phase-2-reaction.png"),
        fullPage: true,
      });
      await expect
        .poll(async () => (await view(actor)).game!.phase.kind, {
          timeout: 8000,
        })
        .not.toBe("reaction");
      expect(Date.now()).toBeGreaterThanOrEqual(deadline);
      expect(
        (await command(actor, { type: "pass" }, { version: pending.version }))
          .ok,
      ).toBe(false);
      const settled = await view(actor);
      if (settled.game!.phase.kind === "future") {
        for (let index = 0; index < 3; index++)
          expect((await view(pages[index])).game!.futureCards).toHaveLength(
            index === actorIndex ? 3 : 0,
          );
        await command(actor, { type: "close_future" });
      } else if (settled.game!.phase.kind === "favor") {
        const targetPage =
          pages[sessions.findIndex((session) => session.playerId === target)];
        const given = (await view(targetPage)).game!.hand[0];
        await command(targetPage, { type: "give", cardId: given.id });
      }
    }
    expect(played).toBe(true);
    let eliminated = -1;
    for (let step = 0; step < 100 && eliminated < 0; step++) {
      const snapshot = await view(pages[0]);
      const actorIndex = sessions.findIndex(
        (session) => session.playerId === snapshot.game!.turn.playerId,
      );
      const actor = pages[actorIndex];
      const action: RoomAction =
        snapshot.game!.phase.kind === "defuse"
          ? { type: "insert_bomb", position: 0 }
          : { type: "draw" };
      expect((await command(actor, action)).ok).toBe(true);
      eliminated = (await view(actor)).members.findIndex(
        (member) => !member.alive,
      );
    }
    expect(eliminated).toBeGreaterThanOrEqual(0);
    const spectator = await view(pages[eliminated]);
    expect(spectator.game!.hand).toEqual([]);
    expect(spectator.game!.futureCards).toEqual([]);
    for (let index = 0; index < 3; index++)
      if (index !== eliminated)
        for (const card of (await view(pages[index])).game!.hand)
          expect(JSON.stringify(spectator)).not.toContain('"' + card.id + '"');
    await pages[eliminated].screenshot({
      path: testInfo.outputPath("phase-2-spectator.png"),
      fullPage: true,
    });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("giao diện mobile: Nope, tương lai, cho bài, cài bom và combo", async ({
  browser,
}, testInfo) => {
  for (const state of [
    "reaction",
    "future",
    "favor",
    "defuse",
    "combo",
  ] as const) {
    const snapshot: RoomSnapshot = {
      type: "snapshot",
      roomId: "visual-room",
      gameId: "visual-game",
      lastPlay: {
        id: 10,
        playerId: "b",
        cards: [{ id: "played-favor", type: "favor" }],
        ...(state === "future" ? {} : { targetId: "a" }),
      },
      pause: null,
      version: 10,
      capacity: 3,
      hostId: "b",
      you: "a",
      members: [
        {
          id: "a",
          name: "Thảo",
          ready: true,
          connected: true,
          alive: true,
          cardCount: state === "combo" ? 3 : state === "future" ? 6 : 2,
        },
        {
          id: "b",
          name: "Minh",
          ready: true,
          connected: true,
          alive: true,
          cardCount: 5,
        },
        {
          id: "c",
          name: "An",
          ready: true,
          connected: true,
          alive: true,
          cardCount: 8,
        },
      ],
      game: {
        hand:
          state === "combo"
            ? [1, 2, 3].map((index) => ({
                id: "cat-" + index,
                type: "tacocat",
              }))
            : [
                { id: "defuse-a", type: "defuse" },
                { id: "nope-a", type: "nope" },
                ...(state === "future"
                  ? [
                      { id: "long-future", type: "see_future" as const },
                      {
                        id: "long-rainbow",
                        type: "rainbow_ralphing_cat" as const,
                      },
                      { id: "long-potato", type: "hairy_potato_cat" as const },
                      { id: "long-melon", type: "cattermelon" as const },
                    ]
                  : []),
              ],
        futureCards:
          state === "future"
            ? [
                { id: "future-1", type: "skip" },
                { id: "future-2", type: "attack" },
                { id: "future-3", type: "favor" },
              ]
            : [],
        drawCount: 7,
        discardPile: [{ id: "played-favor", type: "favor" }],
        turn: {
          playerId: state === "combo" ? "a" : "b",
          remaining: 2,
          attacked: true,
        },
        phase:
          state === "combo"
            ? { kind: "turn" }
            : state === "reaction"
              ? {
                  kind: "reaction",
                  action: { type: "favor", playerId: "b", targetId: "a" },
                  nopeCount: 2,
                }
              : state === "favor"
                ? { kind: "favor", playerId: "b", targetId: "a" }
                : { kind: state, playerId: "a" },
        reaction: state === "reaction" ? { deadline: 0, passedIds: [] } : null,
      },
    };
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    try {
      await context.addInitScript((snapshot) => {
        localStorage.setItem(
          "meono:visual-room",
          JSON.stringify({
            roomId: "visual-room",
            playerId: "a",
            token: "0".repeat(64),
          }),
        );
        Object.assign(window, { sent: [] });
        if (snapshot.game?.reaction)
          snapshot.game.reaction.deadline = Date.now() + 5000;
        class PreviewSocket {
          static OPEN = 1;
          readonly readyState = 1;
          onmessage: ((event: { data: string }) => void) | null = null;
          constructor() {
            setTimeout(
              () => this.onmessage?.({ data: JSON.stringify(snapshot) }),
              0,
            );
          }
          send(data: string) {
            (window as unknown as { sent: ClientCommand[] }).sent.push(
              JSON.parse(data) as ClientCommand,
            );
          }
          close() {}
        }
        window.WebSocket = PreviewSocket as unknown as typeof WebSocket;
      }, snapshot);
      const page = await context.newPage();
      await page.goto("/?room=visual-room");
      await expect(
        page.getByRole("status", { name: "Trạng thái kết nối" }),
      ).toHaveText("Đã kết nối");
      await expect(page.getByTestId("last-play")).toHaveText(
        "Minh vừa đánh Xin Bài" + (state === "future" ? "" : " nhắm vào Thảo"),
      );
      if (state === "reaction")
        await expect(
          page.getByRole("region", { name: "Phản ứng Nope" }),
        ).toContainText("Minh: Xin Bài → Thảo");
      if (state === "future")
        await expect(
          page.getByText("Ba lá trên cùng — chỉ bạn thấy"),
        ).toBeVisible();
      if (state === "favor")
        await expect(
          page.getByText("Chọn một lá bên dưới để cho người xin bài."),
        ).toBeVisible();
      if (state === "defuse") await page.getByLabel(/Cài Mèo Nổ/).fill("3");
      if (state === "combo") {
        const cards = page.getByRole("button", { name: /Mèo Taco/ });
        for (let index = 0; index < 3; index++) await cards.nth(index).click();
        await page.getByLabel("Mục tiêu (Xin Bài / combo)").selectOption("b");
        await page.getByLabel("Loại bài gọi tên").selectOption("attack");
      }
      await page.screenshot({
        path: testInfo.outputPath("phase-2-ui-" + state + ".png"),
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (state === "future") {
        for (const width of [390, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.locator(".table-hand .card").evaluateAll((cards) =>
              cards
                .filter((card) => {
                  const label = card
                    .querySelector("strong")!
                    .getBoundingClientRect();
                  const frame = card.getBoundingClientRect();
                  return (
                    label.bottom > frame.bottom - 4 ||
                    label.top < frame.top ||
                    label.width > frame.width
                  );
                })
                .map((card) => card.textContent),
            ),
          ).toEqual([]);
          await page.locator(".hand").scrollIntoViewIfNeeded();
          await page.locator(".hand").evaluate((hand) => {
            hand.scrollLeft = hand.scrollWidth;
          });
          const last = page.getByRole("button", {
            name: "LÁ BÀI Mèo Dưa Hấu",
            exact: true,
          });
          await expect(last).toBeInViewport();
          if (width === 390)
            await expect(
              page.getByRole("button", { name: "BẢO VỆ Gỡ Bom", exact: true }),
            ).not.toBeInViewport();
          await page.screenshot({
            path: testInfo.outputPath("table-long-cards-" + width + ".png"),
            fullPage: true,
          });
        }
        await page.setViewportSize({ width: 390, height: 844 });
      }
      const actions: Record<typeof state, RoomAction> = {
        reaction: { type: "nope", cardId: "nope-a" },
        future: { type: "close_future" },
        favor: { type: "give", cardId: "defuse-a" },
        defuse: { type: "insert_bomb", position: 3 },
        combo: {
          type: "play",
          cardIds: ["cat-1", "cat-2", "cat-3"],
          targetId: "b",
          requestedType: "attack",
        },
      };
      const labels = {
        reaction: "Nope",
        future: "Đóng tương lai",
        favor: "BẢO VỆ Gỡ Bom",
        defuse: "Cài kín vị trí này",
        combo: "Đánh 3 lá đã chọn",
      };
      await page
        .getByRole("button", { name: labels[state], exact: true })
        .click();
      const sent = await page.evaluate(
        () => (window as unknown as { sent: ClientCommand[] }).sent,
      );
      expect(sent).toHaveLength(1);
      expect(sent[0].action).toEqual(actions[state]);
      expect(sent[0].version).toBe(10);
      expect(sent[0]).not.toHaveProperty("playerId");
    } finally {
      await context.close();
    }
  }
});
