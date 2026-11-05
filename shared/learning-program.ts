import { z } from "zod";

export function learningDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function dayOffset(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export const learningDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus berformat YYYY-MM-DD.")
  .refine(value => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Tanggal tidak valid.");

export const learningProgramFields = z.object({
  title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(120),
  description: z.string().trim().max(2000).default(""),
  courseId: z.string().min(1).max(200),
  dueDate: learningDateSchema,
}).strict();

export const assignedProgramInput = learningProgramFields.extend({
  participantIds: z.array(z.string().min(1).max(200)).max(500).default([]),
  groupIds: z.array(z.string().min(1).max(200)).max(100).default([]),
}).strict();

export const updateLearningProgramInput = learningProgramFields.omit({ courseId: true }).partial()
  .refine(value => Object.keys(value).length > 0, "Tidak ada perubahan.");

export type LearningStatus = "not_started" | "in_progress" | "due_soon" | "overdue" | "completed" | "canceled";
export const LEARNING_STATUS_LABELS: Record<LearningStatus, string> = {
  not_started: "Belum mulai", in_progress: "Sedang belajar", due_soon: "Segera jatuh tempo",
  overdue: "Terlambat", completed: "Selesai", canceled: "Dibatalkan",
};

export function learningStatus(input: {
  dueDate: string; canceledAt: string | null; enrollmentStatus?: string | null; progress?: number;
}, today = learningDay()): LearningStatus {
  // 100% lesson progress alone must not bypass the existing post-test rule.
  if (input.enrollmentStatus === "completed") return "completed";
  if (input.canceledAt) return "canceled";
  if (input.dueDate < today) return "overdue";
  if (input.dueDate <= dayOffset(today, 3)) return "due_soon";
  return (input.progress ?? 0) > 0 || input.enrollmentStatus === "in_progress" ? "in_progress" : "not_started";
}

export interface LearningProgramMember {
  id: string;
  participantId: string;
  participantName: string;
  unit: string;
  progress: number;
  status: LearningStatus;
  completedAt: string | null;
  lastAccessedAt: string | null;
}

export interface LearningProgramView {
  id: string;
  title: string;
  description: string;
  courseId: string;
  courseTitle: string;
  courseArchived: boolean;
  dueDate: string;
  source: "assigned" | "personal";
  canceledAt: string | null;
  createdAt: string;
  members: LearningProgramMember[];
}
