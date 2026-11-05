import { z } from "zod";

export const reportStatusLabels = {
  open: "Baru", reviewing: "Ditinjau", resolved: "Selesai", dismissed: "Tidak ditindaklanjuti",
} as const;
export const reportStatus = z.enum(["open", "reviewing", "resolved", "dismissed"]);
export const reportInput = z.object({
  reason: z.string().trim().min(10, "Alasan minimal 10 karakter.").max(1000),
  replyId: z.string().uuid().optional(),
}).strict();
export const reportHandlingInput = z.object({
  status: reportStatus,
  adminNote: z.string().trim().max(1000).default(""),
}).strict().refine(data => !["resolved", "dismissed"].includes(data.status) || data.adminNote.length >= 5, {
  message: "Catatan penanganan minimal 5 karakter untuk menutup laporan.", path: ["adminNote"],
});
export interface DiscussionReport {
  id: string;
  threadId: string;
  replyId: string | null;
  reason: string;
  status: z.infer<typeof reportStatus>;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  courseId: string | null;
  threadTitle: string | null;
  targetBody: string | null;
  targetHidden: boolean | null;
  reporterName: string | null;
}

export const questionInput = z.object({
  title: z.string().trim().min(5, "Judul minimal 5 karakter.").max(160),
  body: z.string().trim().min(10, "Pertanyaan minimal 10 karakter.").max(5000),
}).strict();
export const replyInput = z.object({ body: z.string().trim().min(1).max(5000) }).strict();
export const moderationInput = z.object({
  hidden: z.boolean(),
  reason: z.string().trim().min(5, "Alasan minimal 5 karakter.").max(300),
}).strict();

export interface DiscussionPost {
  id: string;
  authorName: string;
  body: string;
  hidden: boolean;
  moderationReason: string | null;
  helpful: boolean;
  createdAt: string;
}
export interface DiscussionThread {
  id: string;
  courseId: string;
  title: string;
  body: string;
  authorName: string;
  scopeLabel: string;
  hidden: boolean;
  moderationReason: string | null;
  createdAt: string;
  replies: DiscussionPost[];
}
export interface DiscussionView {
  courseTitle: string;
  canPost: boolean;
  isAdmin: boolean;
  scopeLabel: string;
  threads: DiscussionThread[];
}
