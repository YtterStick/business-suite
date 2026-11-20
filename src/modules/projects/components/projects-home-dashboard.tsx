"use client";

import * as React from "react";
import {
  AlertTriangle,
  Bug,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flag,
  FolderKanban,
  ListChecks,
  SlidersHorizontal,
  Sun,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectsHomeDTO } from "@/modules/projects/projects-suite.service";

type HomeWidgetKey =
  | "myOpenTasks"
  | "myOverdueTasks"
  | "todaysWorkItems"
  | "budgetVsActuals"
  | "myOpenIssues"
  | "milestonesDueSoon"
  | "weeklyTimesheetChart";

const DEFAULT_WIDGETS: Record<HomeWidgetKey, boolean> = {
  myOpenTasks: true,
  myOverdueTasks: true,
  todaysWorkItems: true,
  budgetVsActuals: true,
  myOpenIssues: true,
  milestonesDueSoon: true,
  weeklyTimesheetChart: true,
};

const WIDGET_LABELS: Array<{ key: HomeWidgetKey; label: string }> = [
  { key: "todaysWorkItems", label: "Today's Work Items" },
  { key: "myOverdueTasks", label: "My Overdue Tasks" },
  { key: "myOpenTasks", label: "My Open Tasks" },
  { key: "milestonesDueSoon", label: "Milestones Due Soon" },
  { key: "myOpenIssues", label: "My Open Issues" },
  { key: "budgetVsActuals", label: "Project Budget vs. Actuals" },
  { key: "weeklyTimesheetChart", label: "Weekly Timesheet Summary" },
];

