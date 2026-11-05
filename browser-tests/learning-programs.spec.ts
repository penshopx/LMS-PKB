import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "crypto";
import { inArray } from "drizzle-orm";
import { mkdir } from "node:fs/promises";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";
import { createUser } from "../server/auth";
import { bujksTable, learningProgramsTable, notificationsTable, users } from "../shared/schema";
import { dayOffset, learningDay, type LearningProgramView } from "../shared/learning-program";

const tag = randomUUID();
const password = `Disposable-${randomUUID()}!`;
const groups = [randomUUID(), randomUUID()];
const groupNames = [`Kelompok A ${tag}`, `Kelompok B ${tag}`];
const names = { admin: `lp-admin-${tag}`, learner: `lp-learner-${tag}`, pic: `lp-pic-${tag}` };
const userIds: string[] = [];
const participantIds: string[] = [];
const courseTitle = `Inspeksi struktur ${tag}`;
const programTitle = `Program inspeksi ${tag}`;
let courseId = "";

async function signIn(page: Page, role: keyof typeof names) {
  await page.goto("/login");
  await page.locator("#username").fill(names[role]);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByTestId("button-user-menu")).toBeVisible();
  if (!await page.getByRole("link", { name: "Rencana Belajar PKB", exact: true }).isVisible()) {
    await page.getByTestId("button-sidebar-toggle").click();
  }
  await page.getByRole("link", { name: "Rencana Belajar PKB", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/learning-programs$/);
  await page.keyboard.press("Escape");
}

async function chooseCourse(page: Page) {
  await page.locator("#program-course").click();
  await page.getByRole("option", { name: courseTitle, exact: true }).click();
}

test.beforeAll(async () => {
  await mkdir("generated-artifacts/learning-programs", { recursive: true });
  await db.insert(bujksTable).values(groups.map((id, i) => ({
    id, name: groupNames[i], createdAt: new Date().toISOString(),
  })));
  for (let i = 0; i < 2; i++) participantIds.push((await storage.createParticipant({
    name: `Peserta browser ${i} ${tag}`, email: `lp-${i}-${tag}@example.test`,
    nip: randomUUID(), position: "Teknik", unit: `Unit browser ${i}`, bujkId: groups[i],
  })).id);
  userIds.push((await createUser(names.admin, password, { role: "admin" })).id);
  userIds.push((await createUser(names.learner, password, { role: "participant", participantId: participantIds[0], bujkId: groups[0] })).id);
  userIds.push((await createUser(names.pic, password, { role: "bujk_pic", bujkId: groups[0] })).id);
  courseId = (await storage.createCourse({
    unitId: "tender-01", targetLevel: "L2", title: courseTitle,
    description: "Kursus uji browser rencana belajar, akan dibersihkan.", duration: "20 menit",
  })).id;
});

test.afterAll(async () => {
  try {
    if (userIds.length) {
      await db.delete(learningProgramsTable).where(inArray(learningProgramsTable.createdBy, userIds));
      await db.delete(notificationsTable).where(inArray(notificationsTable.userId, userIds));
      await db.delete(users).where(inArray(users.id, userIds));
    }
    for (const id of participantIds) await storage.deleteParticipant(id);
    if (courseId) await storage.deleteCourse(courseId);
    await db.delete(bujksTable).where(inArray(bujksTable.id, groups));
  } finally {
    await pool.end();
  }
});

