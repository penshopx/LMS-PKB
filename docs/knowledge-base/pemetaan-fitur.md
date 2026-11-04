# Pemetaan referensi ke fitur LMS PUB ASPEKINDO

## Ruang lingkup dan cara membaca

Pemetaan ini membandingkan dua dokumen pada [indeks sumber](README.md) dengan
implementasi dalam repositori. Ini bukan audit kepatuhan hukum, pemeriksaan isi
database produksi, atau bukti bahwa semua materi katalog sudah ditelaah ahli.
Katalog awal di kode tidak menjamin isi kursus yang telah diedit di database sama.

Status:
- **Tersedia:** ada struktur fitur atau materi awal dalam kode.
- **Sebagian:** ada bagian pendukung, tetapi pemetaan sumber atau materi khusus
  belum dibuktikan lengkap.
- **Usulan:** belum diterapkan dalam pekerjaan pemetaan ini.
- **Di luar lingkup:** tidak boleh ditambahkan hanya berdasarkan referensi.

Nomor halaman di bawah adalah **halaman PDF**, bukan nomor pasal.
`PU-6-2025` adalah materi diskusi; `DAGRI-7-2024` adalah salinan Permendagri
tentang Barang Milik Daerah (BMD), bukan Permen PUPR tentang PUB.

## Matriks domain pembelajaran

| Domain/fitur yang ada | Referensi dan batas relevansi | Status dan langkah yang disarankan |
| --- | --- | --- |
| SIAP Legalitas dan Perizinan: `legal-01`, `legal-02`; kursus `course-legal01-l2` | PU-6-2025 hlm. 11–26: standar kegiatan usaha, pengawasan, SIJK dan konteks LKUT | **Sebagian.** Struktur tersedia. Tambahkan rujukan halaman pada materi, latihan membedakan kewajiban dan bukti, serta catatan kapan perlu memeriksa naskah resmi. Jangan membuat layanan pelaporan SIJK/LKUT. |
| SIAP Sertifikasi: `sert-01`, `sert-02`; kursus `course-sert01-l2` | PU-6-2025 hlm. 46–74: konversi SBU dan substansi BUJK | **Sebagian.** Cocok untuk belajar kesiapan dokumen dan kebutuhan tenaga kerja. Bukan verifikasi resmi, konversi SBU, atau penerbitan SKK. Tabel dan angka wajib diperiksa secara visual dan pada naskah resmi. |
| SIAP Tender: `tender-01`, `tender-02`; pilot `course-tender01-l2` | PU-6-2025 hlm. 75–77: konteks segmentasi pasar; DAGRI-7-2024 hlm. 30 Pasal 170: pemilihan mitra KSP BMD | **Sebagian.** Pilot sudah memuat pemeriksaan dokumen, keputusan go/no-go, risiko dan simulasi. Tambahkan konteks sumber tanpa mengganti simulasi dengan penetapan kelayakan hukum. KSP BMD bukan aturan semua tender konstruksi. |
| SIAP Proyek: `proyek-01`, `proyek-02`; kursus `course-proyek01-l2` | PU-6-2025 hlm. 21, 29: pengawasan dan manajemen proyek; DAGRI-7-2024 hlm. 45, 118–119, 122–123: BAST, konstruksi dalam pengerjaan, renovasi | **Sebagian.** Cocok untuk studi kasus administrasi kontrak, bukti serah terima dan pemantauan proyek aset daerah. Bedakan dokumen latihan peserta dari register aset atau laporan resmi pemerintah. |
| Kepatuhan SMAP: `smap-01` s.d. `smap-04`; kursus `course-smap01-l2` | PU-6-2025 hlm. 29 dan 74: manajemen anti penyuapan dan komitmen SMAP | **Sebagian.** Gunakan untuk pengantar dan skenario risiko. Tidak membuktikan bahwa silabus SMAP lengkap atau sertifikat kursus memenuhi kewajiban legal/sertifikasi SMAP. |
| Kepatuhan PANCEK: `pan-01` s.d. `pan-04`; kursus `course-pan03-l2` | PU-6-2025 hlm. 29 memberi konteks manajemen organisasi/operasi; bukan dasar eksplisit metode PANCEK | **Tersedia sebagai kerangka produk**, bukan kewajiban bernama PANCEK dari kedua dokumen. Hubungan hanya interpretasi pembelajaran, jangan diiklankan sebagai mandat peraturan. |

