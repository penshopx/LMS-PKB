import { useEffect, useState } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useLogout } from "@/hooks/use-logout";
import { subscribeToAuthChanges } from "@/lib/auth-session";
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
import PublicCoursePage from "@/pages/public-course";
import Register from "@/pages/register";
import CatalogSettingsPage from "@/pages/catalog-settings";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Competencies from "@/pages/competencies";
import Courses from "@/pages/courses";
import Participants from "@/pages/participants";
import Passport from "@/pages/passport";
import LearningPaths from "@/pages/learning-paths";
import Assessment from "@/pages/pkb-guidance";
import Certificates from "@/pages/certificates";
import Quizzes from "@/pages/quizzes";
import PracticeMissions from "@/pages/practice-missions";
import LearningProgramsPage from "@/pages/learning-programs";
import CourseDiscussions from "@/pages/course-discussions";
import DiscussionReportsPage from "@/pages/discussion-reports";
import Analytics from "@/pages/analytics";
import AccessManagement from "@/pages/access";
import AcceptInvitation from "@/pages/accept-invitation";
import { ParticipantHome, PicHome } from "@/pages/role-home";
import { useCurrentUser } from "@/hooks/use-current-user";

const PAGE_TITLES: Record<string, string> = {
  "/app": "Dashboard",
  "/app/competencies": "Kompetensi",
  "/app/courses": "Pembelajaran",
  "/app/learning-paths": "Jalur Pembelajaran",
  "/app/learning-programs": "Rencana Belajar PKB",
  "/app/quizzes": "Quiz Engine",
  "/app/participants": "Peserta",
  "/app/passport": "Competency Passport",
  "/app/assessment": "Panduan PKB",
  "/app/certificates": "Sertifikat",
  "/app/analytics": "Analitik & Laporan",
  "/app/access": "Akun & Undangan PKB",
  "/app/practice-missions": "Misi praktik",
  "/app/catalog-settings": "Katalog publik",
  "/app/discussion-reports": "Laporan diskusi",
};

function AppRouter() {
  const { data: user } = useCurrentUser();
  const [location] = useLocation();
  const discussionMatch = location.match(/^\/app\/discussions\/([^/?#]+)/);
  if (discussionMatch) {
    const courseId = decodeURIComponent(discussionMatch[1]);
    return <CourseDiscussions key={`${courseId}:${user?.id ?? "unknown"}:${user?.role ?? "unknown"}:${user?.bujkId ?? ""}:${user?.participantId ?? ""}`} courseId={courseId} />;
  }
  if (location === "/app/discussion-reports") {
    return user?.role === "bujk_pic"
      ? <NotFound />
      : <DiscussionReportsPage key={`${user?.id ?? "unknown"}:${user?.role ?? "unknown"}`} />;
  }
  if (location === "/app/learning-programs") return <LearningProgramsPage key={user?.id ?? "unknown"} />;
  if (location === "/app/assessment") return <Assessment />;
  if (user?.role === "participant") {
    if (location === "/app/practice-missions") return <PracticeMissions />;
    return location === "/app/quizzes" ? <Quizzes /> : <ParticipantHome />;
  }
  if (user?.role === "bujk_pic") {
    if (location === "/app/practice-missions") return <PracticeMissions />;
    return location === "/app/access" ? <AccessManagement /> : <PicHome />;
  }
  return (
    <Switch>
      <Route path="/app" component={Dashboard} />
      <Route path="/app/competencies" component={Competencies} />
      <Route path="/app/courses" component={Courses} />
      <Route path="/app/catalog-settings" component={CatalogSettingsPage} />
      <Route path="/app/learning-paths" component={LearningPaths} />
      <Route path="/app/learning-programs" component={LearningProgramsPage} />
      <Route path="/app/quizzes" component={Quizzes} />
      <Route path="/app/practice-missions" component={PracticeMissions} />
      <Route path="/app/participants" component={Participants} />
      <Route path="/app/passport" component={Passport} />
      <Route path="/app/assessment" component={Assessment} />
      <Route path="/app/certificates" component={Certificates} />
      <Route path="/app/analytics" component={Analytics} />
      <Route path="/app/access" component={AccessManagement} />
      <Route component={NotFound} />
    </Switch>
  );
}

function UserMenu() {
  const { data: user } = useCurrentUser();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const logoutMutation = useLogout();

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
            <p className="text-xs text-muted-foreground">{user?.role === "admin" ? "Admin" : user?.role === "bujk_pic" ? "Koordinator PKB" : "Peserta"}</p>
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
        key={`${user?.id ?? "signed-out"}:${changePasswordOpen}`}
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </>
  );
}

function AppLayout() {
  const [location] = useLocation();
  const { data: user } = useCurrentUser();
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
            {user?.role === "admin" && <GlobalSearch />}
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
  const { data: user, isLoading, isError, refetch } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    return <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p role="alert">Sesi belum dapat diverifikasi. Periksa koneksi Anda, lalu coba lagi.</p>
      <Button onClick={() => refetch()}>Periksa sesi kembali</Button>
    </main>;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <AppLayout key={`${user.id}:${user.role}:${user.bujkId}:${user.participantId}`} />;
}

function AuthSessionSync() {
  useEffect(subscribeToAuthChanges, []);
  return null;
}

function App() {
  const [location] = useLocation();
  const isLanding = location === "/";
  const isLogin = location === "/login";
  const isRegister = location === "/register";
  const isPublicCourse = /^\/courses\/[^/]+$/.test(location);
  const isApp = location.startsWith("/app");
  const isInvitation = location.startsWith("/invite/");

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionSync />
      <TooltipProvider>
        {isLanding && <Landing />}
        {isLogin && <Login />}
        {isRegister && <Register />}
        {isPublicCourse && <Route path="/courses/:id" component={PublicCoursePage} />}
        {isApp && <ProtectedApp />}
        {isInvitation && <AcceptInvitation key={location} token={location.split("/")[2] ?? ""} />}
        {!isLanding && !isLogin && !isRegister && !isPublicCourse && !isApp && !isInvitation && (
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
