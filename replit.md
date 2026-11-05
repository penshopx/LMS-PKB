# PKB ASDAMKINDO - Kompetensi Teknik Konstruksi

## Overview

PKB ASDAMKINDO adalah platform Pengembangan Keprofesian Berkelanjutan untuk memperkuat kompetensi teknik tenaga kerja konstruksi. Acuan regulasi utama adalah Permen PUPR Nomor 12 Tahun 2021 tentang Pelaksanaan Pengembangan Keprofesian Berkelanjutan.

Ruang lingkup katalog:
- Pendidikan/pelatihan formal serta pembelajaran nonformal.
- Pertemuan profesi, karya, pengajaran, paparan dan apresiasi karya.
- Kegiatan utama lainnya serta unsur penunjang sesuai peraturan.
- Katalog awal merupakan panduan pengenalan kegiatan dan dokumentasi PKB, bukan program pendidikan formal atau akreditasi kegiatan.

Orientasi aktif adalah individu tenaga teknik konstruksi. Ketentuan PKB pada peraturan ini berlaku untuk tenaga kerja konstruksi kualifikasi jabatan ahli. Koordinator mengelola akses kelompok, bukan kesiapan usaha BUJK. Katalog BUJK lama diarsipkan dengan ID dan riwayat asli; jangan mengubahnya menjadi kursus PKB baru.

Aplikasi tidak menghitung/menetapkan Angka Kredit atau menerbitkan SKK. Sertifikat aplikasi hanya bukti penyelesaian kursus. L1–L4 adalah tahapan belajar internal, bukan jenjang jabatan ahli 7–9. Penilaian dan penetapan resmi mengikuti pihak berwenang.

## Knowledge base referensi fitur

Sebelum mengusulkan atau mengubah fitur terkait regulasi, baca
[`docs/knowledge-base/README.md`](docs/knowledge-base/README.md).
Sumber utama saat ini: `attached_assets/Permen_PUPR_12_2021_(1)_1793845827824.pdf` (42 halaman), terdaftar sebagai `PKB-12-2021`. Ringkasan belum memverifikasi status perubahan terbaru secara daring.
Folder tersebut juga mengindeks dua PDF lama untuk konteks arsip, catatan relevansi fitur,
rujukan halaman, dan ekstraksi teks yang dapat dicari.
Pemetaan terhadap kode, batas peran, dan celah prioritas tersedia di
[`docs/knowledge-base/pemetaan-fitur.md`](docs/knowledge-base/pemetaan-fitur.md).
Player kursus menampilkan rujukan per lesson; admin dapat mengelolanya, peserta
dan PIC hanya membaca. Rujukan menyimpan ID dokumen, halaman, bagian opsional,
dan interpretasi relevansi, bukan pengesahan hukum. Penyimpanan memakai JSONB
lesson yang sudah ada, tanpa tabel atau migrasi baru. Sinkronisasi katalog wajib
mempertahankan pilihan admin, termasuk daftar rujukan yang sengaja dikosongkan.

- Materi diskusi **Implementasi Permen PU No. 6 Tahun 2025** menjadi referensi
  konteks perizinan, PUB, SBU, pengawasan, dan kepatuhan; bukan naskah hukum
  primer atau izin menerapkan seluruh ketentuan slide secara otomatis.
- **Permendagri No. 7 Tahun 2024** membahas Barang Milik Daerah; jangan
  menyamakannya dengan Permen PUPR Nomor 12 Tahun 2021 tentang PKB.
- Kutip sumber dan halaman; periksa gambar/tabel pada PDF asli serta naskah
  resmi terbaru sebelum menjadikannya aturan aplikasi. Pertahankan batas LMS
  dan sertifikat penyelesaian kursus; jangan menambahkan layanan LKUT/SBU/SKK
  hanya karena topik itu disebut dalam sumber.

Key features:
- **Kompetensi Teknik Konstruksi**: Domain belajar dan unit kompetensi yang tetap dapat dikelola
- **Pembelajaran 6 langkah**: Orientation, Context, Microlearning, Practice, Assessment, Reflection
- **4-Level Progression**: L1 (Awareness) → L2 (Application) → L3 (Mastery) → L4 (Strategic)
- **Evidence-based Assessment**: Track and document competency evidence
- **Competency Passport**: Generate competency documentation for talent decisions
- **Dashboard Analytics**: Heatmap visualization of participant progress with quick access cards
- **Landing Page**: Public course catalog for individual technical construction professionals

