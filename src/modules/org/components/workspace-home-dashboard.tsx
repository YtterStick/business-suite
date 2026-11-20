"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  BookOpen,
  Briefcase,
  Bug,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Flag,
  FolderKanban,
  HelpCircle,
  LayoutGrid,
  Play,
  Plus,
  Receipt,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GettingStartedBanner } from "@/components/ui/getting-started-banner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatCurrency,
  formatCurrencyTotals,
  formatDate,
  formatDateTimeUtc,
  initials,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WorkspaceHomeDTO } from "@/modules/org/workspace-home.service";
import { moveTaskStatusAction } from "@/modules/projects/projects.actions";

type HomeWidgetId =
  | "my-work"
  | "connected-flows"
  | "my-time"
  | "team-workload"
  | "recent-activity"
  | "upcoming-schedule"
  | "quick-links";

interface WidgetPreference {
  id: HomeWidgetId;
  label: string;
  column: "left" | "right";
  visible: boolean;
  managerOnly?: boolean;
}

const DEFAULT_WIDGETS: WidgetPreference[] = [
  { id: "my-work", label: "My Work Today Hub", column: "left", visible: true },
  { id: "connected-flows", label: "Recent Connected Flows", column: "left", visible: true },
  { id: "my-time", label: "My Time Logs & Hours", column: "left", visible: true },
  {
    id: "team-workload",
    label: "Team Workload",
    column: "left",
    visible: true,
    managerOnly: true,
  },
  { id: "recent-activity", label: "Recent Activity Feed", column: "right", visible: true },
  { id: "upcoming-schedule", label: "My Schedule (Upcoming)", column: "right", visible: true },
  { id: "quick-links", label: "Quick Links", column: "right", visible: true },
];

type MyWorkTab = "due-today" | "overdue" | "tasks" | "issues" | "phases";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function humanizeAuditTitle(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^(CRM deal|CRM|Finance|Projects)\s+/i, "")
    .replace(/\.auto[_\s]?created/gi, " auto-created")
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Workspace activity";
  const cased = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return cased.replace(/\bcsv\b/gi, "CSV");
}

function WidgetHeaderActions({
  isRefreshing,
  onRefresh,
  viewAllHref,
  viewAllLabel = "View All →",
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
  viewAllHref: string;
  viewAllLabel?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Refresh widget"
            onClick={onRefresh}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refresh data</TooltipContent>
      </Tooltip>
      <Link
        href={viewAllHref}
        className="shrink-0 text-xs font-medium whitespace-nowrap text-primary hover:underline"
      >
        {viewAllLabel}
      </Link>
    </div>
  );
}

