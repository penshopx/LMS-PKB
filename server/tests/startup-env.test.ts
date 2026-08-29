import { describe, expect, it } from "vitest";
import {
  getMissingStartupEnvironment,
  validateStartupEnvironment,
} from "../startup-env";

describe("startup environment validation", () => {
  it("reports every missing required variable without exposing values", () => {
    const environment = {
      NODE_ENV: "production",
      DATABASE_URL: "   ",
      SESSION_SECRET: undefined,
    };

    expect(getMissingStartupEnvironment(environment)).toEqual([
      "DATABASE_URL",
      "SESSION_SECRET",
    ]);
    expect(() => validateStartupEnvironment(environment)).toThrow(
      "Missing required environment variable(s) for production: DATABASE_URL, SESSION_SECRET",
    );
  });

  it("allows startup when database and session configuration are present", () => {
    const environment = {
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://configured-host/database",
      SESSION_SECRET: "configured-session-secret",
    };

    expect(() => validateStartupEnvironment(environment)).not.toThrow();
  });

  it("uses the same required checks outside production", () => {
    expect(() =>
      validateStartupEnvironment({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://configured-host/database",
      }),
    ).toThrow("SESSION_SECRET");
  });
});