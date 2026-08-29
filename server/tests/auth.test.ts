import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  changeUserPassword,
  comparePassword,
  createUser,
} from "../auth";
import { users } from "@shared/schema";

const createdUserIds: string[] = [];

afterAll(async () => {
  for (const id of createdUserIds) {
    await db.delete(users).where(eq(users.id, id));
  }
});

describe("changeUserPassword", () => {
  it("updates the password while keeping the same user account", async () => {
    const username = `password-test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const user = await createUser(username, "current-password");
    createdUserIds.push(user.id);

    await expect(
      changeUserPassword(user.id, "current-password", "new-password"),
    ).resolves.toBe("updated");

    const [storedUser] = await db.select().from(users).where(eq(users.id, user.id));
    expect(storedUser).toBeDefined();
    expect(await comparePassword("current-password", storedUser.password)).toBe(false);
    expect(await comparePassword("new-password", storedUser.password)).toBe(true);
  });

  it("does not change the password when the current password is incorrect", async () => {
    const username = `password-invalid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const user = await createUser(username, "current-password");
    createdUserIds.push(user.id);

    await expect(
      changeUserPassword(user.id, "wrong-password", "new-password"),
    ).resolves.toBe("invalid_current_password");

    const [storedUser] = await db.select().from(users).where(eq(users.id, user.id));
    expect(await comparePassword("current-password", storedUser.password)).toBe(true);
  });

  it("reports a missing user without attempting an update", async () => {
    await expect(
      changeUserPassword("missing-user-id", "current-password", "new-password"),
    ).resolves.toBe("user_not_found");
  });
});