export function WorkspaceHomeDashboard({
  orgSlug,
  orgName,
  firstName,
  canManage,
  home,
}: {
  orgSlug: string;
  orgName: string;
  firstName: string;
  canManage: boolean;
  home: WorkspaceHomeDTO;
}) {
  const router = useRouter();
  const [isRefreshing, startRefreshTransition] = React.useTransition();
  const [greeting, setGreeting] = React.useState("Welcome back");
  const [tasks, setTasks] = React.useState(home.myTasks);
  const [widgetPrefs, setWidgetPrefs] = React.useState<WidgetPreference[]>(DEFAULT_WIDGETS);

  const storageKey = `tq_home_widgets_v1_${orgSlug}`;

  const overdueTotal = React.useMemo(
    () => Object.values(home.overdueReceivablesTotals).reduce((sum, v) => sum + v, 0),
    [home.overdueReceivablesTotals],
  );
  const formattedHeading = React.useMemo(() => {
    const g = greeting.trim();
    const f = firstName.trim();
    const o = orgName.trim();
    return f ? `${g}, ${f} — ${o}` : `${g} — ${o}`;
  }, [greeting, firstName, orgName]);

  React.useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  React.useEffect(() => {
    setTasks(home.myTasks);
  }, [home.myTasks]);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Array<{ id: HomeWidgetId; visible: boolean }>;
      if (!Array.isArray(parsed)) return;
      const defaultMap = new Map(DEFAULT_WIDGETS.map((w) => [w.id, w]));
      const merged: WidgetPreference[] = [];
      for (const item of parsed) {
        const base = defaultMap.get(item.id);
        if (base) {
          merged.push({ ...base, visible: Boolean(item.visible) });
          defaultMap.delete(item.id);
        }
      }
      for (const rest of defaultMap.values()) {
        merged.push(rest);
      }
      setWidgetPrefs(merged);
    } catch {
      // Ignore storage read errors
    }
  }, [storageKey]);

  const persistWidgets = (next: WidgetPreference[]) => {
    setWidgetPrefs(next);
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(next.map((w) => ({ id: w.id, visible: w.visible }))),
      );
    } catch {
      // Ignore storage write errors
    }
  };

  const toggleWidget = (id: HomeWidgetId) => {
    persistWidgets(widgetPrefs.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  };

  const moveWidget = (id: HomeWidgetId, delta: -1 | 1) => {
    const available = widgetPrefs.filter((w) => !w.managerOnly || canManage);
    const idx = available.findIndex((w) => w.id === id);
    const targetIdx = idx + delta;
    if (idx < 0 || targetIdx < 0 || targetIdx >= available.length) return;
    const neighborId = available[targetIdx]!.id;
    const fullIdx = widgetPrefs.findIndex((w) => w.id === id);
    const fullNeighborIdx = widgetPrefs.findIndex((w) => w.id === neighborId);
    const next = [...widgetPrefs];
    [next[fullIdx], next[fullNeighborIdx]] = [next[fullNeighborIdx]!, next[fullIdx]!];
    persistWidgets(next);
  };

  const resetWidgets = () => {
    persistWidgets(DEFAULT_WIDGETS);
    toast.success("Home widgets reset to default layout");
  };

  const handleRefresh = () => {
    startRefreshTransition(() => {
      router.refresh();
    });
  };

  const handleToggleTaskDone = async (task: WorkspaceHomeDTO["myTasks"][number]) => {
    const prevStatus = task.status;
    const nextStatus = prevStatus === "DONE" ? "TODO" : "DONE";
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)),
    );
    const res = await moveTaskStatusAction({
      orgSlug,
      taskId: task.id,
      status: nextStatus,
    });
    if (!res.ok) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: prevStatus } : t)),
      );
      toast.error(res.error.message);
      return;
    }
    toast.success(nextStatus === "DONE" ? `Completed "${task.title}"` : `Reopened "${task.title}"`, {
      action: {
        label: "Undo",
        onClick: async () => {
          setTasks((prev) =>
            prev.map((t) => (t.id === task.id ? { ...t, status: prevStatus } : t)),
          );
          await moveTaskStatusAction({
            orgSlug,
            taskId: task.id,
            status: prevStatus,
          });
          router.refresh();
        },
      },
    });
    router.refresh();
  };

  const availablePrefs = widgetPrefs.filter((w) => !w.managerOnly || canManage);
  const leftWidgets = availablePrefs.filter((w) => w.column === "left" && w.visible);
  const rightWidgets = availablePrefs.filter((w) => w.column === "right" && w.visible);
  const visibleCount = availablePrefs.filter((w) => w.visible).length;

  const renderWidget = (id: HomeWidgetId) => {
    switch (id) {
      case "my-work":
        return (
          <MyWorkHubCard
            key={id}
            orgSlug={orgSlug}
            todayIso={home.todayIso}
            tasks={tasks}
            issues={home.myIssues}
            phases={home.myPhases}
            onToggleTask={handleToggleTaskDone}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        );
      case "connected-flows":
        return (
          <ConnectedFlowsCard
            key={id}
            orgSlug={orgSlug}
            canManage={canManage}
            flows={home.connectedFlows}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        );
      case "my-time":
        return (
          <MyTimeLogsCard
            key={id}
            orgSlug={orgSlug}
            thisWeekTime={home.thisWeekTime}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        );
      case "team-workload":
        return canManage ? (
          <TeamWorkloadCard
            key={id}
            orgSlug={orgSlug}
            workload={home.teamWorkload}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        ) : null;
      case "recent-activity":
        return (
          <RecentActivityCard
            key={id}
            orgSlug={orgSlug}
            recentActivity={home.recentActivity}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        );
      case "upcoming-schedule":
        return (
          <UpcomingScheduleCard
            key={id}
            orgSlug={orgSlug}
            todayIso={home.todayIso}
            schedule={home.upcomingSchedule}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        );
      case "quick-links":
        return (
          <QuickLinksCard
            key={id}
            orgSlug={orgSlug}
            isRefreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        );
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Greeting Header & Quick-Launch Pills + Customize Widgets */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{formattedHeading}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Unified command center across CRM pipelines, active delivery projects, and Finance billing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
            <Link href={`/${orgSlug}/crm/deals?new=1`}>
              <Plus className="size-3.5 text-blue-600" />
              New Deal
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
            <Link href={`/${orgSlug}/projects?new=1`}>
              <Plus className="size-3.5 text-violet-600" />
              New Project
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
            <Link href={`/${orgSlug}/finance/invoices?new=1`}>
              <Plus className="size-3.5 text-emerald-600" />
              New Invoice
            </Link>
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" variant="secondary" className="gap-1.5 text-xs">
                <LayoutGrid className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>+ Widgets</span>
                <Badge variant="outline" className="h-4 px-1 text-[10px] tabular-nums">
                  {visibleCount}/{availablePrefs.length}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-76 p-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="text-xs font-semibold">Customize Home Widgets</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Toggle or reorder dashboard cards.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetWidgets}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Reset to Default
                </button>
              </div>
              <div className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-0.5">
                {availablePrefs.map((w, idx) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/60"
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={w.visible}
                        onChange={() => toggleWidget(w.id)}
                        className="size-3.5 accent-primary"
                      />
                      <span className="truncate font-medium">{w.label}</span>
                    </label>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        aria-label={`Move ${w.label} up`}
                        onClick={() => moveWidget(w.id, -1)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === availablePrefs.length - 1}
                        aria-label={`Move ${w.label} down`}
                        onClick={() => moveWidget(w.id, 1)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Dismissible 3-Step Getting Started Banner */}
      <GettingStartedBanner orgSlug={orgSlug} progress={home.onboarding} />

      {/* Cross-App 4-Card KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1">
                Open Pipeline
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="What is Open Pipeline?"
                      className="text-muted-foreground/70 hover:text-foreground"
                    >
                      <HelpCircle className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-56">
                    Total expected deal value across all open CRM pipeline stages.
                  </TooltipContent>
                </Tooltip>
              </span>
              <TrendingUp className="size-4 text-blue-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrencyTotals(home.openPipelineTotals, home.defaultCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{pluralize(home.openPipelineCount, "active deal")}</span>
            <Link
              href={`/${orgSlug}/crm/deals`}
              className="shrink-0 font-medium whitespace-nowrap text-primary hover:underline"
            >
              Open CRM →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Active Projects</span>
              <FolderKanban className="size-4 text-violet-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{home.activeProjectsCount}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate">{home.upcomingMilestonesCount} due in 14d</span>
              </TooltipTrigger>
              <TooltipContent>
                {pluralize(home.upcomingMilestonesCount, "milestone")} due in the next 14 days
              </TooltipContent>
            </Tooltip>
            <Link
              href={`/${orgSlug}/projects`}
              className="shrink-0 font-medium whitespace-nowrap text-primary hover:underline"
            >
              View Projects →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Pending Approvals</span>
              <ClipboardCheck className="size-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{home.pendingApprovalsCount}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              {pluralize(home.pendingTimesheetsCount, "timesheet")} ·{" "}
              {pluralize(home.pendingExpensesCount, "expense")}
            </span>
            <Link
              href={`/${orgSlug}/projects/approvals`}
              className="shrink-0 font-medium whitespace-nowrap text-primary hover:underline"
            >
              Review →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1">
                Unpaid Receivables
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="What are Unpaid Receivables?"
                      className="text-muted-foreground/70 hover:text-foreground"
                    >
                      <HelpCircle className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-56">
                    Open balance owed by clients across Sent, Partially Paid, and Overdue invoices.
                  </TooltipContent>
                </Tooltip>
              </span>
              <Receipt className="size-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrencyTotals(home.unpaidReceivablesTotals, home.defaultCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between gap-2 text-xs">
            <span
              className={cn(
                "truncate",
                overdueTotal > 0
                  ? "font-medium text-red-600 dark:text-red-400"
                  : "text-muted-foreground",
              )}
            >
              Overdue: {formatCurrencyTotals(home.overdueReceivablesTotals, home.defaultCurrency)}
            </span>
            <Link
              href={`/${orgSlug}/finance/invoices`}
              className="shrink-0 font-medium whitespace-nowrap text-primary hover:underline"
            >
              Invoices →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Work Status Mini-Strip */}
      <WorkStatusMiniStrip orgSlug={orgSlug} workPulse={home.workPulse} />

      {/* Customizable 2-Column Body */}
      {visibleCount === 0 ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              icon={LayoutGrid}
              title="All widgets are hidden"
              description="Enable widgets from the + Widgets menu or restore the default Home layout."
              compact
              action={{ label: "Reset to Default", onClick: resetWidgets }}
            />
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            "grid gap-6",
            leftWidgets.length > 0 && rightWidgets.length > 0
              ? "lg:grid-cols-[1.35fr_1fr]"
              : "grid-cols-1",
          )}
        >
          {leftWidgets.length > 0 && (
            <div className="space-y-6">{leftWidgets.map((w) => renderWidget(w.id))}</div>
          )}
          {rightWidgets.length > 0 && (
            <div className="space-y-6">{rightWidgets.map((w) => renderWidget(w.id))}</div>
          )}
        </div>
      )}
    </div>
  );
}

