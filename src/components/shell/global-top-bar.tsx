"use client";

import * as React from "react";
import type { MembershipRole, PortalProfile, UserType } from "@prisma/client";
import {
  Bug,
  Building2,
  CalendarClock,
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  Flag,
  FolderKanban,
  Laptop,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Plus,
  Receipt,
  Settings,
  Shield,
  Sun,
  UserCog,
  UserPlus,
  Users,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getModuleHref, resolveActiveModule } from "@/config/modules";
import { initials } from "@/lib/format";
import type { TopBarNotificationItem } from "@/lib/notifications";
import { can, getZohoRoleLabel, isClientUser } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { InviteUsersDialog } from "@/modules/org/components/invite-users-dialog";
import { updateMyProfileAction } from "@/modules/org/team.actions";

export type { NotificationKind, TopBarNotificationItem } from "@/lib/notifications";

type PresenceStatus = "available" | "busy" | "dnd" | "away";

const PRESENCE_OPTIONS: Array<{
  id: PresenceStatus;
  label: string;
  dotClass: string;
}> = [
  { id: "available", label: "Available", dotClass: "bg-emerald-500" },
  { id: "busy", label: "Busy", dotClass: "bg-amber-500" },
  { id: "dnd", label: "Do Not Disturb", dotClass: "bg-rose-500" },
  { id: "away", label: "Away", dotClass: "bg-zinc-400" },
];

const PROFILE_BADGE_LABELS: Record<PortalProfile, string> = {
  PORTAL_OWNER: "Portal Owner",
  STANDARD: "Standard",
  CLIENT: "Client",
};

interface GlobalTopBarProps {
  orgSlug: string;
  activeOrg: {
    id: string;
    name: string;
    slug: string;
  };
  portalConfig: PortalConfigSummary;
  role: MembershipRole;
  portalProfile?: PortalProfile;
  userType?: UserType;
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
  portalProfile,
  userType,
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
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [presence, setPresence] = React.useState<PresenceStatus>("available");

  // Profile edit form state
  const [profileName, setProfileName] = React.useState(user.name);
  const [profileJobTitle, setProfileJobTitle] = React.useState(user.jobTitle ?? "");
  const [profileAvatarUrl, setProfileAvatarUrl] = React.useState(user.avatarUrl ?? "");
  const [savingProfile, startProfileTransition] = React.useTransition();