**Power Features (Latest):**
- **Global Search**: Real-time search across participants, courses, and competency units (Ctrl+K shortcut) — `GET /api/search?q=...`
- **Notification Center**: Bell icon with badge showing unread notifications, mark read/all-read — `GET /api/notifications`, `PATCH /api/notifications/:id/read`
- **Analytics Page** (`/app/analytics`): Rich recharts visualizations — monthly trend (line), cluster level distribution (bar), course by level (pie), gap analysis (bar), radar chart — `GET /api/analytics`
- **CSV Export**: Export participants list with competency stats to CSV file
- **Page Title Breadcrumb**: Contextual page title shown in the header on all pages

**LMS Features (New):**
- **Learning Paths**: Create learning paths with prerequisites, difficulty levels, and progress tracking
- **Quiz Engine**: Multiple question types (pilihan ganda, benar/salah, esai) with scoring
- **Certificates**: Digital certificate issuance with verification codes

**PKB Guidance:**
- Activity categories, evidence, credit composition, and minimum values are explained from the supplied regulation.
- Official credit assessment and SKK issuance are outside the application.
- Historical LSP tables and APIs are retained for data preservation, but the old LSP management page is not part of the current UI.

## Routes

- `/` - Public PKB course catalog and independent registration
- `/app` - Dashboard with competency analytics and quick access cards
- `/app/competencies` - Competency cluster and unit management
- `/app/courses` - Katalog dan builder pembelajaran dengan template 6 langkah
- `/app/learning-paths` - Learning paths with enrollment and progress tracking
- `/app/learning-programs` - Rencana Belajar PKB: target kursus pribadi, penugasan kelompok bertenggat, pengingat dalam aplikasi, dan pemantauan tindak lanjut
- `/app/discussions/:courseId` - Diskusi teknis dari pemutar kursus dan notifikasi. Peserta dengan enrollment aktif/selesai bertanya dan membalas dalam kelompok sendiri; koordinator baca-saja; admin memfasilitasi, menandai balasan membantu, menyembunyikan/memulihkan dengan alasan. Pertanyaan independen tetap privat pengirim/admin, termasuk setelah bergabung dengan kelompok. Konten tersembunyi hanya terbaca admin; balasan ditutup saat pertanyaan disembunyikan. Notifikasi generik tanpa isi/identitas diskusi, akses diperiksa kembali saat dibuka. Tidak menyalin refleksi, kuis, atau mengubah progres/kelulusan. Migrasi SQL dijalankan saat startup; `npm run test:discussions` memeriksa login normal dan tampilan ponsel menggunakan akun sementara yang dibersihkan setelah tes.
  Penghapusan kursus melalui API admin menghapus diskusi, balasan, dan notifikasi terkait dalam transaksi penghapusan kursus yang sama. Jika rencana belajar atau acuan lain masih menahan kursus, seluruh transaksi dibatalkan termasuk penghapusan diskusi. Arsip kurikulum bukan penghapusan; arsip tetap mempertahankan riwayat.
- `/app/discussion-reports` - Laporan privat pertanyaan/balasan: peserta melapor hanya pada konten terlihat dalam akses kursus/kelompoknya. Hanya pelapor dan admin dapat membaca laporan; koordinator tidak mendapat akses baru. Admin memiliki antrean berhalaman 30 laporan, filter Baru/Ditinjau/Selesai/Tidak ditindaklanjuti, catatan privat untuk pelapor, dan tautan ke kontrol moderasi yang sudah ada. Menutup laporan wajib disertai catatan; perubahan status tidak otomatis menyembunyikan konten. Riwayat pelapor tetap tersedia setelah pindah kelompok tanpa menampilkan ulang isi, judul, identitas penulis, atau tautan kursus lama. Satu laporan per peserta per konten, termasuk laporan tertutup; maksimal 5 laporan baru per jam, diserialisasi dalam transaksi dan disimpan di PostgreSQL. Notifikasi hanya ke admin aktif saat laporan baru dan ke pelapor saat penanganan berubah, tanpa alasan/isi sensitif. Isi laporan dikecualikan dari log respons API. Laporan dihapus bersama konten/kursus terkait melalui FK cascade.
- `/app/quizzes` - Quiz Engine with multiple question types (pilihan ganda, benar/salah, esai)
- `/app/participants` - Participant management
- `/app/passport` - Competency Passport
- Ekspor portofolio tersedia dari paspor admin, beranda peserta, dan detail peserta koordinator. Unduhan HTML dapat dicetak/disimpan sebagai PDF; endpoint `GET /api/participants/:id/portfolio-export` mengikuti batas peserta/kelompok, memisahkan kurikulum aktif, arsip, serta data tanpa acuan. Dokumen bukan SKK/keputusan resmi dan tidak menetapkan Angka Kredit/SKPK. Daftar bukti bukan lampiran berkas; refleksi privat praktik tidak diekspor, dan refleksi bukti peserta tidak dibagikan kepada koordinator.
- `/app/assessment` - PKB regulatory guidance, available to every signed-in role
- `/app/certificates` - Certificate issuance and verification with unique codes

