import type { ECourse, Lesson, Quiz, Question, QuizOption } from "./schema";

export const SIAP_TENDER_COURSE_ID = "course-tender01-l2";
export const SIAP_TENDER_PRETEST_ID = "quiz-tender01-pretest";
export const SIAP_TENDER_POSTTEST_ID = "quiz-tender01-posttest";

const worksheetActivity = (
  id: string,
  title: string,
  description: string,
  content: string,
): Lesson["activities"] extends (infer T)[] | undefined ? T : never => ({
  id,
  type: "worksheet",
  title,
  description,
  duration: "10–15 menit",
  content,
});

export const SIAP_TENDER_LESSONS: Lesson[] = [
  {
    id: "tender01-orientation",
    order: 1,
    type: "orientation",
    title: "Orientasi: Peta Proses Tender",
    description: "Memahami tujuan kursus, alur enam lesson, dan batas kasus latihan.",
    content: `Tujuan belajar
Setelah lesson ini, peserta dapat menjelaskan alur kursus dan membedakan fakta kasus dari asumsi.

Naskah storyboard video
00:00–00:40 — Pembuka
Visual: Tim melihat tenggat di kalender dan beberapa dokumen yang belum diperiksa.
Narasi: “Persiapan tender melibatkan banyak bagian: peluang, dokumen, personel, metode kerja, jadwal, dan harga. Masalah sering muncul ketika bagian-bagian itu dikerjakan sendiri-sendiri atau diperiksa terlalu dekat dengan tenggat.”
Teks layar: Tender perlu ditinjau sebagai satu paket.

00:40–01:20 — Tujuan kursus
Visual: Ikon peluang, administrasi, teknis, jadwal, dan pemeriksaan.
Narasi: “Di kursus ini, Anda akan berlatih menelaah peluang, memetakan persyaratan ke bukti, menemukan ketidaksesuaian, dan menyusun tindak lanjut. Fokusnya adalah proses kerja yang rapi dan dapat ditelusuri.”
Teks layar: Temukan • Periksa • Catat • Tindak lanjuti.

01:20–02:20 — Peta enam lesson
Visual: Enam tahap terhubung.
Narasi: “Kita mulai dengan orientasi dan pre-test. Lalu kita telaah peluang dan keputusan Go/No-Go, periksa administrasi, petakan pemenuhan teknis, tinjau jadwal serta risiko, dan tutup dengan simulasi pemeriksaan akhir.”
Teks layar: Orientasi; peluang; administrasi; teknis; jadwal dan risiko; simulasi.

02:20–03:20 — Kasus latihan
Visual: Sampul kasus Drainase Pasar Arunika.
Narasi: “Semua latihan menggunakan satu kasus fiktif, Rehabilitasi Drainase Pasar Arunika. Nama, angka, dan persyaratannya dibuat untuk latihan. Jangan menganggapnya sebagai ketentuan tender nyata.”
Teks layar: Kasus ini fiktif.

03:20–04:10 — Cara menggunakan worksheet
Visual: Worksheet dengan kolom temuan, bukti, status, tindakan, dan pemilik.
Narasi: “Saat menemukan kekurangan, jangan langsung menebak dampaknya. Catat sumber informasinya, apa yang belum pasti, siapa yang perlu menindaklanjuti, dan kapan perlu diperiksa kembali.”
Teks layar: Catat sumber dan tindak lanjut.

04:10–04:50 — Pre-test dan penutup
Visual: Pre-test lalu tombol menuju lesson berikutnya.
Narasi: “Kerjakan pre-test untuk melihat pengetahuan awal. Hasil pre-test tidak menghambat penyelesaian kursus. Setelah itu, buka brief kasus dan lanjutkan ke telaah peluang.”
Teks layar: Pre-test bersifat diagnostik.

Brief kasus fiktif
Paket: Rehabilitasi saluran drainase kawasan Pasar Arunika. Ruang lingkup simulasi: perbaikan 420 meter saluran dan empat bangunan lintasan. Batas pengajuan simulasi: Hari ke-10 pukul 14.00. Perkiraan waktu kerja pada dokumen latihan: 120 hari kalender.

Profil PT Lintas Karya Nusantara (fiktif): memiliki satu pengalaman yang tampak relevan, tetapi salinan bukti penyelesaiannya buram; ketersediaan manajer proyek belum terkonfirmasi; metode menyebut pengaturan lalu lintas yang belum ada pada jadwal; rekap angka berbeda dari rincian.

Catatan penting
Semua nama, angka, dokumen, dan persyaratan dalam materi ini adalah fiktif. Persyaratan evaluasi hanya yang tertulis pada Dokumen Pemilihan Simulasi. Materi ini bukan nasihat hukum, bukan jaminan hasil tender, dan bukan sertifikasi kompetensi. Periksa aturan dan dokumen resmi terbaru sebelum digunakan dalam pekerjaan nyata.`,
    activities: [
      {
        id: "tender01-orientation-video",
        type: "video",
        title: "Storyboard video orientasi",
        description: "Naskah adegan video untuk produksi; berkas video final belum tersedia.",
        duration: "5 menit",
      },
      {
        id: "tender01-case-brief",
        type: "reading",
        title: "Brief kasus Drainase Pasar Arunika",
        description: "Baca ruang lingkup, tenggat simulasi, dan profil BUJK fiktif.",
        duration: "5 menit",
      },
      {
        id: "tender01-pretest",
        type: "quiz",
        title: "Pre-test diagnostik",
        description: "Lima soal untuk memetakan pengetahuan awal; tidak menjadi syarat lulus.",
        duration: "5 menit",
      },
    ],
  },
  {
    id: "tender01-context",
    order: 2,
    type: "context",
    title: "Telaah Peluang dan Keputusan Go/No-Go",
    description: "Menilai kecocokan peluang dengan kapasitas, waktu, bukti, dan risiko BUJK.",
    content: `Tujuan belajar
Peserta dapat mengumpulkan informasi dari brief, menilai kesesuaian peluang dengan kondisi BUJK, dan mencatat rekomendasi beserta tindak lanjut.

Naskah storyboard video
00:00–00:35 — Pembuka
Narasi: “Tidak setiap peluang harus langsung diikuti. Sebelum memutuskan, tim perlu memahami apa yang diminta, kemampuan yang tersedia, waktu yang dibutuhkan, dan hal yang masih belum pasti.”
Teks layar: Nilai peluang sebelum berkomitmen.

00:35–01:30 — Kumpulkan informasi
Narasi: “Mulailah dari sumber informasi yang tersedia. Catat ruang lingkup, lokasi, tenggat, daftar persyaratan, dan dokumen pendukung. Jika informasi tidak ditemukan, tandai sebagai belum diketahui—jangan mengisinya dengan asumsi.”
Teks layar: Catat fakta dan hal yang belum diketahui.

01:30–02:30 — Uji kecocokan
Narasi: “Bandingkan kebutuhan paket dengan bukti dan kapasitas perusahaan. Pengalaman yang tampak relevan perlu diperiksa dokumennya. Personel yang tercantum perlu dikonfirmasi ketersediaannya. Kecocokan tidak cukup dinilai dari nama atau kesan awal.”
Teks layar: Kebutuhan ↔ bukti ↔ kapasitas.

02:30–03:25 — Nilai risiko dan waktu
Narasi: “Periksa apakah waktu yang tersisa cukup untuk memverifikasi bukti, mengonfirmasi personel, meninjau metode, dan memeriksa penawaran. Catat risiko bersama tindakan, pemilik, dan tenggat.”
Teks layar: Risiko perlu tindakan dan pemilik.

03:25–04:20 — Buat memo keputusan
Narasi: “Keputusan Go/No-Go sebaiknya menjelaskan alasannya. Jika masih ada hal penting yang belum pasti, tuliskan apa yang harus dikonfirmasi dan kapan keputusan perlu ditinjau ulang.”
Teks layar: Keputusan + alasan + tindak lanjut.

04:20–04:50 — Penutup
Narasi: “Dalam kasus ini, bukti pengalaman yang buram dan ketersediaan personel yang belum dipastikan adalah dua hal yang perlu ditindaklanjuti. Selanjutnya, kita periksa dokumen administrasi.”

Praktik pada kasus
Periksa apakah bukti pengalaman dapat dibaca, apakah personel sudah mengonfirmasi ketersediaan, dan apakah waktu yang tersisa cukup untuk seluruh pemeriksaan. Rekomendasi Go, Go dengan tindak lanjut, atau No-Go dinilai dari alasan, penggunaan bukti, dan rencana tindak lanjut—bukan dari pilihan saja.`,
    activities: [
      {
        id: "tender01-opportunity-reading",
        type: "reading",
        title: "Fakta dan ketidakpastian",
        description: "Pisahkan informasi yang ada pada brief dari hal yang perlu dikonfirmasi.",
        duration: "5 menit",
      },
      worksheetActivity(
        "tender01-go-no-go",
        "Worksheet Go/No-Go",
        "Isi matriks peluang dan tuliskan rekomendasi awal beserta tindak lanjut.",
        `Paket simulasi: Rehabilitasi Drainase Pasar Arunika

| Pemeriksaan | Temuan / sumber | Dampak atau risiko | Tindak lanjut | Pemilik | Status |
|---|---|---|---|---|---|
| Kecocokan ruang lingkup dengan kemampuan BUJK | | | | | |
| Bukti pengalaman yang diminta | | | | | |
| Ketersediaan personel dan peralatan | | | | | |
| Waktu untuk menyiapkan dokumen | | | | | |
| Informasi yang perlu diklarifikasi | | | | | |

Rekomendasi: Go / Go dengan tindak lanjut / No-Go
Alasan utama:
Syarat sebelum keputusan final:
Penanggung jawab dan waktu peninjauan ulang:

Petunjuk: rujuk hanya Dokumen Pemilihan Simulasi. Tandai fakta, asumsi, dan informasi yang belum diketahui secara terpisah.`,
      ),
      {
        id: "tender01-go-no-go-check",
        type: "quiz",
        title: "Cek pemahaman keputusan",
        description: "Latihan singkat tentang bukti pengalaman, ketersediaan personel, dan keputusan.",
        duration: "3 menit",
      },
    ],
  },
  {
    id: "tender01-microlearning",
    order: 3,
    type: "microlearning",
    title: "Pemeriksaan Kualifikasi dan Dokumen Administrasi",
    description: "Mencocokkan persyaratan simulasi dengan bukti yang terbaca dan konsisten.",
    content: `Tujuan belajar
Peserta dapat mencocokkan persyaratan administrasi dalam dokumen simulasi dengan bukti yang tersedia serta menetapkan tindak lanjut atas kekurangan.

Naskah storyboard video
00:00–00:35 — “Berkas yang terkumpul belum tentu siap diperiksa. Tim perlu mencocokkan setiap persyaratan dengan bukti, memeriksa keterbacaan dan konsistensi, lalu mencatat apa yang masih harus ditindaklanjuti.”
Teks layar: Lengkap bukan hanya berarti ada berkas.

00:35–01:25 — “Baca dokumen pemilihan latihan satu butir demi satu butir. Untuk setiap butir, catat bukti yang diminta dan cara pemeriksaannya. Jangan menambahkan persyaratan yang tidak tercantum dalam dokumen simulasi.”
Teks layar: Persyaratan → bukti yang diminta.

01:25–02:20 — “Periksa apakah bukti dapat dibaca dan apakah informasi penting konsisten dengan dokumen lain. Jika ada perbedaan atau bagian tidak terbaca, tandai untuk verifikasi. Jangan memperbaiki data dengan perkiraan.”
Teks layar: Terbaca • Konsisten • Dapat ditelusuri.

02:20–03:15 — “Gunakan status yang mudah dipahami tim. ‘Lengkap’ berarti bukti yang diminta tersedia dan dapat diperiksa. ‘Perlu perbaikan’ berarti bukti ada, tetapi ada hal yang harus diverifikasi atau diperjelas.”
Teks layar: Status harus menjelaskan keadaan bukti.

03:15–04:05 — “Setiap kekurangan perlu tindak lanjut yang jelas. Tentukan siapa yang bertanggung jawab, kapan perlu selesai, dan bukti apa yang menandakan tindak lanjut sudah dilakukan.”
Teks layar: Tindakan • Pemilik • Tenggat.

04:05–04:35 — “Dalam kasus latihan, bukti pengalaman yang buram tidak langsung ditandai lengkap atau ditolak. Catat sebagai perlu diverifikasi, lalu tentukan cara dan pemilik tindak lanjut.”
Teks layar: Jangan menebak; verifikasi.

Checklist administrasi latihan
1. Salin persyaratan dari Dokumen Pemilihan Simulasi.
2. Cocokkan tiap persyaratan dengan bukti yang disediakan.
3. Periksa keterbacaan, nama, nomor, tanggal, dan konsistensi.
4. Beri status: Lengkap, Perlu perbaikan, atau Belum tersedia.
5. Tuliskan tindakan, pemilik, tenggat, dan bukti penyelesaian.

Temuan fokus: satu bukti pengalaman tampak relevan tetapi salinannya buram. Tandai Perlu perbaikan/verifikasi sampai bukti dapat diperiksa. Kehadiran berkas saja belum cukup untuk menyatakan lengkap.

Catatan: checklist ini berlaku untuk kasus simulasi. Daftar persyaratan tender nyata harus diambil dari dokumen resmi yang berlaku untuk paket tersebut.`,
    activities: [
      {
        id: "tender01-admin-video",
        type: "video",
        title: "Storyboard pemeriksaan dokumen",
        description: "Naskah video singkat; media video final belum tersedia.",
        duration: "5 menit",
      },
      worksheetActivity(
        "tender01-admin-matrix",
        "Matriks kelengkapan administrasi",
        "Catat persyaratan simulasi, bukti, status, dan pemilik tindak lanjut.",
        `| No. | Persyaratan dalam dokumen simulasi | Bukti dan sumber | Keterbacaan / konsistensi | Status | Tindakan | Pemilik | Tenggat |
|---:|---|---|---|---|---|---|---|
| 1 | Profil BUJK sesuai dokumen latihan | | | | | | |
| 2 | Pernyataan yang diminta dalam latihan | | | | | | |
| 3 | Bukti pengalaman relevan | | | | | | |
| 4 | Dokumen pendukung lain pada dokumen latihan | | | | | | |

Status: Lengkap / Perlu perbaikan / Belum tersedia

Pemeriksaan silang:
- Apakah nama perusahaan konsisten?
- Apakah nomor dan tanggal dapat dibaca?
- Apakah setiap bukti merujuk pada persyaratan yang benar?
- Temuan apa yang belum ditutup?

Jangan menambahkan persyaratan dari luar Dokumen Pemilihan Simulasi.`,
      ),
      {
        id: "tender01-admin-check",
        type: "quiz",
        title: "Cek keterbacaan dan verifikasi",
        description: "Latihan menentukan status dokumen yang sulit dibaca.",
        duration: "3 menit",
      },
    ],
  },
  {
    id: "tender01-practice",
    order: 4,
    type: "practice",
    title: "Pemetaan Persyaratan Teknis ke Bukti",
    description: "Meninjau hubungan antara persyaratan, respons, bukti, metode, dan jadwal.",
    content: `Tujuan belajar
Peserta dapat memetakan persyaratan teknis simulasi ke respons dan bukti pendukung, lalu menemukan bagian yang belum lengkap atau tidak konsisten.

Naskah storyboard video
00:00–00:35 — “Respons teknis perlu menjawab persyaratan yang tertulis dan didukung informasi yang bisa diperiksa. Pernyataan tanpa bukti atau rujukan dapat membuat tim sulit meninjau kualitas jawabannya.”
Teks layar: Persyaratan → respons → bukti.

00:35–01:20 — “Ubah setiap persyaratan menjadi butir yang jelas. Catat apa yang diminta, bagaimana respons akan ditulis, dan bukti apa yang mendukungnya.”
Teks layar: Satu butir pemeriksaan untuk satu kebutuhan.

01:20–02:15 — “Hubungkan respons dengan dokumen yang tersedia. Jika bukti belum ada atau belum dikonfirmasi, tandai statusnya dan catat tindak lanjut. Jangan menuliskan klaim yang tidak didukung informasi dalam kasus.”
Teks layar: Klaim harus sesuai bukti.

02:15–03:15 — “Periksa apakah metode, jadwal, personel, dan sumber daya saling mendukung. Dalam kasus latihan, metode menyebut pengaturan lalu lintas, tetapi jadwal belum memuat kegiatannya. Itu perlu diselaraskan.”
Teks layar: Metode dan jadwal harus selaras.

03:15–04:05 — “Gunakan status yang menunjukkan keadaan respons. Tambahkan tindakan, pemilik, dan tenggat untuk setiap bagian yang belum selesai.”
Teks layar: Status + tindakan + pemilik.

04:05–04:35 — “Matriks ini membantu tim melihat apa yang sudah didukung dan apa yang harus diperiksa lagi.”

Latihan pada kasus
Gunakan Dokumen Pemilihan Simulasi dan paket PT Lintas Karya Nusantara. Cocokkan respons dan bukti untuk pengalaman, personel, peralatan, metode, serta keselamatan/pengaturan lalu lintas. Tandai: Didukung bukti, Perlu klarifikasi, atau Belum terpenuhi dalam draf.

Temuan fokus: metode menyebut pengaturan lalu lintas, tetapi jadwal belum memuat aktivitasnya. Selaraskan kedua dokumen dan tinjau kebutuhan sumber dayanya; jangan menghapus atau mengarang informasi hanya untuk menutupi ketidaksesuaian.`,
    activities: [
      {
        id: "tender01-technical-case",
        type: "case_study",
        title: "Tinjau draf teknis",
        description: "Gunakan persyaratan simulasi untuk menelaah respons dan bukti.",
        duration: "10 menit",
      },
      worksheetActivity(
        "tender01-technical-matrix",
        "Matriks teknis–respons–bukti",
        "Petakan setiap butir persyaratan latihan dan catat kesenjangan.",
        `| Persyaratan teknis pada dokumen simulasi | Respons dalam draf | Bukti pendukung | Selaras dengan jadwal? | Status / pertanyaan | Tindakan |
|---|---|---|---|---|---|
| Pengalaman relevan | | | | | |
| Personel yang diusulkan | | | | | |
| Peralatan yang diusulkan | | | | | |
| Metode pelaksanaan | | | | | |
| Pengaturan keselamatan dan lalu lintas | | | | | |

Status: Didukung bukti / Perlu klarifikasi / Belum terpenuhi dalam draf

Pemeriksaan silang:
1. Apakah respons menjawab butir yang diminta?
2. Apakah setiap klaim memiliki bukti?
3. Apakah metode, jadwal, personel, dan sumber daya saling mendukung?
4. Siapa pemilik tindak lanjut dan kapan ditinjau kembali?

Gunakan hanya informasi dalam kasus latihan. Jangan menyatakan peserta atau BUJK memenuhi syarat tender nyata.`,
      ),
      {
        id: "tender01-technical-check",
        type: "quiz",
        title: "Cek konsistensi metode dan jadwal",
        description: "Pilih tindak lanjut atas bagian draf yang belum selaras.",
        duration: "3 menit",
      },
    ],
  },
  {
    id: "tender01-assessment",
    order: 5,
    type: "assessment",
    title: "Jadwal Persiapan, Rekap, dan Risiko",
    description: "Menyusun urutan persiapan dan memeriksa konsistensi data penawaran simulasi.",
    content: `Tujuan belajar
Peserta dapat menyusun urutan tugas menuju tenggat, meninjau kecocokan rekap dengan rincian, dan memberi tindak lanjut pada risiko.

Naskah storyboard video
00:00–00:35 — “Masalah menjelang tenggat sering muncul karena tugas belum memiliki pemilik atau pemeriksaan dilakukan terlalu terlambat.”
Teks layar: Terjemahkan tenggat menjadi rencana kerja.

00:35–01:25 — “Mulai dari pekerjaan yang menjadi prasyarat bagi tugas lain. Catat siapa pemilik tugas dan kapan tugas harus selesai.”
Teks layar: Urutan • Pemilik • Tenggat.

01:25–02:20 — “Dalam kasus latihan, jumlah rekap berbeda dari penjumlahan rincian. Jangan mengubah angka secara asal. Telusuri sumber selisih, cocokkan satuan dan volume, lalu minta pemeriksaan ulang.”
Teks layar: Telusuri selisih; jangan menebak.

02:20–03:15 — “Tuliskan risiko yang dapat mengganggu kelengkapan, konsistensi, atau tenggat. Tentukan tindakan, pemiliknya, dan waktu penyelesaian.”
Teks layar: Risiko perlu tindakan yang jelas.

03:15–04:05 — “Pemeriksaan silang membantu menemukan perbedaan yang terlewat. Gunakan checklist yang sama dan pastikan setiap temuan ditutup atau diteruskan.”
Teks layar: Periksa dengan checklist bersama.

04:05–04:35 — “Temuan yang belum selesai tetap dicatat. Jangan menyembunyikannya dari catatan pemeriksaan.”

Latihan rekap aritmetika (semua angka fiktif)
Rincian simulasi: Rp420.000.000 + Rp315.000.000 + Rp180.000.000 + Rp85.000.000 = Rp1.000.000.000.
Rekap pada draf: Rp1.020.000.000.
Tugas peserta: telusuri selisih Rp20.000.000 pada dokumen latihan, catat siapa yang memeriksa ulang, dan jangan mengubah angka tanpa dasar.

Risiko fokus: bukti pengalaman buram, personel belum dikonfirmasi, jadwal belum memuat pengaturan lalu lintas, dan rekap harga berbeda dari rincian. Ini adalah temuan latihan, bukan kesimpulan tentang kelayakan tender.`,
    activities: [
      {
        id: "tender01-schedule-risk",
        type: "project",
        title: "Susun jadwal dan daftar risiko",
        description: "Urutkan tugas persiapan berdasarkan tenggat Hari ke-10 pada simulasi.",
        duration: "10 menit",
      },
      worksheetActivity(
        "tender01-risk-worksheet",
        "Worksheet jadwal dan risiko",
        "Tentukan pemilik, tenggat, tindakan, dan bukti penyelesaian.",
        `Jadwal tugas
| Tugas | Urutan / mulai | Selesai | Bergantung pada | Pemilik | Status |
|---|---|---|---|---|---|
| Telaah dokumen simulasi | | | — | | |
| Verifikasi bukti pengalaman | | | | | |
| Konfirmasi ketersediaan personel | | | | | |
| Selaraskan metode dan jadwal | | | | | |
| Periksa rincian dan rekap harga | | | | | |
| Pemeriksaan akhir paket latihan | | | Semua tugas di atas | | |

Daftar risiko
| Risiko | Kemungkinan | Dampak | Tanda awal | Pencegahan / respons | Pemilik |
|---|---|---|---|---|---|
| Bukti pengalaman tidak terbaca | | | | | |
| Personel belum mengonfirmasi | | | | | |
| Jadwal tidak memuat pengaturan lalu lintas | | | | | |
| Rekap berbeda dari rincian | | | | | |

Pemeriksaan rekap simulasi
Rincian: Rp420.000.000 + Rp315.000.000 + Rp180.000.000 + Rp85.000.000 = ?
Rekap pada draf: Rp1.020.000.000.
Tulis sumber selisih yang perlu ditelusuri, tindakan pemeriksaan, pemilik, dan bukti bahwa pemeriksaan selesai.

Angka ini hanya latihan aritmetika fiktif. Tidak mencakup aturan pajak atau ketentuan harga tender.`,
      ),
      {
        id: "tender01-final-checklist",
        type: "reading",
        title: "Checklist pemeriksaan silang",
        description: "Periksa dokumen, status temuan, pemilik, dan tenggat sebelum simulasi akhir.",
        duration: "5 menit",
      },
    ],
  },
  {
    id: "tender01-reflection",
    order: 6,
    type: "reflection",
    title: "Simulasi Akhir dan Rencana Perbaikan",
    description: "Meninjau paket latihan, menyusun tindak lanjut, dan mengukur pemahaman setelah belajar.",
    content: `Tujuan belajar
Peserta dapat meninjau satu paket latihan, mencatat temuan berbasis dokumen, serta menyusun tindak lanjut yang memiliki pemilik dan tenggat.

Naskah storyboard video
00:00–00:40 — “Di lesson terakhir, Anda akan meninjau paket latihan secara menyeluruh. Gunakan hanya dokumen yang disediakan dan catat temuan yang dapat ditunjukkan sumbernya.”
Teks layar: Periksa paket berdasarkan bukti.

00:40–01:30 — “Periksa kelengkapan administrasi, hubungan persyaratan teknis dengan bukti, konsistensi metode dengan jadwal, serta kecocokan rekap dengan rincian.”
Teks layar: Administrasi • Teknis • Jadwal • Rekap.

01:30–02:20 — “Pisahkan fakta dari asumsi. Untuk setiap temuan, tuliskan dokumen sumber, dampak yang mungkin terjadi, dan hal yang perlu diperiksa. Jika dampaknya belum dapat ditentukan, tandai sebagai perlu klarifikasi.”
Teks layar: Temuan harus punya rujukan.

02:20–03:10 — “Prioritaskan tindak lanjut berdasarkan dampak dan waktu. Tentukan pemilik dan tenggat. Temuan yang belum selesai harus tetap terlihat, bukan dihilangkan dari catatan.”
Teks layar: Prioritas • Pemilik • Tenggat.

03:10–03:55 — “Yang dinilai adalah cara menggunakan dokumen, mencatat ketidakpastian, dan menyusun tindak lanjut—bukan menebak hasil tender.”
Teks layar: Alasan dan bukti, bukan tebakan.

03:55–04:40 — “Kerjakan post-test untuk mengukur pemahaman setelah belajar. Sertifikat kursus menyatakan penyelesaian pembelajaran, bukan pengakuan kompetensi atau jaminan hasil tender.”
Teks layar: Sertifikat penyelesaian kursus.

Simulasi akhir
Tinjau bukti pengalaman yang buram, status ketersediaan personel, perbedaan metode dan jadwal, serta selisih rekap. Untuk tiap temuan, rujuk dokumen, tulis tindakan, pemilik, dan tenggat. Jangan menyimpulkan bahwa satu temuan otomatis menggugurkan penawaran.

Rubrik latihan (umpan balik, bukan syarat sertifikat)
Nilai tiap kriteria 0–2:
1. Ketepatan temuan: 0 tidak mencatat temuan relevan; 1 menemukan sebagian; 2 menemukan isu sesuai dokumen simulasi.
2. Rujukan bukti: 0 tanpa sumber; 1 rujukan kurang spesifik; 2 temuan terhubung ke dokumen/bagian yang jelas.
3. Prioritas risiko: 0 tidak membedakan; 1 ada prioritas tetapi alasannya kurang jelas; 2 prioritas memiliki alasan yang masuk akal.
4. Tindak lanjut: 0 tidak ada tindakan; 1 tindakan tanpa pemilik atau tenggat; 2 tindakan, pemilik, dan tenggat tercatat.

Aturan penyelesaian yang dirancang
Pre-test bersifat diagnostik. Lesson wajib diselesaikan. Jika post-test diwajibkan, nilai lulus yang dirancang adalah 80/100 dengan percobaan ulang. Worksheet digunakan untuk latihan dan umpan balik, bukan syarat tambahan sertifikat. Aturan ini belum mengaktifkan penerbitan sertifikat otomatis.`,
    activities: [
      {
        id: "tender01-final-simulation",
        type: "case_study",
        title: "Pemeriksaan akhir paket simulasi",
        description: "Tinjau seluruh temuan dan rekomendasikan tindak lanjut berdasarkan bukti.",
        duration: "15 menit",
      },
      worksheetActivity(
        "tender01-final-findings",
        "Lembar temuan dan rencana perbaikan",
        "Gunakan sumber dokumen untuk menulis temuan, prioritas, dan tindak lanjut.",
        `| No. | Bagian | Temuan dan sumber dokumen | Dampak / pertanyaan | Prioritas | Tindakan | Pemilik | Tenggat |
|---:|---|---|---|---|---|---|---|
| 1 | Administrasi | | | | | | |
| 2 | Teknis | | | | | | |
| 3 | Jadwal | | | | | | |
| 4 | Rekap harga | | | | | | |

Rekomendasi latihan:
Hal yang sudah didukung bukti:
Hal yang masih perlu diklarifikasi:
Tindakan yang harus selesai lebih dahulu:

Refleksi pribadi (opsional, tidak perlu diunggah):
- Apa satu kebiasaan pemeriksaan yang akan saya terapkan?
- Informasi apa yang perlu saya minta sebelum membuat keputusan?

Refleksi pribadi tidak dibagikan kepada PIC. Unggah evidensi hanya jika diminta dan pastikan tidak memuat data tender aktif atau data pribadi yang tidak diperlukan.`,
      ),
      {
        id: "tender01-posttest",
        type: "quiz",
        title: "Post-test SIAP Tender",
        description: "Sepuluh soal, nilai lulus usulan 80/100, dapat diulang.",
        duration: "15 menit",
      },
    ],
  },
];

