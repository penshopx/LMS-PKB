import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq, inArray } from "drizzle-orm";
import { createUser } from "../server/auth";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";
import { participantsTable, users } from "../shared/schema";

test("admin menyimpan, mengubah, menghapus rujukan; peserta hanya membaca", async ({ page, browser }) => {
  const tag = randomUUID();
  const password = "Reference-Browser-Disposable-2026!";
  const usernames = { admin: `ref-admin-${tag}`, participant: `ref-learner-${tag}` };
  const userIds: string[] = [];
  let courseId = "";
  let participantId = "";
  const readerContext = await browser.newContext();
  const reader = await readerContext.newPage();
  try {
    const participant = await storage.createParticipant({
      nip: `REF${tag.slice(0, 12)}`, name: "Peserta uji rujukan", position: "Staf",
      unit: "Uji rujukan", email: `ref-${tag}@example.test`,
    });
    participantId = participant.id;
    userIds.push((await createUser(usernames.admin, password)).id);
    userIds.push((await createUser(usernames.participant, password, { role: "participant", participantId })).id);
    const course = await storage.createCourse({
      unitId: "tender-01", targetLevel: "L2", title: `Uji rujukan ${tag}`,
      description: "Kursus sementara untuk pengujian rujukan", duration: "1 jam",
    });
    courseId = course.id;
    await storage.createEnrollment(participantId, courseId);

    async function signIn(target: typeof page, username: string) {
      await target.goto("/login");
      await target.locator("#username").fill(username);
      await target.locator("#password").fill(password);
      await target.getByRole("button", { name: "Masuk", exact: true }).click();
      await expect(target.getByTestId("button-user-menu")).toBeVisible();
    }
    await signIn(page, usernames.admin);
    await page.goto("/app/courses");
    await page.getByTestId(`button-start-course-${courseId}`).click();
    const panel = page.getByRole("region", { name: "Rujukan lesson" });
    await panel.getByRole("button", { name: "Tambah rujukan", exact: true }).click();
    await panel.getByRole("button", { name: "Tambah sumber" }).click();
    await panel.getByLabel("Halaman mulai").fill("29");
    await panel.getByLabel("Halaman akhir").fill("34");
    await panel.getByLabel("Catatan relevansi", { exact: false }).fill("Referensi konteks PUB untuk latihan, bukan keputusan hukum.");
    await panel.getByLabel("Halaman mulai").fill("92");
    await panel.getByRole("button", { name: "Simpan rujukan" }).click();
    await expect(panel.getByRole("alert")).toContainText("Rentang halaman");
    await panel.getByLabel("Halaman mulai").fill("29");
    await panel.getByRole("button", { name: "Simpan rujukan" }).click();
    await expect(panel.getByText("Rujukan berhasil disimpan.")).toBeVisible();
    await expect(panel.getByText("Hal. 29–34", { exact: true })).toBeVisible();
    await expect(panel.getByText("Materi diskusi", { exact: true })).toBeVisible();
    await expect(panel.getByText(/Naskah resmi dan status berlaku terkini belum diverifikasi/)).toBeVisible();

    // Normal authenticated participant path; no sign-in bypass or invented API data.
    await signIn(reader, usernames.participant);
    await reader.getByText(course.title, { exact: true }).locator("../..").getByRole("button", { name: "Lanjutkan" }).click();
    const readPanel = reader.getByRole("region", { name: "Rujukan lesson" });
    await expect(readPanel.getByText("Hal. 29–34", { exact: true })).toBeVisible();
    await expect(readPanel.getByRole("button", { name: /rujukan/ })).toHaveCount(0);
    const lessonId = course.lessons[0].id;
    const forbidden = await reader.request.patch(`/api/courses/${courseId}/lessons/${lessonId}/references`, {
      data: { references: [], expectedReferences: [] },
    });
    expect(forbidden.status()).toBe(403);

    await panel.getByRole("button", { name: "Kelola rujukan" }).click();
    await panel.getByLabel("Halaman mulai").fill("28");
    await panel.getByRole("button", { name: "Simpan rujukan" }).click();
    await expect(panel.getByText("Hal. 28–34", { exact: true })).toBeVisible();
    // Closing/reopening and a fresh document must both show persisted references.
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    await page.getByTestId(`button-start-course-${courseId}`).click();
    await expect(panel.getByText("Hal. 28–34", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByTestId(`button-start-course-${courseId}`).click();
    await expect(panel.getByText("Hal. 28–34", { exact: true })).toBeVisible();

    await panel.getByRole("button", { name: "Kelola rujukan" }).click();
    await panel.getByLabel("Catatan relevansi", { exact: false }).fill("Draf belum disimpan");
    await panel.getByRole("button", { name: "Batal", exact: true }).click();
    await expect(panel.getByText("Draf belum disimpan")).toHaveCount(0);
    await panel.getByRole("button", { name: "Kelola rujukan" }).click();
    const current = await (await page.request.get(`/api/courses/${courseId}`)).json();
    const currentRefs = current.lessons[0].references;
    const changedElsewhere = currentRefs.map((ref: Record<string, unknown>) => ({
      ...ref, note: "Perubahan admin lain untuk konteks pembelajaran",
    }));
    expect((await page.request.patch(`/api/courses/${courseId}/lessons/${lessonId}/references`, {
      data: { references: changedElsewhere, expectedReferences: currentRefs },
    })).status()).toBe(200);
    await panel.getByLabel("Catatan relevansi", { exact: false }).fill("Draf versi lama");
    await panel.getByRole("button", { name: "Simpan rujukan" }).click();
    await expect(panel.getByRole("alert")).toContainText("telah diubah");
    await panel.getByRole("button", { name: "Muat ulang", exact: true }).click();
    await expect(panel.getByText("Perubahan admin lain untuk konteks pembelajaran", { exact: false })).toBeVisible();

    await panel.getByRole("button", { name: "Kelola rujukan" }).click();
    await panel.getByRole("button", { name: "Hapus rujukan 1", exact: true }).click();
    await panel.getByRole("button", { name: "Simpan rujukan" }).click();
    await expect(panel.getByText("Belum ada rujukan yang dicantumkan untuk lesson ini.")).toBeVisible();
    const saved = await (await page.request.get(`/api/courses/${courseId}`)).json();
    expect(saved.lessons[0].references).toEqual([]);
    expect(saved.lessons[0].content).toBe(course.lessons[0].content);
  } finally {
    await page.request.post("/api/logout").catch(() => {});
    await reader.request.post("/api/logout").catch(() => {});
    await readerContext.close();
    if (courseId) await storage.deleteCourse(courseId);
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
    if (participantId) await db.delete(participantsTable).where(eq(participantsTable.id, participantId));
    await pool.end();
  }
});
