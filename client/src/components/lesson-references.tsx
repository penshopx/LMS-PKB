import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AlertCircle, BookMarked, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import type { ECourse, Lesson } from "@shared/schema";
import {
  referenceDocuments,
  referenceUseDisclaimer,
  updateLessonReferencesSchema,
  type LessonReference,
} from "@shared/course-references";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiRequestError, apiRequest, queryClient } from "@/lib/queryClient";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ReferenceDraft = {
  sourceId: string;
  pageStart: string;
  pageEnd: string;
  section: string;
  note: string;
};

function toDraft(reference: LessonReference): ReferenceDraft {
  return {
    sourceId: reference.sourceId,
    pageStart: String(reference.pageStart),
    pageEnd: reference.pageEnd === undefined ? "" : String(reference.pageEnd),
    section: reference.section ?? "",
    note: reference.note,
  };
}

function toReferences(drafts: ReferenceDraft[]) {
  return drafts.map(draft => ({
    sourceId: draft.sourceId,
    ...(draft.pageStart.trim() ? { pageStart: Number(draft.pageStart) } : {}),
    ...(draft.pageEnd.trim() ? { pageEnd: Number(draft.pageEnd) } : {}),
    ...(draft.section.trim() ? { section: draft.section } : {}),
    note: draft.note,
  }));
}

