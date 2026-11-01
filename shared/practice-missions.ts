import { z } from "zod";

export const missionInputSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(5).max(180),
  objective: z.string().trim().min(15).max(1200),
  scenario: z.string().trim().min(30).max(6000),
  sourceText: z.string().trim().max(12000).default(""),
  durationMinutes: z.number().int().min(5).max(15),
  checklist: z.array(z.string().trim().min(3).max(300)).min(1).max(12)
    .refine(items => new Set(items).size === items.length, "Checklist tidak boleh duplikat."),
});

export const missionSubmissionSchema = z.object({
  submissionKey: z.string().uuid(),
  completedChecklist: z.array(z.string().max(300)).max(12),
  evidenceText: z.string().trim().min(30).max(6000),
  evidenceUrl: z.union([z.literal(""), z.string().url().max(2000).refine(url => url.startsWith("https://"), "Gunakan tautan HTTPS.")]).default(""),
  privateReflection: z.string().trim().max(6000).default(""),
});

export const missionReviewSchema = z.object({
  status: z.enum(["accepted", "repeat_requested"]),
  feedback: z.string().trim().min(10).max(6000),
  nextPracticeAt: z.string().date().nullable().default(null),
}).refine(data => data.status !== "repeat_requested" || Boolean(data.nextPracticeAt), {
  message: "Tentukan tanggal pengulangan untuk misi yang perlu diulang.",
  path: ["nextPracticeAt"],
});

export interface PracticeMission {
  id: string;
  courseId: string | null;
  courseTitle: string | null;
  title: string;
  objective: string;
  scenario: string;
  sourceText: string;
  durationMinutes: number;
  checklist: string[];
  active: boolean;
  createdAt: string;
}

export interface MissionSubmission {
  id: string;
  missionId: string;
  missionTitle: string;
  participantId: string;
  participantName: string;
  round: number;
  completedChecklist: string[];
  evidenceText: string;
  evidenceUrl: string;
  /** Omitted from every PIC response. */
  privateReflection?: string;
  status: "pending_review" | "accepted" | "repeat_requested";
  feedback: string | null;
  nextPracticeAt: string | null;
  submittedAt: string;
  reviewedAt: string | null;
}