function WorkStatusMiniStrip({
  orgSlug,
  workPulse,
}: {
  orgSlug: string;
  workPulse: WorkspaceHomeDTO["workPulse"];
}) {
  const pills = [
    {
      label: "Tasks",
      open: workPulse.tasks.open,
      closed: workPulse.tasks.closed,
      href: `/${orgSlug}/projects/tasks`,
      barColor: "bg-indigo-500",
    },
    {
      label: "Issues",
      open: workPulse.issues.open,
      closed: workPulse.issues.closed,
      href: `/${orgSlug}/projects/issues`,
      barColor: "bg-rose-500",
    },
    {
      label: "Phases",
      open: workPulse.phases.open,
      closed: workPulse.phases.closed,
      href: `/${orgSlug}/projects/milestones`,
      barColor: "bg-violet-500",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {pills.map((pill) => {
        const total = pill.open + pill.closed;
        const pct = total > 0 ? Math.round((pill.closed / total) * 100) : 0;
        return (
          <Link
            key={pill.label}
            href={pill.href}
            className="group flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 text-xs transition-colors hover:border-primary/40 hover:bg-muted/40"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={cn("size-2 shrink-0 rounded-full", pill.barColor)} />
              <span className="font-semibold text-foreground">{pill.label}</span>
              <span className="truncate text-muted-foreground tabular-nums">
                <strong className="font-semibold text-foreground">{pill.open}</strong> Open ·{" "}
                <strong className="font-semibold text-foreground">{pill.closed}</strong> Closed
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-muted sm:block">
                <div
                  className={cn("h-full rounded-full transition-all", pill.barColor)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <ArrowRight className="size-3.5 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function MyWorkHubCard({
  orgSlug,
  todayIso,
  tasks,
  issues,
  phases,
  onToggleTask,
  isRefreshing,
  onRefresh,
}: {
  orgSlug: string;
  todayIso: string;
  tasks: WorkspaceHomeDTO["myTasks"];
  issues: WorkspaceHomeDTO["myIssues"];
  phases: WorkspaceHomeDTO["myPhases"];
  onToggleTask: (task: WorkspaceHomeDTO["myTasks"][number]) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const [tab, setTab] = React.useState<MyWorkTab>("due-today");

  const dueTodayItems = React.useMemo(() => {
    const t = tasks
      .filter((x) => x.status !== "DONE" && x.dueDate === todayIso)
      .map((x) => ({
        kind: "Task" as const,
        id: x.id,
        title: x.title,
        meta: x.projectName,
        badge: x.priority,
        href: `/${orgSlug}/projects/tasks?taskId=${x.id}`,
      }));
    const i = issues
      .filter((x) => x.dueDate === todayIso)
      .map((x) => ({
        kind: "Issue" as const,
        id: x.id,
        title: x.title,
        meta: x.projectName,
        badge: x.severity,
        href: `/${orgSlug}/projects/issues`,
      }));
    const p = phases
      .filter((x) => x.dueDate === todayIso)
      .map((x) => ({
        kind: "Phase" as const,
        id: x.id,
        title: x.name,
        meta: x.projectName,
        badge: x.status.replace("_", " "),
        href: `/${orgSlug}/projects/${x.projectId}`,
      }));
    return [...t, ...i, ...p];
  }, [tasks, issues, phases, todayIso, orgSlug]);

  const overdueItems = React.useMemo(() => {
    const t = tasks
      .filter(
        (x): x is typeof x & { dueDate: string } =>
          x.status !== "DONE" && x.dueDate !== null && x.dueDate < todayIso,
      )
      .map((x) => ({
        kind: "Task" as const,
        id: x.id,
        title: x.title,
        meta: `${x.projectName} · Due ${formatDate(x.dueDate, { withYear: true })}`,
        badge: x.priority,
        href: `/${orgSlug}/projects/tasks?taskId=${x.id}`,
      }));
    const i = issues
      .filter(
        (x): x is typeof x & { dueDate: string } => x.dueDate !== null && x.dueDate < todayIso,
      )
      .map((x) => ({
        kind: "Issue" as const,
        id: x.id,
        title: x.title,
        meta: `${x.projectName} · Due ${formatDate(x.dueDate, { withYear: true })}`,
        badge: x.severity,
        href: `/${orgSlug}/projects/issues`,
      }));
    const p = phases
      .filter(
        (x): x is typeof x & { dueDate: string } => x.dueDate !== null && x.dueDate < todayIso,
      )
      .map((x) => ({
        kind: "Phase" as const,
        id: x.id,
        title: x.name,
        meta: `${x.projectName} · Due ${formatDate(x.dueDate, { withYear: true })}`,
        badge: x.status.replace("_", " "),
        href: `/${orgSlug}/projects/${x.projectId}`,
      }));
    return [...t, ...i, ...p];
  }, [tasks, issues, phases, todayIso, orgSlug]);

  const viewAllHref =
    tab === "issues"
      ? `/${orgSlug}/projects/issues`
      : tab === "phases"
        ? `/${orgSlug}/projects/milestones`
        : `/${orgSlug}/projects/tasks`;

  const tabs: Array<{ id: MyWorkTab; label: string; count: number; alert?: boolean }> = [
    { id: "due-today", label: "Due Today", count: dueTodayItems.length },
    {
      id: "overdue",
      label: "Overdue",
      count: overdueItems.length,
      alert: overdueItems.length > 0,
    },
    { id: "tasks", label: "My Tasks", count: tasks.length },
    { id: "issues", label: "My Issues", count: issues.length },
    { id: "phases", label: "My Phases", count: phases.length },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base">My Work Today</CardTitle>
          <CardDescription>Daily execution hub across tasks, issues &amp; phases</CardDescription>
        </div>
        <WidgetHeaderActions
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          viewAllHref={viewAllHref}
        />
      </CardHeader>

      <CardContent className="space-y-3">
        <div
          role="tablist"
          aria-label="My Work execution views"
          className="flex items-center gap-1 overflow-x-auto border-b pb-2"
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition",
                  active
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span>{t.label}</span>
                <span
                  className={cn(
                    "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                    t.alert
                      ? active
                        ? "bg-red-500 text-white"
                        : "bg-red-500/15 text-red-600 dark:text-red-400"
                      : active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {tab === "due-today" &&
            (dueTodayItems.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Nothing due today"
                description="Tasks, issues, and phases due today will appear here automatically."
                compact
                action={{
                  label: "Create Task",
                  icon: <Plus className="size-3.5" />,
                  href: `/${orgSlug}/projects/tasks?new=1`,
                }}
              />
            ) : (
              dueTodayItems.map((item) => (
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {item.kind}
                      </Badge>
                      <span className="truncate font-medium">{item.title}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.meta}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {item.badge}
                  </Badge>
                </Link>
              ))
            ))}

          {tab === "overdue" &&
            (overdueItems.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="All caught up — zero overdue items"
                description="No tasks, issues, or project phases are past their due date."
                compact
              />
            ) : (
              overdueItems.map((item) => (
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-lg border border-red-500/25 bg-red-500/[0.04] px-3 py-2 text-sm hover:bg-red-500/[0.08]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="border-red-500/40 px-1.5 py-0 text-[10px] text-red-600 dark:text-red-400"
                      >
                        {item.kind}
                      </Badge>
                      <span className="truncate font-medium">{item.title}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.meta}</p>
                  </div>
                  <Badge variant="destructive" className="shrink-0 text-[10px]">
                    {item.badge}
                  </Badge>
                </Link>
              ))
            ))}

          {tab === "tasks" &&
            (tasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="You're all caught up"
                description="Assigned project tasks will appear here with inline completion toggles."
                compact
                action={{
                  label: "Create Task",
                  icon: <Plus className="size-3.5" />,
                  href: `/${orgSlug}/projects/tasks?new=1`,
                }}
              />
            ) : (
              tasks.map((task) => {
                const isDone = task.status === "DONE";
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/30"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Toggle ${task.title}`}
                        checked={isDone}
                        onChange={() => onToggleTask(task)}
                        className="size-4 shrink-0 cursor-pointer accent-primary"
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/${orgSlug}/projects/tasks?taskId=${task.id}`}
                          className={cn(
                            "block truncate font-medium hover:underline",
                            isDone && "text-muted-foreground line-through",
                          )}
                        >
                          {task.title}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {task.projectName}
                          {task.dueDate
                            ? ` · Due ${formatDate(task.dueDate, { withYear: true })}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {task.priority}
                    </Badge>
                  </div>
                );
              })
            ))}

          {tab === "issues" &&
            (issues.length === 0 ? (
              <EmptyState
                icon={Bug}
                title="No open issues assigned"
                description="Active bugs and escalated delivery blockers will appear here."
                compact
                action={{
                  label: "Report Issue",
                  icon: <Plus className="size-3.5" />,
                  href: `/${orgSlug}/projects/issues?new=1`,
                }}
              />
            ) : (
              issues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/${orgSlug}/projects/issues`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.03] px-3 py-2 text-sm hover:bg-rose-500/[0.06]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{issue.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {issue.projectName}
                      {issue.dueDate
                        ? ` · Due ${formatDate(issue.dueDate, { withYear: true })}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {issue.severity}
                  </Badge>
                </Link>
              ))
            ))}

          {tab === "phases" &&
            (phases.length === 0 ? (
              <EmptyState
                icon={Flag}
                title="No open project phases"
                description="Active delivery milestones and phase checkpoints will appear here."
                compact
                action={{
                  label: "Open Phases",
                  href: `/${orgSlug}/projects/milestones`,
                }}
              />
            ) : (
              phases.map((phase) => (
                <Link
                  key={phase.id}
                  href={`/${orgSlug}/projects/${phase.projectId}`}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{phase.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {phase.projectName}
                      {phase.dueDate
                        ? ` · Due ${formatDate(phase.dueDate, { withYear: true })}`
                        : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {phase.status.replace("_", " ")}
                  </Badge>
                </Link>
              ))
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectedFlowsCard({
  orgSlug,
  canManage,
  flows,
  isRefreshing,
  onRefresh,
}: {
  orgSlug: string;
  canManage: boolean;
  flows: WorkspaceHomeDTO["connectedFlows"];
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base">Recent Connected Flows</CardTitle>
          <CardDescription>End-to-end Deal → Project → Invoice links</CardDescription>
        </div>
        <WidgetHeaderActions
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          viewAllHref={`/${orgSlug}/crm/deals`}
          viewAllLabel="Pipeline →"
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {flows.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No connected flows yet"
            description="Close a deal in CRM to watch Tactiq link the deal, project, and invoice automatically."
            compact
            action={
              canManage
                ? {
                    label: "Create First Deal",
                    icon: <Plus className="size-3.5" />,
                    href: `/${orgSlug}/crm/deals?new=1`,
                  }
                : undefined
            }
          />
        ) : (
          flows.map((flow) => (
            <div key={flow.dealId} className="space-y-2 rounded-xl border bg-muted/20 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{flow.dealTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {flow.companyName ? `${flow.companyName} · ` : ""}
                    {formatCurrency(flow.amount, flow.currency)}
                  </p>
                </div>
                <Badge
                  variant={flow.dealStatus === "CLOSED_WON" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {flow.dealStatus.replace("_", " ")}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link
                  href={`/${orgSlug}/crm/deals`}
                  className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 font-medium text-blue-600 hover:border-blue-500/40 dark:text-blue-400"
                >
                  <Briefcase className="size-3" />
                  Deal
                </Link>
                <ArrowRight className="size-3 text-muted-foreground" />
                {flow.projectId ? (
                  <Link
                    href={`/${orgSlug}/projects/${flow.projectId}`}
                    className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 font-medium text-violet-600 hover:border-violet-500/40 dark:text-violet-400"
                  >
                    <FolderKanban className="size-3" />
                    {flow.projectName}
                  </Link>
                ) : (
                  <span className="rounded-md border border-dashed px-2 py-1 text-muted-foreground">
                    Project awaiting win
                  </span>
                )}
                <ArrowRight className="size-3 text-muted-foreground" />
                {flow.invoiceId ? (
                  <Link
                    href={`/${orgSlug}/finance/invoices?highlight=${flow.invoiceId}`}
                    className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 font-medium text-emerald-600 hover:border-emerald-500/40 dark:text-emerald-400"
                  >
                    <Receipt className="size-3" />
                    {flow.invoiceNumber}
                  </Link>
                ) : (
                  <span className="rounded-md border border-dashed px-2 py-1 text-muted-foreground">
                    Invoice pending
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MyTimeLogsCard({
  orgSlug,
  thisWeekTime,
  isRefreshing,
  onRefresh,
}: {
  orgSlug: string;
  thisWeekTime: WorkspaceHomeDTO["thisWeekTime"];
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4 text-emerald-600" />
            My Time Logs &amp; This Week&apos;s Hours
          </CardTitle>
          <CardDescription>
            {formatDate(thisWeekTime.weekStartIso)} –{" "}
            {formatDate(thisWeekTime.weekEndIso, { withYear: true })}
          </CardDescription>
        </div>
        <WidgetHeaderActions
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          viewAllHref={`/${orgSlug}/projects/timesheets`}
          viewAllLabel="Open Timesheets →"
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tabular-nums text-foreground">
                {thisWeekTime.totalHours.toFixed(2)} h
              </span>
              <Badge
                variant={
                  thisWeekTime.status === "APPROVED"
                    ? "default"
                    : thisWeekTime.status === "SUBMITTED"
                      ? "secondary"
                      : "outline"
                }
                className="text-[10px]"
              >
                {thisWeekTime.status}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {thisWeekTime.billableHours.toFixed(2)} h billable
              </span>{" "}
              logged this week
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("bs-open-timer", { detail: { start: true } }))
              }
              className="gap-1"
            >
              <Play className="size-3 text-emerald-600" />
              Start Timer
            </Button>
            <Button asChild size="xs" className="gap-1">
              <Link href={`/${orgSlug}/projects/time-logs?new=1`}>
                <Plus className="size-3" />
                Log Time
              </Link>
            </Button>
          </div>
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{
              width: `${Math.min(100, Math.round((thisWeekTime.totalHours / 40) * 100))}%`,
            }}
          />
        </div>

        {thisWeekTime.recentLogs.length === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">
            No time entries recorded yet. Start the dock timer or log hours above.
          </p>
        ) : (
          <div className="max-h-[160px] space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {thisWeekTime.recentLogs.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {entry.taskTitle ?? entry.notes ?? entry.projectName}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {entry.projectName} · {formatDate(entry.loggedDate, { withYear: true })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant={entry.billable ? "secondary" : "outline"} className="text-[10px]">
                    {entry.billable ? "Billable" : "Internal"}
                  </Badge>
                  <span className="font-semibold tabular-nums">{entry.hours.toFixed(2)}h</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TeamWorkloadCard({
  orgSlug,
  workload,
  isRefreshing,
  onRefresh,
}: {
  orgSlug: string;
  workload: WorkspaceHomeDTO["teamWorkload"];
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const [mode, setMode] = React.useState<"tasks" | "issues">("tasks");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-sky-600" />
            Team Workload
          </CardTitle>
          <CardDescription>Open assignments &amp; bottlenecks across workspace members</CardDescription>
        </div>
        <WidgetHeaderActions
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          viewAllHref={`/${orgSlug}/projects/reports`}
        />
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="inline-flex items-center gap-1 rounded-lg bg-muted/60 p-0.5">
          <button
            type="button"
            onClick={() => setMode("tasks")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition",
              mode === "tasks"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Team Tasks
          </button>
          <button
            type="button"
            onClick={() => setMode("issues")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition",
              mode === "issues"
                ? "bg-background text-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Team Issues
          </button>
        </div>

        {workload.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Team member workload will appear once active members are assigned tasks or issues.
          </p>
        ) : (
          <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {workload.map((member) => {
              const count = mode === "tasks" ? member.openTasks : member.openIssues;
              const alertCount = mode === "tasks" ? member.overdueTasks : member.highIssues;
              const alertLabel = mode === "tasks" ? "overdue" : "high/crit";
              return (
                <div
                  key={member.userId}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="size-7 shrink-0">
                      <AvatarFallback className="text-[10px] font-semibold">
                        {initials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{member.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{member.role}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {alertCount > 0 && (
                      <Badge variant="destructive" className="text-[10px] tabular-nums">
                        {alertCount} {alertLabel}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[10px] tabular-nums">
                      {count} open
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityCard({
  orgSlug,
  recentActivity,
  isRefreshing,
  onRefresh,
}: {
  orgSlug: string;
  recentActivity: WorkspaceHomeDTO["recentActivity"];
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base">Recent Activity Feed</CardTitle>
          <CardDescription>Audit updates across CRM, Projects &amp; Finance</CardDescription>
        </div>
        <WidgetHeaderActions
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          viewAllHref={`/${orgSlug}/projects/collaboration`}
        />
      </CardHeader>
      <CardContent>
        {recentActivity.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Activity across CRM, Projects, and Finance will appear here as your team works.
          </p>
        ) : (
          <div className="relative">
            <div className="max-h-[380px] space-y-2.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
              {recentActivity.map((log) => {
                const titleText = `${humanizeAuditTitle(log.action)}${log.entityName ? ` · ${log.entityName}` : ""}`;
                const inner = (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
                          {log.app}
                        </Badge>
                        <span className="truncate font-medium">{titleText}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {log.actorName} · {formatDateTimeUtc(log.createdAt)}
                      </p>
                    </div>
                    {log.href && (
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    )}
                  </>
                );

                return log.href ? (
                  <Link
                    key={log.id}
                    href={log.href}
                    className="group flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
            {recentActivity.length > 5 && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-card to-transparent"
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingScheduleCard({
  orgSlug,
  todayIso,
  schedule,
  isRefreshing,
  onRefresh,
}: {
  orgSlug: string;
  todayIso: string;
  schedule: WorkspaceHomeDTO["upcomingSchedule"];
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-violet-600" />
            My Schedule
          </CardTitle>
          <CardDescription>Upcoming phases, invoices &amp; deal close dates (14d)</CardDescription>
        </div>
        <WidgetHeaderActions
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          viewAllHref={`/${orgSlug}/projects/milestones`}
        />
      </CardHeader>
      <CardContent>
        {schedule.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No upcoming milestones, invoice due dates, or deal deadlines in the next 14 days.
          </p>
        ) : (
          <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
            {schedule.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="group flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 px-1.5 py-0 text-[10px]",
                        item.kind === "Phase" && "border-violet-500/40 text-violet-600 dark:text-violet-400",
                        item.kind === "Invoice" && "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
                        item.kind === "Deal" && "border-sky-500/40 text-sky-600 dark:text-sky-400",
                      )}
                    >
                      {item.kind}
                    </Badge>
                    <span className="truncate font-medium">{item.title}</span>
                  </div>
                  <p className="mt-1 truncate text-muted-foreground">{item.subtitle}</p>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {item.dueDate === todayIso ? "Today" : formatDate(item.dueDate)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickLinksCard({
  orgSlug,
  isRefreshing,
  onRefresh,
}: {
  orgSlug: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base">Quick Links</CardTitle>
          <CardDescription>Documentation, team roles, and cross-app reporting</CardDescription>
        </div>
        <WidgetHeaderActions
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
          viewAllHref="/docs"
          viewAllLabel="All Docs →"
        />
      </CardHeader>
      <CardContent className="space-y-2">
        <Link
          href="/docs"
          className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
        >
          <span className="flex items-center gap-2.5">
            <BookOpen className="size-4 text-indigo-500" />
            <span>
              <span className="block font-medium">Documentation &amp; Guides</span>
              <span className="block text-xs text-muted-foreground">
                Learn workflows across CRM, Finance &amp; Projects
              </span>
            </span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>

        <Link
          href={`/${orgSlug}/projects/users?invite=1`}
          className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
        >
          <span className="flex items-center gap-2.5">
            <UserPlus className="size-4 text-emerald-500" />
            <span>
              <span className="block font-medium">Invite Team Members</span>
              <span className="block text-xs text-muted-foreground">
                Add colleagues or external Client portal accounts
              </span>
            </span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>

        <Link
          href={`/${orgSlug}/projects/users`}
          className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
        >
          <span className="flex items-center gap-2.5">
            <ShieldCheck className="size-4 text-violet-500" />
            <span>
              <span className="block font-medium">Workspace Settings &amp; Roles</span>
              <span className="block text-xs text-muted-foreground">
                Manage team roles, permissions, and workspace access
              </span>
            </span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>

        <Link
          href={`/${orgSlug}/projects/reports`}
          className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:border-primary/40 hover:bg-muted/40"
        >
          <span className="flex items-center gap-2.5">
            <BarChart3 className="size-4 text-sky-500" />
            <span>
              <span className="block font-medium">Cross-App Reports &amp; Analytics</span>
              <span className="block text-xs text-muted-foreground">
                Review delivery progress, logged hours, and utilization
              </span>
            </span>
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
        </Link>
      </CardContent>
    </Card>
  );
}
