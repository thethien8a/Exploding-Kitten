import { test, expect } from "@playwright/test";
import { preview, type PreviewServer } from "vite";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

let server: PreviewServer | undefined;
let statePath: string;

async function startServer(): Promise<PreviewServer> {
  return preview({
    clearScreen: false,
    preview: {
      host: "127.0.0.1",
      port: 8788,
      strictPort: true,
    },
  });
}

test.beforeEach(async () => {
  await mkdir(resolve(".amp/in"), { recursive: true });
  statePath = await mkdtemp(resolve(".amp/in/phase-0-state-"));
  process.env.MEONO_STATE_PATH = statePath;
  server = await startServer();
});

test.afterEach(async () => {
  await server?.close();
  server = undefined;
  await rm(statePath, { recursive: true, force: true });
  delete process.env.MEONO_STATE_PATH;
});

test("phòng đồng bộ, tách biệt và khôi phục SQLite sau restart runtime", async ({
  browser,
}, testInfo) => {
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const otherContext = await browser.newContext();
  const desktop = await desktopContext.newPage();
  const mobile = await mobileContext.newPage();
  const other = await otherContext.newPage();
  const consoleErrors: string[] = [];
  for (const page of [desktop, mobile, other]) {
    page.on("pageerror", (error) => consoleErrors.push(error.message));
  }

  try {
    await Promise.all([
      desktop.goto("http://127.0.0.1:8788/?room=nhom-a"),
      mobile.goto("http://127.0.0.1:8788/?room=nhom-a"),
      other.goto("http://127.0.0.1:8788/?room=nhom-b"),
    ]);
    for (const page of [desktop, mobile, other]) {
      await expect(
        page.getByRole("status", { name: "Trạng thái kết nối" }),
      ).toHaveText("Đã kết nối");
      await expect(page.getByTestId("room-value")).toHaveText("0");
    }

    await desktop.getByRole("button", { name: "Tăng giá trị +1" }).click();
    await expect(mobile.getByTestId("room-value")).toHaveText("1");
    await mobile.getByRole("button", { name: "Tăng giá trị +1" }).click();
    await expect(desktop.getByTestId("room-value")).toHaveText("2");

    // Gửi sát nhau để bắt lỗi read-modify-write làm mất lượt tăng.
    await Promise.all([
      desktop
        .getByRole("button", { name: "Tăng giá trị +1" })
        .click({ clickCount: 3 }),
      mobile
        .getByRole("button", { name: "Tăng giá trị +1" })
        .click({ clickCount: 2 }),
    ]);
    await expect(desktop.getByTestId("room-value")).toHaveText("7");
    await expect(mobile.getByTestId("room-value")).toHaveText("7");
    await expect(other.getByTestId("room-value")).toHaveText("0");
    await other
      .getByRole("button", { name: "Tăng giá trị +1" })
      .click({ clickCount: 3 });
    await expect(other.getByTestId("room-value")).toHaveText("3");
    await expect(desktop.getByTestId("room-value")).toHaveText("7");

    const timeOrigins = await Promise.all(
      [desktop, mobile].map((page) =>
        page.evaluate(() => performance.timeOrigin),
      ),
    );
    await server!.close();
    server = undefined;
    await expect(
      desktop.getByRole("status", { name: "Trạng thái kết nối" }),
    ).toHaveText("Đang kết nối lại…");
    await expect(
      desktop.getByRole("button", { name: "Tăng giá trị +1" }),
    ).toBeDisabled();
    await desktop.screenshot({
      path: testInfo.outputPath("phase-0-reconnecting.png"),
      fullPage: true,
    });

    // Đọc trực tiếp file SQLite khi workerd đã dừng, không qua API hay RAM.
    const diskValues: number[] = [];
    for (const file of await readdir(statePath, { recursive: true })) {
      if (!file.endsWith(".sqlite")) continue;
      const db = new DatabaseSync(join(statePath, file), { readOnly: true });
      try {
        const table = db
          .prepare("SELECT name FROM sqlite_master WHERE name = 'room_state'")
          .get();
        if (table) {
          const row = db
            .prepare("SELECT value FROM room_state WHERE id = 1")
            .get();
          diskValues.push(Number(row!.value));
        }
      } finally {
        db.close();
      }
    }
    expect(diskValues.sort((a, b) => a - b)).toEqual([3, 7]);

    server = await startServer();
    for (const page of [desktop, mobile, other]) {
      await expect(
        page.getByRole("status", { name: "Trạng thái kết nối" }),
      ).toHaveText("Đã kết nối", {
        timeout: 15_000,
      });
    }
    await expect(desktop.getByTestId("room-value")).toHaveText("7");
    await expect(mobile.getByTestId("room-value")).toHaveText("7");
    await expect(other.getByTestId("room-value")).toHaveText("3");
    const restoredTimeOrigins = await Promise.all(
      [desktop, mobile].map((page) =>
        page.evaluate(() => performance.timeOrigin),
      ),
    );
    expect(restoredTimeOrigins).toEqual(timeOrigins);

    await mobile.getByRole("button", { name: "Tăng giá trị +1" }).click();
    await expect(desktop.getByTestId("room-value")).toHaveText("8");
    await expect(mobile.getByTestId("room-value")).toHaveText("8");
    await expect(other.getByTestId("room-value")).toHaveText("3");
    expect(
      await mobile.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(consoleErrors).toEqual([]);

    await desktop.screenshot({
      path: testInfo.outputPath("phase-0-desktop.png"),
      fullPage: true,
    });
    await mobile.screenshot({
      path: testInfo.outputPath("phase-0-mobile.png"),
      fullPage: true,
    });
    await writeFile(
      testInfo.outputPath("restart-evidence.json"),
      JSON.stringify(
        {
          browserVersion: browser.version(),
          diskValues,
          timeOrigins,
          restoredTimeOrigins,
          finalValues: await Promise.all(
            [desktop, mobile, other].map((page) =>
              page.getByTestId("room-value").textContent(),
            ),
          ),
          consoleErrors,
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.all([
      desktopContext.close(),
      mobileContext.close(),
      otherContext.close(),
    ]);
  }
});

test("API từ chối đường dẫn, method, origin và lệnh sai; client không đặt được giá trị", async ({
  page,
  request,
}, testInfo) => {
  expect((await request.get(`/api/rooms/${"a".repeat(48)}`)).status()).toBe(
    200,
  );
  for (const room of ["co_gach_duoi", "a".repeat(49)]) {
    expect((await request.get(`/api/rooms/${room}`)).status()).toBe(404);
  }
  expect((await request.post("/api/rooms/transport")).status()).toBe(405);
  expect(
    (
      await request.get("/api/rooms/transport/ws", {
        headers: { Origin: "https://example.com" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.get("/api/rooms/transport/ws", {
        headers: { Origin: "http://127.0.0.1:8788" },
      })
    ).status(),
  ).toBe(426);
  expect((await request.get("/api/not-found")).status()).toBe(404);

  await page.goto("/?room=transport");
  await expect(
    page.getByRole("status", { name: "Trạng thái kết nối" }),
  ).toHaveText("Đã kết nối");
  const messages = await page.evaluate(
    () =>
      new Promise<unknown[]>((resolveMessages, reject) => {
        const socket = new WebSocket(
          `ws://${location.host}/api/rooms/transport/ws`,
        );
        const commands = [
          "not-json",
          JSON.stringify({ type: "replace", value: 999 }),
          new Uint8Array([1, 2]).buffer,
          "x".repeat(257),
          JSON.stringify({ type: "increment", value: 999 }),
        ];
        const received: unknown[] = [];
        socket.onerror = () => reject(new Error("WebSocket test failed"));
        socket.onmessage = (event) => {
          received.push(JSON.parse(event.data));
          const command = commands.shift();
          if (command !== undefined) socket.send(command);
          else {
            socket.close();
            resolveMessages(received);
          }
        };
      }),
  );
  expect(messages).toEqual([
    { type: "snapshot", value: 0 },
    ...Array.from({ length: 4 }, () => ({
      type: "error",
      message: "Lệnh thử nghiệm không hợp lệ.",
    })),
    { type: "snapshot", value: 1 },
  ]);
  await expect(page.getByTestId("room-value")).toHaveText("1");
  expect(await (await request.get("/api/rooms/transport")).json()).toEqual({
    type: "snapshot",
    value: 1,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel("Mở một phòng thử").fill("bad_room");
  await page.getByRole("button", { name: "Mở phòng", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Mã phòng cần 1–48 ký tự",
  );
  await expect(page).toHaveURL(/\?room=transport$/);
  await expect(page.getByTestId("room-value")).toHaveText("1");
  await page.screenshot({
    path: testInfo.outputPath("phase-0-invalid-room.png"),
    fullPage: true,
  });

  await page.getByLabel("Mở một phòng thử").fill("nhom-hop-le");
  await page.getByRole("button", { name: "Mở phòng", exact: true }).click();
  await expect(page).toHaveURL(/\?room=nhom-hop-le$/);
  await expect(page.getByTestId("room-value")).toHaveText("0");
  await expect(page.getByLabel("Link cùng phòng")).toHaveValue(
    "http://127.0.0.1:8788/?room=nhom-hop-le",
  );
  expect(await (await request.get("/api/rooms/transport")).json()).toEqual({
    type: "snapshot",
    value: 1,
  });
});
