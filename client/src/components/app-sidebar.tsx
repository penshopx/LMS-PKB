import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Award,
  FolderOpen,
  Settings,
  GraduationCap,
  Route,
  ClipboardCheck,
  FileCheck,
  FileQuestion,
  BarChart3
} from "lucide-react";
import { Link, useLocation } from "wouter";
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
    title: "E-Course Builder",
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
];

const managementMenu = [
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

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/" data-testid="link-home">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">E-Course Builder</span>
              <span className="text-xs text-muted-foreground">Ekosistem Kompetensi</span>
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
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Settings className="h-3 w-3" />
          <span>E-Course Builder v1.0</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
