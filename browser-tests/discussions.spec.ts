import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";
import { createUser } from "../server/auth";
import {
  bujksTable, notificationsTable, participantsTable, users,
} from "../shared/schema";

const tag = randomUUID();
const password = `Disposable-${randomUUID()}!`;
const groupId = randomUUID();
const accounts: string[] = [], participants: string[] = [];
const names = { learner: `forum-learner-${tag}`, admin: `forum-admin-${tag}`, pic: `forum-pic-${tag}`, solo: `forum-solo-${tag}`, other: `forum-other-${tag}` };
let courseId = "";
const question = "Bagaimana mengukur toleransi sambungan beton?";
const reply = "Bandingkan hasil pengukuran dengan spesifikasi teknis proyek.";
async function login(page: Page, role: keyof typeof names) {
  await page.goto("/login");
  await page.locator("#username").fill(names[role]);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByTestId("button-user-menu")).toBeVisible();
}
async function logout(page: Page) {
  await page.getByTestId("button-user-menu").click();
  await page.getByTestId("menu-item-logout").click();
  await expect(page).toHaveURL(/\/login$/);
}
async function openForum(page: Page) {
  await page.goto(`/app/discussions/${courseId}`);
  await expect(page.getByRole("heading", { name: `Forum browser ${tag}`, exact: true })).toBeVisible();
}
test.beforeAll(async () => {
  await mkdir("generated-artifacts/discussions", { recursive: true });
  await db.insert(bujksTable).values({ id: groupId, name: `Forum browser ${tag}`, createdAt: new Date().toISOString() });
  courseId = (await storage.createCourse({
    unitId: "tender-01", targetLevel: "L2", title: `Forum browser ${tag}`,
    description: "Kursus uji forum", duration: "15 menit",
  })).id;
  for (const key of Object.keys(names) as Array<keyof typeof names>) {
    let participantId: string | undefined;
    if (["learner", "solo", "other"].includes(key)) {
      participantId = (await storage.createParticipant({
        name: `Forum ${key} ${tag}`, email: `forum-${key}-${tag}@example.test`, nip: randomUUID(),
        position: "Teknik", unit: "Unit", ...(key === "learner" ? { bujkId: groupId } : {}),
      })).id;
      participants.push(participantId);
      await storage.createEnrollment(participantId, courseId);
    }
    accounts.push((await createUser(names[key], password, {
      role: key === "admin" ? "admin" : key === "pic" ? "bujk_pic" : "participant",
      participantId, ...(["learner", "pic"].includes(key) ? { bujkId: groupId } : {}),
    })).id);
  }
});
test.afterAll(async () => {
  try {
    if (courseId) await storage.deleteCourse(courseId);
    if (accounts.length) {
      await db.delete(notificationsTable).where(inArray(notificationsTable.userId, accounts));
      await db.delete(users).where(inArray(users.id, accounts));
    }
    for (const id of participants) await storage.deleteParticipant(id);
    await db.delete(bujksTable).where(eq(bujksTable.id, groupId));
  } finally { await pool.end(); }
});

