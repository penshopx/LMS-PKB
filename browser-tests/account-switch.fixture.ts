import { randomUUID } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { test as base, checklist, evidenceText } from "./practice-reminders.fixture";
import { db } from "../server/db";
import { createUser } from "../server/auth";
import { storage } from "../server/storage";
import { bujksTable, missionSubmissionsTable, practiceMissionsTable, users } from "../shared/schema";

type Account = {
  username: string;
  id: string;
  participantId?: string;
  bujkId: string;
};
type SwitchFixture = {
  setup(sameBujk: boolean): Promise<{
    a: Account; b: Account; pic: Account;
    titleA: string; titleB: string; reflectionA: string; reflectionB: string;
  }>;
  signIn(page: Page, account: Account): Promise<void>;
};
const password = "Browser-Switch-Disposable-2026!";

export const test = base.extend<{ accounts: SwitchFixture }>({
  accounts: async ({ playwright, baseURL }, use) => {
    const tag = randomUUID();
    const userIds: string[] = [], participantIds: string[] = [], courseIds: string[] = [];
    const missionIds: string[] = [], bujkIds: string[] = [];
    const contexts: APIRequestContext[] = [];
    const pages = new Set<Page>();
    async function apiFor(username: string) {
      const api = await playwright.request.newContext({ baseURL });
      contexts.push(api);
      const response = await api.post("/api/login", { data: { username, password } });
      expect(response.status()).toBe(200);
      return api;
    }
    async function account(label: string, role: "participant" | "bujk_pic", bujkId: string): Promise<Account> {
      const username = `switch-${label}-${tag}`;
      let participantId: string | undefined;
      if (role === "participant") {
        participantId = (await storage.createParticipant({
          name: `Peserta ${label}`, email: `${username}@example.test`, nip: randomUUID(),
          position: "Staf", unit: "Pengujian", bujkId,
        })).id;
        participantIds.push(participantId);
      }
      const user = await createUser(username, password, { role, bujkId, participantId });
      userIds.push(user.id);
      return { username, id: user.id, participantId, bujkId };
    }
    try {
      await use({
        async setup(sameBujk) {
          for (const label of ["a", "b"]) {
            const id = `switch-${label}-${tag}`;
            await db.insert(bujksTable).values({ id, name: id, createdAt: new Date().toISOString() });
            bujkIds.push(id);
          }
          const a = await account("a", "participant", bujkIds[0]);
          const b = await account("b", "participant", bujkIds[sameBujk ? 0 : 1]);
          const pic = await account("pic", "bujk_pic", bujkIds[0]);
          const adminName = `switch-admin-${tag}`;
          userIds.push((await createUser(adminName, password, { role: "admin" })).id);
          const admin = await apiFor(adminName);
          const titles: string[] = [], reflections: string[] = [];
          for (const [index, learner] of [a, b].entries()) {
            // Separate courses ensure A's unique title is not legitimate catalog data for B.
            const course = await storage.createCourse({
              unitId: "tender-01", targetLevel: "L2", title: `Switch ${index} ${tag}`,
              description: "Disposable account-switch fixture", duration: "1 jam",
            });
            courseIds.push(course.id);
            await storage.createEnrollment(learner.participantId!, course.id);
            const title = `Pengingat privat ${index} ${tag}`;
            const reflection = `Refleksi rahasia ${index} ${tag}`;
            titles.push(title);
            reflections.push(reflection);
            const created = await admin.post("/api/practice-missions", { data: {
              courseId: course.id, title, durationMinutes: 10, checklist,
              objective: "Mencatat fakta dan tindak lanjut yang dapat diperiksa.",
              scenario: "Periksa kondisi lapangan lalu tentukan tindak lanjut.",
            } });
            expect(created.status()).toBe(201);
            const mission = await created.json();
            missionIds.push(mission.id);
            const api = await apiFor(learner.username);
            const submitted = await api.post(`/api/practice-missions/${mission.id}/submissions`, { data: {
              submissionKey: randomUUID(), completedChecklist: checklist, evidenceText, privateReflection: reflection,
            } });
            expect(submitted.status()).toBe(201);
            const submission = await submitted.json();
            const reviewed = await admin.post(`/api/practice-missions/submissions/${submission.id}/review`, { data: {
              status: "repeat_requested", feedback: "Terapkan umpan balik pada putaran berikutnya.",
              nextPracticeAt: index === 0 ? "2026-11-03" : "2026-11-07",
            } });
            expect(reviewed.status()).toBe(200);
          }
          return { a, b, pic, titleA: titles[0], titleB: titles[1], reflectionA: reflections[0], reflectionB: reflections[1] };
        },
        async signIn(page, account) {
          // No goto/reload: preserve the actual JS runtime and query cache across accounts.
          pages.add(page);
          await page.locator("#username").fill(account.username);
          await page.locator("#password").fill(password);
          await page.getByRole("button", { name: "Masuk", exact: true }).click();
          await expect(page).toHaveURL(/\/app$/);
          await expect(page.getByTestId("button-user-menu")).toBeVisible();
          const me = await (await page.request.get("/api/me")).json();
          expect(me.id).toBe(account.id);
        },
      });
    } finally {
      try {
        await Promise.all([
          ...contexts.map(api => api.post("/api/logout")),
          ...[...pages].map(page => page.request.post("/api/logout")),
        ]);
      } finally {
        await Promise.all(contexts.map(api => api.dispose()));
        if (missionIds.length) {
          await db.delete(missionSubmissionsTable).where(inArray(missionSubmissionsTable.missionId, missionIds));
          await db.delete(practiceMissionsTable).where(inArray(practiceMissionsTable.id, missionIds));
        }
        for (const id of courseIds) await storage.deleteCourse(id);
        if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
        for (const id of participantIds) await storage.deleteParticipant(id);
        if (bujkIds.length) await db.delete(bujksTable).where(inArray(bujksTable.id, bujkIds));
      }
    }
  },
});

export async function signOut(page: Page) {
  await page.getByTestId("button-user-menu").click();
  await page.getByTestId("menu-item-logout").click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("#username")).toBeVisible();
}
