import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { catalogSettingsSchema, type CatalogSettings } from "@shared/public-catalog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, BookOpen, CalendarDays, Check, ExternalLink, Globe2, RefreshCw, Save, Search, ShieldCheck } from "lucide-react";

type CatalogRecord = { courseId: string; title: string; description?: string; duration?: string; targetLevel?: string; lessonCount?: number } & CatalogSettings;
type Draft = CatalogSettings;

const defaultDraft: Draft = { published: false, format: "self_paced", startsAt: null, instructor: "", recordingUrl: "" };
const formatName: Record<CatalogSettings["format"], string> = { self_paced: "Belajar mandiri", upcoming: "Kelas mendatang", recording: "Rekaman" };

function localWib(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function fromLocalWib(value: string) {
  if (!value) return null;
  return `${value}:00+07:00`;
}

export default function CatalogSettingsPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [filter, setFilter] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [savedNotice, setSavedNotice] = useState("");
  const recordsQuery = useQuery<CatalogRecord[]>({
    queryKey: ["/api/catalog/settings"],
    queryFn: async () => (await apiRequest("GET", "/api/catalog/settings")).json(),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async ({ courseId, settings }: { courseId: string; settings: CatalogSettings }) => {
      const response = await apiRequest("PUT", `/api/catalog/settings/${encodeURIComponent(courseId)}`, settings);
      return response.json();
    },
    onSuccess: async () => {
      setSavedNotice("Pengaturan katalog berhasil disimpan.");
      await queryClient.invalidateQueries({ queryKey: ["/api/catalog/settings"] });
      setTimeout(() => setSavedNotice(""), 4000);
    },
  });
  const records = recordsQuery.data ?? [];
  const selected = records.find(item => item.courseId === selectedId);
  const visibleRecords = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase("id");
    return records.filter(item => !needle || item.title.toLocaleLowerCase("id").includes(needle));
  }, [records, filter]);

  function selectRecord(record: CatalogRecord) {
    setSelectedId(record.courseId);
    setDraft({ published: record.published, format: record.format, startsAt: record.startsAt, instructor: record.instructor, recordingUrl: record.recordingUrl });
    setValidationErrors({});
    setSavedNotice("");
  }
  function setValue<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
    setValidationErrors(current => ({ ...current, [key]: "" }));
  }
  function save() {
    if (!selected) return;
    const candidate = { ...draft, startsAt: selectedDraftDate };
    const result = catalogSettingsSchema.safeParse(candidate);
    if (!result.success) {
      const issues: Record<string, string> = {};
      for (const issue of result.error.issues) if (!issues[String(issue.path[0])]) issues[String(issue.path[0])] = issue.message;
      setValidationErrors(issues);
      setSavedNotice("");
      return;
    }
    setValidationErrors({});
    setSavedNotice("");
    mutation.mutate({ courseId: selected.courseId, settings: result.data });
  }
  const selectedDraftDate = draft.startsAt?.includes("T") && draft.startsAt.length === 16
    ? fromLocalWib(draft.startsAt)
    : draft.startsAt;
  const publishedCount = records.filter(item => item.published).length;

  return (
    <main className="min-h-[100dvh] bg-[#eff5fa] text-[#142c45] dark:bg-[#081827] dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-sky-800 dark:text-sky-300"><Globe2 className="h-4 w-4" />Katalog publik</div><h1 className="mt-1 text-2xl font-bold">Pengaturan katalog kursus</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Pilih ringkasan kursus yang dapat ditemukan publik dan atur formatnya.</p></div>
          <div className="flex items-center gap-2 rounded-xl bg-[#e8f3fc] px-4 py-3 text-sm dark:bg-[#132c41]"><ShieldCheck className="h-5 w-5 text-sky-800 dark:text-sky-200" /><span><strong>{publishedCount}</strong> dari {records.length} kursus dipublikasikan</span></div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-7 lg:grid-cols-[minmax(17rem,.72fr)_minmax(0,1.5fr)] lg:py-9">
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Kursus</h2><span className="text-xs text-slate-500">{records.length} total</span></div>
          <label className="relative mb-3 block"><span className="sr-only">Cari kursus</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={filter} onChange={event => setFilter(event.target.value)} className="pl-9" placeholder="Cari judul kursus" /></label>
          {recordsQuery.isLoading ? <div className="space-y-2" aria-label="Memuat kursus">{[1, 2, 3, 4].map(item => <div key={item} className="h-[4.75rem] animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />)}</div> : recordsQuery.isError ? <div className="rounded-xl border border-dashed border-rose-300 bg-white p-5 text-sm dark:bg-slate-900"><p role="alert" className="flex gap-2 text-rose-800 dark:text-rose-200"><AlertCircle className="h-4 w-4 shrink-0" />{recordsQuery.error instanceof Error ? recordsQuery.error.message : "Kursus gagal dimuat."}</p><Button variant="outline" className="mt-4" onClick={() => recordsQuery.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Coba lagi</Button></div> : visibleRecords.length ? <div className="space-y-2">{visibleRecords.map(record => <button key={record.courseId} type="button" onClick={() => selectRecord(record)} className={`w-full rounded-xl border p-4 text-left transition-colors ${selectedId === record.courseId ? "border-sky-700 bg-sky-50 ring-1 ring-sky-700/20 dark:bg-sky-950/40" : "border-slate-200 bg-white hover:border-sky-400 dark:border-slate-700 dark:bg-slate-900"}`}><div className="flex items-start justify-between gap-3"><span className="text-sm font-semibold leading-5">{record.title}</span><Badge variant={record.published ? "default" : "secondary"} className="shrink-0">{record.published ? "Publik" : "Privat"}</Badge></div><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{formatName[record.format]}</p></button>)}</div> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{records.length ? "Tidak ada judul yang cocok dengan pencarian." : "Belum ada kursus yang dapat diatur."}</div>}
        </section>

        <section>
          {!selected ? <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 text-center dark:border-slate-700 dark:bg-slate-900"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900"><BookOpen className="h-5 w-5 text-sky-900 dark:text-sky-100" /></div><h2 className="mt-4 text-lg font-bold">Pilih kursus untuk mulai</h2><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">Anda dapat mengatur visibilitas dan ringkasan publik tanpa membuka isi pembelajaran.</p></div> : (
            <Card className="border-slate-200 shadow-sm dark:border-slate-700">
              <CardHeader className="border-b border-slate-200 dark:border-slate-700"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardDescription>Pengaturan publik untuk</CardDescription><CardTitle className="mt-1 text-xl">{selected.title}</CardTitle></div><Badge variant={draft.published ? "default" : "secondary"}>{draft.published ? "Tampil di katalog" : "Tidak dipublikasikan"}</Badge></div><p className="pt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Katalog menampilkan ringkasan, sasaran, durasi, instruktur, dan judul/tipe outline. Isi materi tetap privat.</p></CardHeader>
              <CardContent className="space-y-6 p-5 sm:p-7">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70"><input type="checkbox" checked={draft.published} onChange={event => setValue("published", event.target.checked)} className="mt-1 h-4 w-4 accent-sky-800" /><span><span className="block text-sm font-semibold">Publikasikan ringkasan kursus</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">Kursus publik akan muncul pada katalog dan dapat dibuka tanpa masuk.</span></span></label>
                <fieldset className="space-y-3"><legend className="text-sm font-semibold">Format pembelajaran</legend><div className="grid gap-2 sm:grid-cols-3">{(["self_paced", "upcoming", "recording"] as const).map(format => <label key={format} className={`cursor-pointer rounded-xl border p-3 text-sm transition-colors ${draft.format === format ? "border-sky-700 bg-sky-50 dark:bg-sky-950/40" : "border-slate-200 hover:border-sky-300 dark:border-slate-700"}`}><input type="radio" name="format" value={format} checked={draft.format === format} onChange={() => setValue("format", format)} className="sr-only" /><span className="block font-semibold">{formatName[format]}</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{format === "self_paced" ? "Materi dalam alur belajar" : format === "upcoming" ? "Kelas dengan waktu mulai" : "Konten berupa rekaman HTTPS"}</span></label>)}</div></fieldset>
                {draft.format === "upcoming" && <div className="space-y-2"><Label htmlFor="catalog-start">Tanggal dan waktu kelas</Label><div className="relative"><CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="catalog-start" type="datetime-local" className="pl-10" value={localWib(draft.startsAt)} onChange={event => setValue("startsAt", fromLocalWib(event.target.value))} aria-invalid={!!validationErrors.startsAt} /></div><p className="text-xs text-slate-500 dark:text-slate-400">Waktu lokal WIB (UTC+7).</p>{validationErrors.startsAt && <p className="text-xs text-destructive">{validationErrors.startsAt}</p>}</div>}
                {draft.format !== "upcoming" && <div className="space-y-2"><Label htmlFor="catalog-instructor">Instruktur <span className="font-normal text-slate-500">(opsional)</span></Label><Input id="catalog-instructor" value={draft.instructor} maxLength={160} onChange={event => setValue("instructor", event.target.value)} placeholder="Nama instruktur" /></div>}
                {draft.format === "upcoming" && <div className="space-y-2"><Label htmlFor="catalog-upcoming-instructor">Instruktur <span className="font-normal text-slate-500">(opsional)</span></Label><Input id="catalog-upcoming-instructor" value={draft.instructor} maxLength={160} onChange={event => setValue("instructor", event.target.value)} placeholder="Nama instruktur" /></div>}
                {draft.format === "recording" && <div className="space-y-2"><Label htmlFor="catalog-recording">Tautan rekaman HTTPS</Label><Input id="catalog-recording" type="url" inputMode="url" value={draft.recordingUrl} maxLength={2000} onChange={event => setValue("recordingUrl", event.target.value)} placeholder="https://..." aria-invalid={!!validationErrors.recordingUrl} /><p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Tautan hanya diluncurkan untuk peserta terdaftar melalui endpoint aman. URL tidak ditampilkan pada katalog publik.</p>{validationErrors.recordingUrl && <p className="text-xs text-destructive">{validationErrors.recordingUrl}</p>}</div>}
                {draft.format !== "recording" && draft.recordingUrl && <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">Tautan rekaman tersimpan; URL tetap disimpan tetapi tidak ditampilkan di katalog untuk format yang dipilih.</p>}
                {selected.description && <div className="rounded-xl bg-[#e8f3fc] p-4 dark:bg-[#132c41]"><p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-900 dark:text-sky-200">Ringkasan kursus</p><p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{selected.description}</p></div>}
                {validationErrors._form && <p role="alert" className="text-sm text-destructive">{validationErrors._form}</p>}
                {mutation.isError && <p role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"><AlertCircle className="h-4 w-4 shrink-0" />{mutation.error instanceof Error ? mutation.error.message : "Pengaturan belum berhasil disimpan."}</p>}
                {savedNotice && <p role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300"><Check className="h-4 w-4" />{savedNotice}</p>}
                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
                  {draft.published ? <a href={`/courses/${encodeURIComponent(selected.courseId)}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-slate-800">Lihat halaman publik <ExternalLink className="h-4 w-4" /></a> : <span className="text-xs text-slate-500">Pratinjau tersedia setelah publikasi.</span>}
                  <Button onClick={save} disabled={mutation.isPending} className="bg-[#123b63] hover:bg-[#1a527f]"><Save className="mr-2 h-4 w-4" />{mutation.isPending ? "Menyimpan..." : "Simpan pengaturan"}</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
