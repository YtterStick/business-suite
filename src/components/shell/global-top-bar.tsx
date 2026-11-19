"use client";

import * as React from "react";
import type { MembershipRole } from "@prisma/client";
import {
  AtSign,
  Bell,
  Bug,
  CheckCheck,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Flag,
  FolderKanban,
  Menu,
  Plus,
  Receipt,
  Settings,
  Sparkles,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AppSwitcherSidebar,
  type SidebarOrgOption,
  type SidebarUserSummary,
} from "@/components/shell/app-switcher-sidebar";
import { GlobalSearchCommand } from "@/components/shell/global-search-command";
import {
  PortalSetupDialog,
  type PortalConfigSummary,
} from "@/components/shell/portal-setup-dialog";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getModuleHref, resolveActiveModule } from "@/config/modules";
import { formatDateTimeUtc } from "@/lib/format";
import { can, ROLE_LABEL } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { InviteUsersDialog } from "@/modules/org/components/invite-users-dialog";

export type NotificationKind = "mention" | "task" | "automation" | "approval";

export interface TopBarNotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  description: string;
  createdAt: string;
  href: string;
  badgeLabel: string;
}

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
}

function NotificationIcon({ kind }: { kind: NotificationKind }) {
  switch (kind) {
    case "mention":
      return <AtSign className="size-3.5 text-violet-600" />;
    case "task":
      return <CheckSquare className="size-3.5 text-blue-600" />;
    case "automation":
      return <Sparkles className="size-3.5 text-emerald-600" />;
    case "approval":
      return <CheckCircle2 className="size-3.5 text-amber-600" />;
  }
}

export function GlobalTopBar({
  orgSlug,
  activeOrg,
  portalConfig,
  role,
  organizations,
  user,
  notifications,
}: GlobalTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const activeModule = resolveActiveModule(pathname, orgSlug);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [setupOpen, setSetupOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [lastReadAt, setLastReadAt] = React.useState<string>("");
  const canInvite = can(role, "org.members.manage");

  const storageKey = `bs_notif_read_${orgSlug}_${user.id}`;

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setLastReadAt(saved);
    } catch {
      // Ignore storage read error
    }
  }, [storageKey]);

  const unreadCount = React.useMemo(() => {
    if (!lastReadAt) return notifications.length;
    return notifications.filter((n) => n.createdAt > lastReadAt).length;
  }, [notifications, lastReadAt]);

  const markAllRead = () => {
    const latest = notifications[0]?.createdAt || new Date().toISOString();
    setLastReadAt(latest);
    try {
      window.localStorage.setItem(storageKey, latest);
    } catch {
      // Ignore storage write error
    }
  };

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
        <div className="flex min-w-0 items-center gap-2.5">
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
                onNavigate={() => setMobileOpen(false)}
                className="w-full border-r-0"
              />
            </SheetContent>
          </Sheet>

          <div className="hidden min-w-0 items-center gap-2 text-sm sm:flex">
            <span className="truncate font-semibold">{activeOrg.name}</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-muted-foreground">{activeModule.name}</span>
          </div>
        </div>

        {/* Center: Global Cross-Module Search Bar */}
        <div className="flex flex-1 items-center justify-center">
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

          {/* Notifications Bell Icon + Unread Count + Feed Popover */}
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Notifications"
                title="Notifications"
                className="relative"
              >
                <Bell className="size-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white tabular-nums">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-0">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
                      {unreadCount} new
                    </Badge>
                  )}
                </div>
                {notifications.length > 0 && unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <CheckCheck className="size-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-96 divide-y overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                    All caught up — no recent mentions, automations, or pending approvals.
                  </div>
                ) : (
                  notifications.map((item) => {
                    const isUnread = !lastReadAt || item.createdAt > lastReadAt;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setNotifOpen(false)}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 transition hover:bg-muted/50",
                          isUnread && "bg-violet-50/40",
                        )}
                      >
                        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background">
                          <NotificationIcon kind={item.kind} />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {item.title}
                            </p>
                            <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[9px]">
                              {item.badgeLabel}
                            </Badge>
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDateTimeUtc(item.createdAt)}
                          </p>
                        </div>
                        {isUnread && (
                          <span
                            aria-hidden="true"
                            className="mt-2 size-2 shrink-0 rounded-full bg-rose-600"
                          />
                        )}
                      </Link>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>

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
