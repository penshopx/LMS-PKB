import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", route => route.fulfill({ status: 401, json: {} }));
  await page.clock.install();
});

async function openLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email atau username").fill("login-timer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
}

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
  });
}

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
