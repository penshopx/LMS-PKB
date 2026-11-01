import express from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import pg from "pg";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { users, certificatesTable, accountStatusHistory } from "@shared/schema";
import { createUser, setupAuth } from "../auth";
import { db, pool } from "../db";
import { storage } from "../storage";
import { registerRoutes } from "../routes";

const tag = randomUUID();
const password = "account-status-test-password";
const defaultReason = "Penyesuaian akses sesuai kebutuhan operasional BUJK.";
const ids: string[] = [];
const cookies: Record<string, string> = {};
let server: Server;
let baseUrl: string;
let adminId: string;
let learnerId: string;
let picId: string;
let participantId: string;
let courseId: string;
let attemptId: string;
let certificateId: string;
let retainedData: unknown;

async function request(actor: string, path: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookies[actor] ? { Cookie: cookies[actor] } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function login(actor: string) {
  const response = await request("", "/api/login", "POST", { username: `${actor}-${tag}`, password });
  if (response.status === 200) {
    cookies[actor] = response.headers.get("set-cookie")!.split(";")[0];
  }
  return response;
}

function setStatus(id: string, isActive: boolean, actor = "admin", reason = defaultReason) {
  return request(actor, `/api/access/users/${id}/status`, "PATCH", { isActive, reason });
}

async function learningData() {
  return {
    participant: await storage.getParticipant(participantId),
    attempts: await storage.getQuizAttemptsByParticipant(participantId),
    certificates: await storage.getCertificatesByParticipant(participantId),
  };
}

function signal() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

async function createTestAccount(label: string) {
  const actor = `${label}-${randomUUID()}`;
  const account = await createUser(`${actor}-${tag}`, password, { role: "participant" });
  ids.push(account.id);
  return { actor, account };
}

// Hold the real username lookup's result, not a fabricated account snapshot.
// This puts status changes between the login read and Passport serialization.
function pauseAccountRead(id: string) {
  const read = signal();
  const release = signal();
  const realSelect = db.select.bind(db);
  let paused = false;
  const spy = vi.spyOn(db, "select").mockImplementation((...args) => {
    const selection = realSelect(...args);
    const realFrom = selection.from.bind(selection);
    vi.spyOn(selection, "from").mockImplementation((...fromArgs) => {
      const query = realFrom(...fromArgs);
      if (fromArgs[0] !== users) return query;
      const realWhere = query.where.bind(query);
      vi.spyOn(query, "where").mockImplementation((...whereArgs) => {
        const result = realWhere(...whereArgs);
        const realThen = result.then.bind(result);
        vi.spyOn(result, "then").mockImplementation((onFulfilled, onRejected) =>
          realThen(async rows => {
            if (!paused && rows.length === 1 && rows[0].id === id) {
              paused = true;
              read.resolve();
              await release.promise;
            }
            return rows;
          }).then(onFulfilled, onRejected),
        );
        return result;
      });
      return query;
    });
    return selection;
  });
  return {
    read: read.promise,
    resume: release.resolve,
    restore() {
      release.resolve();
      spy.mockRestore();
    },
  };
}

// Both real transactions enter their callbacks while an independent row lock
// holds them back. Dispatch both before releasing it, without timing guesses or
// depending on pg_stat_activity (disabled on the managed test database).
async function parallelStatusChanges(id: string, first: boolean, second: boolean) {
  const blocker = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const realTransaction = db.transaction.bind(db);
  const ready = [signal(), signal()];
  const gates = [signal(), signal()];
  const dispatched = [signal(), signal()];
  const requests: Promise<Response>[] = [];
  let count = 0;
  await blocker.connect();
  await blocker.query("BEGIN");
  await blocker.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [id]);
  const spy = vi.spyOn(db, "transaction").mockImplementation((callback, config) => {
    const index = count++;
    if (index > 1) throw new Error("Unexpected transaction in status race");
    return realTransaction(async tx => {
      ready[index].resolve();
      await gates[index].promise;
      const result = callback(tx);
      dispatched[index].resolve();
      return result;
    }, config);
  });
  try {
    requests.push(setStatus(id, first));
    await ready[0].promise;
    requests.push(setStatus(id, second));
    await ready[1].promise;
    gates[0].resolve();
    await dispatched[0].promise;
    gates[1].resolve();
    await dispatched[1].promise;
    await blocker.query("COMMIT");
    return await Promise.all(requests);
  } finally {
    gates.forEach(gate => gate.resolve());
    await blocker.query("ROLLBACK").catch(() => undefined);
    await Promise.allSettled(requests);
    spy.mockRestore();
    await blocker.end();
  }
}

