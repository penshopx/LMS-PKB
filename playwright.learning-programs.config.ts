import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

if (!process.env.REPLIT_DEV_DOMAIN || process.env.NODE_ENV === "production") {
  throw new Error("Learning program checks require the running development preview.");
}

export default defineConfig({
  testDir: "./browser-tests",
  testMatch: "learning-programs.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 90_000,
  outputDir: "./generated-artifacts/learning-programs/results",
  reporter: "list",
  use: {
    actionTimeout: 15_000,
    baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
    launchOptions: {
      ...(existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
});
