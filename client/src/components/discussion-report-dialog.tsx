import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type ReportTarget = { threadId: string; replyId?: string; label: string };

export function DiscussionReportDialog({
  target,
  onOpenChange,
}: {
  target: ReportTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submittingRef = useRef(false);
  const reportMutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error("Pilih konten yang ingin dilaporkan.");
      return apiRequest("POST", `/api/discussions/${encodeURIComponent(target.threadId)}/reports`, {
        reason: reason.trim(),
        ...(target.replyId ? { replyId: target.replyId } : {}),
      });
    },
    onSuccess: () => setSubmitted(true),
    onSettled: () => { submittingRef.current = false; },
  });
  const submitReport = () => {
    if (submittingRef.current || reportMutation.isPending) return;
    submittingRef.current = true;
    reportMutation.mutate();
  };

  const close = (open: boolean) => {
    if (open || reportMutation.isPending) return;
    setReason("");
    setSubmitted(false);
    reportMutation.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{submitted ? "Laporan terkirim" : "Laporkan konten diskusi"}</DialogTitle>
          <DialogDescription>
            {submitted
              ? "Laporan Anda tersimpan secara privat dan akan ditinjau oleh admin. Alasan tidak ditampilkan kepada peserta lain."
              : "Jelaskan dengan singkat mengapa konten ini perlu ditinjau. Laporan hanya dapat dibaca oleh Anda dan admin; jangan kutip isi yang bersifat pribadi."}
          </DialogDescription>
        </DialogHeader>
        {submitted ? (
          <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-sm leading-6" role="status">
            Terima kasih telah membantu menjaga ruang belajar tetap aman dan relevan.
          </div>
        ) : (
          <>
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
              {target?.replyId ? "Tanggapan pada topik" : "Pertanyaan"}: <span className="font-medium text-foreground">{target?.label}</span>
            </p>
            <Textarea
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder="Tuliskan alasan yang jelas (10–1.000 karakter)"
              aria-label="Alasan laporan"
              aria-describedby="report-reason-help"
              maxLength={1000}
              className="min-h-28 resize-y"
              autoFocus
            />
            <div className="flex items-center justify-between gap-3">
              <p id="report-reason-help" className="text-xs text-muted-foreground">Minimal 10 dan maksimal 1.000 karakter.</p>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{reason.length}/1.000</span>
            </div>
            {reportMutation.isError && (
              <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {reportMutation.error instanceof Error
                  ? reportMutation.error.message
                  : "Laporan gagal dikirim. Periksa koneksi dan coba lagi."}
              </p>
            )}
          </>
        )}
        <DialogFooter>
          {submitted ? (
            <Button onClick={() => close(false)}>Selesai</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)} disabled={reportMutation.isPending}>Batal</Button>
              <Button
                onClick={submitReport}
                disabled={reportMutation.isPending || reason.trim().length < 10 || reason.trim().length > 1000}
              >
                <Flag className="mr-2 h-4 w-4" />
                {reportMutation.isPending ? "Mengirim laporan..." : "Kirim laporan"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
