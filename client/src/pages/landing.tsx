import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { PublicCourse } from "@shared/public-catalog";
import { BrandMark, BRAND_NAME, BRAND_TAGLINE } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CalendarDays, Clock3, ArrowRight, Search, UsersRound, ShieldCheck, RefreshCw, LibraryBig } from "lucide-react";

const formatLabels: Record<PublicCourse["format"], string> = {
  self_paced: "Belajar mandiri",
  upcoming: "Kelas mendatang",
  recording: "Rekaman",
};

function dateLabel(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(date) + " WIB";
}

function CourseCard({ course }: { course: PublicCourse }) {
  const isUpcoming = course.format === "upcoming";
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-transform duration-200 hover:-translate-y-1 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900">
      <div className={`relative flex min-h-36 items-end overflow-hidden p-5 ${isUpcoming ? "bg-[#d9ecff]" : "bg-[#e8f1fa]"} dark:bg-slate-800`}>
        <div aria-hidden="true" className="absolute -right-5 -top-10 h-36 w-36 rounded-full border-[20px] border-sky-300/40" />
        <div aria-hidden="true" className="absolute right-12 top-5 h-12 w-12 rotate-12 border border-sky-600/30" />
        <Badge className="relative z-10 border-0 bg-[#123b63] text-white hover:bg-[#123b63]">{formatLabels[course.format]}</Badge>
        <span className="absolute bottom-5 right-5 font-mono text-xs tracking-[0.18em] text-sky-950/60 dark:text-sky-100/60">PUB / {String(course.lessonCount).padStart(2, "0")}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-800 dark:text-sky-300">{course.targetLevel || "Kompetensi konstruksi"}</p>
        <h3 className="mt-2 text-xl font-bold leading-snug text-[#142c45] dark:text-slate-100">{course.title}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{course.description}</p>
        <div className="mt-auto pt-5">
          {isUpcoming && course.startsAt && (
            <p className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"><CalendarDays className="h-4 w-4 text-sky-700" />{dateLabel(course.startsAt)}</p>
          )}
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" />{course.lessonCount} bagian</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{course.duration || "Durasi fleksibel"}</span>
          </div>
          <Link href={`/courses/${encodeURIComponent(course.id)}`} className="inline-flex w-full items-center justify-between rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-[#143958] transition-colors hover:border-sky-700 hover:bg-sky-50 dark:border-slate-600 dark:text-sky-200 dark:hover:bg-slate-800">
            Lihat detail <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </article>
  );
}

function CatalogState({ retry, error }: { retry: () => void; error?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <LibraryBig className="mx-auto h-8 w-8 text-sky-700" />
      <h3 className="mt-3 font-semibold text-slate-900 dark:text-slate-100">{error ? "Katalog belum dapat dimuat" : "Belum ada kursus pada kategori ini"}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">{error || "Kursus yang memenuhi kategori ini belum tersedia untuk publik. Silakan jelajahi kategori lain atau periksa kembali nanti."}</p>
      {error && <Button variant="outline" className="mt-5" onClick={retry}><RefreshCw className="mr-2 h-4 w-4" />Coba lagi</Button>}
    </div>
  );
}