Lokasi katalog dan unit: [`server/pub-catalog.ts`](../../server/pub-catalog.ts).
Lokasi pilot: [`shared/siap-tender-course.ts`](../../shared/siap-tender-course.ts).

## Enam ranah PUB pada halaman 29

Pemetaan berikut adalah **interpretasi kurikulum**, bukan persamaan resmi:

| Ranah dalam presentasi | Tempat yang paling dekat dalam aplikasi | Celah yang perlu ditinjau |
| --- | --- | --- |
| Manajemen pelaksanaan proyek | SIAP Proyek | Cakupan materi terhadap indikator sumber belum dinilai lengkap |
| Pengembangan organisasi | PANCEK dan jalur kepatuhan | Belum dibuktikan ada materi khusus pengembangan organisasi |
| Pemanfaatan teknologi | Dapat menjadi konteks lintas kursus | Platform digital saja bukan bukti adanya materi kompetensi pemanfaatan teknologi |
| Kemampuan keuangan | SIAP Proyek serta penawaran/risiko SIAP Tender | Konteks biaya/penawaran belum membuktikan cakupan keuangan badan usaha lengkap |
| Manajemen operasi | PANCEK dan SIAP Proyek | Perlu memisahkan operasi badan usaha dari pelaksanaan satu proyek |
| Manajemen anti penyuapan | Kepatuhan SMAP | Perlu telaah ahli atas cakupan silabus dan klaim hasil belajar |

Jangan mengganti enam cluster aplikasi dengan enam ranah sumber secara otomatis.
Level belajar L1–L4 juga tidak sama dengan tingkatan kinerja AAA–D pada
PU-6-2025 hlm. 34.

## Pemetaan alur dan peran

| Alur yang diperiksa | Bukti kode dan batas penggunaan referensi |
| --- | --- |
| Katalog publik | [`server/public-catalog-routes.ts`](../../server/public-catalog-routes.ts), [`client/src/pages/public-course.tsx`](../../client/src/pages/public-course.tsx). Cocok menampilkan tujuan belajar dan rujukan ringkas; deskripsi tidak boleh mengklaim penerbitan SBU/SKK atau kelulusan legal otomatis. |
| Penyusunan materi enam langkah | [`client/src/pages/courses.tsx`](../../client/src/pages/courses.tsx). Rujukan dapat masuk pada konteks/microlearning dan skenario praktik. Kehadiran builder belum berarti sumber telah ditautkan ke setiap lesson. |
| Jalur pembelajaran | [`server/pub-catalog.ts`](../../server/pub-catalog.ts) memuat jalur Legalitas dan Sertifikasi, Tender, Proyek, dan Kepatuhan. Ini struktur belajar, bukan bukti pelaksanaan PUB resmi atau penugasan wajib per kelompok jabatan yang sudah lengkap. |
| Kuis dan kelulusan | [`shared/lms-course-rules.ts`](../../shared/lms-course-rules.ts), [`server/routes.ts`](../../server/routes.ts). Kelulusan kursus mensyaratkan semua lesson dan post-test yang diwajibkan. Jangan menambah syarat PUB/LKUT, persetujuan asesor, atau level kinerja BUJK dari dokumen. |
| Misi praktik | [`server/practice-mission-routes.ts`](../../server/practice-mission-routes.ts), [`shared/practice-missions.ts`](../../shared/practice-missions.ts). Dapat memakai skenario dokumen fiktif, risiko tender atau BAST. Tetap pelengkap; bukan prasyarat kelulusan baru atau bukti kepatuhan resmi. |
| Peserta dan PIC BUJK | [`client/src/App.tsx`](../../client/src/App.tsx), [`client/src/pages/role-home.tsx`](../../client/src/pages/role-home.tsx), [`server/routes.ts`](../../server/routes.ts). Peserta belajar melalui beranda peserta; PIC memakai beranda PIC dan akses sesuai BUJK. Jangan menganggap semua menu admin dapat dipakai kedua peran. Referensi tidak mengubah hak akses. |
| Analitik dan passport | [`client/src/pages/analytics.tsx`](../../client/src/pages/analytics.tsx), [`client/src/pages/passport.tsx`](../../client/src/pages/passport.tsx). Rekam hasil belajar tidak sama dengan penilaian kinerja resmi badan usaha, skor PUB, atau laporan LKUT. |

## Celah nyata dan prioritas

### Prioritas 1 — cegah salah dasar hukum dan klaim sertifikasi

