import type { ParticipantPortfolio } from "@shared/schema";
import { LEGACY_BUJK_COURSE_IDS, LEGACY_BUJK_PATH_IDS, LEGACY_BUJK_UNIT_IDS } from "./pkb-catalog";

export const PORTFOLIO_NOTICE = "Dokumen ini adalah rangkuman catatan pembelajaran untuk membantu persiapan pengajuan melalui proses resmi. Dokumen ini bukan SKK maupun keputusan resmi, tidak menghitung atau mengesahkan Angka Kredit/SKPK, dan tidak menjamin penerimaan pengajuan. Sertifikat aplikasi hanya bukti penyelesaian kursus. Penilaian serta penetapan resmi dilakukan oleh pihak berwenang.";

const escape = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]!));

const labels: Record<string, string> = {
  enrolled: "Terdaftar", not_started: "Belum dimulai", in_progress: "Dalam proses",
  completed: "Selesai", dropped: "Dihentikan", pending: "Menunggu tinjauan",
  reviewed: "Ditinjau", approved: "Disetujui internal", needs_revision: "Perlu revisi",
  pending_review: "Menunggu tinjauan", accepted: "Diterima internal", repeat_requested: "Perlu pengulangan",
  document: "Dokumen", video: "Video", presentation: "Presentasi", reflection: "Refleksi pribadi",
  active: "Aktif", expired: "Kedaluwarsa", revoked: "Dicabut",
};
const label = (value: string) => labels[value] ?? value;
type Section = "active" | "archive" | "unknown";
type Row = unknown[];

