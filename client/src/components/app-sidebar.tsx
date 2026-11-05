import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Award,
  FolderOpen,
  Settings,
  Route,
  ClipboardCheck,
  FileCheck,
  FileQuestion,
  BarChart3,
  LogOut,
  ExternalLink,
  ClipboardList,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useLogout } from "@/hooks/use-logout";
import { BrandMark, BRAND_NAME, BRAND_TAGLINE } from "@/components/brand-mark";
import { GUSTAFTA_HOME_URL } from "@/lib/gustafta";
import { trackGustaftaLinkClick } from "@/lib/analytics";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const mainMenu = [
  {
    title: "Dashboard",
    url: "/app",
    icon: LayoutDashboard,
  },
  {
    title: "Analitik & Laporan",
    url: "/app/analytics",
    icon: BarChart3,
  },
  {
    title: "Kompetensi",
    url: "/app/competencies",
    icon: FolderOpen,
  },
  {
    title: "Pembelajaran",
    url: "/app/courses",
    icon: BookOpen,
  },
  {
    title: "Jalur Pembelajaran",
    url: "/app/learning-paths",
    icon: Route,
  },
  {
    title: "Quiz Engine",
    url: "/app/quizzes",
    icon: FileQuestion,
  },
  {
    title: "Misi praktik",
    url: "/app/practice-missions",
    icon: ClipboardList,
  },
];

const managementMenu = [
  {
    title: "Katalog publik",
    url: "/app/catalog-settings",
    icon: BookOpen,
  },
  {
    title: "Akun & Akses",
    url: "/app/access",
    icon: Settings,
  },
  {
    title: "Peserta",
    url: "/app/participants",
    icon: Users,
  },
  {
    title: "Competency Passport",
    url: "/app/passport",
    icon: Award,
  },
];

const certificationMenu = [
  {
    title: "Asesmen & LSP",
    url: "/app/assessment",
    icon: ClipboardCheck,
  },
  {
    title: "Sertifikat",
    url: "/app/certificates",
    icon: FileCheck,
  },
];

const ecosystemMenu = {
  title: "Gustafta",
  url: GUSTAFTA_HOME_URL,
  icon: ExternalLink,
};

function LogoutButton() {
  const logoutMutation = useLogout();

  return (
    <button
      onClick={() => logoutMutation.mutate()}
      disabled={logoutMutation.isPending}
      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors w-full"
    >
      <LogOut className="h-3 w-3" />
      <span>{logoutMutation.isPending ? "Keluar..." : "Keluar"}</span>
    </button>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { data: user } = useCurrentUser();

  if (user && user.role !== "admin") {
    const items = [
      { title: user.role === "participant" ? "Pembelajaran Saya" : "Peserta BUJK", url: "/app", icon: BookOpen },
      { title: "Misi praktik", url: "/app/practice-missions", icon: ClipboardList },
      ...(user.role === "bujk_pic" ? [{ title: "Undang Peserta", url: "/app/access", icon: Users }] : []),
    ];
    return (
      <Sidebar>
        <SidebarHeader className="border-b p-4"><div className="flex items-center gap-3"><BrandMark /><div><p className="font-semibold">{BRAND_NAME}</p><p className="text-xs text-muted-foreground">{user.role === "participant" ? "Akun Peserta" : "PIC BUJK"}</p></div></div></SidebarHeader>
        <SidebarContent>
          <SidebarGroup><SidebarGroupLabel>Menu</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>
            {items.map(item => <SidebarMenuItem key={item.url}><SidebarMenuButton asChild isActive={location === item.url}><Link href={item.url}><item.icon className="h-4 w-4" /><span>{item.title}</span></Link></SidebarMenuButton></SidebarMenuItem>)}
          </SidebarMenu></SidebarGroupContent></SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t p-4"><LogoutButton /></SidebarFooter>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/" data-testid="link-home">
             <div className="flex items-center gap-3">
             <BrandMark />
            <div className="flex flex-col">
                <span className="font-semibold text-base leading-tight">{BRAND_NAME}</span>
               <span className="text-xs text-muted-foreground">{BRAND_TAGLINE}</span>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Utama</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenu.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "") || "dashboard"}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Manajemen</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementMenu.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sertifikasi LSP</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {certificationMenu.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`nav-${item.url.replace("/", "")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Ekosistem Kerja</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-testid="nav-gustafta">
                  <a
                    href={ecosystemMenu.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      trackGustaftaLinkClick({
                        domain: "all",
                        destination: "home",
                        location: "sidebar",
                      })
                    }
                    aria-label="Buka ekosistem Gustafta di tab baru"
                  >
                    <ecosystemMenu.icon className="h-4 w-4" />
                    <span>{ecosystemMenu.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Settings className="h-3 w-3" />
          <span>PKB ASDAMKINDO · Kompetensi Teknik Konstruksi</span>
        </div>
        <LogoutButton />
      </SidebarFooter>
    </Sidebar>
  );
}
