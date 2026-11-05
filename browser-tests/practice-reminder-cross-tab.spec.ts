import { expect, type Page } from "@playwright/test";
import { test, signOut } from "./account-switch.fixture";
import { reminderCard, spaNavigate, watchReminders } from "./practice-reminders.fixture";

// Hold only delivery, not authentication or data: cookies, storage events,
// /api/me and the account switch all come from the real application.
async function holdSessionChecks(page: Page) {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const received: { status: number; id?: string }[] = [];
  const pending: Promise<void>[] = [];
  const pattern = "**/api/me";
  await page.route(pattern, handler => {
    const work = (async () => {
      const response = await handler.fetch();
      const body = await response.json();
      received.push({ status: response.status(), id: body.id });
      await gate;
      await handler.fulfill({ response });
    })();
    pending.push(work);
    return work;
  });
  return {
    received,
    async finish() {
      release();
      await Promise.all(pending);
      await page.unroute(pattern);
    },
  };
}

async function assertPrivateDataHidden(page: Page, reflections: string[]) {
  await expect(reminderCard(page)).toHaveCount(0);
  for (const reflection of reflections) {
    await expect(page.getByText(reflection, { exact: true })).toHaveCount(0);
  }
}

for (const route of ["/app", "/app/practice-missions"]) {
  for (const sameBujk of [false, true]) {
    test(`${route}: dua tab A → B → PIC, BUJK ${sameBujk ? "sama" : "berbeda"}`, async ({ page, context, accounts }) => {
      const { a, b, pic, titleA, titleB, reflectionA, reflectionB } = await accounts.setup(sameBujk);
      expect(a.bujkId === b.bujkId).toBe(sameBujk);
      await page.goto("/login");
      await accounts.signIn(page, a);
      // Warm personal history even when the tab will be left on the dashboard.
      await spaNavigate(page, "/app/practice-missions");
      const historyA = page.locator("details").filter({ hasText: titleA });
      await historyA.locator("summary").click();
      await expect(historyA.getByText(reflectionA, { exact: true })).toBeVisible();
      if (route === "/app") await spaNavigate(page, route);
      await expect(reminderCard(page).getByText(titleA, { exact: true })).toBeVisible();

      const otherTab = await context.newPage();
      await otherTab.goto("/app");
      await expect(otherTab.getByTestId("button-user-menu")).toBeVisible();
      const marker = await page.evaluate(({ reflectionA, reflectionB }) => {
        const state = window as any;
        state.__crossTab = {
          marker: crypto.randomUUID(), events: 0, leaks: [] as string[],
          forbiddenReflections: [reflectionA, reflectionB], forbiddenTitles: [] as string[],
        };
        window.addEventListener("storage", event => {
          if (event.key === "lms-auth-change") state.__crossTab.events++;
        });
        new MutationObserver(() => {
          const probe = state.__crossTab;
          if (!probe.events) return;
          const body = document.body.innerText;
          const cards = [...document.querySelectorAll("div.rounded-xl")]
            .filter(card => card.textContent?.includes("Pengingat latihan ulang"));
          if (probe.forbiddenReflections.some((text: string) => body.includes(text))
            || cards.some(card => probe.forbiddenTitles.some((text: string) => card.textContent?.includes(text)))) {
            probe.leaks.push(body);
          }
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
        return state.__crossTab.marker;
      }, { reflectionA, reflectionB });
      const documents: string[] = [];
      page.on("request", request => {
        if (request.isNavigationRequest()) documents.push(request.url());
      });
      const picSubmissionBodies: Promise<Record<string, unknown>[]>[] = [];

      for (const [index, next] of [b, pic].entries()) {
        if (index === 1) {
          page.on("response", response => {
            if (new URL(response.url()).pathname === "/api/practice-missions/submissions" && response.status() === 200) {
              picSubmissionBodies.push(response.json());
            }
          });
        }
        await page.evaluate(titles => {
          (window as any).__crossTab.forbiddenTitles = titles;
        }, index === 0 ? [titleA] : [titleA, titleB]);
        const held = await holdSessionChecks(page);
        const eventsBefore = await page.evaluate(() => (window as any).__crossTab.events);
        const reminderRequests = watchReminders(page);
        try {
          // Only this tab uses the real logout/login controls. The old tab is
          // neither navigated nor focused to trigger the storage-driven refresh.
          await signOut(otherTab);
          await expect.poll(() => held.received.some(result => result.status === 401)).toBe(true);
          await expect.poll(() => page.evaluate(() => (window as any).__crossTab.events)).toBe(eventsBefore + 1);
          await assertPrivateDataHidden(page, [reflectionA, reflectionB]);
          await expect(page).toHaveURL(new RegExp(`${route}$`));

          await accounts.signIn(otherTab, next);
          await expect.poll(() => held.received.some(result => result.status === 200 && result.id === next.id)).toBe(true);
          await expect.poll(() => page.evaluate(() => (window as any).__crossTab.events)).toBe(eventsBefore + 2);
          // Still no /api/me response has been delivered to the old tab.
          await assertPrivateDataHidden(page, [reflectionA, reflectionB]);
          expect(reminderRequests).toEqual([]);
          await expect(page).toHaveURL(new RegExp(`${route}$`));
        } finally {
          await held.finish();
        }
        if (index === 0) {
          await expect(reminderCard(page).getByText(titleB, { exact: true })).toBeVisible();
          await expect(reminderCard(page).getByText("Tindak lanjut putaran 1 · 7 November 2026 WIB", { exact: true })).toBeVisible();
          await expect(page.getByText(reflectionA, { exact: true })).toHaveCount(0);
          // Confirm B gets B's history, then leave it open for the PIC switch.
          if (route === "/app") await spaNavigate(page, "/app/practice-missions");
          await page.evaluate(() => {
            (window as any).__crossTab.forbiddenReflections = [(window as any).__crossTab.forbiddenReflections[0]];
          });
          const historyB = page.locator("details").filter({ hasText: titleB });
          await historyB.locator("summary").click();
          await expect(historyB.getByText(reflectionB, { exact: true })).toBeVisible();
          if (route === "/app") await spaNavigate(page, route);
          await page.evaluate(reflections => {
            (window as any).__crossTab.forbiddenReflections = reflections;
            // B's legitimately open history is forbidden only after the next storage event.
            (window as any).__crossTab.events = 0;
          }, [reflectionA, reflectionB]);
        } else {
          await expect(page.getByText("Tampilan PIC bersifat baca-saja.", { exact: false })
            .or(page.getByRole("heading", { name: "Pemantauan Peserta PKB" }))).toBeVisible();
          await assertPrivateDataHidden(page, [reflectionA, reflectionB]);
          expect(reminderRequests).toEqual([]);
        }
      }
      // PIC legitimately sees A's team evidence, but never either private reflection.
      if (route === "/app") await spaNavigate(page, "/app/practice-missions");
      const teamHistory = page.locator("details").filter({ hasText: titleA });
      await teamHistory.locator("summary").click();
      await expect(teamHistory.getByText("Fakta telah diperiksa dan tindak lanjut telah dicatat", { exact: false })).toBeVisible();
      expect(picSubmissionBodies.length).toBeGreaterThan(0);
      for (const body of await Promise.all(picSubmissionBodies)) {
        expect(body.length).toBeGreaterThan(0);
        for (const submission of body) expect(submission).not.toHaveProperty("privateReflection");
        expect(JSON.stringify(body)).not.toContain(reflectionA);
        expect(JSON.stringify(body)).not.toContain(reflectionB);
      }
      await assertPrivateDataHidden(page, [reflectionA, reflectionB]);
      await spaNavigate(page, "/app");
      await assertPrivateDataHidden(page, [reflectionA, reflectionB]);
      expect(await page.evaluate(() => (window as any).__crossTab.leaks)).toEqual([]);
      expect(await page.evaluate(() => (window as any).__crossTab.marker)).toBe(marker);
      expect(documents).toEqual([]);
      await signOut(otherTab);
      await expect(page).toHaveURL(/\/login$/);
    });
  }
}
