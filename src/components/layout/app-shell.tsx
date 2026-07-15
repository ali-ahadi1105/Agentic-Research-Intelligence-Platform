"use client";

import { useAuthStore } from "@/stores/auth-store";
import { useAppStore, type ViewKey } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Boxes,
  Quote,
  Network,
  Calendar,
  FileBarChart,
  MessageSquare,
  Settings,
  LogOut,
  Brain,
  ChevronLeft,
  Search,
  CircleUser,
  Shield,
  Bell,
  Sun,
  Moon,
  Lightbulb,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SearchResults } from "@/components/common/search-results";
import type { Workspace } from "@/types";
import { formatFaDate, timeAgo } from "@/lib/fa";
import { hasPermission, getRoleLabel, type ClientPermission } from "@/lib/permissions-client";

const NAV_ITEMS: { view: ViewKey; label: string; icon: React.ElementType; permission?: ClientPermission }[] = [
  { view: "workspace", label: "نمای کلی", icon: LayoutDashboard },
  { view: "documents", label: "اسناد و منابع", icon: FileText, permission: "document.upload" },
  { view: "entities", label: "موجودیت‌ها", icon: Boxes },
  { view: "claims", label: "ادعاها", icon: Quote },
  { view: "graph", label: "گراف دانش", icon: Network },
  { view: "timeline", label: "خط زمانی", icon: Calendar },
  { view: "reports", label: "گزارش‌ها", icon: FileBarChart, permission: "report.generate" },
  { view: "opportunity", label: "تحلیل فرصت", icon: Lightbulb, permission: "report.generate" },
  { view: "chat", label: "گفتگوی هوشمند", icon: MessageSquare, permission: "chat.send" },
  { view: "settings", label: "تنظیمات", icon: Settings },
  { view: "admin", label: "پنل مدیریت", icon: Shield, permission: "admin.access" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, organization, logout } = useAuthStore();
  const { currentWorkspaceId, currentView, setView } = useAppStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const userRole = user?.role || "viewer";
  const { theme, setTheme } = useTheme();

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.workspaces.list,
  });

  const { data: notifData } = useQuery({
    queryKey: ["notifications-summary"],
    queryFn: api.admin.notifications.list,
    refetchInterval: 30000,
  });

  const currentWorkspace = useMemo(
    () => workspaces?.find((w) => w.id === currentWorkspaceId),
    [workspaces, currentWorkspaceId]
  );

  // Poll for source processing status if on documents view
  const qc = useQueryClient();
  useState(() => {
    const interval = setInterval(() => {
      if (currentWorkspaceId) {
        qc.invalidateQueries({ queryKey: ["documents", currentWorkspaceId] });
        qc.invalidateQueries({ queryKey: ["stats", currentWorkspaceId] });
        qc.invalidateQueries({ queryKey: ["entities", currentWorkspaceId] });
        qc.invalidateQueries({ queryKey: ["claims", currentWorkspaceId] });
      }
    }, 4000);
    return () => clearInterval(interval);
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="flex h-14 items-center px-4 lg:px-6 gap-4">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
              <Brain className="size-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm hidden sm:block">پلتفرم تحقیق هوشمند</span>
          </div>

          {organization && (
            <div className="text-xs text-muted-foreground border-r pr-4 mr-2 hidden md:block">
              {organization.name}
            </div>
          )}

          <div className="flex-1" />

          {/* Search */}
          {currentWorkspaceId && (
            <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Search className="size-4" />
                  <span className="hidden sm:inline">جستجو</span>
                  <kbd className="hidden md:inline-flex text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>جستجو در دانش‌نامه</DialogTitle>
                </DialogHeader>
                <SearchResults workspaceId={currentWorkspaceId} />
              </DialogContent>
            </Dialog>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "حالت روشن" : "حالت تاریک"}
          >
            <Sun className="size-4 dark:hidden" />
            <Moon className="size-4 hidden dark:block" />
          </Button>

          {/* Notifications */}
          {notifData && notifData.unreadCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setView("admin")}
              title="اعلان‌ها"
            >
              <Bell className="size-4" />
              <span className="absolute -top-0.5 -left-0.5 size-4 rounded-full bg-accent text-accent-foreground text-[9px] font-bold flex items-center justify-center">
                {notifData.unreadCount > 9 ? "۹+" : notifData.unreadCount}
              </span>
            </Button>
          )}

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2">
                <Avatar className="size-7">
                  <AvatarFallback className="text-xs">
                    {user?.name?.[0] || user?.email[0]?.toUpperCase() || "؟"}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:inline text-sm">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm font-medium">{user?.name}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">{user?.email}</div>
                <div className="mt-1">
                  <span className="inline-block text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {getRoleLabel(userRole)}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hasPermission(userRole, "admin.access") && (
                <DropdownMenuItem onClick={() => setView("admin")}>
                  <Shield className="size-4 ml-2" />
                  پنل مدیریت
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setView("settings")}>
                <Settings className="size-4 ml-2" />
                تنظیمات
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()}>
                <LogOut className="size-4 ml-2" />
                خروج از حساب
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-64 border-l bg-sidebar shrink-0 hidden md:flex flex-col">
          <WorkspaceSelector workspaces={workspaces || []} current={currentWorkspace} />

          <nav className="flex-1 px-3 py-4 space-y-1">
            {currentWorkspaceId ? (
              NAV_ITEMS
                .filter((item) => !item.permission || hasPermission(userRole, item.permission))
                .map((item) => (
                  <button
                    key={item.view}
                    onClick={() => setView(item.view)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-right",
                      currentView === item.view
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                    {item.view === "admin" && notifData && notifData.unreadCount > 0 && (
                      <span className="mr-auto size-2 rounded-full bg-accent" />
                    )}
                  </button>
                ))
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8 px-3">
                یک Workspace انتخاب کنید
              </div>
            )}
          </nav>

          <div className="p-3 border-t">
            <div className="text-xs text-muted-foreground text-center">
              نسخه ۱.۰ · {formatFaDate(new Date())}
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-auto">
          <div className="container mx-auto p-4 lg:p-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      {currentWorkspaceId && (
        <nav className="md:hidden border-t bg-card flex overflow-x-auto">
          {NAV_ITEMS
            .filter((item) => !item.permission || hasPermission(userRole, item.permission))
            .slice(0, 6)
            .map((item) => (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1 py-2 px-2 text-xs shrink-0 min-w-[70px]",
                  currentView === item.view ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            ))}
        </nav>
      )}
    </div>
  );
}

function WorkspaceSelector({
  workspaces,
  current,
}: {
  workspaces: Workspace[];
  current?: Workspace;
}) {
  const { setWorkspace } = useAppStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="p-3 border-b">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-3 py-2 h-auto font-normal"
          >
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Workspace</div>
              <div className="text-sm font-medium truncate max-w-[160px]">
                {current?.name || "انتخاب کنید"}
              </div>
            </div>
            <ChevronLeft className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64" sideOffset={4}>
          <DropdownMenuLabel>Workspaceهای شما</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.length === 0 ? (
            <DropdownMenuItem disabled>Workspaceی وجود ندارد</DropdownMenuItem>
          ) : (
            workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => {
                  setWorkspace(w.id);
                  setOpen(false);
                }}
                className="flex flex-col items-start gap-1"
              >
                <div className="font-medium text-sm">{w.name}</div>
                {w.description && (
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {w.description}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {timeAgo(w.updatedAt)}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
