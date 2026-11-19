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
import type { TaskPriority, TaskStatus } from "@prisma/client";
import {
  Calendar,
  Clock,
  GanttChart,
  GitBranch,
  GripVertical,
  Kanban,
  Layers,
  List,
  ListChecks,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TaskDetailSheet } from "@/modules/projects/components/task-detail-sheet";
import { createTaskAction, moveTaskStatusAction } from "@/modules/projects/projects.actions";
import type { TaskCardDTO, TasksBoardDTO } from "@/modules/projects/projects.types";

type TaskViewMode = "list" | "kanban" | "gantt";
type TaskGroupBy = "project" | "status" | "priority" | "owner";

const TASK_COLUMNS: Array<{ status: TaskStatus; label: string; dot: string }> = [
  { status: "TODO", label: "Open / To Do", dot: "bg-slate-500" },
  { status: "IN_PROGRESS", label: "In Progress", dot: "bg-blue-500" },
  { status: "IN_REVIEW", label: "In Review", dot: "bg-amber-500" },
  { status: "DONE", label: "Closed / Done", dot: "bg-emerald-500" },
];

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "Open / To Do",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Closed / Done",
};

function TaskCardView({
  task,
  canWrite,
  isDragging = false,
  isOverlay = false,
  dragProps,
  onOpenDetail,
}: {
  task: TaskCardDTO;
  canWrite: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
  dragProps?: React.HTMLAttributes<HTMLButtonElement>;
  onOpenDetail?: () => void;
}) {
  const subtaskCount = task.subtasks?.length ?? 0;
  const doneSub = task.subtasks?.filter((s) => s.done).length ?? 0;
  const depCount = task.dependencies?.length ?? 0;
  const hours = (task.timeLogs ?? []).reduce((s, l) => s + l.hours, 0);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 shadow-2xs transition",
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
          <button
            type="button"
            onClick={onOpenDetail}
            className="text-left text-sm font-medium leading-snug hover:text-primary hover:underline"
          >
            {task.title}
          </button>
          <p className="mt-1 truncate text-xs text-muted-foreground">{task.projectName}</p>
        </div>
      </div>

      {(subtaskCount > 0 || depCount > 0 || hours > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
          {subtaskCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <ListChecks className="size-3" />
              {doneSub}/{subtaskCount}
            </span>
          )}
          {depCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-amber-600">
              <GitBranch className="size-3" />
              {depCount} dep
            </span>
          )}
          {hours > 0 && (
            <span className="inline-flex items-center gap-0.5 text-emerald-600">
              <Clock className="size-3" />
              {hours.toFixed(1)}h
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
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

function SortableTaskCard({
  task,
  canWrite,
  onOpenDetail,
}: {
  task: TaskCardDTO;
  canWrite: boolean;
  onOpenDetail: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !canWrite,
  });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <TaskCardView
        task={task}
        canWrite={canWrite}
        isDragging={isDragging}
        dragProps={{ ...attributes, ...listeners }}
        onOpenDetail={onOpenDetail}
      />
    </div>
  );
}

function TaskColumn({
  status,
  label,
  dot,
  tasks,
  canWrite,
  onAddInStatus,
  onOpenTask,
}: {
  status: TaskStatus;
  label: string;
  dot: string;
  tasks: TaskCardDTO[];
  canWrite: boolean;
  onAddInStatus: (status: TaskStatus) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `col:${status}` });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-76 shrink-0 flex-col rounded-xl border bg-muted/35 p-3 transition-colors",
        isOver && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", dot)} />
          <h3 className="text-xs font-semibold uppercase tracking-wider">{label}</h3>
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
            {tasks.length}
          </Badge>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() => onAddInStatus(status)}
            className="rounded p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
            aria-label={`Add task to ${label}`}
          >
            <Plus className="size-3.5" />
          </button>
        )}
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2.5">
          {tasks.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
              Drop tasks here
            </div>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                canWrite={canWrite}
                onOpenDetail={() => onOpenTask(task.id)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function TaskKanbanBoard({
  orgSlug,
  todayIso = "",
  initialBoard,
  canWrite,
  defaultProjectId,
  openCreateInitially = false,
}: {
  orgSlug: string;
  todayIso?: string;
  initialBoard: TasksBoardDTO;
  canWrite: boolean;
  defaultProjectId?: string;
  openCreateInitially?: boolean;
}) {
  const dndContextId = React.useId();
  const [tasks, setTasks] = React.useState<TaskCardDTO[]>(initialBoard.tasks);
  const [viewMode, setViewMode] = React.useState<TaskViewMode>("kanban");
  const [groupBy, setGroupBy] = React.useState<TaskGroupBy>("project");
  const [projectFilter, setProjectFilter] = React.useState(defaultProjectId ?? "");
  const [search, setSearch] = React.useState("");
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(openCreateInitially);
  const [newStatus, setNewStatus] = React.useState<TaskStatus>("TODO");
  const [newProjectId, setNewProjectId] = React.useState(
    defaultProjectId || initialBoard.projects[0]?.id || "",
  );
  const [newTitle, setNewTitle] = React.useState("");
  const [newPriority, setNewPriority] = React.useState<TaskPriority>("MEDIUM");
  const [newAssigneeId, setNewAssigneeId] = React.useState("");
  const [newDueDate, setNewDueDate] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setTasks(initialBoard.tasks);
  }, [initialBoard.tasks]);

  React.useEffect(() => {
    if (openCreateInitially) setCreateOpen(true);
  }, [openCreateInitially]);

  React.useEffect(() => {
    const onQuickAdd = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "tasks") setCreateOpen(true);
    };
    window.addEventListener("bs-quick-add", onQuickAdd);
    return () => window.removeEventListener("bs-quick-add", onQuickAdd);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const visibleTasks = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (projectFilter && t.projectId !== projectFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.projectName.toLowerCase().includes(q) ||
        (t.assignee?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [tasks, projectFilter, search]);

  const groupedTasks = React.useMemo(() => {
    const map = new Map<string, TaskCardDTO[]>();
    for (const task of visibleTasks) {
      let key = "";
      switch (groupBy) {
        case "project":
          key = task.projectName;
          break;
        case "status":
          key = STATUS_LABELS[task.status];
          break;
        case "priority":
          key = task.priority;
          break;
        case "owner":
          key = task.assignee?.name ?? "Unassigned";
          break;
      }
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [visibleTasks, groupBy]);

  const activeTask = React.useMemo(
    () => (activeTaskId ? (tasks.find((t) => t.id === activeTaskId) ?? null) : null),
    [activeTaskId, tasks],
  );
  const detailTask = React.useMemo(
    () => (detailTaskId ? (tasks.find((t) => t.id === detailTaskId) ?? null) : null),
    [detailTaskId, tasks],
  );

  const handleStatusChange = (taskId: string, targetStatus: TaskStatus) => {
    const current = tasks.find((t) => t.id === taskId);
    if (!current || current.status === targetStatus) return;

    const prevTasks = tasks;
    setTasks((list) =>
      list.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t)),
    );

    startTransition(async () => {
      const res = await moveTaskStatusAction({ orgSlug, taskId, status: targetStatus });
      if (!res.ok) {
        setTasks(prevTasks);
        toast.error(res.error.message);
      } else {
        toast.success(`Task moved to ${STATUS_LABELS[targetStatus]}`);
      }
    });
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

    const targetStatus: TaskStatus | null = overId.startsWith("col:")
      ? (overId.slice(4) as TaskStatus)
      : (tasks.find((t) => t.id === overId)?.status ?? null);

    if (targetStatus) handleStatusChange(taskId, targetStatus);
  };

  const handleCreateTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createTaskAction({
        orgSlug,
        projectId: newProjectId,
        title: newTitle,
        priority: newPriority,
        status: newStatus,
        assigneeId: newAssigneeId || null,
        dueDate: newDueDate || null,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      setTasks((prev) => [...prev, res.data]);
      setNewTitle("");
      setNewDueDate("");
      setCreateOpen(false);
      toast.success(`Task "${res.data.title}" added`);
    });
  };

  // Gantt bounds
  const ganttTimeline = React.useMemo(() => {
    const refIso = todayIso || "2026-11-18";
    const rows = visibleTasks.map((t) => {
      const startIso = t.startDate ?? t.dueDate ?? refIso;
      const startMs = Date.parse(startIso);
      const rawEndMs = Date.parse(t.dueDate ?? startIso);
      const endMs = Math.max(rawEndMs, startMs + 5 * 24 * 60 * 60 * 1000);
      return { task: t, startMs, endMs };
    });
    const minMs = rows.length > 0 ? Math.min(...rows.map((r) => r.startMs)) : Date.parse(refIso);
    const maxMs =
      rows.length > 0 ? Math.max(...rows.map((r) => r.endMs)) : Date.parse(refIso) + 14 * 86400000;
    const spanMs = Math.max(maxMs - minMs, 14 * 24 * 60 * 60 * 1000);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) =>
      formatDate(new Date(minMs + spanMs * r).toISOString().slice(0, 10)),
    );
    const todayPct = ((Date.parse(refIso) - minMs) / spanMs) * 100;
    return { rows, minMs, spanMs, ticks, todayPct };
  }, [visibleTasks, todayIso]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-4 lg:px-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Manage deliverables across Classic List, Kanban Board, and Gantt Chart timelines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite && initialBoard.projects.length > 0 && (
            <Button
              size="sm"
              onClick={() => {
                setNewStatus("TODO");
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" />
              New Task
            </Button>
          )}
        </div>
      </div>

      {/* Zoho Sub-Toolbar: View Switchers + Group By + Project Filter + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2.5 lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center rounded-lg border bg-background p-0.5"
            role="group"
            aria-label="Task view mode"
          >
            {[
              { id: "list" as const, label: "Classic List", icon: List },
              { id: "kanban" as const, label: "Kanban Board", icon: Kanban },
              { id: "gantt" as const, label: "Gantt Chart", icon: GanttChart },
            ].map((mode) => {
              const Icon = mode.icon;
              const active = viewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setViewMode(mode.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                    active
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

          {viewMode === "list" && (
            <div className="flex items-center gap-1.5">
              <Layers className="size-3.5 text-muted-foreground" />
              <select
                aria-label="Group tasks by"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as TaskGroupBy)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
              >
                <option value="project">Group by: Project</option>
                <option value="status">Group by: Status</option>
                <option value="priority">Group by: Priority</option>
                <option value="owner">Group by: Owner</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter tasks by project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
          >
            <option value="">All Projects</option>
            {initialBoard.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="relative w-56">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {/* 1. CLASSIC LIST VIEW */}
        {viewMode === "list" && (
          <div className="space-y-4">
            {groupedTasks.length === 0 ? (
              <Card>
                <CardContent className="flex h-36 items-center justify-center text-sm text-muted-foreground">
                  No tasks match the current filter.
                </CardContent>
              </Card>
            ) : (
              groupedTasks.map((group) => (
                <Card key={group.label}>
                  <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <span>{group.label}</span>
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
                        {group.items.length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Task</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead className="text-right">Due Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {group.items.map((task) => {
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
                                {task.projectName}
                              </TableCell>
                              <TableCell>
                                {canWrite ? (
                                  <select
                                    value={task.status}
                                    onChange={(e) =>
                                      handleStatusChange(task.id, e.target.value as TaskStatus)
                                    }
                                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                                  >
                                    <option value="TODO">Open / To Do</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="IN_REVIEW">In Review</option>
                                    <option value="DONE">Closed / Done</option>
                                  </select>
                                ) : (
                                  <Badge variant="secondary">{STATUS_LABELS[task.status]}</Badge>
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

        {/* 2. KANBAN BOARD VIEW */}
        {viewMode === "kanban" && (
          <div className="overflow-x-auto pb-2">
            <DndContext
              id={dndContextId}
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex min-h-[460px] gap-4">
                {TASK_COLUMNS.map((col) => (
                  <TaskColumn
                    key={col.status}
                    status={col.status}
                    label={col.label}
                    dot={col.dot}
                    tasks={visibleTasks.filter((t) => t.status === col.status)}
                    canWrite={canWrite}
                    onAddInStatus={(st) => {
                      setNewStatus(st);
                      setCreateOpen(true);
                    }}
                    onOpenTask={(id) => setDetailTaskId(id)}
                  />
                ))}
              </div>

              <DragOverlay>
                {activeTask ? (
                  <div className="w-72">
                    <TaskCardView task={activeTask} canWrite={canWrite} isOverlay />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )}

        {/* 3. GANTT CHART VIEW */}
        {viewMode === "gantt" && (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              {ganttTimeline.rows.length === 0 ? (
                <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
                  No tasks match the current filter.
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
                            <p className="truncate font-semibold">{task.title}</p>
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
                                  task.status === "DONE"
                                    ? "bg-emerald-600"
                                    : task.status === "IN_PROGRESS"
                                      ? "bg-blue-600"
                                      : task.status === "IN_REVIEW"
                                        ? "bg-amber-600"
                                        : "bg-slate-600",
                                )}
                                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                              >
                                <span className="truncate">
                                  {STATUS_LABELS[task.status]} ·{" "}
                                  {task.dueDate ? formatDate(task.dueDate) : "Flexible"}
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

      {/* Create Task Slide-Over Drawer */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>New Task</SheetTitle>
            <SheetDescription>Assign a task to a project and team member.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateTask} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-project">Project</Label>
              <select
                id="task-project"
                value={newProjectId}
                onChange={(e) => setNewProjectId(e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {initialBoard.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-title">Task Title</Label>
              <Input
                id="task-title"
                placeholder="e.g. Configure production DNS & SSL"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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

            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Add Task
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Rich Task Detail Slide-Over Drawer */}
      <TaskDetailSheet
        open={detailTask !== null}
        onOpenChange={(open) => !open && setDetailTaskId(null)}
        orgSlug={orgSlug}
        todayIso={todayIso || "2026-11-18"}
        task={detailTask}
        allTasks={tasks}
        members={initialBoard.members}
        canWrite={canWrite}
        onSelectTask={(id) => setDetailTaskId(id)}
        onTaskUpdated={(updated) => {
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        }}
      />
    </div>
  );
}
