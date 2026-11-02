import { test, expect } from "@playwright/test";

// Do not retain request bodies or screenshots containing even synthetic credentials.
test.use({ trace: "off", screenshot: "off", video: "off" });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", route => route.fulfill({ status: 401, json: {} }));
  const now = new Date("2026-11-02T00:00:00Z");
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
});

async function openLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email atau username").fill("login-timer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
}

test.describe("login transport recovery", () => {
  for (const failure of ["disconnected", "slow response"] as const) {
    test(`${failure}: pending blocks duplicates and failure permits manual retry`, async ({ page }) => {
      let submissions = 0;
      const releases: Array<() => void> = [];
      const gates = [0, 1].map(() => new Promise<void>(resolve => releases.push(resolve)));
      await page.route("**/api/login", async route => {
        expect(route.request().method()).toBe("POST");
        const attempt = submissions++;
        // Never forward credentials to the server, including unexpected duplicates.
        if (attempt > 1) {
          await route.abort("failed");
          return;
        }
        await gates[attempt];
        if (attempt === 0 && failure === "disconnected") {
          await route.abort("internetdisconnected");
        } else {
          await route.fulfill({
            status: attempt === 0 ? 503 : 401,
            json: { message: attempt === 0
              ? "Login sementara tidak tersedia. Silakan coba lagi nanti."
              : "Username atau password salah" },
          });
        }
      });
      try {
        await openLogin(page);
        const submit = page.locator('button[type="submit"]');
        const username = page.getByLabel("Email atau username");
        const password = page.getByLabel("Password", { exact: true });
        const spinner = submit.locator(".animate-spin");
        const assertNoStoredCredentials = async () => {
          const stored = await page.evaluate(() => JSON.stringify({
            local: { ...localStorage }, session: { ...sessionStorage },
          }));
          expect(stored).not.toContain("login-timer@example.test");
          expect(stored).not.toContain("test-password-only");
        };
        const assertPendingGuard = async (expectedSubmissions: number) => {
          await expect(submit).toHaveText("Masuk...");
          await expect(spinner).toBeVisible();
          await expect(submit).toBeDisabled();
          await expect(username).toBeDisabled();
          await expect(password).toBeDisabled();
          await expect.poll(() => submissions).toBe(expectedSubmissions);
          // Real pointer/keyboard input must not queue a second request. Normal
          // locator.click would wait for the disabled button to become enabled.
          const bounds = await submit.boundingBox();
          if (!bounds) throw new Error("Login submit button is not visible");
          await page.mouse.dblclick(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          await page.keyboard.press("Enter");
          await page.keyboard.press("Enter");
          // Exercise the handler guard independently of native disabled controls.
          await page.locator("form").evaluate(form => {
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
          });
          await page.clock.fastForward(30_000);
          await expect(submit).toHaveText("Masuk...");
          await expect(spinner).toBeVisible();
          expect(submissions).toBe(expectedSubmissions);
          await assertNoStoredCredentials();
        };

        await submit.click();
        await assertPendingGuard(1);
        releases[0]();
        const alert = page.getByRole("alert");
        await expect(alert).toBeVisible();
        if (failure === "slow response") {
          await expect(alert).toHaveText("Login sementara tidak tersedia. Silakan coba lagi nanti.");
        } else {
          await expect(alert).not.toBeEmpty();
        }
        await expect(submit).toHaveText("Masuk");
        await expect(spinner).toHaveCount(0);
        await expect(submit).toBeEnabled();
        await expect(username).toBeEnabled();
        await expect(password).toBeEnabled();
        await expect(page.getByRole("status")).toHaveCount(0);
        await page.clock.fastForward(60_000);
        expect(submissions).toBe(1); // Failure must not automatically resend credentials.
        await assertNoStoredCredentials();

        // Retry by Enter as well as by clicking: both paths use the same guard.
        await password.press("Enter");
        await assertPendingGuard(2);
        await expect(alert).toHaveCount(0);
        releases[1]();
        await expect(alert).toHaveText("Username atau password salah");
        await expect(submit).toHaveText("Masuk");
        await expect(submit).toBeEnabled();
        await expect(spinner).toHaveCount(0);
        await page.clock.fastForward(60_000);
        expect(submissions).toBe(2);
        await assertNoStoredCredentials();
        await page.reload();
        await expect(username).toHaveValue("");
        await expect(password).toHaveValue("");
        await expect(submit).toBeEnabled();
        expect(submissions).toBe(2);
      } finally {
        releases.forEach(release => release());
      }
    });
  }
});

for (const source of ["json", "header", "date"] as const) {
  test(`429 ${source}: countdown, submit guard, expiry and password privacy`, async ({ page }) => {
    let submissions = 0;
    await page.route("**/api/login", async route => {
      submissions++;
      const now = await page.evaluate(() => Date.now());
      await route.fulfill({
        status: 429,
        headers: source === "json" ? {} : {
          "Retry-After": source === "header" ? "65" : new Date(now + 65_000).toUTCString(),
        },
        json: { message: "Terlalu banyak percobaan login.", ...(source === "json" ? { retryAfterSeconds: 65 } : {}) },
      });
    });
    await openLogin(page);
    const submit = page.locator('button[type="submit"]');
    await submit.click();
    await expect(page.getByRole("status")).toContainText("1 menit 5 detik");
    await expect(submit).toBeDisabled();
    // A programmatic submit (and not only a disabled button) must be guarded.
    await page.locator("form").evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await page.getByLabel("Password", { exact: true }).press("Enter");
    await page.clock.fastForward(2_000);
    await expect(page.getByRole("status")).toContainText("1 menit 3 detik");
    expect(submissions).toBe(1);
    // Jumping the clock simulates timers delayed by a background tab.
    await page.clock.fastForward(63_000);
    await expect(submit).toBeEnabled();
    await expect(submit).toHaveText("Masuk");
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(submissions).toBe(1); // no automatic credential resubmission
    const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(stored).not.toContain("test-password-only");
    await submit.click();
    await expect(page.getByRole("status")).toBeVisible();
    expect(submissions).toBe(2);
    await page.reload();
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("Email atau username")).toHaveValue("");
    await expect(submit).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("1 menit 5 detik");
    await page.clock.fastForward(5_000);
    await page.reload();
    await expect(page.getByRole("status")).toContainText("1 menit");
    expect(submissions).toBe(2);
  });
}

