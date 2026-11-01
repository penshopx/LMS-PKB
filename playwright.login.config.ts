import { defineConfig } from "@playwright/test";
import existing from "./playwright.practice-reminders.config";

export default defineConfig(existing, {
  testMatch: ["login-retry.spec.ts"],
  outputDir: "./generated-artifacts/login-retry/results",
  reporter: [["list"]],
});
