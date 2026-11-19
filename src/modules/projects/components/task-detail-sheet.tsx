"use client";

import * as React from "react";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import {
  Activity,
  AtSign,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  GitBranch,
  History,
  ListChecks,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDate, formatDateTimeUtc } from "@/lib/format";
import { emitWorkspaceNotification } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import {
  createTimeLogAction,
  deleteTaskMetaCommentAction,
  postCommentAction,
  toggleTaskMetaCommentAction,
  updateTaskDetailsAction,
} from "@/modules/projects/projects.actions";
import type { ExtendedTaskStatus, TaskCardDTO } from "@/modules/projects/projects.types";

type DetailTab =
  | "subtasks"
  | "dependencies"
  | "time-logs"
  | "comments"
  | "attachments"
  | "activity";

export function TaskDetailSheet({
  open,
  onOpenChange,
  orgSlug,
  todayIso,
  task,
  allTasks,
  members,
  canWrite,
  onSelectTask,
  onTaskUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  todayIso: string;
  task: TaskCardDTO | null;
  allTasks: TaskCardDTO[];
  members: Array<{ id: string; name: string }>;
  canWrite: boolean;
  onSelectTask: (taskId: string) => void;
  onTaskUpdated: (updated: TaskCardDTO) => void;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<DetailTab>("subtasks");
  const [descOpen, setDescOpen] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(true);
  const [isPending, startTransition] = React.useTransition();

  // Editable core task fields
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState<ExtendedTaskStatus>("TODO");
  const [priority, setPriority] = React.useState<TaskPriority>("MEDIUM");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");

  // Tab inputs
  const [subtaskTitle, setSubtaskTitle] = React.useState("");
  const [depRelation, setDepRelation] = React.useState<"PREDECESSOR" | "SUCCESSOR">("PREDECESSOR");
  const [depTargetId, setDepTargetId] = React.useState("");
  const [logHours, setLogHours] = React.useState("1");
  const [logBillable, setLogBillable] = React.useState(true);
  const [logNotes, setLogNotes] = React.useState("");
  const [commentText, setCommentText] = React.useState("");
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [attName, setAttName] = React.useState("");
  const [attUrl, setAttUrl] = React.useState("");
  const [attCategory, setAttCategory] = React.useState("Deliverable");
  const [attSize, setAttSize] = React.useState("120 KB");

  React.useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.extendedStatus ?? task.status);
    setPriority(task.priority);
    setAssigneeId(task.assignee?.id ?? "");
    setDueDate(task.dueDate ?? "");
    setDepTargetId(allTasks.find((t) => t.id !== task.id)?.id ?? "");
    setMentionQuery(null);
  }, [task, allTasks]);

  if (!task) return null;

  const subtasks = task.subtasks ?? [];
  const dependencies = task.dependencies ?? [];
  const timeLogs = task.timeLogs ?? [];
  const comments = task.comments ?? [];
  const attachments = task.attachments ?? [];
  const activities = task.activities ?? [];

  const doneSubtasks = subtasks.filter((s) => s.done).length;
  const totalTaskHours = timeLogs.reduce((sum, l) => sum + l.hours, 0);

  const handleSaveDetails = (nextFields?: {
    status?: ExtendedTaskStatus;
    priority?: TaskPriority;
    assigneeId?: string;
    dueDate?: string;
  }) => {
    const targetExtStatus = nextFields?.status ?? status;
    const dbStatus: TaskStatus =
      targetExtStatus === "DELAYED" || targetExtStatus === "CANCELLED"
        ? task.status
        : targetExtStatus;
    const targetPriority = nextFields?.priority ?? priority;
    const targetAssignee = nextFields?.assigneeId ?? assigneeId;
    const targetDue = nextFields?.dueDate ?? dueDate;

    startTransition(async () => {
      const res = await updateTaskDetailsAction({
        orgSlug,
        taskId: task.id,
        title: title.trim() || task.title,
        description: description.trim() || null,
        status: dbStatus,
        extendedStatus: targetExtStatus,
        priority: targetPriority,
        assigneeId: targetAssignee || null,
        dueDate: targetDue || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      const nextMember = members.find((m) => m.id === targetAssignee);
      onTaskUpdated({
        ...task,
        title: title.trim() || task.title,
        description: description.trim() || null,
        status: dbStatus,
        extendedStatus:
          targetExtStatus === "DELAYED" || targetExtStatus === "CANCELLED"
            ? targetExtStatus
            : undefined,
        priority: targetPriority,
        dueDate: targetDue || null,
        assignee: nextMember
          ? { id: nextMember.id, name: nextMember.name, avatarUrl: null }
          : null,
      });
      toast.success("Task updated");
      if (nextFields?.assigneeId !== undefined) {
        emitWorkspaceNotification({
          kind: "assignment",
          actorName: nextMember?.name ?? "Team Member",
          title: nextMember
            ? `${nextMember.name} assigned to ${title.trim() || task.title}`
            : `Task unassigned: ${title.trim() || task.title}`,
          description: `Status: ${targetExtStatus} · Priority: ${targetPriority}`,
          entityKey: task.taskKey,
          projectName: task.projectName,
          href: `/${orgSlug}/projects/tasks?taskId=${task.id}`,
          badgeLabel: "Assigned",
        });
      }
      router.refresh();
    });
  };

  const handleAddSubtask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = subtaskTitle.replaceAll("|", " ").trim();
    if (!clean) return;
    startTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: "Task",
        entityId: task.id,
        body: `[SUBTASK]|${clean}|0`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setSubtaskTitle("");
      toast.success("Subtask added");
      router.refresh();
    });
  };

  const handleToggleSubtask = (sub: { commentId: string; title: string; done: boolean }) => {
    startTransition(async () => {
      const res = await toggleTaskMetaCommentAction({
        orgSlug,
        commentId: sub.commentId,
        body: `[SUBTASK]|${sub.title}|${sub.done ? "0" : "1"}`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      router.refresh();
    });
  };

  const handleDeleteMeta = (commentId: string, label: string) => {
    startTransition(async () => {
      const res = await deleteTaskMetaCommentAction({ orgSlug, commentId });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`${label} removed`);
      router.refresh();
    });
  };

  const handleAddDependency = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = allTasks.find((t) => t.id === depTargetId);
    if (!target) return;
    const cleanTitle = target.title.replaceAll("|", " ");
    startTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: "Task",
        entityId: task.id,
        body: `[DEP]|${depRelation}|${target.id}|${cleanTitle}`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Task dependency linked");
      router.refresh();
    });
  };

  const handleAddTaskTimeLog = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createTimeLogAction({
        orgSlug,
        projectId: task.projectId,
        taskId: task.id,
        hours: Number(logHours),
        billable: logBillable,
        loggedDate: todayIso,
        notes: logNotes.trim() || `Logged on ${task.title}`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setLogNotes("");
      toast.success("Time logged to task");
      router.refresh();
    });
  };

  const handleCommentChange = (val: string) => {
    setCommentText(val);
    const match = val.match(/@([^\s@]*)$/);
    setMentionQuery(match ? (match[1] ?? "").toLowerCase() : null);
  };

  const insertMention = (memberName: string) => {
    setCommentText((prev) => prev.replace(/@([^\s@]*)$/, `@${memberName} `));
    setMentionQuery(null);
  };

  const handlePostComment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = commentText.trim();
    if (!clean) return;
    startTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: "Task",
        entityId: task.id,
        body: clean,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setCommentText("");
      setMentionQuery(null);
      toast.success("Comment posted");
      router.refresh();
    });
  };

  const handleAddAttachment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = attName.replaceAll("|", " ").trim();
    if (!cleanName) return;
    const cleanCat = attCategory.replaceAll("|", " ").trim();
    const cleanSize = attSize.replaceAll("|", " ").trim() || "File";
    const cleanUrl = attUrl.trim() || "#";
    startTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: "Task",
        entityId: task.id,
        body: `[ATT]|${cleanName}|${cleanSize}|${cleanCat}|${cleanUrl}`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setAttName("");
      setAttUrl("");
      toast.success("Attachment saved");
      router.refresh();
    });
  };

  const mentionMatches =
    mentionQuery === null
      ? []
      : members.filter((m) => m.name.toLowerCase().includes(mentionQuery)).slice(0, 5);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {/* Zoho-style Header */}
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <span className="inline-flex items-center gap-1.5 rounded bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white">
              <CheckSquare className="size-3.5" />
              Task
            </span>
            <span className="rounded border bg-muted/60 px-2 py-1 font-mono text-xs font-medium text-muted-foreground">
              {task.taskKey ?? `TSK-${task.id.slice(-5).toUpperCase()}`}
            </span>
            {task.milestoneName && (
              <Badge variant="secondary" className="text-[11px]">
                {task.milestoneName}
              </Badge>
            )}
          </div>

          <SheetTitle className="mt-2">
            {canWrite ? (
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => {
                  if (title.trim() && title.trim() !== task.title) {
                    handleSaveDetails();
                  }
                }}
                className="h-9 border-transparent px-1 text-base font-bold shadow-none hover:border-input focus-visible:border-input"
              />
            ) : (
              task.title
            )}
          </SheetTitle>
          <p className="px-1 text-xs text-muted-foreground">
            {task.projectName}
            {task.assignee ? ` · Assigned to ${task.assignee.name}` : " · Unassigned"}
          </p>
          <SheetDescription className="sr-only">
            Manage task information, subtasks, dependencies, time logs, comments, attachments, and
            activity history.
          </SheetDescription>

          {/* Status Summary Card */}
          <div className="mt-3 rounded-lg border bg-muted/25 px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "size-2.5 rounded-full",
                  status === "DELAYED"
                    ? "bg-rose-500"
                    : status === "DONE"
                      ? "bg-teal-500"
                      : status === "IN_PROGRESS"
                        ? "bg-blue-500"
                        : status === "IN_REVIEW"
                          ? "bg-amber-500"
                          : status === "CANCELLED"
                            ? "bg-zinc-400"
                            : "bg-emerald-500",
                )}
              />
              <select
                aria-label="Task Status"
                value={status}
                disabled={!canWrite || isPending}
                onChange={(e) => {
                  const next = e.target.value as ExtendedTaskStatus;
                  setStatus(next);
                  handleSaveDetails({ status: next });
                }}
                className="bg-transparent text-sm font-semibold text-foreground focus:outline-none"
              >
                <option value="DELAYED">Delayed</option>
                <option value="TODO">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="DONE">Closed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <p className="mt-0.5 pl-4 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Status
            </p>
          </div>

          {/* Collapsible Description Card */}
          <div className="mt-2 rounded-lg border bg-muted/20">
            <button
              type="button"
              onClick={() => setDescOpen((prev) => !prev)}
              className="flex w-full items-center gap-1.5 px-3.5 py-2.5 text-left text-xs font-semibold text-foreground hover:bg-muted/30"
            >
              {descOpen ? (
                <ChevronDown className="size-3.5 text-sky-500" />
              ) : (
                <ChevronRight className="size-3.5 text-sky-500" />
              )}
              <span>Description</span>
              <Plus className="ml-0.5 size-3.5 text-sky-500" />
            </button>
            {descOpen && (
              <div className="border-t px-3.5 py-2.5">
                <textarea
                  rows={3}
                  value={description}
                  disabled={!canWrite || isPending}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => handleSaveDetails()}
                  placeholder="Add task description..."
                  className="w-full rounded-md border border-input bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            )}
          </div>

          {/* Collapsible Zoho Task Information Table */}
          <div className="mt-2 rounded-lg border bg-muted/20">
            <button
              type="button"
              onClick={() => setInfoOpen((prev) => !prev)}
              className="flex w-full items-center gap-1.5 px-3.5 py-2.5 text-left text-xs font-semibold text-foreground hover:bg-muted/30"
            >
              {infoOpen ? (
                <ChevronDown className="size-3.5 text-sky-500" />
              ) : (
                <ChevronRight className="size-3.5 text-sky-500" />
              )}
              <span>Task Information</span>
            </button>
            {infoOpen && (
              <div className="divide-y border-t text-xs">
                <div className="grid grid-cols-3 items-center px-3.5 py-2">
                  <span className="text-muted-foreground">Owner</span>
                  <select
                    value={assigneeId}
                    disabled={!canWrite || isPending}
                    onChange={(e) => {
                      const next = e.target.value;
                      setAssigneeId(next);
                      handleSaveDetails({ assigneeId: next });
                    }}
                    className="col-span-2 h-7 rounded bg-transparent px-1 text-xs font-medium hover:bg-muted/50 focus:bg-background focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 items-center px-3.5 py-2">
                  <span className="text-muted-foreground">Work Hours</span>
                  <span className="col-span-2 px-1 font-mono font-medium tabular-nums">
                    {String(Math.floor(totalTaskHours)).padStart(2, "0")}:
                    {String(Math.round((totalTaskHours % 1) * 60)).padStart(2, "0")}
                  </span>
                </div>

                <div className="grid grid-cols-3 items-center px-3.5 py-2">
                  <span className="text-muted-foreground">Start Date</span>
                  <span className="col-span-2 px-1 text-muted-foreground">
                    {task.startDate ? formatDate(task.startDate, { withYear: true }) : "—"}
                  </span>
                </div>

                <div className="grid grid-cols-3 items-center px-3.5 py-2">
                  <span className="text-muted-foreground">Due Date</span>
                  <Input
                    type="date"
                    value={dueDate}
                    disabled={!canWrite || isPending}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDueDate(next);
                      handleSaveDetails({ dueDate: next });
                    }}
                    className="col-span-2 h-7 border-transparent bg-transparent px-1 text-xs shadow-none hover:border-input focus-visible:border-input"
                  />
                </div>

                <div className="grid grid-cols-3 items-center px-3.5 py-2">
                  <span className="text-muted-foreground">Priority</span>
                  <select
                    value={priority}
                    disabled={!canWrite || isPending}
                    onChange={(e) => {
                      const next = e.target.value as TaskPriority;
                      setPriority(next);
                      handleSaveDetails({ priority: next });
                    }}
                    className="col-span-2 h-7 rounded bg-transparent px-1 text-xs font-medium hover:bg-muted/50 focus:bg-background focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 items-center px-3.5 py-2">
                  <span className="text-muted-foreground">Completion %</span>
                  <span className="col-span-2 px-1 font-medium tabular-nums">
                    {status === "DONE"
                      ? "100%"
                      : subtasks.length > 0
                        ? `${Math.round((doneSubtasks / subtasks.length) * 100)}%`
                        : "0%"}
                  </span>
                </div>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Sub-Tabs Navigation */}
        <div className="flex gap-1 overflow-x-auto border-b bg-muted/20 px-4">
          {[
            { id: "subtasks" as const, label: `Subtasks (${doneSubtasks}/${subtasks.length})`, icon: ListChecks },
            { id: "dependencies" as const, label: `Dependencies (${dependencies.length})`, icon: GitBranch },
            { id: "time-logs" as const, label: `Time Logs (${totalTaskHours.toFixed(1)}h)`, icon: Clock },
            { id: "comments" as const, label: `Comments (${comments.length})`, icon: MessageSquare },
            { id: "attachments" as const, label: `Attachments (${attachments.length})`, icon: Paperclip },
            { id: "activity" as const, label: "Activity History", icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-xs font-medium transition",
                  active
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

        {/* Tab Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* 1. SUBTASKS */}
          {activeTab === "subtasks" && (
            <div className="space-y-4">
              {canWrite && (
                <form onSubmit={handleAddSubtask} className="flex gap-2">
                  <Input
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    placeholder="Add a subtask step..."
                    className="h-8 text-xs"
                  />
                  <Button type="submit" size="sm" className="h-8" disabled={isPending}>
                    <Plus className="size-3.5" />
                    Add
                  </Button>
                </form>
              )}

              <div className="space-y-1.5">
                {subtasks.length === 0 ? (
                  <p className="rounded-lg border p-4 text-center text-xs text-muted-foreground">
                    No subtasks yet. Break this task down into actionable steps above.
                  </p>
                ) : (
                  subtasks.map((sub) => (
                    <div
                      key={sub.commentId}
                      className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                    >
                      <button
                        type="button"
                        disabled={!canWrite || isPending}
                        onClick={() => handleToggleSubtask(sub)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded border",
                            sub.done
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-input",
                          )}
                        >
                          {sub.done && <Check className="size-3" />}
                        </span>
                        <span className={cn(sub.done && "text-muted-foreground line-through")}>
                          {sub.title}
                        </span>
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMeta(sub.commentId, "Subtask")}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 2. DEPENDENCIES */}
          {activeTab === "dependencies" && (
            <div className="space-y-4">
              {canWrite && allTasks.length > 1 && (
                <form onSubmit={handleAddDependency} className="grid gap-2 sm:grid-cols-12">
                  <select
                    value={depRelation}
                    onChange={(e) =>
                      setDepRelation(e.target.value as "PREDECESSOR" | "SUCCESSOR")
                    }
                    className="sm:col-span-4 flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="PREDECESSOR">Predecessor (Blocked by)</option>
                    <option value="SUCCESSOR">Successor (Blocks)</option>
                  </select>
                  <select
                    value={depTargetId}
                    onChange={(e) => setDepTargetId(e.target.value)}
                    className="sm:col-span-6 flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    {allTasks
                      .filter((t) => t.id !== task.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.projectName} — {t.title}
                        </option>
                      ))}
                  </select>
                  <Button type="submit" size="sm" className="sm:col-span-2 h-8" disabled={isPending}>
                    Link
                  </Button>
                </form>
              )}

              <div className="space-y-2">
                {dependencies.length === 0 ? (
                  <p className="rounded-lg border p-4 text-center text-xs text-muted-foreground">
                    No predecessor or successor dependencies linked yet.
                  </p>
                ) : (
                  dependencies.map((dep) => (
                    <div
                      key={dep.commentId}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge
                          variant={dep.relation === "PREDECESSOR" ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {dep.relation === "PREDECESSOR" ? "Blocked By" : "Blocks"}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => onSelectTask(dep.targetTaskId)}
                          className="truncate font-medium hover:text-primary hover:underline"
                        >
                          {dep.targetTaskTitle}
                        </button>
                      </div>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMeta(dep.commentId, "Dependency")}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 3. TIME LOGS */}
          {activeTab === "time-logs" && (
            <div className="space-y-4">
              {canWrite && (
                <form
                  onSubmit={handleAddTaskTimeLog}
                  className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-12"
                >
                  <Input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    value={logHours}
                    onChange={(e) => setLogHours(e.target.value)}
                    placeholder="Hours"
                    className="sm:col-span-2 h-8 text-xs"
                    required
                  />
                  <Input
                    value={logNotes}
                    onChange={(e) => setLogNotes(e.target.value)}
                    placeholder="Notes for this task log..."
                    className="sm:col-span-5 h-8 text-xs"
                  />
                  <label className="sm:col-span-3 flex cursor-pointer items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={logBillable}
                      onChange={(e) => setLogBillable(e.target.checked)}
                      className="size-3.5 accent-primary"
                    />
                    <span>Billable</span>
                  </label>
                  <Button type="submit" size="sm" className="sm:col-span-2 h-8" disabled={isPending}>
                    {isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Log"}
                  </Button>
                </form>
              )}

              <div className="space-y-2">
                {timeLogs.length === 0 ? (
                  <p className="rounded-lg border p-4 text-center text-xs text-muted-foreground">
                    No hours logged directly on this task yet.
                  </p>
                ) : (
                  timeLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold">
                          {log.userName} · {formatDate(log.loggedDate, { withYear: true })}
                        </p>
                        {log.notes && <p className="text-muted-foreground">{log.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={log.billable ? "default" : "outline"} className="text-[10px]">
                          {log.billable ? "Billable" : "Internal"}
                        </Badge>
                        <span className="font-bold tabular-nums">{log.hours.toFixed(2)}h</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 4. COMMENTS (@mentions) */}
          {activeTab === "comments" && (
            <div className="space-y-4">
              {canWrite && (
                <form onSubmit={handlePostComment} className="relative space-y-2">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        value={commentText}
                        onChange={(e) => handleCommentChange(e.target.value)}
                        placeholder="Write a comment... type @ to mention a teammate"
                        className="h-9 pr-8 text-xs"
                      />
                      <AtSign className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <Button type="submit" size="sm" disabled={isPending || !commentText.trim()}>
                      <Send className="size-3.5" />
                      Post
                    </Button>
                  </div>

                  {mentionMatches.length > 0 && (
                    <div className="rounded-lg border bg-popover p-1 shadow-md">
                      {mentionMatches.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => insertMention(m.name)}
                          className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs hover:bg-muted"
                        >
                          <AtSign className="size-3 text-violet-600" />
                          <span className="font-medium">{m.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </form>
              )}

              <div className="space-y-2.5">
                {comments.length === 0 ? (
                  <p className="rounded-lg border p-4 text-center text-xs text-muted-foreground">
                    No comments yet. Mention teammates with @ to notify them.
                  </p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="rounded-lg border bg-muted/20 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{c.authorName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDateTimeUtc(c.createdAt)} UTC
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 5. ATTACHMENTS */}
          {activeTab === "attachments" && (
            <div className="space-y-4">
              {canWrite && (
                <form
                  onSubmit={handleAddAttachment}
                  className="space-y-2.5 rounded-lg border bg-muted/20 p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={attName}
                      onChange={(e) => setAttName(e.target.value)}
                      placeholder="File name (e.g. Wireframe-v2.pdf)"
                      className="h-8 text-xs"
                      required
                    />
                    <Input
                      value={attCategory}
                      onChange={(e) => setAttCategory(e.target.value)}
                      placeholder="Category (e.g. Spec, Asset)"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      className="h-8 text-xs"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setAttName(file.name);
                          setAttSize(`${Math.max(1, Math.round(file.size / 1024))} KB`);
                        }
                      }}
                    />
                    <Input
                      type="url"
                      value={attUrl}
                      onChange={(e) => setAttUrl(e.target.value)}
                      placeholder="Optional link URL..."
                      className="h-8 text-xs"
                    />
                    <Button type="submit" size="sm" className="h-8" disabled={isPending}>
                      Attach
                    </Button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {attachments.length === 0 ? (
                  <p className="rounded-lg border p-4 text-center text-xs text-muted-foreground">
                    No files or links attached to this task yet.
                  </p>
                ) : (
                  attachments.map((att) => (
                    <div
                      key={att.commentId}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{att.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {att.category} · {att.sizeLabel} · Added by {att.authorName}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {att.url !== "#" && (
                          <a
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Open
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMeta(att.commentId, "Attachment")}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 6. ACTIVITY HISTORY */}
          {activeTab === "activity" && (
            <div className="space-y-2.5">
              {activities.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border p-4 text-xs text-muted-foreground">
                  <Activity className="size-4" />
                  <span>Task activity entries appear here as status and details change.</span>
                </div>
              ) : (
                activities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between gap-2 rounded-lg border p-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold">{act.actorName}</p>
                      <p className="text-muted-foreground">
                        {act.action} · {act.summary}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {formatDateTimeUtc(act.createdAt)} UTC
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
