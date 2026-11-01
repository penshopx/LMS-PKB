import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

if (!process.env.REPLIT_DEV_DOMAIN || process.env.NODE_ENV === "production") {
  throw new Error("Run these checks against the running development preview, never production.");
}

export default defineConfig({
  testDir: "./browser-tests",
  testMatch: "practice-reminders.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "./generated-artifacts/practice-reminders/results",
  reporter: [["list"], ["html", {
    outputFolder: "./generated-artifacts/practice-reminders/report", open: "never",
  }]],
  use: {
    baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
    browserName: "chromium",
    // Intentionally not WIB: the reminders must follow WIB, not the device.
    timezoneId: "America/Los_Angeles",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      ...(existsSync("/repl/tools/bin/chromium")
        ? { executablePath: "/repl/tools/bin/chromium" } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
});
