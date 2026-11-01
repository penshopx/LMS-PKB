import { z } from "zod";

export const loginCredentialsSchema = z.object({
  username: z.string().trim().min(1).max(254),
  // Never trim passwords: spaces can be part of an existing password.
  password: z.string().min(1).max(1024),
}).strict();

export const invitationTokenSchema = z.string().min(32).max(256);
export const invitationPasswordSchema = z.string()
  .min(12, "Kata sandi minimal 12 karakter.")
  .max(128, "Kata sandi maksimal 128 karakter.")
  .refine(value => value.trim().length > 0, "Kata sandi tidak boleh hanya berupa spasi.");
export const acceptInvitationSchema = z.object({
  token: invitationTokenSchema,
  password: invitationPasswordSchema,
}).strict();

export const currentUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  role: z.enum(["admin", "participant", "bujk_pic"]),
  participantId: z.string().nullable(),
  bujkId: z.string().nullable(),
}).strict();
export type AuthenticatedUser = z.infer<typeof currentUserSchema>;

export interface InvitationPreview {
  username: string;
  participantName: string | null;
  bujkName: string;
  role: "participant" | "bujk_pic";
  expiresAt: string;
}
