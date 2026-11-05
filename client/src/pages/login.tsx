import { useEffect, useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, ApiRequestError } from "@/lib/queryClient";
import { formatLoginWait } from "@/lib/retry-after";
import { clearLoginCooldown, loginCooldownSeconds, readLoginCooldown, startLoginCooldown } from "@/lib/login-cooldown";
import { replaceSessionUser } from "@/lib/auth-session";
import { useCurrentUser } from "@/hooks/use-current-user";
import { currentUserSchema, loginCredentialsSchema } from "@shared/auth-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark, BRAND_NAME, BRAND_TAGLINE } from "@/components/brand-mark";
import { courseEntryDestination } from "@/lib/course-entry";

export default function Login() {
  const [, navigate] = useLocation();
  const { data: user } = useCurrentUser();
  const [username, setUsername] = useState(() => new URLSearchParams(window.location.search).get("username")?.slice(0, 254) ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [retryUntil, setRetryUntil] = useState<number | null>(() => readLoginCooldown());
  const [remainingSeconds, setRemainingSeconds] = useState(() => loginCooldownSeconds(retryUntil));

  useEffect(() => {
    if (retryUntil === null) return;
    const update = () => {
      const remaining = loginCooldownSeconds(retryUntil);
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        clearLoginCooldown();
        setRetryUntil(null);
      }
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [retryUntil]);

  const loginMutation = useMutation({
    mutationFn: async (creds: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/login", creds);
      const current = currentUserSchema.parse(await res.json());
      await replaceSessionUser(current);
      return current;
    },
    onSuccess: (data) => {
      clearLoginCooldown();
      setPassword("");
      navigate(courseEntryDestination());
    },
    onError: (err: Error) => {
      if (err instanceof ApiRequestError && err.status === 429 && err.retryAfterSeconds) {
        const until = startLoginCooldown(err.retryAfterSeconds);
        setRemainingSeconds(loginCooldownSeconds(until));
        setRetryUntil(until);
        setErrorMsg("");
        return;
      }
      setErrorMsg(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginMutation.isPending || (retryUntil !== null && Date.now() < retryUntil)) return;
    setErrorMsg("");
    clearLoginCooldown();
    setRetryUntil(null);
    const input = loginCredentialsSchema.safeParse({ username, password });
    if (!input.success) {
      setErrorMsg("Username dan password wajib diisi");
      return;
    }
    loginMutation.mutate(input.data);
  };

  if (user) return <Redirect to={courseEntryDestination()} />;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-sky-50 to-blue-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
         <div className="flex items-center gap-3">
            <BrandMark size="md" />
           <div className="flex flex-col">
             <span className="font-bold text-sm sm:text-lg leading-tight text-foreground">{BRAND_NAME}</span>
             <span className="text-xs text-muted-foreground">{BRAND_TAGLINE}</span>
           </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Login Card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <Card className="w-full max-w-sm shadow-lg">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Masuk</CardTitle>
            <CardDescription>
              Gunakan email terdaftar atau username dan kata sandi Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Email atau username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Email atau username"
                  name="username"
                  required
                  maxLength={254}
                  autoCapitalize="none"
                  spellCheck={false}
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loginMutation.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  className="pr-12"
                  required
                  maxLength={1024}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginMutation.isPending}
                />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0"
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                </div>
              </div>

              {errorMsg && (
                <div role="alert" className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {remainingSeconds > 0 && (
                <p role="status" className="text-sm text-muted-foreground">
                  Terlalu banyak percobaan login. Coba lagi dalam {formatLoginWait(remainingSeconds)}.
                </p>
              )}

              <Button
                type="submit"
                className="w-full bg-sky-500 hover:bg-sky-600 text-white"
                disabled={loginMutation.isPending || remainingSeconds > 0}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Masuk...
                  </>
                ) : (
                  remainingSeconds > 0 ? `Tunggu ${formatLoginWait(remainingSeconds)}` : "Masuk"
                )}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Belum punya akun?{" "}
              <Link className="font-medium text-primary underline" href={`/register?next=${encodeURIComponent(courseEntryDestination())}`}>
                Daftar sekarang
              </Link>
            </p>
            <p className="mt-5 text-sm text-muted-foreground">
              Belum punya akun? Buka tautan undangan dari PIC BUJK untuk mendaftar.
              Jika lupa kata sandi atau undangan kedaluwarsa, hubungi PIC BUJK atau admin.
            </p>
            <Link href="/" className="mt-3 inline-block text-sm text-sky-700 underline dark:text-sky-300">Kembali ke beranda</Link>
          </CardContent>
        </Card>
      </div>

      <footer className="text-center py-4 text-xs text-muted-foreground">
        PKB ASDAMKINDO · Kompetensi Teknik Konstruksi
      </footer>
    </div>
  );
}
