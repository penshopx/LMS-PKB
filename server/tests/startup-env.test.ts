import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMissingStartupEnvironment,
  validateStartupEnvironment,
} from "../startup-env";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("startup environment validation", () => {
  it("reports every missing required variable without exposing values", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
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
      "[startup] Missing required environment variable(s): DATABASE_URL, SESSION_SECRET",
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

  it("warns and continues outside production", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() =>
      validateStartupEnvironment({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://configured-host/database",
      }),
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      "[startup] WARNING: Missing required environment variable(s): SESSION_SECRET. " +
        "Continuing in development.",
    );
  });
});