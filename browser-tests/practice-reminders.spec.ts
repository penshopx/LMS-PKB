import { expect } from "@playwright/test";
import {
  test, checklist, evidenceText, remindersPath, emptyMessage, reminderCard,
  freezeClock, watchReminders, spaNavigate, visibleWithClock,
} from "./practice-reminders.fixture";

for (const route of ["/app", "/app/practice-missions"]) {
  test.describe(route, () => {
    for (const recovery of ["Coba lagi", "polling", "fokus kembali"] as const) {
      test(`pengingat pulih melalui ${recovery} setelah gangguan sementara tanpa reload`, async ({ page, learner }) => {
        const previous = await learner.mission("sebelum koneksi terputus");
        const latest = await learner.mission("feedback terbaru selama gangguan");
        await learner.review(previous, "2026-11-01");
        await learner.signIn(page);
        await freezeClock(page);
        // Retry covers initial-load failure; automatic recovery also covers a
        // failed background refresh when reminders already exist in the cache.
        let unavailable = recovery === "Coba lagi";
        let failures = 0;
        await page.route(`**${remindersPath}`, async handler => {
          if (handler.request().method() !== "GET" || !unavailable) {
            await handler.continue();
          } else {
            failures++;
            if (recovery === "polling") {
              await handler.abort("internetdisconnected");
            } else {
              await handler.fulfill({
                status: 503, contentType: "application/json",
                body: JSON.stringify({ message: "Layanan pengingat sementara tidak tersedia." }),
              });
            }
          }
        });
        await page.goto(route);
        const card = reminderCard(page);
        const alert = card.getByRole("alert");
        const triggerAutomaticRefresh = async () => {
          if (recovery === "polling") {
            await page.clock.runFor(60_000);
          } else {
            // Simulate the visibility signal only, as in the existing focus
            // test: headless tab switching does not reliably hide the page.
            await page.evaluate(() => {
              Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
              document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
              Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
              document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
            });
          }
        };
        if (recovery !== "Coba lagi") {
          await visibleWithClock(page, card.getByText(previous.title, { exact: true }));
          unavailable = true;
          await triggerAutomaticRefresh();
        }
        await visibleWithClock(page, alert);
        await expect(alert).toContainText("Pengingat gagal dimuat.");
        await expect(alert.getByRole("button", { name: "Coba lagi", exact: true })).toBeVisible();
        await expect(card.getByText(emptyMessage, { exact: true })).toHaveCount(0);
        expect(failures).toBeGreaterThan(0);

        const runtimeMarker = await page.evaluate(() => {
          const marker = crypto.randomUUID();
          (window as any).__reminderRecoveryRuntime = marker;
          return marker;
        });
        const documents: string[] = [];
        page.on("request", request => {
          if (request.isNavigationRequest()) documents.push(request.url());
        });
        const requests = watchReminders(page);
        // Feedback arrives while the browser cannot fetch reminders. Recovery
        // must retrieve this new record, not merely redisplay the cached one.
        await learner.review(latest, "2026-11-03");
        await expect(card.getByText(latest.title, { exact: true })).toHaveCount(0);
        unavailable = false;
        const recovered = page.waitForResponse(response =>
          new URL(response.url()).pathname === remindersPath
          && response.request().method() === "GET" && response.status() === 200);
        if (recovery === "Coba lagi") {
          await alert.getByRole("button", { name: "Coba lagi", exact: true }).click();
        } else {
          await triggerAutomaticRefresh();
        }
        const response = await recovered;
        expect(await response.json()).toEqual(expect.arrayContaining([
          expect.objectContaining({ missionTitle: latest.title, nextPracticeAt: "2026-11-03" }),
        ]));
        await visibleWithClock(page, card.getByText(latest.title, { exact: true }));
        await expect(card.getByText(previous.title, { exact: true })).toBeVisible();
        await expect(card.getByText("Tindak lanjut putaran 1 · 3 November 2026 WIB", { exact: true })).toBeVisible();
        await expect(alert).toHaveCount(0);
        await expect(card.getByRole("button", { name: "Coba lagi", exact: true })).toHaveCount(0);
        await expect(card.getByText(emptyMessage, { exact: true })).toHaveCount(0);
        expect(requests).toHaveLength(1);
        expect(documents).toEqual([]);
        expect(await page.evaluate(() => (window as any).__reminderRecoveryRuntime)).toBe(runtimeMarker);
        await expect(page).toHaveURL(new RegExp(`${route}$`));
      });
    }

    test("halaman terbuka melewati tengah malam WIB memperbarui kedua status tanpa fetch", async ({ page, learner }) => {
      const today = await learner.mission("jatuh tempo hari ini");
      const tomorrow = await learner.mission("jatuh tempo besok");
      await learner.review(today, "2026-11-01");
      await learner.review(tomorrow, "2026-11-02");
      await learner.signIn(page);
      await freezeClock(page);
      await page.goto(route);
      const card = reminderCard(page);
      const todayRow = card.locator("div.rounded-lg").filter({ has: page.getByText(today.title, { exact: true }) });
      const tomorrowRow = card.locator("div.rounded-lg").filter({ has: page.getByText(tomorrow.title, { exact: true }) });
      await visibleWithClock(page, todayRow.getByText("Hari ini", { exact: true }));
      await expect(tomorrowRow.getByText("Mendatang", { exact: true })).toBeVisible();
      const requests = watchReminders(page);
      // The local device remains November 1 even after WIB becomes November 2.
      await page.clock.runFor(19_000);
      await expect(todayRow.getByText("Hari ini", { exact: true })).toBeVisible();
      await expect(tomorrowRow.getByText("Mendatang", { exact: true })).toBeVisible();
      await page.clock.runFor(11_000);
      await expect(todayRow.getByText("Terlewat", { exact: true })).toBeVisible();
      await expect(tomorrowRow.getByText("Hari ini", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => new Date().getDate())).toBe(1);
      expect(requests).toHaveLength(0); // 30-second display timer, not the 60-second poll.
    });

    test("feedback admin baru muncul melalui polling 60 detik tanpa navigasi", async ({ page, learner }) => {
      const mission = await learner.mission("feedback melalui polling");
      await learner.signIn(page);
      await freezeClock(page);
      await page.goto(route);
      await visibleWithClock(page, reminderCard(page).getByText(emptyMessage, { exact: true }));
      const requests = watchReminders(page);
      await learner.review(mission);
      await page.clock.runFor(58_000);
      expect(requests).toHaveLength(0);
      await expect(reminderCard(page).getByText(emptyMessage, { exact: true })).toBeVisible();
      const response = page.waitForResponse(response => response.url().endsWith(remindersPath) && response.status() === 200);
      await page.clock.runFor(2_000);
      await response;
      await visibleWithClock(page, reminderCard(page).getByText(mission.title, { exact: true }));
      expect(requests).toHaveLength(1);
    });

    test("feedback admin muncul saat halaman kembali terlihat sebelum polling", async ({ page, learner }) => {
      const mission = await learner.mission("feedback saat fokus kembali");
      await learner.signIn(page);
      await freezeClock(page);
      await page.goto(route);
      await visibleWithClock(page, reminderCard(page).getByText(emptyMessage, { exact: true }));
      const requests = watchReminders(page);
      // Headless Chromium keeps background pages visible. Simulate only the
      // visibility signal consumed by TanStack's actual browser focus listener.
      // Timers, network, query cache and component effects are not mocked.
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
      });
      await learner.review(mission);
      expect(requests).toHaveLength(0);
      const response = page.waitForResponse(response => response.url().endsWith(remindersPath) && response.status() === 200);
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
      });
      await response;
      await visibleWithClock(page, reminderCard(page).getByText(mission.title, { exact: true }));
      expect(requests).toHaveLength(1);
    });
  });
}

