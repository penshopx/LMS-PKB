import { useState } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { NotificationCenter } from "@/components/notification-center";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { UserCircle, KeyRound, LogOut } from "lucide-react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Competencies from "@/pages/competencies";
import Courses from "@/pages/courses";
import Participants from "@/pages/participants";
import Passport from "@/pages/passport";
import LearningPaths from "@/pages/learning-paths";
import Assessment from "@/pages/assessment";
import Certificates from "@/pages/certificates";
import Quizzes from "@/pages/quizzes";
import Analytics from "@/pages/analytics";

const PAGE_TITLES: Record<string, string> = {
  "/app": "Dashboard",
  "/app/competencies": "Kompetensi",
  "/app/courses": "E-Course Builder",
  "/app/learning-paths": "Jalur Pembelajaran",
  "/app/quizzes": "Quiz Engine",
  "/app/participants": "Peserta",
  "/app/passport": "Competency Passport",
  "/app/assessment": "Asesmen & LSP",
  "/app/certificates": "Sertifikat",
  "/app/analytics": "Analitik & Laporan",
};

function useCurrentUser() {
  return useQuery({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const res = await fetch("/api/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json() as Promise<{ id: string; username: string }>;
    },
    retry: false,
    staleTime: 60_000,
  });
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/app" component={Dashboard} />
      <Route path="/app/competencies" component={Competencies} />
      <Route path="/app/courses" component={Courses} />
      <Route path="/app/learning-paths" component={LearningPaths} />
      <Route path="/app/quizzes" component={Quizzes} />
      <Route path="/app/participants" component={Participants} />
      <Route path="/app/passport" component={Passport} />
      <Route path="/app/assessment" component={Assessment} />
      <Route path="/app/certificates" component={Certificates} />
      <Route path="/app/analytics" component={Analytics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function UserMenu() {
  const { data: user } = useCurrentUser();
  const [, navigate] = useLocation();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/logout", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Logout gagal");
    },
    onSuccess: () => {
      queryClient.clear();
      navigate("/login");
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            data-testid="button-user-menu"
          >
            <UserCircle className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" data-testid="menu-user">
          <DropdownMenuLabel className="font-normal">
            <p className="text-xs text-muted-foreground">Masuk sebagai</p>
            <p className="font-semibold text-sm truncate" data-testid="text-username">{user?.username}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setChangePasswordOpen(true)}
            data-testid="menu-item-change-password"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            Ganti Password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="text-destructive focus:text-destructive"
            data-testid="menu-item-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </>
  );
}

function AppLayout() {
  const [location] = useLocation();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };
  const pageTitle = PAGE_TITLES[location] || "";

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex h-14 items-center gap-3 px-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            {pageTitle && (
              <span className="text-sm font-semibold text-foreground hidden sm:block" data-testid="text-page-title">
                {pageTitle}
              </span>
            )}
            <div className="flex-1" />
            <GlobalSearch />
            <NotificationCenter />
            <ThemeToggle />
            <UserMenu />
          </header>
          <main className="flex-1 overflow-auto">
            <AppRouter />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function ProtectedApp() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <AppLayout />;
}

function App() {
  const [location] = useLocation();
  const isLanding = location === "/";
  const isLogin = location === "/login";
  const isApp = location.startsWith("/app");

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {isLanding && <Landing />}
        {isLogin && <Login />}
        {isApp && <ProtectedApp />}
        {!isLanding && !isLogin && !isApp && (
          <Switch>
            <Route component={NotFound} />
          </Switch>
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