test("reload after expiry removes the hint and never submits automatically", async ({ page }) => {
  let submissions = 0;
  await page.route("**/api/login", route => {
    submissions++;
    return route.fulfill({ status: 429, json: { retryAfterSeconds: 65 } });
  });
  await openLogin(page);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.clock.setSystemTime(new Date(await page.evaluate(() => Date.now()) + 65_000));
  await page.reload();
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("login-cooldown-until"))).toBeNull();
  expect(submissions).toBe(1);
});

test("expiry on the open page clears persisted storage as well", async ({ page }) => {
  await page.route("**/api/login", route => route.fulfill({
    status: 429, json: { retryAfterSeconds: 2 },
  }));
  await openLogin(page);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("status")).toBeVisible();
  const stored = await page.evaluate(() => ({
    local: { ...localStorage }, session: { ...sessionStorage }, now: Date.now(),
  }));
  expect(stored.session).toEqual({ "login-cooldown-until": String(stored.now + 2000) });
  expect(JSON.stringify(stored)).not.toContain("login-timer@example.test");
  expect(JSON.stringify(stored)).not.toContain("test-password-only");
  expect(stored.local).not.toHaveProperty("login-cooldown-until");
  await page.clock.fastForward(2000);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  expect(await page.evaluate(() => sessionStorage.getItem("login-cooldown-until"))).toBeNull();
  await page.reload();
  await expect(page.getByRole("status")).toHaveCount(0);
});

