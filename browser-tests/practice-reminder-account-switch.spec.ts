import { expect } from "@playwright/test";
import { test, signOut } from "./account-switch.fixture";
import { reminderCard, remindersPath, spaNavigate, watchReminders } from "./practice-reminders.fixture";

for (const route of ["/app", "/app/practice-missions"]) {
  for (const sameBujk of [false, true]) {
    test(`${route}: A → B → PIC, BUJK ${sameBujk ? "sama" : "berbeda"}, tanpa cache pribadi bocor`, async ({ page, accounts }) => {
      const { a, b, pic, titleA, titleB, reflectionA, reflectionB } = await accounts.setup(sameBujk);
      expect(a.participantId).not.toBe(b.participantId);
      expect(a.bujkId === b.bujkId).toBe(sameBujk);
      await page.goto("/login");
      const runtimeMarker = await page.evaluate(() => {
        const marker = crypto.randomUUID();
        (window as any).__switchRuntime = marker;
        return marker;
      });
      const documents: string[] = [];
      page.on("request", request => { if (request.isNavigationRequest()) documents.push(request.url()); });
      await accounts.signIn(page, a);
      await expect(reminderCard(page).getByText(titleA, { exact: true })).toBeVisible();
      await expect(reminderCard(page).getByText("Tindak lanjut putaran 1 · 3 November 2026 WIB", { exact: true })).toBeVisible();
      // Warm both mounted views and A's personal submission cache before logout.
      await spaNavigate(page, "/app/practice-missions");
      await expect(reminderCard(page).getByText(titleA, { exact: true })).toBeVisible();
      const historyA = page.locator("details").filter({ hasText: titleA });
      await historyA.locator("summary").click();
      await expect(historyA.getByText(reflectionA, { exact: true })).toBeVisible();
      if (route === "/app") await spaNavigate(page, "/app");
      await signOut(page);

      // Record every DOM mutation, not just the final settled screenshot.
      await page.evaluate(({ titleA, reflectionA, reflectionB }) => {
        const state = window as any;
        state.__privacyLeaks = [];
        const inspect = () => {
          const body = document.body.innerText;
          const cards = [...document.querySelectorAll("div.rounded-xl")]
            .filter(card => card.textContent?.includes("Pengingat latihan ulang"));
          if (cards.some(card => card.textContent?.includes(titleA) || card.textContent?.includes("3 November 2026 WIB"))
            || body.includes(reflectionA) || body.includes(reflectionB)) {
            state.__privacyLeaks.push(body);
          }
        };
        new MutationObserver(inspect).observe(document.body, { subtree: true, childList: true, characterData: true });
        inspect();
      }, { titleA, reflectionA, reflectionB });

      // Fetch real B data but gate delivery to expose the cache while B is loading.
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      let intercepted!: () => void;
      const fetched = new Promise<void>(resolve => { intercepted = resolve; });
      await page.route(`**${remindersPath}`, async handler => {
        const response = await handler.fetch();
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.map((item: { missionTitle: string }) => item.missionTitle)).toEqual([titleB]);
        intercepted();
        await gate;
        await handler.fulfill({ response });
      });
      try {
        await accounts.signIn(page, b);
        await fetched;
        if (route !== "/app") await spaNavigate(page, route);
        await expect(reminderCard(page).getByRole("status")).toHaveText("Memuat jadwal latihan...");
        await expect(reminderCard(page).getByText(titleA, { exact: true })).toHaveCount(0);
        await expect(reminderCard(page).getByText(/3 November 2026 WIB/)).toHaveCount(0);
      } finally {
        release();
      }
      await expect(reminderCard(page).getByText(titleB, { exact: true })).toBeVisible();
      await expect(reminderCard(page).getByText("Tindak lanjut putaran 1 · 7 November 2026 WIB", { exact: true })).toBeVisible();
      await page.unroute(`**${remindersPath}`);
      expect(await page.evaluate(() => (window as any).__privacyLeaks)).toEqual([]);
      // Leave the observer running through the next switch; no private history
      // is opened as B, and neither participant's reflection is allowed for PIC.
      await signOut(page);

      const requests = watchReminders(page);
      const submissionBodies: unknown[] = [];
      const responseChecks: Promise<void>[] = [];
      page.on("response", response => {
        if (new URL(response.url()).pathname === "/api/practice-missions/submissions") {
          responseChecks.push((async () => {
            expect(response.status()).toBe(200);
            submissionBodies.push(await response.json());
          })());
        }
      });
      await accounts.signIn(page, pic);
      await expect(page.getByRole("heading", { name: "Pemantauan Peserta BUJK" })).toBeVisible();
      await expect(reminderCard(page)).toHaveCount(0);
      const submissionsResponse = page.waitForResponse(response =>
        new URL(response.url()).pathname === "/api/practice-missions/submissions");
      await spaNavigate(page, "/app/practice-missions");
      await submissionsResponse;
      // PIC can see team evidence, so prove a nonempty response was inspected.
      const history = page.locator("details").filter({ hasText: titleA });
      await expect(history).toBeVisible();
      await history.locator("summary").click();
      await expect(history.getByText(evidenceTextFragment, { exact: false })).toBeVisible();
      await Promise.all(responseChecks);
      expect(submissionBodies.length).toBeGreaterThan(0);
      for (const body of submissionBodies) {
        expect(Array.isArray(body)).toBe(true);
        expect((body as object[]).length).toBeGreaterThan(0);
        for (const submission of body as object[]) expect(submission).not.toHaveProperty("privateReflection");
        expect(JSON.stringify(body)).not.toContain(reflectionA);
        expect(JSON.stringify(body)).not.toContain(reflectionB);
      }
      await expect(page.getByText(reflectionA, { exact: true })).toHaveCount(0);
      await expect(page.getByText(reflectionB, { exact: true })).toHaveCount(0);
      await expect(reminderCard(page)).toHaveCount(0);
      await spaNavigate(page, "/app");
      await expect(reminderCard(page)).toHaveCount(0);
      expect(requests).toEqual([]);
      expect(await page.evaluate(() => (window as any).__privacyLeaks)).toEqual([]);
      expect(await page.evaluate(() => (window as any).__switchRuntime)).toBe(runtimeMarker);
      expect(documents).toEqual([]);
      await signOut(page);
    });
  }
}

const evidenceTextFragment = "Fakta telah diperiksa dan tindak lanjut telah dicatat";
