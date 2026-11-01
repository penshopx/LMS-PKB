import { describe, expect, it } from "vitest";
import {
  acceptInvitationSchema, invitationPasswordSchema, loginCredentialsSchema,
  newPasswordSchema, PASSWORD_POLICY_MESSAGE,
} from "@shared/auth-validation";
import { acceptedPasswords, rejectedPasswords } from "./helpers/password-policy";

describe("one password policy for registration and replacement", () => {
  it("uses one schema for both flows", () => {
    expect(invitationPasswordSchema).toBe(newPasswordSchema);
  });

  it.each(rejectedPasswords)("rejects %j with the same message in both flows", (password, message) => {
    for (const schema of [invitationPasswordSchema, newPasswordSchema]) {
      const result = schema.safeParse(password);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0].message).toBe(message);
    }
  });

  it.each(acceptedPasswords)("accepts valid boundary %j without transforming the credential", password => {
    expect(invitationPasswordSchema.parse(password)).toBe(password);
    expect(newPasswordSchema.parse(password)).toBe(password);
    expect(acceptInvitationSchema.parse({ token: "a".repeat(64), password }).password).toBe(password);
  });

  it("does not identify which historical or common weak password was matched", () => {
    for (const password of ["admin123", "password123", "admin12345678", " ADMIN12345678 "]) {
      const result = newPasswordSchema.safeParse(password);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(PASSWORD_POLICY_MESSAGE);
        expect(result.error.issues[0].message).not.toContain(password.trim());
      }
    }
  });

  it("keeps login compatible with existing short passwords and preserves boundary spaces", () => {
    for (const password of ["short6", "admin123", " current-password "]) {
      expect(loginCredentialsSchema.parse({ username: "existing-user", password }).password).toBe(password);
    }
  });
});
