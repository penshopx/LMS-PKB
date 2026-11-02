import { expect, type Page } from "@playwright/test";
import { test, signOut } from "./account-switch.fixture";
import { reminderCard, remindersPath, spaNavigate } from "./practice-reminders.fixture";

const submissionsPath = "/api/practice-missions/submissions";
const cases = [
  { route: "/app", endpoint: remindersPath },
  { route: "/app/practice-missions", endpoint: remindersPath },
  { route: "/app/practice-missions", endpoint: submissionsPath },
];

// Import the application's actual singleton, not a second QueryClient or a
// test-only global exported by production code. This suite runs against Vite.
async function cacheSnapshot(page: Page): Promise<{ key: unknown[]; data: any }[]> {
  return page.evaluate(async () => {
    const path = "/src/lib/queryClient.ts";
    const { queryClient } = await import(/* @vite-ignore */ path);
    return queryClient.getQueryCache().getAll().map((query: any) => ({
      key: query.queryKey, data: query.state.data,
    }));
  });
}

for (const { route, endpoint } of cases) {
  for (const target of ["b", "pic"] as const) {
    test(`${route}: isi respons A terlambat (${endpoint}) setelah login ${target}`, async ({ page, accounts }) => {
      // Same BUJK deliberately gives PIC legitimate access to A's team evidence,
      // but never to A's private reflection or participant reminder cache.
      const { a, b, pic, titleA, titleB, reflectionA, reflectionB } = await accounts.setup(true);
      await page.goto("/login");
      const marker = await page.evaluate(() => {
        const value = crypto.randomUUID();
        (window as any).__lateRuntime = value;
        return value;
      });
      const documents: string[] = [];
      page.on("request", request => {
        if (request.isNavigationRequest()) documents.push(request.url());
      });
      await accounts.signIn(page, a);
      await spaNavigate(page, "/app/practice-missions");
      const historyA = page.locator("details").filter({ hasText: titleA });
      await historyA.locator("summary").click();
      await expect(historyA.getByText(reflectionA, { exact: true })).toBeVisible();
      await expect(reminderCard(page).getByText(titleA, { exact: true })).toBeVisible();
      if (route === "/app") await spaNavigate(page, route);
      await expect(reminderCard(page).getByText(titleA, { exact: true })).toBeVisible();

      // Hold the *body* after native fetch + JSON parsing have succeeded. Holding
      // route.fulfill alone can let AbortSignal cancel history before any stale
      // body reaches the application's ownership check. This also exercises
      // reminders' custom apiRequest path, which does not pass a query signal.
      await page.evaluate(async ({ endpoint }) => {
        const state = window as any;
        const nativeFetch = window.fetch;
        state.__lateBody = { held: false, delivered: false, count: 0 };
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        state.__releaseLateBody = release;
        state.__restoreLateFetch = () => { window.fetch = nativeFetch; };
        let armed = true;
        window.fetch = async (...args) => {
          const response = await nativeFetch(...args);
          const input = args[0];
          const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
          if (armed && new URL(url, location.href).pathname === endpoint) {
            armed = false;
            const json = response.json.bind(response);
            response.json = async () => {
              const body = await json();
              state.__lateBody = { held: true, delivered: false, count: 1, status: response.status, body };
              await gate;
              state.__lateBody.delivered = true;
              return body;
            };
          }
          return response;
        };
        const path = "/src/lib/queryClient.ts";
        const { queryClient } = await import(/* @vite-ignore */ path);
        // Do not await: this is the A request intentionally left unfinished.
        void queryClient.invalidateQueries({ queryKey: [endpoint] });
      }, { endpoint });

      try {
        await expect.poll(() => page.evaluate(() => (window as any).__lateBody.held)).toBe(true);
        const held = await page.evaluate(() => (window as any).__lateBody);
        expect(held.status).toBe(200);
        expect(held.count).toBe(1);
        expect(held.delivered).toBe(false);
        expect(Array.isArray(held.body)).toBe(true);
        expect(held.body).toHaveLength(1);
        expect(held.body[0].nextPracticeAt).toBe("2026-11-03");
        if (endpoint === remindersPath) {
          expect(held.body[0].missionTitle).toBe(titleA);
        } else {
          expect(held.body[0].participantId).toBe(a.participantId);
          expect(held.body[0].privateReflection).toBe(reflectionA);
        }
        await signOut(page);

        // Watch all cache updates and DOM mutations from the logged-out state.
        // PIC is allowed the team title/date in history, not participant reminders.
        await page.evaluate(async ({ titleA, reflectionA, target, aId }) => {
          const state = window as any;
          state.__lateLeaks = [];
          const path = "/src/lib/queryClient.ts";
          const { queryClient } = await import(/* @vite-ignore */ path);
          const inspectCache = () => {
            for (const query of queryClient.getQueryCache().getAll()) {
              const data = JSON.stringify(query.state.data) ?? "";
              if (data.includes(reflectionA)
                || (target === "b" && (data.includes(titleA) || data.includes("2026-11-03")))
                || (query.queryKey[0] === "/api/practice-missions/reminders"
                  && (query.queryKey.includes(aId) || data.includes(titleA) || data.includes("2026-11-03")))) {
                state.__lateLeaks.push({ source: "cache", key: query.queryKey, data });
              }
            }
          };
          const inspectDOM = () => {
            const body = document.body.innerText;
            const cards = [...document.querySelectorAll("div.rounded-xl")]
              .filter(card => card.textContent?.includes("Pengingat latihan ulang"));
            if (body.includes(reflectionA)
              || (target === "b" && (body.includes(titleA) || body.includes("3 November 2026 WIB")))
              || cards.some(card => card.textContent?.includes(titleA) || card.textContent?.includes("3 November 2026 WIB"))) {
              state.__lateLeaks.push({ source: "dom", body });
            }
          };
          const observer = new MutationObserver(inspectDOM);
          observer.observe(document.body, { subtree: true, childList: true, characterData: true });
          const unsubscribe = queryClient.getQueryCache().subscribe(inspectCache);
          state.__stopLateWatch = () => { observer.disconnect(); unsubscribe(); };
          inspectCache();
          inspectDOM();
        }, { titleA, reflectionA, target, aId: a.id });

        await accounts.signIn(page, target === "b" ? b : pic);
        if (target === "pic") {
          await expect(page.getByRole("heading", { name: "Pemantauan Peserta BUJK" })).toBeVisible();
          await expect(reminderCard(page)).toHaveCount(0);
        } else {
          await expect(reminderCard(page).getByText(titleB, { exact: true })).toBeVisible();
          await expect(reminderCard(page).getByText(/7 November 2026 WIB/)).toBeVisible();
        }
        // Settle the new account's actual history BEFORE delivering A's body.
        // This catches late A responses overwriting the shared submissions key.
        await spaNavigate(page, "/app/practice-missions");
        const history = page.locator("details").filter({ hasText: target === "b" ? titleB : titleA });
        await history.locator("summary").click();
        if (target === "b") {
          await expect(history.getByText(reflectionB, { exact: true })).toBeVisible();
        } else {
          await expect(history.getByText("Fakta telah diperiksa", { exact: false })).toBeVisible();
          await expect(page.getByText(reflectionA, { exact: true })).toHaveCount(0);
        }
        if (route === "/app") await spaNavigate(page, route);
        expect(await page.evaluate(() => (window as any).__lateBody.delivered)).toBe(false);
        expect(await page.evaluate(() => (window as any).__lateLeaks)).toEqual([]);

        await page.evaluate(async () => {
          const state = window as any;
          state.__releaseLateBody();
          // Flush promise continuations, React updates and DOM observer delivery.
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        });
        expect(await page.evaluate(() => (window as any).__lateBody.delivered)).toBe(true);
        const snapshot = await cacheSnapshot(page);
        expect(JSON.stringify(snapshot)).not.toContain(reflectionA);
        expect(snapshot.some(query => query.key.includes(a.id))).toBe(false);
        const submissions = snapshot.find(query => query.key[0] === submissionsPath);
        if (target === "b") {
          expect(submissions?.data).toHaveLength(1);
          expect(submissions?.data[0].participantId).toBe(b.participantId);
          expect(submissions?.data[0].privateReflection).toBe(reflectionB);
          expect(JSON.stringify(snapshot)).not.toContain(titleA);
          expect(JSON.stringify(snapshot)).not.toContain("2026-11-03");
        } else {
          expect(submissions?.data).toHaveLength(2);
          expect(submissions?.data.map((item: any) => item.participantId).sort())
            .toEqual([a.participantId, b.participantId].sort());
          for (const item of submissions?.data) expect(item).not.toHaveProperty("privateReflection");
          expect(snapshot.filter(query => query.key[0] === remindersPath)).toEqual([]);
        }
        // Revisit both mounted surfaces so a hidden/cache-only leak cannot pass.
        for (const href of ["/app/practice-missions", "/app"]) {
          if (new URL(page.url()).pathname !== href) await spaNavigate(page, href);
          await expect(page.getByText(reflectionA, { exact: true })).toHaveCount(0);
          if (target === "b") {
            await expect(reminderCard(page).getByText(titleB, { exact: true })).toBeVisible();
            await expect(page.getByText(titleA, { exact: true })).toHaveCount(0);
          } else {
            await expect(reminderCard(page)).toHaveCount(0);
          }
        }
        expect(await page.evaluate(() => (window as any).__lateLeaks)).toEqual([]);
        expect(await page.evaluate(() => (window as any).__lateRuntime)).toBe(marker);
        expect(documents).toEqual([]);
        await signOut(page);
      } finally {
        await page.evaluate(() => {
          const state = window as any;
          state.__releaseLateBody?.();
          state.__restoreLateFetch?.();
          state.__stopLateWatch?.();
        });
      }
    });
  }
}
