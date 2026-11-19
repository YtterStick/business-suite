"use client";

import * as React from "react";
import {
  closestCorners,
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { IssueSeverity, IssueStatus } from "@prisma/client";
import {
  Bug,
  Calendar,
  GanttChart,
  GripVertical,
  Kanban,
  Layers,
  List,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";

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
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createIssueAction, updateIssueStatusAction } from "@/modules/projects/projects.actions";
import type { IssueRowDTO } from "@/modules/projects/projects.types";

type IssueViewMode = "list" | "kanban" | "gantt";
type IssueGroupBy = "project" | "status" | "severity" | "owner";

const ISSUE_COLUMNS: Array<{ status: IssueStatus; label: string; dot: string }> = [
  { status: "OPEN", label: "Open", dot: "bg-rose-500" },
  { status: "IN_PROGRESS", label: "In Progress", dot: "bg-blue-500" },
  { status: "RESOLVED", label: "Resolved", dot: "bg-emerald-500" },
  { status: "CLOSED", label: "Closed", dot: "bg-slate-500" },
];

function SortableIssueCard({
  issue,
  canWrite,
}: {
  issue: IssueRowDTO;
  canWrite: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    disabled: !canWrite,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-xl border bg-card p-3 shadow-2xs transition",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5">
        {canWrite && (
          <button
            type="button"
            className="mt-0.5 cursor-grab text-muted-foreground/60 hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-3.5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug">{issue.title}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{issue.projectName}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <Badge
          variant={
            issue.severity === "CRITICAL" || issue.severity === "HIGH" ? "destructive" : "outline"
          }
          className="px-1.5 py-0 text-[10px]"
        >
          {issue.severity}
        </Badge>
        <span className="truncate">{issue.assignee?.name ?? "Unassigned"}</span>
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
}: {
  status: IssueStatus;
  label: string;
  dot: string;
  issues: IssueRowDTO[];
  canWrite: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `issue-col:${status}` });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/35 p-3 transition",
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
            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
              Drop issues here
            </div>
          ) : (
            issues.map((issue) => (
              <SortableIssueCard key={issue.id} issue={issue} canWrite={canWrite} />
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
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(openCreateInitially);
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? "");
  const [title, setTitle] = React.useState("");
  const [severity, setSeverity] = React.useState<IssueSeverity>("MEDIUM");
  const [assigneeId, setAssigneeId] = React.useState("");
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
    window.addEventListener("bs-quick-add", onQuickAdd);
    return () => window.removeEventListener("bs-quick-add", onQuickAdd);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const visibleIssues = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return localIssues.filter((i) => {
      if (projectFilter && i.projectId !== projectFilter) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        i.projectName.toLowerCase().includes(q) ||
        (i.assignee?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [localIssues, projectFilter, search]);

  const groupedIssues = React.useMemo(() => {
    const map = new Map<string, IssueRowDTO[]>();
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
          key = issue.severity;
          break;
        case "owner":
          key = issue.assignee?.name ?? "Unassigned";
          break;
      }
      const bucket = map.get(key) ?? [];
      bucket.push(issue);
      map.set(key, bucket);
    }
    return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
  }, [visibleIssues, groupBy]);

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

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createIssueAction({
        orgSlug,
        projectId,
        title,
        severity,
        assigneeId: assigneeId || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setTitle("");
      setOpen(false);
      toast.success("Issue logged");
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-4 lg:px-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Issues</h1>
          <p className="text-sm text-muted-foreground">
            Track bugs, blockers, and client escalations across Classic List, Kanban, and Gantt.
          </p>
        </div>
        {canWrite && projects.length > 0 && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Submit Issue
          </Button>
        )}
      </div>

      {/* Zoho Sub-Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/20 px-4 py-2.5 lg:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border bg-background p-0.5">
            {[
              { id: "list" as const, label: "Classic List", icon: List },
              { id: "kanban" as const, label: "Kanban Board", icon: Kanban },
              { id: "gantt" as const, label: "Gantt Chart", icon: GanttChart },
            ].map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setViewMode(mode.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                    viewMode === mode.id
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
                aria-label="Group issues by"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as IssueGroupBy)}
                className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
              >
                <option value="project">Group by: Project</option>
                <option value="status">Group by: Status</option>
                <option value="severity">Group by: Severity</option>
                <option value="owner">Group by: Owner</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter issues by project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2.5 text-xs"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
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
              placeholder="Search issues..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-4 p-4 lg:p-6">
        {viewMode === "list" &&
          (groupedIssues.length === 0 ? (
            <Card>
              <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No issues reported.
              </CardContent>
            </Card>
          ) : (
            groupedIssues.map((group) => (
              <Card key={group.label}>
                <CardHeader className="py-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Bug className="size-4 text-rose-600" />
                    <span>{group.label}</span>
                    <Badge variant="secondary" className="text-[10px] tabular-nums">
                      {group.items.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Issue</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Owner</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((issue) => (
                        <TableRow key={issue.id}>
                          <TableCell className="font-medium">{issue.title}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {issue.projectName}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                issue.severity === "CRITICAL" || issue.severity === "HIGH"
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {issue.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {canWrite ? (
                              <select
                                value={issue.status}
                                onChange={(e) =>
                                  handleStatusChange(issue.id, e.target.value as IssueStatus)
                                }
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
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
                          <TableCell className="text-sm text-muted-foreground">
                            {issue.assignee?.name ?? "Unassigned"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          ))}

        {viewMode === "kanban" && (
          <div className="overflow-x-auto pb-2">
            <DndContext
              id={dndId}
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragEnd={handleDragEnd}
            >
              <div className="flex min-h-[420px] gap-4">
                {ISSUE_COLUMNS.map((col) => (
                  <IssueKanbanColumn
                    key={col.status}
                    status={col.status}
                    label={col.label}
                    dot={col.dot}
                    issues={visibleIssues.filter((i) => i.status === col.status)}
                    canWrite={canWrite}
                  />
                ))}
              </div>
            </DndContext>
          </div>
        )}

        {viewMode === "gantt" && (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              {ganttTimeline.rows.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  No issues reported.
                </div>
              ) : (
                <div className="min-w-[740px]">
                  <div className="grid grid-cols-12 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    <div className="col-span-4">Issue</div>
                    <div className="col-span-8 flex justify-between">
                      {ganttTimeline.ticks.map((lbl, idx) => (
                        <span key={`${idx}-${lbl}`}>{lbl}</span>
                      ))}
                    </div>
                  </div>
                  <div className="divide-y">
                    {ganttTimeline.rows.map(({ issue, startMs, endMs }) => {
                      const leftPct = Math.max(
                        0,
                        Math.min(
                          90,
                          ((startMs - ganttTimeline.minMs) / ganttTimeline.spanMs) * 100,
                        ),
                      );
                      const widthPct = Math.max(
                        10,
                        Math.min(100 - leftPct, ((endMs - startMs) / ganttTimeline.spanMs) * 100),
                      );
                      return (
                        <div key={issue.id} className="grid grid-cols-12 items-center px-4 py-3 text-xs">
                          <div className="col-span-4 pr-3">
                            <p className="truncate font-semibold">{issue.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {issue.projectName} · {issue.severity}
                            </p>
                          </div>
                          <div className="col-span-8">
                            <div className="relative h-6 rounded bg-muted/35">
                              <div
                                className={cn(
                                  "absolute top-1 bottom-1 flex items-center rounded px-2 text-[10px] font-medium text-white",
                                  issue.status === "RESOLVED" || issue.status === "CLOSED"
                                    ? "bg-emerald-600"
                                    : issue.severity === "CRITICAL"
                                      ? "bg-rose-600"
                                      : "bg-amber-600",
                                )}
                                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                              >
                                <span className="inline-flex items-center gap-1 truncate">
                                  <Calendar className="size-2.5" />
                                  {issue.status}
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

      {/* Submit Issue Slide-Over Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Submit Issue</SheetTitle>
            <SheetDescription>Log a project blocker or defect.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="issue-project">Project</Label>
              <select
                id="issue-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
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
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="issue-assignee">Assignee</Label>
                <select
                  id="issue-assignee"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Submit
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
