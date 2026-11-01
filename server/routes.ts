import type { Express } from "express";
import { createServer, type Server } from "http";
import { createHash, randomBytes, randomUUID } from "crypto";
import { and, desc, eq, gte, lt, or, sql } from "drizzle-orm";
import passport from "passport";
import {
  requireAuth,
  requireRole,
  changeUserPassword,
  passwordChangeAttemptLimiter,
  hashPassword,
} from "./auth";
import { db } from "./db";
import { storage } from "./storage";
import { registerPracticeMissionRoutes } from "./practice-mission-routes";
import { quizSubmissionFingerprint } from "./quiz-submission-identity";
import { 
  insertParticipantSchema,
  insertEvidenceSchema,
  insertCourseSchema,
  insertClusterSchema,
  insertUnitSchema,
  insertLearningPathSchema,
  insertQuizSchema,
  insertCertificateSchema,
  insertAssessorSchema,
  insertAssesseeSchema,
  insertSchemeSchema,
  insertScheduleSchema,
  insertPortfolioSchema,
  users,
  accountStatusHistory,
  accountStatusHistoryQuerySchema,
  accountStatusChangeSchema,
  bujksTable,
  bujkInvitationsTable,
  participantsTable,
} from "@shared/schema";
import type { ApplicationRole, User } from "@shared/schema";
import { z } from "zod";
import { acceptInvitationSchema, invitationTokenSchema, loginCredentialsSchema, newPasswordSchema, PASSWORD_POLICY_MESSAGE, PASSWORD_UNCHANGED_MESSAGE } from "@shared/auth-validation";
import {
  evaluateCourseCompletion,
  gradeQuizSubmission,
  quizForLearner,
  type SubmittedQuizAnswers,
} from "@shared/lms-course-rules";

import { loginAttemptLimiter } from "./login-attempt-limiter";

function roleAllowsPath(role: ApplicationRole, method: string, path: string): boolean {
  if (role === "admin") return true;
  if (method === "POST" && path === "/api/me/password") return true;
  if (method === "GET" && path === "/api/notifications") return true;
  if (method === "PATCH" && /^\/api\/notifications\/(?:read-all|[^/]+\/read)$/.test(path)) return true;
  if (method === "GET" && ["/api/practice-missions", "/api/practice-missions/submissions"].includes(path)) return true;
  if (role === "participant" && method === "GET" && path === "/api/practice-missions/reminders") return true;
  if (role === "participant" && method === "POST" && /^\/api\/practice-missions\/[^/]+\/submissions$/.test(path)) return true;

  const readOnlyRoutes = [
    /^\/api\/courses(?:\/[^/]+)?$/,
    /^\/api\/courses\/[^/]+\/learning-state$/,
    /^\/api\/learning-paths(?:\/[^/]+)?$/,
    /^\/api\/quizzes(?:\/[^/]+)?$/,
    /^\/api\/participants$/,
    /^\/api\/participants\/[^/]+$/,
    /^\/api\/participants\/[^/]+\/quiz-attempts$/,
    /^\/api\/enrollments$/,
    /^\/api\/certificates$/,
    /^\/api\/certificates\/[^/]+$/,
    /^\/api\/certificates\/verify\/[^/]+$/,
  ];
  if (method === "GET" && readOnlyRoutes.some(pattern => pattern.test(path))) return true;

  if (role === "participant") {
    return (
      (method === "POST" && path === "/api/enrollments") ||
      (method === "POST" && /^\/api\/quizzes\/[^/]+\/attempts$/.test(path)) ||
      (method === "POST" && /^\/api\/enrollments\/[^/]+\/lessons\/[^/]+\/complete$/.test(path)) ||
      (method === "POST" && /^\/api\/participants\/[^/]+\/evidences$/.test(path))
    );
  }

  return (
    (method === "GET" && /^\/api\/quizzes\/[^/]+\/attempts$/.test(path)) ||
    (method === "GET" && path === "/api/access/bujks") ||
    (method === "GET" && path === "/api/access/invitations") ||
    (method === "POST" && path === "/api/access/invitations") ||
    (method === "POST" && /^\/api\/access\/invitations\/[^/]+\/revoke$/.test(path))
  );
}

async function canAccessParticipant(user: User, participantId: string): Promise<boolean> {
  if (user.role === "admin") return true;
  if (user.role === "participant") return user.participantId === participantId;
  if (user.role === "bujk_pic" && user.bujkId) {
    const participant = await storage.getParticipant(participantId);
    return participant?.bujkId === user.bujkId;
  }
  return false;
}

