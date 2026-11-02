import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearLoginCooldown, LOGIN_COOLDOWN_KEY, loginCooldownSeconds,
  MAX_LOGIN_COOLDOWN_MS, readLoginCooldown, startLoginCooldown,
} from "@/lib/login-cooldown";

const now = Date.parse("2026-11-02T00:00:00Z");
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("per-tab login cooldown display hint", () => {
  it("stores only a deadline and restores the remaining duration without extending it", () => {
    const until = startLoginCooldown(65, now);
    expect([...values]).toEqual([[LOGIN_COOLDOWN_KEY, String(now + 65_000)]]);
    expect(readLoginCooldown(now + 2_001)).toBe(until);
    expect(loginCooldownSeconds(until, now + 2_001)).toBe(63);
    expect(readLoginCooldown(now + 64_999)).toBe(until);
    expect(loginCooldownSeconds(until, now + 64_999)).toBe(1);
    expect(readLoginCooldown(now + 65_000)).toBeNull();
    expect(values.size).toBe(0);
  });

  it.each([
    "", " ", "null", "{}", '{"until":123,"username":"someone"}',
    "NaN", "Infinity", "-1", "1.5", "1e20",
    String(now), String(now - 1), String(now + MAX_LOGIN_COOLDOWN_MS + 1),
    String(Number.MAX_SAFE_INTEGER),
  ])("discards invalid, expired or implausibly distant storage: %s", raw => {
    values.set(LOGIN_COOLDOWN_KEY, raw);
    expect(readLoginCooldown(now)).toBeNull();
    expect(values.has(LOGIN_COOLDOWN_KEY)).toBe(false);
  });

  it("accepts the maximum age but caps oversized server durations", () => {
    expect(startLoginCooldown(1e300, now)).toBe(now + MAX_LOGIN_COOLDOWN_MS);
    expect(readLoginCooldown(now)).toBe(now + MAX_LOGIN_COOLDOWN_MS);
    expect(readLoginCooldown(now - 1)).toBeNull();
    expect(startLoginCooldown(0.1, now)).toBe(now + 1000);
    for (const seconds of [0, -1, NaN, Infinity]) {
      expect(startLoginCooldown(seconds, now)).toBeNull();
    }
  });

  it("handles missing values and explicit cleanup", () => {
    expect(readLoginCooldown(now)).toBeNull();
    expect(loginCooldownSeconds(null, now)).toBe(0);
    startLoginCooldown(1, now);
    clearLoginCooldown();
    expect(values.size).toBe(0);
  });

  it("keeps the in-memory deadline if storage access itself is denied", () => {
    vi.stubGlobal("window", {
      get sessionStorage() { throw new Error("SecurityError"); },
    });
    expect(readLoginCooldown(now)).toBeNull();
    expect(startLoginCooldown(65, now)).toBe(now + 65_000);
    expect(() => clearLoginCooldown()).not.toThrow();
  });

  it("tolerates get, set and remove failures separately", () => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      const storage = {
        getItem: () => "invalid",
        setItem: () => {},
        removeItem: () => {},
      };
      storage[method] = () => { throw new Error("Storage unavailable"); };
      vi.stubGlobal("window", { sessionStorage: storage });
      expect(readLoginCooldown(now)).toBeNull();
      expect(startLoginCooldown(65, now)).toBe(now + 65_000);
      expect(() => clearLoginCooldown()).not.toThrow();
    }
  });
});
