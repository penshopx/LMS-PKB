import { z } from "zod";

export const loginCredentialsSchema = z.object({
  username: z.string().trim().min(1).max(254),
  // Never trim passwords: spaces can be part of an existing password.
  password: z.string().min(1).max(1024),
}).strict();

export const invitationTokenSchema = z.string().min(32).max(256);
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const LEGACY_DEFAULT_PASSWORD = "admin123";
export const PASSWORD_POLICY_MESSAGE = "Kata sandi tidak memenuhi kebijakan keamanan.";
export const PASSWORD_UNCHANGED_MESSAGE = "Kata sandi baru harus berbeda dari kata sandi saat ini.";
const disallowedPasswords = new Set([LEGACY_DEFAULT_PASSWORD, "password123", "password123456", "admin12345678"]);
export const newPasswordSchema = z.string()
  .refine(value => !disallowedPasswords.has(value.trim().toLowerCase()),
    PASSWORD_POLICY_MESSAGE)
  .refine(value => value.trim().length >= PASSWORD_MIN_LENGTH,
    `Kata sandi minimal ${PASSWORD_MIN_LENGTH} karakter, tidak termasuk spasi di awal dan akhir.`)
  .refine(value => value.length <= PASSWORD_MAX_LENGTH,
    `Kata sandi maksimal ${PASSWORD_MAX_LENGTH} karakter.`);

// Registration and password changes must use the exact same policy.
// Validation never transforms the password that will be hashed.
export const invitationPasswordSchema = newPasswordSchema;
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
