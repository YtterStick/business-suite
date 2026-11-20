"use client";

import * as React from "react";
import type { ProjectStatus } from "@prisma/client";
import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookmarkPlus,
  Briefcase,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  FolderKanban,
  GripVertical,
  Layers,
  Lock,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GettingStartedBanner } from "@/components/ui/getting-started-banner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NewProjectSheet } from "@/modules/projects/components/new-project-sheet";
import {
  type CustomProjectTemplate,
  DeleteProjectsConfirmDialog,
  emitBackgroundTaskEvent,
  ImportProjectsDialog,
  loadCustomTemplates,
  ProjectActivityLogSheet,
  QuickEditProjectSheet,
  removeCustomTemplate,
  saveCustomTemplate,
} from "@/modules/projects/components/project-workspace-overlays";
import {
  ProjectsToolbar,
  type ProjectViewMode,
  type SavedProjectView,
  type TableDensity,
} from "@/modules/projects/components/projects-toolbar";
import {
  getTagPillClass,
  isProjectOverdue,
  ProjectsAutomationDialog,
  ProjectsBoardView,
  ProjectsGanttView,
} from "@/modules/projects/components/projects-views";
import {
  bulkArchiveProjectsAction,
  bulkUpdateProjectsStatusAction,
  cloneProjectAction,
  deleteProjectsAction,
  toggleProjectArchiveAction,
  updateProjectStatusAction,
} from "@/modules/projects/projects.actions";
import type {
  ProjectSummaryDTO,
  ProjectsWorkspaceDTO,
  ProjectTemplateKey,
} from "@/modules/projects/projects.types";

type ZohoProjectsTab = "active" | "templates" | "groups" | "public" | "archived";
type SortField =
  | "name"
  | "completion"
  | "owner"
  | "status"
  | "phases"
  | "issues"
  | "startDate"
  | "dueDate"
  | "budget";
type SortDirection = "asc" | "desc";

type ColumnKey =
  | "name"
  | "status"
  | "completion"
  | "owner"
  | "timeline"
  | "budget"
  | "connected"
  | "phases"
  | "issues"
  | "tags";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  required?: boolean;
  sortable?: SortField;
}

const COLUMN_DEFS: Record<ColumnKey, ColumnDef> = {
  name: { key: "name", label: "Project", required: true, sortable: "name" },
  status: { key: "status", label: "Status", sortable: "status" },
  completion: { key: "completion", label: "Progress", sortable: "completion" },
  owner: { key: "owner", label: "Owner", sortable: "owner" },
  timeline: { key: "timeline", label: "Timeline", sortable: "dueDate" },
  budget: { key: "budget", label: "Budget", sortable: "budget" },
  connected: { key: "connected", label: "Connected Apps" },
  phases: { key: "phases", label: "Phases", sortable: "phases" },
  issues: { key: "issues", label: "Issues", sortable: "issues" },
  tags: { key: "tags", label: "Tags" },
};

const DEFAULT_COLUMN_ORDER: ColumnKey[] = [
  "name",
  "status",
  "completion",
  "owner",
  "timeline",
  "budget",
  "connected",
  "phases",
  "issues",
  "tags",
];

/** 7 high-signal default columns; Phases, Issues & Tags live under Display -> Columns. */
const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
  name: true,
  status: true,
  completion: true,
  owner: true,
  timeline: true,
  budget: true,
  connected: true,
  phases: false,
  issues: false,
  tags: false,
};

const BUILTIN_TEMPLATES: Array<{
  key: ProjectTemplateKey;
  title: string;
  desc: string;
}> = [
  {
    key: "CLIENT_ONBOARDING",
    title: "Client Onboarding",
    desc: "3 phases (Kickoff, Configuration, Go-Live) with 5 pre-built tasks.",
  },
  {
    key: "SOFTWARE_DELIVERY",
    title: "Software Delivery",
    desc: "3 phases (Architecture, Core Build, UAT & Deployment) with 5 tasks.",
  },
  {
    key: "MARKETING_LAUNCH",
    title: "Marketing Campaign Launch",
    desc: "3 phases covering messaging, CRM UTM tracking, and attribution.",
  },
  {
    key: "FINANCE_ERP_ROLLOUT",
    title: "ERP & Finance Rollout",
    desc: "3 phases covering PHP/USD tax setup, CRM billing, and parallel close.",
  },
  {
    key: "SECURITY_AUDIT",
    title: "Security & Compliance Audit",
    desc: "3 phases covering RBAC/tenant review, remediation, and sign-off.",
  },
  {
    key: "NONE",
    title: "Blank Project",
    desc: "Start from scratch with custom milestones, tasks, and strict schedule rules.",
  },
];

const PROJECT_STATUSES: Array<{ value: ProjectStatus; label: string; dot: string }> = [
  { value: "PLANNING", label: "Planning", dot: "bg-slate-500" },
  { value: "ACTIVE", label: "Active", dot: "bg-blue-500" },
  { value: "ON_HOLD", label: "On Hold", dot: "bg-amber-500" },
  { value: "COMPLETED", label: "Completed", dot: "bg-emerald-500" },
  { value: "CANCELLED", label: "Cancelled", dot: "bg-rose-500" },
];

const TABS: Array<{ id: ZohoProjectsTab; label: string }> = [
  { id: "active", label: "Active Projects" },
  { id: "templates", label: "Project Templates" },
  { id: "groups", label: "Project Groups" },
  { id: "public", label: "Public Projects" },
  { id: "archived", label: "Archived Projects" },
];

interface ProjectsWorkspaceProps {
  orgSlug: string;
  defaultCurrency: string;
  currentUserId: string;
  todayIso: string;
  canWrite: boolean;
  isClient?: boolean;
  workspace: ProjectsWorkspaceDTO;
  openCreateInitially?: boolean;
  highlightProjectId?: string;
}