test("putaran baru menghapus pengingat melalui invalidasi cache di misi dan beranda tanpa reload", async ({ page, learner }) => {
  const mission = await learner.mission("pengiriman putaran baru");
  await learner.review(mission);
  await learner.signIn(page);
  await freezeClock(page);
  await page.goto("/app");
  await visibleWithClock(page, reminderCard(page).getByText(mission.title, { exact: true }));
  // Warm the shared reminder cache on home, then move through the real SPA link.
  await spaNavigate(page, "/app/practice-missions");
  await expect(reminderCard(page).getByText(mission.title, { exact: true })).toBeVisible();
  const documents: string[] = [];
  page.on("request", request => { if (request.isNavigationRequest()) documents.push(request.url()); });
  const requests = watchReminders(page);
  const article = page.getByRole("article").filter({ has: page.getByRole("heading", { name: mission.title, exact: true }) });
  const nextRound = article.getByRole("button", { name: "Mulai putaran berikutnya" });
  await visibleWithClock(page, nextRound);
  await nextRound.click();
  const dialog = page.getByRole("dialog");
  for (const item of checklist) await dialog.getByRole("checkbox", { name: item }).check();
  await dialog.locator("#mission-evidence").fill(`${evidenceText} Hasil perbaikan putaran kedua.`);
  const submitted = page.waitForResponse(response =>
    response.url().endsWith(`/api/practice-missions/${mission.id}/submissions`) && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Kirim untuk ditinjau" }).click();
  const result = await submitted;
  expect(result.status()).toBe(201);
  expect(await result.json()).toMatchObject({ round: 2, status: "pending_review" });
  await visibleWithClock(page, reminderCard(page).getByText(emptyMessage, { exact: true }));
  await expect(dialog).not.toBeVisible();
  await expect(reminderCard(page).getByText(mission.title, { exact: true })).toHaveCount(0);
  // Time is paused and focus never changes: only mutation invalidation can refetch here.
  expect(requests.length).toBeGreaterThanOrEqual(1);
  await spaNavigate(page, "/app");
  await expect(reminderCard(page).getByText(emptyMessage, { exact: true })).toBeVisible();
  await expect(reminderCard(page).getByText(mission.title, { exact: true })).toHaveCount(0);
  expect(documents).toEqual([]);
});
