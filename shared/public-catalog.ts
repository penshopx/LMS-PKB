import { z } from "zod";
import { newPasswordSchema } from "./auth-validation";

export const publicRegistrationSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(120),
  email: z.string().trim().email("Email tidak valid.").max(254).transform(value => value.toLowerCase()),
  password: newPasswordSchema,
}).strict();

export const catalogSettingsSchema = z.object({
  published: z.boolean(),
  format: z.enum(["self_paced", "upcoming", "recording"]),
  startsAt: z.string().datetime({ offset: true }).nullable(),
  instructor: z.string().trim().max(160),
  recordingUrl: z.union([z.literal(""), z.string().url().max(2000)
    .refine(value => value.startsWith("https://"), "Tautan rekaman harus menggunakan HTTPS.")]),
}).strict().superRefine((value, context) => {
  if (value.format === "upcoming" && !value.startsAt) {
    context.addIssue({ code: "custom", path: ["startsAt"], message: "Jadwal kelas mendatang wajib diisi." });
  }
  if (value.format === "recording" && !value.recordingUrl) {
    context.addIssue({ code: "custom", path: ["recordingUrl"], message: "Tautan rekaman wajib diisi." });
  }
});

export type CatalogSettings = z.infer<typeof catalogSettingsSchema>;
export interface PublicCourse {
  id: string;
  title: string;
  description: string;
  duration: string;
  targetLevel: string;
  lessonCount: number;
  lessons: { title: string; type: string }[];
  format: CatalogSettings["format"];
  startsAt: string | null;
  instructor: string;
}