const makeQuestion = (
  id: string,
  text: string,
  optionTexts: string[],
  correctIndex: number,
  explanation: string,
  points: number,
): Question => {
  const options: QuizOption[] = optionTexts.map((optionText, index) => ({
    id: `${id}-option-${index + 1}`,
    text: optionText,
    isCorrect: index === correctIndex,
  }));

  return {
    id,
    type: "multiple_choice",
    text,
    points,
    options,
    correctAnswer: options[correctIndex].text,
    explanation,
    order: Number(id.split("-").at(-1)) - 1,
  };
};

const pretestQuestions: Question[] = [
  makeQuestion("tender-pre-1", "Apa tindakan awal jika belum jelas apakah pengalaman perusahaan memenuhi persyaratan paket?", [
    "Menganggap memenuhi karena pekerjaannya mirip",
    "Mencocokkan persyaratan dengan bukti pengalaman",
    "Menghapus pengalaman tersebut dari catatan",
  ], 1, "Persyaratan perlu dicocokkan dengan bukti yang dapat diperiksa.", 20),
  makeQuestion("tender-pre-2", "Apa yang dilakukan jika dokumen pendukung sulit dibaca?", [
    "Mengunggahnya apa adanya",
    "Menandainya untuk verifikasi dan mencari salinan yang terbaca",
    "Mengganti informasi yang tidak terbaca dengan perkiraan",
  ], 1, "Bukti yang tidak terbaca perlu diverifikasi, bukan ditebak.", 20),
  makeQuestion("tender-pre-3", "Untuk apa memo Go/No-Go digunakan?", [
    "Mencatat dasar keputusan mengikuti atau tidak mengikuti paket",
    "Menggantikan seluruh dokumen penawaran",
    "Menjamin penawaran diterima",
  ], 0, "Memo mencatat alasan dan tindak lanjut, bukan menjamin hasil.", 20),
  makeQuestion("tender-pre-4", "Jika metode kerja dan jadwal tidak selaras, apa langkah yang tepat?", [
    "Menyelaraskan keduanya dan memeriksa dampaknya",
    "Mengabaikan jadwal",
    "Menghapus penjelasan metode",
  ], 0, "Keduanya perlu ditinjau agar draf konsisten.", 20),
  makeQuestion("tender-pre-5", "Apakah pre-test diagnostik menentukan kelulusan kursus?", [
    "Ya, peserta harus lulus pre-test",
    "Tidak, pre-test memetakan pengetahuan awal",
  ], 1, "Pre-test membantu peserta melihat pengetahuan awal dan tidak memblokir kursus.", 20),
];