test("normal login: mobile course link, persisted discussion, moderation, notification and private boundary", async ({ page }) => {
  await login(page, "learner");
  const courseCard = page.locator(".shadcn-card").filter({ hasText: `Forum browser ${tag}` });
  await courseCard.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page.getByRole("link", { name: "Diskusi teknis kursus", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/app/discussions/${courseId}`));
  await expect(page.getByText("Belum ada topik diskusi")).toBeVisible();
  await page.getByLabel("Judul pertanyaan").fill(question);
  await page.getByLabel("Isi pertanyaan teknis").fill("Apa langkah pemeriksaan yang tepat sebelum pengecoran sambungan?");
  await page.getByRole("button", { name: "Terbitkan pertanyaan", exact: true }).click();
  await expect(page.getByRole("heading", { name: question, exact: true })).toBeVisible();
  await page.getByLabel(`Tanggapan untuk ${question}`).fill(reply);
  await page.getByRole("button", { name: "Kirim tanggapan", exact: true }).click();
  await expect(page.getByText(reply, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(reply, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await logout(page);
  await login(page, "admin");
  await page.getByTestId("button-notifications").click();
  await page.getByText("Balasan diskusi baru", { exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`/app/discussions/${courseId}\\?thread=`));
  await page.getByRole("button", { name: "Tandai sebagai membantu", exact: true }).click();
  await expect(page.getByText("Membantu", { exact: true })).toBeVisible();
  const post = page.getByText(reply, { exact: true }).locator("..");
  await post.getByRole("button", { name: "Moderasi", exact: true }).click();
  await page.getByLabel("Alasan moderasi").fill("Perlu pemeriksaan sumber teknis.");
  await page.getByRole("button", { name: "Simpan moderasi", exact: true }).click();
  await expect(page.getByText("Tanggapan disembunyikan", { exact: true })).toBeVisible();
  await logout(page);
  await login(page, "pic");
  await openForum(page);
  await expect(page.getByText(question, { exact: true })).toBeVisible();
  await expect(page.getByText(reply, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kirim tanggapan", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Moderasi", exact: true })).toHaveCount(0);
  await page.screenshot({ path: "generated-artifacts/discussions/mobile-coordinator.jpg", fullPage: true });
  await logout(page);
  await login(page, "solo");
  await openForum(page);
  await expect(page.getByText(question, { exact: true })).toHaveCount(0);
  await page.getByLabel("Judul pertanyaan").fill("Pertanyaan mandiri yang privat");
  await page.getByLabel("Isi pertanyaan teknis").fill("Bagaimana memastikan pemeriksaan mandiri tetap konsisten?");
  await page.getByRole("button", { name: "Terbitkan pertanyaan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pertanyaan mandiri yang privat" })).toBeVisible();
  await logout(page);
  await login(page, "other");
  await openForum(page);
  await expect(page.getByText("Pertanyaan mandiri yang privat", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Belum ada topik diskusi")).toBeVisible();
  await page.route(`**/api/courses/${courseId}/discussions`, route => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Uji kegagalan koneksi" }) }));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Diskusi belum dapat dimuat" })).toBeVisible();
  await page.unroute(`**/api/courses/${courseId}/discussions`);
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.getByText("Belum ada topik diskusi")).toBeVisible();
});

test("old notification links reauthorize group membership without revealing cached content", async ({ page, browser }) => {
  const secretTitle = "Topik kelompok yang dicabut aksesnya";
  const secretBody = "Isi diskusi kelompok lama tidak boleh ditampilkan kembali.";
  const adminContext = await browser.newContext();
  let release: (() => void) | undefined;
  try {
    await login(page, "learner");
    const created = await page.request.post(`/api/courses/${courseId}/discussions`, {
      data: { title: secretTitle, body: secretBody },
    });
    expect(created.status()).toBe(201);
    const { id: threadId } = await created.json();
    const alternate = await page.request.post(`/api/courses/${courseId}/discussions`, {
      data: { title: "Topik kelompok kedua untuk tautan berbeda", body: "Konteks kelompok kedua tetap terbatas pada anggota aktif." },
    });
    expect(alternate.status()).toBe(201);
    const { id: alternateId } = await alternate.json();
    const adminPage = await adminContext.newPage();
    await login(adminPage, "admin");
    const notices = [];
    for (const id of [threadId, alternateId]) {
      expect((await adminPage.request.post(`/api/discussions/${id}/replies`, {
        data: { body: "Jawaban fasilitator untuk pemeriksaan akses ulang." },
      })).status()).toBe(201);
      const [notification] = await db.select().from(notificationsTable).where(and(
        eq(notificationsTable.userId, accounts[0]),
        eq(notificationsTable.link, `/app/discussions/${courseId}?thread=${id}`),
        eq(notificationsTable.title, "Balasan diskusi baru"),
      ));
      expect(notification).toBeTruthy();
      notices.push(notification);
    }
    const [notice, alternateNotice] = notices;
    expect(notice).toBeTruthy();
    // Initial document load is allowed; every navigation below keeps this runtime
    // and its query cache, so a reload cannot mask a stale-content disclosure.
    await openForum(page);
    await expect(page.getByRole("heading", { name: secretTitle })).toBeVisible();
    const runtime = randomUUID();
    await page.evaluate(value => { (window as any).__forumPrivacyRuntime = value; }, runtime);

    for (const origin of ["return-to-forum", "same-forum-same-thread", "same-forum-other-thread"]) {
      await db.update(participantsTable).set({ bujkId: null }).where(eq(participantsTable.id, participants[0]));
      if (origin === "return-to-forum") await page.getByRole("link", { name: "Kembali ke beranda" }).click();
      let received!: () => void;
      const requestReceived = new Promise<void>(resolve => { received = resolve; });
      const gate = new Promise<void>(resolve => { release = resolve; });
      await page.route(`**/api/courses/${courseId}/discussions`, async route => {
        const response = await route.fetch(); // Real newly authorized payload, not fabricated data.
        received();
        await gate;
        await route.fulfill({ response });
      });
      await page.getByTestId("button-notifications").click();
      await page.getByTestId(`notification-item-${origin === "same-forum-other-thread" ? alternateNotice.id : notice.id}`).click();
      await requestReceived;
      await expect(page.getByRole("status", { name: "Memuat diskusi" })).toBeVisible();
      await expect(page.getByText(secretTitle, { exact: true })).toHaveCount(0);
      await expect(page.getByText(secretBody, { exact: true })).toHaveCount(0);
      release!();
      await expect(page.getByRole("status", { name: "Memuat diskusi" })).toHaveCount(0);
      await expect(page.getByText(secretTitle, { exact: true })).toHaveCount(0);
      await expect(page.getByText("Topik pada tautan tidak tersedia atau tidak termasuk dalam akses Anda.")).toBeVisible();
      expect(await page.evaluate(() => (window as any).__forumPrivacyRuntime)).toBe(runtime);
      await page.unroute(`**/api/courses/${courseId}/discussions`);
      await db.update(participantsTable).set({ bujkId: groupId }).where(eq(participantsTable.id, participants[0]));
      await page.getByTestId("button-notifications").click();
      await page.getByTestId(`notification-item-${notice.id}`).click();
      await expect(page.getByRole("heading", { name: secretTitle })).toBeVisible();
    }
  } finally {
    release?.();
    await page.unroute(`**/api/courses/${courseId}/discussions`);
    await db.update(participantsTable).set({ bujkId: groupId }).where(eq(participantsTable.id, participants[0]));
    await adminContext.close();
  }
});
