import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

if (!process.env.REPLIT_DEV_DOMAIN || process.env.NODE_ENV === "production") {
  throw new Error("Reference browser checks require the running development preview.");
}
export default defineConfig({
  testDir: "./browser-tests",
  testMatch: "lesson-references.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 90_000,
  outputDir: "./generated-artifacts/lesson-references/results",
  reporter: "list",
  use: {
    baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
    actionTimeout: 15_000,
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
    launchOptions: {
      ...(existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
});
