"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MilestoneStatus } from "@prisma/client";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Flag,
  GitBranch,
  Layers,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  createMilestoneAction,
  updateMilestoneDetailsAction,
  updateMilestoneStatusAction,
} from "@/modules/projects/projects.actions";
import { attachZohoMeta, type PhaseMeta } from "@/modules/projects/zoho-meta";

export interface PhaseRowDTO {
  id: string;
  phaseKey: string;
  projectId: string;
  projectName: string;
  name: string;
  description: string | null;
  status: MilestoneStatus;
  startDate: string | null;
  dueDate: string | null;
  position: number;
  flag: "Internal" | "External";
  ownerId: string | null;
  ownerName: string;
  dependsOnId: string | null;
  dependsOnName: string | null;
  totalTasks: number;
  doneTasks: number;
  signoffStatus: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

const STATUS_META: Record<
  MilestoneStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  PENDING: {
    label: "Not Started",
    badgeClass:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    dotClass: "bg-slate-400",
  },
  IN_PROGRESS: {
    label: "In Progress",
    badgeClass:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/60 dark:text-sky-300",
    dotClass: "bg-sky-500",
  },
  COMPLETED: {
    label: "Completed",
    badgeClass:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
  },
};

export function MilestonesPanel({
  orgSlug,
  todayIso,
  milestones,
  projects,
  members,
  canWrite,
  openCreateInitially = false,
}: {
  orgSlug: string;
  todayIso: string;
  milestones: PhaseRowDTO[];
  projects: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
  canWrite: boolean;
  openCreateInitially?: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState<PhaseRowDTO[]>(milestones);
  const [search, setSearch] = React.useState("");
  const [projectFilter, setProjectFilter] = React.useState("");
  const [flagFilter, setFlagFilter] = React.useState<"ALL" | "Internal" | "External">("ALL");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | MilestoneStatus>("ALL");
  const [viewMode, setViewMode] = React.useState<"table" | "grouped">("table");
  const [isPending, startTransition] = React.useTransition();

  // Create phase drawer state
  const [createOpen, setCreateOpen] = React.useState(openCreateInitially);
  const [createProjectId, setCreateProjectId] = React.useState(projects[0]?.id ?? "");
  const [createName, setCreateName] = React.useState("");
  const [createStartDate, setCreateStartDate] = React.useState(todayIso);
  const [createDueDate, setCreateDueDate] = React.useState("");
  const [createFlag, setCreateFlag] = React.useState<"Internal" | "External">("Internal");
  const [createOwnerId, setCreateOwnerId] = React.useState(members[0]?.id ?? "");
  const [createDependsOnId, setCreateDependsOnId] = React.useState("");
  const [createDescription, setCreateDescription] = React.useState("");

  // Edit phase drawer state
  const [editingPhase, setEditingPhase] = React.useState<PhaseRowDTO | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editStatus, setEditStatus] = React.useState<MilestoneStatus>(MilestoneStatus.PENDING);
  const [editStartDate, setEditStartDate] = React.useState("");
  const [editDueDate, setEditDueDate] = React.useState("");
  const [editFlag, setEditFlag] = React.useState<"Internal" | "External">("Internal");
  const [editOwnerId, setEditOwnerId] = React.useState("");
  const [editDependsOnId, setEditDependsOnId] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");

  React.useEffect(() => {
    setItems(milestones);
  }, [milestones]);

  React.useEffect(() => {
    if (openCreateInitially) setCreateOpen(true);
  }, [openCreateInitially]);

  React.useEffect(() => {
    const onQuickAdd = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "milestones") setCreateOpen(true);
    };
    window.addEventListener("bs-quick-add", onQuickAdd);
    return () => window.removeEventListener("bs-quick-add", onQuickAdd);
  }, []);

  const openEditDrawer = (phase: PhaseRowDTO) => {
    setEditingPhase(phase);
    setEditName(phase.name);
    setEditStatus(phase.status);
    setEditStartDate(phase.startDate ?? "");
    setEditDueDate(phase.dueDate ?? "");
    setEditFlag(phase.flag);
    setEditOwnerId(phase.ownerId ?? "");
    setEditDependsOnId(phase.dependsOnId ?? "");
    setEditDescription(phase.description ?? "");
  };

  const visiblePhases = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) => {
      if (projectFilter && m.projectId !== projectFilter) return false;
      if (flagFilter !== "ALL" && m.flag !== flagFilter) return false;
      if (statusFilter !== "ALL" && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.phaseKey.toLowerCase().includes(q) ||
        m.projectName.toLowerCase().includes(q) ||
        m.ownerName.toLowerCase().includes(q) ||
        (m.dependsOnName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [items, search, projectFilter, flagFilter, statusFilter]);

  const groupedByProject = React.useMemo(() => {
    const groups = new Map<string, { projectId: string; projectName: string; phases: PhaseRowDTO[] }>();
    for (const p of visiblePhases) {
      const entry = groups.get(p.projectId) ?? {
        projectId: p.projectId,
        projectName: p.projectName,
        phases: [],
      };
      entry.phases.push(p);
      groups.set(p.projectId, entry);
    }
    return Array.from(groups.values());
  }, [visiblePhases]);

  const summary = React.useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.status === MilestoneStatus.COMPLETED).length;
    const inProgress = items.filter((i) => i.status === MilestoneStatus.IN_PROGRESS).length;
    const external = items.filter((i) => i.flag === "External").length;
    const overdue = items.filter(
      (i) => i.status !== MilestoneStatus.COMPLETED && i.dueDate && i.dueDate < todayIso,
    ).length;
    return { total, completed, inProgress, external, overdue };
  }, [items, todayIso]);

  const handleStatusChange = (phase: PhaseRowDTO, nextStatus: MilestoneStatus) => {
    if (!canWrite) return;
    setItems((prev) =>
      prev.map((m) => (m.id === phase.id ? { ...m, status: nextStatus } : m)),
    );
    startTransition(async () => {
      const res = await updateMilestoneStatusAction({
        orgSlug,
        milestoneId: phase.id,
        status: nextStatus,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        setItems((prev) =>
          prev.map((m) => (m.id === phase.id ? { ...m, status: phase.status } : m)),
        );
        return;
      }
      toast.success(`Phase marked ${STATUS_META[nextStatus].label}`);
      router.refresh();
    });
  };

  const handleToggleFlag = (phase: PhaseRowDTO) => {
    if (!canWrite) return;
    const nextFlag: "Internal" | "External" =
      phase.flag === "Internal" ? "External" : "Internal";
    const meta: PhaseMeta = {
      flag: nextFlag,
      startDate: phase.startDate,
      ownerId: phase.ownerId,
      ownerName: phase.ownerName,
      dependsOnId: phase.dependsOnId,
    };
    const encodedDescription = attachZohoMeta(phase.description, meta);
    setItems((prev) =>
      prev.map((m) => (m.id === phase.id ? { ...m, flag: nextFlag } : m)),
    );
    startTransition(async () => {
      const res = await updateMilestoneDetailsAction({
        orgSlug,
        milestoneId: phase.id,
        description: encodedDescription,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        router.refresh();
        return;
      }
      toast.success(`Phase flag updated to ${nextFlag}`);
      router.refresh();
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createProjectId || !createName.trim()) {
      toast.error("Project and Phase Name are required.");
      return;
    }
    const owner = members.find((m) => m.id === createOwnerId);
    const meta: PhaseMeta = {
      flag: createFlag,
      startDate: createStartDate || null,
      ownerId: owner?.id ?? null,
      ownerName: owner?.name ?? null,
      dependsOnId: createDependsOnId || null,
    };
    const description = attachZohoMeta(createDescription, meta);
    startTransition(async () => {
      const res = await createMilestoneAction({
        orgSlug,
        projectId: createProjectId,
        name: createName.trim(),
        description,
        dueDate: createDueDate || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Phase created.");
      setCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreateDependsOnId("");
      router.refresh();
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhase || !editName.trim()) return;
    const owner = members.find((m) => m.id === editOwnerId);
    const meta: PhaseMeta = {
      flag: editFlag,
      startDate: editStartDate || null,
      ownerId: owner?.id ?? null,
      ownerName: owner?.name ?? editingPhase.ownerName,
      dependsOnId: editDependsOnId || null,
    };
    const description = attachZohoMeta(editDescription, meta);
    startTransition(async () => {
      const res = await updateMilestoneDetailsAction({
        orgSlug,
        milestoneId: editingPhase.id,
        name: editName.trim(),
        status: editStatus,
        dueDate: editDueDate || null,
        description,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Phase details updated.");
      setEditingPhase(null);
      router.refresh();
    });
  };

  const renderPhaseRow = (phase: PhaseRowDTO) => {
    const pct =
      phase.totalTasks > 0
        ? Math.round((phase.doneTasks / phase.totalTasks) * 100)
        : phase.status === MilestoneStatus.COMPLETED
          ? 100
          : 0;
    const isOverdue =
      phase.status !== MilestoneStatus.COMPLETED &&
      Boolean(phase.dueDate && phase.dueDate < todayIso);
    const statusInfo = STATUS_META[phase.status];

    return (
      <tr
        key={phase.id}
        className="group border-b border-border/60 transition hover:bg-muted/35 dark:border-zinc-800/80 dark:hover:bg-zinc-900/60"
      >
        <td className="px-4 py-3 align-middle">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground dark:bg-zinc-800 dark:text-zinc-400">
              {phase.phaseKey}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditDrawer(phase)}
                  className="truncate text-left text-sm font-semibold text-foreground hover:text-primary"
                >
                  {phase.name}
                </button>
                {phase.signoffStatus && (
                  <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]">
                    <ShieldCheck className="size-3 text-emerald-500" />
                    {phase.signoffStatus}
                  </Badge>
                )}
              </div>
              {phase.description && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {phase.description}
                </p>
              )}
              {phase.dependsOnName && (
                <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-indigo-200/80 bg-indigo-50/70 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300">
                  <GitBranch className="size-2.5" />
                  Depends on: {phase.dependsOnName}
                </div>
              )}
            </div>
          </div>
        </td>

        <td className="px-3 py-3 align-middle">
          <Link
            href={`/${orgSlug}/projects/${phase.projectId}`}
            className="text-xs font-medium text-foreground hover:text-primary hover:underline"
          >
            {phase.projectName}
          </Link>
        </td>

        <td className="px-3 py-3 align-middle">
          <button
            type="button"
            disabled={!canWrite}
            onClick={() => handleToggleFlag(phase)}
            title={canWrite ? "Click to toggle Internal / External" : undefined}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
              phase.flag === "External"
                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300"
                : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200/80 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
            )}
          >
            <Flag className="size-3" />
            {phase.flag}
          </button>
        </td>

        <td className="px-3 py-3 align-middle">
          <div className="flex items-center gap-2">
            <Avatar className="size-6 border border-border dark:border-zinc-700">
              <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                {getInitials(phase.ownerName)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-foreground">{phase.ownerName}</span>
          </div>
        </td>

        <td className="w-44 px-3 py-3 align-middle">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium tabular-nums text-foreground">
              {phase.doneTasks}/{phase.totalTasks} tasks
            </span>
            <span className="tabular-nums text-muted-foreground">{pct}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted dark:bg-zinc-800">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                pct === 100
                  ? "bg-emerald-500"
                  : isOverdue
                    ? "bg-rose-500"
                    : "bg-primary",
              )}
              style={{ width: `${Math.max(pct, phase.totalTasks > 0 ? 4 : 0)}%` }}
            />
          </div>
        </td>

        <td className="px-3 py-3 align-middle text-xs">
          <div className="flex flex-col gap-0.5 tabular-nums">
            <span className="text-[11px] text-muted-foreground">
              Start: {phase.startDate ?? "—"}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                isOverdue ? "text-rose-600 dark:text-rose-400" : "text-foreground",
              )}
            >
              <Calendar className="size-3" />
              {phase.dueDate ?? "No due date"}
              {isOverdue && (
                <span className="rounded bg-rose-100 px-1 py-0 text-[9px] font-bold uppercase text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
                  Overdue
                </span>
              )}
            </span>
          </div>
        </td>

        <td className="px-3 py-3 align-middle">
          {canWrite ? (
            <select
              value={phase.status}
              disabled={isPending}
              onChange={(e) => handleStatusChange(phase, e.target.value as MilestoneStatus)}
              className={cn(
                "h-7 rounded-full border px-2.5 text-[11px] font-semibold outline-none transition",
                statusInfo.badgeClass,
              )}
            >
              <option value={MilestoneStatus.PENDING}>Not Started</option>
              <option value={MilestoneStatus.IN_PROGRESS}>In Progress</option>
              <option value={MilestoneStatus.COMPLETED}>Completed</option>
            </select>
          ) : (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                statusInfo.badgeClass,
              )}
            >
              <span className={cn("size-1.5 rounded-full", statusInfo.dotClass)} />
              {statusInfo.label}
            </span>
          )}
        </td>

        <td className="px-3 py-3 text-right align-middle">
          {canWrite && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => openEditDrawer(phase)}
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Edit phase details"
            >
              <Pencil className="size-3.5" />
            </Button>
          )}
        </td>
      </tr>
    );
  };

  const projectPhasesForCreate = React.useMemo(
    () => items.filter((p) => p.projectId === createProjectId),
    [items, createProjectId],
  );

  const projectPhasesForEdit = React.useMemo(
    () =>
      editingPhase
        ? items.filter((p) => p.projectId === editingPhase.projectId && p.id !== editingPhase.id)
        : [],
    [items, editingPhase],
  );

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Phases & Milestones</h1>
          <p className="text-xs text-muted-foreground">
            Track delivery phases, completion progress, client-facing flags, and phase dependencies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-background p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                viewMode === "table"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grouped")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                viewMode === "grouped"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-3.5" />
              By Project
            </button>
          </div>

          {canWrite && (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              Add Phase
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Phases</span>
            <Layers className="size-3.5 text-primary" />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{summary.total}</p>
        </div>
        <div className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>In Progress</span>
            <Clock className="size-3.5 text-sky-500" />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-sky-600 dark:text-sky-400">
            {summary.inProgress}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Completed</span>
            <CheckCircle2 className="size-3.5 text-emerald-500" />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {summary.completed}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>External Flags</span>
            <Flag className="size-3.5 text-amber-500" />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {summary.external}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Overdue</span>
            <Calendar className="size-3.5 text-rose-500" />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {summary.overdue}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search phases, projects, owners, dependencies..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="h-8 rounded-md border bg-background px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={flagFilter}
          onChange={(e) => setFlagFilter(e.target.value as "ALL" | "Internal" | "External")}
          className="h-8 rounded-md border bg-background px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="ALL">All Flags</option>
          <option value="Internal">Internal</option>
          <option value="External">External</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "ALL" | MilestoneStatus)}
          className="h-8 rounded-md border bg-background px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="ALL">All Statuses</option>
          <option value={MilestoneStatus.PENDING}>Not Started</option>
          <option value={MilestoneStatus.IN_PROGRESS}>In Progress</option>
          <option value={MilestoneStatus.COMPLETED}>Completed</option>
        </select>
      </div>

      {/* Content */}
      {visiblePhases.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={items.length === 0 ? "No delivery phases yet" : "No phases match your filters"}
          description="Break client engagements into dated phases and milestones to track task completion and dependencies."
          action={
            canWrite && projects.length > 0
              ? {
                  label: "New Phase",
                  icon: <Plus className="size-3.5" />,
                  onClick: () => setCreateOpen(true),
                }
              : undefined
          }
          secondaryAction={
            projectFilter || flagFilter !== "ALL" || statusFilter !== "ALL" || search.trim()
              ? {
                  label: "Reset filters",
                  onClick: () => {
                    setProjectFilter("");
                    setFlagFilter("ALL");
                    setStatusFilter("ALL");
                    setSearch("");
                  },
                }
              : undefined
          }
        />
      ) : viewMode === "table" ? (
        <div className="overflow-x-auto rounded-xl border bg-card dark:border-zinc-800 dark:bg-zinc-900/70">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:border-zinc-800 dark:bg-zinc-950/60">
                <th className="px-4 py-2.5">Phase & Dependency</th>
                <th className="px-3 py-2.5">Project</th>
                <th className="px-3 py-2.5">Flag</th>
                <th className="px-3 py-2.5">Owner</th>
                <th className="px-3 py-2.5">Progress</th>
                <th className="px-3 py-2.5">Schedule</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>{visiblePhases.map(renderPhaseRow)}</tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groupedByProject.map((group) => (
            <div
              key={group.projectId}
              className="overflow-hidden rounded-xl border bg-card dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/60">
                <Link
                  href={`/${orgSlug}/projects/${group.projectId}`}
                  className="text-sm font-semibold text-foreground hover:text-primary"
                >
                  {group.projectName}
                </Link>
                <Badge variant="secondary" className="text-[11px]">
                  {group.phases.length} {group.phases.length === 1 ? "phase" : "phases"}
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <tbody>{group.phases.map(renderPhaseRow)}</tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Phase Sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Create Project Phase</SheetTitle>
            <SheetDescription>
              Define a project phase with schedule dates, ownership, visibility flag, and dependency link.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateSubmit} className="mt-5 flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <select
                value={createProjectId}
                onChange={(e) => {
                  setCreateProjectId(e.target.value);
                  setCreateDependsOnId("");
                }}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Phase Name</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g., Phase 2: UAT & Client Sign-Off"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={createStartDate}
                  onChange={(e) => setCreateStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End / Due Date</Label>
                <Input
                  type="date"
                  value={createDueDate}
                  onChange={(e) => setCreateDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Flag</Label>
                <select
                  value={createFlag}
                  onChange={(e) => setCreateFlag(e.target.value as "Internal" | "External")}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="Internal">Internal</option>
                  <option value="External">External (Client-Facing)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Phase Owner</Label>
                <select
                  value={createOwnerId}
                  onChange={(e) => setCreateOwnerId(e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="">Project Default Owner</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Predecessor Dependency (Optional)</Label>
              <select
                value={createDependsOnId}
                onChange={(e) => setCreateDependsOnId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="">No dependency</option>
                {projectPhasesForCreate.map((ph) => (
                  <option key={ph.id} value={ph.id}>
                    {ph.phaseKey}: {ph.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                rows={3}
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Deliverables, sign-off criteria, or dependencies..."
                className="w-full rounded-md border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
            <SheetFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Phase"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit Phase Sheet */}
      <Sheet open={Boolean(editingPhase)} onOpenChange={(v) => !v && setEditingPhase(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit Phase {editingPhase?.phaseKey}</SheetTitle>
            <SheetDescription>{editingPhase?.projectName}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleEditSubmit} className="mt-5 flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label>Phase Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as MilestoneStatus)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value={MilestoneStatus.PENDING}>Not Started</option>
                  <option value={MilestoneStatus.IN_PROGRESS}>In Progress</option>
                  <option value={MilestoneStatus.COMPLETED}>Completed</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Flag</Label>
                <select
                  value={editFlag}
                  onChange={(e) => setEditFlag(e.target.value as "Internal" | "External")}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="Internal">Internal</option>
                  <option value="External">External (Client-Facing)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End / Due Date</Label>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Phase Owner</Label>
              <select
                value={editOwnerId}
                onChange={(e) => setEditOwnerId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="">Project Default Owner</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Predecessor Dependency</Label>
              <select
                value={editDependsOnId}
                onChange={(e) => setEditDependsOnId(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="">No dependency</option>
                {projectPhasesForEdit.map((ph) => (
                  <option key={ph.id} value={ph.id}>
                    {ph.phaseKey}: {ph.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-md border bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
            <SheetFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setEditingPhase(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