function invitationExpired(expiresAt: string) {
  const timestamp = Date.parse(expiresAt);
  return !Number.isFinite(timestamp) || timestamp <= Date.now();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ---------- AUTH ROUTES (public) ----------
  // API responses can contain account-specific LMS data, even after a browser's back navigation.
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.get("/api/me", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as User;
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        participantId: user.participantId,
        bujkId: user.bujkId,
      });
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  app.post("/api/login", async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    // Do not forward DB errors: query parameters may contain account identifiers.
    const unavailable = () => res.status(503).json({
      message: "Login sementara tidak tersedia. Silakan coba lagi nanti.",
    });
    const input = loginCredentialsSchema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ message: "Username dan password wajib diisi dengan benar." });
    }
    req.body = input.data;
    let acquisition;
    try {
      acquisition = await loginAttemptLimiter.tryAcquire(
        input.data.username, req.ip ?? req.socket.remoteAddress ?? "unknown",
      );
    } catch {
      return unavailable();
    }
    if (!acquisition.allowed) {
      res.setHeader("Retry-After", acquisition.retryAfterSeconds);
      return res.status(429).json({
        message: "Terlalu banyak percobaan login. Silakan coba lagi nanti.",
        retryAfterSeconds: acquisition.retryAfterSeconds,
      });
    }
    const { reservations } = acquisition;
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return unavailable();
      if (!user) {
        return res.status(401).json({ message: info?.message || "Login gagal" });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) return unavailable();
        loginAttemptLimiter.recordSuccess(reservations).then(() => res.json({
          id: user.id,
          username: user.username,
          role: user.role,
          participantId: user.participantId,
          bujkId: user.bujkId,
        })).catch(() => {
          // Do not leave a successful session behind a failed response.
          req.logout(() => unavailable());
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(destroyError => {
        if (destroyError) return next(destroyError);
        res.clearCookie("connect.sid", {
          path: "/", httpOnly: true, sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
        res.json({ message: "Anda berhasil keluar." });
      });
    });
  });

  app.post("/api/invitations/preview", async (req, res) => {
    const input = z.object({ token: invitationTokenSchema }).strict().safeParse(req.body);
    if (!input.success) return res.status(400).json({ message: "Tautan undangan tidak valid." });
    try {
      const tokenHash = createHash("sha256").update(input.data.token).digest("hex");
      const [invitation] = await db.select({
        username: bujkInvitationsTable.email,
        participantName: bujkInvitationsTable.participantName,
        bujkName: bujksTable.name,
        role: bujkInvitationsTable.role,
        expiresAt: bujkInvitationsTable.expiresAt,
        acceptedAt: bujkInvitationsTable.acceptedAt,
      }).from(bujkInvitationsTable)
        .innerJoin(bujksTable, eq(bujksTable.id, bujkInvitationsTable.bujkId))
        .where(eq(bujkInvitationsTable.tokenHash, tokenHash)).limit(1);
      if (!invitation || invitation.acceptedAt || invitationExpired(invitation.expiresAt)) {
        return res.status(400).json({ message: "Undangan tidak tersedia, sudah digunakan, atau telah kedaluwarsa. Minta undangan baru kepada PIC BUJK." });
      }
      const { acceptedAt: _accepted, ...preview } = invitation;
      res.json(preview);
    } catch {
      res.status(500).json({ message: "Undangan belum dapat diperiksa. Silakan coba lagi." });
    }
  });

  // Invitation acceptance is public, but requires an unexpired, single-use token.
  app.post("/api/invitations/accept", async (req, res) => {
    try {
      if (req.isAuthenticated()) return res.status(409).json({ message: "Keluar dari akun saat ini sebelum mengaktifkan akun undangan." });
      res.setHeader("Cache-Control", "no-store");
      const input = acceptInvitationSchema.parse(req.body);
      const tokenHash = createHash("sha256").update(input.token).digest("hex");
      const [preview] = await db.select().from(bujkInvitationsTable)
        .where(eq(bujkInvitationsTable.tokenHash, tokenHash)).limit(1);
      if (!preview || preview.acceptedAt || invitationExpired(preview.expiresAt)) {
        return res.status(400).json({ message: "Tautan undangan tidak valid atau sudah kedaluwarsa." });
      }

      const normalizedEmail = preview.email.trim().toLowerCase();
      const [existingUser] = await db.select({ id: users.id }).from(users)
        .where(sql`lower(${users.username}) = ${normalizedEmail}`).limit(1);
      if (existingUser) {
        return res.status(409).json({ message: "Akun untuk email ini sudah tersedia." });
      }

      const hashedPassword = await hashPassword(input.password);
      const now = new Date().toISOString();
      const result = await db.transaction(async tx => {
        const [invitation] = await tx.select().from(bujkInvitationsTable)
          .where(eq(bujkInvitationsTable.tokenHash, tokenHash))
          .for("update")
          .limit(1);
        if (!invitation || invitation.acceptedAt || invitationExpired(invitation.expiresAt)) {
          return { ok: false as const, code: "invalid" };
        }

        // Different invitation tokens for the same email must not create two accounts.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${normalizedEmail}, 0))`);
        const [duplicate] = await tx.select({ id: users.id }).from(users)
          .where(sql`lower(${users.username}) = ${normalizedEmail}`).limit(1);
        if (duplicate) return { ok: false as const, code: "duplicate" };

        let participantId: string | null = null;
        if (invitation.role === "participant") {
          participantId = `p-${randomUUID()}`;
          await tx.insert(participantsTable).values({
            id: participantId,
            nip: invitation.nip!,
            name: invitation.participantName!,
            position: invitation.position!,
            unit: invitation.unit!,
            email: normalizedEmail,
            bujkId: invitation.bujkId,
          });
        }

        const userId = randomUUID();
        await tx.insert(users).values({
          id: userId,
          username: normalizedEmail,
          password: hashedPassword,
          role: invitation.role,
          participantId,
          bujkId: invitation.bujkId,
        });
        await tx.update(bujkInvitationsTable)
          .set({ acceptedAt: now })
          .where(eq(bujkInvitationsTable.id, invitation.id));

        return { ok: true as const, username: normalizedEmail, role: invitation.role };
      });

      if (!result.ok) {
        return res.status(result.code === "duplicate" ? 409 : 400).json({
          message: result.code === "duplicate"
            ? "Akun untuk email ini sudah tersedia."
            : "Tautan undangan tidak valid atau sudah kedaluwarsa.",
        });
      }
      res.status(201).json({ message: "Akun berhasil dibuat. Silakan masuk.", username: result.username, role: result.role });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const passwordIssue = error.issues.find(issue => issue.path[0] === "password");
        return res.status(400).json({ message: passwordIssue?.message ?? "Data atau tautan undangan tidak valid." });
      }
      const databaseError = error as { code?: string; cause?: { code?: string } } | null;
      if (databaseError?.code === "23505" || databaseError?.cause?.code === "23505") {
        return res.status(409).json({ message: "Akun atau data peserta sudah tersedia. Hubungi PIC BUJK." });
      }
      res.status(500).json({ message: "Undangan tidak dapat diproses." });
    }
  });

  // Protect all remaining /api/* routes
  app.use("/api", requireAuth);
  app.use("/api", (req, res, next) => {
    const user = req.user as User;
    const path = req.originalUrl.split("?")[0];
    if (roleAllowsPath(user.role, req.method, path)) return next();
    res.status(403).json({ message: "Akses tidak diizinkan untuk peran akun ini." });
  });

  registerPracticeMissionRoutes(app);

  // BUJK ACCESS & INVITATIONS
  app.get("/api/access/bujks", async (req, res) => {
    try {
      const user = req.user as User;
      const organizations = user.role === "admin"
        ? await db.select().from(bujksTable)
        : user.bujkId
          ? await db.select().from(bujksTable).where(eq(bujksTable.id, user.bujkId))
          : [];
      res.json(organizations);
    } catch {
      res.status(500).json({ message: "Daftar BUJK tidak dapat dimuat." });
    }
  });

  app.post("/api/access/bujks", requireRole("admin"), async (req, res) => {
    try {
      const { name } = z.object({ name: z.string().trim().min(2).max(200) }).parse(req.body);
      const [existing] = await db.select({ id: bujksTable.id }).from(bujksTable)
        .where(sql`lower(${bujksTable.name}) = ${name.toLowerCase()}`).limit(1);
      if (existing) return res.status(409).json({ message: "Nama BUJK sudah terdaftar." });

      const organization = {
        id: randomUUID(),
        name,
        createdAt: new Date().toISOString(),
      };
      await db.insert(bujksTable).values(organization);
      res.status(201).json(organization);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Nama BUJK harus berisi 2–200 karakter." });
      }
      res.status(500).json({ message: "BUJK tidak dapat disimpan." });
    }
  });

  app.get("/api/access/users", requireRole("admin"), async (_req, res) => {
    try {
      const accounts = await db.select({
        id: users.id,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        participantId: users.participantId,
        participantName: participantsTable.name,
        bujkId: users.bujkId,
        bujkName: bujksTable.name,
      })
        .from(users)
        .leftJoin(participantsTable, eq(users.participantId, participantsTable.id))
        .leftJoin(bujksTable, eq(users.bujkId, bujksTable.id));
      res.json(accounts);
    } catch {
      res.status(500).json({ message: "Daftar akun tidak dapat dimuat." });
    }
  });

  app.get("/api/access/status-history", requireRole("admin"), async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const input = accountStatusHistoryQuerySchema.safeParse(req.query);
    if (!input.success) {
      return res.status(400).json({ message: "Filter atau posisi halaman riwayat tidak valid. Periksa tanggal dan batas halaman." });
    }
    try {
      const { actor, target, from, to, offset, limit } = input.data;
      // Search immutable snapshots, not live users (which may be renamed/deleted).
      // strpos treats SQL wildcard characters literally; all values remain bound.
      const entriesFilter = and(
        actor ? or(eq(accountStatusHistory.actorId, actor),
          sql`strpos(lower(${accountStatusHistory.actorUsername}), lower(${actor})) > 0`) : undefined,
        target ? or(eq(accountStatusHistory.targetUserId, target),
          sql`strpos(lower(${accountStatusHistory.targetUsername}), lower(${target})) > 0`) : undefined,
        from ? gte(accountStatusHistory.changedAt, new Date(`${from}T00:00:00+07:00`)) : undefined,
        // Inclusive WIB end date, expressed as an exclusive next-midnight bound.
        to ? lt(accountStatusHistory.changedAt, new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 86400000)) : undefined,
      );
      const entries = await db.select().from(accountStatusHistory)
        .where(entriesFilter)
        .orderBy(desc(accountStatusHistory.changedAt), desc(accountStatusHistory.id))
        .limit(limit + 1).offset(offset);
      res.json({ entries: entries.slice(0, limit), hasMore: entries.length > limit });
    } catch {
      res.status(500).json({ message: "Riwayat perubahan akses tidak dapat dimuat." });
    }
  });

  app.patch("/api/access/users/:id/status", requireRole("admin"), async (req, res) => {
    const input = accountStatusChangeSchema.safeParse(req.body);
    if (!input.success) {
      return res.status(400).json({ message: input.error.issues[0]?.message ?? "Status akun dan alasan perubahan tidak valid." });
    }
    try {
      const accountId = String(req.params.id);
      // Serialize status changes and protect the role in the same transaction.
      const result = await db.transaction(async tx => {
        const [account] = await tx.select().from(users)
          .where(eq(users.id, accountId)).for("update");
        if (!account) return { status: 404, body: { message: "Akun tidak ditemukan." } };
        if (account.role === "admin") {
          return { status: 403, body: { message: "Status akun admin tidak dapat diubah." } };
        }
        if (account.isActive !== input.data.isActive) {
          await tx.update(users).set({
            isActive: input.data.isActive,
            // Never restore sessions issued before a deactivation, even after reactivation.
            sessionVersion: account.sessionVersion + 1,
          }).where(eq(users.id, account.id));
          const actor = req.user as User;
          await tx.insert(accountStatusHistory).values({
            actorId: actor.id,
            actorUsername: actor.username,
            targetUserId: account.id,
            targetUsername: account.username,
            previousIsActive: account.isActive,
            newIsActive: input.data.isActive,
            reason: input.data.reason,
          });
        }
        return { status: 200, body: { id: account.id, isActive: input.data.isActive } };
      });
      res.status(result.status).json(result.body);
    } catch {
      res.status(500).json({ message: "Status akun gagal disimpan." });
    }
  });

  app.get("/api/access/invitations", requireRole("admin", "bujk_pic"), async (req, res) => {
    try {
      const user = req.user as User;
      const invitations = user.role === "admin"
        ? await db.select().from(bujkInvitationsTable)
        : user.bujkId
          ? await db.select().from(bujkInvitationsTable)
              .where(eq(bujkInvitationsTable.bujkId, user.bujkId))
          : [];
      res.json(invitations.map(({ tokenHash: _tokenHash, invitedBy: _invitedBy, ...invitation }) => invitation));
    } catch {
      res.status(500).json({ message: "Daftar undangan tidak dapat dimuat." });
    }
  });

  app.post("/api/access/invitations", requireRole("admin", "bujk_pic"), async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const data = z.object({
        email: z.string().trim().email().max(254),
        role: z.enum(["participant", "bujk_pic"]).optional(),
        bujkId: z.string().optional(),
        participantName: z.string().trim().min(1).max(150).optional(),
        nip: z.string().trim().min(1).max(80).optional(),
        position: z.string().trim().min(1).max(150).optional(),
        unit: z.string().trim().min(1).max(150).optional(),
      }).parse(req.body);
      const user = req.user as User;
      const role = user.role === "bujk_pic" ? "participant" : (data.role ?? "bujk_pic");
      const bujkId = user.role === "bujk_pic" ? user.bujkId : data.bujkId;
      if (!bujkId) return res.status(400).json({ message: "Pilih BUJK untuk undangan ini." });
      if (role === "participant" && (!data.participantName || !data.nip || !data.position || !data.unit)) {
        return res.status(400).json({ message: "Nama, NIP, jabatan, dan unit peserta wajib diisi." });
      }

      const [organization] = await db.select({ id: bujksTable.id }).from(bujksTable)
        .where(eq(bujksTable.id, bujkId)).limit(1);
      if (!organization) return res.status(404).json({ message: "BUJK tidak ditemukan." });

      const email = data.email.toLowerCase();
      const [existingUser] = await db.select({ id: users.id }).from(users)
        .where(sql`lower(${users.username}) = ${email}`).limit(1);
      if (existingUser) return res.status(409).json({ message: "Akun untuk email ini sudah ada." });

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const token = randomBytes(32).toString("base64url");
      const invitation = {
        id: randomUUID(),
        tokenHash: createHash("sha256").update(token).digest("hex"),
        email,
        role,
        bujkId,
        participantName: role === "participant" ? data.participantName! : null,
        nip: role === "participant" ? data.nip! : null,
        position: role === "participant" ? data.position! : null,
        unit: role === "participant" ? data.unit! : null,
        invitedBy: user.id,
        expiresAt,
        acceptedAt: null,
        createdAt: now.toISOString(),
      };
      await db.insert(bujkInvitationsTable).values(invitation);
      res.status(201).json({
        id: invitation.id,
        email,
        role,
        bujkId,
        expiresAt,
        invitePath: `/invite/${token}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Data undangan tidak valid.", errors: error.errors });
      }
      res.status(500).json({ message: "Undangan tidak dapat dibuat." });
    }
  });

  app.post("/api/access/invitations/:id/revoke", requireRole("admin", "bujk_pic"), async (req, res) => {
    try {
      const user = req.user as User;
      const [invitation] = await db.select().from(bujkInvitationsTable)
        .where(eq(bujkInvitationsTable.id, String(req.params.id))).limit(1);
      if (!invitation) return res.status(404).json({ message: "Undangan tidak ditemukan." });
      if (user.role === "bujk_pic" && invitation.bujkId !== user.bujkId) {
        return res.status(404).json({ message: "Undangan tidak ditemukan." });
      }
      if (invitation.acceptedAt) return res.status(409).json({ message: "Undangan sudah digunakan." });
      const revoked = await db.update(bujkInvitationsTable)
        .set({ expiresAt: new Date().toISOString() })
        .where(and(
          eq(bujkInvitationsTable.id, invitation.id),
          sql`${bujkInvitationsTable.acceptedAt} IS NULL`,
        ))
        .returning({ id: bujkInvitationsTable.id });
      if (!revoked.length) return res.status(409).json({ message: "Undangan sudah digunakan." });
      res.status(204).send();
    } catch {
      res.status(500).json({ message: "Undangan tidak dapat dibatalkan." });
    }
  });

  // ---------- CHANGE PASSWORD ----------
  app.post("/api/me/password", async (req, res) => {
    try {
      const user = req.user as User;
      const { currentPassword, newPassword } = req.body ?? {};

      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword ||
        !newPassword
      ) {
        return res.status(400).json({ message: "currentPassword dan newPassword wajib diisi" });
      }
      const validation = newPasswordSchema.safeParse(newPassword);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.issues[0].message });
      }

      const source = req.ip || req.socket.remoteAddress || "unknown";
      const attempt = await passwordChangeAttemptLimiter.tryAcquire(user.id, source);
      if (!attempt.allowed) {
        res.set("Retry-After", String(attempt.retryAfterSeconds));
        return res.status(429).json({
          message: "Terlalu banyak percobaan. Silakan coba lagi nanti.",
        });
      }

      const result = await changeUserPassword(user.id, currentPassword, newPassword);
      if (result === "invalid_new_password") {
        return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
      }
      if (result === "unchanged_password") {
        return res.status(400).json({ message: PASSWORD_UNCHANGED_MESSAGE });
      }
      if (result === "user_not_found") {
        return res.status(404).json({ message: "User tidak ditemukan" });
      }
      if (result === "invalid_current_password") {
        return res.status(401).json({ message: "Password saat ini tidak benar" });
      }

      // The credential update has committed. Notify even if renewing this
      // session fails; notification errors must never mask that committed update.
      try {
        await storage.createNotification({
          userId: user.id,
          type: "warning",
          category: "system",
          title: "Password akun Anda telah diubah",
          message: "Password akun Anda berhasil diubah. Jika Anda tidak melakukan perubahan ini, segera hubungi admin untuk mengamankan akun Anda.",
        });
      } catch {
        // Never log the error object: database errors can include bound values.
        console.error("[auth] Password-change notification could not be saved.");
      }

      // Preserve this session only, using the exact version committed with the
      // new hash. Reading the version again could adopt a later revocation.
      user.sessionVersion = result.sessionVersion;
      Object.assign(req.session, {
        passport: { user: { id: user.id, version: result.sessionVersion } },
      });
      await new Promise<void>((resolve, reject) => {
        req.session.save((error) => error ? reject(error) : resolve());
      });

      try {
        await passwordChangeAttemptLimiter.recordSuccessfulChange(user.id, source);
      } catch {
        console.error("[auth] Failed to clear successful password-change attempt.");
      }
      res.json({ message: "Password berhasil diubah" });
    } catch (error) {
      res.status(500).json({ message: "Gagal mengubah password" });
    }
  });

  // ---------- CLUSTERS ----------
  app.get("/api/clusters", async (req, res) => {
    try {
      const clusters = await storage.getClusters();
      res.json(clusters);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch clusters" });
    }
  });

  app.get("/api/clusters/:id", async (req, res) => {
    try {
      const cluster = await storage.getCluster(req.params.id);
      if (!cluster) {
        return res.status(404).json({ message: "Cluster not found" });
      }
      res.json(cluster);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cluster" });
    }
  });

  app.post("/api/clusters", async (req, res) => {
    try {
      const data = insertClusterSchema.parse(req.body);
      const cluster = await storage.createCluster(data);
      res.status(201).json(cluster);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create cluster" });
    }
  });

  app.patch("/api/clusters/:id", async (req, res) => {
    try {
      const cluster = await storage.updateCluster(req.params.id, req.body);
      if (!cluster) {
        return res.status(404).json({ message: "Cluster not found" });
      }
      res.json(cluster);
    } catch (error) {
      res.status(500).json({ message: "Failed to update cluster" });
    }
  });

  app.delete("/api/clusters/:id", async (req, res) => {
    try {
      const success = await storage.deleteCluster(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Cluster not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete cluster" });
    }
  });

  // ---------- UNITS ----------
  app.get("/api/units", async (req, res) => {
    try {
      const clusterId = req.query.clusterId as string | undefined;
      if (clusterId) {
        const units = await storage.getUnitsByCluster(clusterId);
        return res.json(units);
      }
      const units = await storage.getUnits();
      res.json(units);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch units" });
    }
  });

  app.get("/api/units/:id", async (req, res) => {
    try {
      const unit = await storage.getUnit(req.params.id);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      res.json(unit);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unit" });
    }
  });

  app.post("/api/units", async (req, res) => {
    try {
      const data = insertUnitSchema.parse(req.body);
      const unit = await storage.createUnit(data);
      res.status(201).json(unit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create unit" });
    }
  });

  app.patch("/api/units/:id", async (req, res) => {
    try {
      const unit = await storage.updateUnit(req.params.id, req.body);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      res.json(unit);
    } catch (error) {
      res.status(500).json({ message: "Failed to update unit" });
    }
  });

  app.delete("/api/units/:id", async (req, res) => {
    try {
      const success = await storage.deleteUnit(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Unit not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete unit" });
    }
  });

  // ---------- COURSES ----------
  app.get("/api/courses", async (req, res) => {
    try {
      const unitId = req.query.unitId as string | undefined;
      let courses;
      if (unitId) {
        courses = await storage.getCoursesByUnit(unitId);
      } else {
        courses = await storage.getCourses();
      }
      res.json(courses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await storage.getCourse(req.params.id);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.json(course);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch course" });
    }
  });

  app.post("/api/courses", async (req, res) => {
    try {
      const data = insertCourseSchema.parse(req.body);
      const course = await storage.createCourse(data);
      res.status(201).json(course);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create course" });
    }
  });

  app.delete("/api/courses/:id", async (req, res) => {
    try {
      const success = await storage.deleteCourse(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Course not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete course" });
    }
  });

  // ---------- PARTICIPANTS ----------
  app.get("/api/participants", async (req, res) => {
    try {
      const user = req.user as User;
      let participants = await storage.getParticipants();
      if (user.role === "participant") {
        participants = participants.filter(participant => participant.id === user.participantId);
      } else if (user.role === "bujk_pic") {
        participants = participants
          .filter(participant => Boolean(user.bujkId) && participant.bujkId === user.bujkId)
          .map(participant => ({
            ...participant,
            evidences: participant.evidences.filter(evidence => evidence.type !== "reflection"),
          }));
      }
      res.json(participants);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch participants" });
    }
  });

  app.get("/api/participants/:id", async (req, res) => {
    try {
      const participant = await storage.getParticipant(req.params.id);
      if (!participant || !await canAccessParticipant(req.user as User, participant.id)) {
        return res.status(404).json({ message: "Participant not found" });
      }
      const user = req.user as User;
      res.json(user.role === "bujk_pic"
        ? { ...participant, evidences: participant.evidences.filter(evidence => evidence.type !== "reflection") }
        : participant);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch participant" });
    }
  });

  app.post("/api/participants", async (req, res) => {
    try {
      const data = insertParticipantSchema.parse(req.body);
      const participant = await storage.createParticipant(data);
      res.status(201).json(participant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create participant" });
    }
  });

  app.patch("/api/participants/:id/competencies", async (req, res) => {
    try {
      const participant = await storage.updateParticipantCompetencies(
        req.params.id,
        req.body.competencies
      );
      if (!participant) {
        return res.status(404).json({ message: "Participant not found" });
      }
      res.json(participant);
    } catch (error) {
      res.status(500).json({ message: "Failed to update competencies" });
    }
  });

  app.delete("/api/participants/:id", async (req, res) => {
    try {
      const success = await storage.deleteParticipant(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Participant not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete participant" });
    }
  });

  // ---------- EVIDENCES ----------
  app.post("/api/participants/:id/evidences", async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role === "participant" && user.participantId !== req.params.id) {
        return res.status(404).json({ message: "Participant not found" });
      }
      const data = insertEvidenceSchema.parse(req.body);
      const evidence = await storage.addEvidence(req.params.id, data);
      res.status(201).json(evidence);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to add evidence" });
    }
  });

  app.patch("/api/participants/:participantId/evidences/:evidenceId", async (req, res) => {
    try {
      const { status, score, feedback } = req.body;
      const evidence = await storage.updateEvidenceStatus(
        req.params.participantId,
        req.params.evidenceId,
        status,
        score,
        feedback
      );
      if (!evidence) {
        return res.status(404).json({ message: "Evidence not found" });
      }
      res.json(evidence);
    } catch (error) {
      res.status(500).json({ message: "Failed to update evidence" });
    }
  });

  // ---------- DASHBOARD ----------
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/heatmap", async (req, res) => {
    try {
      const heatmap = await storage.getHeatmapData();
      res.json(heatmap);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch heatmap data" });
    }
  });

  // ---------- LEARNING PATHS ----------
  app.get("/api/learning-paths", async (req, res) => {
    try {
      const user = req.user as User;
      let paths = await storage.getLearningPaths();
      if (user.role === "participant") {
        const enrollments = user.participantId ? await storage.getEnrollmentsByParticipant(user.participantId) : [];
        const pathIds = new Set(enrollments.map(enrollment => enrollment.learningPathId).filter(Boolean));
        paths = paths.filter(path => pathIds.has(path.id));
      }
      res.json(paths);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch learning paths" });
    }
  });

  app.get("/api/learning-paths/:id", async (req, res) => {
    try {
      const path = await storage.getLearningPath(req.params.id);
      if (!path) {
        return res.status(404).json({ message: "Learning path not found" });
      }
      const user = req.user as User;
      if (user.role === "participant") {
        const enrollments = user.participantId
          ? await storage.getEnrollmentsByParticipant(user.participantId)
          : [];
        if (!enrollments.some(enrollment => enrollment.learningPathId === path.id)) {
          return res.status(404).json({ message: "Learning path not found" });
        }
      }
      res.json(path);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch learning path" });
    }
  });

  app.post("/api/learning-paths", async (req, res) => {
    try {
      const data = insertLearningPathSchema.parse(req.body);
      const path = await storage.createLearningPath(data);
      res.status(201).json(path);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create learning path" });
    }
  });

  app.patch("/api/learning-paths/:id", async (req, res) => {
    try {
      const path = await storage.updateLearningPath(req.params.id, req.body);
      if (!path) {
        return res.status(404).json({ message: "Learning path not found" });
      }
      res.json(path);
    } catch (error) {
      res.status(500).json({ message: "Failed to update learning path" });
    }
  });

  app.delete("/api/learning-paths/:id", async (req, res) => {
    try {
      const success = await storage.deleteLearningPath(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Learning path not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete learning path" });
    }
  });

  // ---------- ENROLLMENTS ----------
  app.get("/api/enrollments", async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role === "participant") {
        const enrollments = user.participantId
          ? await storage.getEnrollmentsByParticipant(user.participantId)
          : [];
        return res.json(enrollments);
      }
      if (user.role === "bujk_pic") {
        const participants = await storage.getParticipants();
        const participantIds = new Set(
          participants.filter(participant => participant.bujkId === user.bujkId).map(participant => participant.id),
        );
        const enrollments = (await storage.getEnrollments())
          .filter(enrollment => participantIds.has(enrollment.participantId));
        return res.json(enrollments);
      }
      const participantId = req.query.participantId as string | undefined;
      if (participantId) {
        const enrollments = await storage.getEnrollmentsByParticipant(participantId);
        return res.json(enrollments);
      }
      const enrollments = await storage.getEnrollments();
      res.json(enrollments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch enrollments" });
    }
  });

  app.get("/api/courses/:courseId/learning-state", async (req, res) => {
    try {
      const user = req.user as User;
      let participantId = typeof req.query.participantId === "string"
        ? req.query.participantId
        : "";
      if (user.role === "participant") participantId = user.participantId ?? "";
      if (!participantId) {
        return res.status(400).json({ message: "participantId wajib diisi" });
      }
      if (!await canAccessParticipant(user, participantId)) {
        return res.status(404).json({ message: "Data peserta tidak ditemukan." });
      }

      const course = await storage.getCourse(req.params.courseId);
      if (!course) return res.status(404).json({ message: "Kursus tidak ditemukan" });
      const [enrollments, attempts] = await Promise.all([
        storage.getEnrollmentsByParticipant(participantId),
        storage.getQuizAttemptsByParticipant(participantId),
      ]);
      const enrollment = enrollments.find(item => item.courseId === course.id);
      const configuredPostTest = course.postTestId
        ? await storage.getQuiz(course.postTestId)
        : undefined;
      const postTestPassed = Boolean(
        configuredPostTest &&
        configuredPostTest.courseId === course.id &&
        attempts.some(
          attempt =>
            attempt.quizId === configuredPostTest.id &&
            attempt.gradingStatus === "graded" &&
            attempt.passed,
        ),
      );
      const completion = evaluateCourseCompletion(
        course,
        enrollment?.completedLessonIds ?? [],
        postTestPassed,
      );

      res.json({
        enrollment: enrollment ?? null,
        completion,
        preTestAttempted: Boolean(
          course.preTestId && attempts.some(attempt => attempt.quizId === course.preTestId),
        ),
        postTestPassed,
      });
    } catch (error) {
      res.status(500).json({ message: "Gagal mengambil progres kursus" });
    }
  });

  app.post("/api/enrollments", async (req, res) => {
    try {
      const user = req.user as User;
      const { participantId, courseId, learningPathId } = req.body;
      if (typeof participantId !== "string" || (!courseId && !learningPathId)) {
        return res.status(400).json({ message: "Peserta dan kursus atau learning path wajib dipilih" });
      }
      if (user.role === "participant" && (participantId !== user.participantId || !courseId || learningPathId)) {
        return res.status(403).json({ message: "Peserta hanya dapat mendaftarkan dirinya pada kursus pilihan." });
      }
      if (!await storage.getParticipant(participantId)) {
        return res.status(404).json({ message: "Peserta tidak ditemukan" });
      }
      if (courseId && !await storage.getCourse(courseId)) {
        return res.status(404).json({ message: "Kursus tidak ditemukan" });
      }
      if (user.role === "participant") {
        const existing = (await storage.getEnrollmentsByParticipant(participantId))
          .find(enrollment => enrollment.courseId === courseId);
        if (existing) return res.json(existing);
      }
      const enrollment = await storage.createEnrollment(participantId, courseId, learningPathId);
      res.status(201).json(enrollment);
    } catch (error) {
      res.status(500).json({ message: "Failed to create enrollment" });
    }
  });

  app.patch("/api/enrollments/:id/progress", async (req, res) => {
    try {
      const { progress, status } = req.body;
      const existing = (await storage.getEnrollments()).find(item => item.id === req.params.id);
      if (!existing) return res.status(404).json({ message: "Enrollment not found" });
      if (existing.courseId) {
        return res.status(409).json({
          message: "Progres kursus dihitung dari lesson dan post-test; gunakan endpoint progres lesson.",
        });
      }
      if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
        return res.status(400).json({ message: "progress harus berupa bilangan bulat 0–100" });
      }
      const enrollment = await storage.updateEnrollmentProgress(req.params.id, progress, status);
      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      res.json(enrollment);
    } catch (error) {
      res.status(500).json({ message: "Failed to update enrollment" });
    }
  });

  app.post("/api/enrollments/:id/lessons/:lessonId/complete", async (req, res) => {
    try {
      const user = req.user as User;
      const enrollment = (await storage.getEnrollments()).find(item => item.id === req.params.id);
      if (!enrollment) return res.status(404).json({ message: "Enrollment not found" });
      if (user.role === "participant" && enrollment.participantId !== user.participantId) {
        return res.status(404).json({ message: "Enrollment not found" });
      }
      if (!enrollment.courseId) {
        return res.status(400).json({ message: "Enrollment ini tidak terkait dengan kursus" });
      }
      const course = await storage.getCourse(enrollment.courseId);
      if (!course?.lessons.some(lesson => lesson.id === req.params.lessonId)) {
        return res.status(400).json({ message: "Lesson tidak termasuk dalam kursus ini" });
      }
      const updated = await storage.markEnrollmentLessonCompleted(enrollment.id, req.params.lessonId);
      if (!updated) return res.status(404).json({ message: "Enrollment tidak ditemukan" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Gagal menyimpan progres lesson" });
    }
  });

  // ---------- QUIZZES ----------
  app.get("/api/quizzes", async (req, res) => {
    try {
      const user = req.user as User;
      const courseId = req.query.courseId as string | undefined;
      let quizzes;
      if (courseId) {
        quizzes = await storage.getQuizzesByCourse(courseId);
      } else {
        quizzes = await storage.getQuizzes();
      }
      if (user.role === "participant") {
        const enrollments = user.participantId ? await storage.getEnrollmentsByParticipant(user.participantId) : [];
        const enrolledCourseIds = new Set(enrollments.map(enrollment => enrollment.courseId).filter(Boolean));
        quizzes = quizzes.filter(quiz => enrolledCourseIds.has(quiz.courseId));
      }
      res.json(quizzes.map(quizForLearner));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quizzes" });
    }
  });

  app.get("/api/quizzes/:id", async (req, res) => {
    try {
      const quiz = await storage.getQuiz(req.params.id);
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      const user = req.user as User;
      if (user.role === "participant") {
        const enrollments = user.participantId
          ? await storage.getEnrollmentsByParticipant(user.participantId)
          : [];
        if (!enrollments.some(enrollment => enrollment.courseId === quiz.courseId)) {
          return res.status(404).json({ message: "Quiz not found" });
        }
      }
      res.json(quizForLearner(quiz));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quiz" });
    }
  });

  app.post("/api/quizzes", async (req, res) => {
    try {
      const data = insertQuizSchema.parse(req.body);
      const quiz = await storage.createQuiz({ ...data, questions: req.body.questions || [] });
      res.status(201).json(quiz);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create quiz" });
    }
  });

  app.delete("/api/quizzes/:id", async (req, res) => {
    try {
      const success = await storage.deleteQuiz(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Quiz not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete quiz" });
    }
  });

  // ---------- QUIZ ATTEMPTS ----------
  app.get("/api/quizzes/:quizId/attempts", async (req, res) => {
    try {
      const user = req.user as User;
      let attempts = await storage.getQuizAttempts(req.params.quizId);
      if (user.role === "bujk_pic") {
        const participants = await storage.getParticipants();
        const participantIds = new Set(
          participants.filter(participant => participant.bujkId === user.bujkId).map(participant => participant.id),
        );
        attempts = attempts.filter(attempt => participantIds.has(attempt.participantId));
      }
      res.json(attempts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quiz attempts" });
    }
  });

  app.get("/api/participants/:participantId/quiz-attempts", async (req, res) => {
    try {
      if (!await canAccessParticipant(req.user as User, req.params.participantId)) {
        return res.status(404).json({ message: "Participant not found" });
      }
      const attempts = await storage.getQuizAttemptsByParticipant(req.params.participantId);
      res.json(attempts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quiz attempts" });
    }
  });

  app.get("/api/quiz-attempts/pending-review", requireRole("admin"), async (_req, res) => {
    try {
      const attempts = await storage.getQuizAttemptsAwaitingReview();
      const reviews = await Promise.all(attempts.map(async attempt => {
        const [quiz, participant] = await Promise.all([
          storage.getQuiz(attempt.quizId),
          storage.getParticipant(attempt.participantId),
        ]);
        if (!quiz || !quiz.questions.some(question => question.type === "essay")) return null;

        const course = await storage.getCourse(quiz.courseId);
        return {
          id: attempt.id,
          participantId: attempt.participantId,
          participantName: participant?.name ?? "Peserta tidak ditemukan",
          quizId: quiz.id,
          quizTitle: quiz.title,
          courseTitle: course?.title ?? "Kursus tidak ditemukan",
          passingScore: quiz.passingScore,
          submittedAt: attempt.completedAt ?? attempt.startedAt,
          answers: quiz.questions.map(question => {
            const submittedAnswer = attempt.answers.find(answer => answer.questionId === question.id);
            return {
              questionId: question.id,
              questionText: question.text,
              type: question.type,
              answer: submittedAnswer?.answer ?? "",
              maxPoints: question.points,
              pointsAwarded: submittedAnswer?.points ?? 0,
              isCorrect: question.type === "essay" ? undefined : submittedAnswer?.isCorrect,
            };
          }),
        };
      }));
      res.json(reviews.filter((review): review is NonNullable<typeof review> => review !== null));
    } catch (error) {
      res.status(500).json({ message: "Gagal mengambil antrean penilaian esai" });
    }
  });

  app.post("/api/quiz-attempts/:attemptId/grade", requireRole("admin"), async (req, res) => {
    try {
      const gradeSchema = z.object({
        score: z.number().int().min(0).max(100),
        feedback: z.string().trim().min(1).max(4000),
      });
      const gradeData = gradeSchema.parse(req.body);
      const pendingAttempt = (await storage.getQuizAttemptsAwaitingReview())
        .find(attempt => attempt.id === req.params.attemptId);
      if (!pendingAttempt) {
        return res.status(409).json({ message: "Percobaan ini tidak lagi menunggu penilaian." });
      }

      const quiz = await storage.getQuiz(pendingAttempt.quizId);
      if (!quiz || !quiz.questions.some(question => question.type === "essay")) {
        return res.status(409).json({ message: "Percobaan ini tidak memerlukan penilaian esai." });
      }

      const reviewer = req.user as { id: string };
      const gradedAttempt = await storage.gradeQuizAttempt(String(req.params.attemptId), {
        ...gradeData,
        gradedBy: reviewer.id,
        gradedAt: new Date().toISOString(),
      });
      if (!gradedAttempt) {
        return res.status(409).json({ message: "Percobaan sudah dinilai oleh admin lain." });
      }

      res.json({
        attempt: gradedAttempt,
        passingScore: quiz.passingScore,
        passed: gradedAttempt.passed,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Nilai dan feedback penilaian tidak valid", errors: error.errors });
      }
      res.status(500).json({ message: "Gagal menyimpan penilaian esai" });
    }
  });

  app.post("/api/quizzes/:quizId/attempts", async (req, res) => {
    try {
      const submissionSchema = z.object({
        participantId: z.string().min(1),
        answers: z.record(z.union([z.string(), z.array(z.string())])),
        timeSpent: z.number().int().min(0).max(86_400).optional(),
        // Optional for older clients; the web app always supplies a stable UUID.
        idempotencyKey: z.string().uuid().optional(),
      });
      const submission = submissionSchema.parse(req.body);
      const user = req.user as User;
      if (user.role === "participant" && submission.participantId !== user.participantId) {
        return res.status(404).json({ message: "Participant not found" });
      }
      const quiz = await storage.getQuiz(req.params.quizId);
      if (!quiz) return res.status(404).json({ message: "Kuis tidak ditemukan" });
      if (!await storage.getParticipant(submission.participantId)) {
        return res.status(404).json({ message: "Peserta tidak ditemukan" });
      }
      const enrollments = await storage.getEnrollmentsByParticipant(submission.participantId);
      if (!enrollments.some(enrollment => enrollment.courseId === quiz.courseId)) {
        return res.status(409).json({ message: "Peserta harus terdaftar pada kursus kuis ini" });
      }
      const result = gradeQuizSubmission(quiz, submission.answers as SubmittedQuizAnswers);
      const requiresEssayReview = quiz.questions.some(question => question.type === "essay");
      const submittedAt = new Date().toISOString();
      const creation = await storage.createQuizAttemptWithinLimit({
        quizId: quiz.id,
        participantId: submission.participantId,
        answers: result.answers,
        score: result.score,
        maxScore: result.maxScore,
        passed: requiresEssayReview ? false : result.passed,
        gradingStatus: requiresEssayReview ? "awaiting_review" : "graded",
        startedAt: submittedAt,
        completedAt: submittedAt,
        timeSpent: submission.timeSpent,
      }, submission.idempotencyKey ? {
        key: submission.idempotencyKey,
        fingerprint: quizSubmissionFingerprint(submission.answers, submission.timeSpent),
      } : undefined);
      if ("rejection" in creation) {
        if (creation.rejection === "idempotency_conflict") {
          return res.status(409).json({
            code: creation.rejection,
            message: "Kunci pengiriman sudah digunakan dengan jawaban atau durasi berbeda. Jangan mengubah isi pengiriman saat mencoba ulang.",
          });
        }
        if (creation.rejection === "quiz_not_found") {
          return res.status(404).json({ message: "Kuis tidak ditemukan" });
        }
        if (creation.rejection === "awaiting_review") {
          return res.status(409).json({ code: creation.rejection, message: "Post-test sedang menunggu penilaian. Tunggu hasil sebelum mencoba ulang." });
        }
        return res.status(409).json({ code: creation.rejection, message: "Batas percobaan kuis telah tercapai" });
      }
      res.status(creation.replayed ? 200 : 201).json(creation.attempt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Jawaban kuis tidak valid", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create quiz attempt" });
    }
  });

  app.patch("/api/quizzes/:quizId/attempts/:attemptId/grade", requireRole("admin"), async (req, res) => {
    try {
      const quiz = await storage.getQuiz(String(req.params.quizId));
      if (!quiz) return res.status(404).json({ message: "Kuis tidak ditemukan" });
      const attempt = (await storage.getQuizAttempts(quiz.id))
        .find(item => item.id === req.params.attemptId);
      if (!attempt) return res.status(404).json({ message: "Percobaan kuis tidak ditemukan" });
      if (attempt.gradingStatus !== "awaiting_review") {
        return res.status(409).json({ message: "Jawaban esai sudah dinilai" });
      }

      const essayQuestions = quiz.questions.filter(question => question.type === "essay");
      if (essayQuestions.length === 0) {
        return res.status(409).json({ message: "Kuis ini tidak memerlukan penilaian esai" });
      }
      const { essayScores } = z.object({
        essayScores: z.record(z.number().int().min(0)),
      }).strict().parse(req.body);
      const expectedIds = new Set(essayQuestions.map(question => question.id));
      const suppliedIds = Object.keys(essayScores);
      if (
        expectedIds.size !== suppliedIds.length ||
        suppliedIds.some(questionId => !expectedIds.has(questionId)) ||
        essayQuestions.some(question => essayScores[question.id] > Math.max(0, question.points))
      ) {
        return res.status(400).json({
          message: "Nilai harus diberikan untuk setiap soal esai dan tidak boleh melebihi poin soal.",
        });
      }

      const reviewer = req.user as { id: string };
      const gradedAttempt = await storage.gradeQuizAttempt(attempt.id, {
        essayScores,
        gradedBy: reviewer.id,
        gradedAt: new Date().toISOString(),
      });
      if (!gradedAttempt) {
        return res.status(409).json({ message: "Percobaan tidak lagi menunggu penilaian" });
      }
      res.json(gradedAttempt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Nilai esai tidak valid", errors: error.errors });
      }
      res.status(500).json({ message: "Gagal menyimpan penilaian esai" });
    }
  });

  // ---------- CERTIFICATES ----------
  app.get("/api/certificates", async (req, res) => {
    try {
      const user = req.user as User;
      if (user.role === "participant") {
        return res.json(user.participantId
          ? await storage.getCertificatesByParticipant(user.participantId)
          : []);
      }
      const participantId = req.query.participantId as string | undefined;
      if (participantId) {
        if (!await canAccessParticipant(user, participantId)) {
          return res.status(404).json({ message: "Participant not found" });
        }
        const certificates = await storage.getCertificatesByParticipant(participantId);
        return res.json(certificates);
      }
      let certificates = await storage.getCertificates();
      if (user.role === "bujk_pic") {
        const participants = await storage.getParticipants();
        const participantIds = new Set(
          participants.filter(participant => participant.bujkId === user.bujkId).map(participant => participant.id),
        );
        certificates = certificates.filter(certificate => participantIds.has(certificate.participantId));
      }
      res.json(certificates);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch certificates" });
    }
  });

  app.get("/api/certificates/:id", async (req, res) => {
    try {
      const certificate = await storage.getCertificate(req.params.id);
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }
      if (!await canAccessParticipant(req.user as User, certificate.participantId)) {
        return res.status(404).json({ message: "Certificate not found" });
      }
      res.json(certificate);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch certificate" });
    }
  });

  app.post("/api/certificates", async (req, res) => {
    try {
      const data = insertCertificateSchema.parse(req.body);
      if (data.courseId) {
        const course = await storage.getCourse(data.courseId);
        if (!course) return res.status(404).json({ message: "Kursus tidak ditemukan" });
        const enrollments = await storage.getEnrollmentsByParticipant(data.participantId);
        const enrollment = enrollments.find(item => item.courseId === course.id);
        if (!enrollment) {
          return res.status(409).json({ message: "Peserta belum terdaftar pada kursus ini" });
        }
        const attempts = await storage.getQuizAttemptsByParticipant(data.participantId);
        const postTest = course.postTestId ? await storage.getQuiz(course.postTestId) : undefined;
        const postTestPassed = Boolean(
          postTest &&
          postTest.courseId === course.id &&
          attempts.some(
            attempt =>
              attempt.quizId === postTest.id &&
              attempt.gradingStatus === "graded" &&
              attempt.passed,
          ),
        );
        const completion = evaluateCourseCompletion(
          course,
          enrollment.completedLessonIds,
          postTestPassed,
        );
        if (!completion.isComplete) {
          return res.status(409).json({
            message: "Selesaikan semua lesson dan lulus post-test yang diwajibkan sebelum menerbitkan sertifikat kursus.",
            completion,
          });
        }
      }
      const certificate = await storage.createCertificate(data);
      res.status(201).json(certificate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create certificate" });
    }
  });

  app.get("/api/certificates/verify/:certificateNumber", async (req, res) => {
    try {
      const certificate = await storage.verifyCertificate(req.params.certificateNumber);
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found", valid: false });
      }
      if (!await canAccessParticipant(req.user as User, certificate.participantId)) {
        return res.status(404).json({ message: "Certificate not found", valid: false });
      }
      res.json({ valid: true, certificate });
    } catch (error) {
      res.status(500).json({ message: "Failed to verify certificate" });
    }
  });

  // ---------- ASSESSORS ----------
  app.get("/api/assessors", async (req, res) => {
    try {
      const assessors = await storage.getAssessors();
      res.json(assessors);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assessors" });
    }
  });

  app.get("/api/assessors/:id", async (req, res) => {
    try {
      const assessor = await storage.getAssessor(req.params.id);
      if (!assessor) {
        return res.status(404).json({ message: "Assessor not found" });
      }
      res.json(assessor);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assessor" });
    }
  });

  app.post("/api/assessors", async (req, res) => {
    try {
      const data = insertAssessorSchema.parse(req.body);
      const assessor = await storage.createAssessor(data);
      res.status(201).json(assessor);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create assessor" });
    }
  });

  app.patch("/api/assessors/:id", async (req, res) => {
    try {
      const assessor = await storage.updateAssessor(req.params.id, req.body);
      if (!assessor) {
        return res.status(404).json({ message: "Assessor not found" });
      }
      res.json(assessor);
    } catch (error) {
      res.status(500).json({ message: "Failed to update assessor" });
    }
  });

  app.delete("/api/assessors/:id", async (req, res) => {
    try {
      const success = await storage.deleteAssessor(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Assessor not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete assessor" });
    }
  });

  // ---------- ASSESSEES ----------
  app.get("/api/assessees", async (req, res) => {
    try {
      const assessees = await storage.getAssessees();
      res.json(assessees);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assessees" });
    }
  });

  app.get("/api/assessees/:id", async (req, res) => {
    try {
      const assessee = await storage.getAssessee(req.params.id);
      if (!assessee) {
        return res.status(404).json({ message: "Assessee not found" });
      }
      res.json(assessee);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch assessee" });
    }
  });

  app.post("/api/assessees", async (req, res) => {
    try {
      const data = insertAssesseeSchema.parse(req.body);
      const assessee = await storage.createAssessee(data);
      res.status(201).json(assessee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create assessee" });
    }
  });

  app.patch("/api/assessees/:id/status", async (req, res) => {
    try {
      const assessee = await storage.updateAssesseeStatus(req.params.id, req.body.status);
      if (!assessee) {
        return res.status(404).json({ message: "Assessee not found" });
      }
      res.json(assessee);
    } catch (error) {
      res.status(500).json({ message: "Failed to update assessee status" });
    }
  });

  // ---------- COMPETENCY SCHEMES ----------
  app.get("/api/schemes", async (req, res) => {
    try {
      const schemes = await storage.getSchemes();
      res.json(schemes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schemes" });
    }
  });

  app.get("/api/schemes/:id", async (req, res) => {
    try {
      const scheme = await storage.getScheme(req.params.id);
      if (!scheme) {
        return res.status(404).json({ message: "Scheme not found" });
      }
      res.json(scheme);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scheme" });
    }
  });

  app.post("/api/schemes", async (req, res) => {
    try {
      const data = insertSchemeSchema.parse(req.body);
      const scheme = await storage.createScheme(data);
      res.status(201).json(scheme);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create scheme" });
    }
  });

  // ---------- ASSESSMENT SCHEDULES ----------
  app.get("/api/schedules", async (req, res) => {
    try {
      const schedules = await storage.getSchedules();
      res.json(schedules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedules" });
    }
  });

  app.get("/api/schedules/:id", async (req, res) => {
    try {
      const schedule = await storage.getSchedule(req.params.id);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });

  app.post("/api/schedules", async (req, res) => {
    try {
      const data = insertScheduleSchema.parse(req.body);
      const schedule = await storage.createSchedule(data);
      res.status(201).json(schedule);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create schedule" });
    }
  });

  app.patch("/api/schedules/:id/status", async (req, res) => {
    try {
      const schedule = await storage.updateScheduleStatus(req.params.id, req.body.status);
      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
      }
      res.json(schedule);
    } catch (error) {
      res.status(500).json({ message: "Failed to update schedule status" });
    }
  });

  // ---------- PORTFOLIO ----------
  app.get("/api/assessees/:assesseeId/portfolio", async (req, res) => {
    try {
      const items = await storage.getPortfolioItems(req.params.assesseeId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch portfolio items" });
    }
  });

  app.post("/api/portfolio", async (req, res) => {
    try {
      const data = insertPortfolioSchema.parse(req.body);
      const item = await storage.createPortfolioItem(data);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create portfolio item" });
    }
  });

  app.patch("/api/portfolio/:id/status", async (req, res) => {
    try {
      const { status, feedback } = req.body;
      const item = await storage.updatePortfolioStatus(req.params.id, status, feedback);
      if (!item) {
        return res.status(404).json({ message: "Portfolio item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to update portfolio status" });
    }
  });

  // ---------- CERTIFICATION RESULTS ----------
  app.get("/api/certification-results", async (req, res) => {
    try {
      const results = await storage.getCertificationResults();
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch certification results" });
    }
  });

  app.post("/api/certification-results", async (req, res) => {
    try {
      const result = await storage.createCertificationResult(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to create certification result" });
    }
  });

  // ---------- LSP ORGANIZATIONS ----------
  app.get("/api/lsp-organizations", async (req, res) => {
    try {
      const orgs = await storage.getLSPOrganizations();
      res.json(orgs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch LSP organizations" });
    }
  });

  app.get("/api/lsp-organizations/:id", async (req, res) => {
    try {
      const org = await storage.getLSPOrganization(req.params.id);
      if (!org) {
        return res.status(404).json({ message: "LSP organization not found" });
      }
      res.json(org);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch LSP organization" });
    }
  });

  // ---------- NOTIFICATIONS ----------
  app.get("/api/notifications", async (req, res) => {
    try {
      const notifications = await storage.getNotifications((req.user as User).id);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/read-all", async (req, res) => {
    try {
      await storage.markAllNotificationsRead((req.user as User).id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.patch("/api/notifications/:id/read", async (req, res) => {
    try {
      const notif = await storage.markNotificationRead(req.params.id, (req.user as User).id);
      if (!notif) return res.status(404).json({ message: "Notification not found" });
      res.json(notif);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  // ---------- SEARCH ----------
  app.get("/api/search", async (req, res) => {
    try {
      const query = (req.query.q as string) || "";
      const results = await storage.searchAll(query);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Failed to perform search" });
    }
  });

  // ---------- ANALYTICS ----------
  app.get("/api/analytics", async (req, res) => {
    try {
      const data = await storage.getAnalyticsData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });

  return httpServer;
}
