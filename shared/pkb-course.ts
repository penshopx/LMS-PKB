import type { Quiz } from "./schema";

export const PKB_OVERVIEW_PRETEST_ID = "quiz-pkb-overview-pretest";
export const PKB_OVERVIEW_POSTTEST_ID = "quiz-pkb-overview-posttest";
export const PKB_OVERVIEW_COURSE_ID = "course-pkb-self-learning";

const questions = [
  {
    id: "pkb-q1",
    type: "multiple_choice" as const,
    text: "Siapa yang menjadi sasaran ketentuan PKB dalam Permen PUPR No. 12 Tahun 2021?",
    points: 20,
    options: [
      { id: "pkb-q1-a", text: "Tenaga kerja konstruksi kualifikasi jabatan ahli", isCorrect: true },
      { id: "pkb-q1-b", text: "Seluruh badan usaha konstruksi", isCorrect: false },
      { id: "pkb-q1-c", text: "Hanya penyelenggara pelatihan", isCorrect: false },
      { id: "pkb-q1-d", text: "Hanya pengelola proyek pemerintah", isCorrect: false },
    ],
    correctAnswer: "Tenaga kerja konstruksi kualifikasi jabatan ahli",
    explanation: "Peraturan ini mengatur PKB untuk tenaga kerja kualifikasi jabatan ahli.",
    order: 1,
  },
  {
    id: "pkb-q2",
    type: "multiple_choice" as const,
    text: "Apakah penyelesaian kursus di aplikasi otomatis menghasilkan Angka Kredit PKB resmi?",
    points: 20,
    options: [
      { id: "pkb-q2-a", text: "Ya, setiap kursus otomatis menghasilkan kredit", isCorrect: false },
      { id: "pkb-q2-b", text: "Tidak; penilaian dan penetapan mengikuti proses resmi", isCorrect: true },
      { id: "pkb-q2-c", text: "Ya, jika peserta lulus kuis", isCorrect: false },
      { id: "pkb-q2-d", text: "Ya, jika admin menyetujui bukti", isCorrect: false },
    ],
    correctAnswer: "Tidak; penilaian dan penetapan mengikuti proses resmi",
    explanation: "Kursus dan sertifikat penyelesaian bukan pengganti penilaian asesor dan penetapan oleh pihak berwenang.",
    order: 2,
  },
  {
    id: "pkb-q3",
    type: "multiple_choice" as const,
    text: "Menurut Pasal 20, berapa porsi minimum unsur kegiatan PKB utama?",
    points: 20,
    options: [
      { id: "pkb-q3-a", text: "50%", isCorrect: false },
      { id: "pkb-q3-b", text: "60%", isCorrect: false },
      { id: "pkb-q3-c", text: "75%", isCorrect: true },
      { id: "pkb-q3-d", text: "100%", isCorrect: false },
    ],
    correctAnswer: "75%",
    explanation: "Pasal 20 menetapkan unsur utama paling sedikit 75%; unsur penunjang paling banyak 25%.",
    order: 3,
  },
  {
    id: "pkb-q4",
    type: "multiple_choice" as const,
    text: "Apa contoh bukti untuk pembelajaran mandiri yang disebut dalam Lampiran?",
    points: 20,
    options: [
      { id: "pkb-q4-a", text: "Extended abstract atau executive summary", isCorrect: true },
      { id: "pkb-q4-b", text: "Hanya kartu identitas", isCorrect: false },
      { id: "pkb-q4-c", text: "Hanya daftar hadir tanpa ringkasan", isCorrect: false },
      { id: "pkb-q4-d", text: "Dokumen tender perusahaan", isCorrect: false },
    ],
    correctAnswer: "Extended abstract atau executive summary",
    explanation: "Lampiran memuat extended abstract atau executive summary sebagai contoh kelengkapan pembelajaran mandiri.",
    order: 4,
  },
  {
    id: "pkb-q5",
    type: "multiple_choice" as const,
    text: "Berapa nilai kredit minimum untuk tenaga ahli jenjang madya atau setara jenjang 8?",
    points: 20,
    options: [
      { id: "pkb-q5-a", text: "100 SKPK", isCorrect: false },
      { id: "pkb-q5-b", text: "150 SKPK", isCorrect: true },
      { id: "pkb-q5-c", text: "200 SKPK", isCorrect: false },
      { id: "pkb-q5-d", text: "250 SKPK", isCorrect: false },
    ],
    correctAnswer: "150 SKPK",
    explanation: "Pasal 21 menyebut minimum 150 SKPK untuk jenjang madya atau setara jenjang 8.",
    order: 5,
  },
];

export const PKB_QUIZZES: Quiz[] = [
  {
    id: PKB_OVERVIEW_PRETEST_ID,
    courseId: PKB_OVERVIEW_COURSE_ID,
    title: "Pre-test: Dasar Pengembangan Keprofesian Berkelanjutan",
    description: "Diagnostik awal; hasilnya tidak menjadi syarat penyelesaian kursus.",
    passingScore: 0,
    maxAttempts: 3,
    shuffleQuestions: false,
    showResults: true,
    questions: questions.map(question => ({ ...question, points: 0 })),
    createdAt: "2026-11-05",
  },
  {
    id: PKB_OVERVIEW_POSTTEST_ID,
    courseId: PKB_OVERVIEW_COURSE_ID,
    title: "Post-test: Dasar Pengembangan Keprofesian Berkelanjutan",
    description: "Pemeriksaan pemahaman materi; bukan penilaian atau penetapan Angka Kredit resmi.",
    passingScore: 60,
    maxAttempts: 3,
    shuffleQuestions: false,
    showResults: true,
    questions,
    createdAt: "2026-11-05",
  },
];