const posttestQuestions: Question[] = [
  makeQuestion("tender-post-1", "Tim belum yakin paket sesuai dengan kemampuan perusahaan dan personel kunci belum dikonfirmasi. Apa langkah paling tepat sebelum menetapkan keputusan final?", [
    "Memutuskan Go agar waktu persiapan lebih panjang",
    "Mencatat hal yang belum pasti, meminta konfirmasi, lalu meninjau keputusan",
    "Menganggap personel tersedia karena namanya tercantum",
  ], 1, "Keputusan perlu mencatat asumsi dan menutup informasi penting yang belum terkonfirmasi.", 10),
  makeQuestion("tender-post-2", "Salinan bukti pengalaman relevan terlihat buram. Apa status yang tepat pada matriks latihan?", [
    "Lengkap",
    "Perlu diverifikasi atau diganti dengan bukti terbaca",
    "Tidak perlu ditindaklanjuti",
  ], 1, "Kehadiran berkas belum cukup jika isinya tidak dapat diperiksa.", 10),
  makeQuestion("tender-post-3", "Personel yang diusulkan tercantum pada pekerjaan lain dengan jadwal berdekatan. Kesimpulan yang paling tepat?", [
    "Personel pasti tidak tersedia",
    "Personel pasti tersedia",
    "Ketersediaannya perlu dikonfirmasi dan dampaknya dicatat",
  ], 2, "Jadwal berdekatan merupakan sinyal untuk diperiksa, bukan bukti pasti.", 10),
  makeQuestion("tender-post-4", "Metode menyebut pengaturan lalu lintas, tetapi jadwal belum memuat aktivitas tersebut. Apa tindakan yang sesuai?", [
    "Menyelaraskan metode dan jadwal, lalu meninjau kebutuhan sumber daya",
    "Menghapus bagian pengaturan lalu lintas tanpa peninjauan",
    "Membiarkan perbedaan tersebut",
  ], 0, "Periksa konsistensi kedua bagian berdasarkan dokumen simulasi.", 10),
  makeQuestion("tender-post-5", "Nilai rekap berbeda dari penjumlahan rincian. Apa tindakan yang sebaiknya dilakukan?", [
    "Mengubah rekap tanpa memeriksa rincian",
    "Menelusuri sumber selisih dan meminta pemeriksaan ulang",
    "Memilih angka yang lebih rendah",
  ], 1, "Selisih harus ditelusuri dan pemeriksaannya dicatat.", 10),
  makeQuestion("tender-post-6", "Salah satu persyaratan pada dokumen latihan belum jelas. Bagaimana menanganinya?", [
    "Membuat asumsi sendiri dan tidak mencatatnya",
    "Mencatat pertanyaan, sumber konfirmasi, pemilik tindak lanjut, dan tenggat",
    "Menghapus persyaratan dari checklist",
  ], 1, "Catatan membuat ketidakpastian terlihat dan dapat ditindaklanjuti.", 10),
  makeQuestion("tender-post-7", "Apa tujuan matriks persyaratan–respons–bukti?", [
    "Menghubungkan persyaratan dengan respons dan bukti yang tersedia",
    "Menjamin hasil evaluasi tender",
    "Menggantikan dokumen pemilihan",
  ], 0, "Matriks membantu meninjau dukungan bukti dan kesenjangan respons.", 10),
  makeQuestion("tender-post-8", "Risiko apa yang perlu dicatat sebelum pengajuan simulasi?", [
    "Hanya hal yang sudah menimbulkan kerugian",
    "Hal yang berpotensi mengganggu kelengkapan, konsistensi, atau tenggat",
    "Semua pendapat pribadi tanpa tindak lanjut",
  ], 1, "Risiko perlu dikaitkan dengan dampak dan rencana tindakan.", 10),
  makeQuestion("tender-post-9", "Apa arti sertifikat pada rancangan kursus ini?", [
    "Sertifikat penyelesaian kursus, bukan pengakuan kompetensi formal",
    "Sertifikasi tenaga ahli tender",
    "Jaminan peserta akan memenangkan tender",
  ], 0, "Sertifikat hanya menyatakan penyelesaian kursus.", 10),
  makeQuestion("tender-post-10", "Dalam rancangan akses yang dibahas, evidensi dan rincian jawaban kuis peserta dapat dilihat oleh siapa?", [
    "PIC berwenang untuk peserta di BUJK-nya",
    "Semua peserta di semua BUJK",
    "Pengunjung umum",
  ], 0, "Akses PIC dibatasi pada BUJK terkait dan bersifat baca-saja.", 10),
];

