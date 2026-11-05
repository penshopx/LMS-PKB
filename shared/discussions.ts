import { z } from "zod";

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