beforeAll(async () => {
  const participant = await storage.createParticipant({
    name: "Peserta status akun", email: `learner-${tag}@example.test`,
    nip: tag, position: "Staf", unit: "Uji",
  });
  participantId = participant.id;
  for (const role of ["admin", "participant", "bujk_pic"] as const) {
    const actor = role === "participant" ? "learner" : role === "bujk_pic" ? "pic" : "admin";
    const account = await createUser(`${actor}-${tag}`, password, {
      role, ...(role === "participant" ? { participantId } : {}),
    });
    ids.push(account.id);
    if (actor === "admin") adminId = account.id;
    if (actor === "learner") learnerId = account.id;
    if (actor === "pic") picId = account.id;
  }
  const course = await storage.createCourse({
    title: `Account status ${tag}`, description: "Uji", unitId: "tender-01",
    targetLevel: "L1", duration: "10 menit",
  });
  courseId = course.id;
  const quiz = await storage.createQuiz({
    courseId, title: "Uji", description: "Uji", passingScore: 80, questions: [],
  });
  const attempt = await storage.createQuizAttempt({
    quizId: quiz.id, participantId, answers: [], score: 90, maxScore: 100,
    passed: true, gradingStatus: "graded",
    startedAt: new Date().toISOString(), completedAt: new Date().toISOString(),
  });
  attemptId = attempt.id;
  const certificate = await storage.createCertificate({
    participantId, courseId, title: "Sertifikat uji", description: "Tetap tersimpan",
  });
  certificateId = certificate.id;
  retainedData = await learningData();
  const app = express();
  app.use(express.json());
  setupAuth(app);
  server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
    resolve();
  }));
  for (const actor of ["admin", "learner", "pic"]) expect((await login(actor)).status).toBe(200);
});

