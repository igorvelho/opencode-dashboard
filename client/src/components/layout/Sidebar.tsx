import { Link, useLocation } from "react-router-dom";
import {
  Sidebar as SidebarRoot,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Sparkles,
  Terminal,
  Bot,
  Server,
  KeyRound,
  FileCode,
  Archive,
  Settings,
  FolderOpen,
  BarChart2,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";

const navItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Metrics", path: "/metrics", icon: BarChart2 },
  { label: "Skills", path: "/skills", icon: Sparkles },
  { label: "Commands", path: "/commands", icon: Terminal },
  { label: "Agents", path: "/agents", icon: Bot },
  { label: "MCP Servers", path: "/mcp-servers", icon: Server },
  { label: "Providers & Models", path: "/providers", icon: KeyRound },
  { label: "Config Editor", path: "/config", icon: FileCode },
  { label: "Backup & Restore", path: "/backup", icon: Archive },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();

  function isActive(path: string) {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  }

  return (
    <SidebarRoot collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            OC
          </div>
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
            OpenCode Dashboard
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive(item.path)}
                    tooltip={item.label}
                    render={<Link to={item.path} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Link
          to="/settings"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-sidebar-accent transition-colors"
          title={currentWorkspace ? `${currentWorkspace.name} — ${currentWorkspace.configPath}` : "No workspace selected"}
        >
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate font-medium text-sm leading-tight">
              {currentWorkspace?.name ?? "No workspace"}
            </p>
            <p className="truncate text-xs text-muted-foreground leading-tight">
              {currentWorkspace?.configPath ?? "Go to Settings to configure"}
            </p>
          </div>
        </Link>
      </SidebarFooter>
      <SidebarRail />
    </SidebarRoot>
  );
}