## Integrasi historis Gustafta

Tautan promosi kesiapan usaha tidak ditampilkan pada navigasi atau dashboard PKB. Implementasi pencatatan historis tetap disimpan.

Klik tautan Gustafta dicatat sebagai event anonim `gustafta_link_click` dengan dimensi
`domain`, `destination`, dan `location`. Event hanya memakai nilai tujuan yang sudah
ditentukan aplikasi; tidak ada data pribadi, isi pembelajaran, atau data peserta yang
dikirim. Jika tracker analytics belum tersedia, pencatatan otomatis menjadi no-op dan
tidak mengganggu navigasi.

Untuk mengaktifkan pengukuran pada deployment, buka **Publishing settings**, aktifkan
analytics, lalu **publish atau republish** aplikasi. Replit akan menyuntikkan tracker
analytics pada hasil publish; mode development tidak memerlukan konfigurasi script atau
environment variable tambahan.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query for server state, React useState for local state
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Framework**: Express 5 (ESM modules)
- **Language**: TypeScript with tsx for development
- **API Design**: RESTful JSON API with `/api` prefix
- **Server**: Node.js with HTTP server (supports WebSocket upgrade path)

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Validation**: Zod schemas generated from Drizzle schemas via drizzle-zod
- **Current Storage**: PostgreSQL melalui Drizzle ORM; penyimpanan in-memory tetap tersedia untuk kompatibilitas pengujian

### Project Structure
```
├── client/src/          # React frontend application
│   ├── components/      # Reusable UI components
│   ├── pages/           # Route page components
│   ├── hooks/           # Custom React hooks
│   └── lib/             # Utilities and query client
├── server/              # Express backend
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # API route definitions
│   └── storage.ts       # Data access layer
├── shared/              # Shared types and schemas
│   └── schema.ts        # Drizzle schema definitions
└── migrations/          # Database migrations (Drizzle Kit)
```

### Key Design Patterns
- **Monorepo structure**: Client, server, and shared code in single repository
- **Type sharing**: Schema types exported from `shared/schema.ts` used by both frontend and backend
- **Component composition**: Shadcn/ui components with Radix primitives
- **API abstraction**: `apiRequest` helper and TanStack Query for data fetching

## External Dependencies

### Initial administrator setup and legacy recovery
- On an empty installation, set `ADMIN_RECOVERY_PASSWORD` as a secret with at least 12 non-padding characters before starting the server (development and production). No shared default password is generated.
- The initial login username is `admin`; its password is the configured secret. Credentials are never printed in startup logs.
- After confirming access, remove the secret. Existing accounts are not recreated or overwritten on restart.
- In production only, the same secret can recover a legacy `admin` account that still uses the old default password. Recovery invalidates existing sessions, does not reactivate disabled accounts, and never resets an account whose password has already changed.
- Missing or invalid setup configuration on an empty installation stops startup. A legacy default password without configured recovery also blocks production startup.

### Database
- **PostgreSQL**: Primary database (configured via `DATABASE_URL` environment variable)
- **Drizzle Kit**: Database migrations with `npm run db:push`

### UI Framework
- **Radix UI**: Accessible component primitives (dialog, dropdown, tabs, etc.)
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

### Development Tools
- **Vite**: Frontend build and dev server with HMR
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Production bundling for server code

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal**: Runtime error overlay
- **@replit/vite-plugin-cartographer**: Development tooling (dev only)
- **@replit/vite-plugin-dev-banner**: Development banner (dev only)

### Session Management (Available)
- **connect-pg-simple**: PostgreSQL session store (available but not yet implemented)
- **express-session**: Session middleware (available in dependencies)