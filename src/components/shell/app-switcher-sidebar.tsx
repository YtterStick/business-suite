"use client";

import * as React from "react";
import type { MembershipRole, PortalProfile, UserType } from "@prisma/client";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Building2,
  Bug,
  CalendarClock,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  CreditCard,
  FileText,
  Flag,
  FolderKanban,
  GanttChart,
  GripVertical,
  Handshake,
  Home,
  Kanban,
  MessageSquare,
  MoreVertical,
  Package,
  Plus,
  Receipt,
  Settings,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getModuleHref,
  resolveActiveModule,
  SUITE_MODULES,
  type ModuleNavIcon,
  type SuiteModuleId,
} from "@/config/modules";
import { initials } from "@/lib/format";
import { can, getZohoRoleLabel, isClientUser, ROLE_LABEL } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { TactiqMark } from "@/components/brand/tactiq-logo";
import { InviteUsersDialog } from "@/modules/org/components/invite-users-dialog";

export interface SidebarOrgOption {
  id: string;
  name: string;
  slug: string;
  role: MembershipRole;
}

export interface SidebarUserSummary {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  jobTitle?: string | null;
}

interface AppSwitcherSidebarProps {
  orgSlug: string;
  activeOrg: {
    id: string;
    name: string;
    slug: string;
  };
  role: MembershipRole;
  portalProfile?: PortalProfile;
  userType?: UserType;
  organizations: SidebarOrgOption[];
  user?: SidebarUserSummary;
  recentProjects?: Array<{ id: string; name: string }>;
  onNavigate?: () => void;
  className?: string;
}

function renderModuleIcon(moduleId: SuiteModuleId, className = "size-5") {
  switch (moduleId) {
    case "crm":
      return <Handshake className={className} />;
    case "finance":
      return <Receipt className={className} />;
    case "projects":
      return <FolderKanban className={className} />;
  }
}

function renderNavIcon(icon: ModuleNavIcon, className = "size-4") {
  switch (icon) {
    case "kanban":
      return <Kanban className={className} />;
    case "users":
      return <Users className={className} />;
    case "building":
      return <Building2 className={className} />;
    case "receipt":
      return <Receipt className={className} />;
    case "file-text":
      return <FileText className={className} />;
    case "folder-kanban":
      return <FolderKanban className={className} />;
    case "check-square":
      return <CheckSquare className={className} />;
    case "flag":
      return <Flag className={className} />;
    case "bug":
      return <Bug className={className} />;
    case "clock":
      return <Clock className={className} />;
    case "message-square":
      return <MessageSquare className={className} />;
    case "home":
      return <Home className={className} />;
    case "bar-chart":
      return <BarChart3 className={className} />;
    case "check-circle":
      return <CheckCircle2 className={className} />;
    case "calendar-clock":
      return <CalendarClock className={className} />;
    case "package":
      return <Package className={className} />;
    case "credit-card":
      return <CreditCard className={className} />;
    case "wallet":
      return <Wallet className={className} />;
  }
}