1. **Rujukan lesson terstruktur sudah ditambahkan.** Player menampilkan ID sumber
   melalui judul dokumen, jenis sumber, halaman, bagian/pasal opsional, catatan
   relevansi sebagai interpretasi, serta peringatan verifikasi naskah resmi.
   Admin dapat menambah, mengubah, dan menghapus melalui “Kelola rujukan” di player;
   peserta dan PIC hanya membaca. Halaman divalidasi sesuai jumlah halaman dokumen.
   Perubahan tersimpan pada JSON lesson dan dilindungi dari penimpaan versi admin
   lain. Pilihan admin, termasuk penghapusan, dipertahankan saat sinkronisasi katalog.
   Status telaah resmi tetap belum diverifikasi; tidak ada klaim bahwa semua materi
   telah ditelaah ahli atau terhubung ke sumber. Riwayat versi/telaah khusus belum
   menjadi fitur.
2. **Permendagri dan Permen PUPR harus dibedakan pada materi.** Dokumen primer
   Permen PUPR 7/2024 tidak termasuk dua PDF. Jangan menandai penjelasan PUB
   dalam presentasi sebagai verifikasi naskah primer tersebut.
3. **Ada bagian lama yang perlu ditinjau terhadap arah LMS.** Router admin masih
   memuat Asesmen/LSP pada `/app/assessment`. Form sertifikat masih menyebut kursus
   opsional; pemeriksaan penyelesaian pada `POST /api/certificates` dilakukan
   ketika `courseId` diberikan. Artinya keberadaan sertifikat belum menjamin semua
   alur hanya menghasilkan sertifikat penyelesaian kursus. Perlu keputusan
   penanganan alur/data lama sebelum perubahan; jangan menghapusnya diam-diam.

### Prioritas 2 — perkaya pilot, bukan duplikasi kursus

4. **Perkaya SIAP Tender yang ada** dengan lembar rujukan, latihan memilih sumber
   yang sesuai, dan kasus ketidakpastian ketentuan. Tunda penggunaan nilai pagu
   dari slide karena hlm. 76 menyebut tahun berbeda dari sampul.
5. **Tambahkan skenario SIAP Proyek tentang BMD** hanya sebagai materi pilihan
   kontekstual: hubungan dokumen serah terima, konstruksi dalam pengerjaan dan
   pemantauan renovasi. Perlu penelaahan materi sebelum dipublikasikan.
6. **Tinjau cakupan enam ranah PUB** bersama penyusun kurikulum. Jangan menyimpulkan
   bahwa semua ranah sudah terpenuhi hanya karena ada enam cluster atau dashboard.

## Batas sebelum implementasi

- Tidak menerapkan angka, tenggat, atau keputusan hukum dari slide/OCR tanpa
  naskah resmi dan pemeriksaan halaman.
- Tidak menambah pelaporan LKUT/BMD, koneksi SIJK/OSS, penerbitan SBU/SKK,
  perhitungan kredit PUB, atau penilaian kinerja resmi melalui pekerjaan ini.
- Tidak mengubah nilai lulus, batas percobaan kuis, aturan penerbitan sertifikat,
  hak akses, data pengguna, atau isi database.
- Perubahan fitur berikutnya harus memiliki tujuan, peran, sumber, aturan
  penerimaan dan verifikasi yang jelas; daftar prioritas di atas belum merupakan
  persetujuan untuk mengeksekusi semuanya.

## Kriteria telaah konten berikutnya

Setiap materi yang diusulkan perlu mencantumkan:
1. Kursus/unit tujuan dan hasil belajar.
2. ID sumber, halaman PDF, pasal bila ada, dan pembedaan kutipan vs interpretasi.
3. Status pemeriksaan visual dan naskah resmi; bagian yang masih meragukan.
4. Skenario serta bukti latihan tanpa data pengguna nyata.
5. Pernyataan bahwa hasil belajar bukan keputusan sertifikasi/kepatuhan formal.

Pemetaan awal diverifikasi terhadap keberadaan berkas, rute dan struktur kode.
Implementasi rujukan selanjutnya memiliki pengujian terpisah untuk validasi,
otorisasi, penyimpanan PostgreSQL, konflik perubahan, sinkronisasi katalog, serta
alur browser setelah login menggunakan data uji sementara. Hal tersebut bukan
audit isi database produksi atau penerapan peraturan di produksi.
