import express from "express";
import { createServer, type Server } from "http";
import { readFileSync } from "fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import {
  setupAuth,
  createUser,
  PASSWORD_CHANGE_MAX_ATTEMPTS,
  PASSWORD_CHANGE_WINDOW_MS,
  resetPasswordChangeAttemptLimiter,
} from "../auth";
import { registerRoutes } from "../routes";
import { users } from "@shared/schema";
import { acceptedPasswords, rejectedPasswords } from "./helpers/password-policy";

const username = `session-password-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const originalPassword = "original-password";
const updatedPassword = "updated-password";
const rateLimitUsername = `password-limit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const rateLimitPassword = "rate-limit-password";

let server: Server;
let baseUrl: string;
let userId: string;
let rateLimitUserId: string;

function getSessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Login response did not set a session cookie");
  return setCookie.split(";")[0];
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

beforeAll(async () => {
  await pool.query(readFileSync(new URL("../migrations/014_login_attempts.sql", import.meta.url), "utf8"));
  const user = await createUser(username, originalPassword);
  userId = user.id;
  const rateLimitUser = await createUser(rateLimitUsername, rateLimitPassword);
  rateLimitUserId = rateLimitUser.id;

  const app = express();
  app.use(express.json());
  setupAuth(app);
  server = createServer(app);
  await registerRoutes(server, app);

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Test server did not expose a TCP address");
      }
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(users).where(eq(users.id, rateLimitUserId));
  await resetPasswordChangeAttemptLimiter();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("password change session continuity", () => {
  it("enforces the shared policy and messages without changing legacy credentials on rejection", async () => {
    await resetPasswordChangeAttemptLimiter();
    const legacyUsername = `legacy-policy-${crypto.randomUUID()}`;
    const user = await createUser(legacyUsername, "admin123");
    try {
      const login = await request("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: legacyUsername, password: "admin123" }),
      });
      expect(login.status).toBe(200);
      const cookie = getSessionCookie(login);
      const change = (newPassword: unknown, currentPassword: unknown = "admin123") =>
        request("/api/me/password", {
          method: "POST",
          headers: { Cookie: cookie },
          body: JSON.stringify({ currentPassword, newPassword }),
        });

      for (const [password, message] of rejectedPasswords) {
        const response = await change(password);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ message });
        const [stored] = await db.select().from(users).where(eq(users.id, user.id));
        expect(stored.password).toBe(user.password);
      }
      for (const [current, next] of [
        [undefined, "abcdefghijkl"], ["", "abcdefghijkl"], [123, "abcdefghijkl"],
        ["admin123", undefined], ["admin123", ""], ["admin123", 123],
      ]) {
        const response = await change(next, current ?? null);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ message: "currentPassword dan newPassword wajib diisi" });
      }
      // Invalid input is rejected before consuming password-guessing capacity.
      const attempts = await pool.query(
        "SELECT * FROM password_change_attempts WHERE attempt_key = $1", [`account:${user.id}`],
      );
      expect(attempts.rows).toHaveLength(0);

      let current = "admin123";
      for (const password of acceptedPasswords) {
        const response = await change(password, current);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ message: "Password berhasil diubah" });
        current = password;
        const session = await request("/api/me", { headers: { Cookie: cookie } });
        expect(session.status).toBe(200);
      }
      const loginWithExactPassword = await request("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: legacyUsername, password: current }),
      });
      expect(loginWithExactPassword.status).toBe(200);
    } finally {
      await db.delete(users).where(eq(users.id, user.id));
      await resetPasswordChangeAttemptLimiter();
    }
  });

  it("keeps the current session valid and accepts the new password after logout", async () => {
    const loginResponse = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password: originalPassword }),
    });
    expect(loginResponse.status).toBe(200);
    const sessionCookie = getSessionCookie(loginResponse);

    const changeResponse = await request("/api/me/password", {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({
        currentPassword: originalPassword,
        newPassword: updatedPassword,
      }),
    });
    expect(changeResponse.status).toBe(200);

    const currentSessionResponse = await request("/api/me", {
      headers: { Cookie: sessionCookie },
    });
    expect(currentSessionResponse.status).toBe(200);

    const logoutResponse = await request("/api/logout", {
      method: "POST",
      headers: { Cookie: sessionCookie },
    });
    expect(logoutResponse.status).toBe(200);

    const oldPasswordResponse = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password: originalPassword }),
    });
    expect(oldPasswordResponse.status).toBe(401);

    const newLoginResponse = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password: updatedPassword }),
    });
    expect(newLoginResponse.status).toBe(200);
    const newSessionCookie = getSessionCookie(newLoginResponse);

    const newSessionUserResponse = await request("/api/me", {
      headers: { Cookie: newSessionCookie },
    });
    expect(await newSessionUserResponse.json()).toMatchObject({
      id: userId,
      username,
    });
  });

  it("limits repeated failures and allows the account to recover after the window", async () => {
    await resetPasswordChangeAttemptLimiter();
    const loginResponse = await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ username: rateLimitUsername, password: rateLimitPassword }),
    });
    expect(loginResponse.status).toBe(200);
    const sessionCookie = getSessionCookie(loginResponse);

    for (let attempt = 0; attempt < PASSWORD_CHANGE_MAX_ATTEMPTS; attempt += 1) {
      const response = await request("/api/me/password", {
        method: "POST",
        headers: { Cookie: sessionCookie },
        body: JSON.stringify({
          currentPassword: "wrong-password",
          newPassword: "new-rate-limit-password",
        }),
      });
      expect(response.status).toBe(401);
    }

    const blockedResponse = await request("/api/me/password", {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({
        currentPassword: rateLimitPassword,
        newPassword: "new-rate-limit-password",
      }),
    });
    expect(blockedResponse.status).toBe(429);
    expect(await blockedResponse.json()).toEqual({
      message: "Terlalu banyak percobaan. Silakan coba lagi nanti.",
    });
    expect(blockedResponse.headers.get("retry-after")).toBeTruthy();

    await pool.query(
      `
        UPDATE password_change_attempts
        SET window_started_at =
          window_started_at - ($1::bigint * interval '1 millisecond')
      `,
      [PASSWORD_CHANGE_WINDOW_MS],
    );

    const recoveredResponse = await request("/api/me/password", {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: JSON.stringify({
        currentPassword: rateLimitPassword,
        newPassword: "new-rate-limit-password",
      }),
    });
    expect(recoveredResponse.status).toBe(200);

    const currentSessionResponse = await request("/api/me", {
      headers: { Cookie: sessionCookie },
    });
    expect(currentSessionResponse.status).toBe(200);
  });

  it("limits attempts from one source across accounts", async () => {
    await resetPasswordChangeAttemptLimiter();
    const edgeClientIp = "198.51.100.24";
    const firstUsername = `password-limit-first-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const secondUsername = `password-limit-second-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const thirdUsername = `password-limit-third-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const firstUser = await createUser(firstUsername, "first-password");
    const secondUser = await createUser(secondUsername, "second-password");
    const thirdUser = await createUser(thirdUsername, "third-password");

    try {
      const loginResponse = await request("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: firstUsername, password: "first-password" }),
      });
      expect(loginResponse.status).toBe(200);
      const firstSessionCookie = getSessionCookie(loginResponse);

      for (let attempt = 0; attempt < PASSWORD_CHANGE_MAX_ATTEMPTS - 1; attempt += 1) {
        const response = await request("/api/me/password", {
          method: "POST",
          headers: {
            Cookie: firstSessionCookie,
            "X-Forwarded-For": `203.0.113.${attempt + 1}, ${edgeClientIp}`,
          },
          body: JSON.stringify({
            currentPassword: "wrong-password",
            newPassword: "new-rate-limit-password",
          }),
        });
        expect(response.status).toBe(401);
      }

      const secondLoginResponse = await request("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: secondUsername, password: "second-password" }),
      });
      expect(secondLoginResponse.status).toBe(200);
      const secondSessionCookie = getSessionCookie(secondLoginResponse);
      const successfulResponse = await request("/api/me/password", {
        method: "POST",
        headers: {
          Cookie: secondSessionCookie,
          "X-Forwarded-For": `203.0.113.100, ${edgeClientIp}`,
        },
        body: JSON.stringify({
          currentPassword: "second-password",
          newPassword: "new-second-password",
        }),
      });
      expect(successfulResponse.status).toBe(200);

      const finalFailureResponse = await request("/api/me/password", {
        method: "POST",
        headers: {
          Cookie: firstSessionCookie,
          "X-Forwarded-For": `203.0.113.101, ${edgeClientIp}`,
        },
        body: JSON.stringify({
          currentPassword: "wrong-password",
          newPassword: "new-rate-limit-password",
        }),
      });
      expect(finalFailureResponse.status).toBe(401);

      const thirdLoginResponse = await request("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: thirdUsername, password: "third-password" }),
      });
      expect(thirdLoginResponse.status).toBe(200);
      const thirdSessionCookie = getSessionCookie(thirdLoginResponse);
      const blockedResponse = await request("/api/me/password", {
        method: "POST",
        headers: {
          Cookie: thirdSessionCookie,
          "X-Forwarded-For": `203.0.113.102, ${edgeClientIp}`,
        },
        body: JSON.stringify({
          currentPassword: "third-password",
          newPassword: "new-third-password",
        }),
      });
      expect(blockedResponse.status).toBe(429);
    } finally {
      await db.delete(users).where(eq(users.id, firstUser.id));
      await db.delete(users).where(eq(users.id, secondUser.id));
      await db.delete(users).where(eq(users.id, thirdUser.id));
    }
  });

  it("keeps rate limits separate for distinct clients behind the trusted proxy", async () => {
    await resetPasswordChangeAttemptLimiter();
    const firstUsername = `password-client-first-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const secondUsername = `password-client-second-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const firstUser = await createUser(firstUsername, "first-password");
    const secondUser = await createUser(secondUsername, "second-password");

    try {
      const firstLoginResponse = await request("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: firstUsername, password: "first-password" }),
      });
      const secondLoginResponse = await request("/api/login", {
        method: "POST",
        body: JSON.stringify({ username: secondUsername, password: "second-password" }),
      });
      expect(firstLoginResponse.status).toBe(200);
      expect(secondLoginResponse.status).toBe(200);
      const firstSessionCookie = getSessionCookie(firstLoginResponse);
      const secondSessionCookie = getSessionCookie(secondLoginResponse);

      for (let attempt = 0; attempt < PASSWORD_CHANGE_MAX_ATTEMPTS; attempt += 1) {
        const response = await request("/api/me/password", {
          method: "POST",
          headers: {
            Cookie: firstSessionCookie,
            "X-Forwarded-For": "198.51.100.30",
          },
          body: JSON.stringify({
            currentPassword: "wrong-password",
            newPassword: "new-first-password",
          }),
        });
        expect(response.status).toBe(401);
      }

      const secondClientResponse = await request("/api/me/password", {
        method: "POST",
        headers: {
          Cookie: secondSessionCookie,
          "X-Forwarded-For": "198.51.100.31",
        },
        body: JSON.stringify({
          currentPassword: "second-password",
          newPassword: "new-second-password",
        }),
      });
      expect(secondClientResponse.status).toBe(200);
    } finally {
      await db.delete(users).where(eq(users.id, firstUser.id));
      await db.delete(users).where(eq(users.id, secondUser.id));
    }
  });
});