export function AppSwitcherSidebar({
  orgSlug,
  activeOrg,
  role,
  portalProfile,
  userType,
  organizations,
  recentProjects = [],
  onNavigate,
  className,
}: AppSwitcherSidebarProps) {
  const pathname = usePathname();
  const activeModule = resolveActiveModule(pathname, orgSlug);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [overviewOpen, setOverviewOpen] = React.useState(true);
  const [recentProjectsOpen, setRecentProjectsOpen] = React.useState(true);
  const [visitedProjectIds, setVisitedProjectIds] = React.useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = React.useState<string[]>([]);
  const [customOrderByModule, setCustomOrderByModule] = React.useState<Record<string, string[]>>({});
  const [draggedNavId, setDraggedNavId] = React.useState<string | null>(null);
  const access = { role, portalProfile, userType };
  const isClient = isClientUser(access);
  const canInvite = can(access, "org.members.manage");
  const canManageProjects = can(access, "projects.project.manage");
  const canWriteTasks = can(access, "projects.project.write");
  const canWriteIssues = can(access, "projects.issue.write");

  React.useEffect(() => {
    try {
      const savedRecent = window.localStorage.getItem(`bs_recent_proj_ids_${orgSlug}`);
      if (savedRecent) {
        const parsed = JSON.parse(savedRecent);
        if (Array.isArray(parsed)) setVisitedProjectIds(parsed);
      }
    } catch {
      // Ignore
    }
  }, [orgSlug]);

  React.useEffect(() => {
    const match = recentProjects.find((p) => pathname.includes(`/projects/${p.id}`));
    if (!match) return;
    setVisitedProjectIds((prev) => {
      const next = [match.id, ...prev.filter((id) => id !== match.id)].slice(0, 6);
      try {
        window.localStorage.setItem(`bs_recent_proj_ids_${orgSlug}`, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, [pathname, orgSlug, recentProjects]);

  const orderedRecentProjects = React.useMemo(() => {
    const byId = new Map(recentProjects.map((p) => [p.id, p]));
    const list: Array<{ id: string; name: string }> = [];
    for (const id of visitedProjectIds) {
      const found = byId.get(id);
      if (found) list.push(found);
    }
    for (const p of recentProjects) {
      if (!list.some((item) => item.id === p.id)) list.push(p);
    }
    return list.slice(0, 5);
  }, [recentProjects, visitedProjectIds]);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`bs_sidebar_hidden_${orgSlug}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setHiddenIds(parsed);
      }
      const savedOrder = window.localStorage.getItem(`bs_sidebar_order_${orgSlug}`);
      if (savedOrder) {
        const parsedOrder = JSON.parse(savedOrder);
        if (parsedOrder && typeof parsedOrder === "object") {
          setCustomOrderByModule(parsedOrder as Record<string, string[]>);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, [orgSlug]);

  const toggleItemVisibility = (id: string) => {
    setHiddenIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        window.localStorage.setItem(`bs_sidebar_hidden_${orgSlug}`, JSON.stringify(next));
      } catch {
        // Ignore storage write errors
      }
      return next;
    });
  };

  const orderedModuleItems = React.useMemo(() => {
    const savedIds = customOrderByModule[activeModule.id];
    if (!savedIds || savedIds.length === 0) return activeModule.items;
    const itemById = new Map(activeModule.items.map((item) => [item.id, item]));
    const ordered: typeof activeModule.items = [];
    for (const id of savedIds) {
      const found = itemById.get(id);
      if (found) ordered.push(found);
    }
    for (const item of activeModule.items) {
      if (!savedIds.includes(item.id)) ordered.push(item);
    }
    return ordered;
  }, [activeModule, customOrderByModule]);

  const persistModuleOrder = (nextIds: string[]) => {
    setCustomOrderByModule((prev) => {
      const updated = { ...prev, [activeModule.id]: nextIds };
      try {
        window.localStorage.setItem(`bs_sidebar_order_${orgSlug}`, JSON.stringify(updated));
      } catch {
        // Ignore storage write errors
      }
      return updated;
    });
  };

  const moveNavItem = (id: string, delta: -1 | 1) => {
    const ids = orderedModuleItems.map((i) => i.id);
    const idx = ids.indexOf(id);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved!);
    persistModuleOrder(next);
  };

  const reorderNavItems = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const ids = orderedModuleItems.map((i) => i.id);
    const fromIdx = ids.indexOf(sourceId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...ids];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved!);
    persistModuleOrder(next);
  };

  const resetSidebarCustomization = () => {
    const moduleItemIds = new Set(activeModule.items.map((i) => i.id));
    setHiddenIds((prev) => {
      const next = prev.filter((id) => !moduleItemIds.has(id));
      try {
        window.localStorage.setItem(`bs_sidebar_hidden_${orgSlug}`, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
    persistModuleOrder(activeModule.items.map((i) => i.id));
  };

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 border-r bg-sidebar text-sidebar-foreground select-none",
        className,
      )}
      aria-label="Workspace and module navigation"
    >
      {/* ── Primary Global App Switcher Rail ──────────────────────────────── */}
      <div className="flex w-16 flex-col items-center justify-between border-r bg-zinc-950 py-3 text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          {/* Brand + Organization Switcher Trigger */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Tactiq — Switch organization"
                    className="tq-hover-animate flex size-10 items-center justify-center rounded-xl bg-zinc-900 ring-1 ring-white/15 transition hover:scale-105 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <TactiqMark animated className="size-6" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">Tactiq · {activeOrg.name}</p>
                <p className="text-xs text-muted-foreground">Switch organization</p>
              </TooltipContent>
            </Tooltip>

            <DropdownMenuContent side="right" align="start" className="w-64">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Organizations</span>
                <Badge variant="secondary" className="text-[10px]">
                  {getZohoRoleLabel(access)}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {organizations.map((org) => {
                const isCurrent = org.slug === orgSlug;
                return (
                  <DropdownMenuItem key={org.id} asChild>
                    <Link
                      href={getModuleHref(org.slug, activeModule.defaultPath)}
                      onClick={onNavigate}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold">
                          {initials(org.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{org.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            /{org.slug} · {ROLE_LABEL[org.role]}
                          </p>
                        </div>
                      </div>
                      {isCurrent && <Check className="size-4 shrink-0 text-primary" />}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator className="w-8 bg-zinc-800" />

          {/* Core Suite Module Icons (CRM / Finance / Projects) */}
          <nav className="flex flex-col items-center gap-2" aria-label="Suite apps">
            {SUITE_MODULES.filter((mod) => !isClient || mod.id === "projects").map((mod) => {
              const isActive = mod.id === activeModule.id;
              return (
                <Tooltip key={mod.id}>
                  <TooltipTrigger asChild>
                    <Link
                      href={getModuleHref(orgSlug, mod.defaultPath)}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group relative flex size-11 flex-col items-center justify-center rounded-xl transition-all",
                        isActive
                          ? cn(mod.accentClass, "shadow-sm")
                          : "text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100",
                      )}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute -left-2.5 h-5 w-1 rounded-r-full bg-white"
                        />
                      )}
                      {renderModuleIcon(mod.id, "size-5")}
                      <span className="mt-0.5 text-[9px] font-medium leading-none tracking-tight">
                        {mod.shortName}
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-56">
                    <p className="font-semibold">{mod.name}</p>
                    <p className="text-xs text-muted-foreground">{mod.description}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Secondary Contextual Module Sidebar ───────────────────────────── */}
      <div className="flex w-56 flex-col bg-sidebar">
        {/* Organization + Module Header */}
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold tracking-tight">
                {activeModule.name}
              </span>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">{activeOrg.name}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Switch app module"
                className="rounded-md p-1 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                <ChevronsUpDown className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Switch App</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SUITE_MODULES.map((mod) => (
                <DropdownMenuItem key={mod.id} asChild>
                  <Link
                    href={getModuleHref(orgSlug, mod.defaultPath)}
                    onClick={onNavigate}
                    className="flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      {renderModuleIcon(mod.id, "size-4")}
                      {mod.name}
                    </span>
                    {mod.id === activeModule.id && <Check className="size-3.5" />}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Contextual Navigation Links */}
        <ScrollArea className="flex-1 px-2.5 py-3">
          {(() => {
            const clientHiddenNavIds = new Set([
              "reports",
              "users",
              "approvals",
              "time-logs",
              "timesheets",
            ]);
            const visibleModuleItems = orderedModuleItems.filter(
              (i) => !(isClient && clientHiddenNavIds.has(i.id)),
            );
            const mainItems = visibleModuleItems.filter(
              (i) => i.section !== "overview" && !hiddenIds.includes(i.id),
            );
            const overviewItems = visibleModuleItems.filter(
              (i) => i.section === "overview" && !hiddenIds.includes(i.id),
            );
            const renderNavLink = (item: (typeof activeModule.items)[number]) => {
              const href = getModuleHref(orgSlug, item.path);
              const isItemActive =
                pathname === href ||
                (item.path !== "/projects" && pathname.startsWith(`${href}/`));

              const allowQuickAddByRole =
                item.id === "projects"
                  ? canManageProjects
                  : item.id === "users"
                    ? canInvite
                    : item.id === "issues"
                      ? canWriteIssues
                      : canWriteTasks;
              const showQuickAdd = Boolean(item.quickAddPath) && allowQuickAddByRole;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "group relative flex items-center justify-between rounded-lg transition-colors",
                    isItemActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-2xs"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-sm font-medium"
                  >
                    {renderNavIcon(item.icon, "size-4 shrink-0")}
                    <span className="truncate">{item.label}</span>
                  </Link>

                  <div className="flex shrink-0 items-center gap-1 pr-1.5">
                    {item.badge && (
                      <Badge variant="secondary" className="text-[10px]">
                        {item.badge}
                      </Badge>
                    )}

                    {showQuickAdd &&
                      (item.id === "users" ? (
                        <button
                          type="button"
                          title="Invite Users"
                          aria-label="Quick invite users"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!canInvite) {
                              toast.error("Admin or Owner role required to invite users.");
                              return;
                            }
                            setInviteOpen(true);
                          }}
                          className="flex size-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-background hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      ) : (
                        <Link
                          href={getModuleHref(orgSlug, item.quickAddPath!)}
                          title={`New ${item.label.replace(/s$/, "")}`}
                          aria-label={`Quick add ${item.label}`}
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent("bs-quick-add", { detail: item.id }));
                            onNavigate?.();
                          }}
                          className="flex size-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-background hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                        >
                          <Plus className="size-3.5" />
                        </Link>
                      ))}
                  </div>
                </div>
              );
            };

            return (
              <>
                <div className="space-y-1">
                  <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {activeModule.name} Workspace
                  </p>
                  {mainItems.map(renderNavLink)}
                </div>

                {activeModule.items.some((i) => i.section === "overview") && (
                  <div className="mt-4 space-y-1">
                    <div className="flex items-center justify-between gap-1 px-1.5">
                      <button
                        type="button"
                        aria-expanded={overviewOpen}
                        onClick={() => setOverviewOpen((prev) => !prev)}
                        className="flex flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      >
                        {overviewOpen ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                        <span>Overview</span>
                      </button>

                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label="Customize Sidebar"
                            title="Customize Sidebar"
                            className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
                          >
                            <Settings className="size-3" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="right" align="start" className="w-64 p-3">
                          <div className="flex items-center justify-between border-b pb-2">
                            <div>
                              <p className="text-xs font-semibold">Customize Sidebar</p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                Show, hide, or reorder {activeModule.name} links.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={resetSidebarCustomization}
                              className="text-[11px] font-medium text-primary hover:underline"
                            >
                              Reset
                            </button>
                          </div>
                          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                            {orderedModuleItems.map((navItem, idx) => {
                              const visible = !hiddenIds.includes(navItem.id);
                              return (
                                <div
                                  key={navItem.id}
                                  draggable
                                  onDragStart={() => setDraggedNavId(navItem.id)}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    if (draggedNavId) reorderNavItems(draggedNavId, navItem.id);
                                    setDraggedNavId(null);
                                  }}
                                  onDragEnd={() => setDraggedNavId(null)}
                                  className="flex items-center justify-between gap-1.5 rounded px-1.5 py-1 text-xs hover:bg-muted/60"
                                >
                                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5">
                                    <GripVertical className="size-3 shrink-0 cursor-grab text-muted-foreground/60" />
                                    <input
                                      type="checkbox"
                                      checked={visible}
                                      onChange={() => toggleItemVisibility(navItem.id)}
                                      className="size-3.5 accent-primary"
                                    />
                                    <span className="truncate">{navItem.label}</span>
                                  </label>
                                  <div className="flex shrink-0 items-center gap-0.5">
                                    <button
                                      type="button"
                                      disabled={idx === 0}
                                      aria-label={`Move ${navItem.label} up`}
                                      onClick={() => moveNavItem(navItem.id, -1)}
                                      className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
                                    >
                                      <ArrowUp className="size-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={idx === orderedModuleItems.length - 1}
                                      aria-label={`Move ${navItem.label} down`}
                                      onClick={() => moveNavItem(navItem.id, 1)}
                                      className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
                                    >
                                      <ArrowDown className="size-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    {overviewOpen && overviewItems.map(renderNavLink)}
                  </div>
                )}

                {activeModule.id === "projects" && orderedRecentProjects.length > 0 && (
                  <div className="mt-4 space-y-1">
                    <div className="flex items-center justify-between gap-1 px-1.5">
                      <button
                        type="button"
                        aria-expanded={recentProjectsOpen}
                        onClick={() => setRecentProjectsOpen((prev) => !prev)}
                        className="flex flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                      >
                        {recentProjectsOpen ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                        <span>Recent Projects</span>
                      </button>
                    </div>
                    {recentProjectsOpen &&
                      orderedRecentProjects.map((proj) => {
                        const projHref = `/${orgSlug}/projects/${proj.id}`;
                        const isProjActive = pathname === projHref;
                        return (
                          <div
                            key={proj.id}
                            className={cn(
                              "group relative flex items-center justify-between rounded-lg transition-colors",
                              isProjActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-2xs"
                                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                            )}
                          >
                            <Link
                              href={projHref}
                              onClick={onNavigate}
                              className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-xs font-medium"
                            >
                              <span className="size-1.5 shrink-0 rounded-full bg-violet-500" />
                              <span className="truncate">{proj.name}</span>
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={`Quick actions for ${proj.name}`}
                                  className="mr-1 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition hover:bg-background hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                                >
                                  <MoreVertical className="size-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent side="right" align="start" className="w-44">
                                <DropdownMenuLabel className="truncate text-xs">
                                  {proj.name}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/${orgSlug}/projects/tasks?projectId=${proj.id}`}
                                    onClick={onNavigate}
                                  >
                                    <CheckSquare className="size-3.5" />
                                    Open Tasks
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/${orgSlug}/projects/${proj.id}?tab=Tasks`}
                                    onClick={onNavigate}
                                  >
                                    <GanttChart className="size-3.5" />
                                    Open Gantt
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={projHref} onClick={onNavigate}>
                                    <Settings className="size-3.5" />
                                    Project Settings
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        );
                      })}
                  </div>
                )}
              </>
            );
          })()}

          {!isClient && (
            <>
              <Separator className="my-4" />

              {/* Cross-Module Quick Links */}
              <div className="space-y-1">
                <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Connected Apps
                </p>
                {SUITE_MODULES.filter((m) => m.id !== activeModule.id).map((mod) => (
                  <Link
                    key={mod.id}
                    href={getModuleHref(orgSlug, mod.defaultPath)}
                    onClick={onNavigate}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  >
                    {renderModuleIcon(mod.id, "size-3.5 shrink-0")}
                    <span>Open {mod.name}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </ScrollArea>

        {/* Suite-Wide Invite Users */}
        {!isClient && (
          <div className="border-t p-3">
            {canInvite ? (
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-2xs transition hover:bg-accent"
              >
                <UserPlus className="size-3.5 text-primary" />
                <span>Invite Users</span>
              </button>
            ) : (
              <Link
                href={`/${orgSlug}/projects/users`}
                onClick={onNavigate}
                className="flex w-full items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-2xs transition hover:bg-accent"
              >
                <Users className="size-3.5 text-primary" />
                <span>View Users</span>
              </Link>
            )}
          </div>
        )}
      </div>

      <InviteUsersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        orgSlug={orgSlug}
        orgName={activeOrg.name}
        isOwner={role === "OWNER"}
      />
    </aside>
  );
}
