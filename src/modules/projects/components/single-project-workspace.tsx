"use client";

import * as React from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  IssueSeverity,
  IssueStatus,
  MilestoneStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import {
  Bug,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Flag,
  FolderKanban,
  GanttChart,
  GripVertical,
  Handshake,
  Kanban,
  LayoutDashboard,
  List,
  Loader2,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  Receipt,
  SlidersHorizontal,
  UserPlus,
  Users,
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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatDateTimeUtc, initials } from "@/lib/format";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { cn } from "@/lib/utils";
import { InviteUsersDialog } from "@/modules/org/components/invite-users-dialog";
import { CollaborationPanel } from "@/modules/projects/components/collaboration-panel";
import { EditProjectSheet } from "@/modules/projects/components/edit-project-sheet";
import { getTagPillClass } from "@/modules/projects/components/projects-views";
import {
  createIssueAction,
  createMilestoneAction,
  createTaskAction,
  createTimeLogAction,
  moveTaskStatusAction,
  postCommentAction,
  updateIssueStatusAction,
  updateMilestoneStatusAction,
  updateProjectStatusAction,
} from "@/modules/projects/projects.actions";
import type { SingleProjectWorkspaceDTO, TaskCardDTO } from "@/modules/projects/projects.types";

type ProjectWorkspaceTab =
  | "dashboard"
  | "tasks"
  | "phases"
  | "issues"
  | "time-logs"
  | "finance"
  | "documents"
  | "users"
  | "feed";

type TasksViewMode = "list" | "kanban" | "gantt";

const TASK_STATUS_COLUMNS: Array<{
  status: TaskStatus;
  label: string;
  colorHex: string;
  dotClass: string;
}> = [
  { status: "TODO", label: "Open / To Do", colorHex: "#64748b", dotClass: "bg-slate-500" },
  { status: "IN_PROGRESS", label: "In Progress", colorHex: "#2563eb", dotClass: "bg-blue-600" },
  { status: "IN_REVIEW", label: "In Review", colorHex: "#d97706", dotClass: "bg-amber-500" },
  { status: "DONE", label: "Closed / Done", colorHex: "#059669", dotClass: "bg-emerald-600" },
];

const DOC_PREFIX = "[DOC]";

interface ParsedProjectDoc {
  id: string;
  title: string;
  category: string;
  url: string;
  authorName: string;
  createdAt: string;
}

function parseProjectDoc(comment: {
  id: string;
  body: string;
  createdAt: string;
  author: { name: string } | null;
}): ParsedProjectDoc | null {
  if (!comment.body.startsWith(DOC_PREFIX)) return null;
  const parts = comment.body.slice(DOC_PREFIX.length).trim().split("|");
  return {
    id: comment.id,
    title: parts[0]?.trim() || "Project Document",
    category: parts[1]?.trim() || "Specification",
    url: parts[2]?.trim() || "#",
    authorName: comment.author?.name ?? "Team Member",
    createdAt: comment.createdAt,
  };
}