export function ProjectsWorkspace({
  orgSlug,
  defaultCurrency,
  currentUserId,
  todayIso,
  canWrite,
  isClient = false,
  workspace,
  openCreateInitially = false,
  highlightProjectId,
}: ProjectsWorkspaceProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<ZohoProjectsTab>("active");
  const [viewMode, setViewMode] = React.useState<ProjectViewMode>("list");
  const [savedView, setSavedView] = React.useState<SavedProjectView>("all");
  const [density, setDensity] = React.useState<TableDensity>("comfortable");

  // Multi-criteria advanced filters
  const [filterOwnerId, setFilterOwnerId] = React.useState<string>("");
  const [filterStatuses, setFilterStatuses] = React.useState<ProjectStatus[]>([]);
  const [filterDateFrom, setFilterDateFrom] = React.useState<string>("");
  const [filterDateTo, setFilterDateTo] = React.useState<string>("");
  const [filterTags, setFilterTags] = React.useState<string[]>([]);

  // Columns visibility + drag-and-drop order
  const [visibleColumns, setVisibleColumns] =
    React.useState<Record<ColumnKey, boolean>>(DEFAULT_VISIBLE_COLUMNS);
  const [columnOrder, setColumnOrder] = React.useState<ColumnKey[]>(DEFAULT_COLUMN_ORDER);
  const [draggedCol, setDraggedCol] = React.useState<ColumnKey | null>(null);
  const [dragOverCol, setDragOverCol] = React.useState<ColumnKey | null>(null);

  // Sorting & Search
  const [sortField, setSortField] = React.useState<SortField>("startDate");
  const [sortDir, setSortDir] = React.useState<SortDirection>("desc");
  const [search, setSearch] = React.useState("");

  // Selection & Batch actions
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const selectAllRef = React.useRef<HTMLInputElement>(null);

  // Modals / Sheets
  const [sheetOpen, setSheetOpen] = React.useState(openCreateInitially && canWrite);
  const [sheetTemplate, setSheetTemplate] = React.useState<ProjectTemplateKey>("NONE");
  const [automationOpen, setAutomationOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [activityOpen, setActivityOpen] = React.useState(false);
  const [editingProject, setEditingProject] = React.useState<ProjectSummaryDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ ids: string[]; name?: string } | null>(
    null,
  );
  const [customTemplates, setCustomTemplates] = React.useState<CustomProjectTemplate[]>([]);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setCustomTemplates(loadCustomTemplates(orgSlug));
    try {
      const savedOrder = window.localStorage.getItem(`bs_proj_col_order_v2_${orgSlug}`);
      if (savedOrder) {
        const parsed = JSON.parse(savedOrder) as ColumnKey[];
        if (Array.isArray(parsed) && parsed.length === DEFAULT_COLUMN_ORDER.length) {
          const valid = DEFAULT_COLUMN_ORDER.every((k) => parsed.includes(k));
          if (valid) setColumnOrder(parsed);
        }
      }
      const savedVis = window.localStorage.getItem(`bs_proj_col_vis_v2_${orgSlug}`);
      if (savedVis) {
        const parsed = JSON.parse(savedVis) as Partial<Record<ColumnKey, boolean>>;
        setVisibleColumns({ ...DEFAULT_VISIBLE_COLUMNS, ...parsed, name: true });
      }
      const savedDensity = window.localStorage.getItem(`bs_proj_density_${orgSlug}`);
      if (savedDensity === "compact" || savedDensity === "comfortable") {
        setDensity(savedDensity);
      }
    } catch {
      // Ignore storage read errors
    }
  }, [orgSlug]);

  React.useEffect(() => {
    if (openCreateInitially && canWrite) setSheetOpen(true);
  }, [openCreateInitially, canWrite]);

  React.useEffect(() => {
    const onQuickAdd = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "projects" && canWrite) {
        setSheetOpen(true);
      }
    };
    window.addEventListener("bs-quick-add", onQuickAdd);
    return () => window.removeEventListener("bs-quick-add", onQuickAdd);
  }, [canWrite]);

  const persistColumnOrder = (next: ColumnKey[]) => {
    setColumnOrder(next);
    try {
      window.localStorage.setItem(`bs_proj_col_order_v2_${orgSlug}`, JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const persistVisibleColumns = (next: Record<ColumnKey, boolean>) => {
    const safe = { ...next, name: true };
    setVisibleColumns(safe);
    try {
      window.localStorage.setItem(`bs_proj_col_vis_v2_${orgSlug}`, JSON.stringify(safe));
    } catch {
      // Ignore
    }
  };

  const updateDensity = (next: TableDensity) => {
    setDensity(next);
    try {
      window.localStorage.setItem(`bs_proj_density_${orgSlug}`, next);
    } catch {
      // Ignore
    }
  };

  const reorderColumns = (sourceKey: ColumnKey, targetKey: ColumnKey) => {
    if (sourceKey === targetKey) return;
    const next = [...columnOrder];
    const fromIdx = next.indexOf(sourceKey);
    const toIdx = next.indexOf(targetKey);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved!);
    persistColumnOrder(next);
  };

  const moveColumnStep = (key: ColumnKey, delta: -1 | 1) => {
    const idx = columnOrder.indexOf(key);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= columnOrder.length) return;
    const next = [...columnOrder];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved!);
    persistColumnOrder(next);
  };

  // All tags across projects for multi-criteria filter
  const allAvailableTags = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of workspace.projects) {
      for (const t of p.tags) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [workspace.projects]);

  const activeAdvancedFilterCount =
    (filterOwnerId ? 1 : 0) +
    (filterStatuses.length > 0 ? 1 : 0) +
    (filterDateFrom || filterDateTo ? 1 : 0) +
    (filterTags.length > 0 ? 1 : 0);

  const clearAdvancedFilters = () => {
    setFilterOwnerId("");
    setFilterStatuses([]);
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterTags([]);
  };

  const savedViewCounts = React.useMemo(() => {
    const nonArchived = workspace.projects.filter((p) => !p.isArchived);
    return {
      all: nonArchived.length,
      active: nonArchived.filter((p) => p.status === "ACTIVE").length,
      mine: nonArchived.filter((p) => p.owner?.id === currentUserId).length,
      delayed: nonArchived.filter((p) => isProjectOverdue(p, todayIso)).length,
      archived: workspace.projects.filter((p) => p.isArchived).length,
    };
  }, [workspace.projects, currentUserId, todayIso]);

  const handleSort = (field: SortField, forcedDir?: SortDirection) => {
    if (forcedDir) {
      setSortField(field);
      setSortDir(forcedDir);
      return;
    }
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleSavedViewChange = (next: SavedProjectView) => {
    setSavedView(next);
    if (next === "archived") {
      setActiveTab("archived");
    } else if (activeTab === "archived") {
      setActiveTab("active");
    }
  };

  const handleTabChange = (tab: ZohoProjectsTab) => {
    setActiveTab(tab);
    if (tab === "archived") {
      setSavedView("archived");
    } else if (savedView === "archived") {
      setSavedView("all");
    }
  };

  // Preserve stable numeric code index for each project
  const projectCodeIndexMap = React.useMemo(() => {
    const map = new Map<string, number>();
    workspace.projects.forEach((p, idx) => map.set(p.id, idx + 1));
    return map;
  }, [workspace.projects]);

  const filteredAndSortedProjects = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = workspace.projects.filter((p) => {
      // Tab & saved view archive boundary
      if (activeTab === "archived" || savedView === "archived") {
        if (!p.isArchived) return false;
      } else if (activeTab === "public") {
        if (!p.isPublic || p.isArchived) return false;
      } else {
        if (p.isArchived) return false;
      }

      // Saved view rules
      if (savedView === "active" && p.status !== "ACTIVE") return false;
      if (savedView === "mine" && p.owner?.id !== currentUserId) return false;
      if (savedView === "delayed" && !isProjectOverdue(p, todayIso)) return false;

      // Advanced filter: Owner
      if (filterOwnerId === "__unassigned__") {
        if (p.owner !== null) return false;
      } else if (filterOwnerId) {
        if (p.owner?.id !== filterOwnerId) return false;
      }

      // Advanced filter: Status
      if (filterStatuses.length > 0 && !filterStatuses.includes(p.status)) {
        return false;
      }

      // Advanced filter: Date range
      if (filterDateFrom) {
        const refDate = p.startDate ?? p.dueDate;
        if (!refDate || refDate < filterDateFrom) return false;
      }
      if (filterDateTo) {
        const refDate = p.dueDate ?? p.startDate;
        if (!refDate || refDate > filterDateTo) return false;
      }

      // Advanced filter: Tags
      if (filterTags.length > 0 && !filterTags.every((t) => p.tags.includes(t))) {
        return false;
      }

      // Search query
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.company?.name.toLowerCase().includes(q) ?? false) ||
        (p.group?.name.toLowerCase().includes(q) ?? false) ||
        (p.owner?.name.toLowerCase().includes(q) ?? false) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    const compareStrings = (a: string | null, b: string | null) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    };

    return [...filtered].sort((a: ProjectSummaryDTO, b: ProjectSummaryDTO) => {
      let result = 0;
      switch (sortField) {
        case "name":
          result = a.name.localeCompare(b.name);
          break;
        case "completion":
          result = a.completionPercent - b.completionPercent;
          break;
        case "owner":
          result = compareStrings(a.owner?.name ?? null, b.owner?.name ?? null);
          break;
        case "status":
          result = a.status.localeCompare(b.status);
          break;
        case "phases":
          result = a.milestoneCount - b.milestoneCount;
          break;
        case "issues":
          result = a.openIssueCount - b.openIssueCount;
          break;
        case "startDate":
          result = compareStrings(a.startDate, b.startDate);
          break;
        case "dueDate":
          result = compareStrings(a.dueDate, b.dueDate);
          break;
        case "budget":
          result = (a.budget ?? -1) - (b.budget ?? -1);
          break;
      }
      return sortDir === "asc" ? result : -result;
    });
  }, [
    workspace.projects,
    activeTab,
    savedView,
    currentUserId,
    todayIso,
    filterOwnerId,
    filterStatuses,
    filterDateFrom,
    filterDateTo,
    filterTags,
    search,
    sortField,
    sortDir,
  ]);

  // Keep selectedIds pruned to visible projects
  const visibleIds = React.useMemo(
    () => filteredAndSortedProjects.map((p) => p.id),
    [filteredAndSortedProjects],
  );
  const selectedVisibleIds = React.useMemo(
    () => selectedIds.filter((id) => visibleIds.includes(id)),
    [selectedIds, visibleIds],
  );
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleIds.length === visibleIds.length;
  const someVisibleSelected =
    selectedVisibleIds.length > 0 && selectedVisibleIds.length < visibleIds.length;

  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleIds);
    }
  };

  const toggleRowSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleRowStatusChange = (
    projectId: string,
    name: string,
    nextStatus: ProjectStatus,
    previousStatus: ProjectStatus,
  ) => {
    if (nextStatus === previousStatus) return;
    startTransition(async () => {
      const res = await updateProjectStatusAction({ orgSlug, projectId, status: nextStatus });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`"${name}" moved to ${nextStatus.replace("_", " ")}`, {
        action: {
          label: "Undo",
          onClick: () => handleRowStatusChange(projectId, name, previousStatus, nextStatus),
        },
      });
      router.refresh();
    });
  };

  const handleToggleArchive = (projectId: string, isArchived: boolean, name: string) => {
    startTransition(async () => {
      const res = await toggleProjectArchiveAction({ orgSlug, projectId, isArchived });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(isArchived ? `Archived "${name}"` : `Restored "${name}"`, {
        action: {
          label: "Undo",
          onClick: () => handleToggleArchive(projectId, !isArchived, name),
        },
      });
      router.refresh();
    });
  };

  const runBulkArchive = (ids: string[], isArchived: boolean, withUndo = true) => {
    startTransition(async () => {
      const res = await bulkArchiveProjectsAction({
        orgSlug,
        projectIds: ids,
        isArchived,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setSelectedIds([]);
      toast.success(
        isArchived
          ? `Archived ${res.data.count} project(s)`
          : `Restored ${res.data.count} project(s)`,
        withUndo
          ? {
              action: {
                label: "Undo",
                onClick: () => runBulkArchive(ids, !isArchived, false),
              },
            }
          : undefined,
      );
      router.refresh();
    });
  };

  const handleBulkArchive = (isArchived: boolean) => {
    if (selectedVisibleIds.length === 0) return;
    runBulkArchive([...selectedVisibleIds], isArchived, true);
  };

  const handleBulkStatusChange = (status: ProjectStatus) => {
    if (selectedVisibleIds.length === 0) return;
    const ids = [...selectedVisibleIds];
    const previousGroups = new Map<ProjectStatus, string[]>();
    for (const proj of filteredAndSortedProjects) {
      if (ids.includes(proj.id)) {
        const list = previousGroups.get(proj.status) ?? [];
        list.push(proj.id);
        previousGroups.set(proj.status, list);
      }
    }
    startTransition(async () => {
      const res = await bulkUpdateProjectsStatusAction({
        orgSlug,
        projectIds: ids,
        status,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setSelectedIds([]);
      toast.success(`Updated ${res.data.count} project(s) to ${status.replace("_", " ")}`, {
        action: {
          label: "Undo",
          onClick: () => {
            startTransition(async () => {
              await Promise.all(
                Array.from(previousGroups.entries()).map(([prevStatus, groupIds]) =>
                  bulkUpdateProjectsStatusAction({
                    orgSlug,
                    projectIds: groupIds,
                    status: prevStatus,
                  }),
                ),
              );
              toast.success("Reverted project status update");
              router.refresh();
            });
          },
        },
      });
      router.refresh();
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget || deleteTarget.ids.length === 0) return;
    startTransition(async () => {
      const res = await deleteProjectsAction({
        orgSlug,
        projectIds: deleteTarget.ids,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setSelectedIds((prev) => prev.filter((id) => !deleteTarget.ids.includes(id)));
      setDeleteTarget(null);
      toast.success(`Deleted ${res.data.count} project(s)`);
    });
  };

  const handleCloneProject = (project: ProjectSummaryDTO) => {
    startTransition(async () => {
      const res = await cloneProjectAction({ orgSlug, projectId: project.id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Cloned "${project.name}" → "${res.data.name}"`);
    });
  };

  const handleSaveAsTemplate = (project: ProjectSummaryDTO) => {
    const next = saveCustomTemplate(orgSlug, {
      id: `tpl-${project.id}`,
      title: `${project.name} Template`,
      description: `Saved from ${project.name} (${project.milestoneCount} phases, ${project.taskCount} tasks).`,
      tags: project.tags,
      budget: project.budget,
      isStrict: project.isStrict,
      isPublic: project.isPublic,
      savedAt: todayIso,
    });
    setCustomTemplates(next);
    toast.success(`Saved "${project.name}" as a reusable template`);
  };

  const handleExportCsv = () => {
    const rowsToExport =
      selectedVisibleIds.length > 0
        ? filteredAndSortedProjects.filter((p) => selectedVisibleIds.includes(p.id))
        : filteredAndSortedProjects;

    const jobId = `export-projects-${Date.now()}`;
    emitBackgroundTaskEvent({
      id: jobId,
      label: `Exporting ${rowsToExport.length} project(s) to CSV`,
      progress: 15,
      status: "running",
    });

    window.setTimeout(() => {
      emitBackgroundTaskEvent({
        id: jobId,
        label: `Exporting ${rowsToExport.length} project(s) to CSV`,
        progress: 65,
        status: "running",
      });
    }, 220);

    window.setTimeout(() => {
      const esc = (v: string | number | null | undefined) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = [
        "ID",
        "Project Name",
        "Status",
        "Completion %",
        "Owner",
        "Client (CRM)",
        "Tasks Done/Total",
        "Phases",
        "Open Issues",
        "Start Date",
        "End Date",
        "Budget",
        "Currency",
        "Tags",
      ];
      const lines = [
        header.join(","),
        ...rowsToExport.map((p) => {
          const codeIdx = projectCodeIndexMap.get(p.id) ?? 1;
          return [
            `PRJ-${String(codeIdx).padStart(3, "0")}`,
            p.name,
            p.status,
            p.completionPercent,
            p.owner?.name ?? "Unassigned",
            p.company?.name ?? "",
            `${p.doneTaskCount}/${p.taskCount}`,
            p.milestoneCount,
            p.openIssueCount,
            p.startDate ?? "",
            p.dueDate ?? "",
            p.budget ?? "",
            p.currency,
            p.tags.join(";"),
          ]
            .map(esc)
            .join(",");
        }),
      ];

      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${orgSlug}-projects-${todayIso}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      emitBackgroundTaskEvent({
        id: jobId,
        label: `Exported ${rowsToExport.length} project(s) CSV`,
        progress: 100,
        status: "completed",
      });
      toast.success(`Exported ${rowsToExport.length} project(s) to CSV`);
    }, 520);
  };

  const openNewWithTemplate = (template: ProjectTemplateKey) => {
    setSheetTemplate(template);
    setSheetOpen(true);
  };

  const showProjectCollection =
    activeTab === "active" || activeTab === "public" || activeTab === "archived";

  const visibleTabs = React.useMemo(
    () =>
      isClient
        ? TABS.filter((t) => t.id === "active" || t.id === "groups" || t.id === "public")
        : TABS,
    [isClient],
  );

  const availableColumnOrder = React.useMemo(
    () =>
      isClient ? columnOrder.filter((key) => key !== "budget" && key !== "connected") : columnOrder,
    [columnOrder, isClient],
  );

  const orderedVisibleColumns = React.useMemo(
    () => availableColumnOrder.filter((key) => visibleColumns[key]),
    [availableColumnOrder, visibleColumns],
  );

  const cellPad = density === "compact" ? "py-1.5" : "py-3";
  const visibleColCount = orderedVisibleColumns.length + 2; // leading checkbox + sticky actions

  const renderCell = (colKey: ColumnKey, project: ProjectSummaryDTO) => {
    const overdue = isProjectOverdue(project, todayIso);
    const codeNum = projectCodeIndexMap.get(project.id) ?? 1;
    const hasCrmLink = Boolean(project.company || project.deal);
    const hasFinanceLink = project.budget !== null || project.expenseCount > 0;

    switch (colKey) {
      case "name":
        return (
          <TableCell key={colKey} className={cn("min-w-52", cellPad)}>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="rounded border bg-muted/50 px-1.5 py-0 font-mono text-[10px] font-medium text-muted-foreground">
                  PRJ-{String(codeNum).padStart(3, "0")}
                </span>
                <Link
                  href={`/${orgSlug}/projects/${project.id}`}
                  className={cn(
                    "font-semibold text-foreground hover:text-primary hover:underline",
                    density === "compact" ? "text-xs" : "text-sm",
                  )}
                >
                  {project.name}
                </Link>
                {project.isStrict && (
                  <Lock className="size-3 shrink-0 text-amber-600" aria-label="Strict project" />
                )}
                {project.source === "AUTOMATION" && (
                  <Sparkles
                    className="size-3 shrink-0 text-violet-600"
                    aria-label="Auto-created from Closed Won Deal"
                  />
                )}
              </div>
              {density === "comfortable" && (project.group || project.company) && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {project.group && (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {project.group.name}
                    </Badge>
                  )}
                  {project.company && <span>{project.company.name}</span>}
                </div>
              )}
            </div>
          </TableCell>
        );
      case "status":
        return (
          <TableCell key={colKey} className={cn("whitespace-nowrap", cellPad)}>
            <Badge variant="secondary" className={density === "compact" ? "text-[10px]" : ""}>
              {project.status.replace("_", " ")}
            </Badge>
          </TableCell>
        );
      case "completion":
        return (
          <TableCell key={colKey} className={cn("min-w-36", cellPad)}>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                <span className="font-semibold">{project.completionPercent}%</span>
                <Link
                  href={`/${orgSlug}/projects/tasks?projectId=${project.id}`}
                  className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  {project.doneTaskCount}/{project.taskCount} tasks
                </Link>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-violet-600 transition-all"
                  style={{ width: `${project.completionPercent}%` }}
                />
              </div>
            </div>
          </TableCell>
        );
      case "owner":
        return (
          <TableCell key={colKey} className={cn("whitespace-nowrap", cellPad)}>
            {project.owner ? (
              <div className="flex items-center gap-2">
                <Avatar className={density === "compact" ? "size-5" : "size-6"}>
                  {project.owner.avatarUrl && (
                    <AvatarImage src={project.owner.avatarUrl} alt={project.owner.name} />
                  )}
                  <AvatarFallback className="text-[10px]">
                    {initials(project.owner.name)}
                  </AvatarFallback>
                </Avatar>
                <span className={density === "compact" ? "text-xs" : "text-sm"}>
                  {project.owner.name}
                </span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Unassigned</span>
            )}
          </TableCell>
        );
      case "timeline":
        return (
          <TableCell key={colKey} className={cn("text-xs whitespace-nowrap", cellPad)}>
            {project.startDate || project.dueDate ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span>
                  {project.startDate ? formatDate(project.startDate, { withYear: true }) : "—"}
                </span>
                <span>→</span>
                <span className={overdue ? "font-semibold text-rose-600" : ""}>
                  {project.dueDate ? formatDate(project.dueDate, { withYear: true }) : "—"}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
        );
      case "budget":
        return (
          <TableCell
            key={colKey}
            className={cn("text-xs font-medium tabular-nums whitespace-nowrap", cellPad)}
          >
            {project.budget !== null ? formatCurrency(project.budget, project.currency) : "—"}
          </TableCell>
        );
      case "connected":
        return (
          <TableCell key={colKey} className={cn("whitespace-nowrap", cellPad)}>
            <div className="flex items-center gap-1">
              <Link
                href={`/${orgSlug}/crm/deals`}
                title={
                  project.deal
                    ? `CRM Deal: ${project.deal.title}`
                    : project.company
                      ? `CRM Client: ${project.company.name}`
                      : "Open CRM"
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition hover:opacity-85",
                  hasCrmLink
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                <Briefcase className="size-2.5" />
                CRM
              </Link>
              <Link
                href={`/${orgSlug}/finance/invoices`}
                title={
                  hasFinanceLink
                    ? `Finance tracked (${project.expenseCount} expenses)`
                    : "Open Finance"
                }
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition hover:opacity-85",
                  hasFinanceLink
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                <Receipt className="size-2.5" />
                Finance
              </Link>
            </div>
          </TableCell>
        );
      case "phases":
        return (
          <TableCell
            key={colKey}
            className={cn("text-sm tabular-nums whitespace-nowrap text-muted-foreground", cellPad)}
          >
            {project.milestoneCount}
          </TableCell>
        );
      case "issues":
        return (
          <TableCell key={colKey} className={cn("whitespace-nowrap", cellPad)}>
            <Link
              href={`/${orgSlug}/projects/issues`}
              className={cn(
                "text-sm tabular-nums hover:underline",
                project.openIssueCount > 0
                  ? "font-semibold text-rose-600"
                  : "text-muted-foreground",
              )}
            >
              {project.openIssueCount}/{project.issueCount}
            </Link>
          </TableCell>
        );
      case "tags":
        return (
          <TableCell key={colKey} className={cellPad}>
            <div className="flex max-w-48 flex-wrap gap-1">
              {project.tags.length === 0 ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                project.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={cn("px-1.5 py-0 text-[10px]", getTagPillClass(tag))}
                  >
                    #{tag}
                  </Badge>
                ))
              )}
            </div>
          </TableCell>
        );
    }
  };

  return (
    <div className="flex flex-col">
      {/* Zoho-style Top Sub-Header & Split CTAs */}
      <div className="border-b bg-background px-4 pt-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground">
              Manage delivery workspaces, phases, task progress roll-ups, and client budgets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-52 sm:w-56">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects, tags..."
                className="h-9 pl-8 text-xs"
              />
            </div>

            {/* Split Button: New Project (nested templates & import) */}
            {canWrite && (
              <div className="inline-flex items-center rounded-md shadow-2xs">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openNewWithTemplate("NONE")}
                  className="h-9 rounded-r-none border-r border-primary-foreground/20 px-3 text-xs"
                >
                  <Plus className="size-4" />
                  New Project
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      aria-label="New project options"
                      className="h-9 rounded-l-none px-2"
                    >
                      <ChevronDown className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Create Project</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openNewWithTemplate("NONE")}>
                      <Plus className="size-3.5" />
                      Create Blank Project
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Layers className="size-3.5 text-violet-600" />
                        Create from Template
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-52">
                        {BUILTIN_TEMPLATES.filter((t) => t.key !== "NONE").map((tpl) => (
                          <DropdownMenuItem
                            key={tpl.key}
                            onClick={() => openNewWithTemplate(tpl.key)}
                          >
                            {tpl.title}
                          </DropdownMenuItem>
                        ))}
                        {customTemplates.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            {customTemplates.map((ct) => (
                              <DropdownMenuItem
                                key={ct.id}
                                onClick={() => openNewWithTemplate("NONE")}
                              >
                                <BookmarkPlus className="size-3.5 text-emerald-600" />
                                <span className="truncate">{ct.title}</span>
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setImportOpen(true)}>
                      <Upload className="size-3.5" />
                      Import from CSV / JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Top-Right Overflow Menu (...) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="More project actions"
                  className="h-9 w-9"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Workspace Tools</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportCsv}>
                  <Download className="size-3.5" />
                  Export Projects (CSV)
                </DropdownMenuItem>
                {canWrite && (
                  <DropdownMenuItem onClick={() => setImportOpen(true)}>
                    <Upload className="size-3.5" />
                    Import Projects
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActivityOpen(true)}>
                  <Activity className="size-3.5 text-violet-600" />
                  View Activity Log
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <nav className="mt-4 flex gap-5 overflow-x-auto" aria-label="Projects views">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "shrink-0 border-b-2 pb-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Consolidated Projects Sub-Toolbar */}
      {showProjectCollection && (
        <ProjectsToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          activeFilterCount={activeAdvancedFilterCount}
          onOpenAutomation={() => setAutomationOpen(true)}
          shownCount={filteredAndSortedProjects.length}
          filterPopoverContent={
            <div className="space-y-3.5">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="size-3.5 text-primary" />
                  <p className="text-xs font-semibold">Advanced Filters</p>
                </div>
                {activeAdvancedFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAdvancedFilters}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">Owner</label>
                <select
                  value={filterOwnerId}
                  onChange={(e) => setFilterOwnerId(e.target.value)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  <option value="">Any Owner</option>
                  <option value="__unassigned__">Unassigned</option>
                  {workspace.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">Status</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {PROJECT_STATUSES.map((st) => {
                    const checked = filterStatuses.includes(st.value);
                    return (
                      <label
                        key={st.value}
                        className="flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-xs hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setFilterStatuses((prev) =>
                              prev.includes(st.value)
                                ? prev.filter((item) => item !== st.value)
                                : [...prev, st.value],
                            )
                          }
                          className="size-3.5 accent-primary"
                        />
                        <span className={cn("size-2 rounded-full", st.dot)} />
                        <span>{st.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground">Date Range</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    aria-label="Filter start date from"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    type="date"
                    aria-label="Filter due date to"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              {allAvailableTags.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Tags</p>
                  <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                    {allAvailableTags.map((tag) => {
                      const selected = filterTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setFilterTags((prev) =>
                              prev.includes(tag)
                                ? prev.filter((t) => t !== tag)
                                : [...prev, tag],
                            )
                          }
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[11px] transition",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background text-muted-foreground hover:text-foreground",
                          )}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          }
          displayProps={{
            viewMode,
            savedView,
            savedViewCounts,
            onSavedViewChange: handleSavedViewChange,
            density,
            onDensityChange: updateDensity,
            columns: availableColumnOrder.map((key) => ({
              key,
              label: COLUMN_DEFS[key].label,
              required: COLUMN_DEFS[key].required,
            })),
            visibleColumns,
            onToggleColumn: (key, checked) =>
              persistVisibleColumns({ ...visibleColumns, [key]: checked }),
            onMoveColumn: moveColumnStep,
            onReorderColumns: reorderColumns,
            onResetColumns: () => {
              persistVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
              persistColumnOrder(DEFAULT_COLUMN_ORDER);
            },
          }}
          activeFilterChips={
            activeAdvancedFilterCount > 0 ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t pt-2 text-xs">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Active filters:
                </span>
                {filterOwnerId && (
                  <Badge variant="secondary" className="gap-1 text-[11px]">
                    Owner:{" "}
                    {filterOwnerId === "__unassigned__"
                      ? "Unassigned"
                      : workspace.members.find((m) => m.id === filterOwnerId)?.name ?? "Member"}
                    <button type="button" onClick={() => setFilterOwnerId("")}>
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}
                {filterStatuses.map((st) => (
                  <Badge key={st} variant="secondary" className="gap-1 text-[11px]">
                    Status: {st.replace("_", " ")}
                    <button
                      type="button"
                      onClick={() => setFilterStatuses((prev) => prev.filter((s) => s !== st))}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
                {(filterDateFrom || filterDateTo) && (
                  <Badge variant="secondary" className="gap-1 text-[11px]">
                    Dates: {filterDateFrom || "Any"} → {filterDateTo || "Any"}
                    <button
                      type="button"
                      onClick={() => {
                        setFilterDateFrom("");
                        setFilterDateTo("");
                      }}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                )}
                {filterTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 text-[11px]">
                    #{tag}
                    <button
                      type="button"
                      onClick={() => setFilterTags((prev) => prev.filter((t) => t !== tag))}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
                <button
                  type="button"
                  onClick={clearAdvancedFilters}
                  className="ml-1 text-[11px] font-medium text-primary hover:underline"
                >
                  Reset all
                </button>
              </div>
            ) : undefined
          }
        />
      )}

      {/* Contextual Bulk Action Toolbar */}
      {showProjectCollection && viewMode === "list" && selectedVisibleIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-primary/5 px-4 py-2 text-xs lg:px-6">
          <div className="flex items-center gap-2.5">
            <Badge className="tabular-nums">{selectedVisibleIds.length} selected</Badge>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-muted-foreground hover:text-foreground hover:underline"
            >
              Clear selection
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canWrite && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="xs" variant="outline" disabled={isPending}>
                      Change Status
                      <ChevronDown className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel>Set Status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {PROJECT_STATUSES.map((st) => (
                      <DropdownMenuItem
                        key={st.value}
                        onClick={() => handleBulkStatusChange(st.value)}
                      >
                        <span className={cn("size-2 rounded-full", st.dot)} />
                        {st.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleBulkArchive(activeTab !== "archived")}
                >
                  {activeTab === "archived" ? (
                    <>
                      <ArchiveRestore className="size-3.5" />
                      Restore
                    </>
                  ) : (
                    <>
                      <Archive className="size-3.5" />
                      Archive
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  size="xs"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => setDeleteTarget({ ids: selectedVisibleIds })}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </>
            )}

            <Button type="button" size="xs" variant="outline" onClick={handleExportCsv}>
              <Download className="size-3.5" />
              Export Selected
            </Button>
          </div>
        </div>
      )}

      {/* Tab Body */}
      <div className="space-y-4 p-4 lg:p-6">
        {workspace.projects.length === 0 && canWrite && (
          <GettingStartedBanner
            orgSlug={orgSlug}
            progress={{
              hasClientOrDeal:
                workspace.companies.length > 0 || workspace.deals.length > 0,
              hasWonDeal: workspace.projects.some(
                (p) => p.deal !== null || p.source === "AUTOMATION",
              ),
              hasTaskOrInvoice: workspace.projects.some((p) => p.taskCount > 0),
            }}
          />
        )}

        {activeTab === "templates" ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              {BUILTIN_TEMPLATES.map((tpl) => (
                <Card key={tpl.key} className="flex flex-col justify-between">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Layers className="size-4 text-violet-600" />
                      {tpl.title}
                    </CardTitle>
                    <CardDescription>{tpl.desc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {canWrite && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openNewWithTemplate(tpl.key)}
                      >
                        Use Template
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {customTemplates.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">Saved Custom Templates</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  {customTemplates.map((ct) => (
                    <Card key={ct.id} className="flex flex-col justify-between">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-2 text-base">
                          <span className="flex items-center gap-2 truncate">
                            <BookmarkPlus className="size-4 shrink-0 text-emerald-600" />
                            <span className="truncate">{ct.title}</span>
                          </span>
                        </CardTitle>
                        <CardDescription>{ct.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between gap-2">
                        {canWrite && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openNewWithTemplate("NONE")}
                          >
                            Use Template
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="xs"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setCustomTemplates(removeCustomTemplate(orgSlug, ct.id));
                            toast.success("Removed custom template");
                          }}
                        >
                          Remove
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "groups" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspace.groups.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3">
                <EmptyState
                  icon={FolderKanban}
                  title="No project groups yet"
                  description="Organize related client or departmental projects into structured folders directly from the New Project drawer."
                  action={
                    canWrite
                      ? {
                          label: "New Project",
                          icon: <Plus className="size-3.5" />,
                          onClick: () => openNewWithTemplate("NONE"),
                        }
                      : undefined
                  }
                />
              </div>
            ) : (
              workspace.groups.map((g) => (
                <Card key={g.id}>
                  <CardHeader>
                    <CardTitle className="text-base">{g.name}</CardTitle>
                    <CardDescription>{g.projectCount} project(s)</CardDescription>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>
        ) : viewMode === "board" ? (
          <ProjectsBoardView
            orgSlug={orgSlug}
            projects={filteredAndSortedProjects}
            todayIso={todayIso}
            canWrite={canWrite}
          />
        ) : viewMode === "gantt" ? (
          <ProjectsGanttView
            orgSlug={orgSlug}
            projects={filteredAndSortedProjects}
            todayIso={todayIso}
          />
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {/* Leading Bulk Selection Checkbox */}
                    <TableHead className="w-10 px-3">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        aria-label="Select all projects"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        className="size-4 cursor-pointer accent-primary"
                      />
                    </TableHead>

                    {/* Dynamic Draggable, Sortable Headers with Action Menus */}
                    {orderedVisibleColumns.map((colKey) => {
                      const col = COLUMN_DEFS[colKey];
                      const isSorted = col.sortable && sortField === col.sortable;
                      return (
                        <TableHead
                          key={colKey}
                          draggable
                          onDragStart={() => setDraggedCol(colKey)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverCol(colKey);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (draggedCol) reorderColumns(draggedCol, colKey);
                            setDraggedCol(null);
                            setDragOverCol(null);
                          }}
                          onDragEnd={() => {
                            setDraggedCol(null);
                            setDragOverCol(null);
                          }}
                          className={cn(
                            "group/th whitespace-nowrap select-none",
                            dragOverCol === colKey &&
                              draggedCol !== colKey &&
                              "border-l-2 border-l-primary bg-primary/5",
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                              <GripVertical
                                className="size-3 cursor-grab text-muted-foreground/40 opacity-0 transition group-hover/th:opacity-100"
                                aria-hidden="true"
                              />
                              {col.sortable ? (
                                <button
                                  type="button"
                                  onClick={() => handleSort(col.sortable!)}
                                  className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                                >
                                  <span>{col.label}</span>
                                  {isSorted ? (
                                    <span
                                      className="text-[10px] font-bold text-primary"
                                      aria-label={`Sorted ${sortDir}`}
                                    >
                                      {sortDir === "asc" ? "▲" : "▼"}
                                    </span>
                                  ) : (
                                    <ArrowUpDown className="size-3 text-muted-foreground/50 opacity-0 transition group-hover/th:opacity-100" />
                                  )}
                                </button>
                              ) : (
                                <span className="font-medium">{col.label}</span>
                              )}
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={`${col.label} column menu`}
                                  className="rounded p-0.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover/th:opacity-100 focus-visible:opacity-100"
                                >
                                  <MoreVertical className="size-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-44">
                                <DropdownMenuLabel className="text-xs">{col.label}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {col.sortable && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => handleSort(col.sortable!, "asc")}
                                    >
                                      <ArrowUp className="size-3.5" />
                                      Sort Ascending
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleSort(col.sortable!, "desc")}
                                    >
                                      <ArrowDown className="size-3.5" />
                                      Sort Descending
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                <DropdownMenuItem
                                  disabled={col.required}
                                  onClick={() =>
                                    persistVisibleColumns({
                                      ...visibleColumns,
                                      [colKey]: false,
                                    })
                                  }
                                >
                                  <EyeOff className="size-3.5" />
                                  Hide Column
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableHead>
                      );
                    })}

                    {/* Sticky Right Actions Column Header */}
                    <TableHead className="sticky right-0 z-10 bg-background/95 text-right whitespace-nowrap shadow-[-6px_0_12px_-6px_rgba(0,0,0,0.08)] backdrop-blur-xs">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedProjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColCount} className="p-4">
                        <EmptyState
                          icon={FolderKanban}
                          title={
                            workspace.projects.length === 0
                              ? "No projects in this workspace yet"
                              : "No projects match your current view"
                          }
                          description="Create your first delivery project or import an existing CSV sheet."
                          compact
                          action={
                            canWrite
                              ? workspace.projects.length === 0
                                ? {
                                    label: "New Project",
                                    icon: <Plus className="size-3.5" />,
                                    onClick: () => openNewWithTemplate("NONE"),
                                  }
                                : {
                                    label: "Reset Filters",
                                    onClick: () => {
                                      clearAdvancedFilters();
                                      setSearch("");
                                      handleSavedViewChange("all");
                                    },
                                  }
                              : undefined
                          }
                          secondaryAction={
                            canWrite
                              ? {
                                  label: "Import CSV",
                                  icon: <Upload className="size-3.5" />,
                                  onClick: () => setImportOpen(true),
                                }
                              : undefined
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedProjects.map((project) => {
                      const isSelected = selectedVisibleIds.includes(project.id);
                      return (
                        <TableRow
                          key={project.id}
                          data-state={isSelected ? "selected" : undefined}
                          onClick={(e) => {
                            if (
                              (e.target as HTMLElement).closest(
                                "a,button,input,select,[role='menuitem']",
                              )
                            ) {
                              return;
                            }
                            router.push(`/${orgSlug}/projects/${project.id}`);
                          }}
                          className={cn(
                            "group cursor-pointer transition-colors hover:bg-muted/40",
                            isSelected && "bg-primary/5",
                            highlightProjectId === project.id && "bg-violet-500/10",
                          )}
                        >
                          {/* Row Selection Checkbox */}
                          <TableCell className={cn("w-10 px-3", cellPad)}>
                            <input
                              type="checkbox"
                              aria-label={`Select ${project.name}`}
                              checked={isSelected}
                              onChange={() => toggleRowSelect(project.id)}
                              className="size-4 cursor-pointer accent-primary"
                            />
                          </TableCell>

                          {/* Dynamic Ordered Cells */}
                          {orderedVisibleColumns.map((colKey) => renderCell(colKey, project))}

                          {/* Sticky End-of-Row Quick Actions (⋮) */}
                          <TableCell
                            className={cn(
                              "sticky right-0 z-10 bg-background/95 text-right whitespace-nowrap shadow-[-6px_0_12px_-6px_rgba(0,0,0,0.08)] backdrop-blur-xs group-hover:bg-muted/60",
                              isSelected && "bg-primary/5",
                              cellPad,
                            )}
                          >
                            <div className="flex items-center justify-end gap-1">
                              <Button asChild size="xs" variant="ghost" className="hidden sm:inline-flex">
                                <Link href={`/${orgSlug}/projects/${project.id}`}>
                                  <FolderKanban className="size-3.5" />
                                  Open
                                </Link>
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    size="icon-xs"
                                    variant="ghost"
                                    aria-label={`Actions for ${project.name}`}
                                  >
                                    <MoreVertical className="size-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/${orgSlug}/projects/${project.id}`}>
                                      <ExternalLink className="size-3.5" />
                                      Open Workspace
                                    </Link>
                                  </DropdownMenuItem>
                                  {canWrite && (
                                    <>
                                      <DropdownMenuItem onClick={() => setEditingProject(project)}>
                                        <Pencil className="size-3.5" />
                                        Edit Details
                                      </DropdownMenuItem>
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                          <Sparkles className="size-3.5" />
                                          Change Status
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent className="w-44">
                                          {PROJECT_STATUSES.map((st) => (
                                            <DropdownMenuItem
                                              key={st.value}
                                              disabled={st.value === project.status}
                                              onClick={() =>
                                                handleRowStatusChange(
                                                  project.id,
                                                  project.name,
                                                  st.value,
                                                  project.status,
                                                )
                                              }
                                            >
                                              <span className={cn("size-2 rounded-full", st.dot)} />
                                              {st.label}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>
                                      <DropdownMenuItem onClick={() => handleCloneProject(project)}>
                                        <Copy className="size-3.5" />
                                        Clone Project
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleSaveAsTemplate(project)}
                                      >
                                        <BookmarkPlus className="size-3.5" />
                                        Save as Template
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() =>
                                          handleToggleArchive(
                                            project.id,
                                            !project.isArchived,
                                            project.name,
                                          )
                                        }
                                      >
                                        {project.isArchived ? (
                                          <>
                                            <ArchiveRestore className="size-3.5" />
                                            Restore Project
                                          </>
                                        ) : (
                                          <>
                                            <Archive className="size-3.5" />
                                            Archive Project
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() =>
                                          setDeleteTarget({ ids: [project.id], name: project.name })
                                        }
                                      >
                                        <Trash2 className="size-3.5" />
                                        Delete Project
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals & Slide-Over Drawers */}
      <NewProjectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        orgSlug={orgSlug}
        defaultCurrency={defaultCurrency}
        currentUserId={currentUserId}
        groups={workspace.groups}
        members={workspace.members}
        companies={workspace.companies}
        deals={workspace.deals}
        mentionItems={workspace.mentionItems}
        initialTemplate={sheetTemplate}
      />

      <QuickEditProjectSheet
        project={editingProject}
        open={editingProject !== null}
        onOpenChange={(open) => !open && setEditingProject(null)}
        orgSlug={orgSlug}
        workspace={workspace}
      />

      <ImportProjectsDialog open={importOpen} onOpenChange={setImportOpen} orgSlug={orgSlug} />

      <ProjectActivityLogSheet
        open={activityOpen}
        onOpenChange={setActivityOpen}
        logs={workspace.activityLogs ?? []}
      />

      <DeleteProjectsConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        count={deleteTarget?.ids.length ?? 0}
        singleName={deleteTarget?.name}
        isPending={isPending}
        onConfirm={handleConfirmDelete}
      />

      <ProjectsAutomationDialog
        open={automationOpen}
        onOpenChange={setAutomationOpen}
        orgSlug={orgSlug}
      />
    </div>
  );
}
