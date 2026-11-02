import { randomUUID } from "node:crypto";
import { test as base, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { db, pool } from "../server/db";
import { createUser } from "../server/auth";
import { storage } from "../server/storage";
import { missionSubmissionsTable, practiceMissionsTable, users } from "../shared/schema";

const password = "Browser-Reminder-Disposable-2026!";
export const checklist = ["Periksa fakta lapangan", "Catat langkah tindak lanjut"];
export const evidenceText = "Fakta telah diperiksa dan tindak lanjut telah dicatat bersama penanggung jawab pekerjaan.";
export const remindersPath = "/api/practice-missions/reminders";
export const emptyMessage = "Tidak ada jadwal latihan ulang yang perlu ditindaklanjuti.";
export const beforeMidnight = new Date("2026-11-01T16:59:40.000Z");
export const reminderCard = (page: Page) => page.locator("div.rounded-xl")
  .filter({ has: page.getByText("Pengingat latihan ulang", { exact: true }) }).first();

type Mission = { id: string; title: string; submissionId: string };
type Fixture = {
  signIn(page: Page): Promise<void>;
  mission(label: string): Promise<Mission>;
  review(mission: Mission, date?: string): Promise<void>;
};

async function post(api: APIRequestContext, url: string, data: unknown, status: number) {
  const response = await api.post(url, { data });
  expect(response.status(), `${url}: ${await response.text()}`).toBe(status);
  return response.json();
}

export const test = base.extend<{ learner: Fixture }, { databasePool: void }>({
  // Files share the worker's imported pool; a per-file afterAll closes it
  // before the next spec can create its fixtures.
  databasePool: [async ({}, use) => {
    try { await use(); } finally { await pool.end(); }
  }, { scope: "worker", auto: true }],
  learner: async ({ playwright, baseURL }, use) => {
    const tag = randomUUID();
    const username = `reminder-learner-${tag}`;
    const adminName = `reminder-admin-${tag}`;
    const userIds: string[] = [];
    const missionIds: string[] = [];
    const signedInPages: Page[] = [];
    let participantId: string | undefined;
    let courseId: string | undefined;
    const admin = await playwright.request.newContext({ baseURL });
    const participant = await playwright.request.newContext({ baseURL });
    try {
      participantId = (await storage.createParticipant({
        name: "Peserta Uji Pengingat", email: `${username}@example.test`,
        nip: tag, position: "Staf", unit: "Pengujian",
      })).id;
      userIds.push((await createUser(username, password, { role: "participant", participantId })).id);
      userIds.push((await createUser(adminName, password, { role: "admin" })).id);
      courseId = (await storage.createCourse({
        unitId: "tender-01", targetLevel: "L2", title: `Browser reminder ${tag}`,
        description: "Disposable practice reminder browser fixture", duration: "1 jam",
      })).id;
      await storage.createEnrollment(participantId, courseId);
      await post(admin, "/api/login", { username: adminName, password }, 200);
      await post(participant, "/api/login", { username, password }, 200);
      await use({
        async signIn(page) {
          await page.goto("/login");
          await page.locator("#username").fill(username);
          await page.locator("#password").fill(password);
          await page.getByRole("button", { name: "Masuk", exact: true }).click();
          await expect(page.getByTestId("button-user-menu")).toBeVisible();
          const me = await (await page.request.get("/api/me")).json();
          expect(me.participantId).toBe(participantId);
          signedInPages.push(page);
        },
        async mission(label) {
          const mission = await post(admin, "/api/practice-missions", {
            courseId, title: `Pengingat ${label}`, durationMinutes: 10, checklist,
            objective: "Mencatat fakta dan tindak lanjut yang dapat diperiksa.",
            scenario: "Periksa kondisi lapangan, pisahkan fakta dari asumsi, lalu tentukan tindak lanjut.",
          }, 201);
          missionIds.push(mission.id);
          const submission = await post(participant, `/api/practice-missions/${mission.id}/submissions`, {
            submissionKey: randomUUID(), completedChecklist: checklist, evidenceText,
          }, 201);
          return { id: mission.id, title: mission.title, submissionId: submission.id };
        },
        async review(mission, date = "2026-11-02") {
          await post(admin, `/api/practice-missions/submissions/${mission.submissionId}/review`, {
            status: "repeat_requested", feedback: "Terapkan umpan balik ini pada putaran berikutnya.",
            nextPracticeAt: date,
          }, 200);
        },
      });
    } finally {
      // Normal logout removes test sessions; cleanup also runs after assertion failures.
      try {
        await Promise.all([
          admin.post("/api/logout"), participant.post("/api/logout"),
          ...signedInPages.map(page => page.request.post("/api/logout")),
        ]);
      } finally {
        await Promise.all([admin.dispose(), participant.dispose()]);
        if (missionIds.length) {
          await db.delete(missionSubmissionsTable).where(inArray(missionSubmissionsTable.missionId, missionIds));
          await db.delete(practiceMissionsTable).where(inArray(practiceMissionsTable.id, missionIds));
        }
        if (courseId) await storage.deleteCourse(courseId);
        if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
        if (participantId) await storage.deleteParticipant(participantId);
      }
    }
  },
});

export async function freezeClock(page: Page) {
  // install() starts a running clock. Leave room for the next browser round
  // trip so pauseAt() cannot target a time that has already elapsed.
  await page.clock.install({ time: new Date(beforeMidnight.getTime() - 1_000) });
  await page.clock.pauseAt(beforeMidnight);
}

// TanStack Query batches browser notifications with setTimeout(0). Tick those
// callbacks while waiting for real network I/O, without unpausing the long timers.
export async function visibleWithClock(page: Page, locator: Locator) {
  await expect.poll(async () => {
    await page.clock.runFor(10);
    return locator.isVisible();
  }).toBe(true);
}

export function watchReminders(page: Page) {
  const requests: string[] = [];
  page.on("request", request => {
    if (new URL(request.url()).pathname === remindersPath) requests.push(request.url());
  });
  return requests;
}

export async function spaNavigate(page: Page, href: string) {
  await page.locator(`a[href="${href}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
}