for (const value of ["corrupt", "expired", "too-far"] as const) {
  test(`reload discards ${value} storage without locking login`, async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(value => {
      sessionStorage.setItem("login-cooldown-until", value === "corrupt" ? '{"username":"invalid"}'
        : String(Date.now() + (value === "expired" ? -1 : 900_001)));
    }, value);
    await page.reload();
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem("login-cooldown-until"))).toBeNull();
  });
}

for (const failure of ["access", "write", "remove"] as const) {
  test(`storage ${failure} denied: countdown and login remain usable`, async ({ page }) => {
    await page.addInitScript(failure => {
      if (failure === "access") {
        Object.defineProperty(window, "sessionStorage", {
          get() { throw new DOMException("Denied", "SecurityError"); },
        });
      } else {
        const method = failure === "write" ? "setItem" : "removeItem";
        Storage.prototype[method] = () => { throw new DOMException("Denied", "QuotaExceededError"); };
      }
    }, failure);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    let submissions = 0;
    await page.route("**/api/login", route => {
      submissions++;
      return route.fulfill({ status: 429, json: { retryAfterSeconds: 2 } });
    });
    await openLogin(page);
    const submit = page.locator('button[type="submit"]');
    await submit.click();
    await expect(page.getByRole("status")).toContainText("2 detik");
    await expect(submit).toBeDisabled();
    await page.clock.fastForward(2000);
    await expect(submit).toBeEnabled();
    await page.reload();
    await expect(submit).toBeEnabled();
    await expect(page.getByRole("status")).toHaveCount(0);
    await page.getByLabel("Email atau username").fill("login-timer@example.test");
    await page.getByLabel("Password", { exact: true }).fill("test-password-only");
    await submit.click();
    await expect(page.getByRole("status")).toContainText("2 detik");
    expect(submissions).toBe(2);
    expect(errors).toEqual([]);
  });
}

test("removing the client hint does not bypass a server rejection", async ({ page }) => {
  let submissions = 0;
  await page.route("**/api/login", route => {
    submissions++;
    return route.fulfill({ status: 429, json: { retryAfterSeconds: 60 } });
  });
  await openLogin(page);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.evaluate(() => sessionStorage.removeItem("login-cooldown-until"));
  await openLogin(page);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole("status")).toContainText("1 menit");
  await expect(page.locator('button[type="submit"]')).toBeDisabled();
  expect(submissions).toBe(2);
});

test("401 and 503 remain distinct and do not start a throttle timer", async ({ page }) => {
  let status = 401;
  await page.route("**/api/login", route => route.fulfill({
    status, headers: { "Retry-After": "60" },
    json: { message: status === 401 ? "Username atau password salah" : "Login sementara tidak tersedia. Silakan coba lagi nanti." },
  }));
  await openLogin(page);
  const submit = page.getByRole("button", { name: "Masuk", exact: true });
  await submit.click();
  await expect(page.getByRole("alert")).toHaveText("Username atau password salah");
  await expect(submit).toBeEnabled();
  await expect(page.getByRole("status")).toHaveCount(0);
  status = 503;
  await submit.click();
  await expect(page.getByRole("alert")).toHaveText("Login sementara tidak tersedia. Silakan coba lagi nanti.");
  await expect(submit).toBeEnabled();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("malformed 429 metadata shows the server message without an indefinite lock", async ({ page }) => {
  await page.route("**/api/login", route => route.fulfill({
    status: 429, headers: { "Retry-After": "invalid" },
    json: { message: "Terlalu banyak percobaan login.", retryAfterSeconds: -5 },
  }));
  await openLogin(page);
  const submit = page.getByRole("button", { name: "Masuk", exact: true });
  await submit.click();
  await expect(page.getByRole("alert")).toHaveText("Terlalu banyak percobaan login.");
  await expect(submit).toBeEnabled();
});