function mapEnabledTabs(enabledTabs: string[]): Array<{
  id: ProjectWorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> {
  const catalog = {
    Dashboard: { id: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
    Tasks: { id: "tasks" as const, label: "Tasks", icon: CheckSquare },
    Phases: { id: "phases" as const, label: "Phases / Milestones", icon: Flag },
    Bugs: { id: "issues" as const, label: "Issues", icon: Bug },
    Issues: { id: "issues" as const, label: "Issues", icon: Bug },
    "Time Logs": { id: "time-logs" as const, label: "Time Logs", icon: Clock },
    Finance: { id: "finance" as const, label: "Finance", icon: DollarSign },
    Documents: { id: "documents" as const, label: "Documents", icon: FileText },
    Users: { id: "users" as const, label: "Project Users", icon: Users },
    Feed: { id: "feed" as const, label: "Feed", icon: MessageSquare },
  };
  const lookup: Record<
    string,
    { id: ProjectWorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }
  > = catalog;

  const seen = new Set<ProjectWorkspaceTab>();
  const resolved: Array<{
    id: ProjectWorkspaceTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [];

  for (const name of enabledTabs) {
    const def = lookup[name];
    if (def && !seen.has(def.id)) {
      seen.add(def.id);
      resolved.push(def);
    }
  }

  const guaranteed = [
    catalog.Dashboard,
    catalog.Tasks,
    catalog.Phases,
    catalog.Bugs,
    catalog["Time Logs"],
    catalog.Finance,
    catalog.Documents,
    catalog.Users,
  ];
  if (resolved.length === 0) return guaranteed;
  if (!seen.has("finance")) {
    resolved.push(catalog.Finance);
  }
  return resolved;
}

function KanbanTaskCard({
  task,
  canWrite,
  isDragging = false,
  isOverlay = false,
  dragProps,
}: {
  task: TaskCardDTO;
  canWrite: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
  dragProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 shadow-2xs transition",
        isDragging && "opacity-40",
        isOverlay && "rotate-1 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-start gap-1.5">
        {canWrite && (
          <button
            type="button"
            className="mt-0.5 cursor-grab text-muted-foreground/60 hover:text-foreground"
            {...dragProps}
          >
            <GripVertical className="size-3.5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{task.title}</p>
          {task.milestoneName && (
            <p className="mt-1 truncate text-[11px] text-violet-600 dark:text-violet-400">
              {task.milestoneName}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {task.priority}
          </Badge>
          {task.dueDate && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="size-3" />
              {formatDate(task.dueDate)}
            </span>
          )}
        </div>

        {task.assignee && (
          <Avatar className="size-5" title={task.assignee.name}>
            {task.assignee.avatarUrl && (
              <AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
            )}
            <AvatarFallback className="text-[9px]">{initials(task.assignee.name)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

function SortableProjectTaskCard({ task, canWrite }: { task: TaskCardDTO; canWrite: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canWrite,
  });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <KanbanTaskCard
        task={task}
        canWrite={canWrite}
        isDragging={isDragging}
        dragProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function ProjectKanbanColumn({
  droppableId,
  status,
  label,
  dotClass,
  tasks,
  canWrite,
  onQuickAdd,
}: {
  droppableId: string;
  status: TaskStatus;
  label: string;
  dotClass: string;
  tasks: TaskCardDTO[];
  canWrite: boolean;
  onQuickAdd: (st: TaskStatus) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-56 w-68 shrink-0 flex-col rounded-xl border bg-muted/30 p-3 transition",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", dotClass)} />
          <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
            {tasks.length}
          </Badge>
        </div>
        {canWrite && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onQuickAdd(status)}
            title={`Add task in ${label}`}
          >
            <Plus className="size-3.5" />
          </Button>
        )}
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2">
          {tasks.map((t) => (
            <SortableProjectTaskCard key={t.id} task={t} canWrite={canWrite} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function SingleProjectWorkspace({
  orgSlug,
  orgName,
  todayIso,
  canWrite,
  canManageUsers,
  data,
}: {
  orgSlug: string;
  orgName: string;
  todayIso: string;
  canWrite: boolean;
  canManageUsers: boolean;
  data: SingleProjectWorkspaceDTO;
}) {
  const router = useRouter();
  const dndId = React.useId();
  const { project, allProjects, milestones, issues, timeLogs, invoices, expenses, members, comments } =
    data;

  const tabs = React.useMemo(() => mapEnabledTabs(project.enabledTabs), [project.enabledTabs]);
  const [activeTab, setActiveTab] = React.useState<ProjectWorkspaceTab>("dashboard");
  const [tasksView, setTasksView] = React.useState<TasksViewMode>("list");
  const [tasks, setTasks] = React.useState<TaskCardDTO[]>(data.tasks);
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setTasks(data.tasks);
  }, [data.tasks]);

  React.useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab)) {
      setActiveTab(tabs[0]?.id ?? "dashboard");
    }
  }, [tabs, activeTab]);

  // Drawers
  const [editOpen, setEditOpen] = React.useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = React.useState(false);
  const [phaseDrawerOpen, setPhaseDrawerOpen] = React.useState(false);
  const [issueDrawerOpen, setIssueDrawerOpen] = React.useState(false);
  const [timeDrawerOpen, setTimeDrawerOpen] = React.useState(false);
  const [docDrawerOpen, setDocDrawerOpen] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  // Task creation form
  const [taskTitle, setTaskTitle] = React.useState("");
  const [taskMilestoneId, setTaskMilestoneId] = React.useState("");
  const [taskStatus, setTaskStatus] = React.useState<TaskStatus>("TODO");
  const [taskPriority, setTaskPriority] = React.useState<TaskPriority>("MEDIUM");
  const [taskAssigneeId, setTaskAssigneeId] = React.useState("");
  const [taskDueDate, setTaskDueDate] = React.useState("");

  // Phase creation form
  const [phaseName, setPhaseName] = React.useState("");
  const [phaseDueDate, setPhaseDueDate] = React.useState("");
  const [phaseDesc, setPhaseDesc] = React.useState("");

  // Issue creation form
  const [issueTitle, setIssueTitle] = React.useState("");
  const [issueSeverity, setIssueSeverity] = React.useState<IssueSeverity>("MEDIUM");
  const [issueAssigneeId, setIssueAssigneeId] = React.useState("");

  // Time log creation form
  const [logHours, setLogHours] = React.useState("2");
  const [logBillable, setLogBillable] = React.useState(true);
  const [logDate, setLogDate] = React.useState(todayIso);
  const [logNotes, setLogNotes] = React.useState("");

  // Document creation form (persisted via Project Comment entries prefixed cleanly)
  const [docTitle, setDocTitle] = React.useState("");
  const [docCategory, setDocCategory] = React.useState("Specification");
  const [docUrl, setDocUrl] = React.useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  // Metrics & aggregations
  const doneTasksCount = tasks.filter((t) => t.status === "DONE").length;
  const totalTasksCount = tasks.length;
  const liveCompletion =
    totalTasksCount > 0 ? Math.round((doneTasksCount / totalTasksCount) * 100) : 0;

  const totalHours = timeLogs.reduce((sum, l) => sum + l.hours, 0);
  const billableHours = timeLogs.filter((l) => l.billable).reduce((sum, l) => sum + l.hours, 0);
  const openIssuesCount = issues.filter(
    (i) => i.status === "OPEN" || i.status === "IN_PROGRESS",
  ).length;

  const avgHourlyRate =
    members.length > 0
      ? members.reduce((sum, m) => sum + (m.hourlyCostRate || 0), 0) / members.length
      : 0;
  const laborCostEstimate = members.reduce((sum, m) => {
    const rate = m.hourlyCostRate || avgHourlyRate || 0;
    return sum + m.hoursLogged * rate;
  }, 0);
  const totalExpensesAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  const actualBurn = laborCostEstimate + totalExpensesAmount;
  const budgetAmount = project.budget ?? 0;
  const budgetBurnPct =
    budgetAmount > 0 ? Math.min(100, Math.round((actualBurn / budgetAmount) * 100)) : 0;

  const documents = React.useMemo(
    () =>
      comments
        .map((c) => parseProjectDoc(c))
        .filter((d): d is ParsedProjectDoc => d !== null),
    [comments],
  );
  const regularComments = React.useMemo(
    () => comments.filter((c) => !c.body.startsWith(DOC_PREFIX)),
    [comments],
  );

  // Group tasks by Phase / Milestone
  const taskGroups = React.useMemo(() => {
    const groups: Array<{
      id: string;
      title: string;
      dueDate: string | null;
      tasks: TaskCardDTO[];
    }> = milestones.map((m) => ({
      id: m.id,
      title: m.name,
      dueDate: m.dueDate,
      tasks: tasks.filter((t) => t.milestoneId === m.id),
    }));

    const unassigned = tasks.filter(
      (t) => !t.milestoneId || !milestones.some((m) => m.id === t.milestoneId),
    );
    if (unassigned.length > 0 || groups.length === 0) {
      groups.push({
        id: "__unassigned__",
        title: groups.length > 0 ? "General / Unassigned Phase" : "Project Task List",
        dueDate: null,
        tasks: unassigned,
      });
    }
    return groups;
  }, [milestones, tasks]);

  // Task Status Pie / Conic Donut Data
  const pieSlices = React.useMemo(() => {
    const counts = TASK_STATUS_COLUMNS.map((col) => ({
      ...col,
      count: tasks.filter((t) => t.status === col.status).length,
    }));
    const total = Math.max(1, tasks.length);
    let currentDeg = 0;
    const segments: string[] = [];
    for (const s of counts) {
      const deg = (s.count / total) * 360;
      if (deg > 0) {
        segments.push(`${s.colorHex} ${currentDeg}deg ${currentDeg + deg}deg`);
        currentDeg += deg;
      }
    }
    const background =
      segments.length > 0 ? `conic-gradient(${segments.join(", ")})` : "conic-gradient(#e2e8f0 0deg 360deg)";
    return { counts, background };
  }, [tasks]);

  // Handlers
  const handleStatusUpdate = (status: ProjectStatus) => {
    startTransition(async () => {
      const res = await updateProjectStatusAction({ orgSlug, projectId: project.id, status });
      if (!res.ok) toast.error(res.error.message);
      else toast.success(`Project status set to ${status}`);
    });
  };

  const handleTaskStatusSelect = (taskId: string, status: TaskStatus) => {
    const prev = tasks;
    setTasks((list) => list.map((t) => (t.id === taskId ? { ...t, status } : t)));
    startTransition(async () => {
      const res = await moveTaskStatusAction({ orgSlug, taskId, status });
      if (!res.ok) {
        setTasks(prev);
        toast.error(res.error.message);
      }
    });
  };

  const handleKanbanDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  };

  const handleKanbanDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over || !canWrite) return;

    const taskId = String(active.id);
    const overId = String(over.id);
    const targetStatus: TaskStatus | null = overId.startsWith("col:")
      ? (overId.split(":").pop() as TaskStatus)
      : (tasks.find((t) => t.id === overId)?.status ?? null);

    if (!targetStatus) return;
    handleTaskStatusSelect(taskId, targetStatus);
  };

  const handleCreateTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createTaskAction({
        orgSlug,
        projectId: project.id,
        milestoneId: taskMilestoneId || null,
        title: taskTitle,
        priority: taskPriority,
        status: taskStatus,
        assigneeId: taskAssigneeId || null,
        dueDate: taskDueDate || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setTasks((prev) => [...prev, res.data]);
      setTaskTitle("");
      setTaskDueDate("");
      setTaskDrawerOpen(false);
      toast.success("Task added");
    });
  };

  const handleCreatePhase = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createMilestoneAction({
        orgSlug,
        projectId: project.id,
        name: phaseName,
        description: phaseDesc || null,
        dueDate: phaseDueDate || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setPhaseName("");
      setPhaseDesc("");
      setPhaseDueDate("");
      setPhaseDrawerOpen(false);
      toast.success("Phase created");
    });
  };

  const handleToggleMilestone = (milestoneId: string, nextStatus: MilestoneStatus) => {
    startTransition(async () => {
      const res = await updateMilestoneStatusAction({
        orgSlug,
        milestoneId,
        status: nextStatus,
      });
      if (!res.ok) toast.error(res.error.message);
      else toast.success(`Phase marked ${nextStatus}`);
    });
  };

  const handleCreateIssue = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createIssueAction({
        orgSlug,
        projectId: project.id,
        title: issueTitle,
        severity: issueSeverity,
        assigneeId: issueAssigneeId || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setIssueTitle("");
      setIssueDrawerOpen(false);
      toast.success("Issue logged");
    });
  };

  const handleIssueStatusChange = (issueId: string, status: IssueStatus) => {
    startTransition(async () => {
      const res = await updateIssueStatusAction({ orgSlug, issueId, status });
      if (!res.ok) toast.error(res.error.message);
      else toast.success(`Issue marked ${status}`);
    });
  };

  const handleCreateTimeLog = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createTimeLogAction({
        orgSlug,
        projectId: project.id,
        hours: Number(logHours),
        billable: logBillable,
        loggedDate: logDate || todayIso,
        notes: logNotes || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setLogNotes("");
      setTimeDrawerOpen(false);
      toast.success("Time logged");
    });
  };

  const handleAddDocument = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTitle = docTitle.replaceAll("|", " ").trim();
    const cleanCat = docCategory.replaceAll("|", " ").trim();
    const cleanUrl = docUrl.trim() || "#";
    if (!cleanTitle) return;

    startTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: "Project",
        entityId: project.id,
        body: `${DOC_PREFIX} ${cleanTitle} | ${cleanCat} | ${cleanUrl}`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setDocTitle("");
      setDocUrl("");
      setDocDrawerOpen(false);
      toast.success("Document added to project");
    });
  };

  const activeKanbanTask = activeTaskId
    ? (tasks.find((t) => t.id === activeTaskId) ?? null)
    : null;

  // Task Gantt range
  const ganttDates = React.useMemo(() => {
    const startBase = project.startDate ?? todayIso;
    const endBase = project.dueDate ?? startBase;
    const minMs = Date.parse(startBase);
    const maxMs = Math.max(Date.parse(endBase), minMs + 21 * 24 * 60 * 60 * 1000);
    const spanMs = maxMs - minMs;
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) =>
      formatDate(new Date(minMs + spanMs * r).toISOString().slice(0, 10)),
    );
    return { minMs, spanMs, ticks };
  }, [project.startDate, project.dueDate, todayIso]);

  return (
    <div className="flex flex-col">
      {/* ── 1. Project Breadcrumb Switcher & Summary Header ───────────────── */}
      <div className="border-b bg-background px-4 pt-4 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1.5">
            {/* Breadcrumb + Project Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Link href={`/${orgSlug}/projects`} className="hover:text-foreground hover:underline">
                Projects
              </Link>
              <span>/</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-foreground transition hover:bg-muted"
                  >
                    <FolderKanban className="size-3.5 text-violet-600" />
                    <span>{project.name}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
                  <DropdownMenuLabel>Switch Project</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {allProjects.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onSelect={() => router.push(`/${orgSlug}/projects/${p.id}`)}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate">{p.name}</span>
                      {p.id === project.id ? (
                        <Check className="size-3.5 shrink-0 text-primary" />
                      ) : (
                        <Badge variant="outline" className="px-1 py-0 text-[9px]">
                          {p.status}
                        </Badge>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Title + Badges + % Completion Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight">{project.name}</h1>

              {canWrite ? (
                <select
                  aria-label="Project status"
                  value={project.status}
                  onChange={(e) => handleStatusUpdate(e.target.value as ProjectStatus)}
                  className="h-6 rounded-full border border-input bg-secondary px-2.5 text-xs font-semibold text-secondary-foreground"
                >
                  <option value="PLANNING">PLANNING</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ON_HOLD">ON_HOLD</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              ) : (
                <Badge variant="secondary">{project.status}</Badge>
              )}

              {project.isStrict && (
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                >
                  <Lock className="size-3" />
                  Strict Project
                </Badge>
              )}

              <Badge variant="outline">{project.isPublic ? "Public" : "Private"}</Badge>

              {project.group && <Badge variant="outline">{project.group.name}</Badge>}

              {/* Inline % Completion Bar */}
              <div className="flex items-center gap-2 rounded-full border bg-muted/30 px-2.5 py-0.5">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-violet-600 transition-all"
                    style={{ width: `${liveCompletion}%` }}
                  />
                </div>
                <span className="text-xs font-semibold tabular-nums">{liveCompletion}%</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && (
              <>
                <Button size="sm" variant="outline" onClick={() => setTaskDrawerOpen(true)}>
                  <Plus className="size-3.5" />
                  New Task
                </Button>
                <Button size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil className="size-3.5" />
                  Edit Project
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── 2. Horizontal Customizable Project Tabs ──────────────────────── */}
        <div className="mt-4 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1" role="tablist" aria-label="Project workspace tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {canWrite && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="mb-1 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Customize project tabs"
            >
              <SlidersHorizontal className="size-3.5" />
              <span className="hidden sm:inline">Customize Tabs</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Content Area ─────────────────────────────────────────────── */}
      <div className="space-y-6 p-4 lg:p-6">
        {/* ═══ TAB 1: DASHBOARD ═══ */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Task Completion</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{liveCompletion}%</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {doneTasksCount} of {totalTasksCount} tasks completed
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Hours Logged</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{totalHours.toFixed(1)}h</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {billableHours.toFixed(1)}h billable · {(totalHours - billableHours).toFixed(1)}h
                  internal
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Open Issues</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">{openIssuesCount}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {issues.length} total issues logged
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Budget Burn</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {budgetAmount > 0 ? `${budgetBurnPct}%` : formatCurrency(actualBurn, project.currency)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {budgetAmount > 0
                    ? `${formatCurrency(actualBurn, project.currency)} of ${formatCurrency(budgetAmount, project.currency)}`
                    : "No planned budget cap set"}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Task Status Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Task Status Distribution</CardTitle>
                  <CardDescription>Breakdown across all tasks in {project.name}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-6 sm:flex-row">
                  <div className="relative flex size-40 shrink-0 items-center justify-center rounded-full shadow-inner" style={{ background: pieSlices.background }}>
                    <div className="flex size-24 flex-col items-center justify-center rounded-full bg-card shadow-2xs">
                      <span className="text-xl font-bold tabular-nums">{totalTasksCount}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Tasks
                      </span>
                    </div>
                  </div>
                  <div className="w-full space-y-2.5">
                    {pieSlices.counts.map((slice) => {
                      const pct =
                        totalTasksCount > 0 ? Math.round((slice.count / totalTasksCount) * 100) : 0;
                      return (
                        <div key={slice.status} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={cn("size-2.5 rounded-full", slice.dotClass)} />
                            <span className="font-medium">{slice.label}</span>
                          </div>
                          <span className="font-semibold tabular-nums">
                            {slice.count} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Budget Burn & Project Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Budget Burn &amp; Overview</CardTitle>
                  <CardDescription>
                    Owner: {project.owner?.name ?? "Unassigned"} · Schedule:{" "}
                    {project.startDate ? formatDate(project.startDate) : "TBD"} →{" "}
                    {project.dueDate ? formatDate(project.dueDate) : "TBD"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">Actual Burn vs. Planned Budget</span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(actualBurn, project.currency)}{" "}
                        {budgetAmount > 0 && `/ ${formatCurrency(budgetAmount, project.currency)}`}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          budgetBurnPct > 90
                            ? "bg-rose-600"
                            : budgetBurnPct > 70
                              ? "bg-amber-500"
                              : "bg-emerald-600",
                        )}
                        style={{ width: `${budgetAmount > 0 ? budgetBurnPct : actualBurn > 0 ? 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Labor: {formatCurrency(laborCostEstimate, project.currency)}</span>
                      <span>Expenses: {formatCurrency(totalExpensesAmount, project.currency)}</span>
                    </div>
                  </div>

                  {project.description && (
                    <div
                      className="text-xs leading-relaxed text-muted-foreground [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(project.description) }}
                    />
                  )}

                  {project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {project.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className={cn("px-2 py-0 text-[10px]", getTagPillClass(tag))}
                        >
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ═══ TAB 2: TASKS (List, Kanban, Gantt grouped by Phase/Task List) ═══ */}
        {activeTab === "tasks" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center rounded-lg border bg-background p-0.5">
                {[
                  { id: "list" as const, label: "List", icon: List },
                  { id: "kanban" as const, label: "Kanban", icon: Kanban },
                  { id: "gantt" as const, label: "Gantt", icon: GanttChart },
                ].map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setTasksView(mode.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                        tasksView === mode.id
                          ? "bg-primary text-primary-foreground shadow-2xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3.5" />
                      <span>{mode.label}</span>
                    </button>
                  );
                })}
              </div>

              {canWrite && (
                <Button size="sm" onClick={() => setTaskDrawerOpen(true)}>
                  <Plus className="size-3.5" />
                  Add Task
                </Button>
              )}
            </div>

            {/* Tasks List View Grouped by Task List / Phase */}
            {tasksView === "list" && (
              <div className="space-y-4">
                {taskGroups.map((group) => (
                  <Card key={group.id}>
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                      <div className="flex items-center gap-2">
                        <Flag className="size-4 text-violet-600" />
                        <CardTitle className="text-sm font-semibold">{group.title}</CardTitle>
                        <Badge variant="secondary" className="text-[10px] tabular-nums">
                          {group.tasks.filter((t) => t.status === "DONE").length}/{group.tasks.length}
                        </Badge>
                        {group.dueDate && (
                          <span className="text-xs text-muted-foreground">
                            · Due {formatDate(group.dueDate, { withYear: true })}
                          </span>
                        )}
                      </div>
                      {canWrite && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setTaskMilestoneId(group.id === "__unassigned__" ? "" : group.id);
                            setTaskDrawerOpen(true);
                          }}
                        >
                          <Plus className="size-3.5" />
                          Add Task
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Task</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Assignee</TableHead>
                            <TableHead className="text-right">Due Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.tasks.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="h-14 text-center text-xs text-muted-foreground">
                                No tasks in this phase yet.
                              </TableCell>
                            </TableRow>
                          ) : (
                            group.tasks.map((task) => (
                              <TableRow key={task.id}>
                                <TableCell className="font-medium">{task.title}</TableCell>
                                <TableCell>
                                  {canWrite ? (
                                    <select
                                      value={task.status}
                                      disabled={isPending}
                                      onChange={(e) =>
                                        handleTaskStatusSelect(task.id, e.target.value as TaskStatus)
                                      }
                                      className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                                    >
                                      <option value="TODO">To Do</option>
                                      <option value="IN_PROGRESS">In Progress</option>
                                      <option value="IN_REVIEW">In Review</option>
                                      <option value="DONE">Done</option>
                                    </select>
                                  ) : (
                                    <Badge variant="outline">{task.status}</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[10px]">
                                    {task.priority}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">
                                  {task.assignee?.name ?? "Unassigned"}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {task.dueDate
                                    ? formatDate(task.dueDate, { withYear: true })
                                    : "—"}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Tasks Kanban View Grouped by Phase / Task List */}
            {tasksView === "kanban" && (
              <DndContext
                id={dndId}
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleKanbanDragStart}
                onDragEnd={handleKanbanDragEnd}
              >
                <div className="space-y-6">
                  {taskGroups.map((group) => (
                    <div key={group.id} className="space-y-3 rounded-xl border bg-card/50 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Flag className="size-4 text-violet-600" />
                          <h3 className="text-sm font-semibold">{group.title}</h3>
                          <Badge variant="secondary" className="text-[10px] tabular-nums">
                            {group.tasks.filter((t) => t.status === "DONE").length}/{group.tasks.length}
                          </Badge>
                        </div>
                        {canWrite && (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              setTaskMilestoneId(group.id === "__unassigned__" ? "" : group.id);
                              setTaskDrawerOpen(true);
                            }}
                          >
                            <Plus className="size-3.5" />
                            Add Task
                          </Button>
                        )}
                      </div>

                      <div className="overflow-x-auto pb-1">
                        <div className="flex gap-3">
                          {TASK_STATUS_COLUMNS.map((col) => (
                            <ProjectKanbanColumn
                              key={`${group.id}:${col.status}`}
                              droppableId={`col:${group.id}:${col.status}`}
                              status={col.status}
                              label={col.label}
                              dotClass={col.dotClass}
                              tasks={group.tasks.filter((t) => t.status === col.status)}
                              canWrite={canWrite}
                              onQuickAdd={(st) => {
                                setTaskMilestoneId(group.id === "__unassigned__" ? "" : group.id);
                                setTaskStatus(st);
                                setTaskDrawerOpen(true);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <DragOverlay>
                  {activeKanbanTask ? (
                    <div className="w-72">
                      <KanbanTaskCard task={activeKanbanTask} canWrite={canWrite} isOverlay />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}

            {/* Tasks Gantt / Timeline View grouped by Phase */}
            {tasksView === "gantt" && (
              <Card>
                <CardContent className="overflow-x-auto p-0">
                  <div className="min-w-[740px]">
                    <div className="grid grid-cols-12 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground">
                      <div className="col-span-4">Phase / Task</div>
                      <div className="col-span-8 flex justify-between">
                        {ganttDates.ticks.map((lbl, idx) => (
                          <span key={`${idx}-${lbl}`}>{lbl}</span>
                        ))}
                      </div>
                    </div>
                    <div className="divide-y">
                      {taskGroups.map((group) => (
                        <React.Fragment key={group.id}>
                          <div className="grid grid-cols-12 bg-muted/20 px-4 py-2 text-xs font-semibold">
                            <div className="col-span-12 flex items-center gap-2">
                              <Flag className="size-3.5 text-violet-600" />
                              <span>{group.title}</span>
                              <span className="text-muted-foreground">
                                ({group.tasks.length} tasks)
                              </span>
                            </div>
                          </div>
                          {group.tasks.map((task) => {
                            const endMs = task.dueDate
                              ? Date.parse(task.dueDate)
                              : ganttDates.minMs + ganttDates.spanMs * 0.5;
                            const startMs = Math.max(
                              ganttDates.minMs,
                              endMs - 7 * 24 * 60 * 60 * 1000,
                            );
                            const leftPct = Math.max(
                              0,
                              Math.min(
                                90,
                                ((startMs - ganttDates.minMs) / ganttDates.spanMs) * 100,
                              ),
                            );
                            const widthPct = Math.max(
                              8,
                              Math.min(
                                100 - leftPct,
                                ((endMs - startMs) / ganttDates.spanMs) * 100,
                              ),
                            );
                            return (
                              <div
                                key={task.id}
                                className="grid grid-cols-12 items-center px-4 py-2.5 text-xs hover:bg-muted/15"
                              >
                                <div className="col-span-4 truncate pr-3 font-medium">
                                  {task.title}
                                </div>
                                <div className="col-span-8">
                                  <div className="relative h-6 rounded bg-muted/30">
                                    <div
                                      className={cn(
                                        "absolute top-1 bottom-1 flex items-center rounded px-2 text-[10px] font-medium text-white",
                                        task.status === "DONE"
                                          ? "bg-emerald-600"
                                          : task.status === "IN_PROGRESS"
                                            ? "bg-blue-600"
                                            : "bg-slate-600",
                                      )}
                                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                    >
                                      <span className="truncate">{task.status}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ═══ TAB 3: PHASES / MILESTONES ═══ */}
        {activeTab === "phases" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">Phases &amp; Milestones</h2>
                <p className="text-xs text-muted-foreground">
                  Delivery checkpoints and task completion roll-up for {project.name}.
                </p>
              </div>
              {canWrite && (
                <Button size="sm" onClick={() => setPhaseDrawerOpen(true)}>
                  <Plus className="size-3.5" />
                  New Phase
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {milestones.length === 0 ? (
                <Card className="sm:col-span-2 lg:col-span-3">
                  <CardContent className="flex h-28 items-center justify-center text-sm text-muted-foreground">
                    No phases created yet.
                  </CardContent>
                </Card>
              ) : (
                milestones.map((ms) => {
                  const msPct =
                    ms.taskCount > 0 ? Math.round((ms.doneTaskCount / ms.taskCount) * 100) : 0;
                  return (
                    <Card key={ms.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-semibold">{ms.name}</CardTitle>
                          <Badge variant={ms.status === "COMPLETED" ? "default" : "secondary"}>
                            {ms.status}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          {ms.dueDate
                            ? `Due ${formatDate(ms.dueDate, { withYear: true })}`
                            : "No due date"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {ms.description && (
                          <p className="text-xs text-muted-foreground">{ms.description}</p>
                        )}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs tabular-nums">
                            <span className="text-muted-foreground">
                              {ms.doneTaskCount}/{ms.taskCount} tasks
                            </span>
                            <span className="font-semibold">{msPct}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-violet-600"
                              style={{ width: `${msPct}%` }}
                            />
                          </div>
                        </div>
                        {canWrite && (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={isPending}
                            onClick={() =>
                              handleToggleMilestone(
                                ms.id,
                                ms.status === "COMPLETED" ? "PENDING" : "COMPLETED",
                              )
                            }
                            className="w-full"
                          >
                            <CheckCircle2 className="size-3.5" />
                            {ms.status === "COMPLETED" ? "Reopen Phase" : "Mark Completed"}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ═══ TAB 4: ISSUES ═══ */}
        {activeTab === "issues" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bug className="size-4 text-rose-600" />
                  Project Issues ({issues.length})
                </CardTitle>
                <CardDescription>Bugs and blockers tracked inside {project.name}.</CardDescription>
              </div>
              {canWrite && (
                <Button size="sm" onClick={() => setIssueDrawerOpen(true)}>
                  <Plus className="size-3.5" />
                  Submit Issue
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead className="text-right">Logged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No issues logged for this project.
                      </TableCell>
                    </TableRow>
                  ) : (
                    issues.map((issue) => (
                      <TableRow key={issue.id}>
                        <TableCell className="font-medium">{issue.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant={issue.severity === "CRITICAL" ? "destructive" : "outline"}
                          >
                            {issue.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {canWrite ? (
                            <select
                              value={issue.status}
                              disabled={isPending}
                              onChange={(e) =>
                                handleIssueStatusChange(issue.id, e.target.value as IssueStatus)
                              }
                              className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                            >
                              <option value="OPEN">OPEN</option>
                              <option value="IN_PROGRESS">IN_PROGRESS</option>
                              <option value="RESOLVED">RESOLVED</option>
                              <option value="CLOSED">CLOSED</option>
                            </select>
                          ) : (
                            <Badge variant="secondary">{issue.status}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {issue.assignee?.name ?? "Unassigned"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {formatDate(issue.createdAt.slice(0, 10), { withYear: true })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ═══ TAB 5: TIME LOGS ═══ */}
        {activeTab === "time-logs" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="size-4 text-emerald-600" />
                  Project Time Logs ({totalHours.toFixed(2)}h)
                </CardTitle>
                <CardDescription>
                  {billableHours.toFixed(2)}h billable · {(totalHours - billableHours).toFixed(2)}h
                  non-billable
                </CardDescription>
              </div>
              {canWrite && (
                <Button size="sm" onClick={() => setTimeDrawerOpen(true)}>
                  <Plus className="size-3.5" />
                  Log Time
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Team Member</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No time entries logged yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    timeLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDate(log.loggedDate, { withYear: true })}
                        </TableCell>
                        <TableCell className="font-medium">{log.userName}</TableCell>
                        <TableCell>
                          <Badge variant={log.billable ? "default" : "outline"}>
                            {log.billable ? "Billable" : "Internal"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.notes || log.taskTitle || "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {log.hours.toFixed(2)}h
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ═══ TAB 6: FINANCE (Budget vs Actuals, Linked Deal & Invoices) ═══ */}
        {activeTab === "finance" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Planned Budget</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {project.budget !== null
                      ? formatCurrency(project.budget, project.currency)
                      : "—"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {project.company?.name ?? "Internal Budget"}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Estimated Labor Cost</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {formatCurrency(laborCostEstimate, project.currency)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {totalHours.toFixed(1)}h logged across members
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Project Expenses &amp; Claims</CardDescription>
                  <CardTitle className="text-2xl tabular-nums">
                    {formatCurrency(totalExpensesAmount, project.currency)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {expenses.length} recorded expense(s)
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Remaining Variance</CardDescription>
                  <CardTitle
                    className={cn(
                      "text-2xl tabular-nums",
                      budgetAmount > 0 && budgetAmount - actualBurn < 0 && "text-rose-600",
                    )}
                  >
                    {budgetAmount > 0
                      ? formatCurrency(budgetAmount - actualBurn, project.currency)
                      : "—"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {budgetAmount > 0 ? `${budgetBurnPct}% of budget utilized` : "Set a budget to track"}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Linked CRM Deal */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Handshake className="size-4 text-blue-600" />
                    Linked CRM Deal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {project.deal ? (
                    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{project.deal.title}</p>
                        <Badge>{project.deal.status}</Badge>
                      </div>
                      <p className="text-lg font-bold tabular-nums">
                        {formatCurrency(project.deal.amount, project.deal.currency)}
                      </p>
                      <Button asChild size="xs" variant="outline">
                        <Link href={`/${orgSlug}/crm/deals`}>
                          Open CRM Deal Pipeline
                          <ExternalLink className="size-3" />
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This project is not linked to a CRM deal.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Linked Invoices */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Receipt className="size-4 text-emerald-600" />
                    Linked Invoices ({invoices.length})
                  </CardTitle>
                  <Button asChild size="xs" variant="outline">
                    <Link href={`/${orgSlug}/finance/invoices`}>Finance Ledger</Link>
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-20 text-center text-xs text-muted-foreground">
                            No linked invoices yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        invoices.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-mono text-xs font-semibold">
                              <Link
                                href={`/${orgSlug}/finance/invoices?highlight=${inv.id}`}
                                className="text-primary hover:underline"
                              >
                                {inv.invoiceNumber}
                              </Link>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{inv.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs tabular-nums">
                              {formatCurrency(inv.total, inv.currency)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold tabular-nums">
                              {formatCurrency(inv.balanceDue, inv.currency)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Project Expenses */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project Expenses &amp; Claims</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expense</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-20 text-center text-xs text-muted-foreground">
                          No expenses recorded against this project.
                        </TableCell>
                      </TableRow>
                    ) : (
                      expenses.map((exp) => (
                        <TableRow key={exp.id}>
                          <TableCell className="font-medium">{exp.title}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {exp.category}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {exp.source}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{exp.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {formatCurrency(exp.amount, exp.currency)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══ TAB 7: DOCUMENTS ═══ */}
        {activeTab === "documents" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4 text-blue-600" />
                  Project Documents &amp; Specs ({documents.length})
                </CardTitle>
                <CardDescription>
                  Shared deliverables, architectural briefs, and client attachments for {project.name}.
                </CardDescription>
              </div>
              {canWrite && (
                <Button size="sm" onClick={() => setDocDrawerOpen(true)}>
                  <Plus className="size-3.5" />
                  Add Document
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Uploaded By</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No documents attached yet. Click &ldquo;Add Document&rdquo; to attach a file
                        or specification URL.
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.category}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{doc.authorName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTimeUtc(doc.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {doc.url && doc.url !== "#" ? (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                              Open
                              <ExternalLink className="size-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">Recorded</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ═══ TAB 8: PROJECT USERS ═══ */}
        {activeTab === "users" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="size-4 text-violet-600" />
                  Project Users &amp; Contributors ({members.length})
                </CardTitle>
                <CardDescription>
                  Team allocation, hourly cost rates, and hours logged inside {project.name}.
                </CardDescription>
              </div>
              {canManageUsers && (
                <Button size="sm" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="size-3.5" />
                  Invite User
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead className="text-right">Tasks Assigned</TableHead>
                    <TableHead className="text-right">Hours Logged</TableHead>
                    <TableHead className="text-right">Hourly Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-7">
                            {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={m.name} />}
                            <AvatarFallback className="text-[10px]">
                              {initials(m.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-1.5 font-medium">
                              <span>{m.name}</span>
                              {project.owner?.id === m.id && (
                                <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                                  Project Owner
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{m.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{m.role}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.portalProfile}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {m.assignedTaskCount}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {m.hoursLogged.toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {m.hourlyCostRate > 0
                          ? formatCurrency(m.hourlyCostRate, project.currency)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ═══ TAB 9: FEED ═══ */}
        {activeTab === "feed" && (
          <CollaborationPanel
            orgSlug={orgSlug}
            comments={regularComments}
            projects={[{ id: project.id, name: project.name }]}
            fixedProjectId={project.id}
            canWrite={canWrite}
          />
        )}
      </div>

      {/* ── Slide-Over Drawers ───────────────────────────────────────────── */}
      <EditProjectSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        orgSlug={orgSlug}
        data={data}
      />

      <InviteUsersDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        orgSlug={orgSlug}
        orgName={orgName}
      />

      {/* New Task Drawer */}
      <Sheet open={taskDrawerOpen} onOpenChange={setTaskDrawerOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Add Task to {project.name}</SheetTitle>
            <SheetDescription>Assign a task inside a project phase.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateTask} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="sp-task-title">Task Title</Label>
              <Input
                id="sp-task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Complete QA regression suite"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-task-phase">Phase / Task List</Label>
              <select
                id="sp-task-phase"
                value={taskMilestoneId}
                onChange={(e) => setTaskMilestoneId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">General / Unassigned Phase</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sp-task-status">Status</Label>
                <select
                  id="sp-task-status"
                  value={taskStatus}
                  onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-task-priority">Priority</Label>
                <select
                  id="sp-task-priority"
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sp-task-assignee">Assignee</Label>
                <select
                  id="sp-task-assignee"
                  value={taskAssigneeId}
                  onChange={(e) => setTaskAssigneeId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
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
                <Label htmlFor="sp-task-due">Due Date</Label>
                <Input
                  id="sp-task-due"
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>
            </div>
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setTaskDrawerOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Create Task
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* New Phase Drawer */}
      <Sheet open={phaseDrawerOpen} onOpenChange={setPhaseDrawerOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>New Phase / Milestone</SheetTitle>
            <SheetDescription>Add a milestone checkpoint to {project.name}.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreatePhase} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="sp-phase-name">Phase Name</Label>
              <Input
                id="sp-phase-name"
                value={phaseName}
                onChange={(e) => setPhaseName(e.target.value)}
                placeholder="e.g. Client UAT & Sign-off"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-phase-due">Due Date</Label>
              <Input
                id="sp-phase-due"
                type="date"
                value={phaseDueDate}
                onChange={(e) => setPhaseDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-phase-desc">Description</Label>
              <Input
                id="sp-phase-desc"
                value={phaseDesc}
                onChange={(e) => setPhaseDesc(e.target.value)}
                placeholder="Deliverables summary..."
              />
            </div>
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setPhaseDrawerOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Create Phase
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Submit Issue Drawer */}
      <Sheet open={issueDrawerOpen} onOpenChange={setIssueDrawerOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Submit Issue</SheetTitle>
            <SheetDescription>Log a defect or blocker in {project.name}.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateIssue} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="sp-issue-title">Issue Title</Label>
              <Input
                id="sp-issue-title"
                value={issueTitle}
                onChange={(e) => setIssueTitle(e.target.value)}
                placeholder="e.g. Webhook timeout during sync"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sp-issue-sev">Severity</Label>
                <select
                  id="sp-issue-sev"
                  value={issueSeverity}
                  onChange={(e) => setIssueSeverity(e.target.value as IssueSeverity)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-issue-assignee">Assignee</Label>
                <select
                  id="sp-issue-assignee"
                  value={issueAssigneeId}
                  onChange={(e) => setIssueAssigneeId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
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
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setIssueDrawerOpen(false)}>
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

      {/* Log Time Drawer */}
      <Sheet open={timeDrawerOpen} onOpenChange={setTimeDrawerOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Log Time</SheetTitle>
            <SheetDescription>Record work hours for {project.name}.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateTimeLog} className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sp-log-hours">Hours</Label>
                <Input
                  id="sp-log-hours"
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  value={logHours}
                  onChange={(e) => setLogHours(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-log-date">Date</Label>
                <Input
                  id="sp-log-date"
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={logBillable}
                onChange={(e) => setLogBillable(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span>Billable hours</span>
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="sp-log-notes">Notes</Label>
              <Input
                id="sp-log-notes"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder="Work completed..."
              />
            </div>
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setTimeDrawerOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Save Time Log
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Add Document Drawer */}
      <Sheet open={docDrawerOpen} onOpenChange={setDocDrawerOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Add Project Document</SheetTitle>
            <SheetDescription>Attach a specification, link, or deliverable record.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleAddDocument} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="sp-doc-title">Document Title</Label>
              <Input
                id="sp-doc-title"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="e.g. Technical Architecture Spec v2.pdf"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-doc-cat">Category</Label>
              <select
                id="sp-doc-cat"
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="Specification">Specification</option>
                <option value="Contract / SOW">Contract / SOW</option>
                <option value="Design Asset">Design Asset</option>
                <option value="Deliverable">Deliverable</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-doc-url">Document URL (Optional)</Label>
              <Input
                id="sp-doc-url"
                type="url"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="https://docs.google.com/..."
              />
            </div>
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setDocDrawerOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Save Document
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
