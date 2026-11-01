import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatPracticeDate, practiceDueStatus, type PracticeReminder } from "@shared/practice-missions";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const PRACTICE_REMINDERS_KEY = ["/api/practice-missions/reminders"];

export function PracticeReminders() {
  const { data: user } = useCurrentUser();
  const [now, setNow] = useState(() => new Date());
  const enabled = user?.role === "participant" && Boolean(user.participantId);
  const { data = [], isLoading, isError, refetch } = useQuery<PracticeReminder[]>({
    // Account-scoped cache as well as server-side isolation.
    queryKey: [...PRACTICE_REMINDERS_KEY, user?.id],
    queryFn: async () => (await apiRequest("GET", PRACTICE_REMINDERS_KEY[0])).json(),
    enabled, staleTime: 0, refetchInterval: 60_000, refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  if (!enabled) return null;
  const labels = { overdue: "Terlewat", today: "Hari ini", upcoming: "Mendatang" };
  return <Card>
    <CardHeader>
      <CardTitle>Pengingat latihan ulang</CardTitle>
      <CardDescription>Jadwal berdasarkan WIB (Asia/Jakarta, UTC+7). Pengingat selesai setelah Anda mengirim putaran baru.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {isLoading && <p role="status" className="text-sm text-muted-foreground">Memuat jadwal latihan...</p>}
      {isError ? <div role="alert" className="text-sm text-destructive">Pengingat gagal dimuat. <button onClick={() => refetch()} className="underline">Coba lagi</button></div> :
        !isLoading && data.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada jadwal latihan ulang yang perlu ditindaklanjuti.</p> :
          data.map(reminder => {
            const status = practiceDueStatus(reminder.nextPracticeAt, now);
            return <div key={reminder.submissionId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div>
                <p className="font-medium">{reminder.missionTitle}</p>
                <p className="mt-1 text-sm text-muted-foreground">Tindak lanjut putaran {reminder.round} · {formatPracticeDate(reminder.nextPracticeAt)} WIB</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={status === "overdue" ? "destructive" : status === "today" ? "default" : "secondary"}>{labels[status]}</Badge>
                <Button asChild variant="outline"><Link href="/app/practice-missions">Buka misi praktik</Link></Button>
              </div>
            </div>;
          })}
    </CardContent>
  </Card>;
}
