import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { setupAuth, createUser } from "../auth";
import { registerRoutes } from "../routes";
import { users } from "@shared/schema";

const username = `session-password-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const originalPassword = "original-password";
const updatedPassword = "updated-password";

let server: Server;
let baseUrl: string;
let userId: string;

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
  const user = await createUser(username, originalPassword);
  userId = user.id;

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
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("password change session continuity", () => {
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
});