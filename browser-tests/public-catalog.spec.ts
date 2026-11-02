import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";
import { createUser } from "../server/auth";
import { coursePublicationsTable, users } from "../shared/schema";
import { loginAttemptKeys } from "../server/login-attempt-limiter";

const tag = randomUUID();
const email = `catalog-browser-${tag}@example.test`;
const password = "Browser-test-secure-2026";
const keys = new Set<string>();
const courseIds: string[] = [];
let adminId: string;
let adminUsername: string;
let mainCourse: string;
let upcomingCourse: string;

test.beforeAll(async () => {
  const admin = await createUser(`catalog-admin-${tag}`, password);
  adminId = admin.id;
  adminUsername = admin.username;
  for (const format of ["self_paced", "upcoming"] as const) {
    const course = await storage.createCourse({
      unitId: "tender-01", targetLevel: "L2", title: `Browser ${format} ${tag}`,
      description: "Materi uji katalog publik", duration: "1 jam",
    });
    courseIds.push(course.id);
    if (format === "self_paced") mainCourse = course.id;
    else {
      upcomingCourse = course.id;
      await db.insert(coursePublicationsTable).values({
        courseId: course.id, published: true, format, startsAt: "2026-12-10T09:30:00+07:00",
      });
    }
  }
});

test.afterAll(async () => {
  for (const id of courseIds) await storage.deleteCourse(id);
  const [learner] = await db.select().from(users).where(eq(users.username, email));
  await db.delete(users).where(eq(users.username, email));
  if (learner?.participantId) await storage.deleteParticipant(learner.participantId);
  if (adminId) await db.delete(users).where(eq(users.id, adminId));
  await pool.query("DELETE FROM login_attempts WHERE attempt_key = ANY($1::text[])", [[...keys]]);
});

test("pengunjung melihat katalog dan jadwal tanpa login pada desktop dan ponsel", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kelas mendatang", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: `Browser upcoming ${tag}`, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rekaman kursus", exact: true })).toBeVisible();
  await page.goto(`/courses/${upcomingCourse}`);
  await expect(page.getByRole("heading", { name: `Browser upcoming ${tag}`, exact: true })).toBeVisible();
  await expect(page.getByText(/10 Desember 2026/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("link", { name: "Daftar", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("registrasi → login → kursus pilihan → daftar → buka player", async ({ page }) => {
  keys.add(loginAttemptKeys(`registration:${email}`, "unused")[0]);
  keys.add(loginAttemptKeys(email, "unused")[0]);
  await page.goto(`/courses/${mainCourse}`);
  await page.getByRole("link", { name: "Daftar dan lanjutkan" }).click();
  await page.getByLabel("Nama lengkap", { exact: true }).fill("Peserta Browser Mandiri");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByLabel("Ulangi kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Buat akun|Daftar/, exact: false }).click();
  await expect(page).toHaveURL(/\/login\?/);
  await page.getByLabel("Email atau username").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/courses/${mainCourse}$`));
  await page.getByRole("button", { name: "Daftar kursus", exact: true }).click();
  const learn = page.getByRole("link", { name: "Buka ruang belajar" });
  await expect(learn).toBeVisible();
  await learn.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText(`Browser self_paced ${tag}`, { exact: true })).toBeVisible();
});

test("admin mengubah publikasi dan format rekaman melalui pengaturan", async ({ page }) => {
  keys.add(loginAttemptKeys(adminUsername, "unused")[0]);
  await page.goto("/login");
  await page.getByLabel("Email atau username").fill(adminUsername);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/catalog-settings");
  await page.getByRole("button", { name: new RegExp(`Browser self_paced ${tag}`) }).click();
  await page.locator("label").filter({ has: page.locator('input[type="radio"][value="recording"]') }).click();
  await page.getByLabel("Tautan rekaman HTTPS").fill("https://example.com/catalog-browser-recording");
  await page.getByRole("button", { name: /Simpan/ }).click();
  await expect(page.getByText(/berhasil disimpan/i)).toBeVisible();
  await page.goto(`/courses/${mainCourse}`);
  await expect(page.getByText("Rekaman", { exact: true }).first()).toBeVisible();
});
