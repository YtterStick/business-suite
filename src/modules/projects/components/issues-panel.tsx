"use client";

import * as React from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IssueSeverity, IssueStatus } from "@prisma/client";
import {
  AlertTriangle,
  Bug,
  Calendar,
  Columns3,
  GanttChart,
  GripVertical,
  Layers,
  List,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

function formatDate(iso: string): string {
  try {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}
import {
  createIssueAction,
  updateIssueDetailsAction,
  updateIssueStatusAction,
} from "@/modules/projects/projects.actions";
import type { IssueRowDTO } from "@/modules/projects/projects.types";
import {
  attachZohoMeta,
  extractZohoMeta,
  type IssueMeta,
} from "@/modules/projects/zoho-meta";

type IssueViewMode = "list" | "kanban" | "gantt";
type IssueGroupBy = "project" | "status" | "severity" | "classification" | "owner";

interface EnrichedIssue extends IssueRowDTO {
  issueKey: string;
  cleanDescription: string;
  classification: NonNullable<IssueMeta["classification"]>;
  reproducible: NonNullable<IssueMeta["reproducible"]>;
  affectedModule: string;
}

const SEVERITY_CONFIG: Record<
  IssueSeverity,
  { zohoLabel: string; badgeClass: string; barClass: string }
> = {
  CRITICAL: {
    zohoLabel: "Showstopper",
    badgeClass:
      "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/60 dark:text-rose-300",
    barClass: "bg-rose-500",
  },
  HIGH: {
    zohoLabel: "Critical",
    badgeClass:
      "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800/70 dark:bg-orange-950/60 dark:text-orange-300",
    barClass: "bg-orange-500",
  },
  MEDIUM: {
    zohoLabel: "Major",
    badgeClass:
      "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300",
    barClass: "bg-amber-500",
  },
  LOW: {
    zohoLabel: "Minor",
    badgeClass:
      "border-slate-300 bg-slate-100 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    barClass: "bg-slate-400",
  },
};

const ISSUE_COLUMNS: Array<{
  status: IssueStatus;
  label: string;
  dot: string;
}> = [
  { status: "OPEN", label: "Open", dot: "bg-rose-500" },
  { status: "IN_PROGRESS", label: "In Progress", dot: "bg-amber-500" },
  { status: "RESOLVED", label: "To Be Tested / Resolved", dot: "bg-sky-500" },
  { status: "CLOSED", label: "Closed", dot: "bg-emerald-500" },
];

const CLASSIFICATIONS: Array<NonNullable<IssueMeta["classification"]>> = [
  "Bug",
  "Crash",
  "UI/UX",
  "Security",
  "Performance",
  "Feature",
];

const REPRODUCIBLE_OPTIONS: Array<NonNullable<IssueMeta["reproducible"]>> = [
  "Always",
  "Sometimes",
  "Rarely",
  "Unable",
];

function inferIssueExtras(issue: IssueRowDTO, index: number): EnrichedIssue {
  const { cleanDescription, meta } = extractZohoMeta<IssueMeta>(issue.description);
  const titleLower = issue.title.toLowerCase();

  let fallbackClass: NonNullable<IssueMeta["classification"]> = "Bug";
  if (titleLower.includes("security") || titleLower.includes("auth") || titleLower.includes("xss")) {
    fallbackClass = "Security";
  } else if (titleLower.includes("crash") || titleLower.includes("500") || titleLower.includes("panic")) {
    fallbackClass = "Crash";
  } else if (titleLower.includes("ui") || titleLower.includes("css") || titleLower.includes("layout")) {
    fallbackClass = "UI/UX";
  } else if (titleLower.includes("slow") || titleLower.includes("latency") || titleLower.includes("timeout")) {
    fallbackClass = "Performance";
  }

  let fallbackModule = "Core Platform";
  if (titleLower.includes("billing") || titleLower.includes("invoice")) fallbackModule = "Finance & Billing";
  else if (titleLower.includes("webhook") || titleLower.includes("api")) fallbackModule = "Webhooks & API";
  else if (titleLower.includes("auth") || titleLower.includes("login")) fallbackModule = "Auth & SSO";
  else if (titleLower.includes("kanban") || titleLower.includes("task")) fallbackModule = "Tasks & Kanban";

  return {
    ...issue,
    issueKey: `IS-${index + 1}`,
    cleanDescription,
    classification: meta.classification ?? fallbackClass,
    reproducible: meta.reproducible ?? (issue.severity === "CRITICAL" ? "Always" : "Sometimes"),
    affectedModule: meta.affectedModule ?? fallbackModule,
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function SortableIssueCard({
  issue,
  canWrite,
  activeTimerEntityId,
  onOpenDetail,
  onToggleTimer,
}: {
  issue: EnrichedIssue;
  canWrite: boolean;
  activeTimerEntityId: string | null;
  onOpenDetail: (issue: EnrichedIssue) => void;
  onToggleTimer: (issue: EnrichedIssue) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    disabled: !canWrite,
  });

  const sev = SEVERITY_CONFIG[issue.severity];
  const timerId = `issue:${issue.id}`;
  const isTimerRunning = activeTimerEntityId === timerId;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-lg border bg-background p-3 shadow-xs transition hover:border-primary/40 dark:border-zinc-800 dark:bg-zinc-900",
        isDragging && "opacity-60 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpenDetail(issue)}
          className="text-left"
        >
          <span className="font-mono text-[10px] font-semibold text-primary">
            {issue.issueKey}
          </span>
          <p className="mt-0.5 text-sm font-medium leading-snug text-foreground hover:text-primary">
            {issue.title}
          </p>
        </button>
        {canWrite && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
            aria-label="Drag issue"
          >
            <GripVertical className="size-3.5" />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
        <Badge variant="outline" className={cn("px-1.5 py-0 font-semibold", sev.badgeClass)}>
          {sev.zohoLabel}
        </Badge>
        <Badge variant="secondary" className="px-1.5 py-0 font-normal">
          {issue.classification}
        </Badge>
        <span className="truncate text-muted-foreground">{issue.affectedModule}</span>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground dark:border-zinc-800">
        <div className="flex items-center gap-1.5 truncate">
          {issue.assignee ? (
            <>
              <Avatar className="size-5 border dark:border-zinc-700">
                <AvatarFallback className="text-[9px] font-semibold">
                  {getInitials(issue.assignee.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{issue.assignee.name}</span>
            </>
          ) : (
            <span>Unassigned</span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleTimer(issue);
          }}
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition",
            isTimerRunning
              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          title={isTimerRunning ? "Pause timer" : "Start live timer for this issue"}
        >
          {isTimerRunning ? <Pause className="size-3" /> : <Play className="size-3" />}
          {isTimerRunning ? "Tracking" : "Log Time"}
        </button>
      </div>
    </div>
  );
}

function IssueKanbanColumn({
  status,
  label,
  dot,
  issues,
  canWrite,
  activeTimerEntityId,
  onOpenDetail,
  onToggleTimer,
}: {
  status: IssueStatus;
  label: string;
  dot: string;
  issues: EnrichedIssue[];
  canWrite: boolean;
  activeTimerEntityId: string | null;
  onOpenDetail: (issue: EnrichedIssue) => void;
  onToggleTimer: (issue: EnrichedIssue) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `issue-col:${status}` });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-76 shrink-0 flex-col rounded-xl border bg-muted/35 p-3 transition dark:border-zinc-800 dark:bg-zinc-900/50",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={cn("size-2 rounded-full", dot)} />
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
          {issues.length}
        </Badge>
      </div>
      <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          {issues.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed px-3 text-center text-xs text-muted-foreground dark:border-zinc-800">
              Drag an existing Issue and drop it under this category.
            </div>
          ) : (
            issues.map((issue) => (
              <SortableIssueCard
                key={issue.id}
                issue={issue}
                canWrite={canWrite}
                activeTimerEntityId={activeTimerEntityId}
                onOpenDetail={onOpenDetail}
                onToggleTimer={onToggleTimer}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function IssuesPanel({
  orgSlug,
  todayIso = "",
  issues,
  projects,
  members,
  canWrite,
  openCreateInitially = false,
}: {
  orgSlug: string;
  todayIso?: string;
  issues: IssueRowDTO[];
  projects: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
  canWrite: boolean;
  openCreateInitially?: boolean;
}) {
  const dndId = React.useId();
  const [localIssues, setLocalIssues] = React.useState(issues);
  const [viewMode, setViewMode] = React.useState<IssueViewMode>("list");
  const [groupBy, setGroupBy] = React.useState<IssueGroupBy>("project");
  const [projectFilter, setProjectFilter] = React.useState("");
  const [severityFilter, setSeverityFilter] = React.useState<"ALL" | IssueSeverity>("ALL");
  const [classFilter, setClassFilter] = React.useState<string>("ALL");
  const [search, setSearch] = React.useState("");
  const [activeTimerEntityId, setActiveTimerEntityId] = React.useState<string | null>(null);

  // Create issue drawer state
  const [open, setOpen] = React.useState(openCreateInitially);
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? "");
  const [title, setTitle] = React.useState("");
  const [severity, setSeverity] = React.useState<IssueSeverity>("MEDIUM");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [classification, setClassification] =
    React.useState<NonNullable<IssueMeta["classification"]>>("Bug");
  const [reproducible, setReproducible] =
    React.useState<NonNullable<IssueMeta["reproducible"]>>("Always");
  const [affectedModule, setAffectedModule] = React.useState("Core Platform");
  const [description, setDescription] = React.useState("");

  // Detail / Edit drawer state
  const [detailIssue, setDetailIssue] = React.useState<EnrichedIssue | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editStatus, setEditStatus] = React.useState<IssueStatus>("OPEN");
  const [editSeverity, setEditSeverity] = React.useState<IssueSeverity>("MEDIUM");
  const [editAssigneeId, setEditAssigneeId] = React.useState("");
  const [editDueDate, setEditDueDate] = React.useState("");
  const [editClassification, setEditClassification] =
    React.useState<NonNullable<IssueMeta["classification"]>>("Bug");
  const [editReproducible, setEditReproducible] =
    React.useState<NonNullable<IssueMeta["reproducible"]>>("Always");
  const [editAffectedModule, setEditAffectedModule] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");

  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setLocalIssues(issues);
  }, [issues]);

  React.useEffect(() => {
    if (openCreateInitially) setOpen(true);
  }, [openCreateInitially]);

  React.useEffect(() => {
    const onQuickAdd = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "issues") setOpen(true);
    };
    const onTimerState = (event: Event) => {
      const detail = (event as CustomEvent<{ running?: boolean; taskId?: string | null }>).detail;
      setActiveTimerEntityId(detail?.running ? detail.taskId ?? null : null);
    };
    window.addEventListener("bs-quick-add", onQuickAdd);
    window.addEventListener("bs-timer-state", onTimerState);
    return () => {
      window.removeEventListener("bs-quick-add", onQuickAdd);
      window.removeEventListener("bs-timer-state", onTimerState);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const enrichedIssues = React.useMemo(
    () => localIssues.map((issue, idx) => inferIssueExtras(issue, idx)),
    [localIssues],
  );

  const visibleIssues = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedIssues.filter((i) => {
      if (projectFilter && i.projectId !== projectFilter) return false;
      if (severityFilter !== "ALL" && i.severity !== severityFilter) return false;
      if (classFilter !== "ALL" && i.classification !== classFilter) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        i.issueKey.toLowerCase().includes(q) ||
        i.projectName.toLowerCase().includes(q) ||
        i.affectedModule.toLowerCase().includes(q) ||
        (i.assignee?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [enrichedIssues, projectFilter, severityFilter, classFilter, search]);

  const groupedIssues = React.useMemo(() => {
    const map = new Map<string, EnrichedIssue[]>();
    for (const issue of visibleIssues) {
      let key = "";
      switch (groupBy) {
        case "project":
          key = issue.projectName;
          break;
        case "status":
          key = issue.status;
          break;
        case "severity":
          key = `${SEVERITY_CONFIG[issue.severity].zohoLabel} (${issue.severity})`;
          break;
        case "classification":
          key = issue.classification;
          break;
        case "owner":
          key = issue.assignee?.name ?? "Unassigned";
          break;
      }
      const bucket = map.get(key) ?? [];
      bucket.push(issue);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).map(([label, list]) => ({ label, items: list }));
  }, [visibleIssues, groupBy]);

  const summary = React.useMemo(() => {
    const openCount = enrichedIssues.filter(
      (i) => i.status === "OPEN" || i.status === "IN_PROGRESS",
    ).length;
    const showstoppers = enrichedIssues.filter(
      (i) => i.severity === "CRITICAL" && i.status !== "CLOSED",
    ).length;
    const resolved = enrichedIssues.filter(
      (i) => i.status === "RESOLVED" || i.status === "CLOSED",
    ).length;
    return { total: enrichedIssues.length, openCount, showstoppers, resolved };
  }, [enrichedIssues]);

  const ganttTimeline = React.useMemo(() => {
    const refIso = todayIso || "2026-11-18";
    const rows = visibleIssues.map((issue) => {
      const startIso = issue.createdAt.slice(0, 10);
      const startMs = Date.parse(startIso);
      const rawEndMs = Date.parse(issue.dueDate ?? startIso);
      const endMs = Math.max(rawEndMs, startMs + 7 * 86400000);
      return { issue, startMs, endMs };
    });
    const minMs = rows.length > 0 ? Math.min(...rows.map((r) => r.startMs)) : Date.parse(refIso);
    const maxMs =
      rows.length > 0 ? Math.max(...rows.map((r) => r.endMs)) : Date.parse(refIso) + 14 * 86400000;
    const spanMs = Math.max(maxMs - minMs, 14 * 86400000);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) =>
      formatDate(new Date(minMs + spanMs * r).toISOString().slice(0, 10)),
    );
    return { rows, minMs, spanMs, ticks };
  }, [visibleIssues, todayIso]);

  const openDetailDrawer = (issue: EnrichedIssue) => {
    setDetailIssue(issue);
    setEditTitle(issue.title);
    setEditStatus(issue.status);
    setEditSeverity(issue.severity);
    setEditAssigneeId(issue.assignee?.id ?? "");
    setEditDueDate(issue.dueDate ?? "");
    setEditClassification(issue.classification);
    setEditReproducible(issue.reproducible);
    setEditAffectedModule(issue.affectedModule);
    setEditDescription(issue.cleanDescription);
  };

  const handleToggleTimer = (issue: EnrichedIssue) => {
    window.dispatchEvent(
      new CustomEvent("bs-toggle-task-timer", {
        detail: {
          projectId: issue.projectId,
          taskId: `issue:${issue.id}`,
          taskTitle: issue.title,
          taskKey: issue.issueKey,
        },
      }),
    );
  };

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fullDescription = attachZohoMeta<IssueMeta>(description, {
      classification,
      reproducible,
      affectedModule: affectedModule.trim() || "Core Platform",
    });
    startTransition(async () => {
      const res = await createIssueAction({
        orgSlug,
        projectId,
        title,
        description: fullDescription,
        severity,
        assigneeId: assigneeId || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setTitle("");
      setDescription("");
      setOpen(false);
      toast.success("Issue logged in BugTracker");
    });
  };

  const handleEditSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detailIssue || !editTitle.trim()) return;
    const fullDescription = attachZohoMeta<IssueMeta>(editDescription, {
      classification: editClassification,
      reproducible: editReproducible,
      affectedModule: editAffectedModule.trim() || "Core Platform",
    });
    startTransition(async () => {
      const res = await updateIssueDetailsAction({
        orgSlug,
        issueId: detailIssue.id,
        title: editTitle.trim(),
        status: editStatus,
        severity: editSeverity,
        assigneeId: editAssigneeId || null,
        dueDate: editDueDate || null,
        description: fullDescription,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Updated ${detailIssue.issueKey}`);
      setDetailIssue(null);
    });
  };

  const handleStatusChange = (issueId: string, status: IssueStatus) => {
    const prev = localIssues;
    setLocalIssues((list) => list.map((i) => (i.id === issueId ? { ...i, status } : i)));
    startTransition(async () => {
      const res = await updateIssueStatusAction({ orgSlug, issueId, status });
      if (!res.ok) {
        setLocalIssues(prev);
        toast.error(res.error.message);
      } else {
        toast.success(`Issue marked ${status}`);
      }
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !canWrite) return;
    const issueId = String(active.id);
    const overId = String(over.id);
    const nextStatus: IssueStatus | null = overId.startsWith("issue-col:")
      ? (overId.slice(10) as IssueStatus)
      : (localIssues.find((i) => i.id === overId)?.status ?? null);
    if (nextStatus) handleStatusChange(issueId, nextStatus);
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-4 dark:border-zinc-800 lg:px-6">
        <div>
          <div className="flex items-center gap-2">
            <Bug className="size-5 text-rose-500" />
            <h1 className="text-xl font-bold tracking-tight">Issues & BugTracker</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Track defects, showstoppers, classifications, reproducibility, and live time spent.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border bg-background p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-3.5" />
              Classic
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                viewMode === "kanban"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Columns3 className="size-3.5" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode("gantt")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                viewMode === "gantt"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <GanttChart className="size-3.5" />
              Gantt
            </button>
          </div>

          {canWrite && projects.length > 0 && (
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              Submit Issue
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip & Filter Toolbar */}
      <div className="space-y-4 p-4 lg:p-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
            <p className="text-xs text-muted-foreground">Total Issues</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{summary.total}</p>
          </div>
          <div className="rounded-xl border bg-card p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
            <p className="text-xs text-muted-foreground">Open / Active</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {summary.openCount}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldAlert className="size-3.5 text-rose-500" />
              Showstoppers
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
              {summary.showstoppers}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
            <p className="text-xs text-muted-foreground">Resolved / Closed</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {summary.resolved}
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search key (IS-1), title, module, assignee..."
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
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as "ALL" | IssueSeverity)}
            className="h-8 rounded-md border bg-background px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Showstopper</option>
            <option value="HIGH">Critical</option>
            <option value="MEDIUM">Major</option>
            <option value="LOW">Minor</option>
          </select>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="h-8 rounded-md border bg-background px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="ALL">All Classifications</option>
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {viewMode === "list" && (
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as IssueGroupBy)}
              className="h-8 rounded-md border bg-background px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="project">Group: Project</option>
              <option value="status">Group: Status</option>
              <option value="severity">Group: Severity</option>
              <option value="classification">Group: Classification</option>
              <option value="owner">Group: Assignee</option>
            </select>
          )}
        </div>

        {/* Classic List View */}
        {viewMode === "list" && (
          <div className="space-y-4">
            {groupedIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 text-center dark:border-zinc-800">
                <Bug className="mb-2 size-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">No issues match your filters</p>
              </div>
            ) : (
              groupedIssues.map((group) => (
                <div
                  key={group.label}
                  className="overflow-hidden rounded-xl border bg-card dark:border-zinc-800 dark:bg-zinc-900/70"
                >
                  <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950/60">
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      {group.label}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {group.items.length}
                    </Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[960px] border-collapse text-left">
                      <thead>
                        <tr className="border-b text-[11px] font-medium text-muted-foreground dark:border-zinc-800">
                          <th className="px-4 py-2">Key & Issue</th>
                          <th className="px-3 py-2">Severity</th>
                          <th className="px-3 py-2">Classification</th>
                          <th className="px-3 py-2">Reproducible</th>
                          <th className="px-3 py-2">Affected Module</th>
                          <th className="px-3 py-2">Assignee</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2 text-right">Timer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((issue) => {
                          const sev = SEVERITY_CONFIG[issue.severity];
                          const isRunning = activeTimerEntityId === `issue:${issue.id}`;
                          return (
                            <tr
                              key={issue.id}
                              className="border-b border-border/50 text-xs transition hover:bg-muted/30 dark:border-zinc-800/70"
                            >
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary dark:bg-zinc-800">
                                    {issue.issueKey}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => openDetailDrawer(issue)}
                                    className="font-semibold text-foreground hover:text-primary"
                                  >
                                    {issue.title}
                                  </button>
                                </div>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {issue.projectName}
                                  {issue.dueDate ? ` · Due ${formatDate(issue.dueDate)}` : ""}
                                </p>
                              </td>
                              <td className="px-3 py-2.5">
                                <Badge variant="outline" className={cn("text-[10px]", sev.badgeClass)}>
                                  {sev.zohoLabel}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5">
                                <Badge variant="secondary" className="text-[10px] font-normal">
                                  {issue.classification}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <RefreshCw className="size-3" />
                                  {issue.reproducible}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="inline-flex items-center gap-1 text-[11px]">
                                  <Layers className="size-3 text-muted-foreground" />
                                  {issue.affectedModule}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                {issue.assignee ? (
                                  <div className="flex items-center gap-1.5">
                                    <Avatar className="size-5">
                                      <AvatarFallback className="text-[9px]">
                                        {getInitials(issue.assignee.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{issue.assignee.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Unassigned</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5">
                                {canWrite ? (
                                  <select
                                    value={issue.status}
                                    onChange={(e) =>
                                      handleStatusChange(issue.id, e.target.value as IssueStatus)
                                    }
                                    className="h-7 rounded border bg-background px-2 text-[11px] font-medium dark:border-zinc-800 dark:bg-zinc-950"
                                  >
                                    <option value="OPEN">Open</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="RESOLVED">Resolved</option>
                                    <option value="CLOSED">Closed</option>
                                  </select>
                                ) : (
                                  <Badge variant="outline">{issue.status}</Badge>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <Button
                                  size="xs"
                                  variant={isRunning ? "destructive" : "outline"}
                                  onClick={() => handleToggleTimer(issue)}
                                  className="gap-1"
                                >
                                  {isRunning ? (
                                    <>
                                      <Pause className="size-3" /> Pause
                                    </>
                                  ) : (
                                    <>
                                      <Play className="size-3" /> Track
                                    </>
                                  )}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Kanban View */}
        {viewMode === "kanban" && (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto pb-3">
              {ISSUE_COLUMNS.map((col) => (
                <IssueKanbanColumn
                  key={col.status}
                  status={col.status}
                  label={col.label}
                  dot={col.dot}
                  issues={visibleIssues.filter((i) => i.status === col.status)}
                  canWrite={canWrite}
                  activeTimerEntityId={activeTimerEntityId}
                  onOpenDetail={openDetailDrawer}
                  onToggleTimer={handleToggleTimer}
                />
              ))}
            </div>
          </DndContext>
        )}

        {/* Gantt View */}
        {viewMode === "gantt" && (
          <Card className="dark:border-zinc-800 dark:bg-zinc-900/70">
            <CardContent className="p-4">
              {ganttTimeline.rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No issues to display on timeline.
                </p>
              ) : (
                <div className="space-y-3 overflow-x-auto">
                  <div className="flex min-w-[720px] items-center border-b pb-2 text-[11px] font-medium text-muted-foreground dark:border-zinc-800">
                    <div className="w-60 shrink-0">Issue</div>
                    <div className="grid flex-1 grid-cols-5 text-right">
                      {ganttTimeline.ticks.map((tick, idx) => (
                        <span key={idx}>{tick}</span>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-[720px] space-y-2">
                    {ganttTimeline.rows.map(({ issue, startMs, endMs }) => {
                      const leftPct =
                        ((startMs - ganttTimeline.minMs) / ganttTimeline.spanMs) * 100;
                      const widthPct = Math.max(
                        ((endMs - startMs) / ganttTimeline.spanMs) * 100,
                        4,
                      );
                      const sev = SEVERITY_CONFIG[issue.severity];
                      return (
                        <div key={issue.id} className="flex items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => openDetailDrawer(issue)}
                            className="w-60 shrink-0 truncate text-left font-medium hover:text-primary"
                          >
                            <span className="mr-1.5 font-mono text-[10px] text-primary">
                              {issue.issueKey}
                            </span>
                            {issue.title}
                          </button>
                          <div className="relative h-6 flex-1 rounded bg-muted/60 dark:bg-zinc-800/70">
                            <div
                              style={{
                                left: `${Math.min(Math.max(leftPct, 0), 94)}%`,
                                width: `${Math.min(widthPct, 100 - Math.max(leftPct, 0))}%`,
                              }}
                              className={cn(
                                "absolute top-1 flex h-4 items-center rounded px-1.5 text-[10px] font-semibold text-white",
                                sev.barClass,
                              )}
                            >
                              <span className="inline-flex items-center gap-1 truncate">
                                <Calendar className="size-2.5" />
                                {issue.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Submit Issue Slide-Over Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Submit Issue / Defect</SheetTitle>
            <SheetDescription>
              Log a project issue or defect with severity, classification, reproducibility, and affected module.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="issue-project">Project</Label>
              <select
                id="issue-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="issue-title">Issue Title</Label>
              <Input
                id="issue-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Webhook retry failing on 502"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="issue-severity">Severity</Label>
                <select
                  id="issue-severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="CRITICAL">Showstopper (Critical)</option>
                  <option value="HIGH">Critical (High)</option>
                  <option value="MEDIUM">Major (Medium)</option>
                  <option value="LOW">Minor (Low)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="issue-class">Classification</Label>
                <select
                  id="issue-class"
                  value={classification}
                  onChange={(e) =>
                    setClassification(e.target.value as NonNullable<IssueMeta["classification"]>)
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {CLASSIFICATIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="issue-repro">Reproducible</Label>
                <select
                  id="issue-repro"
                  value={reproducible}
                  onChange={(e) =>
                    setReproducible(e.target.value as NonNullable<IssueMeta["reproducible"]>)
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {REPRODUCIBLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="issue-assignee">Assignee</Label>
                <select
                  id="issue-assignee"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="issue-module">Affected Module</Label>
              <Input
                id="issue-module"
                value={affectedModule}
                onChange={(e) => setAffectedModule(e.target.value)}
                placeholder="e.g. Auth & SSO, Finance & Billing, API Gateway"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="issue-desc">Reproduction Steps / Notes</Label>
              <textarea
                id="issue-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Steps to reproduce, expected vs actual behavior..."
                className="w-full rounded-md border border-input bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Submit Issue
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Issue Detail / Edit Drawer */}
      <Sheet open={Boolean(detailIssue)} onOpenChange={(v) => !v && setDetailIssue(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="border-b pb-4">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="font-mono text-xs text-primary">
                {detailIssue?.issueKey}
              </Badge>
              {detailIssue && (
                <Button
                  size="xs"
                  variant={
                    activeTimerEntityId === `issue:${detailIssue.id}` ? "destructive" : "outline"
                  }
                  onClick={() => handleToggleTimer(detailIssue)}
                  className="gap-1"
                >
                  {activeTimerEntityId === `issue:${detailIssue.id}` ? (
                    <>
                      <Pause className="size-3" /> Pause Timer
                    </>
                  ) : (
                    <>
                      <Play className="size-3" /> Start Timer
                    </>
                  )}
                </Button>
              )}
            </div>
            <SheetTitle>{detailIssue?.title}</SheetTitle>
            <SheetDescription className="flex items-center gap-2 text-xs">
              <span>{detailIssue?.projectName}</span>
              <span>·</span>
              <span>Reported by {detailIssue?.reporter?.name ?? "System"}</span>
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleEditSave} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label>Issue Title</Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                disabled={!canWrite}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select
                  value={editStatus}
                  disabled={!canWrite}
                  onChange={(e) => setEditStatus(e.target.value as IssueStatus)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <select
                  value={editSeverity}
                  disabled={!canWrite}
                  onChange={(e) => setEditSeverity(e.target.value as IssueSeverity)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="CRITICAL">Showstopper</option>
                  <option value="HIGH">Critical</option>
                  <option value="MEDIUM">Major</option>
                  <option value="LOW">Minor</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Classification</Label>
                <select
                  value={editClassification}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setEditClassification(
                      e.target.value as NonNullable<IssueMeta["classification"]>,
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {CLASSIFICATIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Reproducible</Label>
                <select
                  value={editReproducible}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setEditReproducible(
                      e.target.value as NonNullable<IssueMeta["reproducible"]>,
                    )
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  {REPRODUCIBLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <select
                  value={editAssigneeId}
                  disabled={!canWrite}
                  onChange={(e) => setEditAssigneeId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Target Due Date</Label>
                <Input
                  type="date"
                  value={editDueDate}
                  disabled={!canWrite}
                  onChange={(e) => setEditDueDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Affected Module</Label>
              <Input
                value={editAffectedModule}
                disabled={!canWrite}
                onChange={(e) => setEditAffectedModule(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description / Reproduction Steps</Label>
              <textarea
                rows={4}
                value={editDescription}
                disabled={!canWrite}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-md border border-input bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
            {detailIssue?.severity === "CRITICAL" && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/70 p-2.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>Showstopper flagged: escalate immediately in team feed or block release sign-off.</span>
              </div>
            )}
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setDetailIssue(null)}>
                Close
              </Button>
              {canWrite && (
                <Button type="submit" disabled={isPending}>
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Save Changes
                </Button>
              )}
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
