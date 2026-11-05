import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import { test } from "./account-switch.fixture";
import { storage } from "../server/storage";

test("peserta mengunduh portofolio dan kegagalan ekspor dapat dicoba kembali", async ({ page, accounts }) => {
  const { a, titleA, reflectionA, titleB } = await accounts.setup(false);
  await storage.addEvidence(a.participantId!, {
    unitId: "pkb-degree", type: "document", title: "Bukti portofolio browser",
    description: "Bukti milik peserta",
  });
  await page.goto("/login");
  await accounts.signIn(page, a);
  await expect(page.getByText("Portofolio pribadi", { exact: true })).toBeVisible();
  const button = page.getByTestId("button-download-passport");
  await page.route("**/portfolio-export", route => route.fulfill({
    status: 500, contentType: "application/json", body: JSON.stringify({ message: "Ekspor gagal untuk pengujian." }),
  }));
  await button.click();
  await expect(page.getByRole("alert")).toContainText("Ekspor gagal untuk pengujian.");
  await expect(button).toBeEnabled();
  await page.unroute("**/portfolio-export");
  const downloadPromise = page.waitForEvent("download");
  await button.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("portofolio-pkb.html");
  const html = await readFile((await download.path())!, "utf8");
  expect(html).toContain("Bukti portofolio browser");
  expect(html).toContain(titleA);
  expect(html).not.toContain(titleB);
  expect(html).not.toContain(reflectionA);
  expect(html).toContain("bukan SKK maupun keputusan resmi");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: "generated-artifacts/portfolio/participant.jpg", fullPage: true });
});

test("koordinator mengunduh peserta kelompoknya tanpa refleksi privat", async ({ page, accounts }) => {
  const { a, b, pic, titleA, reflectionA, reflectionB } = await accounts.setup(false);
  await storage.addEvidence(a.participantId!, {
    unitId: "pkb-degree", type: "reflection", title: "REFLEKSI-BUKTI-PRIVAT", description: "Jangan dibagikan",
  });
  await page.goto("/login");
  await accounts.signIn(page, pic);
  await page.getByRole("button", { name: /Peserta a/ }).click();
  const button = page.getByTestId("button-download-passport");
  await expect(button).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await button.click();
  const download = await downloadPromise;
  const html = await readFile((await download.path())!, "utf8");
  expect(html).toContain(titleA);
  for (const secret of [reflectionA, reflectionB, "REFLEKSI-BUKTI-PRIVAT"]) expect(html).not.toContain(secret);
  expect((await page.request.get(`/api/participants/${b.participantId}/portfolio-export`)).status()).toBe(404);
  await page.screenshot({ path: "generated-artifacts/portfolio/coordinator.jpg", fullPage: true });
});