export function ProjectsHomeDashboard({
  orgSlug,
  orgName,
  firstName,
  isClient = false,
  home,
}: {
  orgSlug: string;
  orgName: string;
  firstName: string;
  isClient?: boolean;
  home: ProjectsHomeDTO;
}) {
  const [widgets, setWidgets] = React.useState<Record<HomeWidgetKey, boolean>>(DEFAULT_WIDGETS);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`bs_home_widgets_${orgSlug}`);
      if (saved) setWidgets({ ...DEFAULT_WIDGETS, ...JSON.parse(saved) });
    } catch {
      // Ignore
    }
  }, [orgSlug]);

  const updateWidgets = (next: Record<HomeWidgetKey, boolean>) => {
    setWidgets(next);
    try {
      window.localStorage.setItem(`bs_home_widgets_${orgSlug}`, JSON.stringify(next));
    } catch {
      // Ignore
    }
  };

  const maxDayHours = Math.max(
    4,
    ...home.weeklyDailyHours.map((d) => d.billable + d.nonBillable),
  );

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Welcome back, {firstName}</h1>
          <p className="text-sm text-muted-foreground">
            Your personal Projects command center for {orgName}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <SlidersHorizontal className="size-3.5" />
                Customize Widgets
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-3">
              <div className="flex items-center justify-between border-b pb-2">
                <p className="text-xs font-semibold">Home Dashboard Widgets</p>
                <button
                  type="button"
                  onClick={() => updateWidgets(DEFAULT_WIDGETS)}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Reset
                </button>
              </div>
              <div className="mt-2 space-y-1.5">
                {WIDGET_LABELS.filter(
                  (w) =>
                    !isClient ||
                    (w.key !== "budgetVsActuals" && w.key !== "weeklyTimesheetChart"),
                ).map((w) => (
                  <label
                    key={w.key}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/60"
                  >
                    <input
                      type="checkbox"
                      checked={widgets[w.key]}
                      onChange={(e) =>
                        updateWidgets({ ...widgets, [w.key]: e.target.checked })
                      }
                      className="size-3.5 accent-primary"
                    />
                    <span>{w.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {!isClient && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/${orgSlug}/projects/timesheets`}>
                <CalendarClock className="size-4" />
                Weekly Timesheet
              </Link>
            </Button>
          )}
          <Button asChild size="sm">
            <Link href={`/${orgSlug}/projects`}>
              <FolderKanban className="size-4" />
              All Projects
            </Link>
          </Button>
        </div>
      </div>

      {/* Top KPI Summary Cards */}
      <div className={cn("grid gap-4 sm:grid-cols-2", isClient ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>My Overdue Tasks</span>
              <AlertTriangle className="size-4 text-rose-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums text-rose-600 dark:text-rose-400">
              {home.overdueTasks.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {home.upcomingTasks.length} upcoming or unscheduled
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>My Open Issues</span>
              <Bug className="size-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{home.openIssues.length}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Open &amp; in-progress blockers assigned or reported
          </CardContent>
        </Card>

        {!isClient && (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                <span>Weekly Time Logged</span>
                <Clock className="size-4 text-blue-600" />
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {home.weeklyHours.toFixed(1)}h
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {home.weeklyBillableHours.toFixed(1)}h billable (week of {formatDate(home.weekStartIso)})
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Project Health</span>
              <CheckCircle2 className="size-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {home.projectHealth.overallTaskCompletionPct}%
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {home.projectHealth.active} active · {home.projectHealth.overdueProjects} overdue
          </CardContent>
        </Card>
      </div>

      {/* Customizable Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Work Items */}
        {widgets.todaysWorkItems && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sun className="size-4 text-amber-500" />
                  Today&apos;s Work Items
                </CardTitle>
                <CardDescription>Tasks in progress or due today ({formatDate(home.todayIso)})</CardDescription>
              </div>
              <Link
                href={`/${orgSlug}/projects/tasks`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Task Board →
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {home.todaysWorkItems.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No work items scheduled specifically for today.
                </p>
              ) : (
                home.todaysWorkItems.map((item) => (
                  <Link
                    key={item.id}
                    href={`/${orgSlug}/projects/tasks?projectId=${item.projectId}`}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.projectName}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {item.status.replace("_", " ")}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Weekly Timesheet Summary Bar Chart */}
        {!isClient && widgets.weeklyTimesheetChart && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="size-4 text-violet-600" />
                  Weekly Timesheet Summary
                </CardTitle>
                <CardDescription>Billable vs. non-billable logged hours (Mon–Sun)</CardDescription>
              </div>
              <Link
                href={`/${orgSlug}/projects/timesheets`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Open Grid →
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end justify-between gap-2 pt-2">
                {home.weeklyDailyHours.map((d) => {
                  const total = d.billable + d.nonBillable;
                  const billPct = Math.round((d.billable / maxDayHours) * 100);
                  const nonPct = Math.round((d.nonBillable / maxDayHours) * 100);
                  return (
                    <div key={d.dayIso} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                        {total > 0 ? `${total.toFixed(1)}h` : "0h"}
                      </span>
                      <div className="flex h-28 w-full max-w-8 flex-col justify-end overflow-hidden rounded bg-muted/40">
                        {nonPct > 0 && (
                          <div
                            title={`Non-billable: ${d.nonBillable.toFixed(1)}h`}
                            className="w-full bg-slate-400/70"
                            style={{ height: `${Math.max(4, nonPct)}%` }}
                          />
                        )}
                        {billPct > 0 && (
                          <div
                            title={`Billable: ${d.billable.toFixed(1)}h`}
                            className="w-full bg-violet-600"
                            style={{ height: `${Math.max(4, billPct)}%` }}
                          />
                        )}
                      </div>
                      <span className="text-[11px] font-medium">{d.day}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-4 border-t pt-2.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-xs bg-violet-600" />
                  Billable
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-xs bg-slate-400/70" />
                  Non-Billable
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* My Overdue Tasks & My Open Tasks */}
        {(widgets.myOverdueTasks || widgets.myOpenTasks) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="size-4 text-rose-600" />
                  {widgets.myOverdueTasks && widgets.myOpenTasks
                    ? "My Overdue & Open Tasks"
                    : widgets.myOverdueTasks
                      ? "My Overdue Tasks"
                      : "My Open Tasks"}
                </CardTitle>
                <CardDescription>Assigned to you or owned projects</CardDescription>
              </div>
              <Link
                href={`/${orgSlug}/projects/tasks`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Open Tasks →
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {home.overdueTasks.length === 0 && home.upcomingTasks.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  You are all caught up on tasks.
                </p>
              ) : (
                <>
                  {widgets.myOverdueTasks &&
                    home.overdueTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/[0.04] px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.projectName}</p>
                        </div>
                        <Badge variant="destructive" className="shrink-0 text-[10px]">
                          Due {formatDate(task.dueDate)}
                        </Badge>
                      </div>
                    ))}
                  {widgets.myOpenTasks &&
                    home.upcomingTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.projectName}</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {task.dueDate ? formatDate(task.dueDate) : task.status}
                        </Badge>
                      </div>
                    ))}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Milestones Due Soon */}
        {widgets.milestonesDueSoon && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Flag className="size-4 text-amber-600" />
                  Milestones Due Soon
                </CardTitle>
                <CardDescription>Upcoming phase checkpoints and deliverables</CardDescription>
              </div>
              <Link
                href={`/${orgSlug}/projects/milestones`}
                className="text-xs font-medium text-primary hover:underline"
              >
                All Phases →
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {home.milestonesDueSoon.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No pending milestones.
                </p>
              ) : (
                home.milestonesDueSoon.map((ms) => {
                  const pct =
                    ms.taskCount > 0 ? Math.round((ms.doneCount / ms.taskCount) * 100) : 0;
                  return (
                    <Link
                      key={ms.id}
                      href={`/${orgSlug}/projects/${ms.projectId}`}
                      className="block space-y-1.5 rounded-lg border p-2.5 transition hover:bg-muted/30"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{ms.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {ms.dueDate ? formatDate(ms.dueDate) : "No date"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{ms.projectName}</span>
                        <span className="tabular-nums">
                          {ms.doneCount}/{ms.taskCount} tasks ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        {/* Project Budget vs. Actuals */}
        {!isClient && widgets.budgetVsActuals && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="size-4 text-emerald-600" />
                  Project Budget vs. Actuals
                </CardTitle>
                <CardDescription>Approved expenses &amp; billable labor against budget</CardDescription>
              </div>
              <Link
                href={`/${orgSlug}/projects/reports`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Reports →
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {home.budgetProjects.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No budgeted projects found.
                </p>
              ) : (
                home.budgetProjects.map((bp) => {
                  const pct =
                    bp.budget > 0 ? Math.min(100, Math.round((bp.actualSpend / bp.budget) * 100)) : 0;
                  const over = bp.actualSpend > bp.budget;
                  return (
                    <Link
                      key={bp.id}
                      href={`/${orgSlug}/projects/${bp.id}?tab=Finance`}
                      className="block space-y-1.5 rounded-lg border p-2.5 transition hover:bg-muted/30"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{bp.name}</span>
                        <span
                          className={cn(
                            "shrink-0 text-xs font-semibold tabular-nums",
                            over ? "text-rose-600 dark:text-rose-400" : "text-foreground",
                          )}
                        >
                          {formatCurrency(bp.actualSpend, bp.currency, { compact: true })} /{" "}
                          {formatCurrency(bp.budget, bp.currency, { compact: true })}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            over ? "bg-rose-500" : "bg-emerald-600",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        {/* My Open Issues */}
        {widgets.myOpenIssues && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bug className="size-4 text-rose-600" />
                  My Open Issues
                </CardTitle>
                <CardDescription>Issues awaiting triage or resolution</CardDescription>
              </div>
              <Link
                href={`/${orgSlug}/projects/issues`}
                className="text-xs font-medium text-primary hover:underline"
              >
                View all →
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {home.openIssues.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No open issues assigned to you.
                </p>
              ) : (
                home.openIssues.map((issue) => (
                  <Link
                    key={issue.id}
                    href={`/${orgSlug}/projects/issues`}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{issue.title}</p>
                      <p className="text-xs text-muted-foreground">{issue.projectName}</p>
                    </div>
                    <Badge
                      variant={
                        issue.severity === "CRITICAL" || issue.severity === "HIGH"
                          ? "destructive"
                          : "outline"
                      }
                      className="text-[10px]"
                    >
                      {issue.severity}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
