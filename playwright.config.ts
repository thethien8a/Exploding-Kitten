import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: ".amp/in/artifacts/playwright",
  timeout: 90_000,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: ".amp/in/artifacts/playwright-results.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:8788",
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
