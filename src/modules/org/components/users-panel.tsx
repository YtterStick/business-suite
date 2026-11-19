"use client";

import * as React from "react";
import type { MembershipRole, PortalProfile, UserType } from "@prisma/client";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Crown,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  FolderKanban,
  Info,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
  UserX,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { addDays, toIsoDate } from "@/lib/dates";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CsvImportUsersDialog,
  InviteUsersDrawer,
} from "@/modules/org/components/invite-users-drawer";
import {
  AssignProjectDialog,
  EditUserDialog,
  QuickChatDialog,
  UserDetailSheet,
} from "@/modules/org/components/user-modals";
import {
  CreateCustomViewDialog,
  RolesPermissionsMatrixDialog,
  UserMultiFilterSheet,
  type CustomUserViewConfig,
  type MultiFieldUserFilters,
} from "@/modules/org/components/users-views-modals";
import {
  createTeamGroupAction,
  removeMemberAction,
  revokeInvitationAction,
  setMembersActiveAction,
  updateMemberRoleAction,
} from "@/modules/org/team.actions";
import type { OrganizationTeamDTO, TeamMemberDTO } from "@/modules/org/team.service";

type UsersTopTab = "portal" | "client" | "customers" | "teams" | "resources";
type UserStatusFilter = "active" | "invited" | "deactivated" | "administrators";
type ViewMode = "list" | "grid";
type UserSortField = "name" | "email" | "role" | "portalProfile";
type SortDir = "asc" | "desc";
type OptionalUserColumn = "projectsAssigned" | "hourlyCostRate" | "lastActive" | "status";

const EMPTY_MULTI_FILTERS: MultiFieldUserFilters = {
  role: "",
  portalProfile: "",
  projectId: "",
  lastActivePreset: "",
  lastActiveAfter: "",
};

const BUILTIN_VIEW_LABELS: Record<UserStatusFilter, string> = {
  active: "All Active Users",
  deactivated: "Inactive Users",
  invited: "Invited Users",
  administrators: "Administrators",
};

const OPTIONAL_USER_COLUMNS: Array<{ key: OptionalUserColumn; label: string }> = [
  { key: "projectsAssigned", label: "Projects Assigned" },
  { key: "hourlyCostRate", label: "Hourly Cost Rate" },
  { key: "lastActive", label: "Last Active" },
  { key: "status", label: "Status" },
];

const ZOHO_ROLE_LABELS: Record<MembershipRole, string> = {
  OWNER: "Administrator",
  ADMIN: "Manager",
  MEMBER: "Employee",
};

const PORTAL_PROFILE_LABELS: Record<PortalProfile, string> = {
  PORTAL_OWNER: "Portal Owner",
  STANDARD: "Standard",
  CLIENT: "Client",
};

