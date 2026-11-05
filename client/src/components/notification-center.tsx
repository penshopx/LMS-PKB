import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import type { Notification } from "@shared/schema";

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "Baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
}

function NotifIcon({ type }: { type: Notification["type"] }) {
  switch (type) {
    case "success": return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
    case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case "error": return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    default: return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
  }
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => apiRequest("PATCH", "/api/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          data-testid="button-notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white" data-testid="badge-unread-count">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="panel-notifications">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifikasi</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs h-5">{unreadCount} baru</Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-3 w-3" />
              Tandai Semua
            </Button>
          )}
        </div>

        <ScrollArea className="h-80">
          {!notifications?.length && (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Tidak ada notifikasi</p>
            </div>
          )}
          {notifications?.map((notif, idx) => (
            <div key={notif.id}>
              {idx > 0 && <Separator />}
              <button
                className={`w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors group ${!notif.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                onClick={() => {
                  if (!notif.isRead) markReadMutation.mutate(notif.id);
                  if (notif.link) {
                    const discussion = /^\/app\/discussions\/([^/?]+)(?:\?|$)/.exec(notif.link);
                    if (discussion) {
                      // Also runs when the same thread URL is opened again.
                      // Reset removes old content and cancels an older permission
                      // request before this navigation authorizes the viewer anew.
                      void queryClient.resetQueries({
                        queryKey: [`/api/courses/${discussion[1]}/discussions`],
                      });
                    }
                    setOpen(false);
                    setLocation(notif.link);
                  }
                }}
                data-testid={`notification-item-${notif.id}`}
              >
                <div className="flex gap-3 items-start">
                  <div className="mt-0.5">
                    <NotifIcon type={notif.type} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-tight ${!notif.isRead ? "font-semibold" : "font-medium"}`}>
                        {notif.title}
                      </p>
                      {!notif.isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className={`text-xs text-muted-foreground mt-0.5 ${notif.category === "system" ? "" : "line-clamp-2"}`}>{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{timeAgo(notif.createdAt)}</p>
                  </div>
                </div>
              </button>
            </div>
          ))}
        </ScrollArea>

        {unreadCount === 0 && (notifications?.length || 0) > 0 && (
          <div className="px-4 py-2 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">Semua notifikasi telah dibaca</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