  React.useEffect(() => {
    setProfileName(user.name);
    setProfileJobTitle(user.jobTitle ?? "");
    setProfileAvatarUrl(user.avatarUrl ?? "");
  }, [user.name, user.jobTitle, user.avatarUrl]);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`tq_presence_${user.id}`);
      if (saved === "available" || saved === "busy" || saved === "dnd" || saved === "away") {
        setPresence(saved);
      }
    } catch {
      // Ignore storage errors
    }
  }, [user.id]);

  const updatePresence = (next: PresenceStatus) => {
    setPresence(next);
    try {
      window.localStorage.setItem(`tq_presence_${user.id}`, next);
    } catch {
      // Ignore storage errors
    }
    const label = PRESENCE_OPTIONS.find((p) => p.id === next)?.label ?? next;
    toast.success(`Status set to ${label}`);
  };

  const activePresence =
    PRESENCE_OPTIONS.find((p) => p.id === presence) ?? PRESENCE_OPTIONS[0]!;

  const access = { role, portalProfile, userType };
  const isClient = isClientUser(access);
  const roleLabel = getZohoRoleLabel(access);
  const resolvedProfile: PortalProfile =
    isClient
      ? "CLIENT"
      : portalProfile ?? (role === "OWNER" ? "PORTAL_OWNER" : "STANDARD");
  const profileBadgeLabel = PROFILE_BADGE_LABELS[resolvedProfile];

  const canInvite = can(access, "org.members.manage");
  const canManageProjects = can(access, "projects.project.manage");
  const canWriteTasks = can(access, "projects.project.write");
  const canWriteIssues = can(access, "projects.issue.write");
  const canWriteInvoices = can(access, "finance.invoice.write");
  const canWriteDeals = can(access, "crm.deal.write");
  const showQuickCreate =
    canManageProjects || canWriteTasks || canWriteIssues || canInvite;

  const subPageBreadcrumb = React.useMemo(() => {
    const prefix = `/${orgSlug}`;
    const rel = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
    const matchedNav = activeModule.items.find((item) => item.path === rel);
    if (matchedNav) {
      if (matchedNav.path === "/projects") return null;
      return matchedNav.label;
    }
    const parts = rel.split("/").filter(Boolean);
    if (parts[0] === "projects" && parts[1] && parts[1].length > 12) {
      return "Project Workspace";
    }
    return null;
  }, [pathname, orgSlug, activeModule.items]);

  const triggerQuickCreate = (quickKey: string, targetPath?: string) => {
    if (quickKey === "users") {
      setInviteOpen(true);
      return;
    }
    window.dispatchEvent(new CustomEvent("bs-quick-add", { detail: quickKey }));
    if (targetPath && !pathname.endsWith(targetPath.split("?")[0] ?? "")) {
      router.push(getModuleHref(orgSlug, targetPath));
    }
  };

  const handleSaveProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startProfileTransition(async () => {
      const res = await updateMyProfileAction({
        orgSlug,
        name: profileName,
        jobTitle: profileJobTitle || null,
        avatarUrl: profileAvatarUrl || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Profile updated");
      setProfileOpen(false);
      router.refresh();
    });
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
                portalProfile={portalProfile}
                userType={userType}
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

        {/* Right: Universal Quick-Create (+), Notifications Bell, Theme, Setup Gear, Profile */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Contextual Shortcut for CRM & Finance + Universal Quick-Create for Projects */}
          {activeModule.id === "finance" && canWriteInvoices && (
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
              <Link href={getModuleHref(orgSlug, "/finance/invoices?new=1")}>
                <Plus className="size-4" />
                <span>New Invoice</span>
              </Link>
            </Button>
          )}
          {activeModule.id === "crm" && canWriteDeals && (
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
              <Link href={getModuleHref(orgSlug, "/crm/deals?new=1")}>
                <Plus className="size-4" />
                <span>New Deal</span>
              </Link>
            </Button>
          )}

          {/* Universal Quick-Create (+) Dropdown Menu */}
          {showQuickCreate && (
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
                {canManageProjects && (
                  <DropdownMenuItem
                    onSelect={() => triggerQuickCreate("projects", "/projects?new=1")}
                    className="gap-2"
                  >
                    <FolderKanban className="size-4 text-violet-600" />
                    <span>Project</span>
                  </DropdownMenuItem>
                )}
                {canWriteTasks && (
                  <DropdownMenuItem
                    onSelect={() => triggerQuickCreate("tasks", "/projects/tasks?new=1")}
                    className="gap-2"
                  >
                    <CheckSquare className="size-4 text-blue-600" />
                    <span>Task</span>
                  </DropdownMenuItem>
                )}
                {canWriteIssues && (
                  <DropdownMenuItem
                    onSelect={() => triggerQuickCreate("issues", "/projects/issues?new=1")}
                    className="gap-2"
                  >
                    <Bug className="size-4 text-rose-600" />
                    <span>Issue</span>
                  </DropdownMenuItem>
                )}
                {canWriteTasks && (
                  <>
                    <DropdownMenuItem
                      onSelect={() =>
                        triggerQuickCreate("milestones", "/projects/milestones?new=1")
                      }
                      className="gap-2"
                    >
                      <Flag className="size-4 text-amber-600" />
                      <span>Phase / Milestone</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        triggerQuickCreate("time-logs", "/projects/time-logs?new=1")
                      }
                      className="gap-2"
                    >
                      <Clock className="size-4 text-emerald-600" />
                      <span>Time Log</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() =>
                        triggerQuickCreate(
                          "expense-claim",
                          "/projects/approvals?tab=expenses&new=1",
                        )
                      }
                      className="gap-2"
                    >
                      <Receipt className="size-4 text-orange-600" />
                      <span>Expense Claim</span>
                    </DropdownMenuItem>
                  </>
                )}
                {canInvite && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => triggerQuickCreate("users")}
                      className="gap-2"
                    >
                      <UserPlus className="size-4 text-primary" />
                      <span>User (Invite)</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Notification Center */}
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
          {!isClient && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Portal setup"
              title="Portal Setup"
              onClick={() => setSetupOpen(true)}
            >
              <Settings className="size-4" />
            </Button>
          )}

          {/* Active User Account Profile Menu & Sign Out */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="User account menu"
                title={`${user.name} (${roleLabel})`}
                className="relative rounded-full ring-1 ring-border transition hover:ring-2 hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar className="size-7">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                  <AvatarFallback className="bg-zinc-900 text-[10px] font-semibold text-zinc-100 dark:bg-zinc-800">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute right-0 bottom-0 size-2 rounded-full ring-2 ring-background",
                    activePresence.dotClass,
                  )}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              {/* Profile Summary Banner */}
              <div className="flex items-start gap-3 border-b bg-muted/30 p-3.5">
                <div className="relative shrink-0">
                  <Avatar className="size-11 ring-1 ring-border">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                    <AvatarFallback className="bg-zinc-900 text-xs font-semibold text-zinc-100">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute right-0 bottom-0 size-3 rounded-full ring-2 ring-background",
                      activePresence.dotClass,
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  {user.jobTitle && (
                    <p className="mt-0.5 truncate text-[11px] font-medium text-foreground/80">
                      {user.jobTitle}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="default" className="gap-1 px-1.5 py-0 text-[10px]">
                      <Shield className="size-2.5" />
                      {roleLabel}
                    </Badge>
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                      {profileBadgeLabel}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Presence / Availability Selector */}
              <div className="border-b px-3 py-2.5">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status · {activePresence.label}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PRESENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updatePresence(opt.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[11px] font-medium transition",
                        presence === opt.id
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <span className={cn("size-2 shrink-0 rounded-full", opt.dotClass)} />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Account Links */}
              <div className="p-1">
                <DropdownMenuItem onSelect={() => setProfileOpen(true)} className="gap-2">
                  <UserCog className="size-4 text-primary" />
                  <span>Edit Profile &amp; Account</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${orgSlug}/projects/tasks`} className="gap-2">
                    <CheckSquare className="size-4 text-blue-600" />
                    <span>My Tasks</span>
                  </Link>
                </DropdownMenuItem>
                {!isClient && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href={`/${orgSlug}/projects/timesheets`} className="gap-2">
                        <CalendarClock className="size-4 text-emerald-600" />
                        <span>My Timesheets</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/${orgSlug}/projects/users`} className="gap-2">
                        <Users className="size-4 text-violet-600" />
                        <span>Team &amp; Permissions</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </div>

              <DropdownMenuSeparator className="my-0" />

              {/* Workspaces Quick Switcher */}
              <div className="p-1">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Workspaces ({organizations.length})
                </p>
                {organizations.map((org) => {
                  const isCurrent = org.slug === orgSlug;
                  return (
                    <DropdownMenuItem key={org.id} asChild>
                      <Link
                        href={getModuleHref(org.slug, activeModule.defaultPath)}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate text-xs font-medium">{org.name}</span>
                        </span>
                        {isCurrent && <Check className="size-3.5 shrink-0 text-primary" />}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuItem asChild>
                  <Link href="/signup" className="gap-2 text-xs text-muted-foreground">
                    <Plus className="size-3.5" />
                    <span>Create New Workspace</span>
                  </Link>
                </DropdownMenuItem>
              </div>

              <DropdownMenuSeparator className="my-0" />

              <div className="p-1">
                <DropdownMenuItem asChild>
                  <form action="/api/auth/logout" method="post" className="w-full">
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 text-left text-destructive"
                    >
                      <LogOut className="size-4" />
                      <span>Sign out</span>
                    </button>
                  </form>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Edit Profile & Account Modal */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-4 text-primary" />
              Edit Profile &amp; Account
            </DialogTitle>
            <DialogDescription>
              Update your display name, role title in {activeOrg.name}, and profile avatar URL.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
              <Avatar className="size-12">
                {profileAvatarUrl && <AvatarImage src={profileAvatarUrl} alt={profileName} />}
                <AvatarFallback className="text-sm font-semibold">
                  {initials(profileName || user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{profileName || user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {roleLabel}
                  </Badge>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {profileBadgeLabel}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="my-profile-name">Full Name</Label>
              <Input
                id="my-profile-name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                required
                minLength={2}
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="my-profile-job">Job Title / Role Description</Label>
              <Input
                id="my-profile-job"
                value={profileJobTitle}
                onChange={(e) => setProfileJobTitle(e.target.value)}
                placeholder="e.g. Project Lead, Solutions Architect"
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="my-profile-avatar">Avatar Image URL (optional)</Label>
              <Input
                id="my-profile-avatar"
                value={profileAvatarUrl}
                onChange={(e) => setProfileAvatarUrl(e.target.value)}
                placeholder="https://..."
                maxLength={500}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProfileOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile && <Loader2 className="size-4 animate-spin" />}
                Save Profile
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <InviteUsersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        orgSlug={orgSlug}
        orgName={activeOrg.name}
        isOwner={role === "OWNER"}
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
