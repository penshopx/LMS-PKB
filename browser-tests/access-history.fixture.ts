import { randomUUID } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { db, pool } from "../server/db";
import { createUser } from "../server/auth";
import { accountStatusHistory, users } from "../shared/schema";

type SeedEntry = typeof accountStatusHistory.$inferInsert;
type Account = { id: string; username: string };
type HistoryFixture = {
  admin: Account;
  target: Account;
  entries: SeedEntry[];
  signIn(page: Page): Promise<void>;
};

export const test = base.extend<{ history: HistoryFixture }, { databasePool: void }>({
  databasePool: [async ({}, use) => {
    try { await use(); } finally { await pool.end(); }
  }, { scope: "worker", auto: true }],
  history: async ({ context }, use) => {
    const tag = randomUUID();
    const password = `Disposable-History-${randomUUID()}!`;
    const accounts: Account[] = [];
    const entries: SeedEntry[] = [];
    try {
      for (const label of ["admin", "other-admin", "target", "other-target"]) {
        accounts.push(await createUser(`history-${label}-${tag}`, password, {
          role: label.endsWith("admin") ? "admin" : "participant",
        }));
      }
      const [admin, otherAdmin, target, otherTarget] = accounts;
      function entry(instant: string, actor = admin, subject = target) {
        const id = randomUUID();
        entries.push({
          id, actorId: actor.id, actorUsername: actor.username,
          targetUserId: subject.id, targetUsername: subject.username,
          previousIsActive: true, newIsActive: false,
          reason: `Browser history ${tag} ${id}`, changedAt: new Date(instant),
        });
      }
      // 52 matching entries on March 10 WIB, plus adjacent-day exclusions.
      entry("2030-03-09T16:59:59.999Z");
      entry("2030-03-09T17:00:00.000Z");
      for (let i = 0; i < 50; i++) {
        entry(new Date(Date.UTC(2030, 2, 10, 8, 0, i)).toISOString());
      }
      entry("2030-03-10T16:59:59.999Z");
      entry("2030-03-10T17:00:00.000Z");
      // Each distractor satisfies all filters except actor or target.
      entry("2030-03-10T09:00:00.000Z", otherAdmin);
      entry("2030-03-10T10:00:00.000Z", admin, otherTarget);
      await db.insert(accountStatusHistory).values(entries);
      await use({
        admin, target, entries,
        async signIn(page) {
          await page.goto("/login");
          await page.locator("#username").fill(admin.username);
          await page.locator("#password").fill(password);
          await page.getByRole("button", { name: "Masuk", exact: true }).click();
          await expect(page.getByTestId("button-user-menu")).toBeVisible();
          const me = await context.request.get("/api/me");
          expect(me.status()).toBe(200);
          expect(await me.json()).toMatchObject({ id: admin.id, role: "admin" });
          await page.goto("/app/access");
          await expect(page.getByText("Riwayat perubahan status akun", { exact: true })).toBeVisible();
        },
      });
    } finally {
      try {
        await context.request.post("/api/logout");
      } finally {
        const ids = accounts.map(account => account.id);
        if (ids.length) {
          // Also remove a session if logout failed after login had committed.
          await pool.query(`DELETE FROM "session" WHERE sess->'passport'->'user'->>'id' = ANY($1::text[])`, [ids]);
          await db.delete(accountStatusHistory).where(inArray(accountStatusHistory.actorId, ids));
          await db.delete(users).where(inArray(users.id, ids));
          expect(await db.select({ id: accountStatusHistory.id }).from(accountStatusHistory)
            .where(inArray(accountStatusHistory.actorId, ids)), "fixture history cleanup").toEqual([]);
          expect(await db.select({ id: users.id }).from(users)
            .where(inArray(users.id, ids)), "fixture account cleanup").toEqual([]);
        }
      }
    }
  },
});