afterAll(async () => {
  if (adminId) await db.delete(accountStatusHistory).where(eq(accountStatusHistory.actorId, adminId));
  if (ids.length) await db.delete(users).where(inArray(users.id, ids));
  if (certificateId) await db.delete(certificatesTable).where(eq(certificatesTable.id, certificateId));
  if (courseId) await storage.deleteCourse(courseId);
  if (participantId) await storage.deleteParticipant(participantId);
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe("account status management", () => {
  async function history() {
    return db.select().from(accountStatusHistory).where(eq(accountStatusHistory.actorId, adminId));
  }

  it("lists status without exposing password or session credentials", async () => {
    const response = await request("admin", "/api/access/users");
    expect(response.status).toBe(200);
    const accounts = await response.json();
    expect(accounts.find((a: { id: string }) => a.id === learnerId)).toMatchObject({ isActive: true, participantId });
    for (const account of accounts) {
      expect(account).not.toHaveProperty("password");
      expect(account).not.toHaveProperty("sessionVersion");
    }
  });

  it("rejects unauthenticated and non-admin changes, invalid input, absent accounts, and admin targets", async () => {
    const before = await history();
    expect((await request("", "/api/access/status-history")).status).toBe(401);
    expect((await setStatus(learnerId, false, "")).status).toBe(401);
    for (const actor of ["learner", "pic"]) {
      expect((await setStatus(learnerId, false, actor)).status).toBe(403);
      expect((await request(actor, "/api/access/users")).status).toBe(403);
      expect((await request(actor, "/api/access/status-history")).status).toBe(403);
      expect((await request(actor, "/api/access/status-history?actor=admin&target=deleted&from=2030-03-10&to=2030-03-10&limit=1")).status).toBe(403);
    }
    for (const body of [{}, { isActive: "false" }, { isActive: false, role: "admin" }]) {
      expect((await request("admin", `/api/access/users/${learnerId}/status`, "PATCH", body)).status).toBe(400);
    }
    expect((await setStatus(randomUUID(), false)).status).toBe(404);
    expect((await setStatus(adminId, false)).status).toBe(403);
    expect((await setStatus(adminId, true)).status).toBe(403);
    expect((await request("admin", "/api/me")).status).toBe(200);
    expect(await history()).toEqual(before);
  });

  it("requires a nonblank reason of at most 1000 characters without changing status, sessions, or audit on rejection", async () => {
    const [before] = await db.select().from(users).where(eq(users.id, learnerId));
    const beforeHistory = await history();
    for (const reason of [undefined, null, "", " \t\n ", 123, true, [], {}, "a".repeat(1001)]) {
      const response = await request("admin", `/api/access/users/${learnerId}/status`, "PATCH", { isActive: false, reason });
      expect(response.status).toBe(400);
    }
    expect((await request("admin", `/api/access/users/${learnerId}/status`, "PATCH", {
      isActive: false, reason: defaultReason, actorId: learnerId,
    })).status).toBe(400);
    expect((await db.select().from(users).where(eq(users.id, learnerId)))[0]).toEqual(before);
    expect(await history()).toEqual(beforeHistory);
    expect((await request("learner", "/api/me")).status).toBe(200);
    // The maximum length is valid, but an unchanged status still creates no event.
    expect((await setStatus(learnerId, true, "admin", "a".repeat(1000))).status).toBe(200);
    expect(await history()).toEqual(beforeHistory);
  });

  it("stores trimmed reasons for activation and deactivation without overwriting an earlier event on retry", async () => {
    const target = await createUser(`reason-${tag}`, password, { role: "bujk_pic" });
    ids.push(target.id);
    expect((await setStatus(target.id, false, "admin", "  Penugasan pengguna telah berakhir.\n")).status).toBe(200);
    expect((await setStatus(target.id, false, "admin", "Alasan retry yang tidak boleh menimpa audit.")).status).toBe(200);
    expect((await setStatus(target.id, true, "admin", "\nPenugasan baru telah disetujui. ")).status).toBe(200);
    const entries = (await history()).filter(entry => entry.targetUserId === target.id);
    expect(entries).toHaveLength(2);
    expect(entries.find(entry => !entry.newIsActive)).toMatchObject({
      reason: "Penugasan pengguna telah berakhir.", actorId: adminId, previousIsActive: true,
    });
    expect(entries.find(entry => entry.newIsActive)).toMatchObject({
      reason: "Penugasan baru telah disetujui.", actorId: adminId, previousIsActive: false,
    });
    const response = await request("admin", "/api/access/status-history");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const publicEntries = (await response.json()).entries;
    expect(publicEntries.find((entry: { id: string }) => entry.id === entries[0].id)).toHaveProperty("reason", entries[0].reason);
  });

  it("blocks login and every old session for participants and PICs, retaining learning history", async () => {
    for (const [actor, id] of [["learner", learnerId], ["pic", picId]]) {
      const oldSession = cookies[actor];
      // Keep a second session untouched while inactive, then try it after reactivation.
      expect((await login(actor)).status).toBe(200);
      const untouchedSession = cookies[actor];
      cookies[actor] = oldSession;
      const before = (await history()).length;
      const startedAt = Date.now();
      expect((await setStatus(id, false)).status).toBe(200);
      expect((await setStatus(id, false)).status).toBe(200);
      const deactivations = await history();
      expect(deactivations).toHaveLength(before + 1);
      const event = deactivations.find(entry => entry.targetUserId === id && !entry.newIsActive)!;
      expect(event).toMatchObject({
        actorId: adminId, actorUsername: `admin-${tag}`,
        targetUserId: id, targetUsername: `${actor}-${tag}`,
        previousIsActive: true, newIsActive: false, reason: defaultReason,
      });
      expect(event.changedAt.getTime()).toBeGreaterThanOrEqual(startedAt - 1000);
      expect(event.changedAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
      const listed = await (await request("admin", "/api/access/users")).json();
      expect(listed.find((a: { id: string }) => a.id === id).isActive).toBe(false);
      expect((await request(actor, "/api/me")).status).toBe(401);
      expect((await request(actor, "/api/courses")).status).toBe(401);
      const deniedLogin = await login(actor);
      expect(deniedLogin.status).toBe(401);
      expect(await deniedLogin.json()).toMatchObject({ message: expect.stringContaining("dinonaktifkan") });
      expect(await learningData()).toEqual(retainedData);
      expect((await setStatus(id, true)).status).toBe(200);
      cookies[actor] = untouchedSession;
      expect((await request(actor, "/api/me")).status).toBe(401);
      cookies[actor] = oldSession;
      expect((await request(actor, "/api/me")).status).toBe(401);
      expect((await login(actor)).status).toBe(200);
      expect((await request(actor, "/api/me")).status).toBe(200);
      // An idempotent activation must not revoke the new session.
      expect((await setStatus(id, true)).status).toBe(200);
      expect((await request(actor, "/api/me")).status).toBe(200);
      const events = (await history()).filter(entry => entry.targetUserId === id);
      expect(events).toHaveLength(2);
      expect(events.find(entry => entry.newIsActive)).toMatchObject({
        previousIsActive: false, newIsActive: true, actorId: adminId,
      });
    }
    expect(await learningData()).toEqual(retainedData);
    expect((await storage.getQuizAttemptsByParticipant(participantId)).some(a => a.id === attemptId)).toBe(true);
  });

  it("rolls back status and session revocation when the audit insert fails", async () => {
    const [before] = await db.select().from(users).where(eq(users.id, learnerId));
    const events = await history();
    const realTransaction = db.transaction.bind(db);
    const spy = vi.spyOn(db, "transaction").mockImplementationOnce(callback =>
      realTransaction(tx => callback(new Proxy(tx, {
        get(target, property, receiver) {
          if (property === "insert") return () => { throw new Error("Audit unavailable"); };
          return Reflect.get(target, property, receiver);
        },
      }))),
    );
    try {
      expect((await setStatus(learnerId, false)).status).toBe(500);
    } finally {
      spy.mockRestore();
    }
    const [after] = await db.select().from(users).where(eq(users.id, learnerId));
    expect(after).toEqual(before);
    expect(await history()).toEqual(events);
    expect((await request("learner", "/api/me")).status).toBe(200);
  });

  it.each([false, true])("rejects an overlapping login's stale session (reactivated: %s)", async reactivate => {
    const { actor, account } = await createTestAccount("stale-login");
    expect((await login(actor)).status).toBe(200);
    const oldCookie = cookies[actor];
    const pause = pauseAccountRead(account.id);
    const pendingLogin = login(actor);
    try {
      await pause.read;
      expect((await setStatus(account.id, false)).status).toBe(200);
      if (reactivate) expect((await setStatus(account.id, true)).status).toBe(200);
      pause.resume();
      // Credentials read while active may finish successfully; the session
      // they issue must retain the OLD version and cannot grant access.
      expect((await pendingLogin).status).toBe(200);
      const racedCookie = cookies[actor];
      for (const cookie of [oldCookie, racedCookie]) {
        cookies[actor] = cookie;
        expect((await request(actor, "/api/me")).status).toBe(401);
        expect((await request(actor, "/api/courses")).status).toBe(401);
      }
      if (!reactivate) expect((await setStatus(account.id, true)).status).toBe(200);
      // The cookie issued by the overlapping login was never refreshed.
      cookies[actor] = racedCookie;
      expect((await request(actor, "/api/me")).status).toBe(401);
      expect((await login(actor)).status).toBe(200);
      expect((await request(actor, "/api/me")).status).toBe(200);
    } finally {
      pause.restore();
      await pendingLogin;
    }
  });

  it("does not turn an inactive login snapshot into a valid login during reactivation", async () => {
    const { actor, account } = await createTestAccount("inactive-login");
    expect((await setStatus(account.id, false)).status).toBe(200);
    const pause = pauseAccountRead(account.id);
    const pendingLogin = login(actor);
    try {
      await pause.read;
      expect((await setStatus(account.id, true)).status).toBe(200);
      pause.resume();
      const response = await pendingLogin;
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ message: expect.stringContaining("dinonaktifkan") });
      expect(response.headers.get("set-cookie")).toBeNull();
      expect((await request(actor, "/api/me")).status).toBe(401);
      expect((await login(actor)).status).toBe(200);
      expect((await request(actor, "/api/me")).status).toBe(200);
    } finally {
      pause.restore();
      await pendingLogin;
    }
  });

  it.each([
    { first: false, second: false },
    { first: false, second: true },
  ])("serializes parallel status requests $first / $second without losing revocation or audit", async ({
    first, second,
  }) => {
    const { actor, account } = await createTestAccount("parallel-status");
    expect((await login(actor)).status).toBe(200);
    const oldCookie = cookies[actor];
    const responses = await parallelStatusChanges(account.id, first, second);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    const [stored] = await db.select().from(users).where(eq(users.id, account.id));
    // Opposing requests may acquire the lock in either order. Both valid
    // serial outcomes must have an unbroken audit chain and matching version.
    if (!second) expect(stored.isActive).toBe(false);
    const transitions = stored.isActive ? 2 : 1;
    expect(stored.sessionVersion).toBe(transitions);
    const events = (await history()).filter(event => event.targetUserId === account.id);
    expect(events).toHaveLength(transitions);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ previousIsActive: true, newIsActive: false }),
      ...(stored.isActive ? [expect.objectContaining({ previousIsActive: false, newIsActive: true })] : []),
    ]));
    if (!stored.isActive) expect((await setStatus(account.id, true)).status).toBe(200);
    cookies[actor] = oldCookie;
    expect((await request(actor, "/api/me")).status).toBe(401);
    expect((await login(actor)).status).toBe(200);
    expect((await request(actor, "/api/me")).status).toBe(200);
  });

  it("accepts legacy string-ID sessions only until the account's first status change", async () => {
    const { actor, account } = await createTestAccount("legacy-session");
    const legacyCookies: string[] = [];
    for (let index = 0; index < 2; index++) {
      expect((await login(actor)).status).toBe(200);
      const cookie = cookies[actor];
      const signed = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
      const sid = signed.slice(2, signed.lastIndexOf("."));
      const result = await pool.query(
        `UPDATE session SET sess = jsonb_set(sess::jsonb, '{passport,user}', to_jsonb($1::text))
         WHERE sid = $2 RETURNING sess`,
        [account.id, sid],
      );
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].sess.passport.user).toBe(account.id);
      legacyCookies.push(cookie);
      expect((await request(actor, "/api/me")).status).toBe(200);
    }
    expect((await setStatus(account.id, false)).status).toBe(200);
    cookies[actor] = legacyCookies[0];
    expect((await request(actor, "/api/me")).status).toBe(401);
    expect((await setStatus(account.id, true)).status).toBe(200);
    // One was rejected while inactive, the other was untouched since active.
    for (const cookie of legacyCookies) {
      cookies[actor] = cookie;
      expect((await request(actor, "/api/me")).status).toBe(401);
    }
    expect((await login(actor)).status).toBe(200);
    expect((await request(actor, "/api/me")).status).toBe(200);
  });

  it("serves paginated, newest-first admin history with only audit fields", async () => {
    // Enough rows to exercise pagination even on an otherwise empty installation.
    await db.insert(accountStatusHistory).values(Array.from({ length: 51 }, (_, index) => ({
      actorId: adminId, actorUsername: `admin-${tag}`,
      targetUserId: learnerId, targetUsername: `learner-${tag}`,
      previousIsActive: true, newIsActive: false,
      reason: "Catatan audit untuk pengujian paginasi.",
      changedAt: new Date(Date.now() - (index + 1) * 1000),
    })));
    const response = await request("admin", "/api/access/status-history");
    expect(response.status).toBe(200);
    const page = await response.json();
    expect(page.entries).toHaveLength(50);
    expect(page.hasMore).toBe(true);
    expect(page.entries.map((entry: { changedAt: string }) => entry.changedAt))
      .toEqual(page.entries.map((entry: { changedAt: string }) => entry.changedAt).sort().reverse());
    for (const entry of page.entries) {
      expect(Object.keys(entry).sort()).toEqual([
        "id", "actorId", "actorUsername", "targetUserId", "targetUsername",
        "previousIsActive", "newIsActive", "changedAt", "reason",
      ].sort());
      expect(Number.isNaN(Date.parse(entry.changedAt))).toBe(false);
    }
    const next = await (await request("admin", "/api/access/status-history?offset=50")).json();
    expect(next.entries.length).toBeGreaterThan(0);
    const firstIds = page.entries.map((entry: { id: string }) => entry.id);
    expect(next.entries.every((entry: { id: string }) => !firstIds.includes(entry.id))).toBe(true);
    for (const query of ["offset=-1", "offset=1.5", "offset=oops", "offset=2147483648", "password=x"]) {
      expect((await request("admin", `/api/access/status-history?${query}`)).status).toBe(400);
    }
    const empty = await (await request("admin", "/api/access/status-history?offset=2147483647")).json();
    expect(empty).toEqual({ entries: [], hasMore: false });
  });

  it("keeps legacy audit events with unknown reasons and rejects invalid stored explanations", async () => {
    const [legacy] = await db.insert(accountStatusHistory).values({
      actorId: adminId, actorUsername: `admin-${tag}`,
      targetUserId: randomUUID(), targetUsername: "historical-user",
      previousIsActive: false, newIsActive: true, reason: null,
    }).returning();
    const response = await request("admin", "/api/access/status-history");
    expect(response.status).toBe(200);
    const entry = (await response.json()).entries.find((item: { id: string }) => item.id === legacy.id);
    expect(entry).toMatchObject({ reason: null, actorUsername: `admin-${tag}`, targetUsername: "historical-user" });
    for (const reason of [" \t\n", "a".repeat(1001)]) {
      await expect(db.insert(accountStatusHistory).values({
        actorId: adminId, actorUsername: `admin-${tag}`,
        targetUserId: learnerId, targetUsername: `learner-${tag}`,
        previousIsActive: false, newIsActive: true, reason,
      })).rejects.toMatchObject({ code: "23514", constraint: "account_status_history_reason_valid" });
    }
    expect((await db.select().from(accountStatusHistory).where(eq(accountStatusHistory.id, legacy.id)))[0].reason).toBeNull();
  });

  it("combines snapshot identity and inclusive WIB dates with stable filtered pagination", async () => {
    const targetId = randomUUID(); // Intentionally no corresponding user.
    const snapshot = {
      actorId: adminId, actorUsername: `Historical_Admin_%_${tag}`,
      targetUserId: targetId, targetUsername: `Deleted_Target_${tag}`,
      previousIsActive: true, newIsActive: false, reason: null,
    };
    const inserted = await db.insert(accountStatusHistory).values([
      { ...snapshot, changedAt: new Date("2030-03-09T16:59:59.999Z") },
      { ...snapshot, changedAt: new Date("2030-03-09T17:00:00.000Z") },
      { ...snapshot, changedAt: new Date("2030-03-10T08:00:00.000Z") },
      { ...snapshot, changedAt: new Date("2030-03-10T16:59:59.999Z") },
      { ...snapshot, changedAt: new Date("2030-03-10T17:00:00.000Z") },
      { ...snapshot, targetUserId: randomUUID(), targetUsername: "different-target",
        changedAt: new Date("2030-03-10T08:00:00.000Z") },
    ]).returning();
    const query = new URLSearchParams({
      actor: `historical_admin_%_${tag}`, target: targetId,
      from: "2030-03-10", to: "2030-03-10", limit: "2",
    });
    const getPage = async (params = query) => {
      const response = await request("admin", `/api/access/status-history?${params}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      return response.json();
    };
    const first = await getPage();
    expect(first.entries.map((entry: { id: string }) => entry.id)).toEqual([inserted[3].id, inserted[2].id]);
    expect(first.hasMore).toBe(true);
    expect(first.entries[0]).toMatchObject({ ...snapshot, changedAt: "2030-03-10T16:59:59.999Z" });
    query.set("offset", "2");
    const last = await getPage();
    expect(last.entries.map((entry: { id: string }) => entry.id)).toEqual([inserted[1].id]);
    expect(last.hasMore).toBe(false);
    query.set("offset", "3");
    expect(await getPage()).toEqual({ entries: [], hasMore: false });

    query.delete("offset");
    query.set("actor", adminId);
    query.set("target", `deleted_target_${tag}`);
    expect((await getPage()).entries).toHaveLength(2);
    query.set("target", "' OR 1=1 --");
    expect(await getPage()).toEqual({ entries: [], hasMore: false });
    query.set("actor", "%");
    query.set("target", targetId);
    expect((await getPage()).entries).toHaveLength(2); // Literal percent in the snapshot.
    query.set("actor", `HistoricalXAdminXYX${tag}`);
    expect(await getPage()).toEqual({ entries: [], hasMore: false });
    query.set("actor", "no-such-actor");
    expect(await getPage()).toEqual({ entries: [], hasMore: false });
  });

  it.each([
    "from=2030-02-30", "to=2030-13-01", "from=2030-2-01", "from=not-a-date",
    "from=2030-03-11&to=2030-03-10", "from=2030-03-10T00:00:00Z",
    "from=", "limit=0", "limit=51", "limit=-1", "limit=1.5", "limit=abc",
    "limit=2&limit=3", "offset=", "offset=1&offset=2",
    "actor=a&actor=b", "target=a&target=b", "from=2030-01-01&from=2030-01-02",
    `actor=${"a".repeat(201)}`, `target=${"a".repeat(201)}`,
  ])("rejects invalid history queries: %s", async query => {
    expect((await request("admin", `/api/access/status-history?${query}`)).status).toBe(400);
  });
});
