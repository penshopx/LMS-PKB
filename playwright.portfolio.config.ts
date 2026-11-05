import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

if (!process.env.REPLIT_DEV_DOMAIN || process.env.NODE_ENV === "production") {
  throw new Error("Run portfolio checks against the running development preview, never production.");
}
export default defineConfig({
  testDir: "./browser-tests",
  testMatch: "portfolio.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 60_000,
  outputDir: "./generated-artifacts/portfolio/results",
  reporter: "list",
  use: {
    baseURL: `https://${process.env.REPLIT_DEV_DOMAIN}`,
    browserName: "chromium",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      ...(existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
});
