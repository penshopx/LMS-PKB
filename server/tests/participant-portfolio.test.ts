import { describe, expect, it } from "vitest";
import type { ParticipantPortfolio } from "@shared/schema";
import { PKB_COURSES, PKB_UNITS } from "../pkb-catalog";
import { PUB_COURSES, PUB_UNITS } from "../pub-catalog";
import { PORTFOLIO_NOTICE, renderParticipantPortfolio } from "../participant-portfolio";

const active = PKB_COURSES[0];
const legacy = PUB_COURSES[0];
const date = "2026-11-05T09:00:00.000Z";

function fixture(): ParticipantPortfolio {
  return {
    participant: {
      id: "p1", nip: "not-exported", name: '<script>alert("x")</script>', position: "Teknik", unit: "Kelompok A",
      email: "not-exported@example.test", competencies: [],
      learningHistory: [{ id: "history-legacy", courseId: legacy.id, startedAt: date, progress: 100, status: "completed" }],
      evidences: [
        { id: "e-active", title: "Bukti aktif", description: "<img src=x onerror=alert(1)>", unitId: active.unitId, type: "document", submittedAt: date, fileUrl: 'javascript:alert("x")', score: 0, status: "pending" },
        { id: "e-legacy", title: "Bukti arsip", description: "Lama", unitId: legacy.unitId, type: "presentation", submittedAt: date, status: "approved" },
        { id: "e-reflection", title: "Rahasia pribadi", description: "Refleksi", unitId: active.unitId, type: "reflection", submittedAt: date, status: "reviewed" },
        { id: "e-unknown", title: "Bukti tanpa unit", description: "Hilang", unitId: "missing-unit", type: "document", submittedAt: date, status: "needs_revision" },
      ],
    },
    courses: [active, { ...legacy, archived: true }], paths: [], units: [...PKB_UNITS, ...PUB_UNITS],
    enrollments: [{ id: "enroll-active", participantId: "p1", courseId: active.id, enrolledAt: date, completedLessonIds: [active.lessons[0].id], progress: 20, status: "in_progress" }],
    quizzes: [{ id: "q1", title: "Post-test", courseId: active.id }],
    attempts: [
      { id: "attempt-1", participantId: "p1", quizId: "q1", score: 0, maxScore: 100, passed: false, gradingStatus: "graded", startedAt: date },
      { id: "attempt-2", participantId: "p1", quizId: "q1", score: 90, maxScore: 100, passed: true, gradingStatus: "graded", startedAt: date, completedAt: date },
      { id: "attempt-3", participantId: "p1", quizId: "q1", score: 0, maxScore: 100, passed: false, gradingStatus: "awaiting_review", startedAt: date },
    ],
    certificates: [{ id: "cert1", participantId: "p1", courseId: active.id, title: "Sertifikat selesai", description: "Penyelesaian kursus", certificateNumber: "CERT-1", issuedAt: date, expiresAt: "2027-01-01", status: "revoked", verificationUrl: "", metadata: {} }],
    practices: [{ id: "practice-1", courseId: active.id, title: "Praktik lapangan", round: 2, evidenceText: "Bukti praktik nyata", evidenceUrl: "https://example.test/bukti", status: "repeat_requested", feedback: "Ulangi inspeksi", submittedAt: date }],
  };
}

function parts(html: string) {
  const [, active, archive, unknown] = html.split("<section>");
  return { active, archive, unknown };
}

describe("isi ekspor portofolio", () => {
  it("memisahkan kegiatan aktif, arsip asli, dan bukti yang tidak dapat diklasifikasikan", () => {
    const html = renderParticipantPortfolio(fixture(), { includeReflections: true, generatedAt: date });
    const sections = parts(html);
    expect(sections.active).toContain("enroll-active");
    expect(sections.active).toContain("Bukti aktif");
    expect(sections.active).not.toContain("history-legacy");
    expect(sections.archive).toContain("history-legacy");
    expect(sections.archive).toContain("Bukti arsip");
    expect(sections.unknown).toContain("Bukti tanpa unit");
    expect(sections.active).toContain(`1/${active.lessons.length} lesson`);
    expect(sections.active).toContain("20%");
    expect(html).toContain(PORTFOLIO_NOTICE);
    expect(html).toContain(date);
    expect(html).not.toContain("not-exported");
  });

  it("menyertakan seluruh percobaan, nilai nol, penilaian tertunda, praktik, dan nomor sertifikat", () => {
    const html = renderParticipantPortfolio(fixture(), { includeReflections: true });
    for (const value of ["attempt-1", "attempt-2", "attempt-3", "0/100", "90/100", "Belum final", "Bukti praktik nyata", "Ulangi inspeksi", "CERT-1", "Dicabut", "2027-01-01"]) {
      expect(html).toContain(value);
    }
    expect(html).toContain("<td>0</td>");
  });

  it("tidak menampilkan refleksi peserta kepada koordinator", () => {
    expect(renderParticipantPortfolio(fixture(), { includeReflections: false })).not.toContain("Rahasia pribadi");
    expect(renderParticipantPortfolio(fixture(), { includeReflections: true })).toContain("Rahasia pribadi");
  });

  it("menetralkan HTML berbahaya dan tidak menjadikan URL bukti sebagai tautan aktif", () => {
    const html = renderParticipantPortfolio(fixture(), { includeReflections: true });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("default-src 'none'");
  });

  it("mempertahankan acuan hilang dan jalur campuran tanpa menandainya PKB aktif", () => {
    const data = fixture();
    data.paths = [{ id: "mixed", title: "Jalur campuran", courseIds: [active.id, legacy.id], description: "", targetRole: "", duration: "", difficulty: "beginner", prerequisites: [], skills: [], isPublished: true, createdAt: date }];
    data.enrollments.push(
      { id: "missing-enrollment", participantId: "p1", courseId: "missing", enrolledAt: date, completedLessonIds: [], progress: 0, status: "enrolled" },
      { id: "mixed-enrollment", participantId: "p1", learningPathId: "mixed", enrolledAt: date, completedLessonIds: [], progress: 50, status: "in_progress" },
    );
    const sections = parts(renderParticipantPortfolio(data, { includeReflections: true }));
    expect(sections.unknown).toContain("missing-enrollment");
    expect(sections.unknown).toContain("Jalur campuran");
    expect(sections.active).not.toContain("missing-enrollment");
    // Classification of known legacy IDs survives missing catalog metadata.
    data.courses = [active];
    expect(parts(renderParticipantPortfolio(data, { includeReflections: true })).archive).toContain("history-legacy");
  });

  it("menghasilkan dokumen yang jelas ketika belum ada kegiatan", () => {
    const data = fixture();
    data.participant.evidences = [];
    data.participant.learningHistory = [];
    data.enrollments = []; data.attempts = []; data.practices = []; data.certificates = [];
    const html = renderParticipantPortfolio(data, { includeReflections: true });
    expect(html).toContain("Belum ada catatan.");
    expect(html).toContain("Kurikulum PKB aktif");
    expect(html).toContain("Arsip kurikulum lama");
  });
});