test("admin assigns, learner starts and manages private goals, coordinator sees only own group", async ({ browser, baseURL }) => {
  const adminContext = await browser.newContext({ baseURL });
  const learnerContext = await browser.newContext({ baseURL, viewport: { width: 402, height: 874 } });
  const picContext = await browser.newContext({ baseURL });
  try {
    const admin = await adminContext.newPage();
    await signIn(admin, "admin");
    await admin.getByRole("button", { name: "Buat program", exact: true }).first().click();
    let dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Judul target").fill(programTitle);
    await chooseCourse(admin);
    await dialog.getByLabel("Batas waktu", { exact: true }).fill(dayOffset(learningDay(), 5));
    for (const name of groupNames) {
      await dialog.locator("label").filter({ hasText: name }).getByRole("checkbox").click();
    }
    const created = admin.waitForResponse(response => response.url().endsWith("/api/learning-programs") && response.request().method() === "POST");
    await dialog.getByRole("button", { name: "Buat target", exact: true }).click();
    expect((await created).status()).toBe(201);
    await expect(dialog).not.toBeVisible();
    let row = admin.locator("article").filter({ hasText: programTitle });
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: "Ubah", exact: true })).toHaveCount(1);
    const programs: LearningProgramView[] = await (await admin.request.get("/api/learning-programs")).json();
    const assigned = programs.find(program => program.title === programTitle)!;
    expect(assigned.members).toHaveLength(2);
    await row.getByRole("button", { name: "Ubah", exact: true }).click();
    dialog = admin.getByRole("dialog");
    await dialog.getByLabel("Batas waktu", { exact: true }).fill(dayOffset(learningDay(), -1));
    await dialog.getByRole("button", { name: "Simpan perubahan", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(row.getByText("Terlambat", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Ingatkan", exact: true }).click();
    await admin.getByRole("dialog").getByRole("button", { name: "Kirim pengingat", exact: true }).click();
    await expect(admin.getByRole("status").filter({ hasText: "akun peserta" })).toBeVisible();
    await admin.screenshot({ path: "generated-artifacts/learning-programs/admin.jpg", fullPage: true });

    const learner = await learnerContext.newPage();
    await signIn(learner, "learner");
    await expect(learner.getByRole("heading", { name: "Rencana belajar saya" })).toBeVisible();
    row = learner.locator("article").filter({ hasText: programTitle });
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: "Ubah", exact: true })).toHaveCount(0);
    await row.getByRole("button", { name: "Lanjutkan", exact: true }).click();
    await learner.getByRole("button", { name: "Mulai dan simpan progres", exact: true }).click();
    await learner.getByRole("button", { name: "Tandai lesson selesai", exact: true }).click();
    await expect(learner.getByRole("button", { name: "Menyimpan progres..." })).toHaveCount(0);
    await learner.keyboard.press("Escape");
    await expect(learner.getByRole("dialog")).toHaveCount(0);
    await expect.poll(async () => {
      const data: LearningProgramView[] = await (await learner.request.get("/api/learning-programs")).json();
      return data.find(program => program.id === assigned.id)!.members[0].progress;
    }).toBeGreaterThan(0);
    const privateTitle = `Target pribadi ${tag}`;
    await learner.getByRole("button", { name: "Tambah target pribadi" }).click();
    dialog = learner.getByRole("dialog");
    await dialog.getByLabel("Judul target").fill(privateTitle);
    await chooseCourse(learner);
    await dialog.getByLabel("Batas waktu", { exact: true }).fill(dayOffset(learningDay(), 6));
    await dialog.getByRole("button", { name: "Buat target", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const ownRow = learner.locator("article").filter({ hasText: privateTitle });
    await expect(ownRow).toBeVisible();
    await ownRow.getByRole("button", { name: "Ubah", exact: true }).click();
    await learner.getByRole("dialog").getByLabel("Catatan / deskripsi").fill("Catatan pribadi peserta.");
    await learner.getByRole("dialog").getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(learner.getByRole("dialog")).not.toBeVisible();
    await expect(ownRow.getByText("Catatan pribadi peserta.")).toBeVisible();
    await learner.screenshot({ path: "generated-artifacts/learning-programs/participant-mobile.jpg", fullPage: true });
    expect(await learner.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const before = await (await learner.request.get("/api/enrollments")).json();
    await ownRow.getByRole("button", { name: "Batalkan", exact: true }).click();
    await expect(learner.getByRole("dialog").getByText(/Riwayat belajar, pendaftaran kursus/)).toBeVisible();
    await learner.getByRole("dialog").getByRole("button", { name: "Batalkan target", exact: true }).click();
    await expect(learner.getByRole("dialog")).not.toBeVisible();
    await expect(ownRow.getByText("Dibatalkan", { exact: true })).toBeVisible();
    expect(await (await learner.request.get("/api/enrollments")).json()).toEqual(before);
    await learner.reload();
    await expect(learner.locator("article").filter({ hasText: privateTitle }).getByText("Dibatalkan", { exact: true })).toBeVisible();
    const notificationResponse = await learner.request.get("/api/notifications");
    expect((await notificationResponse.json()).some((item: { link: string }) => item.link === "/app/learning-programs")).toBe(true);

    const pic = await picContext.newPage();
    await signIn(pic, "pic");
    await expect(pic.getByRole("heading", { name: "Pantau target kelompok Anda" })).toBeVisible();
    await expect(pic.locator("article").filter({ hasText: programTitle })).toBeVisible();
    await expect(pic.getByRole("button", { name: /Buat program|Tambah target|Ubah|Ingatkan/ })).toHaveCount(0);
    const scoped: LearningProgramView[] = await (await pic.request.get("/api/learning-programs")).json();
    const scopedProgram = scoped.find(program => program.id === assigned.id)!;
    expect(scopedProgram.members.map(member => member.participantId)).toEqual([participantIds[0]]);
    expect(JSON.stringify(scoped)).not.toContain(privateTitle);
    expect(JSON.stringify(scoped)).not.toContain(participantIds[1]);
    await pic.screenshot({ path: "generated-artifacts/learning-programs/coordinator.jpg", fullPage: true });
  } finally {
    await adminContext.close(); await learnerContext.close(); await picContext.close();
  }
});

test("offers a real retry after program loading fails", async ({ page }) => {
  await signIn(page, "learner");
  await page.route("**/api/learning-programs", route => route.fulfill({
    status: 503, contentType: "application/json", body: JSON.stringify({ message: "Uji: layanan sedang tidak tersedia." }),
  }));
  await page.reload();
  await expect(page.getByText("Uji: layanan sedang tidak tersedia.")).toBeVisible();
  await page.unroute("**/api/learning-programs");
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Daftar target", exact: true })).toBeVisible();
  await expect(page.getByText("Uji: layanan sedang tidak tersedia.")).not.toBeVisible();
});
