"use client";

import * as React from "react";
import type { TaskPriority, TaskStatus } from "@prisma/client";
import {
  Activity,
  Download,
  FileSpreadsheet,
  Flag,
  ListChecks,
  Loader2,
  Search,
  Upload,
  Workflow,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { emitBackgroundTaskEvent } from "@/modules/projects/components/project-workspace-overlays";
import {
  createMilestoneAction,
  importTasksAction,
  postCommentAction,
} from "@/modules/projects/projects.actions";
import type { TaskCardDTO } from "@/modules/projects/projects.types";

export interface TaskAutomationRulesState {
  autoMoveOverdueToDelayed: boolean;
  autoAssignReviewerInReview: boolean;
  notifyOwnerOnUrgent: boolean;
  autoCompleteRollupOnClosed: boolean;
}

export const DEFAULT_TASK_AUTOMATION_RULES: TaskAutomationRulesState = {
  autoMoveOverdueToDelayed: true,
  autoAssignReviewerInReview: true,
  notifyOwnerOnUrgent: true,
  autoCompleteRollupOnClosed: true,
};

export function TaskAutomationDialog({
  open,
  onOpenChange,
  rules,
  onChangeRules,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: TaskAutomationRulesState;
  onChangeRules: (next: TaskAutomationRulesState) => void;
}) {
  const items: Array<{
    key: keyof TaskAutomationRulesState;
    title: string;
    trigger: string;
    action: string;
  }> = [
    {
      key: "autoMoveOverdueToDelayed",
      title: "Auto-move overdue tasks to Delayed",
      trigger: "When due date < today and task is not Closed / Cancelled",
      action: "Automatically surfaces task in the pinned DELAYED column with an OVERDUE badge.",
    },
    {
      key: "autoAssignReviewerInReview",
      title: "Auto-assign reviewer when moved to In Review",
      trigger: "When Task transitions to IN REVIEW",
      action: "Notifies project lead and flags the task for QA/manager sign-off.",
    },
    {
      key: "notifyOwnerOnUrgent",
      title: "Notify owner when Urgent task is created",
      trigger: "When Task is created or escalated to URGENT priority",
      action: "Sends an immediate workspace alert and logs an audit entry.",
    },
    {
      key: "autoCompleteRollupOnClosed",
      title: "Auto-set completion to 100% when moved to Closed",
      trigger: "When Task moves to CLOSED / DONE",
      action: "Updates completion timestamp and recalculates project % completion roll-up.",
    },
  ];

  const toggle = (key: keyof TaskAutomationRulesState) => {
    const next = { ...rules, [key]: !rules[key] };
    onChangeRules(next);
    toast.success(`Workflow rule ${next[key] ? "enabled" : "paused"}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="size-4 text-emerald-600" />
            Task Workflow Automation Rules
          </DialogTitle>
          <DialogDescription>
            Configure real-time triggers that keep Kanban columns, priorities, and project roll-ups
            in sync.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {items.map((item) => {
            const active = rules[item.key];
            return (
              <div
                key={item.key}
                className="flex items-start justify-between gap-3 rounded-lg border bg-muted/20 p-3.5"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <Badge
                      variant={active ? "default" : "secondary"}
                      className={
                        active
                          ? "bg-emerald-600 text-[10px] text-white hover:bg-emerald-600"
                          : "text-[10px]"
                      }
                    >
                      {active ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Trigger: {item.trigger}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.action}</p>
                </div>

                <label className="mt-0.5 flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggle(item.key)}
                    className="size-4 accent-emerald-600"
                  />
                </label>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Import Tasks (CSV) Dialog ─────────────────────────────────────────────── */

interface ParsedCsvTask {
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  tags: string[];
}

const VALID_PRIORITIES = new Set<TaskPriority>(["LOW", "MEDIUM", "HIGH", "URGENT"]);
const VALID_TASK_STATUSES = new Set<TaskStatus>(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]);

const SAMPLE_TASKS_CSV = `title,priority,status,dueDate,tags
Finalize UAT sign-off checklist,HIGH,TODO,2026-11-26,uat;release
Configure staging webhook retries,URGENT,IN_PROGRESS,2026-11-24,backend;api
Review billing export CSV schema,MEDIUM,IN_REVIEW,2026-11-28,finance`;

function parseTaskCsv(text: string): ParsedCsvTask[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const firstCols = lines[0]!.split(",").map((c) => c.trim().toLowerCase());
  const hasHeader = firstCols.includes("title") || firstCols.includes("task");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      const rawPri = (cols[1] ?? "MEDIUM").toUpperCase();
      const rawSt = (cols[2] ?? "TODO").toUpperCase().replace(/\s+/g, "_");
      const rawDue = cols[3] && /^\d{4}-\d{2}-\d{2}$/.test(cols[3]) ? cols[3] : null;
      const rawTags = (cols[4] ?? "")
        .split(/[;|]/)
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean);
      return {
        title: cols[0] ?? "",
        priority: VALID_PRIORITIES.has(rawPri as TaskPriority)
          ? (rawPri as TaskPriority)
          : "MEDIUM",
        status: VALID_TASK_STATUSES.has(rawSt as TaskStatus) ? (rawSt as TaskStatus) : "TODO",
        dueDate: rawDue,
        tags: rawTags,
      };
    })
    .filter((r) => r.title.length >= 2);
}

export function ImportTasksDialog({
  open,
  onOpenChange,
  orgSlug,
  projects,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  projects: Array<{ id: string; name: string }>;
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = React.useState(defaultProjectId || projects[0]?.id || "");
  const [rawCsv, setRawCsv] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId);
    else if (!projectId && projects[0]?.id) setProjectId(projects[0].id);
  }, [defaultProjectId, projects, projectId]);

  const rows = React.useMemo(() => parseTaskCsv(rawCsv), [rawCsv]);

  const handleImport = () => {
    if (!projectId || rows.length === 0) return;
    const jobId = `import-tasks-${Date.now()}`;
    emitBackgroundTaskEvent({
      id: jobId,
      label: `Importing ${rows.length} task(s)`,
      progress: 30,
      status: "running",
    });

    startTransition(async () => {
      const res = await importTasksAction({ orgSlug, projectId, rows });
      if (!res.ok) {
        emitBackgroundTaskEvent({
          id: jobId,
          label: `Task import failed`,
          progress: 100,
          status: "failed",
        });
        toast.error(res.error.message);
        return;
      }
      emitBackgroundTaskEvent({
        id: jobId,
        label: `Imported ${res.data.count} task(s)`,
        progress: 100,
        status: "completed",
      });
      toast.success(`Imported ${res.data.count} task(s)`);
      setRawCsv("");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            Import Tasks (CSV)
          </DialogTitle>
          <DialogDescription>
            Bulk-import tasks into a project from a CSV file or pasted lines.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Target Project</Label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setRawCsv(typeof reader.result === "string" ? reader.result : "");
                  reader.readAsText(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <FileSpreadsheet className="size-3.5" />
                Choose CSV
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setRawCsv(SAMPLE_TASKS_CSV)}
              >
                <Download className="size-3.5" />
                Load Sample
              </Button>
            </div>
            <Badge variant="secondary" className="text-xs">
              {rows.length} ready
            </Badge>
          </div>

          <textarea
            rows={5}
            value={rawCsv}
            onChange={(e) => setRawCsv(e.target.value)}
            placeholder="title,priority,status,dueDate,tags"
            className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={isPending || rows.length === 0} onClick={handleImport}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Import {rows.length > 0 ? `${rows.length} Task(s)` : "Tasks"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Quick Subtask Dialog ──────────────────────────────────────────────────── */

export function QuickSubtaskDialog({
  open,
  onOpenChange,
  orgSlug,
  tasks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  tasks: TaskCardDTO[];
}) {
  const router = useRouter();
  const [parentTaskId, setParentTaskId] = React.useState(tasks[0]?.id ?? "");
  const [title, setTitle] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!parentTaskId && tasks[0]?.id) setParentTaskId(tasks[0].id);
  }, [tasks, parentTaskId]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = title.replaceAll("|", " ").trim();
    if (!parentTaskId || !clean) return;
    startTransition(async () => {
      const res = await postCommentAction({
        orgSlug,
        entityType: "Task",
        entityId: parentTaskId,
        body: `[SUBTASK]|${clean}|0`,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Subtask "${clean}" added`);
      setTitle("");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="size-4 text-primary" />
            New Subtask
          </DialogTitle>
          <DialogDescription>Attach a checklist item to an existing task.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Parent Task</Label>
            <select
              value={parentTaskId}
              onChange={(e) => setParentTaskId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.taskKey ? `[${t.taskKey}] ` : ""}
                  {t.title} ({t.projectName})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Subtask Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Verify staging webhook payload"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Add Subtask
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Quick Phase / Task List Dialog ────────────────────────────────────────── */

export function QuickPhaseDialog({
  open,
  onOpenChange,
  orgSlug,
  projects,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  projects: Array<{ id: string; name: string }>;
  defaultProjectId?: string;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = React.useState(defaultProjectId || projects[0]?.id || "");
  const [name, setName] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId);
    else if (!projectId && projects[0]?.id) setProjectId(projects[0].id);
  }, [defaultProjectId, projects, projectId]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectId || !name.trim()) return;
    startTransition(async () => {
      const res = await createMilestoneAction({
        orgSlug,
        projectId,
        name: name.trim(),
        dueDate: dueDate || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Phase "${name.trim()}" created`);
      setName("");
      setDueDate("");
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="size-4 text-amber-600" />
            New Task List / Phase
          </DialogTitle>
          <DialogDescription>
            Create a milestone phase to organize tasks on the board and timeline.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
            <Label>Phase / Task List Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., UAT & Production Cutover"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Target Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Create Phase
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Task Activity Log Sheet ───────────────────────────────────────────────── */

export function TaskActivityLogSheet({
  open,
  onOpenChange,
  tasks,
  onOpenTask,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: TaskCardDTO[];
  onOpenTask: (taskId: string) => void;
}) {
  const [query, setQuery] = React.useState("");

  const entries = React.useMemo(() => {
    const items: Array<{
      id: string;
      taskId: string;
      taskKey: string;
      taskTitle: string;
      projectName: string;
      actorName: string;
      summary: string;
      createdAt: string;
    }> = [];
    for (const t of tasks) {
      for (const act of t.activities ?? []) {
        items.push({
          id: act.id,
          taskId: t.id,
          taskKey: t.taskKey ?? `TSK-${t.id.slice(-4).toUpperCase()}`,
          taskTitle: t.title,
          projectName: t.projectName,
          actorName: act.actorName,
          summary: act.summary,
          createdAt: act.createdAt,
        });
      }
    }
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 60);
    return items
      .filter(
        (e) =>
          e.taskTitle.toLowerCase().includes(q) ||
          e.taskKey.toLowerCase().includes(q) ||
          e.actorName.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [tasks, query]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Activity className="size-4 text-violet-600" />
            Tasks Activity Log
          </SheetTitle>
          <SheetDescription>
            Recent status transitions, field edits, and automation updates across tasks.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search task activity..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="space-y-2">
            {entries.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">
                No recent task activity recorded yet. Drag or edit a task to log activity.
              </p>
            ) : (
              entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenTask(entry.taskId);
                  }}
                  className="w-full rounded-lg border bg-muted/20 p-3 text-left text-xs transition hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{entry.actorName}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                      {entry.taskKey}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-foreground">{entry.taskTitle}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {entry.summary} · {entry.projectName}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {entry.createdAt.slice(0, 16).replace("T", " ")} UTC
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