export const PUB_QUIZZES: Quiz[] = [
  {
    id: SIAP_TENDER_PRETEST_ID,
    courseId: SIAP_TENDER_COURSE_ID,
    lessonId: "tender01-orientation",
    title: "Pre-test Diagnostik SIAP Tender",
    description: "Lima soal pemetaan pengetahuan awal. Hasil tidak menjadi syarat penyelesaian kursus.",
    passingScore: 0,
    timeLimit: 10,
    maxAttempts: 99,
    shuffleQuestions: false,
    showResults: true,
    questions: pretestQuestions,
    createdAt: "2026-11-01",
  },
  {
    id: SIAP_TENDER_POSTTEST_ID,
    courseId: SIAP_TENDER_COURSE_ID,
    lessonId: "tender01-reflection",
    title: "Post-test SIAP Tender",
    description: "Sepuluh soal pemahaman. Nilai lulus yang diusulkan 80/100; hasil ini belum mengaktifkan sertifikat otomatis.",
    passingScore: 80,
    timeLimit: 20,
    maxAttempts: 99,
    shuffleQuestions: false,
    showResults: true,
    questions: posttestQuestions,
    createdAt: "2026-11-01",
  },
];

export const SIAP_TENDER_COURSE_MATERIALS: Pick<ECourse, "id" | "lessons" | "preTestId" | "postTestId"> = {
  id: SIAP_TENDER_COURSE_ID,
  lessons: SIAP_TENDER_LESSONS,
  preTestId: SIAP_TENDER_PRETEST_ID,
  postTestId: SIAP_TENDER_POSTTEST_ID,
};