function exportUsersCsv(members: TeamMemberDTO[], defaultCurrency: string, orgSlug: string) {
  const header = [
    "User Name",
    "Email ID",
    "Role",
    "Portal Profile",
    "Projects Assigned",
    `Hourly Cost Rate (${defaultCurrency})`,
    "Last Active",
    "Status",
  ];
  const rows = members.map((m) => [
    m.name,
    m.email,
    ZOHO_ROLE_LABELS[m.role] ?? m.role,
    PORTAL_PROFILE_LABELS[m.portalProfile] ?? m.portalProfile,
    String(m.projectsAssignedCount),
    m.hourlyCostRate.toFixed(2),
    m.lastActiveAt ? m.lastActiveAt.slice(0, 10) : "",
    m.isActive ? "Active" : "Deactivated",
  ]);
  const csv = [header, ...rows]
    .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${orgSlug}-users.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function UsersPanel({
  orgSlug,
  orgName,
  todayIso = "",
  team,
  canManage,
  openInviteInitially = false,
}: {
  orgSlug: string;
  orgName: string;
  todayIso?: string;
  team: OrganizationTeamDTO;
  canManage: boolean;
  openInviteInitially?: boolean;
}) {
  const [activeTab, setActiveTab] = React.useState<UsersTopTab>("portal");
  const [statusFilter, setStatusFilter] = React.useState<string>("active");
  const [customViews, setCustomViews] = React.useState<CustomUserViewConfig[]>([]);
  const [createViewOpen, setCreateViewOpen] = React.useState(false);
  const [multiFilters, setMultiFilters] =
    React.useState<MultiFieldUserFilters>(EMPTY_MULTI_FILTERS);
  const [filterDrawerOpen, setFilterDrawerOpen] = React.useState(false);
  const [matrixOpen, setMatrixOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [search, setSearch] = React.useState("");
  const [sortField, setSortField] = React.useState<UserSortField>("name");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [visibleCols, setVisibleCols] = React.useState<Record<OptionalUserColumn, boolean>>({
    projectsAssigned: true,
    hourlyCostRate: false,
    lastActive: true,
    status: false,
  });
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  // Modals & Drawers
  const [inviteOpen, setInviteOpen] = React.useState(openInviteInitially);
  const [inviteUserType, setInviteUserType] = React.useState<UserType>("PORTAL");
  const [csvImportOpen, setCsvImportOpen] = React.useState(false);
  const [automationOpen, setAutomationOpen] = React.useState(false);
  const [teamModalOpen, setTeamModalOpen] = React.useState(false);

  // Per-row drawers/modals
  const [detailMemberId, setDetailMemberId] = React.useState<string | null>(null);
  const [editMemberId, setEditMemberId] = React.useState<string | null>(null);
  const [assignMemberId, setAssignMemberId] = React.useState<string | null>(null);
  const [chatMemberId, setChatMemberId] = React.useState<string | null>(null);

  // Team creation state
  const [teamName, setTeamName] = React.useState("");
  const [teamDesc, setTeamDesc] = React.useState("");
  const [teamMemberIds, setTeamMemberIds] = React.useState<string[]>([]);

  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (openInviteInitially) setInviteOpen(true);
  }, [openInviteInitially]);

  React.useEffect(() => {
    const onQuickAdd = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "users" && canManage) {
        setInviteOpen(true);
      }
    };
    window.addEventListener("bs-quick-add", onQuickAdd);
    return () => window.removeEventListener("bs-quick-add", onQuickAdd);
  }, [canManage]);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`bs_user_custom_views_${orgSlug}`);
      if (saved) setCustomViews(JSON.parse(saved));
    } catch {
      // Ignore storage read error
    }
  }, [orgSlug]);

  React.useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [activeTab, statusFilter, multiFilters, search]);

  const portalCount = team.members.filter((m) => m.userType === "PORTAL" && m.isActive).length;
  const clientCount = team.members.filter((m) => m.userType === "CLIENT" && m.isActive).length;
  const targetUserType: UserType = activeTab === "client" ? "CLIENT" : "PORTAL";

  const handleSort = (field: UserSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const renderSortIcon = (field: UserSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="size-3.5 text-muted-foreground/60" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="size-3.5 text-primary" />
    ) : (
      <ArrowDown className="size-3.5 text-primary" />
    );
  };

  const activeCustomView = customViews.find((v) => v.id === statusFilter) ?? null;

  const activeViewLabel =
    activeCustomView?.label ??
    BUILTIN_VIEW_LABELS[statusFilter as UserStatusFilter] ??
    "All Active Users";

  const activeMultiFilterCount = [
    multiFilters.role,
    multiFilters.portalProfile,
    multiFilters.projectId,
    multiFilters.lastActivePreset,
  ].filter(Boolean).length;

  const filteredMembers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const cutoffIso = (() => {
      const refIso = todayIso || "2026-11-18";
      const refDate = new Date(`${refIso}T00:00:00.000Z`);
      if (multiFilters.lastActivePreset === "today") return refIso;
      if (multiFilters.lastActivePreset === "7d") return toIsoDate(addDays(refDate, -7));
      if (multiFilters.lastActivePreset === "30d") return toIsoDate(addDays(refDate, -30));
      if (multiFilters.lastActivePreset === "custom") return multiFilters.lastActiveAfter;
      return "";
    })();

    const list = team.members.filter((m) => {
      if (m.userType !== targetUserType) return false;
      if (activeCustomView) {
        if (activeCustomView.statusFilter === "active" && !m.isActive) return false;
        if (activeCustomView.statusFilter === "deactivated" && m.isActive) return false;
        if (activeCustomView.roleFilter && m.role !== activeCustomView.roleFilter) return false;
        if (activeCustomView.profileFilter && m.portalProfile !== activeCustomView.profileFilter)
          return false;
      } else {
        if (statusFilter === "active" && !m.isActive) return false;
        if (statusFilter === "deactivated" && m.isActive) return false;
        if (
          statusFilter === "administrators" &&
          (!m.isActive || (m.role !== "OWNER" && m.portalProfile !== "PORTAL_OWNER"))
        ) {
          return false;
        }
      }

      if (multiFilters.role && m.role !== multiFilters.role) return false;
      if (multiFilters.portalProfile && m.portalProfile !== multiFilters.portalProfile) return false;
      if (
        multiFilters.projectId &&
        !m.assignedProjects.some((p) => p.id === multiFilters.projectId)
      ) {
        return false;
      }
      if (cutoffIso) {
        const memberDate = m.lastActiveAt ? m.lastActiveAt.slice(0, 10) : "";
        if (!memberDate || memberDate < cutoffIso) return false;
      }

      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (ZOHO_ROLE_LABELS[m.role] ?? "").toLowerCase().includes(q) ||
        (PORTAL_PROFILE_LABELS[m.portalProfile] ?? "").toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "role":
          cmp = (ZOHO_ROLE_LABELS[a.role] ?? a.role).localeCompare(
            ZOHO_ROLE_LABELS[b.role] ?? b.role,
          );
          break;
        case "portalProfile":
          cmp = (PORTAL_PROFILE_LABELS[a.portalProfile] ?? a.portalProfile).localeCompare(
            PORTAL_PROFILE_LABELS[b.portalProfile] ?? b.portalProfile,
          );
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [
    team.members,
    targetUserType,
    statusFilter,
    activeCustomView,
    multiFilters,
    todayIso,
    search,
    sortField,
    sortDir,
  ]);

  const filteredInvitations = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return team.invitations.filter((inv) => {
      if (inv.userType !== targetUserType) return false;
      if (!q) return true;
      return (
        inv.email.toLowerCase().includes(q) ||
        (ZOHO_ROLE_LABELS[inv.role] ?? "").toLowerCase().includes(q)
      );
    });
  }, [team.invitations, targetUserType, search]);

  const filteredCustomers = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return team.customers;
    return team.customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.industry?.toLowerCase().includes(q) ?? false) ||
        (c.primaryContactName?.toLowerCase().includes(q) ?? false),
    );
  }, [team.customers, search]);

  const isInvitedView =
    (activeTab === "portal" || activeTab === "client") &&
    (statusFilter === "invited" || activeCustomView?.statusFilter === "invited");
  const activeDatasetCount =
    activeTab === "customers"
      ? filteredCustomers.length
      : activeTab === "teams"
        ? team.teams.length
        : activeTab === "resources"
          ? team.members.filter((m) => m.isActive).length
          : isInvitedView
            ? filteredInvitations.length
            : filteredMembers.length;

  const totalPages = Math.max(1, Math.ceil(activeDatasetCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pagedMembers = filteredMembers.slice(startIdx, startIdx + pageSize);
  const pagedInvitations = filteredInvitations.slice(startIdx, startIdx + pageSize);

  const allPagedSelected =
    !isInvitedView &&
    pagedMembers.length > 0 &&
    pagedMembers.every((m) => selectedIds.includes(m.membershipId));

  const toggleSelectAll = () => {
    if (allPagedSelected) setSelectedIds([]);
    else setSelectedIds(pagedMembers.map((m) => m.membershipId));
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleRoleChange = (membershipId: string, nextRole: MembershipRole) => {
    startTransition(async () => {
      const res = await updateMemberRoleAction({ orgSlug, membershipId, role: nextRole });
      if (!res.ok) toast.error(res.error.message);
      else toast.success("Member role updated");
    });
  };

  const handleProfileChange = (membershipId: string, nextProfile: PortalProfile) => {
    startTransition(async () => {
      const res = await updateMemberRoleAction({
        orgSlug,
        membershipId,
        portalProfile: nextProfile,
      });
      if (!res.ok) toast.error(res.error.message);
      else toast.success("Portal profile updated");
    });
  };

  const handleSetMembersActive = (ids: string[], isActive: boolean) => {
    startTransition(async () => {
      const res = await setMembersActiveAction({
        orgSlug,
        membershipIds: ids,
        isActive,
      });
      if (!res.ok) toast.error(res.error.message);
      else {
        setSelectedIds([]);
        toast.success(
          isActive
            ? `Reactivated ${res.data.count} user(s)`
            : `Deactivated ${res.data.count} user(s)`,
        );
      }
    });
  };

  const handleRemoveMember = (member: TeamMemberDTO) => {
    startTransition(async () => {
      const res = await removeMemberAction({ orgSlug, membershipId: member.membershipId });
      if (!res.ok) toast.error(res.error.message);
      else toast.success(`Removed ${member.name} from ${orgName}`);
    });
  };

  const handleRevoke = (invitationId: string) => {
    startTransition(async () => {
      const res = await revokeInvitationAction({ orgSlug, invitationId });
      if (!res.ok) toast.error(res.error.message);
      else toast.success("Invitation revoked");
    });
  };

  const handleCreateTeam = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createTeamGroupAction({
        orgSlug,
        name: teamName,
        description: teamDesc || null,
        membershipIds: teamMemberIds,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setTeamName("");
      setTeamDesc("");
      setTeamMemberIds([]);
      setTeamModalOpen(false);
      toast.success("Team created");
    });
  };

  const openInviteModal = (defaultType: UserType = "PORTAL") => {
    setInviteUserType(defaultType);
    setInviteOpen(true);
  };

  const detailMember = team.members.find((m) => m.membershipId === detailMemberId) ?? null;
  const editMember = team.members.find((m) => m.membershipId === editMemberId) ?? null;
  const assignMember = team.members.find((m) => m.membershipId === assignMemberId) ?? null;
  const chatMember = team.members.find((m) => m.membershipId === chatMemberId) ?? null;

  const emptyColSpan =
    6 + OPTIONAL_USER_COLUMNS.filter((c) => visibleCols[c.key]).length;

  return (
    <div className="flex flex-col">
      {/* Top Header + Zoho Horizontal Sub-Tabs */}
      <div className="border-b bg-background px-4 pt-4 lg:px-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage portal users, client users, customer accounts, teams, and resource capacity for{" "}
            {orgName}.
          </p>
        </div>

        <nav className="mt-4 flex gap-5 overflow-x-auto" aria-label="Users sections">
          {[
            { id: "portal" as const, label: "Portal Users", count: portalCount },
            { id: "client" as const, label: "Client Users", count: clientCount },
            { id: "customers" as const, label: "Customers", count: team.customers.length },
            { id: "teams" as const, label: "Teams", count: team.teams.length },
            { id: "resources" as const, label: "Resources", count: portalCount + clientCount },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 border-b-2 pb-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{tab.label}</span>
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] tabular-nums">
                  {tab.count}
                </Badge>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sub-Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2.5 lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {(activeTab === "portal" || activeTab === "client") && (
            <>
              {/* Custom View Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                    <span className="font-medium">{activeViewLabel}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Custom Views</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v)}
                  >
                    <DropdownMenuRadioItem value="active">All Active Users</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="deactivated">Inactive Users</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="invited">Invited Users</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="administrators">
                      Administrators
                    </DropdownMenuRadioItem>
                    {customViews.map((cv) => (
                      <DropdownMenuRadioItem key={cv.id} value={cv.id}>
                        {cv.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => setCreateViewOpen(true)}
                    className="gap-1.5 font-medium text-primary"
                  >
                    <Plus className="size-3.5" />
                    <span>+ Create Custom View</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Standalone Filter Funnel Button */}
              <Button
                type="button"
                size="sm"
                variant={activeMultiFilterCount > 0 ? "default" : "outline"}
                aria-label="Open multi-field user filter drawer"
                title="Filter Users"
                onClick={() => setFilterDrawerOpen((prev) => !prev)}
                className="h-8 gap-1.5 px-2.5 text-xs"
              >
                <Filter className="size-3.5" />
                {activeMultiFilterCount > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
                    {activeMultiFilterCount}
                  </Badge>
                )}
              </Button>
            </>
          )}

          <div className="relative w-60">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(activeTab === "portal" || activeTab === "client") && !isInvitedView && (
            <div
              className="inline-flex items-center rounded-lg border bg-background p-0.5"
              role="group"
              aria-label="User view switcher"
            >
              <button
                type="button"
                aria-label="List view"
                onClick={() => setViewMode("list")}
                className={cn(
                  "rounded-md p-1.5 transition",
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "rounded-md p-1.5 transition",
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="size-3.5" />
              </button>
            </div>
          )}

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAutomationOpen(true)}
            className="h-8 gap-1.5 border-emerald-500/30 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
          >
            <Workflow className="size-3.5" />
            Automation
          </Button>

          {/* Overflow Menu (...) between Automation and Invite Users */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label="More user actions"
                className="h-8 px-2"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>User Operations</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canManage && (
                <DropdownMenuItem onSelect={() => setCsvImportOpen(true)} className="gap-2">
                  <FileSpreadsheet className="size-3.5" />
                  <span>Import Users (CSV)</span>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => {
                  exportUsersCsv(filteredMembers, team.defaultCurrency, orgSlug);
                  toast.success(`Exported ${filteredMembers.length} user(s) to CSV`);
                }}
                className="gap-2"
              >
                <Download className="size-3.5" />
                <span>Export Users (CSV)</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setMatrixOpen(true)} className="gap-2">
                <Shield className="size-3.5 text-violet-600" />
                <span>Roles &amp; Permissions Matrix</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canManage && activeTab === "teams" ? (
            <Button size="sm" className="h-8" onClick={() => setTeamModalOpen(true)}>
              <Plus className="size-3.5" />
              New Team
            </Button>
          ) : (
            canManage && (
              <div className="inline-flex items-center rounded-md shadow-2xs">
                <Button
                  size="sm"
                  className="h-8 rounded-r-none pr-2.5"
                  onClick={() => openInviteModal(activeTab === "client" ? "CLIENT" : "PORTAL")}
                >
                  <UserPlus className="size-3.5" />
                  Invite Users
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      aria-label="More user invite and export options"
                      className="h-8 rounded-l-none border-l border-primary-foreground/20 px-2"
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => setCsvImportOpen(true)}>
                      <FileSpreadsheet className="size-3.5" />
                      Import Users via CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        exportUsersCsv(filteredMembers, team.defaultCurrency, orgSlug);
                        toast.success(`Exported ${filteredMembers.length} user(s) to CSV`);
                      }}
                    >
                      <Download className="size-3.5" />
                      Export Users CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-4 p-4 lg:p-6">
        {/* Bulk Actions Bar */}
        {canManage && selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
            <span className="font-medium">{selectedIds.length} user(s) selected</span>
            <div className="flex items-center gap-2">
              {statusFilter === "deactivated" ? (
                <Button
                  type="button"
                  size="xs"
                  disabled={isPending}
                  onClick={() => handleSetMembersActive(selectedIds, true)}
                >
                  <UserCheck className="size-3.5" />
                  Reactivate Selected
                </Button>
              ) : (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  className="text-destructive"
                  disabled={isPending}
                  onClick={() => handleSetMembersActive(selectedIds, false)}
                >
                  <UserX className="size-3.5" />
                  Deactivate Selected
                </Button>
              )}
              <Button type="button" size="xs" variant="ghost" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* TAB 1 & 2: Portal Users / Client Users */}
        {(activeTab === "portal" || activeTab === "client") &&
          (isInvitedView ? (
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email ID</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Portal Profile</TableHead>
                      <TableHead>Invited By</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedInvitations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                          No pending {activeTab === "client" ? "client" : "portal"} invitations.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedInvitations.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.email}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{ZOHO_ROLE_LABELS[inv.role]}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {PORTAL_PROFILE_LABELS[inv.portalProfile]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {inv.invitedByName ?? "Administrator"}
                          </TableCell>
                          <TableCell className="text-right">
                            {canManage && (
                              <Button
                                type="button"
                                size="icon-xs"
                                variant="ghost"
                                onClick={() => handleRevoke(inv.id)}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : viewMode === "grid" ? (
            pagedMembers.length === 0 ? (
              <Card>
                <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No users found for this filter.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pagedMembers.map((member) => (
                  <Card key={member.membershipId} className="group transition hover:shadow-sm">
                    <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative">
                          <Avatar className="size-10">
                            {member.avatarUrl && (
                              <AvatarImage src={member.avatarUrl} alt={member.name} />
                            )}
                            <AvatarFallback>{initials(member.name)}</AvatarFallback>
                          </Avatar>
                          <span
                            title={member.isOnline ? "Online" : "Offline"}
                            className={cn(
                              "absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-background",
                              member.isOnline ? "bg-emerald-500" : "bg-zinc-400",
                            )}
                          />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="flex items-center gap-1.5 truncate text-base">
                            <span className="truncate">{member.name}</span>
                            {member.portalProfile === "PORTAL_OWNER" && (
                              <Crown
                                className="size-3.5 shrink-0 text-amber-500"
                                aria-label="Portal Owner"
                              />
                            )}
                          </CardTitle>
                          <CardDescription className="truncate text-xs">
                            {member.email}
                          </CardDescription>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(member.membershipId)}
                        onChange={() => toggleSelectRow(member.membershipId)}
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </CardHeader>
                    <CardContent className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Role</span>
                        <Badge variant="outline">{ZOHO_ROLE_LABELS[member.role]}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Portal Profile</span>
                        <Badge variant="secondary">
                          {PORTAL_PROFILE_LABELS[member.portalProfile]}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Projects Assigned</span>
                        <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                          <FolderKanban className="size-3 text-violet-600" />
                          {member.projectsAssignedCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-1 border-t pt-2.5">
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          title="Quick Chat"
                          onClick={() => setChatMemberId(member.membershipId)}
                        >
                          <MessageSquare className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          title="User Details"
                          onClick={() => setDetailMemberId(member.membershipId)}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ) : (
            <Card className="overflow-hidden dark:border-zinc-800 dark:bg-zinc-900/70">
              <CardContent className="overflow-x-auto p-0">
                <Table className="w-full">
                  <TableHeader>
                    <TableRow className="dark:border-zinc-800">
                      <TableHead className="w-8 px-2 text-center">
                        <input
                          type="checkbox"
                          aria-label="Select all users on page"
                          checked={allPagedSelected}
                          onChange={toggleSelectAll}
                          className="size-4 cursor-pointer rounded border-input accent-primary"
                        />
                      </TableHead>
                      <TableHead className="px-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSort("name")}
                          className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                        >
                          User Name
                          {renderSortIcon("name")}
                        </button>
                      </TableHead>
                      <TableHead className="px-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSort("email")}
                          className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                        >
                          <Mail className="size-3.5 text-muted-foreground" />
                          Email ID
                          {renderSortIcon("email")}
                        </button>
                      </TableHead>
                      <TableHead className="px-1.5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSort("role")}
                            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                          >
                            <Shield className="size-3.5 text-muted-foreground" />
                            Role
                            {renderSortIcon("role")}
                          </button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label="Role hierarchy info"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex text-muted-foreground hover:text-foreground"
                              >
                                <Info className="size-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs">
                              Role hierarchy controls workspace authority: Administrator (Owner) &gt;
                              Manager (Admin) &gt; Employee (Member).
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      <TableHead className="px-1.5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSort("portalProfile")}
                            className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                          >
                            <UserCog className="size-3.5 text-muted-foreground" />
                            Portal Profile
                            {renderSortIcon("portalProfile")}
                          </button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label="Portal profile permissions info"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex text-muted-foreground hover:text-foreground"
                              >
                                <Info className="size-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs">
                              Portal Profile controls module and client visibility: Portal Owner
                              (full portal), Standard (internal delivery), or Client (client-shared
                              projects).
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableHead>
                      {visibleCols.projectsAssigned && (
                        <TableHead className="px-2 whitespace-nowrap">
                          Projects Assigned
                        </TableHead>
                      )}
                      {visibleCols.hourlyCostRate && (
                        <TableHead className="px-2 whitespace-nowrap">
                          Hourly Cost Rate
                        </TableHead>
                      )}
                      {visibleCols.lastActive && (
                        <TableHead className="px-2 whitespace-nowrap">
                          Last Active
                        </TableHead>
                      )}
                      {visibleCols.status && (
                        <TableHead className="px-2 whitespace-nowrap">
                          Status
                        </TableHead>
                      )}
                      <TableHead className="sticky right-0 z-10 w-[82px] bg-card/95 px-2 text-right whitespace-nowrap shadow-[-6px_0_12px_-6px_rgba(0,0,0,0.08)] backdrop-blur-xs dark:bg-zinc-900/95">
                        <div className="inline-flex items-center justify-end gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="icon-xs"
                                variant="ghost"
                                aria-label="Customize user table columns"
                                title="Customize columns"
                              >
                                <Columns3 className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Optional Columns</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {OPTIONAL_USER_COLUMNS.map((col) => (
                                <DropdownMenuCheckboxItem
                                  key={col.key}
                                  checked={visibleCols[col.key]}
                                  onCheckedChange={(checked) =>
                                    setVisibleCols((prev) => ({
                                      ...prev,
                                      [col.key]: Boolean(checked),
                                    }))
                                  }
                                >
                                  {col.label}
                                </DropdownMenuCheckboxItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedMembers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={emptyColSpan}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No users found for this filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagedMembers.map((member) => (
                        <TableRow
                          key={member.membershipId}
                          onClick={() => setDetailMemberId(member.membershipId)}
                          className="group cursor-pointer dark:border-zinc-800/80"
                        >
                          <TableCell
                            onClick={(e) => e.stopPropagation()}
                            className="px-2 text-center"
                          >
                            <input
                              type="checkbox"
                              aria-label={`Select ${member.name}`}
                              checked={selectedIds.includes(member.membershipId)}
                              onChange={() => toggleSelectRow(member.membershipId)}
                              className="size-4 cursor-pointer rounded border-input accent-primary"
                            />
                          </TableCell>

                          <TableCell className="max-w-[175px] px-2">
                            <div className="flex items-center gap-2">
                              <div className="relative shrink-0">
                                <Avatar className="size-8">
                                  {member.avatarUrl && (
                                    <AvatarImage src={member.avatarUrl} alt={member.name} />
                                  )}
                                  <AvatarFallback className="text-xs">
                                    {initials(member.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span
                                  title={member.isOnline ? "Online" : "Offline"}
                                  className={cn(
                                    "absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-background",
                                    member.isOnline ? "bg-emerald-500" : "bg-zinc-400",
                                  )}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 font-medium">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDetailMemberId(member.membershipId);
                                    }}
                                    className="truncate text-left hover:text-primary hover:underline"
                                  >
                                    {member.name}
                                  </button>
                                  {member.portalProfile === "PORTAL_OWNER" && (
                                    <Crown
                                      className="size-3.5 shrink-0 text-amber-500"
                                      aria-label="Portal Owner"
                                    />
                                  )}
                                  {!member.isActive && (
                                    <Badge
                                      variant="destructive"
                                      className="px-1.5 py-0 text-[10px]"
                                    >
                                      Deactivated
                                    </Badge>
                                  )}
                                </div>
                                {(member.jobTitle || member.teamNames.length > 0) && (
                                  <div className="truncate text-[11px] text-muted-foreground">
                                    {[member.jobTitle, ...member.teamNames]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell
                            title={member.email}
                            className="max-w-[140px] truncate px-2 text-xs text-muted-foreground"
                          >
                            {member.email}
                          </TableCell>

                          <TableCell onClick={(e) => e.stopPropagation()} className="px-1.5">
                            {canManage ? (
                              <select
                                value={member.role}
                                onChange={(e) =>
                                  handleRoleChange(
                                    member.membershipId,
                                    e.target.value as MembershipRole,
                                  )
                                }
                                className="h-7 w-[98px] rounded-md border border-input bg-background px-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                              >
                                <option value="OWNER">Administrator</option>
                                <option value="ADMIN">Manager</option>
                                <option value="MEMBER">Employee</option>
                              </select>
                            ) : (
                              <Badge variant="outline">{ZOHO_ROLE_LABELS[member.role]}</Badge>
                            )}
                          </TableCell>

                          <TableCell onClick={(e) => e.stopPropagation()} className="px-1.5">
                            {canManage ? (
                              <select
                                value={member.portalProfile}
                                onChange={(e) =>
                                  handleProfileChange(
                                    member.membershipId,
                                    e.target.value as PortalProfile,
                                  )
                                }
                                className="h-7 w-[102px] rounded-md border border-input bg-background px-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
                              >
                                <option value="PORTAL_OWNER">Portal Owner</option>
                                <option value="STANDARD">Standard</option>
                                <option value="CLIENT">Client</option>
                              </select>
                            ) : (
                              <Badge variant="secondary">
                                {PORTAL_PROFILE_LABELS[member.portalProfile]}
                              </Badge>
                            )}
                          </TableCell>

                          {visibleCols.projectsAssigned && (
                            <TableCell className="px-2 text-xs tabular-nums whitespace-nowrap">
                              <Badge variant="outline" className="gap-1 text-xs font-medium">
                                <FolderKanban className="size-3 text-violet-600" />
                                {member.projectsAssignedCount}
                              </Badge>
                            </TableCell>
                          )}

                          {visibleCols.hourlyCostRate && (
                            <TableCell className="px-2 text-xs tabular-nums whitespace-nowrap">
                              {formatCurrency(member.hourlyCostRate, team.defaultCurrency)}/hr
                            </TableCell>
                          )}

                          {visibleCols.lastActive && (
                            <TableCell className="px-2 text-xs whitespace-nowrap text-muted-foreground">
                              {member.lastActiveAt
                                ? formatDate(member.lastActiveAt.slice(0, 10), { withYear: true })
                                : "—"}
                            </TableCell>
                          )}

                          {visibleCols.status && (
                            <TableCell className="px-2 whitespace-nowrap">
                              <Badge variant={member.isActive ? "default" : "destructive"}>
                                {member.isActive ? "Active" : "Deactivated"}
                              </Badge>
                            </TableCell>
                          )}

                          {/* Sticky Hover Quick-Action Column */}
                          <TableCell
                            onClick={(e) => e.stopPropagation()}
                            className="sticky right-0 z-10 w-[82px] bg-card/95 px-2 text-right whitespace-nowrap shadow-[-6px_0_12px_-6px_rgba(0,0,0,0.08)] backdrop-blur-xs group-hover:bg-muted/60 dark:bg-zinc-900/95 dark:group-hover:bg-zinc-800/80"
                          >
                            <div className="inline-flex items-center justify-end gap-0.5 opacity-80 transition group-hover:opacity-100">
                              <Button
                                type="button"
                                size="icon-xs"
                                variant="ghost"
                                title="Quick Chat"
                                aria-label={`Quick chat with ${member.name}`}
                                onClick={() => setChatMemberId(member.membershipId)}
                              >
                                <MessageSquare className="size-3.5" />
                              </Button>

                              <Button
                                type="button"
                                size="icon-xs"
                                variant="ghost"
                                title="View Profile"
                                aria-label={`View profile for ${member.name}`}
                                onClick={() => setDetailMemberId(member.membershipId)}
                              >
                                <Eye className="size-3.5" />
                              </Button>

                              {canManage && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      size="icon-xs"
                                      variant="ghost"
                                      aria-label={`More actions for ${member.name}`}
                                    >
                                      <MoreHorizontal className="size-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem
                                      onSelect={() => setDetailMemberId(member.membershipId)}
                                    >
                                      <Eye className="size-3.5" />
                                      View Profile
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => setEditMemberId(member.membershipId)}
                                    >
                                      <Pencil className="size-3.5" />
                                      Edit User
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => setAssignMemberId(member.membershipId)}
                                    >
                                      <FolderKanban className="size-3.5" />
                                      Assign to Project
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() =>
                                        handleSetMembersActive(
                                          [member.membershipId],
                                          !member.isActive,
                                        )
                                      }
                                    >
                                      {member.isActive ? (
                                        <>
                                          <UserX className="size-3.5" />
                                          Deactivate User
                                        </>
                                      ) : (
                                        <>
                                          <UserCheck className="size-3.5" />
                                          Reactivate User
                                        </>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onSelect={() => handleRemoveMember(member)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <UserMinus className="size-3.5" />
                                      Remove User
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}

        {/* TAB 3: Customers */}
        {activeTab === "customers" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4 text-blue-600" />
                Customers
              </CardTitle>
              <CardDescription>
                Client accounts synced with CRM Companies, Projects, and Finance Invoices.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer Account</TableHead>
                    <TableHead>Primary Contact</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead className="text-right">Projects / Invoices</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No customer accounts found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((cust) => (
                      <TableRow key={cust.id}>
                        <TableCell>
                          <div className="font-medium">{cust.name}</div>
                          {cust.domain && (
                            <div className="text-xs text-muted-foreground">{cust.domain}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{cust.primaryContactName ?? "—"}</div>
                          {cust.primaryContactEmail && (
                            <div className="text-xs text-muted-foreground">
                              {cust.primaryContactEmail}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {cust.industry ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {cust.projectCount} projects · {cust.invoiceCount} invoices
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* TAB 4: Teams */}
        {activeTab === "teams" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {team.teams.length === 0 ? (
              <Card className="sm:col-span-2 lg:col-span-3">
                <CardContent className="flex h-36 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <p>No teams created yet.</p>
                  {canManage && (
                    <Button size="xs" variant="outline" onClick={() => setTeamModalOpen(true)}>
                      <Plus className="size-3.5" />
                      Create First Team
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              team.teams.map((grp) => (
                <Card key={grp.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="flex items-center gap-2">
                        <Users className="size-4 text-violet-600" />
                        {grp.name}
                      </span>
                      <Badge variant="secondary">{grp.members.length}</Badge>
                    </CardTitle>
                    {grp.description && <CardDescription>{grp.description}</CardDescription>}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {grp.members.map((m) => (
                      <div key={m.membershipId} className="flex items-center gap-2 text-xs">
                        <Avatar className="size-6">
                          {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
                          <AvatarFallback className="text-[9px]">{initials(m.name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{m.name}</span>
                        <span className="text-muted-foreground">· {ZOHO_ROLE_LABELS[m.role]}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* TAB 5: Resources */}
        {activeTab === "resources" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="size-4 text-emerald-600" />
                Resource Capacity &amp; Allocation
              </CardTitle>
              <CardDescription>
                Weekly capacity, assigned tasks, and logged hours across active users.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Weekly Capacity</TableHead>
                    <TableHead className="text-right">Assigned Tasks</TableHead>
                    <TableHead className="text-right">Logged Hours</TableHead>
                    <TableHead className="w-40">Utilization</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.members
                    .filter((m) => m.isActive)
                    .map((member) => {
                      const util = Math.min(
                        100,
                        Math.round(
                          (member.loggedHours / Math.max(1, member.weeklyCapacityHours)) * 100,
                        ),
                      );
                      return (
                        <TableRow key={member.membershipId}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{ZOHO_ROLE_LABELS[member.role]}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {member.weeklyCapacityHours}h/wk
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {member.completedTasksCount}/{member.assignedTasksCount}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {member.loggedHours.toFixed(1)}h
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-right text-xs tabular-nums">{util}%</div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-emerald-600"
                                  style={{ width: `${util}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Pagination Footer with Total Count */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-foreground">
              Total Count: {activeDatasetCount}
            </span>
            {(activeTab === "portal" || activeTab === "client") && (
              <div className="flex items-center gap-1.5">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-7 rounded border border-input bg-background px-1.5 text-xs text-foreground"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            )}
          </div>

          {(activeTab === "portal" || activeTab === "client") && (
            <div className="flex items-center gap-2">
              <span>
                Page {safePage} of {totalPages}
              </span>
              <Button
                type="button"
                size="icon-xs"
                variant="outline"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="outline"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Invite Users Slide-Over Drawer + CSV Import */}
      <InviteUsersDrawer
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        orgSlug={orgSlug}
        orgName={orgName}
        projects={team.projects}
        defaultUserType={inviteUserType}
      />

      <CsvImportUsersDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        orgSlug={orgSlug}
      />

      {/* Per-Row Modals & Detail Sheet */}
      <UserDetailSheet
        open={detailMember !== null}
        onOpenChange={(open) => {
          if (!open) setDetailMemberId(null);
        }}
        orgSlug={orgSlug}
        defaultCurrency={team.defaultCurrency}
        member={detailMember}
      />

      <EditUserDialog
        open={editMember !== null}
        onOpenChange={(open) => {
          if (!open) setEditMemberId(null);
        }}
        orgSlug={orgSlug}
        defaultCurrency={team.defaultCurrency}
        member={editMember}
      />

      <AssignProjectDialog
        open={assignMember !== null}
        onOpenChange={(open) => {
          if (!open) setAssignMemberId(null);
        }}
        orgSlug={orgSlug}
        member={assignMember}
        projects={team.projects}
      />

      <QuickChatDialog
        open={chatMember !== null}
        onOpenChange={(open) => {
          if (!open) setChatMemberId(null);
        }}
        orgSlug={orgSlug}
        member={chatMember}
      />

      {/* Create Team Modal */}
      <Dialog open={teamModalOpen} onOpenChange={setTeamModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Team</DialogTitle>
            <DialogDescription>Group organization users into functional teams.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Implementation Delivery"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-desc">Description</Label>
              <Input
                id="team-desc"
                value={teamDesc}
                onChange={(e) => setTeamDesc(e.target.value)}
                placeholder="Optional team responsibilities..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Assign Members</Label>
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border p-2.5">
                {team.members
                  .filter((m) => m.isActive)
                  .map((m) => (
                    <label
                      key={m.membershipId}
                      className="flex cursor-pointer items-center gap-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={teamMemberIds.includes(m.membershipId)}
                        onChange={(e) => {
                          setTeamMemberIds((prev) =>
                            e.target.checked
                              ? [...prev, m.membershipId]
                              : prev.filter((id) => id !== m.membershipId),
                          );
                        }}
                        className="size-3.5 accent-primary"
                      />
                      <span className="font-medium">{m.name}</span>
                      <span className="text-muted-foreground">({m.email})</span>
                    </label>
                  ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTeamModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Create Team
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Automation Dialog */}
      <Dialog open={automationOpen} onOpenChange={setAutomationOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="size-4 text-emerald-600" />
              User &amp; Access Automation
            </DialogTitle>
            <DialogDescription>
              Automated provisioning and access controls across {orgName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="font-semibold">Invite Acceptance → Workspace Auto-Provisioning</p>
              <p className="mt-1 text-muted-foreground">
                Accepting a 7-day token link automatically activates the member&apos;s Role, User
                Type (Portal/Client), Portal Profile, and starter project task assignment.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="font-semibold">Deactivation Guard → Immediate Tenant Isolation</p>
              <p className="mt-1 text-muted-foreground">
                Deactivating a membership immediately blocks access inside `requireTenant` and
                `assertTenant` while preserving audit history.
              </p>
            </div>
            <div className="flex justify-end pt-1">
              <Button asChild size="xs" variant="outline">
                <Link href={`/${orgSlug}/crm/contacts`} onClick={() => setAutomationOpen(false)}>
                  View CRM Contacts
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Custom View, Multi-Field Filter Drawer & Roles Matrix */}
      <CreateCustomViewDialog
        open={createViewOpen}
        onOpenChange={setCreateViewOpen}
        onSave={(newView) => {
          const next = [...customViews, newView];
          setCustomViews(next);
          setStatusFilter(newView.id);
          try {
            window.localStorage.setItem(`bs_user_custom_views_${orgSlug}`, JSON.stringify(next));
          } catch {
            // Ignore storage write error
          }
          toast.success(`Saved custom view "${newView.label}"`);
        }}
      />

      <UserMultiFilterSheet
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        filters={multiFilters}
        onChangeFilters={setMultiFilters}
        onResetFilters={() => setMultiFilters(EMPTY_MULTI_FILTERS)}
        projects={team.projects}
      />

      <RolesPermissionsMatrixDialog
        open={matrixOpen}
        onOpenChange={setMatrixOpen}
      />
    </div>
  );
}
