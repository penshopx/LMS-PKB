import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { publicRegistrationSchema } from "@shared/public-catalog";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@shared/auth-validation";
import { BrandMark, BRAND_NAME } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";

function safeNext(value: string | null) {
  if (!value) return "/";
  if (value === "/app") return value;
  if (/^\/courses\/[A-Za-z0-9._~%-]+$/.test(value)) return value;
  return "/";
}

export default function Register() {
  const [, navigate] = useLocation();
  const next = safeNext(new URLSearchParams(window.location.search).get("next"));
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const registerMutation = useMutation({
    mutationFn: async (payload: { name: string; email: string; password: string }) => {
      const response = await apiRequest("POST", "/api/register", payload);
      return response.json() as Promise<{ username: string; message: string }>;
    },
    onSuccess: data => {
      const query = new URLSearchParams({ username: data.username, next });
      navigate(`/login?${query.toString()}`);
    },
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (registerMutation.isPending) return;
    const form = new FormData(event.currentTarget);
    const candidate = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    const parsed = publicRegistrationSchema.safeParse(candidate);
    const confirmation = String(form.get("confirmation") ?? "");
    const errors: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) if (!errors[String(issue.path[0])]) errors[String(issue.path[0])] = issue.message;
    }
    if (candidate.password !== confirmation) errors.confirmation = "Kedua kata sandi harus sama.";
    setFieldErrors(errors);
    if (Object.keys(errors).length || !parsed.success) return;
    registerMutation.mutate(parsed.data);
  }

  return (
    <div className="min-h-[100dvh] bg-[#eff5fa] text-[#142c45] dark:bg-[#081827] dark:text-slate-100">
      <header className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 sm:px-7">
        <Link href="/" className="flex items-center gap-3"><BrandMark size="md" /><span className="text-sm font-bold">{BRAND_NAME}</span></Link><ThemeToggle />
      </header>
      <main className="mx-auto grid max-w-6xl gap-8 px-4 pb-12 pt-5 sm:px-7 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16 lg:py-12">
        <section className="relative hidden min-h-[34rem] overflow-hidden rounded-[1.75rem] bg-[#0d2a45] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div aria-hidden="true" className="absolute -right-28 -top-28 h-96 w-96 rounded-full border border-sky-200/25" />
          <div aria-hidden="true" className="absolute -right-8 top-[-2rem] h-64 w-64 rounded-full border border-sky-200/25" />
          <div className="relative"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Akses publik</p><h1 className="mt-5 max-w-md text-4xl font-bold leading-tight">Belajar praktik bisnis konstruksi, dengan ruang yang tetap terjaga.</h1><p className="mt-5 max-w-md leading-7 text-slate-300">Buat akun pembelajar mandiri untuk menjelajahi kursus yang dibuka oleh PUB ASPEKINDO.</p></div>
          <div className="relative space-y-3">
            {["Ringkasan kursus dapat dijelajahi publik", "Materi belajar tetap tersedia setelah masuk", "Data organisasi tidak ditampilkan di katalog"].map((text, index) => <div key={text} className="flex items-center gap-3 rounded-xl bg-white/8 p-4"><span className="font-mono text-sm text-sky-300">0{index + 1}</span><span className="text-sm text-slate-100">{text}</span></div>)}
          </div>
          <p className="relative flex items-center gap-2 text-xs text-slate-300"><ShieldCheck className="h-4 w-4 text-sky-200" />Akun baru tidak otomatis masuk setelah pendaftaran.</p>
        </section>
        <section className="mx-auto w-full max-w-xl">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-sky-800 hover:text-sky-950 dark:text-sky-300"><ArrowLeft className="h-4 w-4" />Kembali ke katalog</Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-800 dark:text-sky-300">Pendaftaran pembelajar mandiri</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">Buat akun</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Isi data berikut. Setelah berhasil, masuk menggunakan email dan kata sandi Anda.</p>
            <form className="mt-7 space-y-5" onSubmit={submit} noValidate>
              <div className="space-y-2"><Label htmlFor="register-name">Nama lengkap</Label><Input id="register-name" name="name" autoComplete="name" maxLength={120} required disabled={registerMutation.isPending} aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? "register-name-error" : undefined} placeholder="Nama sesuai identitas" />{fieldErrors.name && <p id="register-name-error" className="text-xs text-destructive">{fieldErrors.name}</p>}</div>
              <div className="space-y-2"><Label htmlFor="register-email">Email</Label><Input id="register-email" name="email" type="email" autoComplete="email" autoCapitalize="none" maxLength={254} required disabled={registerMutation.isPending} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? "register-email-error" : undefined} placeholder="nama@contoh.id" />{fieldErrors.email && <p id="register-email-error" className="text-xs text-destructive">{fieldErrors.email}</p>}</div>
              <div className="space-y-2"><Label htmlFor="register-password">Kata sandi</Label><div className="relative"><Input id="register-password" name="password" type={showPassword ? "text" : "password"} className="pr-12" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} required disabled={registerMutation.isPending} aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? "register-password-error register-password-help" : "register-password-help"} /> <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div><p id="register-password-help" className="text-xs leading-5 text-slate-500 dark:text-slate-400">{`Minimal ${PASSWORD_MIN_LENGTH} karakter (di luar spasi awal dan akhir), maksimal ${PASSWORD_MAX_LENGTH} karakter. Hindari kata sandi umum.`}</p>{fieldErrors.password && <p id="register-password-error" className="text-xs text-destructive">{fieldErrors.password}</p>}</div>
              <div className="space-y-2"><Label htmlFor="register-confirmation">Ulangi kata sandi</Label><Input id="register-confirmation" name="confirmation" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} required disabled={registerMutation.isPending} aria-invalid={!!fieldErrors.confirmation} />{fieldErrors.confirmation && <p className="text-xs text-destructive">{fieldErrors.confirmation}</p>}</div>
              {registerMutation.isError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{registerMutation.error instanceof Error ? registerMutation.error.message : "Pendaftaran belum berhasil. Periksa data dan coba lagi."}</p>}
              <Button className="w-full bg-[#123b63] py-5 hover:bg-[#1a527f]" disabled={registerMutation.isPending}>{registerMutation.isPending ? "Membuat akun..." : <>Daftar sekarang <ArrowRight className="ml-2 h-4 w-4" /></>}</Button>
            </form>
            <div className="mt-6 space-y-3 border-t border-slate-200 pt-5 text-sm dark:border-slate-700"><p className="text-slate-600 dark:text-slate-300">Sudah memiliki akun? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-sky-800 underline underline-offset-4 dark:text-sky-300">Masuk</Link></p><p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Peserta atau PIC yang bergabung melalui BUJK tetap menggunakan tautan undangan dari PIC. Pendaftaran ini adalah alternatif untuk pembelajar mandiri.</p></div>
          </div>
        </section>
      </main>
    </div>
  );
}
