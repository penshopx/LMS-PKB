import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import WebSocket from "ws";
import { eq } from "drizzle-orm";
import { users } from "../shared/schema";
import { createUser, comparePassword } from "../server/auth";
import { storage } from "../server/storage";
import { db, pool } from "../server/db";

// Isolated development-only browser check. Never use existing users or credentials.
const baseURL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
const output = path.resolve("generated-artifacts/password-dialog");
const initialPassword = "VisualDialog-Initial-2026!";
const replacement = "Z".repeat(128);
const checks: string[] = [];
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const quote = JSON.stringify;

class Browser {
  private sequence = 0;
  private pending = new Map<number, { resolve: (result: any) => void; reject: (error: Error) => void }>();
  private sessionId?: string;
  readonly errors: string[] = [];
  constructor(private socket: WebSocket) {
    socket.on("message", data => {
      const message = JSON.parse(String(data));
      if (message.method === "Runtime.exceptionThrown") {
        this.errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
    });
  }
  async send(method: string, params: Record<string, unknown> = {}, browser = false): Promise<any> {
    const id = ++this.sequence;
    const result = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.socket.send(JSON.stringify({ id, method, params, ...(!browser && this.sessionId ? { sessionId: this.sessionId } : {}) }));
    return result;
  }
  async attach() {
    const { targetId } = await this.send("Target.createTarget", { url: "about:blank" }, true);
    const result = await this.send("Target.attachToTarget", { targetId, flatten: true }, true);
    this.sessionId = result.sessionId;
    await this.send("Runtime.enable");
    await this.send("Page.enable");
  }
  async evaluate<T = any>(expression: string): Promise<T> {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  async wait(condition: string, label: string, timeout = 15_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try { if (await this.evaluate(`Boolean(${condition})`)) return; } catch { /* navigation changes execution contexts */ }
      await pause(80);
    }
    throw new Error(`Browser check timed out: ${label}`);
  }
  async click(selector: string) {
    const rect = await this.evaluate(`(() => { const e = document.querySelector(${quote(selector)}); if (!e) throw new Error("Missing control"); e.scrollIntoView({block:"center"}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await this.clickAt(rect.x, rect.y);
  }
  async clickAt(x: number, y: number) {
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }
  async key(key: string, code: number) {
    await this.send("Input.dispatchKeyEvent", { type: "keyDown", key, windowsVirtualKeyCode: code });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key, windowsVirtualKeyCode: code });
  }
  async fill(selector: string, value: string) {
    await this.evaluate(`(() => { const e=document.querySelector(${quote(selector)}); e.focus(); e.select(); })()`);
    await this.key("Backspace", 8);
    if (value) await this.send("Input.insertText", { text: value });
    await pause(70);
  }
  async screenshot(name: string) {
    const result = await this.send("Page.captureScreenshot", { format: "png" });
    await writeFile(path.join(output, `${name}.png`), Buffer.from(result.data, "base64"));
  }
  close() { this.socket.close(); }
}

async function main() {
  if (!process.env.REPLIT_DEV_DOMAIN) throw new Error("This browser check requires the running development preview.");
  await mkdir(output, { recursive: true });
  const profile = await mkdtemp(path.join(tmpdir(), "password-dialog-browser-"));
  let browser: Browser | undefined;
  let participantId: string | undefined;
  let userId: string | undefined;
  const child = spawn("/repl/tools/bin/chromium", [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  try {
    const endpoint = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Chromium startup timed out")), 20_000);
      child.on("error", error => { clearTimeout(timer); reject(error); });
      child.on("exit", code => { clearTimeout(timer); reject(new Error(`Chromium exited during startup (${code})`)); });
      child.stderr.on("data", data => {
        const match = String(data).match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    const socket = new WebSocket(endpoint);
    await new Promise<void>((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
    browser = new Browser(socket);
    await browser.attach();
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

    const username = `visual-dialog-${randomUUID()}@example.test`;
    const participant = await storage.createParticipant({
      name: "Peserta Uji Visual", nip: randomUUID(), position: "Staf", unit: "Uji", email: username,
    });
    participantId = participant.id;
    const user = await createUser(username, initialPassword, { role: "participant", participantId });
    userId = user.id;
    await browser.send("Page.navigate", { url: `${baseURL}/login` });
    await browser.wait('document.querySelector("#username")', "login form");
    await browser.fill("#username", username);
    await browser.fill("#password", initialPassword);
    await browser.click('button[type="submit"]');
    await browser.wait('document.querySelector("[data-testid=button-user-menu]")', "participant sign-in");
    const me = await browser.evaluate('fetch("/api/me").then(r=>r.json())');
    assert.equal(me.role, "participant");
    assert.equal(me.id, userId);
    const dialog = '[data-testid="dialog-change-password"]';
    const save = '[data-testid="button-submit-change-password"]';
    const open = async () => {
      await browser!.click('[data-testid="button-user-menu"]');
      await browser!.wait('document.querySelector("[data-testid=menu-item-change-password]")', "account menu");
      await browser!.click('[data-testid="menu-item-change-password"]');
      await browser!.wait(`document.querySelector(${quote(dialog)})`, "password dialog");
    };
    const values = async (next: string, confirmation = next) => {
      await browser!.fill("#current-password", initialPassword);
      await browser!.fill("#new-password", next);
      await browser!.fill("#confirm-password", confirmation);
    };
    const disabled = () => browser!.evaluate<boolean>(`document.querySelector(${quote(save)}).disabled`);
    const error = () => browser!.evaluate<string>('document.querySelector("#new-password-error")?.textContent ?? ""');
    await open();
    assert.equal(await disabled(), true);
    checks.push("Save disabled for empty fields");
    await values("abcdefghijk");
    assert.match(await error(), /minimal 12/);
    assert.equal(await disabled(), true);
    await browser.key("Enter", 13);
    await browser.screenshot("desktop-length-error");
    checks.push("11 characters: inline length error, Save disabled, Enter does not submit");
    await values(" abcdefghijk");
    assert.match(await error(), /minimal 12/);
    assert.equal(await disabled(), true);
    await values(" abcdefghijkl ");
    assert.equal(await disabled(), false);
    checks.push("Boundary spaces do not count toward the minimum; valid padded passwords remain untrimmed");
    await values(initialPassword);
    assert.match(await error(), /harus berbeda/);
    assert.equal(await disabled(), true);
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 402, height: 874, deviceScaleFactor: 1, mobile: true });
    await browser.screenshot("mobile-identical-error");
    assert.equal(await browser.evaluate("document.documentElement.scrollWidth <= innerWidth"), true);
    checks.push("Identical password: visible inline error and disabled Save on mobile, no horizontal overflow");
    await values("password123456");
    assert.match(await error(), /tidak memenuhi kebijakan/);
    assert.equal(await disabled(), true);
    checks.push("password123456: policy error and disabled Save");
    await values("abcdefghijkl", "different-password");
    assert.equal(await disabled(), true);
    assert.match(await browser.evaluate('document.querySelector("#confirm-password-error").textContent'), /tidak cocok/);
    checks.push("Mismatched confirmation: inline error and disabled Save");
    await browser.key("Escape", 27);
    await browser.wait(`!document.querySelector(${quote(dialog)})`, "Escape dismissal");
    await open();
    assert.equal(await browser.evaluate('document.querySelector("#new-password").value'), "");
    assert.equal(await disabled(), true);
    await browser.clickAt(10, 10);
    await browser.wait(`!document.querySelector(${quote(dialog)})`, "outside-click dismissal");
    await open();
    assert.equal(await browser.evaluate('document.querySelector("#current-password").value'), "");
    checks.push("Escape and outside click close the dialog; reopened fields are cleared");
    await values("Z".repeat(129));
    assert.equal(await browser.evaluate('document.querySelector("#new-password").value.length'), 128);
    const overlong = await browser.evaluate(`fetch("/api/me/password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currentPassword:${quote(initialPassword)},newPassword:"Z".repeat(129)})}).then(async r=>({status:r.status,body:await r.json()}))`);
    assert.equal(overlong.status, 400);
    assert.match(overlong.body.message, /maksimal 128/);
    checks.push("129 characters: browser limits typing to 128; direct API bypass is rejected");
    await values(replacement);
    assert.equal(await disabled(), false);
    await browser.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.screenshot("desktop-valid-128");
    await browser.click(save);
    await browser.wait('document.body.textContent.includes("Password berhasil diubah!")', "successful save");
    await browser.wait(`!document.querySelector(${quote(dialog)})`, "automatic success dismissal");
    const [stored] = await db.select().from(users).where(eq(users.id, userId));
    assert.equal(await comparePassword(replacement, stored.password), true);
    checks.push("128 characters: enabled Save, successful UI save, correct stored credential, automatic close");
    await browser.click('[data-testid="button-user-menu"]');
    await browser.wait('document.querySelector("[data-testid=menu-item-logout]")', "logout menu");
    await browser.click('[data-testid="menu-item-logout"]');
    await browser.wait('document.querySelector("#username")', "logout redirect");
    await browser.fill("#username", username);
    await browser.fill("#password", replacement);
    await browser.click('button[type="submit"]');
    await browser.wait('document.querySelector("[data-testid=button-user-menu]")', "login with replacement");
    checks.push("Normal logout and subsequent login with the 128-character password succeed");
    assert.deepEqual(browser.errors, []);
    await browser.click('[data-testid="button-user-menu"]');
    await browser.wait('document.querySelector("[data-testid=menu-item-logout]")', "final logout menu");
    await browser.click('[data-testid="menu-item-logout"]');
    await browser.wait('document.querySelector("#username")', "final logout");
    await writeFile(path.join(output, "report.json"), JSON.stringify({ checks, runtimeErrors: browser.errors }, null, 2));
    console.log(`PASS: ${checks.length} signed-in browser checks. Evidence: generated-artifacts/password-dialog/`);
    for (const check of checks) console.log(`- ${check}`);
  } finally {
    browser?.close();
    child.kill("SIGTERM");
    await pause(500);
    if (child.exitCode === null) child.kill("SIGKILL");
    if (userId) await db.delete(users).where(eq(users.id, userId));
    if (participantId) await storage.deleteParticipant(participantId);
    await rm(profile, { recursive: true, force: true, maxRetries: 3 });
    await pool.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