export default function Landing() {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const catalog = useQuery<PublicCourse[]>({
    queryKey: ["/api/public/courses"],
    queryFn: async () => (await apiRequest("GET", "/api/public/courses")).json(),
    retry: false,
  });
  const courses = catalog.data ?? [];
  const levels = useMemo(() => Array.from(new Set(courses.map(course => course.targetLevel).filter(Boolean))), [courses]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("id");
    return courses.filter(course =>
      (level === "all" || course.targetLevel === level) &&
      (!needle || `${course.title} ${course.description} ${course.targetLevel} ${course.instructor}`.toLocaleLowerCase("id").includes(needle))
    );
  }, [courses, level, search]);
  const upcoming = filtered.filter(course => course.format === "upcoming");
  const recordings = filtered.filter(course => course.format === "recording");
  const available = filtered.filter(course => course.format === "self_paced");

  return (
    <div className="min-h-[100dvh] bg-[#f4f8fc] text-[#142c45] dark:bg-[#081827] dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#f7fbff]/95 backdrop-blur dark:border-slate-700 dark:bg-[#0a1b2b]/95">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 sm:px-7">
          <Link href="/" className="flex items-center gap-3" aria-label="Beranda PKB ASDAMKINDO">
            <BrandMark size="md" />
            <span className="hidden flex-col sm:flex"><strong className="text-sm leading-tight">{BRAND_NAME}</strong><span className="text-[11px] text-slate-500 dark:text-slate-400">{BRAND_TAGLINE}</span></span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <a href="#katalog" className="hidden text-sm font-medium text-slate-700 hover:text-sky-800 sm:inline dark:text-slate-300">Jelajahi kursus</a>
            <ThemeToggle />
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#163a5a] hover:bg-sky-100 dark:text-sky-200 dark:hover:bg-slate-800">Masuk</Link>
            <Link href="/register" className="rounded-lg bg-[#123b63] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a527f]">Daftar</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-[#0d2a45] text-white">
          <div aria-hidden="true" className="absolute inset-y-0 right-0 -z-10 w-[58%] opacity-40">
            <div className="absolute right-[-7rem] top-[-12rem] h-[40rem] w-[40rem] rounded-full border border-sky-200/30" />
            <div className="absolute right-[-2rem] top-[-7rem] h-[30rem] w-[30rem] rounded-full border border-sky-200/30" />
            <div className="absolute right-[4rem] top-[-1rem] h-[18rem] w-[18rem] rounded-full border border-sky-200/30" />
            <div className="absolute inset-y-0 right-[28%] w-px bg-sky-200/20" />
          </div>
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-7 sm:py-24 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:py-28">
            <div>
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200/25 bg-sky-100/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-sky-100"><span className="h-1.5 w-1.5 rounded-full bg-sky-300" />PKB ASDAMKINDO</p>
              <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">Kompetensi teknik konstruksi tumbuh dari <span className="text-[#83c8ff]">pembelajaran berkelanjutan.</span></h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-200 sm:text-lg">Pembelajaran praktis untuk tenaga kerja konstruksi dan siapa pun yang ingin mengembangkan kompetensi teknik konstruksi.</p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-sky-100">Acuan: Permen PUPR No. 12 Tahun 2021 tentang Pelaksanaan Pengembangan Keprofesian Berkelanjutan.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#katalog" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#78c5ff] px-5 py-3.5 font-semibold text-[#0c2a46] transition-colors hover:bg-[#a0d8ff]">Jelajahi katalog <ArrowRight className="h-4 w-4" /></a>
                <Link href="/register" className="inline-flex items-center justify-center rounded-lg border border-white/30 px-5 py-3.5 font-semibold text-white hover:bg-white/10">Buat akun pembelajar</Link>
              </div>
              <div className="mt-10 flex items-start gap-3 border-t border-white/15 pt-5 text-sm leading-6 text-slate-300">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#83c8ff]" />
                <p>Materi dan aktivitas organisasi tetap terlindungi. Katalog publik hanya menampilkan ringkasan kursus yang dibuka untuk umum.</p>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
              <div className="absolute -inset-4 rotate-2 rounded-[2rem] border border-sky-300/20" />
              <div className="relative rounded-[1.5rem] border border-white/15 bg-[#153a5a] p-6 shadow-2xl shadow-black/20 sm:p-8">
                <div className="flex items-center justify-between border-b border-white/15 pb-5">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-200">Peta kompetensi</p><p className="mt-1 text-lg font-bold">Siap menghadapi pekerjaan</p></div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-200/15"><BookOpen className="h-5 w-5 text-sky-200" /></div>
                </div>
                <div className="mt-6 space-y-3">
                  {[
                    ["01", "Pendidikan & pelatihan profesional"],
                    ["02", "Pembelajaran mandiri & penugasan"],
                    ["03", "Pertemuan & kontribusi profesi"],
                    ["04", "Bukti kegiatan & rencana PKB"],
                  ].map(([number, title]) => <div key={number} className="flex items-center gap-4 rounded-xl bg-[#0d2a45]/65 p-4"><span className="font-mono text-sm text-sky-300">{number}</span><span className="text-sm font-medium text-slate-100">{title}</span><span className="ml-auto h-1.5 w-1.5 rounded-full bg-sky-300" /></div>)}
                </div>
                <p className="mt-6 text-xs leading-5 text-slate-300">Belajar sesuai kebutuhan kerja, bukan sekadar mengumpulkan materi.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="katalog" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-7 sm:py-20">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-800 dark:text-sky-300">Katalog pembelajaran</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Pilih langkah belajar Anda.</h2>
              <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">Lihat kelas yang akan datang dan materi yang dapat dipelajari mandiri. Ketersediaan mengikuti kursus yang telah dibuka untuk publik.</p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-[minmax(15rem,1fr)_12rem] lg:max-w-xl">
              <label className="relative block"><span className="sr-only">Cari kursus</span><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari topik atau kompetensi" className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-sky-700 focus:ring-2 focus:ring-sky-700/15 dark:border-slate-600 dark:bg-slate-900" /></label>
              <label><span className="sr-only">Filter level sasaran</span><select value={level} onChange={event => setLevel(event.target.value)} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-700 dark:border-slate-600 dark:bg-slate-900"><option value="all">Semua sasaran</option>{levels.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
            </div>
          </div>

          {catalog.isLoading ? (
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Memuat katalog kursus">{[0, 1, 2].map(item => <div key={item} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><div className="h-36 animate-pulse bg-sky-100 dark:bg-slate-800" /><div className="space-y-3 p-5"><div className="h-3 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /><div className="h-6 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /><div className="h-14 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /></div></div>)}</div>
          ) : catalog.isError ? <div className="mt-10"><CatalogState retry={() => catalog.refetch()} error={catalog.error instanceof Error ? catalog.error.message : "Periksa koneksi dan coba lagi."} /></div> : (
            <div className="mt-12 space-y-14">
              <section aria-labelledby="upcoming-heading">
                <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-800 dark:text-sky-300">Berjadwal</p><h3 id="upcoming-heading" className="mt-1 text-2xl font-bold">Kelas mendatang</h3></div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900 dark:bg-sky-900/50 dark:text-sky-100">{upcoming.length} kelas</span>
                </div>
                {upcoming.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{upcoming.map(course => <CourseCard key={course.id} course={course} />)}</div> : <CatalogState retry={() => catalog.refetch()} />}
              </section>
              <section aria-labelledby="recordings-heading">
                <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-800 dark:text-sky-300">Tonton sesuai waktu Anda</p><h3 id="recordings-heading" className="mt-1 text-2xl font-bold">Rekaman kursus</h3></div>
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900 dark:bg-sky-900/50 dark:text-sky-100">{recordings.length} rekaman</span>
                </div>
                {recordings.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recordings.map(course => <CourseCard key={course.id} course={course} />)}</div> : <CatalogState retry={() => catalog.refetch()} />}
              </section>
              <section aria-labelledby="available-heading">
                <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-700">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-800 dark:text-sky-300">Materi yang sudah tersedia</p><h3 id="available-heading" className="mt-1 text-2xl font-bold">Kursus belajar mandiri</h3></div>
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-100">{available.length} materi</span>
                </div>
                {available.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{available.map(course => <CourseCard key={course.id} course={course} />)}</div> : <CatalogState retry={() => catalog.refetch()} />}
                <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">Kursus belajar mandiri berisi materi dan aktivitas terstruktur. Kursus ini tidak otomatis berarti tersedia rekaman video.</p>
              </section>
            </div>
          )}
        </section>

        <section className="border-y border-slate-200 bg-[#e7f2fb] dark:border-slate-700 dark:bg-[#10283c]">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-7 md:grid-cols-[1fr_auto] md:items-center">
            <div><div className="flex items-center gap-2 text-sky-900 dark:text-sky-200"><UsersRound className="h-5 w-5" /><p className="text-xs font-bold uppercase tracking-[0.16em]">Untuk tenaga teknik konstruksi</p></div><h2 className="mt-3 max-w-2xl text-2xl font-bold sm:text-3xl">Kembangkan keahlian melalui pembelajaran profesional yang berkelanjutan.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Belajar mandiri atau melalui undangan koordinator PKB. Acuan kegiatan adalah Permen PUPR No. 12 Tahun 2021 untuk tenaga kerja konstruksi kualifikasi jabatan ahli. Sertifikat kursus bukan SKK atau penetapan Angka Kredit resmi.</p></div>
            <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#123b63] px-5 py-3.5 font-semibold text-white hover:bg-[#1a527f]">Daftar sebagai pembelajar <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-7 dark:text-slate-400">
        <div className="flex items-center gap-3"><BrandMark size="sm" /><span>{BRAND_NAME} · {BRAND_TAGLINE}</span></div>
        <div className="flex gap-5"><Link href="/login" className="hover:text-sky-800">Masuk</Link><Link href="/register" className="hover:text-sky-800">Pendaftaran</Link></div>
      </footer>
    </div>
  );
}
