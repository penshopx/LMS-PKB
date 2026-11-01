export const rejectedPasswords = [
  ["123456", "Kata sandi minimal 12 karakter, tidak termasuk spasi di awal dan akhir."],
  ["a".repeat(11), "Kata sandi minimal 12 karakter, tidak termasuk spasi di awal dan akhir."],
  [" ".repeat(12), "Kata sandi minimal 12 karakter, tidak termasuk spasi di awal dan akhir."],
  [" abcdefghijk ", "Kata sandi minimal 12 karakter, tidak termasuk spasi di awal dan akhir."],
  ["a".repeat(129), "Kata sandi maksimal 128 karakter."],
  ["a".repeat(1000), "Kata sandi maksimal 128 karakter."],
  ["admin123", "Kata sandi tidak memenuhi kebijakan keamanan."],
  ["  admin123  ", "Kata sandi tidak memenuhi kebijakan keamanan."],
  ["password123", "Kata sandi tidak memenuhi kebijakan keamanan."],
  ["admin12345678", "Kata sandi tidak memenuhi kebijakan keamanan."],
  ["  ADMIN12345678  ", "Kata sandi tidak memenuhi kebijakan keamanan."],
] as const;

export const acceptedPasswords = ["abcdefghijkl", "a".repeat(128), " abcdefghijkl "];
