"use client";

import * as React from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  Filter,
  FolderKanban,
  GanttChart,
  Kanban,
  Layers,
  List,
  Lock,
  Plus,
  Search,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
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
  getTagPillClass,
  isProjectOverdue,
  ProjectsAutomationDialog,
  ProjectsBoardView,
  ProjectsGanttView,
} from "@/modules/projects/components/projects-views";
import { toggleProjectArchiveAction } from "@/modules/projects/projects.actions";
import type {
  ProjectSummaryDTO,
  ProjectsWorkspaceDTO,
  ProjectTemplateKey,
} from "@/modules/projects/projects.types";

type ZohoProjectsTab = "active" | "templates" | "groups" | "public" | "archived";
type ViewMode = "list" | "board" | "gantt";
type ProjectFilterMode = "all" | "mine" | "overdue";
type SortField = "name" | "status" | "startDate" | "dueDate" | "budget";
type SortDirection = "asc" | "desc";

type ColumnKey =
  | "id"
  | "name"
  | "completion"
  | "owner"
  | "status"
  | "tasks"
  | "phases"
  | "issues"
  | "startDate"
  | "dueDate"
  | "budget"
  | "tags";

const COLUMN_CONFIG: Array<{ key: ColumnKey; label: string; required?: boolean }> = [
  { key: "id", label: "ID" },
  { key: "name", label: "Project Name", required: true },
  { key: "completion", label: "% Completion" },
  { key: "owner", label: "Owner" },
  { key: "status", label: "Status" },
  { key: "tasks", label: "Tasks" },
  { key: "phases", label: "Phases" },
  { key: "issues", label: "Issues" },
  { key: "startDate", label: "Start Date" },
  { key: "dueDate", label: "End Date" },
  { key: "budget", label: "Budget" },
  { key: "tags", label: "Tags" },
];

const DEFAULT_VISIBLE_COLUMNS: Record<ColumnKey, boolean> = {
  id: true,
  name: true,
  completion: true,
  owner: true,
  status: true,
  tasks: true,
  phases: true,
  issues: true,
  startDate: true,
  dueDate: true,
  budget: true,
  tags: true,
};

interface ProjectsWorkspaceProps {
  orgSlug: string;
  defaultCurrency: string;
  currentUserId: string;
  todayIso: string;
  canWrite: boolean;
  workspace: ProjectsWorkspaceDTO;
  openCreateInitially?: boolean;
  highlightProjectId?: string;
}

const TABS: Array<{ id: ZohoProjectsTab; label: string }> = [
  { id: "active", label: "Active Projects" },
  { id: "templates", label: "Project Templates" },
  { id: "groups", label: "Project Groups" },
  { id: "public", label: "Public Projects" },
  { id: "archived", label: "Archived Projects" },
];

const FILTER_LABELS: Record<ProjectFilterMode, string> = {
  all: "All Projects",
  mine: "My Projects",
  overdue: "Overdue",
};

