import { randomUUID } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import { inArray } from "drizzle-orm";
import { db } from "../server/db";
import { createUser, comparePassword } from "../server/auth";
import { storage } from "../server/storage";
import { users } from "../shared/schema";

const initial = "Temporary-Network-Initial-2026!";
const replacement = "Temporary-Network-Replacement-2026!";
type Account = { id: string; username: string };
const test = base.extend<{ accounts: Account[] }>({
  accounts: async ({ context }, use) => {
    const accounts: Account[] = [], participants: string[] = [];
    try {
      for (let i = 0; i < 2; i++) {
        const username = `password-network-${randomUUID()}@example.test`;
        const participant = await storage.createParticipant({
          name: "Peserta Sementara", nip: randomUUID(), position: "Staf", unit: "Uji", email: username,
        });
        participants.push(participant.id);
        accounts.push(await createUser(username, initial, { role: "participant", participantId: participant.id }));
      }
      await use(accounts);
    } finally {
      await context.request.post("/api/logout");
      if (accounts.length) await db.delete(users).where(inArray(users.id, accounts.map(a => a.id)));
      for (const id of participants) await storage.deleteParticipant(id);
    }
  },
});

async function login(page: Page, account: Account, password = initial) {
  if (!new URL(page.url()).pathname.startsWith("/login")) await page.goto("/login");
  await page.locator("#username").fill(account.username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.getByTestId("button-user-menu")).toBeVisible();
}
async function open(page: Page) {
  await page.getByTestId("button-user-menu").click();
  await page.getByTestId("menu-item-change-password").click();
  await expect(page.getByRole("dialog")).toBeVisible();
}
async function fill(page: Page) {
  await page.locator("#current-password").fill(initial);
  await page.locator("#new-password").fill(replacement);
  await page.locator("#confirm-password").fill(replacement);
}
async function signOut(page: Page) {
  await page.getByTestId("button-user-menu").click();
  await page.getByTestId("menu-item-logout").click();
  await expect(page.locator("#username")).toBeVisible();
}

// Deliberately ignore AbortSignal so a transport that delivers late can be tested.
// Other requests, authentication and the account's database records remain real.
async function installTransport(page: Page, mode: "hang" | "fail" | "committed") {
  await page.evaluate(mode => {
    const original = window.fetch.bind(window);
    const state = { calls: 0, release: () => {}, committed: false };
    (window as any).passwordTransport = state;
    window.fetch = async (...args) => {
      if (args[0] !== "/api/me/password") return original(...args);
      state.calls++;
      if (mode === "fail") throw new TypeError("Network disconnected");
      const response = mode === "committed"
        ? await original(args[0], { ...args[1], signal: undefined })
        : new Response(JSON.stringify({ message: "Password berhasil diubah" }), { status: 200 });
      state.committed = mode === "committed";
      return new Promise<Response>(resolve => { state.release = () => resolve(response); });
    };
  }, mode);
}
async function expire(page: Page) {
  await page.clock.fastForward(20_100);
  await expect(page.getByRole("alert")).toContainText("belum terkonfirmasi");
  await expect(page.getByRole("button", { name: "Batal", exact: true })).toBeEnabled();
  await expect(page.getByTestId("button-submit-change-password")).toBeDisabled();
  expect(await page.evaluate(() => (window as any).passwordTransport.calls)).toBe(1);
}

for (const close of ["cancel", "escape", "outside"] as const) {
  test(`hanging request: pending blocks dismissal, timeout restores ${close}, late success stays ignored`, async ({ page, accounts }) => {
    await login(page, accounts[0]);
    await page.clock.install();
    await installTransport(page, "hang");
    await open(page);
    await fill(page);
    await page.getByTestId("button-submit-change-password").click();
    await expect(page.getByTestId("button-submit-change-password")).toHaveText("Menyimpan...");
    await expect(page.getByRole("button", { name: "Batal", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await page.mouse.click(5, 5);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expire(page);
    if (close === "cancel") await page.getByRole("button", { name: "Batal", exact: true }).click();
    if (close === "escape") await page.keyboard.press("Escape");
    if (close === "outside") await page.mouse.click(5, 5);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await open(page);
    await page.locator("#current-password").fill("dialog-baru");
    await page.evaluate(() => (window as any).passwordTransport.release());
    await page.clock.fastForward(3_000);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("#current-password")).toHaveValue("dialog-baru");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("Password berhasil diubah!", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).passwordTransport.calls)).toBe(1);
  });
}

test("network failure is uncertain, retained when editing, and never resubmitted", async ({ page, accounts }) => {
  await login(page, accounts[0]);
  await installTransport(page, "fail");
  await open(page);
  await fill(page);
  await page.getByTestId("button-submit-change-password").click();
  await expect(page.getByRole("alert")).toContainText("Password mungkin sudah berubah");
  await expect(page.getByRole("alert")).toContainText("coba masuk dengan password baru");
  await page.locator("#current-password").fill("edited-password");
  await page.locator("#confirm-password").press("Enter");
  await expect(page.getByRole("alert")).toContainText("belum terkonfirmasi");
  expect(await page.evaluate(() => (window as any).passwordTransport.calls)).toBe(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("lost response after commit: verify new credential by normal logout/login", async ({ page, accounts }) => {
  await login(page, accounts[0]);
  await page.clock.install();
  await installTransport(page, "committed");
  await open(page);
  await fill(page);
  await page.getByTestId("button-submit-change-password").click();
  await expect.poll(() => page.evaluate(() => (window as any).passwordTransport.committed)).toBe(true);
  const [stored] = await db.select().from(users).where(inArray(users.id, [accounts[0].id]));
  expect(await comparePassword(replacement, stored.password)).toBe(true);
  await expire(page);
  await page.keyboard.press("Escape");
  await signOut(page);
  await login(page, accounts[0], replacement);
  await open(page);
  await page.evaluate(() => (window as any).passwordTransport.release());
  await page.clock.fastForward(3_000);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("account switch in another tab discards pending success and clears old fields", async ({ page, context, accounts }) => {
  await login(page, accounts[0]);
  await installTransport(page, "hang");
  await open(page);
  await fill(page);
  await page.getByTestId("button-submit-change-password").click();
  const other = await context.newPage();
  await other.goto("/app");
  await expect(other.getByTestId("button-user-menu")).toBeVisible();
  await signOut(other);
  await login(other, accounts[1]);
  await expect.poll(() => page.evaluate(() => (document.querySelector("#current-password") as HTMLInputElement | null)?.value ?? "")).toBe("");
  await page.bringToFront();
  // A same-layout account transition may leave a new, empty dialog open.
  if (!await page.getByRole("dialog").count()) await open(page);
  await page.locator("#current-password").fill("akun-baru");
  await page.evaluate(() => (window as any).passwordTransport.release());
  await page.waitForTimeout(2_000);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("#current-password")).toHaveValue("akun-baru");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Password berhasil diubah!", { exact: true })).toHaveCount(0);
});
