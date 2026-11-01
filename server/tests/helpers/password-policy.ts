export const rejectedPasswords = [
  ["123456", "Password baru minimal 12 karakter, tidak termasuk spasi di awal dan akhir."],
  ["a".repeat(11), "Password baru minimal 12 karakter, tidak termasuk spasi di awal dan akhir."],
  [" ".repeat(12), "Password baru minimal 12 karakter, tidak termasuk spasi di awal dan akhir."],
  [" abcdefghijk ", "Password baru minimal 12 karakter, tidak termasuk spasi di awal dan akhir."],
  ["a".repeat(129), "Password baru maksimal 128 karakter."],
  ["admin123", "Password baru tidak boleh menggunakan password bawaan lama."],
  ["  admin123  ", "Password baru tidak boleh menggunakan password bawaan lama."],
] as const;

export const acceptedPasswords = ["abcdefghijkl", "a".repeat(128), " abcdefghijkl "];
