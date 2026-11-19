"use client";

import * as React from "react";
import type { MembershipRole } from "@prisma/client";
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
  GripVertical,
  Handshake,
  Home,
  Kanban,
  Layers,
  LogOut,
  MessageSquare,
  Package,
  Plus,
  Receipt,
  SlidersHorizontal,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { can, ROLE_LABEL } from "@/lib/rbac";
import { cn } from "@/lib/utils";
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
}

interface AppSwitcherSidebarProps {
  orgSlug: string;
  activeOrg: {
    id: string;
    name: string;
    slug: string;
  };
  role: MembershipRole;
  organizations: SidebarOrgOption[];
  user: SidebarUserSummary;
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
  organizations,
  user,
  onNavigate,
  className,
}: AppSwitcherSidebarProps) {
  const pathname = usePathname();
  const activeModule = resolveActiveModule(pathname, orgSlug);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [overviewOpen, setOverviewOpen] = React.useState(true);
  const [hiddenIds, setHiddenIds] = React.useState<string[]>([]);
  const [customOrderByModule, setCustomOrderByModule] = React.useState<Record<string, string[]>>({});
  const [draggedNavId, setDraggedNavId] = React.useState<string | null>(null);
  const canInvite = can(role, "org.members.manage");

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
          {/* Organization Switcher Trigger */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Switch organization"
                    className="flex size-10 items-center justify-center rounded-xl bg-zinc-800 text-xs font-semibold tracking-tight text-white ring-1 ring-white/15 transition hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    {initials(activeOrg.name)}
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">{activeOrg.name}</p>
                <p className="text-xs text-muted-foreground">Switch organization</p>
              </TooltipContent>
            </Tooltip>

            <DropdownMenuContent side="right" align="start" className="w-64">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Organizations</span>
                <Badge variant="secondary" className="text-[10px]">
                  {ROLE_LABEL[role]}
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
            {SUITE_MODULES.map((mod) => {
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

        {/* Bottom User Profile & Sign Out */}
        <div className="flex flex-col items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400">
                <Layers className="size-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">Business Suite v1</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="User account menu"
                className="rounded-full ring-2 ring-zinc-800 transition hover:ring-zinc-600 focus-visible:outline-none focus-visible:ring-white"
              >
                <Avatar className="size-9">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                  <AvatarFallback className="bg-zinc-800 text-xs text-zinc-100">
                    {initials(user.name)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-60">
              <DropdownMenuLabel>
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="justify-between" disabled>
                <span>Role in {activeOrg.name}</span>
                <Badge variant="outline">{ROLE_LABEL[role]}</Badge>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
            </DropdownMenuContent>
          </DropdownMenu>
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
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                {ROLE_LABEL[role]}
              </Badge>
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
            const mainItems = orderedModuleItems.filter(
              (i) => i.section !== "overview" && !hiddenIds.includes(i.id),
            );
            const overviewItems = orderedModuleItems.filter(
              (i) => i.section === "overview" && !hiddenIds.includes(i.id),
            );
            const renderNavLink = (item: (typeof activeModule.items)[number]) => {
              const href = getModuleHref(orgSlug, item.path);
              const isItemActive =
                pathname === href ||
                (item.path !== "/projects" && pathname.startsWith(`${href}/`));

              const showQuickAdd = Boolean(item.quickAddPath);

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
                            <SlidersHorizontal className="size-3" />
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
              </>
            );
          })()}

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
        </ScrollArea>

        {/* Suite-Wide Invite Users */}
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
      </div>

      <InviteUsersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        orgSlug={orgSlug}
        orgName={activeOrg.name}
      />
    </aside>
  );
}
