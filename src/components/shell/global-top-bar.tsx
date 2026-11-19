"use client";

import * as React from "react";
import type { MembershipRole } from "@prisma/client";
import {
  Bug,
  CheckSquare,
  ChevronDown,
  Clock,
  Flag,
  FolderKanban,
  Laptop,
  Menu,
  Moon,
  Plus,
  Receipt,
  Settings,
  Sun,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";

import {
  AppSwitcherSidebar,
  type SidebarOrgOption,
  type SidebarUserSummary,
} from "@/components/shell/app-switcher-sidebar";
import { GlobalSearchCommand } from "@/components/shell/global-search-command";
import { NotificationCenter } from "@/components/shell/notification-center";
import {
  PortalSetupDialog,
  type PortalConfigSummary,
} from "@/components/shell/portal-setup-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getModuleHref, resolveActiveModule } from "@/config/modules";
import { initials } from "@/lib/format";
import type { TopBarNotificationItem } from "@/lib/notifications";
import { can, ROLE_LABEL } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { InviteUsersDialog } from "@/modules/org/components/invite-users-dialog";

export type { NotificationKind, TopBarNotificationItem } from "@/lib/notifications";

interface GlobalTopBarProps {
  orgSlug: string;
  activeOrg: {
    id: string;
    name: string;
    slug: string;
  };
  portalConfig: PortalConfigSummary;
  role: MembershipRole;
  organizations: SidebarOrgOption[];
  user: SidebarUserSummary;
  notifications: TopBarNotificationItem[];
  recentProjects?: Array<{ id: string; name: string }>;
}

export function GlobalTopBar({
  orgSlug,
  activeOrg,
  portalConfig,
  role,
  organizations,
  user,
  notifications,
  recentProjects = [],
}: GlobalTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const activeModule = resolveActiveModule(pathname, orgSlug);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [setupOpen, setSetupOpen] = React.useState(false);
  const canInvite = can(role, "org.members.manage");

  const subPageBreadcrumb = React.useMemo(() => {
    const prefix = `/${orgSlug}`;
    const rel = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
    const matchedNav = activeModule.items.find((item) => item.path === rel);
    if (matchedNav) {
      if (matchedNav.path === "/projects") return null;
      return matchedNav.label;
    }
    const parts = rel.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const seg = parts[1]!;
      const matchedProject = recentProjects.find((p) => p.id === seg);
      if (matchedProject) return matchedProject.name;
      return seg
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    return null;
  }, [pathname, orgSlug, activeModule.items, recentProjects]);

  const triggerQuickCreate = (detail: string, targetPath?: string) => {
    if (detail === "users") {
      if (!canInvite) {
        toast.error("Admin or Owner role required to invite users.");
        return;
      }
      setInviteOpen(true);
      return;
    }
    if (targetPath) {
      router.push(getModuleHref(orgSlug, targetPath));
    }
    window.dispatchEvent(new CustomEvent("bs-quick-add", { detail }));
  };

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-4 lg:px-6">
        {/* Left: Mobile Drawer Toggle + Breadcrumb */}
        <div className="flex shrink-0 items-center gap-2.5">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                aria-label="Open app switcher"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
              <SheetTitle className="sr-only">App Switcher Navigation</SheetTitle>
              <AppSwitcherSidebar
                orgSlug={orgSlug}
                activeOrg={activeOrg}
                role={role}
                organizations={organizations}
                user={user}
                recentProjects={recentProjects}
                onNavigate={() => setMobileOpen(false)}
                className="w-full border-r-0"
              />
            </SheetContent>
          </Sheet>

          <nav
            aria-label="Breadcrumb"
            className="hidden items-center gap-1.5 text-sm whitespace-nowrap sm:flex"
          >
            <Link
              href={getModuleHref(orgSlug, activeModule.defaultPath)}
              className="font-semibold text-foreground hover:text-primary"
            >
              {activeOrg.name}
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link
              href={getModuleHref(orgSlug, activeModule.defaultPath)}
              className={cn(
                "shrink-0 font-medium transition hover:text-foreground",
                subPageBreadcrumb ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {activeModule.name}
            </Link>
            {subPageBreadcrumb && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="font-medium text-foreground">{subPageBreadcrumb}</span>
              </>
            )}
          </nav>
        </div>

        {/* Center: Global Cross-Module Search Bar */}
        <div className="flex min-w-0 flex-1 items-center justify-center px-2">
          <GlobalSearchCommand orgSlug={orgSlug} />
        </div>

        {/* Right: Universal Quick-Create (+), Notifications Bell, Setup Gear, Role Badge */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Badge variant="outline" className="hidden lg:inline-flex">
            {ROLE_LABEL[role]}
          </Badge>

          {/* Contextual Shortcut for CRM & Finance + Universal Quick-Create for Projects */}
          {activeModule.id === "finance" && (
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
              <Link href={getModuleHref(orgSlug, "/finance/invoices?new=1")}>
                <Plus className="size-4" />
                <span>New Invoice</span>
              </Link>
            </Button>
          )}
          {activeModule.id === "crm" && (
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
              <Link href={getModuleHref(orgSlug, "/crm/deals?new=1")}>
                <Plus className="size-4" />
                <span>New Deal</span>
              </Link>
            </Button>
          )}

          {/* Universal Quick-Create (+) Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant={activeModule.id === "projects" ? "default" : "outline"}
                aria-label="Quick create item"
                className="gap-1.5"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Quick Create</span>
                <ChevronDown className="size-3.5 opacity-80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Quick Create</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => triggerQuickCreate("projects", "/projects?new=1")}
                className="gap-2"
              >
                <FolderKanban className="size-4 text-violet-600" />
                <span>Project</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => triggerQuickCreate("tasks", "/projects/tasks?new=1")}
                className="gap-2"
              >
                <CheckSquare className="size-4 text-blue-600" />
                <span>Task</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => triggerQuickCreate("issues", "/projects/issues?new=1")}
                className="gap-2"
              >
                <Bug className="size-4 text-rose-600" />
                <span>Issue</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => triggerQuickCreate("milestones", "/projects/milestones?new=1")}
                className="gap-2"
              >
                <Flag className="size-4 text-amber-600" />
                <span>Phase / Milestone</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => triggerQuickCreate("time-logs", "/projects/time-logs?new=1")}
                className="gap-2"
              >
                <Clock className="size-4 text-emerald-600" />
                <span>Time Log</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  triggerQuickCreate("expense-claim", "/projects/approvals?tab=expenses&new=1")
                }
                className="gap-2"
              >
                <Receipt className="size-4 text-orange-600" />
                <span>Expense Claim</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => triggerQuickCreate("users")}
                className="gap-2"
              >
                <UserPlus className="size-4 text-primary" />
                <span>User (Invite)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Zoho-Style Notification Center */}
          <NotificationCenter
            orgSlug={orgSlug}
            userId={user.id}
            initialNotifications={notifications}
          />

          {/* Theme Switcher (Light / Dark / System) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Switch theme"
                title="Switch Theme (Light / Dark / System)"
              >
                <Sun className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
                <Moon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-xs">Appearance</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setTheme("light")} className="gap-2 text-xs">
                <Sun className="size-3.5" />
                <span>Light</span>
                {theme === "light" && <span className="ml-auto text-primary">●</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme("dark")} className="gap-2 text-xs">
                <Moon className="size-3.5" />
                <span>Dark</span>
                {theme === "dark" && <span className="ml-auto text-primary">●</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTheme("system")} className="gap-2 text-xs">
                <Laptop className="size-3.5" />
                <span>System</span>
                {theme === "system" && <span className="ml-auto text-primary">●</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Portal Setup / Settings Gear Icon */}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Portal setup"
            title="Portal Setup"
            onClick={() => setSetupOpen(true)}
          >
            <Settings className="size-4" />
          </Button>

          {/* Synchronized Active User Avatar Badge */}
          <Avatar className="hidden size-7 border sm:flex" title={`${user.name} (${ROLE_LABEL[role]})`}>
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
            <AvatarFallback className="bg-zinc-900 text-[10px] font-semibold text-zinc-100 dark:bg-zinc-800">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <InviteUsersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        orgSlug={orgSlug}
        orgName={activeOrg.name}
      />

      <PortalSetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        orgSlug={orgSlug}
        role={role}
        portalConfig={portalConfig}
      />
    </>
  );
}
