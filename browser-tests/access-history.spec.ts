import { expect, type Page } from "@playwright/test";
import { test } from "./access-history.fixture";

const historyPath = "/api/access/status-history";
type Filters = { actor?: string; target?: string; from?: string; to?: string };
type Entry = { id: string; reason: string; changedAt: string };
type HistoryResponse = { entries: Entry[]; hasMore: boolean };

// Observe real requests/responses without routing, mocking hooks or changing auth.
async function change(page: Page, filters: Filters, offset: number, action: () => Promise<unknown>) {
  const responsePromise = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === historyPath && url.searchParams.get("offset") === String(offset)
      && (["actor", "target", "from", "to"] as const).every(key =>
        url.searchParams.get(key) === (filters[key] || null));
  });
  await action();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const body = await response.json() as HistoryResponse;
  await assertRendered(page, body, offset);
  return body;
}

async function assertRendered(page: Page, body: HistoryResponse, offset: number) {
  // time elements belong only to the audit cards on this page.
  await expect(page.locator("time")).toHaveCount(body.entries.length);
  expect(await page.locator("time").evaluateAll(nodes => nodes.map(node => node.getAttribute("datetime"))))
    .toEqual(body.entries.map(entry => entry.changedAt));
  for (const entry of body.entries) await expect(page.getByText(entry.reason, { exact: false })).toBeVisible();
  if (body.entries.length) {
    await expect(page.getByText(`Menampilkan ${offset + 1}–${offset + body.entries.length} dari riwayat`, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sebelumnya", exact: true })).toBeEnabled({ enabled: offset > 0 });
    await expect(page.getByRole("button", { name: "Berikutnya", exact: true })).toBeEnabled({ enabled: body.hasMore });
  }
}

test("admin filters real history, paginates, and each filter change returns to page one", async ({ page, history }) => {
  await history.signIn(page);
  await expect(page.locator("time")).toHaveCount(50);
  const initialTimes = await page.locator("time").evaluateAll(nodes => nodes.map(node => node.getAttribute("datetime")));
  const filters: Filters = {};
  filters.actor = history.admin.username;
  let body = await change(page, filters, 0, () => page.getByLabel("Pelaku", { exact: true }).fill(filters.actor!));
  expect(body.entries).toHaveLength(50);
  expect(body.hasMore).toBe(true);

  // Each field changes while on page two. A changed query must send offset=0.
  const steps = [
    ["target", history.target.username, "Akun sasaran"],
    ["from", "2030-03-10", "Tanggal awal (WIB)"],
    ["to", "2030-03-10", "Tanggal akhir (WIB)"],
    ["actor", history.admin.id, "Pelaku"],
  ] as const;
  for (const [key, value, label] of steps) {
    const secondPage = await change(page, filters, 50, () =>
      page.getByRole("button", { name: "Berikutnya", exact: true }).click());
    expect(secondPage.entries.length).toBeGreaterThan(0);
    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.entries.some(entry => body.entries.some(first => first.id === entry.id))).toBe(false);
    filters[key] = value;
    body = await change(page, filters, 0, () => page.getByLabel(label, { exact: true }).fill(value));
    expect(body.entries).toHaveLength(50);
    expect(body.hasMore).toBe(true);
  }

  const expected = history.entries.filter(entry =>
    entry.actorId === history.admin.id && entry.targetUserId === history.target.id
    && entry.changedAt! >= new Date("2030-03-09T17:00:00Z")
    && entry.changedAt! < new Date("2030-03-10T17:00:00Z"))
    .sort((a, b) => b.changedAt!.getTime() - a.changedAt!.getTime());
  expect(expected).toHaveLength(52);
  expect(body.entries.map(entry => entry.id)).toEqual(expected.slice(0, 50).map(entry => entry.id));
  const next = await change(page, filters, 50, () =>
    page.getByRole("button", { name: "Berikutnya", exact: true }).click());
  expect(next.entries.map(entry => entry.id)).toEqual(expected.slice(50).map(entry => entry.id));
  expect(next.hasMore).toBe(false);
  await expect(page.locator("time").last()).toHaveText(/10 Mar 2030.*00[.:]00 WIB/);
  await page.getByRole("button", { name: "Sebelumnya", exact: true }).click();
  await assertRendered(page, body, 0);

  // Reset all four fields from page two, not merely an empty result on page one.
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  await assertRendered(page, next, 50);
  // The initial unfiltered query is already cached; resetting need not refetch it.
  await page.getByRole("button", { name: "Reset filter", exact: true }).click();
  await expect(page.getByText("Menampilkan 1–50 dari riwayat", { exact: true })).toBeVisible();
  expect(await page.locator("time").evaluateAll(nodes => nodes.map(node => node.getAttribute("datetime")))).toEqual(initialTimes);
  await expect(page.getByRole("button", { name: "Sebelumnya", exact: true })).toBeDisabled();
  for (const key of ["actor", "target", "from", "to"]) await expect(page.locator(`#history-${key}`)).toHaveValue("");
  await expect(page.getByRole("button", { name: "Reset filter", exact: true })).toBeDisabled();
});

test("invalid date range hides history, sends no invalid API query, and recovers when corrected", async ({ page, history }) => {
  await history.signIn(page);
  const filters = { actor: history.admin.id, from: "2030-03-11" };
  await change(page, { actor: filters.actor }, 0, () => page.locator("#history-actor").fill(filters.actor));
  await change(page, filters, 0, () => page.locator("#history-from").fill(filters.from));
  const invalidRequests: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname === historyPath && url.searchParams.get("from")! > url.searchParams.get("to")!
      && url.searchParams.has("to")) invalidRequests.push(request.url());
  });
  await page.locator("#history-to").fill("2030-03-10");
  await expect(page.getByRole("alert")).toContainText("Filter tanggal tidak valid");
  await expect(page.locator("time")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Berikutnya", exact: true })).toHaveCount(0);
  // Wait through a browser task/frame so a mistakenly enabled query can dispatch.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(invalidRequests).toEqual([]);
  const corrected = await change(page, { ...filters, to: "2030-03-11" }, 0, () => page.locator("#history-to").fill("2030-03-11"));
  expect(corrected.entries).toHaveLength(1);
  expect(corrected.entries[0].changedAt).toBe("2030-03-10T17:00:00.000Z");
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(invalidRequests).toEqual([]);
});

test("unmatched filter shows an empty result and reset restores unfiltered history", async ({ page, history }) => {
  await history.signIn(page);
  await expect(page.getByRole("button", { name: "Reset filter", exact: true })).toBeDisabled();
  const missing = `${history.target.username}-no-match`;
  const empty = await change(page, { target: missing }, 0, () => page.locator("#history-target").fill(missing));
  expect(empty).toEqual({ entries: [], hasMore: false });
  await expect(page.getByText("Tidak ada riwayat yang cocok dengan filter.", { exact: true })).toBeVisible();
  await expect(page.getByText("Belum ada riwayat perubahan status akun.", { exact: true })).toHaveCount(0);
  // Reset can reuse the initial unfiltered response. Verify the rendered result,
  // not an extra request the application's infinite-stale cache need not send.
  await page.getByRole("button", { name: "Reset filter", exact: true }).click();
  await expect(page.locator("#history-target")).toHaveValue("");
  await expect(page.locator("time")).toHaveCount(50);
  await expect(page.getByText(/^Menampilkan 1–50 dari riwayat$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Sebelumnya", exact: true })).toBeDisabled();
  await expect(page.getByText("Tidak ada riwayat yang cocok dengan filter.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reset filter", exact: true })).toBeDisabled();
});
