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
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import {
  Activity,
  ArrowRightLeft,
  ArrowUpDown,
  BookmarkPlus,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Flag,
  FolderKanban,
  GanttChart,
  GitBranch,
  GripVertical,
  Kanban,
  Layers,
  List,
  ListChecks,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserPlus,
  Workflow,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { formatDate, initials } from "@/lib/format";
import { emitWorkspaceNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { emitBackgroundTaskEvent } from "@/modules/projects/components/project-workspace-overlays";
import { getTagPillClass } from "@/modules/projects/components/projects-views";
import { TagChipsInput } from "@/modules/projects/components/tag-chips-input";
import {
  DEFAULT_TASK_AUTOMATION_RULES,
  ImportTasksDialog,
  ManageStatusesDialog,
  QuickPhaseDialog,
  QuickSubtaskDialog,
  TaskActivityLogSheet,
  TaskAutomationDialog,
  type TaskAutomationRulesState,
} from "@/modules/projects/components/task-board-overlays";
import { TaskDetailSheet } from "@/modules/projects/components/task-detail-sheet";
import {
  createTaskAction,
  deleteTaskAction,
  moveTaskStatusAction,
  quickUpdateTaskAction,
} from "@/modules/projects/projects.actions";
import type {
  ExtendedTaskStatus,
  TaskCardDTO,
  TasksBoardDTO,
} from "@/modules/projects/projects.types";

type TaskViewMode = "kanban" | "list" | "gantt";
type TaskGroupBy = "status" | "priority" | "owner" | "project" | "phase" | "dueDate";
type TaskSavedView =
  | "all_open"
  | "my_open"
  | "due_today"
  | "overdue"
  | "unassigned"
  | "completed"
  | "all";
type TaskSortBy = "default" | "due_asc" | "due_desc" | "priority" | "key" | "title";
type CardDensity = "comfortable" | "compact";

interface CustomTaskSavedView {
  id: string;
  name: string;
  projectFilter: string;
  priorityFilters: TaskPriority[];
  assigneeFilters: string[];
  phaseFilter: string;
  search: string;
}

const VIEW_MODE_LABELS: Record<TaskViewMode, string> = {
  kanban: "Kanban",
  list: "Classic",
  gantt: "Gantt",
};

const SORT_LABELS: Record<TaskSortBy, string> = {
  default: "Default Position",
  due_asc: "Due Date (Earliest)",
  due_desc: "Due Date (Latest)",
  priority: "Priority (Urgent → Low)",
  key: "Task Key",
  title: "Title (A → Z)",
};

interface CardDisplayOptions {
  taskKey: boolean;
  completeCheckbox: boolean;
  phase: boolean;
  projectName: boolean;
  priority: boolean;
  dueDate: boolean;
  loggedHours: boolean;
  subtasks: boolean;
  tags: boolean;
  assignee: boolean;
  density: CardDensity;
}

const DEFAULT_CARD_OPTIONS: CardDisplayOptions = {
  taskKey: true,
  completeCheckbox: true,
  phase: true,
  projectName: true,
  priority: true,
  dueDate: true,
  loggedHours: true,
  subtasks: true,
  tags: false,
  assignee: true,
  density: "comfortable",
};

const CARD_OPTION_LABELS: Array<{ key: Exclude<keyof CardDisplayOptions, "density">; label: string }> = [
  { key: "taskKey", label: "Task ID / Key" },
  { key: "completeCheckbox", label: "Inline Complete Checkbox" },
  { key: "phase", label: "Task List / Phase" },
  { key: "projectName", label: "Project Name" },
  { key: "priority", label: "Priority Badge" },
  { key: "dueDate", label: "Due Date" },
  { key: "loggedHours", label: "Logged Hours" },
  { key: "subtasks", label: "Subtasks Count" },
  { key: "tags", label: "Tags" },
  { key: "assignee", label: "Assignee Avatar" },
];

const TASK_SAVED_VIEW_LABELS: Record<TaskSavedView, string> = {
  all_open: "All Open",
  my_open: "My Open Tasks",
  due_today: "Due Today",
  overdue: "Overdue",
  unassigned: "Unassigned",
  completed: "Completed",
  all: "All Tasks",
};

const GROUP_BY_LABELS: Record<TaskGroupBy, string> = {
  status: "Status",
  priority: "Priority",
  owner: "Assignee",
  project: "Project",
  phase: "Phase",
  dueDate: "Due Date",
};

// Complete 8-column delivery sequence: Delayed -> Open -> In Progress -> In Review -> To be Tested -> On Hold -> Closed -> Cancelled
const STATUS_COLUMNS: Array<{
  status: ExtendedTaskStatus;
  label: string;
  dot: string;
  pillClass: string;
  cardAccent: string;
}> = [
  {
    status: "DELAYED",
    label: "Delayed",
    dot: "bg-rose-500",
    pillClass: "bg-rose-600 text-white",
    cardAccent: "border-l-rose-500",
  },
  {
    status: "TODO",
    label: "Open",
    dot: "bg-emerald-500",
    pillClass: "bg-emerald-600 text-white",
    cardAccent: "border-l-sky-500",
  },
  {
    status: "IN_PROGRESS",
    label: "In Progress",
    dot: "bg-blue-500",
    pillClass: "bg-blue-600 text-white",
    cardAccent: "border-l-blue-500",
  },
  {
    status: "IN_REVIEW",
    label: "In Review",
    dot: "bg-amber-500",
    pillClass: "bg-amber-500 text-white",
    cardAccent: "border-l-amber-500",
  },
  {
    status: "TO_BE_TESTED",
    label: "To be Tested",
    dot: "bg-orange-500",
    pillClass: "bg-orange-600 text-white",
    cardAccent: "border-l-orange-500",
  },
  {
    status: "ON_HOLD",
    label: "On Hold",
    dot: "bg-yellow-500",
    pillClass: "bg-slate-600 text-white",
    cardAccent: "border-l-yellow-500",
  },
  {
    status: "DONE",
    label: "Closed",
    dot: "bg-teal-500",
    pillClass: "bg-teal-600 text-white",
    cardAccent: "border-l-emerald-500",
  },
  {
    status: "CANCELLED",
    label: "Cancelled",
    dot: "bg-zinc-400",
    pillClass: "bg-zinc-600 text-white",
    cardAccent: "border-l-zinc-400",
  },
];

const STATUS_LABELS: Record<ExtendedTaskStatus, string> = {
  DELAYED: "Delayed",
  TODO: "Open",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  TO_BE_TESTED: "To be Tested",
  ON_HOLD: "On Hold",
  DONE: "Closed",
  CANCELLED: "Cancelled",
};

const EXTENDED_META_STATUSES = new Set<ExtendedTaskStatus>([
  "DELAYED",
  "TO_BE_TESTED",
  "ON_HOLD",
  "CANCELLED",
]);

function toPrismaTaskStatus(extStatus: ExtendedTaskStatus): TaskStatus {
  if (extStatus === "TO_BE_TESTED") return "IN_REVIEW";
  if (extStatus === "DELAYED" || extStatus === "ON_HOLD" || extStatus === "CANCELLED") {
    return "TODO";
  }
  return extStatus;
}

const PRIORITY_BADGE_CLASSES: Record<TaskPriority, string> = {
  URGENT: "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
  HIGH: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  MEDIUM: "border-blue-500/35 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  LOW: "border-border bg-muted/60 text-muted-foreground",
};

function isTaskOverdue(task: TaskCardDTO, todayIso: string): boolean {
  if (!task.dueDate) return false;
  if (task.status === "DONE" || task.extendedStatus === "CANCELLED") return false;
  return task.dueDate < todayIso;
}

function getEffectiveStatus(
  task: TaskCardDTO,
  todayIso: string,
  autoMoveOverdue: boolean,
): ExtendedTaskStatus {
  if (task.extendedStatus === "CANCELLED") return "CANCELLED";
  if (task.status === "DONE") return "DONE";
  if (task.extendedStatus === "DELAYED") return "DELAYED";
  if (task.extendedStatus === "ON_HOLD") return "ON_HOLD";
  if (task.extendedStatus === "TO_BE_TESTED") {
    if (autoMoveOverdue && isTaskOverdue(task, todayIso)) return "DELAYED";
    return "TO_BE_TESTED";
  }
  if (autoMoveOverdue && isTaskOverdue(task, todayIso)) return "DELAYED";
  return task.status;
}

function addDaysIso(baseIso: string, days: number): string {
  const ms = Date.parse(`${baseIso}T00:00:00.000Z`);
  return new Date(ms + days * 86400000).toISOString().slice(0, 10);
}

function getDueDateBucket(task: TaskCardDTO, todayIso: string): string {
  if (!task.dueDate) return "No Date";
  if (task.dueDate < todayIso && task.status !== "DONE" && task.extendedStatus !== "CANCELLED") {
    return "Overdue";
  }
  if (task.dueDate === todayIso) return "Today";
  if (task.dueDate <= addDaysIso(todayIso, 7)) return "This Week";
  return "Later";
}

interface DynamicColumnSpec {
  id: string;
  label: string;
  dot: string;
  pillClass?: string;
  cardAccent?: string;
  headerBg?: string;
  tasks: TaskCardDTO[];
  targetStatus?: ExtendedTaskStatus;
  targetPriority?: TaskPriority;
  targetAssigneeId?: string | null;
}

function TaskCardView({
  task,
  todayIso,
  canWrite,
  displayOptions,
  members,
  cardAccent = "border-l-sky-500",
  isTimerActive,
  isDragging = false,
  isOverlay = false,
  dragProps,
  onOpenDetail,
  onToggleComplete,
  onStatusChange,
  onQuickUpdate,
  onDuplicate,
  onDelete,
  onToggleTimer,
}: {
  task: TaskCardDTO;
  todayIso: string;
  canWrite: boolean;
  displayOptions: CardDisplayOptions;
  members: Array<{ id: string; name: string }>;
  cardAccent?: string;
  isTimerActive: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
  dragProps?: React.HTMLAttributes<HTMLButtonElement>;
  onOpenDetail?: () => void;
  onToggleComplete?: () => void;
  onStatusChange?: (status: ExtendedTaskStatus) => void;
  onQuickUpdate?: (patch: {
    priority?: TaskPriority;
    assigneeId?: string | null;
    dueDate?: string | null;
  }) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onToggleTimer?: () => void;
}) {
  const subtaskCount = task.subtasks?.length ?? 0;
  const doneSub = task.subtasks?.filter((s) => s.done).length ?? 0;
  const hours = (task.timeLogs ?? []).reduce((s, l) => s + l.hours, 0);
  const overdue = isTaskOverdue(task, todayIso);
  const isDone = task.status === "DONE" && task.extendedStatus !== "CANCELLED";
  const isCancelled = task.extendedStatus === "CANCELLED";
  const taskKey = task.taskKey ?? `TSK-${task.id.slice(-4).toUpperCase()}`;
  const compact = displayOptions.density === "compact";
  const currentStatus = getEffectiveStatus(task, todayIso, false);

  return (
    <div
      onClick={(e) => {
        if (
          (e.target as HTMLElement).closest(
            "button,input,select,a,[role='menuitem'],[data-no-card-open]",
          )
        ) {
          return;
        }
        onOpenDetail?.();
      }}
      className={cn(
        "group/card relative cursor-pointer rounded-lg border border-l-[3px] bg-card shadow-2xs transition-all hover:border-primary/40 hover:shadow-md dark:bg-zinc-900/95",
        compact ? "p-2.5" : "p-3",
        overdue ? "border-l-rose-500" : cardAccent,
        isCancelled && "opacity-75",
        isDragging && "opacity-35",
        isOverlay && "rotate-1 shadow-xl ring-2 ring-primary/40",
      )}
    >
      {/* Top Row: [Drag] + Task Key + [ ] Complete Checkbox on left; Timer + Expand + Quick Menu (⋮) on right */}
      <div className={cn("flex items-center justify-between gap-1.5", compact ? "mb-1" : "mb-1.5")}>
        <div className="flex min-w-0 items-center gap-1.5">
          {canWrite && (
            <button
              type="button"
              aria-label={`Drag ${task.title}`}
              className="-ml-1 cursor-grab text-muted-foreground/40 opacity-0 transition hover:text-foreground group-hover/card:opacity-100 active:cursor-grabbing"
              {...dragProps}
            >
              <GripVertical className="size-3.5" />
            </button>
          )}
          {displayOptions.taskKey && (
            <span className="font-mono text-[11px] font-medium text-muted-foreground">
              {taskKey}
            </span>
          )}
          {displayOptions.completeCheckbox && (
            <button
              type="button"
              disabled={!canWrite}
              onClick={onToggleComplete}
              title={isDone ? "Reopen task" : "Mark Closed"}
              aria-label={isDone ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}
              data-no-card-open
              className={cn(
                "flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border transition",
                isDone
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-muted-foreground/40 bg-transparent hover:border-primary",
              )}
            >
              {isDone && <Check className="size-2.5" />}
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1" data-no-card-open>
          {canWrite && (
            <button
              type="button"
              title={isTimerActive ? "Pause live timer" : "Start timer"}
              aria-label={isTimerActive ? `Pause timer for ${task.title}` : `Start timer for ${task.title}`}
              onClick={onToggleTimer}
              className={cn(
                "rounded p-0.5 transition",
                isTimerActive
                  ? "text-emerald-600 opacity-100 dark:text-emerald-400"
                  : "text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover/card:opacity-100 focus-visible:opacity-100",
              )}
            >
              {isTimerActive ? (
                <Pause className="size-3 animate-pulse" />
              ) : (
                <Play className="size-3" />
              )}
            </button>
          )}

          <button
            type="button"
            title="Open Task Details"
            aria-label={`Open ${task.title}`}
            onClick={onOpenDetail}
            className="rounded p-0.5 text-sky-500/80 transition hover:bg-sky-500/10 hover:text-sky-500"
          >
            <ExternalLink className="size-3" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`More actions for ${task.title}`}
                className="rounded p-0.5 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover/card:opacity-100 focus-visible:opacity-100"
              >
                <MoreVertical className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onOpenDetail}>
                <Pencil className="size-3.5" />
                Edit
              </DropdownMenuItem>
              {canWrite && (
                <>
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="size-3.5" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onToggleComplete}>
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    {isDone ? "Reopen Task" : "Mark Closed"}
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <ArrowRightLeft className="size-3.5" />
                      Move Status
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44">
                      {STATUS_COLUMNS.map((stCol) => (
                        <DropdownMenuItem
                          key={stCol.status}
                          onClick={() => onStatusChange?.(stCol.status)}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="flex items-center gap-2">
                            <span className={cn("size-2 rounded-full", stCol.dot)} />
                            {stCol.label}
                          </span>
                          {currentStatus === stCol.status && (
                            <Check className="size-3 text-primary" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={onDelete}>
                    <Trash2 className="size-3.5" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title */}
      <p
        className={cn(
          "line-clamp-2 break-words font-semibold leading-snug text-foreground",
          compact ? "text-xs" : "text-sm",
          (isDone || isCancelled) && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </p>

      {/* Stacked Phase & Project Lines */}
      {(displayOptions.phase || displayOptions.projectName) && (
        <div
          className={cn(
            "text-muted-foreground",
            compact ? "mt-1 space-y-0.5 text-[11px]" : "mt-2 space-y-1 text-xs",
          )}
        >
          {displayOptions.phase && (
            <div className="flex items-center gap-1.5">
              <ListChecks className="size-3 shrink-0 opacity-70" />
              <span className="truncate">{task.milestoneName ?? "General"}</span>
            </div>
          )}
          {displayOptions.projectName && (
            <div className="flex items-center gap-1.5">
              <FolderKanban className="size-3 shrink-0 opacity-70" />
              <span className="truncate">{task.projectName}</span>
            </div>
          )}
        </div>
      )}

      {/* Optional Extra Fields: Priority Badge, Subtasks Progress, Logged Hours */}
      {(displayOptions.priority || displayOptions.subtasks || displayOptions.loggedHours) && (
        <div className={cn("flex flex-wrap items-center gap-2 text-[10px]", compact ? "mt-1.5" : "mt-2.5")}>
          {displayOptions.priority && (
            <Badge
              variant="outline"
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0 text-[10px]",
                PRIORITY_BADGE_CLASSES[task.priority],
              )}
            >
              <Flag className="size-2.5 shrink-0" />
              {task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}
            </Badge>
          )}
          {displayOptions.subtasks && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 tabular-nums",
                subtaskCount > 0 ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
              )}
              title="Subtask progress"
            >
              <ListChecks className="size-2.5" />
              {doneSub}/{subtaskCount}
            </span>
          )}
          {displayOptions.loggedHours && (
            <span
              className={cn(
                "inline-flex items-center gap-1 tabular-nums",
                hours > 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
              )}
              title="Logged hours"
            >
              <Clock className="size-2.5" />
              {hours.toFixed(1)}h
            </span>
          )}
        </div>
      )}

      {displayOptions.tags && (task.tags?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags!.slice(0, 3).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className={cn("px-1.5 py-0 text-[10px]", getTagPillClass(tag))}
            >
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Clean Footer: Due Date Badge (only when set) + Assignee Avatar */}
      {(overdue || (displayOptions.dueDate && task.dueDate) || displayOptions.assignee) && (
        <div
          className={cn(
            "flex items-center justify-between gap-2 border-t border-border/60 text-[11px] text-muted-foreground",
            compact ? "mt-2 pt-1.5" : "mt-3 pt-2",
          )}
          data-no-card-open
        >
          <div className="flex items-center gap-1">
            {overdue && (
              <span className="rounded bg-rose-600 px-1 py-0 text-[9px] font-bold text-white">
                OVERDUE
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {displayOptions.dueDate && task.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                  overdue
                    ? "bg-rose-500/15 font-semibold text-rose-600 dark:text-rose-400"
                    : "bg-muted/70 text-muted-foreground",
                )}
                title={`Due ${formatDate(task.dueDate, { withYear: true })}`}
              >
                <Calendar className="size-3 shrink-0" />
                <span>{formatDate(task.dueDate)}</span>
              </span>
            )}

            {displayOptions.assignee && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={!canWrite}
                    title={task.assignee ? task.assignee.name : "Unassigned"}
                    aria-label={task.assignee ? `Assigned to ${task.assignee.name}` : "Assign task owner"}
                    className="shrink-0 rounded-full transition hover:ring-2 hover:ring-primary/50"
                  >
                    {task.assignee ? (
                      <Avatar className="size-5">
                        {task.assignee.avatarUrl && (
                          <AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
                        )}
                        <AvatarFallback className="text-[9px]">
                          {initials(task.assignee.name)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className="flex size-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <UserPlus className="size-3" />
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                {canWrite && (
                  <PopoverContent align="end" className="w-48 p-1.5">
                    <p className="px-2 py-1 text-xs font-semibold">Assign Owner</p>
                    <div className="max-h-44 space-y-0.5 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => onQuickUpdate?.({ assigneeId: null })}
                        className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-muted"
                      >
                        <span>Unassigned</span>
                        {!task.assignee && <Check className="size-3 text-primary" />}
                      </button>
                      {members.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onQuickUpdate?.({ assigneeId: m.id })}
                          className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-muted"
                        >
                          <span className="truncate">{m.name}</span>
                          {task.assignee?.id === m.id && <Check className="size-3 text-primary" />}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                )}
              </Popover>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SortableTaskCard({
  task,
  todayIso,
  canWrite,
  displayOptions,
  members,
  cardAccent,
  isTimerActive,
  onOpenDetail,
  onToggleComplete,
  onStatusChange,
  onQuickUpdate,
  onDuplicate,
  onDelete,
  onToggleTimer,
}: {
  task: TaskCardDTO;
  todayIso: string;
  canWrite: boolean;
  displayOptions: CardDisplayOptions;
  members: Array<{ id: string; name: string }>;
  cardAccent?: string;
  isTimerActive: boolean;
  onOpenDetail: () => void;
  onToggleComplete: () => void;
  onStatusChange: (status: ExtendedTaskStatus) => void;
  onQuickUpdate: (patch: {
    priority?: TaskPriority;
    assigneeId?: string | null;
    dueDate?: string | null;
  }) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleTimer: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canWrite,
  });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <TaskCardView
        task={task}
        todayIso={todayIso}
        canWrite={canWrite}
        displayOptions={displayOptions}
        members={members}
        cardAccent={cardAccent}
        isTimerActive={isTimerActive}
        isDragging={isDragging}
        dragProps={{ ...attributes, ...listeners }}
        onOpenDetail={onOpenDetail}
        onToggleComplete={onToggleComplete}
        onStatusChange={onStatusChange}
        onQuickUpdate={onQuickUpdate}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onToggleTimer={onToggleTimer}
      />
    </div>
  );
}

function KanbanColumn({
  col,
  todayIso,
  canWrite,
  collapsed,
  onToggleCollapse,
  displayOptions,
  members,
  projects,
  defaultProjectId,
  activeTimerTaskId,
  onAddInColumn,
  onQuickCreate,
  onOpenTask,
  onToggleComplete,
  onStatusChange,
  onQuickUpdate,
  onDuplicate,
  onDelete,
  onToggleTimer,
}: {
  col: DynamicColumnSpec;
  todayIso: string;
  canWrite: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  displayOptions: CardDisplayOptions;
  members: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  defaultProjectId: string;
  activeTimerTaskId: string | null;
  onAddInColumn: () => void;
  onQuickCreate: (payload: {
    status: ExtendedTaskStatus;
    title: string;
    projectId: string;
    priority: TaskPriority;
    assigneeId?: string | null;
  }) => Promise<boolean>;
  onOpenTask: (taskId: string) => void;
  onToggleComplete: (task: TaskCardDTO) => void;
  onStatusChange: (taskId: string, status: ExtendedTaskStatus) => void;
  onQuickUpdate: (
    taskId: string,
    patch: { priority?: TaskPriority; assigneeId?: string | null; dueDate?: string | null },
  ) => void;
  onDuplicate: (task: TaskCardDTO) => void;
  onDelete: (task: TaskCardDTO) => void;
  onToggleTimer: (task: TaskCardDTO) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `col:${col.id}` });
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [quickTitle, setQuickTitle] = React.useState("");
  const [quickProjectId, setQuickProjectId] = React.useState(
    defaultProjectId || projects[0]?.id || "",
  );
  const [quickPriority, setQuickPriority] = React.useState<TaskPriority>(
    col.targetPriority ?? "MEDIUM",
  );
  const [saving, setSaving] = React.useState(false);
  const allowQuickAdd = col.targetStatus !== "DELAYED" && col.targetStatus !== "CANCELLED";

  React.useEffect(() => {
    if (defaultProjectId) setQuickProjectId(defaultProjectId);
    else if (!quickProjectId && projects[0]?.id) setQuickProjectId(projects[0].id);
  }, [defaultProjectId, projects, quickProjectId]);

  const handleInlineSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = quickTitle.trim();
    const targetProject = defaultProjectId || quickProjectId || projects[0]?.id || "";
    if (!trimmed || !targetProject) return;
    setSaving(true);
    const ok = await onQuickCreate({
      status: col.targetStatus ?? "TODO",
      title: trimmed,
      projectId: targetProject,
      priority: col.targetPriority ?? quickPriority,
      assigneeId: col.targetAssigneeId,
    });
    setSaving(false);
    if (ok) setQuickTitle("");
  };

  // Collapsed narrow rail
  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          "flex w-11 shrink-0 flex-col items-center rounded-xl border bg-muted/35 py-3 transition-colors dark:bg-muted/20",
          col.headerBg,
          isOver && "ring-2 ring-primary/40",
        )}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          title={`Expand ${col.label}`}
          aria-label={`Expand ${col.label}`}
          className="mb-3 rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <ChevronsRight className="size-3.5" />
        </button>
        <span className={cn("mb-2 size-2 rounded-full", col.dot)} />
        <Badge variant="secondary" className="mb-3 px-1 py-0 text-[10px] tabular-nums">
          {col.tasks.length}
        </Badge>
        <span
          className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ writingMode: "vertical-rl" }}
        >
          {col.label}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-76 shrink-0 flex-col rounded-xl border bg-muted/35 p-3 transition-colors dark:bg-muted/20",
        col.headerBg,
        isOver && "ring-2 ring-primary/50",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {col.pillClass ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold shadow-2xs",
                col.pillClass,
              )}
            >
              <span className="truncate">{col.label}</span>
              <span className="opacity-90">({col.tasks.length})</span>
            </span>
          ) : (
            <>
              <span className={cn("size-2 shrink-0 rounded-full", col.dot)} />
              <h3 className="truncate text-xs font-semibold uppercase tracking-wider">{col.label}</h3>
              <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] tabular-nums">
                {col.tasks.length}
              </Badge>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {canWrite && allowQuickAdd && (
            <button
              type="button"
              onClick={onAddInColumn}
              title={`Add task to ${col.label}`}
              aria-label={`Add task to ${col.label}`}
              className="rounded p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            title={`Collapse ${col.label}`}
            aria-label={`Collapse ${col.label}`}
            className="rounded p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
          >
            <ChevronsLeft className="size-3.5" />
          </button>
        </div>
      </div>

      <SortableContext items={col.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2.5">
          {col.tasks.length === 0 && !composerOpen ? (
            <div className="flex min-h-28 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/25 bg-background/40 px-4 py-6 text-center text-xs text-muted-foreground transition-colors">
              <Layers className="size-4 opacity-50" />
              <span className="font-medium">Drop a task here</span>
            </div>
          ) : (
            col.tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                todayIso={todayIso}
                canWrite={canWrite}
                displayOptions={displayOptions}
                members={members}
                cardAccent={col.cardAccent}
                isTimerActive={activeTimerTaskId === task.id}
                onOpenDetail={() => onOpenTask(task.id)}
                onToggleComplete={() => onToggleComplete(task)}
                onStatusChange={(next) => onStatusChange(task.id, next)}
                onQuickUpdate={(patch) => onQuickUpdate(task.id, patch)}
                onDuplicate={() => onDuplicate(task)}
                onDelete={() => onDelete(task)}
                onToggleTimer={() => onToggleTimer(task)}
              />
            ))
          )}
        </div>
      </SortableContext>

      {/* Inline Quick-Add at the bottom of actionable Kanban columns */}
      {canWrite && projects.length > 0 && allowQuickAdd && (
        <div className="mt-2.5 pt-1">
          {composerOpen ? (
            <form
              onSubmit={handleInlineSubmit}
              className="space-y-2 rounded-lg border bg-card p-2.5 shadow-2xs"
            >
              <Input
                autoFocus
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setComposerOpen(false);
                    setQuickTitle("");
                  }
                }}
                placeholder="Enter task title..."
                className="h-8 text-xs"
                required
              />
              <div className="flex items-center gap-1.5">
                {!defaultProjectId && (
                  <select
                    aria-label="Project for quick task"
                    value={quickProjectId}
                    onChange={(e) => setQuickProjectId(e.target.value)}
                    className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-1.5 text-[11px]"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  aria-label="Priority for quick task"
                  value={quickPriority}
                  onChange={(e) => setQuickPriority(e.target.value as TaskPriority)}
                  className="h-7 rounded border border-input bg-background px-1.5 text-[11px]"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setComposerOpen(false);
                    setQuickTitle("");
                  }}
                >
                  <X className="size-3" />
                  Cancel
                </Button>
                <Button type="submit" size="xs" disabled={saving || !quickTitle.trim()}>
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                  Add
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="flex w-full items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-border hover:bg-background hover:text-foreground"
            >
              <Plus className="size-3.5" />
              <span>Add Task</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskKanbanBoard({
  orgSlug,
  todayIso = "",
  currentUserId = "",
  initialBoard,
  canWrite,
  defaultProjectId,
  openCreateInitially = false,
  initialTaskId = null,
}: {
  orgSlug: string;
  todayIso?: string;
  currentUserId?: string;
  initialBoard: TasksBoardDTO;
  canWrite: boolean;
  defaultProjectId?: string;
  openCreateInitially?: boolean;
  initialTaskId?: string | null;
}) {
  const dndContextId = React.useId();
  const kanbanScrollRef = React.useRef<HTMLDivElement>(null);
  const refTodayIso = todayIso || "2026-11-19";

  const [tasks, setTasks] = React.useState<TaskCardDTO[]>(initialBoard.tasks);
  const [viewMode, setViewMode] = React.useState<TaskViewMode>("kanban");
  const [savedView, setSavedView] = React.useState<string>("all_open");
  const [customViews, setCustomViews] = React.useState<CustomTaskSavedView[]>([]);
  const [customViewDraft, setCustomViewDraft] = React.useState("");
  const [groupBy, setGroupBy] = React.useState<TaskGroupBy>("status");
  const [sortBy, setSortBy] = React.useState<TaskSortBy>("default");
  const [projectFilter, setProjectFilter] = React.useState(defaultProjectId ?? "");
  const [assigneeFilters, setAssigneeFilters] = React.useState<string[]>([]);
  const [priorityFilters, setPriorityFilters] = React.useState<TaskPriority[]>([]);
  const [phaseFilter, setPhaseFilter] = React.useState("");
  const [dueFrom, setDueFrom] = React.useState("");
  const [dueTo, setDueTo] = React.useState("");
  const [hasLoggedTime, setHasLoggedTime] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [collapsedCols, setCollapsedCols] = React.useState<string[]>([]);
  const [collapseEmptyCols, setCollapseEmptyCols] = React.useState(false);
  const [hiddenStatuses, setHiddenStatuses] = React.useState<ExtendedTaskStatus[]>([]);
  const [displayOptions, setDisplayOptions] =
    React.useState<CardDisplayOptions>(DEFAULT_CARD_OPTIONS);
  const [automationRules, setAutomationRules] = React.useState<TaskAutomationRulesState>(
    DEFAULT_TASK_AUTOMATION_RULES,
  );
  const [activeTimerTaskId, setActiveTimerTaskId] = React.useState<string | null>(null);

  // Active drag & modals
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = React.useState<string | null>(initialTaskId);
  const [createOpen, setCreateOpen] = React.useState(openCreateInitially);
  const [automationOpen, setAutomationOpen] = React.useState(false);
  const [manageStatusesOpen, setManageStatusesOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [activityOpen, setActivityOpen] = React.useState(false);
  const [subtaskModalOpen, setSubtaskModalOpen] = React.useState(false);
  const [phaseModalOpen, setPhaseModalOpen] = React.useState(false);

  // Create form state
  const [newStatus, setNewStatus] = React.useState<ExtendedTaskStatus>("TODO");
  const [newProjectId, setNewProjectId] = React.useState(
    defaultProjectId || initialBoard.projects[0]?.id || "",
  );
  const [newMilestoneId, setNewMilestoneId] = React.useState("");
  const [newTitle, setNewTitle] = React.useState("");
  const [newPriority, setNewPriority] = React.useState<TaskPriority>("MEDIUM");
  const [newAssigneeId, setNewAssigneeId] = React.useState("");
  const [newDueDate, setNewDueDate] = React.useState("");
  const [newTags, setNewTags] = React.useState<string[]>([]);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setTasks(initialBoard.tasks);
  }, [initialBoard.tasks]);

  React.useEffect(() => {
    if (openCreateInitially) setCreateOpen(true);
  }, [openCreateInitially]);

  React.useEffect(() => {
    if (initialTaskId) setDetailTaskId(initialTaskId);
  }, [initialTaskId]);

  React.useEffect(() => {
    try {
      const savedOpts = window.localStorage.getItem(`bs_task_card_opts_v2_${orgSlug}`);
      if (savedOpts) {
        setDisplayOptions({ ...DEFAULT_CARD_OPTIONS, ...JSON.parse(savedOpts) });
      }
      const savedAuto = window.localStorage.getItem(`bs_task_auto_rules_${orgSlug}`);
      if (savedAuto) {
        setAutomationRules({ ...DEFAULT_TASK_AUTOMATION_RULES, ...JSON.parse(savedAuto) });
      }
      const savedCustom = window.localStorage.getItem(`bs_task_custom_views_${orgSlug}`);
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom);
        if (Array.isArray(parsed)) setCustomViews(parsed);
      }
      const savedCollapsed = window.localStorage.getItem(`bs_task_collapsed_cols_${orgSlug}`);
      if (savedCollapsed) {
        const parsed = JSON.parse(savedCollapsed);
        if (Array.isArray(parsed)) {
          setCollapsedCols(parsed);
        } else if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.cols)) setCollapsedCols(parsed.cols);
          if (typeof parsed.collapseEmpty === "boolean") {
            setCollapseEmptyCols(parsed.collapseEmpty);
          }
        }
      }
      const savedHiddenStatuses = window.localStorage.getItem(`bs_task_hidden_statuses_${orgSlug}`);
      if (savedHiddenStatuses) {
        const parsed = JSON.parse(savedHiddenStatuses);
        if (Array.isArray(parsed)) {
          setHiddenStatuses(parsed.filter((s) => s !== "TODO"));
        }
      }
    } catch {
      // Ignore
    }
  }, [orgSlug]);

  React.useEffect(() => {
    const onQuickAdd = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "tasks") setCreateOpen(true);
    };
    const onTimerState = (event: Event) => {
      const detail = (
        event as CustomEvent<{ running: boolean; taskId: string | null }>
      ).detail;
      setActiveTimerTaskId(detail?.running ? detail.taskId : null);
    };
    window.addEventListener("bs-quick-add", onQuickAdd);
    window.addEventListener("bs-timer-state", onTimerState);
    return () => {
      window.removeEventListener("bs-quick-add", onQuickAdd);
      window.removeEventListener("bs-timer-state", onTimerState);
    };
  }, []);

  const persistDisplayOptions = (next: CardDisplayOptions) => {
    setDisplayOptions(next);
    try {
      window.localStorage.setItem(`bs_task_card_opts_v2_${orgSlug}`, JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const persistAutomationRules = (next: TaskAutomationRulesState) => {
    setAutomationRules(next);
    try {
      window.localStorage.setItem(`bs_task_auto_rules_${orgSlug}`, JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const persistCollapsedState = (cols: string[], collapseEmpty: boolean) => {
    setCollapsedCols(cols);
    setCollapseEmptyCols(collapseEmpty);
    try {
      window.localStorage.setItem(
        `bs_task_collapsed_cols_${orgSlug}`,
        JSON.stringify({ cols, collapseEmpty }),
      );
    } catch {
      // Ignore
    }
  };

  const persistHiddenStatuses = (next: ExtendedTaskStatus[]) => {
    const sanitized = next.filter((s) => s !== "TODO");
    setHiddenStatuses(sanitized);
    try {
      window.localStorage.setItem(`bs_task_hidden_statuses_${orgSlug}`, JSON.stringify(sanitized));
    } catch {
      // Ignore
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const savedViewCounts = React.useMemo(() => {
    const scoped = projectFilter ? tasks.filter((t) => t.projectId === projectFilter) : tasks;
    const getSt = (t: TaskCardDTO) =>
      getEffectiveStatus(t, refTodayIso, automationRules.autoMoveOverdueToDelayed);
    return {
      all_open: scoped.filter((t) => {
        const st = getSt(t);
        return st !== "DONE" && st !== "CANCELLED";
      }).length,
      my_open: scoped.filter((t) => {
        const st = getSt(t);
        return t.assignee?.id === currentUserId && st !== "DONE" && st !== "CANCELLED";
      }).length,
      due_today: scoped.filter((t) => {
        const st = getSt(t);
        return t.dueDate === refTodayIso && st !== "DONE" && st !== "CANCELLED";
      }).length,
      overdue: scoped.filter((t) => getSt(t) === "DELAYED").length,
      unassigned: scoped.filter((t) => !t.assignee).length,
      completed: scoped.filter((t) => getSt(t) === "DONE").length,
      all: scoped.length,
    };
  }, [tasks, projectFilter, currentUserId, refTodayIso, automationRules.autoMoveOverdueToDelayed]);

  const countsByStatus = React.useMemo(() => {
    const counts: Record<ExtendedTaskStatus, number> = {
      DELAYED: 0,
      TODO: 0,
      IN_PROGRESS: 0,
      IN_REVIEW: 0,
      TO_BE_TESTED: 0,
      ON_HOLD: 0,
      DONE: 0,
      CANCELLED: 0,
    };
    for (const t of tasks) {
      const st = getEffectiveStatus(t, refTodayIso, automationRules.autoMoveOverdueToDelayed);
      counts[st] = (counts[st] ?? 0) + 1;
    }
    return counts;
  }, [tasks, refTodayIso, automationRules.autoMoveOverdueToDelayed]);

  const phaseFilterOptions = React.useMemo(() => {
    const names = new Set<string>(["General"]);
    for (const ms of initialBoard.milestones ?? []) {
      if (!projectFilter || ms.projectId === projectFilter) {
        names.add(ms.name);
      }
    }
    for (const t of tasks) {
      if (!projectFilter || t.projectId === projectFilter) {
        names.add(t.milestoneName ?? "General");
      }
    }
    return Array.from(names);
  }, [initialBoard.milestones, tasks, projectFilter]);

  const visibleTasks = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = tasks.filter((t) => {
      if (projectFilter && t.projectId !== projectFilter) return false;
      if (priorityFilters.length > 0 && !priorityFilters.includes(t.priority)) return false;
      if (assigneeFilters.length > 0) {
        const assigneeKey = t.assignee?.id ?? "__unassigned__";
        if (!assigneeFilters.includes(assigneeKey)) return false;
      }
      if (phaseFilter && (t.milestoneName ?? "General") !== phaseFilter) return false;
      if (dueFrom && (!t.dueDate || t.dueDate < dueFrom)) return false;
      if (dueTo && (!t.dueDate || t.dueDate > dueTo)) return false;
      if (hasLoggedTime) {
        const totalHours = (t.timeLogs ?? []).reduce((s, l) => s + l.hours, 0);
        if (totalHours <= 0) return false;
      }

      const effStatus = getEffectiveStatus(
        t,
        refTodayIso,
        automationRules.autoMoveOverdueToDelayed,
      );
      if (savedView === "all_open" && (effStatus === "DONE" || effStatus === "CANCELLED")) {
        return false;
      }
      if (
        savedView === "my_open" &&
        (t.assignee?.id !== currentUserId || effStatus === "DONE" || effStatus === "CANCELLED")
      ) {
        return false;
      }
      if (
        savedView === "due_today" &&
        (t.dueDate !== refTodayIso || effStatus === "DONE" || effStatus === "CANCELLED")
      ) {
        return false;
      }
      if (savedView === "overdue" && effStatus !== "DELAYED") return false;
      if (savedView === "unassigned" && t.assignee !== null) return false;
      if (savedView === "completed" && effStatus !== "DONE") return false;

      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.taskKey?.toLowerCase().includes(q) ?? false) ||
        t.projectName.toLowerCase().includes(q) ||
        (t.milestoneName?.toLowerCase().includes(q) ?? false) ||
        (t.assignee?.name.toLowerCase().includes(q) ?? false) ||
        (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
      );
    });

    if (sortBy === "default") return filtered;
    const priRank: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "due_asc":
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        case "due_desc":
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return b.dueDate.localeCompare(a.dueDate);
        case "priority":
          return priRank[a.priority] - priRank[b.priority];
        case "key":
          return (a.taskKey ?? "").localeCompare(b.taskKey ?? "");
        case "title":
          return a.title.localeCompare(b.title);
      }
    });
  }, [
    tasks,
    projectFilter,
    priorityFilters,
    assigneeFilters,
    phaseFilter,
    dueFrom,
    dueTo,
    hasLoggedTime,
    savedView,
    currentUserId,
    refTodayIso,
    automationRules.autoMoveOverdueToDelayed,
    search,
    sortBy,
  ]);

  const activeFilterCount =
    (projectFilter ? 1 : 0) +
    (priorityFilters.length > 0 ? 1 : 0) +
    (assigneeFilters.length > 0 ? 1 : 0) +
    (phaseFilter ? 1 : 0) +
    (dueFrom || dueTo ? 1 : 0) +
    (hasLoggedTime ? 1 : 0) +
    (search.trim().length > 0 ? 1 : 0);

  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = () => {
    setProjectFilter("");
    setPriorityFilters([]);
    setAssigneeFilters([]);
    setPhaseFilter("");
    setDueFrom("");
    setDueTo("");
    setHasLoggedTime(false);
    setSearch("");
  };

  const persistCustomViews = (next: CustomTaskSavedView[]) => {
    setCustomViews(next);
    try {
      window.localStorage.setItem(`bs_task_custom_views_${orgSlug}`, JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const handleSaveCustomView = () => {
    const name = customViewDraft.trim();
    if (!name) return;
    const id = `custom:${Date.now()}`;
    persistCustomViews([
      ...customViews,
      {
        id,
        name,
        projectFilter,
        priorityFilters,
        assigneeFilters,
        phaseFilter,
        search,
      },
    ]);
    setCustomViewDraft("");
    setSavedView(id);
    toast.success(`Saved view "${name}"`);
  };

  const selectSavedView = (viewId: string) => {
    setSavedView(viewId);
    const custom = customViews.find((v) => v.id === viewId);
    if (custom) {
      const legacyCustom = custom as Partial<CustomTaskSavedView> & {
        priorityFilter?: TaskPriority | "";
      };
      setProjectFilter(custom.projectFilter ?? "");
      setPriorityFilters(
        Array.isArray(custom.priorityFilters)
          ? custom.priorityFilters
          : legacyCustom.priorityFilter
            ? [legacyCustom.priorityFilter]
            : [],
      );
      setAssigneeFilters(Array.isArray(custom.assigneeFilters) ? custom.assigneeFilters : []);
      setPhaseFilter(custom.phaseFilter ?? "");
      setSearch(custom.search ?? "");
    }
  };

  const activeSavedViewLabel =
    TASK_SAVED_VIEW_LABELS[savedView as TaskSavedView] ??
    customViews.find((v) => v.id === savedView)?.name ??
    "All Open";

  const activeSavedViewCount =
    savedView in savedViewCounts
      ? savedViewCounts[savedView as TaskSavedView]
      : visibleTasks.length;

  const handleExportTasksCsv = () => {
    const jobId = `export-tasks-${Date.now()}`;
    const exportCount = visibleTasks.length;
    const exportWord = exportCount === 1 ? "task" : "tasks";
    emitBackgroundTaskEvent({
      id: jobId,
      label: `Exporting ${exportCount} ${exportWord} to CSV`,
      progress: 30,
      status: "running",
    });

    window.setTimeout(() => {
      const esc = (v: string | null | undefined) => {
        const s = v ?? "";
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const header = ["Key", "Title", "Project", "Phase", "Status", "Priority", "Owner", "Due Date"];
      const lines = [
        header.join(","),
        ...visibleTasks.map((t) => {
          const st = getEffectiveStatus(t, refTodayIso, automationRules.autoMoveOverdueToDelayed);
          return [
            t.taskKey ?? "",
            t.title,
            t.projectName,
            t.milestoneName ?? "General",
            STATUS_LABELS[st],
            t.priority,
            t.assignee?.name ?? "Unassigned",
            t.dueDate ?? "",
          ]
            .map(esc)
            .join(",");
        }),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${orgSlug}-tasks-${refTodayIso}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      emitBackgroundTaskEvent({
        id: jobId,
        label: `Exported ${exportCount} ${exportWord} CSV`,
        progress: 100,
        status: "completed",
      });
      toast.success(`Exported ${exportCount} ${exportWord} to CSV`);
    }, 350);
  };

  // Dynamic Columns for Kanban & List Grouping
  const dynamicColumns = React.useMemo<DynamicColumnSpec[]>(() => {
    if (groupBy === "status") {
      return STATUS_COLUMNS.filter((col) => !hiddenStatuses.includes(col.status)).map((col) => ({
        id: `status:${col.status}`,
        label: col.label,
        dot: col.dot,
        pillClass: col.pillClass,
        cardAccent: col.cardAccent,
        targetStatus: col.status,
        tasks: visibleTasks.filter(
          (t) =>
            getEffectiveStatus(t, refTodayIso, automationRules.autoMoveOverdueToDelayed) ===
            col.status,
        ),
      }));
    }

    if (groupBy === "priority") {
      const specs: Array<{ pri: TaskPriority; label: string; dot: string }> = [
        { pri: "URGENT", label: "Urgent", dot: "bg-rose-500" },
        { pri: "HIGH", label: "High", dot: "bg-amber-500" },
        { pri: "MEDIUM", label: "Medium", dot: "bg-blue-500" },
        { pri: "LOW", label: "Low", dot: "bg-slate-400" },
      ];
      return specs.map((s) => ({
        id: `priority:${s.pri}`,
        label: s.label,
        dot: s.dot,
        targetPriority: s.pri,
        tasks: visibleTasks.filter((t) => t.priority === s.pri),
      }));
    }

    if (groupBy === "owner") {
      const cols: DynamicColumnSpec[] = [
        {
          id: "owner:__unassigned__",
          label: "Unassigned",
          dot: "bg-slate-400",
          targetAssigneeId: null,
          tasks: visibleTasks.filter((t) => !t.assignee),
        },
      ];
      for (const m of initialBoard.members) {
        cols.push({
          id: `owner:${m.id}`,
          label: m.name,
          dot: "bg-violet-500",
          targetAssigneeId: m.id,
          tasks: visibleTasks.filter((t) => t.assignee?.id === m.id),
        });
      }
      return cols;
    }

    if (groupBy === "project") {
      return initialBoard.projects.map((p) => ({
        id: `project:${p.id}`,
        label: p.name,
        dot: "bg-violet-500",
        tasks: visibleTasks.filter((t) => t.projectId === p.id),
      }));
    }

    if (groupBy === "phase") {
      const phaseNames = new Set<string>(["General"]);
      for (const t of visibleTasks) {
        phaseNames.add(t.milestoneName ?? "General");
      }
      return Array.from(phaseNames).map((name) => ({
        id: `phase:${name}`,
        label: name,
        dot: "bg-amber-500",
        tasks: visibleTasks.filter((t) => (t.milestoneName ?? "General") === name),
      }));
    }

    // dueDate buckets
    const buckets: Array<{ name: string; dot: string; headerBg?: string }> = [
      { name: "Overdue", dot: "bg-rose-500", headerBg: "border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/25" },
      { name: "Today", dot: "bg-amber-500" },
      { name: "This Week", dot: "bg-blue-500" },
      { name: "Later", dot: "bg-emerald-500" },
      { name: "No Date", dot: "bg-slate-400" },
    ];
    return buckets.map((b) => ({
      id: `due:${b.name}`,
      label: b.name,
      dot: b.dot,
      headerBg: b.headerBg,
      tasks: visibleTasks.filter((t) => getDueDateBucket(t, refTodayIso) === b.name),
    }));
  }, [
    groupBy,
    visibleTasks,
    refTodayIso,
    automationRules.autoMoveOverdueToDelayed,
    initialBoard.members,
    initialBoard.projects,
  ]);

  const activeTask = React.useMemo(
    () => (activeTaskId ? (tasks.find((t) => t.id === activeTaskId) ?? null) : null),
    [activeTaskId, tasks],
  );
  const detailTask = React.useMemo(
    () => (detailTaskId ? (tasks.find((t) => t.id === detailTaskId) ?? null) : null),
    [detailTaskId, tasks],
  );

  const handleStatusChange = (
    taskId: string,
    targetExtStatus: ExtendedTaskStatus,
    options?: { undoFromStatus?: ExtendedTaskStatus },
  ) => {
    const current = tasks.find((t) => t.id === taskId);
    if (!current) return;
    const currentEff = getEffectiveStatus(
      current,
      refTodayIso,
      automationRules.autoMoveOverdueToDelayed,
    );
    if (currentEff === targetExtStatus) return;

    const dbStatus = toPrismaTaskStatus(targetExtStatus);
    const isMetaStatus = EXTENDED_META_STATUSES.has(targetExtStatus);

    const prevTasks = tasks;
    setTasks((list) =>
      list.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: dbStatus,
              extendedStatus: isMetaStatus ? targetExtStatus : undefined,
            }
          : t,
      ),
    );

    startTransition(async () => {
      const res = await moveTaskStatusAction({
        orgSlug,
        taskId,
        status: dbStatus,
        extendedStatus: targetExtStatus,
      });
      if (!res.ok) {
        setTasks(prevTasks);
        toast.error(res.error.message);
        return;
      }

      if (options?.undoFromStatus) {
        const revertStatus = options.undoFromStatus;
        toast.success(
          targetExtStatus === "DONE"
            ? `Task "${current.title}" closed`
            : `Task "${current.title}" reopened`,
          {
            action: {
              label: "Undo",
              onClick: () => handleStatusChange(taskId, revertStatus),
            },
          },
        );
      } else if (targetExtStatus === "IN_REVIEW" && automationRules.autoAssignReviewerInReview) {
        toast.success(`Moved to In Review · Reviewer notified automatically`);
      } else if (targetExtStatus === "DONE" && automationRules.autoCompleteRollupOnClosed) {
        toast.success(`Task closed · Project completion roll-up updated`);
      } else {
        toast.success(`Task moved to ${STATUS_LABELS[targetExtStatus]}`);
      }
    });
  };

  const handleQuickUpdate = (
    taskId: string,
    patch: { priority?: TaskPriority; assigneeId?: string | null; dueDate?: string | null },
  ) => {
    const prevTasks = tasks;
    setTasks((list) =>
      list.map((t) => {
        if (t.id !== taskId) return t;
        const nextMember =
          patch.assigneeId !== undefined
            ? patch.assigneeId
              ? initialBoard.members.find((m) => m.id === patch.assigneeId) ?? null
              : null
            : undefined;
        return {
          ...t,
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
          ...(nextMember !== undefined
            ? {
                assignee: nextMember
                  ? { id: nextMember.id, name: nextMember.name, avatarUrl: null }
                  : null,
              }
            : {}),
        };
      }),
    );

    startTransition(async () => {
      const res = await quickUpdateTaskAction({
        orgSlug,
        taskId,
        ...patch,
      });
      if (!res.ok) {
        setTasks(prevTasks);
        toast.error(res.error.message);
      } else {
        const targetTask = prevTasks.find((t) => t.id === taskId);
        if (patch.assigneeId !== undefined && targetTask) {
          const assignee = patch.assigneeId
            ? initialBoard.members.find((m) => m.id === patch.assigneeId)
            : null;
          emitWorkspaceNotification({
            kind: "assignment",
            actorName: assignee?.name ?? "Team Member",
            title: assignee
              ? `${assignee.name} assigned to ${targetTask.title}`
              : `Task unassigned: ${targetTask.title}`,
            description: `Priority: ${patch.priority ?? targetTask.priority}`,
            entityKey: targetTask.taskKey,
            projectName: targetTask.projectName,
            href: `/${orgSlug}/projects/tasks?taskId=${targetTask.id}`,
            badgeLabel: "Assigned",
          });
        }
        if (patch.priority === "URGENT" && automationRules.notifyOwnerOnUrgent) {
          toast.success("Priority set to URGENT · Owner notified");
        } else {
          toast.success("Task updated");
        }
      }
    });
  };

  const handleToggleComplete = (task: TaskCardDTO) => {
    const isDone = task.status === "DONE" && task.extendedStatus !== "CANCELLED";
    const prevStatus = getEffectiveStatus(
      task,
      refTodayIso,
      automationRules.autoMoveOverdueToDelayed,
    );
    handleStatusChange(task.id, isDone ? "TODO" : "DONE", { undoFromStatus: prevStatus });
  };

  const handleDuplicateTask = (task: TaskCardDTO) => {
    const extStatus = getEffectiveStatus(
      task,
      refTodayIso,
      automationRules.autoMoveOverdueToDelayed,
    );
    const targetExt: ExtendedTaskStatus = extStatus === "DELAYED" ? "TODO" : extStatus;
    startTransition(async () => {
      const res = await createTaskAction({
        orgSlug,
        projectId: task.projectId,
        milestoneId: task.milestoneId ?? null,
        title: `${task.title} (Copy)`.slice(0, 180),
        description: task.description ?? null,
        priority: task.priority,
        status: toPrismaTaskStatus(targetExt),
        extendedStatus: targetExt,
        tags: task.tags ?? [],
        assigneeId: task.assignee?.id ?? null,
        dueDate: task.dueDate ?? null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setTasks((prev) => [...prev, res.data]);
      toast.success(`Duplicated "${task.title}"`);
    });
  };

  const handleDeleteTask = (task: TaskCardDTO) => {
    const prevTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    if (detailTaskId === task.id) setDetailTaskId(null);

    startTransition(async () => {
      const res = await deleteTaskAction({ orgSlug, taskId: task.id });
      if (!res.ok) {
        setTasks(prevTasks);
        toast.error(res.error.message);
        return;
      }
      toast.success(`Deleted "${task.title}"`);
    });
  };

  const handleToggleTimer = (task: TaskCardDTO) => {
    window.dispatchEvent(
      new CustomEvent("bs-toggle-task-timer", {
        detail: {
          projectId: task.projectId,
          taskId: task.id,
          taskTitle: task.title,
          taskKey: task.taskKey,
        },
      }),
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over || !canWrite) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    // Resolve target column spec
    let targetCol: DynamicColumnSpec | undefined;
    if (overId.startsWith("col:")) {
      const colId = overId.slice(4);
      targetCol = dynamicColumns.find((c) => c.id === colId);
    } else {
      targetCol = dynamicColumns.find((c) => c.tasks.some((t) => t.id === overId));
    }
    if (!targetCol) return;

    if (groupBy === "status" && targetCol.targetStatus) {
      handleStatusChange(taskId, targetCol.targetStatus);
    } else if (groupBy === "priority" && targetCol.targetPriority) {
      handleQuickUpdate(taskId, { priority: targetCol.targetPriority });
    } else if (groupBy === "owner" && targetCol.targetAssigneeId !== undefined) {
      handleQuickUpdate(taskId, { assigneeId: targetCol.targetAssigneeId });
    }
  };

  const dndAnnouncements = React.useMemo<Announcements>(() => {
    const describeTask = (rawId: string | number) => {
      const task = tasks.find((t) => t.id === String(rawId));
      if (!task) return "Task";
      return task.taskKey ? `Task ${task.taskKey} (${task.title})` : `Task ${task.title}`;
    };
    const describeOver = (rawId: string | number) => {
      const overId = String(rawId);
      if (overId.startsWith("col:")) {
        const colId = overId.slice(4);
        return dynamicColumns.find((c) => c.id === colId)?.label ?? "column";
      }
      return dynamicColumns.find((c) => c.tasks.some((t) => t.id === overId))?.label ?? "column";
    };
    return {
      onDragStart({ active }) {
        return `Picked up ${describeTask(active.id)}.`;
      },
      onDragOver({ active, over }) {
        if (!over) return `${describeTask(active.id)} is no longer over a column.`;
        return `${describeTask(active.id)} is over ${describeOver(over.id)}.`;
      },
      onDragEnd({ active, over }) {
        if (!over) return `${describeTask(active.id)} was dropped.`;
        return `${describeTask(active.id)} moved to ${describeOver(over.id)}.`;
      },
      onDragCancel({ active }) {
        return `Dragging cancelled for ${describeTask(active.id)}.`;
      },
    };
  }, [tasks, dynamicColumns]);

  const handleCreateTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const dbStatus = toPrismaTaskStatus(newStatus);
    startTransition(async () => {
      const res = await createTaskAction({
        orgSlug,
        projectId: newProjectId,
        milestoneId: newMilestoneId || null,
        title: newTitle,
        priority: newPriority,
        status: dbStatus,
        extendedStatus: newStatus,
        tags: newTags,
        assigneeId: newAssigneeId || null,
        dueDate: newDueDate || null,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      setTasks((prev) => [...prev, res.data]);
      const currentActor =
        initialBoard.members.find((m) => m.id === currentUserId)?.name ?? "Team Member";
      emitWorkspaceNotification({
        kind: "assignment",
        actorName: res.data.assignee?.name ?? currentActor,
        title: res.data.assignee
          ? `${currentActor} assigned ${res.data.taskKey} to ${res.data.assignee.name}`
          : `${currentActor} created task ${res.data.title}`,
        description: `Status: ${STATUS_LABELS[newStatus]} · Priority: ${newPriority}`,
        entityKey: res.data.taskKey,
        projectName: res.data.projectName,
        href: `/${orgSlug}/projects/tasks?taskId=${res.data.id}`,
        badgeLabel: res.data.assignee ? "Assigned" : "New Task",
      });
      setNewTitle("");
      setNewDueDate("");
      setNewTags([]);
      setCreateOpen(false);
      if (newPriority === "URGENT" && automationRules.notifyOwnerOnUrgent) {
        toast.success(`Urgent task "${res.data.title}" added · Owner notified`);
      } else {
        toast.success(`Task "${res.data.title}" added`);
      }
    });
  };

  const handleInlineQuickCreate = async (payload: {
    status: ExtendedTaskStatus;
    title: string;
    projectId: string;
    priority: TaskPriority;
    assigneeId?: string | null;
  }): Promise<boolean> => {
    const dbStatus = toPrismaTaskStatus(payload.status);
    const res = await createTaskAction({
      orgSlug,
      projectId: payload.projectId,
      title: payload.title,
      priority: payload.priority,
      status: dbStatus,
      extendedStatus: payload.status,
      assigneeId: payload.assigneeId !== undefined ? payload.assigneeId : currentUserId || null,
    });
    if (!res.ok) {
      toast.error(res.error.message);
      return false;
    }
    setTasks((prev) => [...prev, res.data]);
    toast.success(`Added "${res.data.title}" to ${STATUS_LABELS[payload.status]}`);
    return true;
  };

  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);

  const updateScrollBounds = React.useCallback(() => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  React.useEffect(() => {
    if (viewMode !== "kanban") return;
    updateScrollBounds();
    window.addEventListener("resize", updateScrollBounds);
    return () => window.removeEventListener("resize", updateScrollBounds);
  }, [viewMode, dynamicColumns.length, collapsedCols.length, collapseEmptyCols, updateScrollBounds]);

  const scrollKanban = (delta: number) => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
    window.setTimeout(updateScrollBounds, 280);
  };

  const toggleColumnCollapse = (colId: string, isCurrentlyEmpty: boolean) => {
    if (collapseEmptyCols && isCurrentlyEmpty) {
      const nextEmptyCols = dynamicColumns
        .filter((c) => c.tasks.length === 0 && c.id !== colId)
        .map((c) => c.id);
      const merged = Array.from(new Set([...collapsedCols, ...nextEmptyCols])).filter(
        (id) => id !== colId,
      );
      persistCollapsedState(merged, false);
      return;
    }
    const nextCols = collapsedCols.includes(colId)
      ? collapsedCols.filter((id) => id !== colId)
      : [...collapsedCols, colId];
    persistCollapsedState(nextCols, collapseEmptyCols);
  };

  const toggleCollapseEmptyCols = () => {
    const next = !collapseEmptyCols;
    if (next) {
      persistCollapsedState(collapsedCols, true);
    } else {
      const emptyIds = new Set(dynamicColumns.filter((c) => c.tasks.length === 0).map((c) => c.id));
      persistCollapsedState(
        collapsedCols.filter((id) => !emptyIds.has(id)),
        false,
      );
    }
  };

  const expandAllColumns = () => {
    persistCollapsedState([], false);
  };

  const toggleStatusVisibility = (status: ExtendedTaskStatus) => {
    if (status === "TODO") return;
    const next = hiddenStatuses.includes(status)
      ? hiddenStatuses.filter((s) => s !== status)
      : [...hiddenStatuses, status];
    persistHiddenStatuses(next);
  };

  const collapsedColumnCount = React.useMemo(
    () =>
      dynamicColumns.filter(
        (c) => collapsedCols.includes(c.id) || (collapseEmptyCols && c.tasks.length === 0),
      ).length,
    [dynamicColumns, collapsedCols, collapseEmptyCols],
  );

  // Gantt bounds
  const ganttTimeline = React.useMemo(() => {
    const rows = visibleTasks.map((t) => {
      const startIso = t.startDate ?? t.dueDate ?? refTodayIso;
      const startMs = Date.parse(startIso);
      const rawEndMs = Date.parse(t.dueDate ?? startIso);
      const endMs = Math.max(rawEndMs, startMs + 5 * 24 * 60 * 60 * 1000);
      return { task: t, startMs, endMs };
    });
    const minMs = rows.length > 0 ? Math.min(...rows.map((r) => r.startMs)) : Date.parse(refTodayIso);
    const maxMs =
      rows.length > 0
        ? Math.max(...rows.map((r) => r.endMs))
        : Date.parse(refTodayIso) + 14 * 86400000;
    const spanMs = Math.max(maxMs - minMs, 14 * 24 * 60 * 60 * 1000);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) =>
      formatDate(new Date(minMs + spanMs * r).toISOString().slice(0, 10)),
    );
    const todayPct = ((Date.parse(refTodayIso) - minMs) / spanMs) * 100;
    return { rows, minMs, spanMs, ticks, todayPct };
  }, [visibleTasks, refTodayIso]);

  const activeProjectLabel = projectFilter
    ? (initialBoard.projects.find((p) => p.id === projectFilter)?.name ?? "Selected Project")
    : "All Projects";

  const projectMilestones = React.useMemo(
    () => (initialBoard.milestones ?? []).filter((m) => m.projectId === newProjectId),
    [initialBoard.milestones, newProjectId],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Consolidated Single-Row Zoho-Style Tasks Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-4 py-2.5 lg:px-5">
        {/* Left: Group-By, Smart Views ▾, Layout Switcher, Labeled Filters Popover, Sort & Activity */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Smart View Presets (All Open ▾) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-background px-2.5 text-xs font-semibold text-foreground"
              >
                <span>{activeSavedViewLabel}</span>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
                  {activeSavedViewCount}
                </Badge>
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Smart Task Views</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={savedView} onValueChange={selectSavedView}>
                {(
                  [
                    "all_open",
                    "my_open",
                    "due_today",
                    "overdue",
                    "unassigned",
                    "completed",
                    "all",
                  ] as TaskSavedView[]
                ).map((viewKey) => (
                  <DropdownMenuRadioItem
                    key={viewKey}
                    value={viewKey}
                    className="flex items-center justify-between"
                  >
                    <span>{TASK_SAVED_VIEW_LABELS[viewKey]}</span>
                    <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px] tabular-nums">
                      {savedViewCounts[viewKey]}
                    </Badge>
                  </DropdownMenuRadioItem>
                ))}
                {customViews.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] text-muted-foreground">
                      Custom Saved Views
                    </DropdownMenuLabel>
                    {customViews.map((cv) => (
                      <div key={cv.id} className="flex items-center justify-between pr-1">
                        <DropdownMenuRadioItem value={cv.id} className="flex-1 truncate">
                          {cv.name}
                        </DropdownMenuRadioItem>
                        <button
                          type="button"
                          title="Delete custom view"
                          onClick={(e) => {
                            e.stopPropagation();
                            persistCustomViews(customViews.filter((item) => item.id !== cv.id));
                            if (savedView === cv.id) setSavedView("all_open");
                          }}
                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <div className="flex items-center gap-1 px-1.5 py-1">
                <Input
                  value={customViewDraft}
                  onChange={(e) => setCustomViewDraft(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Save current view..."
                  className="h-7 text-xs"
                />
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  disabled={!customViewDraft.trim()}
                  onClick={handleSaveCustomView}
                  title="Save Custom View"
                >
                  <BookmarkPlus className="size-3.5" />
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Group-By Switcher (Status ▾) */}
          {viewMode !== "gantt" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 px-2 text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400"
                >
                  <Layers className="size-3.5" />
                  <span>Group: {GROUP_BY_LABELS[groupBy]}</span>
                  <ChevronDown className="size-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Group Board By</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={groupBy}
                  onValueChange={(val) => setGroupBy(val as TaskGroupBy)}
                >
                  {(Object.keys(GROUP_BY_LABELS) as TaskGroupBy[]).map((k) => (
                    <DropdownMenuRadioItem key={k} value={k}>
                      {GROUP_BY_LABELS[k]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Layout Switcher Dropdown (Kanban ▾ / Classic / Gantt) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 bg-background px-2.5 text-xs font-medium"
              >
                {viewMode === "kanban" ? (
                  <Kanban className="size-3.5 text-primary" />
                ) : viewMode === "list" ? (
                  <List className="size-3.5 text-primary" />
                ) : (
                  <GanttChart className="size-3.5 text-primary" />
                )}
                <span>{VIEW_MODE_LABELS[viewMode]}</span>
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuLabel>Layout View</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={viewMode}
                onValueChange={(val) => setViewMode(val as TaskViewMode)}
              >
                <DropdownMenuRadioItem value="kanban">
                  <Kanban className="mr-1.5 size-3.5" />
                  Kanban
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="list">
                  <List className="mr-1.5 size-3.5" />
                  Classic
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="gantt">
                  <GanttChart className="mr-1.5 size-3.5" />
                  Gantt
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Dedicated Multi-Filter Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant={hasActiveFilters ? "secondary" : "outline"}
                className="h-8 gap-1.5 bg-background px-2.5 text-xs font-medium"
              >
                <Filter className="size-3.5 text-muted-foreground" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <Badge className="h-4 px-1.5 py-0 text-[10px] tabular-nums">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-3.5">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b pb-2">
                  <p className="text-xs font-semibold">Filter Tasks</p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="text-[11px] font-medium text-primary hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Search</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Key (SF-T1), title, tag..."
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>

                {/* Assignee Multi-Select */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Assignee</Label>
                  <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() =>
                        setAssigneeFilters((prev) =>
                          prev.includes("__unassigned__")
                            ? prev.filter((id) => id !== "__unassigned__")
                            : [...prev, "__unassigned__"],
                        )
                      }
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
                        assigneeFilters.includes("__unassigned__")
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted",
                      )}
                    >
                      Unassigned
                    </button>
                    {initialBoard.members.map((m) => {
                      const active = assigneeFilters.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            setAssigneeFilters((prev) =>
                              prev.includes(m.id)
                                ? prev.filter((id) => id !== m.id)
                                : [...prev, m.id],
                            )
                          }
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Priority Multi-Select */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">Priority</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["URGENT", "HIGH", "MEDIUM", "LOW"] as TaskPriority[]).map((pri) => {
                      const active = priorityFilters.includes(pri);
                      return (
                        <button
                          key={pri}
                          type="button"
                          onClick={() =>
                            setPriorityFilters((prev) =>
                              prev.includes(pri) ? prev.filter((p) => p !== pri) : [...prev, pri],
                            )
                          }
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-[11px] font-medium transition",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {pri.charAt(0) + pri.slice(1).toLowerCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Project</Label>
                    <select
                      aria-label="Filter by Project"
                      value={projectFilter}
                      onChange={(e) => {
                        setProjectFilter(e.target.value);
                        setPhaseFilter("");
                      }}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">All Projects</option>
                      {initialBoard.projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Phase / Task List</Label>
                    <select
                      aria-label="Filter by Phase"
                      value={phaseFilter}
                      onChange={(e) => setPhaseFilter(e.target.value)}
                      className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">All Phases</option>
                      {phaseFilterOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Due Date Range */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Due From</Label>
                    <Input
                      type="date"
                      value={dueFrom}
                      onChange={(e) => setDueFrom(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Due To</Label>
                    <Input
                      type="date"
                      value={dueTo}
                      onChange={(e) => setDueTo(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Has Logged Time Toggle */}
                <label className="flex cursor-pointer items-center justify-between rounded-md border bg-muted/20 px-2.5 py-2 text-xs">
                  <span className="font-medium">Has Logged Time</span>
                  <input
                    type="checkbox"
                    checked={hasLoggedTime}
                    onChange={(e) => setHasLoggedTime(e.target.checked)}
                    className="size-3.5 accent-primary"
                  />
                </label>
              </div>
            </PopoverContent>
          </Popover>

          {/* Compact Sort Icon */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant={sortBy !== "default" ? "secondary" : "ghost"}
                title={`Sort: ${SORT_LABELS[sortBy]}`}
                aria-label="Sort Tasks"
                className="h-8 w-8"
              >
                <ArrowUpDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuLabel>Sort Tasks</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={sortBy}
                onValueChange={(val) => setSortBy(val as TaskSortBy)}
              >
                {(Object.keys(SORT_LABELS) as TaskSortBy[]).map((sk) => (
                  <DropdownMenuRadioItem key={sk} value={sk} className="text-xs">
                    {SORT_LABELS[sk]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Activity Log Icon */}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            title="Tasks Activity Log"
            aria-label="Tasks Activity Log"
            onClick={() => setActivityOpen(true)}
            className="h-8 w-8"
          >
            <Activity className="size-3.5" />
          </Button>

          {/* Styled Project Filter Pill (quick project scope on wider viewports) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="hidden h-8 max-w-44 gap-1.5 bg-background text-xs font-medium xl:inline-flex"
              >
                <FolderKanban className="size-3.5 shrink-0 text-violet-600" />
                <span className="truncate">{activeProjectLabel}</span>
                <ChevronDown className="size-3 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
              <DropdownMenuLabel>Filter by Project</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={projectFilter}
                onValueChange={(val) => {
                  setProjectFilter(val);
                  setPhaseFilter("");
                }}
              >
                <DropdownMenuRadioItem value="">All Projects</DropdownMenuRadioItem>
                {initialBoard.projects.map((p) => (
                  <DropdownMenuRadioItem key={p.id} value={p.id} className="truncate">
                    {p.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {hasActiveFilters && (
            <Button
              type="button"
              size="xs"
              variant="secondary"
              onClick={clearAllFilters}
              className="h-7 gap-1 rounded-full px-2.5 text-[11px]"
            >
              <X className="size-3" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Right: Search, Automation, Collapse Empty, Show Option, (+ Add Task ▾), More Actions (⋯) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative hidden w-44 md:block">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search key, title..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAutomationOpen(true)}
            className="h-8 gap-1.5 border-emerald-500/30 bg-background text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
          >
            <Workflow className="size-3.5" />
            <span className="hidden sm:inline">Automation</span>
          </Button>

          {/* Collapse Empty Columns Toggle */}
          {viewMode === "kanban" && (
            <Button
              type="button"
              size="sm"
              variant={collapseEmptyCols ? "secondary" : "outline"}
              onClick={toggleCollapseEmptyCols}
              title="Toggle collapse for empty 0-task columns"
              className="h-8 gap-1.5 bg-background text-xs font-medium"
            >
              <ChevronsLeft className="size-3.5 text-muted-foreground" />
              <span className="hidden lg:inline">Collapse Empty</span>
            </Button>
          )}

          {/* Show Option Card Field & Density Customizer */}
          {viewMode === "kanban" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 bg-background text-xs font-medium"
                >
                  <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                  <span className="hidden sm:inline">Show Option</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <p className="text-xs font-semibold">Show Option</p>
                  <button
                    type="button"
                    onClick={() => persistDisplayOptions(DEFAULT_CARD_OPTIONS)}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Reset
                  </button>
                </div>

                {/* Card Density Segmented Switcher */}
                <div className="mt-2.5 space-y-1.5 border-b pb-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Card Density</p>
                  <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-0.5">
                    {(["comfortable", "compact"] as CardDensity[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          persistDisplayOptions({ ...displayOptions, density: mode })
                        }
                        className={cn(
                          "rounded px-2 py-1 text-[11px] font-medium capitalize transition",
                          displayOptions.density === mode
                            ? "bg-background text-foreground shadow-2xs"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-2 space-y-1.5">
                  {CARD_OPTION_LABELS.map((opt) => (
                    <label
                      key={opt.key}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/60"
                    >
                      <input
                        type="checkbox"
                        checked={displayOptions[opt.key]}
                        onChange={(e) =>
                          persistDisplayOptions({
                            ...displayOptions,
                            [opt.key]: e.target.checked,
                          })
                        }
                        className="size-3.5 accent-primary"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {canWrite && initialBoard.projects.length > 0 && (
            <div className="inline-flex items-center rounded-md shadow-2xs">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setNewStatus("TODO");
                  setCreateOpen(true);
                }}
                className="h-8 rounded-r-none border-r border-primary-foreground/20 px-2.5 text-xs"
              >
                <Plus className="size-3.5" />
                Add Task
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    aria-label="Add task options"
                    className="h-8 rounded-l-none px-1.5"
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Quick Create</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setNewStatus("TODO");
                      setCreateOpen(true);
                    }}
                  >
                    <Plus className="size-3.5" />
                    New Task
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPhaseModalOpen(true)}>
                    <Flag className="size-3.5 text-amber-600" />
                    New Task List / Phase
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={tasks.length === 0}
                    onClick={() => setSubtaskModalOpen(true)}
                  >
                    <ListChecks className="size-3.5 text-blue-600" />
                    New Subtask
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Compact More Actions (⋯) Menu beside Add Task */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                title="More Actions"
                aria-label="More Actions"
                className="h-8 w-8 bg-background"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Board Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportTasksCsv}>
                <Download className="size-3.5" />
                Export CSV
              </DropdownMenuItem>
              {canWrite && (
                <DropdownMenuItem onClick={() => setImportOpen(true)}>
                  <Upload className="size-3.5" />
                  Import Tasks (CSV)
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setManageStatusesOpen(true)}>
                <Kanban className="size-3.5" />
                Manage Statuses
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={expandAllColumns}>
                Expand All Columns
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {/* 1. CLASSIC LIST VIEW */}
        {viewMode === "list" && (
          <div className="space-y-4">
            {dynamicColumns.every((g) => g.tasks.length === 0) ? (
              <EmptyState
                icon={ListChecks}
                title={
                  tasks.length === 0
                    ? "No tasks in this workspace yet"
                    : "No tasks match your current filters"
                }
                description="Break projects into actionable deliverables, set dependencies, or import tasks from a CSV file."
                action={
                  canWrite && initialBoard.projects.length > 0
                    ? {
                        label: "New Task",
                        icon: <Plus className="size-3.5" />,
                        onClick: () => setCreateOpen(true),
                      }
                    : undefined
                }
                secondaryAction={
                  canWrite && initialBoard.projects.length > 0
                    ? {
                        label: "Import CSV",
                        icon: <Upload className="size-3.5" />,
                        onClick: () => setImportOpen(true),
                      }
                    : undefined
                }
              />
            ) : (
              dynamicColumns
                .filter((g) => g.tasks.length > 0)
                .map((group) => (
                  <Card key={group.id}>
                    <CardHeader className="py-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <span className={cn("size-2 rounded-full", group.dot)} />
                        <span>{group.label}</span>
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
                          {group.tasks.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24">Key</TableHead>
                            <TableHead>Task</TableHead>
                            <TableHead>Project / Phase</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Priority</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead className="text-right">Due Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.tasks.map((task) => {
                            const effStatus = getEffectiveStatus(
                              task,
                              refTodayIso,
                              automationRules.autoMoveOverdueToDelayed,
                            );
                            const overdue = isTaskOverdue(task, refTodayIso);
                            const depCount = task.dependencies?.length ?? 0;
                            const subCount = task.subtasks?.length ?? 0;
                            return (
                              <TableRow
                                key={task.id}
                                onClick={(e) => {
                                  if ((e.target as HTMLElement).closest("select,button")) return;
                                  setDetailTaskId(task.id);
                                }}
                                className="cursor-pointer hover:bg-muted/40"
                              >
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {task.taskKey ?? `TSK-${task.id.slice(-4).toUpperCase()}`}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium hover:text-primary">
                                      {task.title}
                                    </span>
                                    {subCount > 0 && (
                                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                                        {subCount} subtasks
                                      </Badge>
                                    )}
                                    {depCount > 0 && (
                                      <Badge
                                        variant="secondary"
                                        className="gap-1 px-1.5 py-0 text-[10px]"
                                      >
                                        <GitBranch className="size-2.5" />
                                        {depCount} dep
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  <div>{task.projectName}</div>
                                  <div className="text-[10px]">{task.milestoneName ?? "General"}</div>
                                </TableCell>
                                <TableCell>
                                  {canWrite ? (
                                    <select
                                      value={effStatus}
                                      onChange={(e) =>
                                        handleStatusChange(
                                          task.id,
                                          e.target.value as ExtendedTaskStatus,
                                        )
                                      }
                                      className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                                    >
                                      <option value="DELAYED">Delayed</option>
                                      <option value="TODO">Open / To Do</option>
                                      <option value="IN_PROGRESS">In Progress</option>
                                      <option value="IN_REVIEW">In Review</option>
                                      <option value="TO_BE_TESTED">To be Tested</option>
                                      <option value="ON_HOLD">On Hold</option>
                                      <option value="DONE">Closed / Done</option>
                                      <option value="CANCELLED">Cancelled</option>
                                    </select>
                                  ) : (
                                    <Badge variant="secondary">{STATUS_LABELS[effStatus]}</Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px]",
                                      PRIORITY_BADGE_CLASSES[task.priority],
                                    )}
                                  >
                                    {task.priority}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">
                                  {task.assignee?.name ?? "Unassigned"}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-right text-xs whitespace-nowrap",
                                    overdue
                                      ? "font-semibold text-rose-600 dark:text-rose-400"
                                      : "text-muted-foreground",
                                  )}
                                >
                                  {task.dueDate
                                    ? formatDate(task.dueDate, { withYear: true })
                                    : "No due date"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        )}

        {/* 2. KANBAN BOARD VIEW WITH HORIZONTAL SCROLL CONTROLS */}
        {viewMode === "kanban" && (
          <div className="flex flex-col gap-2">
            {/* Scroll & Column Controls Strip */}
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>
                  Showing <strong className="text-foreground">{visibleTasks.length}</strong>{" "}
                  {visibleTasks.length === 1 ? "task" : "tasks"} across{" "}
                  <strong className="text-foreground">{dynamicColumns.length}</strong>{" "}
                  {dynamicColumns.length === 1 ? "column" : "columns"}
                </span>
                {collapsedColumnCount > 0 && (
                  <button
                    type="button"
                    onClick={expandAllColumns}
                    className="font-medium text-primary hover:underline"
                  >
                    Expand all ({collapsedColumnCount} collapsed)
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  disabled={!canScrollLeft}
                  aria-label="Scroll board left"
                  title="Scroll left"
                  onClick={() => scrollKanban(-340)}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="outline"
                  disabled={!canScrollRight}
                  aria-label="Scroll board right"
                  title="Scroll right"
                  onClick={() => scrollKanban(340)}
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>

            <div
              ref={kanbanScrollRef}
              onScroll={updateScrollBounds}
              className="w-full overflow-x-auto pb-3 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-muted/40"
              style={{ scrollbarGutter: "stable" }}
            >
              <DndContext
                id={dndContextId}
                sensors={sensors}
                collisionDetection={closestCorners}
                accessibility={{ announcements: dndAnnouncements }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="flex min-h-[480px] w-max gap-4 pr-6">
                  {dynamicColumns.map((col) => {
                    const isEmpty = col.tasks.length === 0;
                    const isCollapsed =
                      collapsedCols.includes(col.id) || (collapseEmptyCols && isEmpty);
                    return (
                      <KanbanColumn
                        key={col.id}
                        col={col}
                        todayIso={refTodayIso}
                        canWrite={canWrite}
                        collapsed={isCollapsed}
                        onToggleCollapse={() => toggleColumnCollapse(col.id, isEmpty)}
                        displayOptions={displayOptions}
                        members={initialBoard.members}
                        projects={initialBoard.projects}
                        defaultProjectId={projectFilter}
                        activeTimerTaskId={activeTimerTaskId}
                        onAddInColumn={() => {
                          setNewStatus(col.targetStatus ?? "TODO");
                          if (col.targetPriority) setNewPriority(col.targetPriority);
                          setCreateOpen(true);
                        }}
                        onQuickCreate={handleInlineQuickCreate}
                        onOpenTask={(id) => setDetailTaskId(id)}
                        onToggleComplete={handleToggleComplete}
                        onStatusChange={handleStatusChange}
                        onQuickUpdate={handleQuickUpdate}
                        onDuplicate={handleDuplicateTask}
                        onDelete={handleDeleteTask}
                        onToggleTimer={handleToggleTimer}
                      />
                    );
                  })}
                </div>

                <DragOverlay>
                  {activeTask ? (
                    <div className="w-72">
                      <TaskCardView
                        task={activeTask}
                        todayIso={refTodayIso}
                        canWrite={canWrite}
                        displayOptions={displayOptions}
                        members={initialBoard.members}
                        isTimerActive={activeTimerTaskId === activeTask.id}
                        isOverlay
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </div>
        )}

        {/* 3. GANTT CHART VIEW */}
        {viewMode === "gantt" && (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              {ganttTimeline.rows.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={GanttChart}
                    title="No tasks to show on timeline"
                    description="Create tasks with due dates or import a schedule via CSV to view dependencies on the Gantt chart."
                    compact
                    action={
                      canWrite && initialBoard.projects.length > 0
                        ? {
                            label: "New Task",
                            icon: <Plus className="size-3.5" />,
                            onClick: () => setCreateOpen(true),
                          }
                        : undefined
                    }
                    secondaryAction={
                      canWrite && initialBoard.projects.length > 0
                        ? {
                            label: "Import CSV",
                            icon: <Upload className="size-3.5" />,
                            onClick: () => setImportOpen(true),
                          }
                        : undefined
                    }
                  />
                </div>
              ) : (
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-12 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    <div className="col-span-4">Task &amp; Dependencies</div>
                    <div className="col-span-8 flex items-center justify-between">
                      {ganttTimeline.ticks.map((lbl, idx) => (
                        <span key={`${idx}-${lbl}`}>{lbl}</span>
                      ))}
                    </div>
                  </div>
                  <div className="relative divide-y">
                    {ganttTimeline.todayPct >= 0 && ganttTimeline.todayPct <= 100 && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute top-0 bottom-0 z-10 border-l border-dashed border-rose-500/70"
                        style={{
                          left: `calc(33.3333% + ${(ganttTimeline.todayPct * 66.6667) / 100}%)`,
                        }}
                      />
                    )}
                    {ganttTimeline.rows.map(({ task, startMs, endMs }) => {
                      const effStatus = getEffectiveStatus(
                        task,
                        refTodayIso,
                        automationRules.autoMoveOverdueToDelayed,
                      );
                      const leftPct = Math.max(
                        0,
                        Math.min(
                          90,
                          ((startMs - ganttTimeline.minMs) / ganttTimeline.spanMs) * 100,
                        ),
                      );
                      const widthPct = Math.max(
                        8,
                        Math.min(100 - leftPct, ((endMs - startMs) / ganttTimeline.spanMs) * 100),
                      );
                      const preds = (task.dependencies ?? []).filter(
                        (d) => d.relation === "PREDECESSOR",
                      );

                      return (
                        <div
                          key={task.id}
                          onClick={() => setDetailTaskId(task.id)}
                          className="grid cursor-pointer grid-cols-12 items-center px-4 py-3 text-xs hover:bg-muted/20"
                        >
                          <div className="col-span-4 pr-4">
                            <p className="truncate font-semibold">
                              <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">
                                {task.taskKey}
                              </span>
                              {task.title}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span>{task.projectName}</span>
                              {preds.length > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-amber-600">
                                  <GitBranch className="size-3" />
                                  Depends on: {preds[0]?.targetTaskTitle}
                                  {preds.length > 1 ? ` (+${preds.length - 1})` : ""}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="col-span-8">
                            <div className="relative h-7 rounded-md bg-muted/35">
                              <div
                                className={cn(
                                  "absolute top-1 bottom-1 flex items-center rounded px-2 text-[10px] font-medium text-white shadow-2xs",
                                  effStatus === "DELAYED"
                                    ? "bg-rose-600"
                                    : effStatus === "DONE"
                                      ? "bg-emerald-600"
                                      : effStatus === "IN_PROGRESS"
                                        ? "bg-blue-600"
                                        : effStatus === "IN_REVIEW"
                                          ? "bg-amber-600"
                                          : effStatus === "TO_BE_TESTED"
                                            ? "bg-orange-600"
                                            : effStatus === "ON_HOLD"
                                              ? "bg-yellow-600"
                                              : effStatus === "CANCELLED"
                                                ? "bg-zinc-500"
                                                : "bg-slate-600",
                                )}
                                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                              >
                                <span className="truncate">
                                  {STATUS_LABELS[effStatus]}
                                  {task.dueDate ? ` · ${formatDate(task.dueDate)}` : ""}
                                </span>
                              </div>
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

      {/* Create Task Drawer */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>New Task</SheetTitle>
            <SheetDescription>
              Create a project task with status, phase, priority, owner, tags, and due date.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleCreateTask} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-project">Project</Label>
              <select
                id="task-project"
                value={newProjectId}
                onChange={(e) => {
                  setNewProjectId(e.target.value);
                  setNewMilestoneId("");
                }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                required
              >
                {initialBoard.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {projectMilestones.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="task-phase">Task List / Phase</Label>
                <select
                  id="task-phase"
                  value={newMilestoneId}
                  onChange={(e) => setNewMilestoneId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">General</option>
                  {projectMilestones.map((ms) => (
                    <option key={ms.id} value={ms.id}>
                      {ms.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="task-title">Task Title</Label>
              <Input
                id="task-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Configure customer SSO integration"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="task-status">Status</Label>
                <select
                  id="task-status"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ExtendedTaskStatus)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="DELAYED">Delayed</option>
                  <option value="TODO">Open / To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="TO_BE_TESTED">To be Tested</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="DONE">Closed / Done</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-priority">Priority</Label>
                <select
                  id="task-priority"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
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
                <Label htmlFor="task-assignee">Assignee</Label>
                <select
                  id="task-assignee"
                  value={newAssigneeId}
                  onChange={(e) => setNewAssigneeId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">Unassigned</option>
                  {initialBoard.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-due">Due Date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tags</Label>
              <TagChipsInput tags={newTags} onChange={setNewTags} />
            </div>

            <SheetFooter className="border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
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

      {/* Task Detail Slide-Over Drawer */}
      <TaskDetailSheet
        open={detailTask !== null}
        onOpenChange={(open) => !open && setDetailTaskId(null)}
        orgSlug={orgSlug}
        todayIso={refTodayIso}
        task={detailTask}
        allTasks={tasks}
        members={initialBoard.members}
        canWrite={canWrite}
        onSelectTask={(id) => setDetailTaskId(id)}
        onTaskUpdated={(updated) =>
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
        }
      />

      {/* Automation, Import CSV, Quick Subtask, and Quick Phase Dialogs */}
      <TaskAutomationDialog
        open={automationOpen}
        onOpenChange={setAutomationOpen}
        rules={automationRules}
        onChangeRules={persistAutomationRules}
      />

      <ImportTasksDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        orgSlug={orgSlug}
        projects={initialBoard.projects}
        defaultProjectId={projectFilter}
      />

      <QuickSubtaskDialog
        open={subtaskModalOpen}
        onOpenChange={setSubtaskModalOpen}
        orgSlug={orgSlug}
        tasks={tasks}
      />

      <QuickPhaseDialog
        open={phaseModalOpen}
        onOpenChange={setPhaseModalOpen}
        orgSlug={orgSlug}
        projects={initialBoard.projects}
        defaultProjectId={projectFilter}
      />

      <TaskActivityLogSheet
        open={activityOpen}
        onOpenChange={setActivityOpen}
        tasks={tasks}
        onOpenTask={(id) => setDetailTaskId(id)}
      />

      <ManageStatusesDialog
        open={manageStatusesOpen}
        onOpenChange={setManageStatusesOpen}
        hiddenStatuses={hiddenStatuses}
        onToggleStatusVisibility={toggleStatusVisibility}
        onResetStatuses={() => persistHiddenStatuses([])}
        autoMoveOverdue={automationRules.autoMoveOverdueToDelayed}
        onToggleAutoMoveOverdue={(next) =>
          persistAutomationRules({
            ...automationRules,
            autoMoveOverdueToDelayed: next,
          })
        }
        countsByStatus={countsByStatus}
      />
    </div>
  );
}
