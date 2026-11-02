import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

if (!process.env.REPLIT_DEV_DOMAIN || process.env.NODE_ENV === "production") {
  throw new Error("Catalog browser checks require the running development preview.");
}
export default defineConfig({
  testDir: "./browser-tests", testMatch: "public-catalog.spec.ts",
  workers: 1, retries: 0, timeout: 60_000,
  outputDir: "./generated-artifacts/public-catalog/results",
  reporter: "list",
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
