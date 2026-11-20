"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Clock,
  DollarSign,
  Download,
  FileText,
  Filter,
  Loader2,
  Plus,
  Search,
  Timer,
} from "lucide-react";
import { toast } from "sonner";

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
import { emitBackgroundTaskEvent } from "@/modules/projects/components/project-workspace-overlays";
import { createTimeLogAction } from "@/modules/projects/projects.actions";
import type { TimeLogRowDTO } from "@/modules/projects/projects.types";

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

const APPROVAL_STYLES: Record<"Approved" | "Pending" | "Rejected", string> = {
  Approved:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300",
  Pending:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300",
  Rejected:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/60 dark:text-rose-300",
};

export function TimeLogsPanel({
  orgSlug,
  todayIso,
  logs,
  projects,
  tasks = [],
  defaultCurrency = "USD",
  canWrite,
  openCreateInitially = false,
}: {
  orgSlug: string;
  todayIso: string;
  logs: TimeLogRowDTO[];
  projects: Array<{ id: string; name: string }>;
  tasks?: Array<{ id: string; projectId: string; title: string }>;
  defaultCurrency?: string;
  canWrite: boolean;
  openCreateInitially?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [projectFilter, setProjectFilter] = React.useState("");
  const [billableFilter, setBillableFilter] = React.useState<"ALL" | "BILLABLE" | "NON_BILLABLE">(
    "ALL",
  );
  const [approvalFilter, setApprovalFilter] = React.useState<
    "ALL" | "Approved" | "Pending" | "Rejected"
  >("ALL");

  // Log Time sheet state
  const [open, setOpen] = React.useState(openCreateInitially);
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? "");
  const [taskId, setTaskId] = React.useState("");
  const [hours, setHours] = React.useState("2.0");
  const [loggedDate, setLoggedDate] = React.useState(todayIso);
  const [billable, setBillable] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (openCreateInitially) setOpen(true);
  }, [openCreateInitially]);

  React.useEffect(() => {
    const onQuickAdd = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "time-logs") setOpen(true);
    };
    window.addEventListener("bs-quick-add", onQuickAdd);
    return () => window.removeEventListener("bs-quick-add", onQuickAdd);
  }, []);

  const projectTasks = React.useMemo(
    () => tasks.filter((t) => t.projectId === projectId),
    [tasks, projectId],
  );

  const visibleLogs = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (projectFilter && log.projectId !== projectFilter) return false;
      if (billableFilter === "BILLABLE" && !log.billable) return false;
      if (billableFilter === "NON_BILLABLE" && log.billable) return false;
      const status = log.approvalStatus ?? "Pending";
      if (approvalFilter !== "ALL" && status !== approvalFilter) return false;
      if (!q) return true;
      return (
        log.projectName.toLowerCase().includes(q) ||
        (log.taskTitle?.toLowerCase().includes(q) ?? false) ||
        log.userName.toLowerCase().includes(q) ||
        (log.notes?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [logs, search, projectFilter, billableFilter, approvalFilter]);

  const metrics = React.useMemo(() => {
    let totalHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;
    let billableValue = 0;
    let approvedHours = 0;
    for (const l of visibleLogs) {
      totalHours += l.hours;
      if (l.billable) {
        billableHours += l.hours;
        billableValue += l.hours * (l.hourlyRate ?? 95);
      } else {
        nonBillableHours += l.hours;
      }
      if ((l.approvalStatus ?? "Pending") === "Approved") {
        approvedHours += l.hours;
      }
    }
    return { totalHours, billableHours, nonBillableHours, billableValue, approvedHours };
  }, [visibleLogs]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createTimeLogAction({
        orgSlug,
        projectId,
        taskId: taskId || null,
        hours: Number(hours),
        billable,
        loggedDate,
        notes: notes || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setNotes("");
      setTaskId("");
      setOpen(false);
      toast.success("Time entry logged");
      router.refresh();
    });
  };

  const handleExportCsv = () => {
    const jobId = `timelog-export-${Date.now()}`;
    emitBackgroundTaskEvent({
      id: jobId,
      label: `Exporting ${visibleLogs.length} time logs (CSV)`,
      progress: 40,
      status: "running",
    });

    const header = [
      "Date",
      "Project",
      "Task",
      "User",
      "Hours",
      "Billing Type",
      "Hourly Rate",
      "Amount",
      "Approval Status",
      "Notes",
    ];
    const rows = visibleLogs.map((l) => {
      const rate = l.hourlyRate ?? 95;
      const amt = l.billable ? l.hours * rate : 0;
      return [
        l.loggedDate,
        l.projectName,
        l.taskTitle ?? "",
        l.userName,
        l.hours.toFixed(2),
        l.billable ? "Billable" : "Non-Billable",
        rate.toFixed(2),
        amt.toFixed(2),
        l.approvalStatus ?? "Pending",
        (l.notes ?? "").replaceAll('"', '""'),
      ]
        .map((c) => `"${c}"`)
        .join(",");
    });

    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${orgSlug}-time-logs-${todayIso}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    emitBackgroundTaskEvent({
      id: jobId,
      label: `Exported ${visibleLogs.length} time logs`,
      progress: 100,
      status: "completed",
    });
    toast.success("Time logs CSV exported");
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Time Logs</h1>
          <p className="text-xs text-muted-foreground">
            Track billable vs. non-billable hours, hourly rates, task attribution, and approval status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCsv} className="gap-1.5">
            <Download className="size-3.5" />
            Export CSV
          </Button>
          {canWrite && projects.length > 0 && (
            <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
              <Plus className="size-4" />
              Log Time
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Hours</span>
            <Clock className="size-3.5 text-primary" />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{metrics.totalHours.toFixed(1)}h</p>
        </div>
        <div className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Billable Hours & Value</span>
            <DollarSign className="size-3.5 text-emerald-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {metrics.billableHours.toFixed(1)}h
            </p>
            <span className="text-xs font-medium text-muted-foreground">
              ({formatMoney(metrics.billableValue, defaultCurrency)})
            </span>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Non-Billable</span>
            <Timer className="size-3.5 text-slate-400" />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-muted-foreground">
            {metrics.nonBillableHours.toFixed(1)}h
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Approved Hours</span>
            <BadgeCheck className="size-3.5 text-sky-500" />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-sky-600 dark:text-sky-400">
            {metrics.approvedHours.toFixed(1)}h
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border bg-card px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project, linked task, team member, or notes..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Filter className="size-3.5" />
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
          value={billableFilter}
          onChange={(e) =>
            setBillableFilter(e.target.value as "ALL" | "BILLABLE" | "NON_BILLABLE")
          }
          className="h-8 rounded-md border bg-background px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="ALL">All Billing Types</option>
          <option value="BILLABLE">Billable Only</option>
          <option value="NON_BILLABLE">Non-Billable Only</option>
        </select>
        <select
          value={approvalFilter}
          onChange={(e) =>
            setApprovalFilter(e.target.value as "ALL" | "Approved" | "Pending" | "Rejected")
          }
          className="h-8 rounded-md border bg-background px-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="ALL">All Approval Statuses</option>
          <option value="Approved">Approved</option>
          <option value="Pending">Pending</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {/* Time Logs Table */}
      <div className="overflow-x-auto rounded-xl border bg-card dark:border-zinc-800 dark:bg-zinc-900/70">
        {visibleLogs.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Clock}
              title={
                logs.length === 0
                  ? "No time logs recorded yet"
                  : "No time logs match your filters"
              }
              description="Record billable or internal hours from a project task or via the quick bottom dock timer."
              compact
              action={
                canWrite && projects.length > 0
                  ? {
                      label: "Log Time",
                      icon: <Plus className="size-3.5" />,
                      onClick: () => setOpen(true),
                    }
                  : undefined
              }
              secondaryAction={
                projectFilter ||
                billableFilter !== "ALL" ||
                approvalFilter !== "ALL" ||
                search.trim()
                  ? {
                      label: "Reset filters",
                      onClick: () => {
                        setProjectFilter("");
                        setBillableFilter("ALL");
                        setApprovalFilter("ALL");
                        setSearch("");
                      },
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:border-zinc-800 dark:bg-zinc-950/60">
                <th className="px-4 py-2.5">Date</th>
                <th className="px-3 py-2.5">Project & Task</th>
                <th className="px-3 py-2.5">User</th>
                <th className="px-3 py-2.5">Billing</th>
                <th className="px-3 py-2.5">Rate & Value</th>
                <th className="px-3 py-2.5">Approval</th>
                <th className="px-3 py-2.5">Notes</th>
                <th className="px-4 py-2.5 text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {visibleLogs.map((log) => {
                const rate = log.hourlyRate ?? 95;
                const amount = log.billable ? log.hours * rate : 0;
                const status = log.approvalStatus ?? "Pending";
                return (
                  <tr
                    key={log.id}
                    className="border-b border-border/60 text-xs transition hover:bg-muted/35 dark:border-zinc-800/80 dark:hover:bg-zinc-900/60"
                  >
                    <td className="px-4 py-3 font-medium tabular-nums text-foreground">
                      {formatDate(log.loggedDate)}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/${orgSlug}/projects/${log.projectId}`}
                        className="font-semibold text-foreground hover:text-primary hover:underline"
                      >
                        {log.projectName}
                      </Link>
                      {log.taskTitle && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{log.taskTitle}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-foreground">{log.userName}</td>
                    <td className="px-3 py-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          log.billable
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : "border-slate-200 bg-slate-100 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
                        )}
                      >
                        {log.billable ? "Billable" : "Non-Billable"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {log.billable ? (
                        <div>
                          <span className="font-semibold text-foreground">
                            {formatMoney(amount, log.currency ?? defaultCurrency)}
                          </span>
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            @{formatMoney(rate, log.currency ?? defaultCurrency)}/h
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px]", APPROVAL_STYLES[status])}
                      >
                        {status}
                      </Badge>
                    </td>
                    <td className="max-w-xs truncate px-3 py-3 text-muted-foreground">
                      {log.notes || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                      {log.hours.toFixed(2)}h
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Log Time Slide-Over Drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Log Time</SheetTitle>
            <SheetDescription>
              Record billable or internal work directly against a project and optional task.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="tl-project">Project</Label>
              <select
                id="tl-project"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setTaskId("");
                }}
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
              <Label htmlFor="tl-task">Task (Optional)</Label>
              <select
                id="tl-task"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <option value="">General Project Time</option>
                {projectTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tl-hours">Hours</Label>
                <Input
                  id="tl-hours"
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tl-date">Date</Label>
                <Input
                  id="tl-date"
                  type="date"
                  value={loggedDate}
                  onChange={(e) => setLoggedDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="size-4 rounded border-border"
              />
              Billable to client
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="tl-notes">Notes</Label>
              <textarea
                id="tl-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Work performed..."
                className="w-full rounded-md border border-input bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 dark:border-zinc-800 dark:bg-zinc-950"
              />
            </div>
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Save Entry
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