function table(headers: string[], rows: Row[]) {
  if (!rows.length) return "<p>Belum ada catatan.</p>";
  return `<div class="table"><table><thead><tr>${headers.map(h => `<th>${escape(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/** Escape all stored content; URLs are plain text, not executable links. */
export function renderParticipantPortfolio(data: ParticipantPortfolio, options: { includeReflections: boolean; generatedAt?: string }) {
  const { participant, courses, paths, units, enrollments, attempts, quizzes, certificates, practices } = data;
  const byCourse = new Map(courses.map(c => [c.id, c]));
  const byUnit = new Map(units.map(u => [u.id, u]));
  const byPath = new Map(paths.map(p => [p.id, p]));
  const byQuiz = new Map(quizzes.map(q => [q.id, q]));
  function courseSection(id?: string | null): Section {
    if (id && LEGACY_BUJK_COURSE_IDS.has(id)) return "archive";
    const course = id ? byCourse.get(id) : undefined;
    if (!course) return "unknown";
    return course.archived || LEGACY_BUJK_UNIT_IDS.has(course.unitId) ? "archive" : "active";
  }
  function unitSection(id: string): Section {
    return LEGACY_BUJK_UNIT_IDS.has(id) ? "archive" : byUnit.has(id) ? "active" : "unknown";
  }
  function pathSection(id?: string): Section {
    if (id && LEGACY_BUJK_PATH_IDS.has(id)) return "archive";
    const path = id ? byPath.get(id) : undefined;
    if (!path || !path.courseIds.length) return "unknown";
    const sections = path.courseIds.map(courseSection);
    return sections.every(s => s === "active") ? "active" : sections.every(s => s === "archive") ? "archive" : "unknown";
  }
  const courseName = (id?: string | null) => id ? byCourse.get(id)?.title ?? `Kursus tidak tersedia (${id})` : "Tanpa tautan kursus";
  const unitName = (id: string) => byUnit.get(id)?.name ?? `Unit tidak tersedia (${id})`;
  const sections: [Section, string, string][] = [
    ["active", "Kurikulum PKB aktif", "Catatan kegiatan dan hasil pembelajaran dalam kurikulum aktif, bukan kredit resmi."],
    ["archive", "Arsip kurikulum lama", "Riwayat asli dipertahankan; tidak dikonversi menjadi PKB atau SKPK."],
    ["unknown", "Belum terklasifikasi / tautan tidak tersedia", "Data tanpa acuan yang cukup atau jalur campuran tidak dianggap sebagai kegiatan PKB aktif."],
  ];
  const body = sections.map(([section, title, note]) => {
    const activityRows: Row[] = [];
    for (const enrollment of enrollments) {
      const category = enrollment.courseId ? courseSection(enrollment.courseId) : pathSection(enrollment.learningPathId);
      if (category !== section) continue;
      const course = enrollment.courseId ? byCourse.get(enrollment.courseId) : undefined;
      const completedLessons = course
        ? course.lessons.filter(l => enrollment.completedLessonIds.includes(l.id)).length : undefined;
      activityRows.push([
        enrollment.id, enrollment.courseId ? courseName(enrollment.courseId) : byPath.get(enrollment.learningPathId ?? "")?.title ?? "Jalur tidak tersedia",
        label(enrollment.status), `${enrollment.progress}%`,
        enrollment.enrolledAt, enrollment.startedAt, enrollment.completedAt,
        completedLessons === undefined ? "Tidak tersedia untuk jalur" : `${completedLessons}/${course!.lessons.length} lesson`,
      ]);
    }
    // Keep historical records even if an enrollment for the same course exists.
    for (const record of participant.learningHistory.filter(r => courseSection(r.courseId) === section)) {
      activityRows.push([record.id, `${courseName(record.courseId)} (rekam historis; bukan kegiatan tambahan)`,
        label(record.status), `${record.progress}%`, "—", record.startedAt, record.completedAt, "Rekam historis"]);
    }
    const quizRows = attempts.filter(a => courseSection(byQuiz.get(a.quizId)?.courseId) === section).map(a => {
      const quiz = byQuiz.get(a.quizId);
      return [a.id, quiz?.title ?? `Kuis tidak tersedia (${a.quizId})`, courseName(quiz?.courseId),
        a.completedAt ?? a.startedAt, a.gradingStatus === "awaiting_review" ? "Menunggu penilaian" : `${a.score}/${a.maxScore}`,
        a.gradingStatus === "awaiting_review" ? "Belum final" : a.passed ? "Lulus kuis internal" : "Belum lulus kuis internal", a.gradingFeedback];
    });
    const evidenceRows: Row[] = participant.evidences
      .filter(e => (options.includeReflections || e.type !== "reflection") && unitSection(e.unitId) === section)
      .map(e => [e.id, e.title, unitName(e.unitId), label(e.type), e.description, e.fileUrl,
        e.submittedAt, label(e.status), e.score, e.feedback]);
    const practiceRows = practices.filter(p => courseSection(p.courseId) === section).map(p => [
      p.id, p.title, courseName(p.courseId), p.round, p.submittedAt, p.evidenceText, p.evidenceUrl, label(p.status), p.feedback,
    ]);
    const certificateRows = certificates.filter(c => (c.courseId ? courseSection(c.courseId) : pathSection(c.learningPathId)) === section)
      .map(c => [c.certificateNumber, c.title, c.courseId ? courseName(c.courseId) : byPath.get(c.learningPathId ?? "")?.title ?? "Tanpa acuan kursus/jalur", c.issuedAt, label(c.status), c.expiresAt]);
    return `<section><h2>${title}</h2><p>${note}</p>
      <h3>Kegiatan pembelajaran</h3>${table(["ID catatan", "Kegiatan", "Status", "Progres", "Terdaftar", "Mulai", "Selesai", "Lesson selesai"], activityRows)}
      <h3>Hasil kuis (seluruh percobaan)</h3>${table(["ID", "Kuis", "Kursus", "Tanggal", "Skor internal", "Hasil", "Umpan balik"], quizRows)}
      <h3>Daftar bukti peserta</h3>${table(["ID bukti", "Judul", "Unit", "Jenis", "Deskripsi", "Lokasi berkas (bila ada)", "Dikirim", "Status internal", "Skor internal", "Umpan balik"], evidenceRows)}
      <h3>Praktik tambahan dan bukti</h3><p>Praktik tambahan tidak menentukan kelulusan kursus atau pengesahan kompetensi.</p>${table(["ID bukti", "Praktik", "Kursus", "Putaran", "Dikirim", "Bukti tertulis", "Lokasi bukti", "Status internal", "Umpan balik"], practiceRows)}
      <h3>Catatan sertifikat aplikasi</h3><p>Daftar ini mencatat penerbitan dan status tersimpan dalam aplikasi, bukan verifikasi SKK atau penetapan kredit. Periksa tanggal kedaluwarsa sebelum digunakan.</p>${table(["Nomor", "Judul", "Acuan", "Diterbitkan", "Status tersimpan", "Kedaluwarsa"], certificateRows)}</section>`;
  }).join("");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
    <title>Portofolio PKB — ${escape(participant.name)}</title>
    <style>body{font:14px/1.5 system-ui,sans-serif;color:#172337;background:#fff;margin:32px}h1,h2{color:#143e73}h2{border-bottom:2px solid #143e73;padding-bottom:8px}section{margin-top:36px}.notice{border:2px solid #143e73;background:#eef6ff;padding:16px}.table{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #b5c2d1;padding:8px;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#eef6ff}@media print{body{margin:10mm;font-size:11px}.table{overflow:visible}table{font-size:9px}thead{display:table-header-group}tr{break-inside:avoid}h2,h3{break-after:avoid}}@page{size:A4 landscape;margin:10mm}</style></head><body>
    <h1>Portofolio kegiatan dan bukti pembelajaran PKB</h1>
    <p>Peserta: <strong>${escape(participant.name)}</strong><br>ID peserta: ${escape(participant.id)}<br>Jabatan: ${escape(participant.position)}<br>Unit/kelompok: ${escape(participant.unit)}</p>
    <p>Dibuat: ${escape(options.generatedAt ?? new Date().toISOString())} (ISO 8601). Dokumen memuat data yang tersedia saat ekspor.</p>
    <p class="notice">${PORTFOLIO_NOTICE}</p>
    <p>Buka dokumen ini di browser, lalu gunakan Cetak / Simpan sebagai PDF. Berkas bukti tidak dilampirkan; lokasi berkas hanya dicantumkan jika tersedia. Periksa kelengkapan dan aturan pengajuan resmi. Dokumen memuat data pribadi; bagikan hanya kepada pihak yang berhak.</p>
    <p>${options.includeReflections ? "Refleksi yang tersimpan sebagai bukti peserta disertakan." : "Refleksi pribadi tidak disertakan dalam ekspor koordinator."} Refleksi privat praktik tidak disertakan.</p>
    ${body}<footer><p class="notice">${PORTFOLIO_NOTICE}</p></footer></body></html>`;
}