export function ProjectsWorkspace({
  orgSlug,
  defaultCurrency,
  currentUserId,
  todayIso,
  canWrite,
  workspace,
  openCreateInitially = false,
  highlightProjectId,
}: ProjectsWorkspaceProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<ZohoProjectsTab>("active");
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [filterMode, setFilterMode] = React.useState<ProjectFilterMode>("all");
  const [visibleColumns, setVisibleColumns] =
    React.useState<Record<ColumnKey, boolean>>(DEFAULT_VISIBLE_COLUMNS);
  const [sortField, setSortField] = React.useState<SortField>("startDate");
  const [sortDir, setSortDir] = React.useState<SortDirection>("desc");
  const [search, setSearch] = React.useState("");
  const [sheetOpen, setSheetOpen] = React.useState(openCreateInitially);
  const [sheetTemplate, setSheetTemplate] = React.useState<ProjectTemplateKey>("NONE");
  const [automationOpen, setAutomationOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (openCreateInitially) setSheetOpen(true);
  }, [openCreateInitially]);

  React.useEffect(() => {
    const onQuickAdd = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "projects") {
        setSheetOpen(true);
      }
    };
    window.addEventListener("bs-quick-add", onQuickAdd);
    return () => window.removeEventListener("bs-quick-add", onQuickAdd);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="size-3.5 text-muted-foreground/60" />;
    }
    return sortDir === "asc" ? (
      <ArrowUp className="size-3.5 text-primary" />
    ) : (
      <ArrowDown className="size-3.5 text-primary" />
    );
  };

  const filteredAndSortedProjects = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = workspace.projects.filter((p) => {
      if (activeTab === "active" && p.isArchived) return false;
      if (activeTab === "archived" && !p.isArchived) return false;
      if (activeTab === "public" && (!p.isPublic || p.isArchived)) return false;

      if (filterMode === "mine" && p.owner?.id !== currentUserId) return false;
      if (filterMode === "overdue" && !isProjectOverdue(p, todayIso)) return false;

      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.company?.name.toLowerCase().includes(q) ?? false) ||
        (p.group?.name.toLowerCase().includes(q) ?? false) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });

    const compareStrings = (a: string | null, b: string | null) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    };

    const sorted = [...filtered].sort((a: ProjectSummaryDTO, b: ProjectSummaryDTO) => {
      let result = 0;
      switch (sortField) {
        case "name":
          result = a.name.localeCompare(b.name);
          break;
        case "status":
          result = a.status.localeCompare(b.status);
          break;
        case "startDate":
          result = compareStrings(a.startDate, b.startDate);
          break;
        case "dueDate":
          result = compareStrings(a.dueDate, b.dueDate);
          break;
        case "budget": {
          const av = a.budget ?? -1;
          const bv = b.budget ?? -1;
          result = av - bv;
          break;
        }
      }
      return sortDir === "asc" ? result : -result;
    });

    return sorted;
  }, [workspace.projects, activeTab, filterMode, currentUserId, todayIso, search, sortField, sortDir]);

  const handleToggleArchive = (projectId: string, isArchived: boolean, name: string) => {
    startTransition(async () => {
      const res = await toggleProjectArchiveAction({ orgSlug, projectId, isArchived });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(isArchived ? `Archived "${name}"` : `Restored "${name}"`);
    });
  };

  const openNewWithTemplate = (template: ProjectTemplateKey) => {
    setSheetTemplate(template);
    setSheetOpen(true);
  };

  const showProjectCollection =
    activeTab === "active" || activeTab === "public" || activeTab === "archived";

  const visibleColCount =
    COLUMN_CONFIG.filter((c) => visibleColumns[c.key]).length + 1;

  return (
    <div className="flex flex-col">
      {/* Zoho-style Top Sub-Header & Tabs */}
      <div className="border-b bg-background px-4 pt-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground">
              Manage delivery workspaces, phases, task progress roll-ups, and client budgets.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects, tags..."
                className="h-9 pl-8 text-xs"
              />
            </div>

            {canWrite && (
              <Button onClick={() => openNewWithTemplate("NONE")}>
                <Plus className="size-4" />
                New Project
              </Button>
            )}
          </div>
        </div>

        <nav className="mt-4 flex gap-5 overflow-x-auto" aria-label="Projects views">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
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

      {/* Zoho-Style Sub-Toolbar (View Switcher, Filter, Columns, Automation) */}
      {showProjectCollection && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2.5 lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {/* View Switcher */}
            <div
              className="inline-flex items-center rounded-lg border bg-background p-0.5 shadow-2xs"
              role="group"
              aria-label="Project view switcher"
            >
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  viewMode === "list"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <List className="size-3.5" />
                List View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("board")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  viewMode === "board"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Kanban className="size-3.5" />
                Board
              </button>
              <button
                type="button"
                onClick={() => setViewMode("gantt")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  viewMode === "gantt"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <GanttChart className="size-3.5" />
                Gantt
              </button>
            </div>

            {/* Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                  <Filter className="size-3.5" />
                  <span>{FILTER_LABELS[filterMode]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel>Filter Projects</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={filterMode}
                  onValueChange={(val) => setFilterMode(val as ProjectFilterMode)}
                >
                  <DropdownMenuRadioItem value="all">All Projects</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="mine">My Projects</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="overdue">Overdue</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Badge variant="secondary" className="text-xs tabular-nums">
              {filteredAndSortedProjects.length} shown
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {/* Column Customization */}
            {viewMode === "list" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
                    <Columns3 className="size-3.5" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {COLUMN_CONFIG.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      disabled={col.required}
                      checked={visibleColumns[col.key]}
                      onCheckedChange={(checked) =>
                        setVisibleColumns((prev) => ({
                          ...prev,
                          [col.key]: Boolean(checked),
                        }))
                      }
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <button
                    type="button"
                    onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}
                    className="w-full px-2 py-1.5 text-left text-xs font-medium text-primary hover:bg-accent"
                  >
                    Reset all columns
                  </button>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Automation Button */}
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
          </div>
        </div>
      )}

      {/* Tab Body */}
      <div className="p-4 lg:p-6">
        {activeTab === "templates" ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                key: "CLIENT_ONBOARDING" as const,
                title: "Client Onboarding",
                desc: "3 phases (Kickoff, Configuration, Go-Live) with 5 pre-built tasks.",
              },
              {
                key: "SOFTWARE_DELIVERY" as const,
                title: "Software Delivery",
                desc: "3 phases (Architecture, Core Build, UAT & Deployment) with 5 tasks.",
              },
              {
                key: "MARKETING_LAUNCH" as const,
                title: "Marketing Campaign Launch",
                desc: "3 phases covering messaging, CRM UTM tracking, and attribution.",
              },
              {
                key: "FINANCE_ERP_ROLLOUT" as const,
                title: "ERP & Finance Rollout",
                desc: "3 phases covering PHP/USD tax setup, CRM billing, and parallel close.",
              },
              {
                key: "SECURITY_AUDIT" as const,
                title: "Security & Compliance Audit",
                desc: "3 phases covering RBAC/tenant review, remediation, and sign-off.",
              },
              {
                key: "NONE" as const,
                title: "Blank Project",
                desc: "Start from scratch with custom milestones, tasks, and strict schedule rules.",
              },
            ].map((tpl) => (
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
        ) : activeTab === "groups" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workspace.groups.length === 0 ? (
              <Card className="sm:col-span-2 lg:col-span-3">
                <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No project groups yet. Create one inside the New Project drawer.
                </CardContent>
              </Card>
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
                    {visibleColumns.id && <TableHead className="whitespace-nowrap">ID</TableHead>}
                    {visibleColumns.name && (
                      <TableHead className="whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSort("name")}
                          className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                        >
                          Project Name
                          {renderSortIcon("name")}
                        </button>
                      </TableHead>
                    )}
                    {visibleColumns.completion && (
                      <TableHead className="w-36 whitespace-nowrap">% Completion</TableHead>
                    )}
                    {visibleColumns.owner && (
                      <TableHead className="whitespace-nowrap">Owner</TableHead>
                    )}
                    {visibleColumns.status && (
                      <TableHead className="whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSort("status")}
                          className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                        >
                          Status
                          {renderSortIcon("status")}
                        </button>
                      </TableHead>
                    )}
                    {visibleColumns.tasks && (
                      <TableHead className="whitespace-nowrap">Tasks</TableHead>
                    )}
                    {visibleColumns.phases && (
                      <TableHead className="whitespace-nowrap">Phases</TableHead>
                    )}
                    {visibleColumns.issues && (
                      <TableHead className="whitespace-nowrap">Issues</TableHead>
                    )}
                    {visibleColumns.startDate && (
                      <TableHead className="whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSort("startDate")}
                          className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                        >
                          Start Date
                          {renderSortIcon("startDate")}
                        </button>
                      </TableHead>
                    )}
                    {visibleColumns.dueDate && (
                      <TableHead className="whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSort("dueDate")}
                          className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                        >
                          End Date
                          {renderSortIcon("dueDate")}
                        </button>
                      </TableHead>
                    )}
                    {visibleColumns.budget && (
                      <TableHead className="whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleSort("budget")}
                          className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                        >
                          Budget
                          {renderSortIcon("budget")}
                        </button>
                      </TableHead>
                    )}
                    {visibleColumns.tags && (
                      <TableHead className="whitespace-nowrap">Tags</TableHead>
                    )}
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedProjects.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={visibleColCount}
                        className="h-28 text-center text-muted-foreground"
                      >
                        No projects found in this view.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedProjects.map((project, idx) => {
                      const overdue = isProjectOverdue(project, todayIso);
                      return (
                        <TableRow
                          key={project.id}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("a,button,input,select")) return;
                            router.push(`/${orgSlug}/projects/${project.id}`);
                          }}
                          className={cn(
                            "cursor-pointer transition-colors hover:bg-muted/40",
                            highlightProjectId === project.id && "bg-violet-500/10",
                          )}
                        >
                          {visibleColumns.id && (
                            <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                              PRJ-{String(idx + 1).padStart(3, "0")}
                            </TableCell>
                          )}

                          {visibleColumns.name && (
                            <TableCell className="min-w-52">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    href={`/${orgSlug}/projects/${project.id}`}
                                    className="font-semibold text-foreground hover:text-primary hover:underline"
                                  >
                                    {project.name}
                                  </Link>
                                  {project.isStrict && (
                                    <Lock
                                      className="size-3 shrink-0 text-amber-600"
                                      aria-label="Strict project"
                                    />
                                  )}
                                  {project.source === "AUTOMATION" && (
                                    <Sparkles
                                      className="size-3 shrink-0 text-violet-600"
                                      aria-label="Auto-created from Closed Won Deal"
                                    />
                                  )}
                                </div>
                                {(project.group || project.company) && (
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
                          )}

                          {visibleColumns.completion && (
                            <TableCell className="min-w-32">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs tabular-nums">
                                  <span className="font-semibold">{project.completionPercent}%</span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-violet-600 transition-all"
                                    style={{ width: `${project.completionPercent}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          )}

                          {visibleColumns.owner && (
                            <TableCell className="whitespace-nowrap">
                              {project.owner ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="size-6">
                                    {project.owner.avatarUrl && (
                                      <AvatarImage
                                        src={project.owner.avatarUrl}
                                        alt={project.owner.name}
                                      />
                                    )}
                                    <AvatarFallback className="text-[10px]">
                                      {initials(project.owner.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{project.owner.name}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Unassigned</span>
                              )}
                            </TableCell>
                          )}

                          {visibleColumns.status && (
                            <TableCell className="whitespace-nowrap">
                              <Badge variant="secondary">{project.status}</Badge>
                            </TableCell>
                          )}

                          {visibleColumns.tasks && (
                            <TableCell className="whitespace-nowrap">
                              <Link
                                href={`/${orgSlug}/projects/tasks?projectId=${project.id}`}
                                className="inline-flex items-center gap-1.5 hover:opacity-80"
                              >
                                <span className="text-sm font-medium tabular-nums">
                                  {project.taskCount}
                                </span>
                                <Badge variant="outline" className="px-1.5 py-0 text-[10px] tabular-nums">
                                  {project.doneTaskCount}/{project.taskCount}
                                </Badge>
                              </Link>
                            </TableCell>
                          )}

                          {visibleColumns.phases && (
                            <TableCell className="text-sm tabular-nums whitespace-nowrap text-muted-foreground">
                              {project.milestoneCount}
                            </TableCell>
                          )}

                          {visibleColumns.issues && (
                            <TableCell className="whitespace-nowrap">
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
                          )}

                          {visibleColumns.startDate && (
                            <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                              {project.startDate
                                ? formatDate(project.startDate, { withYear: true })
                                : "—"}
                            </TableCell>
                          )}

                          {visibleColumns.dueDate && (
                            <TableCell
                              className={cn(
                                "text-sm whitespace-nowrap",
                                overdue ? "font-semibold text-rose-600" : "text-muted-foreground",
                              )}
                            >
                              {project.dueDate
                                ? formatDate(project.dueDate, { withYear: true })
                                : "—"}
                            </TableCell>
                          )}

                          {visibleColumns.budget && (
                            <TableCell className="text-sm font-medium tabular-nums whitespace-nowrap">
                              {project.budget !== null
                                ? formatCurrency(project.budget, project.currency)
                                : "—"}
                            </TableCell>
                          )}

                          {visibleColumns.tags && (
                            <TableCell>
                              <div className="flex max-w-48 flex-wrap gap-1">
                                {project.tags.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">—</span>
                                ) : (
                                  project.tags.map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="outline"
                                      className={cn(
                                        "px-1.5 py-0 text-[10px]",
                                        getTagPillClass(tag),
                                      )}
                                    >
                                      #{tag}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                          )}

                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button asChild size="xs" variant="ghost">
                                <Link href={`/${orgSlug}/projects/${project.id}`}>
                                  <FolderKanban className="size-3.5" />
                                  Open
                                </Link>
                              </Button>
                              {canWrite && (
                                <Button
                                  type="button"
                                  size="icon-xs"
                                  variant="ghost"
                                  title={project.isArchived ? "Restore project" : "Archive project"}
                                  onClick={() =>
                                    handleToggleArchive(project.id, !project.isArchived, project.name)
                                  }
                                >
                                  {project.isArchived ? (
                                    <ArchiveRestore className="size-3.5" />
                                  ) : (
                                    <Archive className="size-3.5" />
                                  )}
                                </Button>
                              )}
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

      <ProjectsAutomationDialog
        open={automationOpen}
        onOpenChange={setAutomationOpen}
        orgSlug={orgSlug}
      />
    </div>
  );
}
