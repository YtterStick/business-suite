"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Clock,
  DollarSign,
  Download,
  Flame,
  PieChart,
  Printer,
  TrendingDown,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { emitBackgroundTaskEvent } from "@/modules/projects/components/project-workspace-overlays";
import type { ProjectsReportsDTO } from "@/modules/projects/projects-suite.service";

type ReportSection = "all" | "utilization" | "delivery" | "financials";

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}

function getHeatmapCellClass(pct: number): string {
  if (pct >= 100) {
    return "border-rose-300 bg-rose-500/20 text-rose-700 dark:border-rose-800/70 dark:bg-rose-950/70 dark:text-rose-300";
  }
  if (pct >= 75) {
    return "border-emerald-300 bg-emerald-500/20 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/70 dark:text-emerald-300";
  }
  if (pct >= 45) {
    return "border-sky-300 bg-sky-500/20 text-sky-700 dark:border-sky-800/70 dark:bg-sky-950/70 dark:text-sky-300";
  }
  return "border-amber-200 bg-amber-500/15 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-300";
}

export function ProjectsReportsClient({
  orgSlug,
  defaultCurrency,
  reports,
}: {
  orgSlug: string;
  defaultCurrency: string;
  reports: ProjectsReportsDTO;
}) {
  const [section, setSection] = React.useState<ReportSection>("all");

  const summary = React.useMemo(() => {
    const avgUtil =
      reports.resourceUtilization.length > 0
        ? Math.round(
            reports.resourceUtilization.reduce((sum, r) => sum + r.utilizationPct, 0) /
              reports.resourceUtilization.length,
          )
        : 0;
    const totalTasks = reports.taskStatusDistribution.reduce((sum, s) => sum + s.count, 0);
    const totalPlanned = reports.plannedVsActual.reduce((sum, p) => sum + p.plannedHours, 0);
    const totalActual = reports.plannedVsActual.reduce((sum, p) => sum + p.actualHours, 0);
    const totalVarianceBudget = reports.budgetVariance.reduce((sum, b) => sum + b.variance, 0);
    return {
      avgUtil,
      totalTasks,
      totalPlanned,
      totalActual,
      hoursVariance: Number((totalActual - totalPlanned).toFixed(1)),
      totalVarianceBudget,
    };
  }, [reports]);

  const maxBurndown = React.useMemo(
    () =>
      Math.max(
        1,
        ...reports.burndown.flatMap((d) => [d.idealRemaining, d.actualRemaining]),
      ),
    [reports.burndown],
  );

  const maxOverdueTrend = React.useMemo(
    () =>
      Math.max(
        1,
        ...reports.overdueTrends.map((t) => t.overdueCount + t.onTrackCount),
      ),
    [reports.overdueTrends],
  );

  const handleExportCsv = () => {
    const jobId = `reports-export-${Date.now()}`;
    emitBackgroundTaskEvent({
      id: jobId,
      label: "Compiling Projects Analytics CSV",
      progress: 45,
      status: "running",
    });

    const lines: string[] = [
      "SECTION,ITEM,METRIC_A,METRIC_B,METRIC_C,METRIC_D",
      ...reports.resourceUtilization.map((u) =>
        [
          "Resource Utilization",
          u.name,
          `Assigned:${u.assignedTasks}`,
          `Completed:${u.completedTasks}`,
          `Logged:${u.loggedHours}h`,
          `Utilization:${u.utilizationPct}%`,
        ]
          .map((c) => `"${c}"`)
          .join(","),
      ),
      ...reports.taskStatusDistribution.map((s) =>
        ["Task Status", s.status, `Count:${s.count}`, "", "", ""]
          .map((c) => `"${c}"`)
          .join(","),
      ),
      ...reports.plannedVsActual.map((p) =>
        [
          "Planned vs Actual",
          p.projectName,
          `Planned:${p.plannedHours}h`,
          `Actual:${p.actualHours}h`,
          `Variance:${p.varianceHours}h`,
          "",
        ]
          .map((c) => `"${c}"`)
          .join(","),
      ),
      ...reports.budgetVariance.map((b) =>
        [
          "Budget Variance",
          b.projectName,
          `Budget:${b.budget}`,
          `Expenses:${b.approvedExpenses}`,
          `Labor:${b.loggedLaborValue}`,
          `Variance:${b.variance}`,
        ]
          .map((c) => `"${c}"`)
          .join(","),
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${orgSlug}-projects-analytics.csv`;
    a.click();
    URL.revokeObjectURL(url);

    emitBackgroundTaskEvent({
      id: jobId,
      label: "Exported Projects Analytics CSV",
      progress: 100,
      status: "completed",
    });
    toast.success("Analytics CSV downloaded");
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-5 p-6 print:p-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Projects Analytics & Reports
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Resource workload heatmap, burn-down velocity, overdue trends, and project financials.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border bg-background p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
            {(
              [
                { id: "all", label: "All" },
                { id: "utilization", label: "Utilization" },
                { id: "delivery", label: "Burn-Down & Trends" },
                { id: "financials", label: "Hours & Budget" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  section === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Button size="sm" variant="outline" onClick={handleExportCsv} className="gap-1.5">
            <Download className="size-3.5" />
            Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrintPdf} className="gap-1.5">
            <Printer className="size-3.5" />
            Print / PDF
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Avg Team Utilization</span>
            <Users className="size-3.5 text-primary" />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{summary.avgUtil}%</p>
        </div>
        <div className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Tasks Tracked</span>
            <PieChart className="size-3.5 text-sky-500" />
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{summary.totalTasks}</p>
        </div>
        <div className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Actual vs Planned</span>
            <Clock className="size-3.5 text-amber-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-bold tabular-nums">{summary.totalActual.toFixed(0)}h</p>
            <span className="text-xs text-muted-foreground">
              / {summary.totalPlanned.toFixed(0)}h ({summary.hoursVariance >= 0 ? "+" : ""}
              {summary.hoursVariance}h)
            </span>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-3.5 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Portfolio Budget Variance</span>
            <DollarSign className="size-3.5 text-emerald-500" />
          </div>
          <p
            className={cn(
              "mt-1 text-2xl font-bold tabular-nums",
              summary.totalVarianceBudget >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {formatMoney(summary.totalVarianceBudget, defaultCurrency)}
          </p>
        </div>
      </div>

      {/* Resource Utilization / Workload Heatmap */}
      {(section === "all" || section === "utilization") && (
        <Card className="dark:border-zinc-800 dark:bg-zinc-900/70">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Flame className="size-4 text-orange-500" />
                Resource Utilization & Workload Heatmap
              </CardTitle>
              <CardDescription>
                Weekly capacity load (40h baseline), billable intensity, and task completion per team member.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-medium">
              <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:border-amber-800/60 dark:text-amber-300">
                &lt;45% Available
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-sky-300 bg-sky-500/20 px-2 py-0.5 text-sky-700 dark:border-sky-800/70 dark:text-sky-300">
                45-74% Balanced
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-500/20 px-2 py-0.5 text-emerald-700 dark:border-emerald-800/70 dark:text-emerald-300">
                75-99% Optimal
              </span>
              <span className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-500/20 px-2 py-0.5 text-rose-700 dark:border-rose-800/70 dark:text-rose-300">
                100%+ Overloaded
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {reports.resourceUtilization.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No team utilization data available yet.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {reports.resourceUtilization.map((member) => {
                  const taskPct =
                    member.assignedTasks > 0
                      ? Math.round((member.completedTasks / member.assignedTasks) * 100)
                      : 0;
                  const billablePct =
                    member.loggedHours > 0
                      ? Math.round((member.billableHours / member.loggedHours) * 100)
                      : 0;
                  return (
                    <div
                      key={member.userId}
                      className="rounded-xl border bg-background/60 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8 border dark:border-zinc-700">
                            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold leading-tight">{member.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {member.completedTasks}/{member.assignedTasks} tasks ({taskPct}%)
                            </p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums",
                            getHeatmapCellClass(member.utilizationPct),
                          )}
                        >
                          {member.utilizationPct}%
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[11px]">
                        <div
                          className={cn(
                            "rounded border px-1.5 py-1.5",
                            getHeatmapCellClass(member.utilizationPct),
                          )}
                        >
                          <p className="text-[9px] uppercase opacity-75">Logged</p>
                          <p className="font-bold tabular-nums">{member.loggedHours}h</p>
                        </div>
                        <div
                          className={cn(
                            "rounded border px-1.5 py-1.5",
                            getHeatmapCellClass(billablePct),
                          )}
                        >
                          <p className="text-[9px] uppercase opacity-75">Billable</p>
                          <p className="font-bold tabular-nums">{member.billableHours}h</p>
                        </div>
                        <div
                          className={cn(
                            "rounded border px-1.5 py-1.5",
                            getHeatmapCellClass(taskPct),
                          )}
                        >
                          <p className="text-[9px] uppercase opacity-75">Done Rate</p>
                          <p className="font-bold tabular-nums">{taskPct}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delivery Section: Task Status Distribution + Burn-Down + Overdue Trends */}
      {(section === "all" || section === "delivery") && (
        <div className="grid gap-5 lg:grid-cols-3">
          {/* Task Status Distribution */}
          <Card className="dark:border-zinc-800 dark:bg-zinc-900/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChart className="size-4 text-sky-500" />
                Task Status Distribution
              </CardTitle>
              <CardDescription>Live breakdown across workflow columns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Stacked proportional bar */}
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted dark:bg-zinc-800">
                {reports.taskStatusDistribution.map((s) => {
                  const pct = summary.totalTasks > 0 ? (s.count / summary.totalTasks) * 100 : 0;
                  if (pct === 0) return null;
                  return (
                    <div
                      key={s.status}
                      title={`${s.status}: ${s.count} (${Math.round(pct)}%)`}
                      style={{ width: `${pct}%`, backgroundColor: s.color }}
                      className="h-full transition-all"
                    />
                  );
                })}
              </div>

              <div className="space-y-2 pt-1">
                {reports.taskStatusDistribution.map((s) => {
                  const pct =
                    summary.totalTasks > 0 ? Math.round((s.count / summary.totalTasks) * 100) : 0;
                  return (
                    <div key={s.status} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className="size-2.5 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {s.status}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          <strong className="text-foreground">{s.count}</strong> ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted dark:bg-zinc-800">
                        <div
                          style={{ width: `${pct}%`, backgroundColor: s.color }}
                          className="h-full rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 7-Day Task Burn-Down */}
          <Card className="dark:border-zinc-800 dark:bg-zinc-900/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="size-4 text-primary" />
                7-Day Task Burn-Down
              </CardTitle>
              <CardDescription>Ideal target vs. actual remaining tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {reports.burndown.map((day) => {
                  const idealPct = Math.round((day.idealRemaining / maxBurndown) * 100);
                  const actualPct = Math.round((day.actualRemaining / maxBurndown) * 100);
                  return (
                    <div key={day.label} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-muted-foreground">{day.label}</span>
                        <span className="tabular-nums text-[11px]">
                          Actual <strong>{day.actualRemaining}</strong> · Ideal {day.idealRemaining}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted dark:bg-zinc-800">
                          <div
                            style={{ width: `${actualPct}%` }}
                            className="h-full rounded-full bg-primary"
                          />
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60 dark:bg-zinc-800/60">
                          <div
                            style={{ width: `${idealPct}%` }}
                            className="h-full rounded-full bg-slate-400 dark:bg-zinc-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Overdue Trends */}
          <Card className="dark:border-zinc-800 dark:bg-zinc-900/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4 text-rose-500" />
                Overdue vs. On-Track Trends
              </CardTitle>
              <CardDescription>Rolling 6-week slippage vs. on-schedule deliverables</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-44 items-end gap-2.5 pt-2">
                {reports.overdueTrends.map((t) => {
                  const overdueHeight = Math.round((t.overdueCount / maxOverdueTrend) * 100);
                  const onTrackHeight = Math.round((t.onTrackCount / maxOverdueTrend) * 100);
                  return (
                    <div
                      key={t.label}
                      className="flex flex-1 flex-col items-center justify-end gap-1.5"
                    >
                      <div className="flex h-32 w-full items-end justify-center gap-1">
                        <div
                          title={`On Track: ${t.onTrackCount}`}
                          style={{ height: `${Math.max(onTrackHeight, 6)}%` }}
                          className="w-3 rounded-t bg-emerald-500/80 dark:bg-emerald-500"
                        />
                        <div
                          title={`Overdue: ${t.overdueCount}`}
                          style={{ height: `${Math.max(overdueHeight, t.overdueCount > 0 ? 6 : 2)}%` }}
                          className="w-3 rounded-t bg-rose-500/85 dark:bg-rose-500"
                        />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {t.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-emerald-500" /> On Track
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-sm bg-rose-500" /> Overdue
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Financials & Planned vs Actual Tables */}
      {(section === "all" || section === "financials") && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Planned vs Actual Hours */}
          <Card className="dark:border-zinc-800 dark:bg-zinc-900/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4 text-amber-500" />
                Planned vs. Actual Hours
              </CardTitle>
              <CardDescription>Estimated effort against logged project hours</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-y bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground dark:border-zinc-800 dark:bg-zinc-950/60">
                    <th className="px-4 py-2">Project</th>
                    <th className="px-3 py-2 text-right">Planned</th>
                    <th className="px-3 py-2 text-right">Actual</th>
                    <th className="px-4 py-2 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.plannedVsActual.map((row) => (
                    <tr
                      key={row.projectId}
                      className="border-b border-border/50 dark:border-zinc-800/70"
                    >
                      <td className="px-4 py-2.5 font-medium">
                        <Link
                          href={`/${orgSlug}/projects/${row.projectId}`}
                          className="hover:text-primary hover:underline"
                        >
                          {row.projectName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                        {row.plannedHours.toFixed(1)}h
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                        {row.actualHours.toFixed(1)}h
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            row.varianceHours <= 0
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/60 dark:text-rose-300",
                          )}
                        >
                          {row.varianceHours >= 0 ? "+" : ""}
                          {row.varianceHours.toFixed(1)}h
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Budget Variance */}
          <Card className="dark:border-zinc-800 dark:bg-zinc-900/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="size-4 text-emerald-500" />
                Project Budget vs. Actual Cost
              </CardTitle>
              <CardDescription>Approved expenses + labor cost vs. allocated budget</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-y bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground dark:border-zinc-800 dark:bg-zinc-950/60">
                    <th className="px-4 py-2">Project</th>
                    <th className="px-3 py-2 text-right">Budget</th>
                    <th className="px-3 py-2 text-right">Actual Cost</th>
                    <th className="px-4 py-2 text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.budgetVariance.map((row) => {
                    const actualCost = row.approvedExpenses + row.loggedLaborValue;
                    return (
                      <tr
                        key={row.projectId}
                        className="border-b border-border/50 dark:border-zinc-800/70"
                      >
                        <td className="px-4 py-2.5 font-medium">
                          <Link
                            href={`/${orgSlug}/projects/${row.projectId}`}
                            className="hover:text-primary hover:underline"
                          >
                            {row.projectName}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {formatMoney(row.budget, row.currency)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {formatMoney(actualCost, row.currency)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span
                            className={cn(
                              "font-semibold",
                              row.variance >= 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400",
                            )}
                          >
                            {formatMoney(row.variance, row.currency)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
