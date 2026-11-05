import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

if (!process.env.REPLIT_DEV_DOMAIN || process.env.NODE_ENV === "production") {
  throw new Error("Discussion checks require the running development preview.");
}
export default defineConfig({
  testDir: "./browser-tests",
  testMatch: "discussions.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 90_000,
  outputDir: "./generated-artifacts/discussions/results",
  reporter: "list",
  use: {
    baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
    viewport: { width: 390, height: 844 },
    screenshot: "only-on-failure",
    actionTimeout: 15000,
    launchOptions: {
      ...(existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {}),
      args: ["--no-sandbox"],
    },
  },
});
