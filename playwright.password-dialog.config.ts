import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

if (!process.env.REPLIT_DEV_DOMAIN || process.env.NODE_ENV === "production") {
  throw new Error("Run against the development preview only.");
}
export default defineConfig({
  testDir: "./browser-tests",
  testMatch: "password-dialog-network.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 60_000,
  outputDir: "./generated-artifacts/password-dialog-network",
  use: {
    baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
    launchOptions: {
      ...(existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
});