function formatPageCitation(reference: LessonReference) {
  return reference.pageEnd && reference.pageEnd !== reference.pageStart
    ? `Hal. ${reference.pageStart}–${reference.pageEnd}`
    : `Hal. ${reference.pageStart}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 403) return "Akses ditolak. Perubahan rujukan tidak diizinkan untuk akun ini.";
    if (error.status === 400) return error.message || "Rujukan tidak lolos validasi. Periksa kembali isian.";
    if (error.status === 409) return "Rujukan telah diubah oleh pengguna lain. Muat ulang untuk melihat versi terbaru.";
  }
  return error instanceof Error ? error.message : "Rujukan belum dapat disimpan. Silakan coba lagi.";
}

export function LessonReferences({ courseId, lesson }: { courseId: string; lesson: Lesson }) {
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const courseQueryKey = [`/api/courses/${encodeURIComponent(courseId)}`];
  const courseQuery = useQuery<ECourse>({
    queryKey: courseQueryKey,
    enabled: Boolean(currentUser),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const latestLesson = courseQuery.data?.lessons.find(item => item.id === lesson.id);
  const currentReferences = latestLesson?.references ?? [];
  const isCurrentDataReady = Boolean(
    currentUser && latestLesson && !courseQuery.isFetching && !courseQuery.isError,
  );
  const scopeKey = `${courseId}:${lesson.id}:${currentUser?.id ?? "signed-out"}`;
  const [baseline, setBaseline] = useState<LessonReference[]>(lesson.references ?? []);
  const [drafts, setDrafts] = useState<ReferenceDraft[]>(() => (lesson.references ?? []).map(toDraft));
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [validationError, setValidationError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const activeScope = useRef(scopeKey);
  const generation = useRef(0);
  const baseId = useId();
  activeScope.current = scopeKey;

  const saveMutation = useMutation({
    mutationFn: async (input: {
      courseId: string;
      lessonId: string;
      references: LessonReference[];
      expectedReferences: LessonReference[];
      scope: string;
      generation: number;
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/courses/${encodeURIComponent(input.courseId)}/lessons/${encodeURIComponent(input.lessonId)}/references`,
        { references: input.references, expectedReferences: input.expectedReferences },
      );
      return { ...(await response.json()) as { references: LessonReference[] }, input };
    },
    onSuccess: ({ references, input }) => {
      if (activeScope.current !== input.scope || generation.current !== input.generation) return;
      setBaseline(references);
      setDrafts(references.map(toDraft));
      setEditing(false);
      setValidationError("");
      setConflict(false);
      setMessage("Rujukan berhasil disimpan.");
      queryClient.setQueryData<ECourse>(courseQueryKey, course => course
        ? {
            ...course,
            lessons: course.lessons.map(item =>
              item.id === input.lessonId ? { ...item, references } : item,
            ),
          }
        : course);
      void queryClient.invalidateQueries({ queryKey: ["/api/courses"] });
      void queryClient.invalidateQueries({
        queryKey: [`/api/courses/${encodeURIComponent(input.courseId)}`],
        exact: true,
      });
    },
    onError: (error, input) => {
      if (activeScope.current !== input.scope || generation.current !== input.generation) return;
      setMessage(getErrorMessage(error));
      setConflict(error instanceof ApiRequestError && error.status === 409);
    },
  });

  useEffect(() => {
    generation.current += 1;
    const references = lesson.references ?? [];
    activeScope.current = scopeKey;
    setBaseline(references);
    setDrafts(references.map(toDraft));
    setEditing(false);
    setMessage("");
    setValidationError("");
    setConflict(false);
    setIsReloading(false);
    saveMutation.reset();
  }, [courseId, lesson.id, currentUser?.id]);

  useEffect(() => {
    if (!isCurrentDataReady || !latestLesson || editing || isReloading || saveMutation.isPending) return;
    const references = latestLesson.references ?? [];
    setBaseline(references);
    setDrafts(references.map(toDraft));
  }, [isCurrentDataReady, latestLesson, editing, isReloading, saveMutation.isPending]);

  const updateDraft = (index: number, key: keyof ReferenceDraft, value: string) => {
    setDrafts(previous => previous.map((draft, draftIndex) =>
      draftIndex === index ? { ...draft, [key]: value } : draft,
    ));
    setValidationError("");
    setMessage("");
    setConflict(false);
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isCurrentDataReady || isReloading) return;
    const candidate = updateLessonReferencesSchema.safeParse({
      references: toReferences(drafts),
      expectedReferences: baseline,
    });
    if (!candidate.success) {
      setValidationError(candidate.error.issues[0]?.message ?? "Periksa kembali isian rujukan.");
      setMessage("");
      return;
    }
    setValidationError("");
    setMessage("");
    setConflict(false);
    saveMutation.mutate({
      courseId,
      lessonId: lesson.id,
      references: candidate.data.references,
      expectedReferences: candidate.data.expectedReferences,
      scope: scopeKey,
      generation: generation.current,
    });
  };

  const handleCancel = () => {
    setDrafts(baseline.map(toDraft));
    setEditing(false);
    setMessage("");
    setValidationError("");
    setConflict(false);
    saveMutation.reset();
  };

  const reloadReferences = async () => {
    const requestedScope = scopeKey;
    const requestedGeneration = generation.current;
    if (isReloading) return;
    setIsReloading(true);
    setMessage("");
    setConflict(false);
    try {
      const response = await apiRequest("GET", `/api/courses/${encodeURIComponent(courseId)}`);
      const course = await response.json() as ECourse;
      if (activeScope.current !== requestedScope || generation.current !== requestedGeneration) return;
      const currentLesson = course.lessons?.find((item: Lesson) => item.id === lesson.id);
      if (!currentLesson) {
        setMessage("Lesson tidak ditemukan pada data terbaru.");
        return;
      }
      queryClient.setQueryData(courseQueryKey, course);
      const refreshed = currentLesson.references ?? [];
      setBaseline(refreshed);
      setDrafts(refreshed.map(toDraft));
      setEditing(false);
      setValidationError("");
      setMessage("Rujukan terbaru berhasil dimuat.");
    } catch (error) {
      if (activeScope.current === requestedScope && generation.current === requestedGeneration) {
        setMessage(getErrorMessage(error));
      }
    } finally {
      if (activeScope.current === requestedScope && generation.current === requestedGeneration) {
        setIsReloading(false);
      }
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-4 md:p-5" aria-labelledby={`${baseId}-heading`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <BookMarked className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 id={`${baseId}-heading`} className="font-semibold">Rujukan lesson</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Rujukan kontekstual untuk mendukung pembelajaran.
            </p>
          </div>
        </div>
        {isAdmin && !editing && (
          <Button type="button" size="sm" variant="outline" onClick={() => {
            setBaseline(currentReferences);
            setDrafts(currentReferences.map(toDraft));
            setEditing(true);
            setMessage("");
            setValidationError("");
          }} disabled={!isCurrentDataReady || isReloading || saveMutation.isPending}>
            {!isCurrentDataReady ? "Memuat rujukan..." : currentReferences.length ? "Kelola rujukan" : "Tambah rujukan"}
          </Button>
        )}
      </div>

      {currentUser && editing && courseQuery.isError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <span>Data rujukan terbaru gagal dimuat. Draf tetap tersimpan di formulir; simpan dinonaktifkan sampai data berhasil dimuat.</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void courseQuery.refetch()} disabled={courseQuery.isFetching || isReloading}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {courseQuery.isFetching ? "Memuat..." : "Coba lagi"}
          </Button>
        </div>
      )}
      {currentUser && editing && !courseQuery.isError && !isCurrentDataReady && (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          Memperbarui data sumber. Draf tetap dipertahankan dan penyimpanan sementara dinonaktifkan.
        </p>
      )}

      {!currentUser ? (
        <p role={isLoadingUser ? "status" : "alert"} className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          {isLoadingUser ? "Memuat informasi akun…" : "Masuk untuk melihat rujukan lesson."}
        </p>
      ) : !editing && (courseQuery.isError || (courseQuery.data && !latestLesson && !courseQuery.isFetching)) ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <span>{courseQuery.isError ? "Rujukan terbaru tidak dapat dimuat." : "Lesson ini tidak ditemukan pada data kursus terbaru."}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void courseQuery.refetch()} disabled={courseQuery.isFetching}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {courseQuery.isFetching ? "Memuat..." : "Coba lagi"}
          </Button>
        </div>
      ) : !editing && !isCurrentDataReady ? (
        <p role="status" aria-live="polite" className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
          Memuat rujukan terbaru dari kursus…
        </p>
      ) : !editing ? (
        <>
          {currentReferences.length ? (
            <div className="space-y-2">
              {currentReferences.map((reference, index) => {
                const document = referenceDocuments.find(item => item.id === reference.sourceId);
                if (!document) return null;
                return (
                  <article key={`${reference.sourceId}-${index}`} className="rounded-lg border bg-background/70 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{document.kind}</Badge>
                      <span className="text-sm font-medium">{document.title}</span>
                      <span className="text-xs text-muted-foreground">{formatPageCitation(reference)}</span>
                    </div>
                    {reference.section && <p className="mt-2 text-sm"><span className="font-medium">Bagian:</span> {reference.section}</p>}
                    <p className="mt-2 text-sm leading-6 text-foreground/90">
                      <span className="font-medium">Catatan relevansi (interpretasi pembelajaran):</span>{" "}
                      {reference.note}
                    </p>
                    <p className="mt-2 border-l-2 border-amber-500/60 pl-2 text-xs leading-5 text-muted-foreground">
                      <span className="font-medium text-foreground/80">Perhatian:</span> {document.caution}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              Belum ada rujukan yang dicantumkan untuk lesson ini.
            </p>
          )}
        </>
      ) : (
        <form className="space-y-4" onSubmit={handleSave} noValidate>
          <p className="text-xs text-muted-foreground">
            Pilih dokumen, cantumkan halaman dan jelaskan kaitannya dengan lesson. Maksimal 12 rujukan.
          </p>
          {drafts.map((draft, index) => {
            const document = referenceDocuments.find(item => item.id === draft.sourceId);
            const fieldId = `${baseId}-reference-${index}`;
            return (
              <fieldset key={index} disabled={!isCurrentDataReady || saveMutation.isPending || isReloading} className="space-y-3 rounded-lg border bg-background/70 p-3 disabled:opacity-70">
                <legend className="sr-only">Rujukan {index + 1}</legend>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">Rujukan {index + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setDrafts(items => items.filter((_, itemIndex) => itemIndex !== index));
                      setMessage("");
                      setValidationError("");
                    }}
                    aria-label={`Hapus rujukan ${index + 1}`}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" /> Hapus
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor={`${fieldId}-source`} className="text-sm font-medium">Dokumen sumber</label>
                    <select
                      id={`${fieldId}-source`}
                      value={draft.sourceId}
                      onChange={event => updateDraft(index, "sourceId", event.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {referenceDocuments.map(item => (
                        <option key={item.id} value={item.id}>{item.title} · {item.kind}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`${fieldId}-start`} className="text-sm font-medium">Halaman mulai</label>
                    <Input
                      id={`${fieldId}-start`}
                      type="number"
                      min={1}
                      max={document?.pages}
                      step={1}
                      inputMode="numeric"
                      value={draft.pageStart}
                      onChange={event => updateDraft(index, "pageStart", event.target.value)}
                      placeholder="Contoh: 12"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`${fieldId}-end`} className="text-sm font-medium">Halaman akhir <span className="font-normal text-muted-foreground">(opsional)</span></label>
                    <Input
                      id={`${fieldId}-end`}
                      type="number"
                      min={1}
                      max={document?.pages}
                      step={1}
                      inputMode="numeric"
                      value={draft.pageEnd}
                      onChange={event => updateDraft(index, "pageEnd", event.target.value)}
                      placeholder="Kosongkan jika satu halaman"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor={`${fieldId}-section`} className="text-sm font-medium">Bagian <span className="font-normal text-muted-foreground">(opsional)</span></label>
                    <Input
                      id={`${fieldId}-section`}
                      value={draft.section}
                      onChange={event => updateDraft(index, "section", event.target.value)}
                      maxLength={200}
                      placeholder="Judul bagian atau subbab"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label htmlFor={`${fieldId}-note`} className="text-sm font-medium">Catatan relevansi <span className="text-destructive">*</span></label>
                    <Textarea
                      id={`${fieldId}-note`}
                      value={draft.note}
                      onChange={event => updateDraft(index, "note", event.target.value)}
                      maxLength={1500}
                      rows={3}
                      required
                      placeholder="Jelaskan hubungan sumber dengan materi lesson."
                    />
                    <p className="text-xs text-muted-foreground">Interpretasi untuk pembelajaran · {draft.note.length}/1500 karakter</p>
                  </div>
                </div>
                {document && (
                  <p className="border-l-2 border-amber-500/60 pl-2 text-xs leading-5 text-muted-foreground">
                    <span className="font-medium text-foreground/80">Perhatian untuk sumber ini:</span> {document.caution}
                  </p>
                )}
              </fieldset>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setDrafts(items => [...items, {
                  sourceId: referenceDocuments[0].id,
                  pageStart: "",
                  pageEnd: "",
                  section: "",
                  note: "",
                }]);
                setValidationError("");
                setMessage("");
              }}
              disabled={!isCurrentDataReady || drafts.length >= 12 || saveMutation.isPending || isReloading}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Tambah sumber
            </Button>
            <span className="text-xs text-muted-foreground">{drafts.length}/12 rujukan</span>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            <Button type="button" variant="ghost" onClick={handleCancel} disabled={saveMutation.isPending || isReloading}>
              Batal
            </Button>
            <Button type="submit" disabled={!isCurrentDataReady || saveMutation.isPending || isReloading}>
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? "Menyimpan..." : "Simpan rujukan"}
            </Button>
          </div>
        </form>
      )}

      <p className="rounded-md bg-amber-50/80 px-3 py-2 text-xs leading-5 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
        {referenceUseDisclaimer}
      </p>

      {(validationError || message) && (
        <div
          role={validationError || conflict ? "alert" : "status"}
          aria-live={validationError || conflict ? "assertive" : "polite"}
          className={`flex flex-wrap items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            validationError || conflict
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-primary/20 bg-primary/5 text-foreground"
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{validationError || message}</span>
          {conflict && (
            <Button type="button" variant="outline" size="sm" onClick={reloadReferences} disabled={isReloading || saveMutation.isPending}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Muat ulang
            </Button>
          )}
        </div>
      )}
      {isReloading && (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">Memuat rujukan terbaru…</p>
      )}
    </section>
  );
}
