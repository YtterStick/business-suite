"use client";

import * as React from "react";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ClipboardCheck,
  FolderKanban,
  HelpCircle,
  Loader2,
  Plus,
  Receipt,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GettingStartedBanner } from "@/components/ui/getting-started-banner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatCurrencyTotals, formatDate, formatDateTimeUtc } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WorkspaceHomeDTO } from "@/modules/org/workspace-home.service";
import {
  clearSampleWorkspaceAction,
  moveTaskStatusAction,
  seedSampleWorkspaceAction,
} from "@/modules/projects/projects.actions";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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
  const [greeting, setGreeting] = React.useState("Welcome back");
  const [isSampleBusy, setIsSampleBusy] = React.useState(false);
  const [tasks, setTasks] = React.useState(home.myTasks);

  React.useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  React.useEffect(() => {
    setTasks(home.myTasks);
  }, [home.myTasks]);

  const handleSeedSample = async () => {
    setIsSampleBusy(true);
    try {
      const res = await seedSampleWorkspaceAction({ orgSlug });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Sample workspace loaded", {
        description: `Created CRM deals, project "${res.data.projectName}" & invoice ${res.data.invoiceNumber}.`,
      });
      router.refresh();
    } finally {
      setIsSampleBusy(false);
    }
  };

  const handleClearSample = async () => {
    setIsSampleBusy(true);
    try {
      const res = await clearSampleWorkspaceAction({ orgSlug });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Sample records cleared", {
        description: `Removed ${res.data.deletedDeals} deal(s), ${res.data.deletedProjects} project(s), and ${res.data.deletedInvoices} invoice(s).`,
      });
      router.refresh();
    } finally {
      setIsSampleBusy(false);
    }
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

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Greeting Header & Quick-Launch Pills */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {greeting}, {firstName} — {orgName}
          </h1>
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
          {canManage &&
            (home.onboarding.hasSampleData ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isSampleBusy}
                onClick={handleClearSample}
                className="gap-1.5 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
              >
                {isSampleBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Clear Sample Data
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={isSampleBusy}
                onClick={handleSeedSample}
                className="gap-1.5 text-xs"
              >
                {isSampleBusy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Load Sample Workspace
              </Button>
            ))}
        </div>
      </div>

      {/* Dismissible 3-Step Getting Started Banner */}
      <GettingStartedBanner
        orgSlug={orgSlug}
        progress={home.onboarding}
        hasSampleData={home.onboarding.hasSampleData}
        canManage={canManage}
        isBusy={isSampleBusy}
        onSeedSample={handleSeedSample}
        onClearSample={handleClearSample}
      />

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
          <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{home.openPipelineCount} active deal(s)</span>
            <Link href={`/${orgSlug}/crm/deals`} className="font-medium text-primary hover:underline">
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
          <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{home.upcomingMilestonesCount} milestone(s) due in 14d</span>
            <Link href={`/${orgSlug}/projects`} className="font-medium text-primary hover:underline">
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
          <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {home.pendingTimesheetsCount} timesheet · {home.pendingExpensesCount} expense
            </span>
            <Link
              href={`/${orgSlug}/projects/approvals`}
              className="font-medium text-primary hover:underline"
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
          <CardContent className="flex items-center justify-between text-xs">
            <span className="text-rose-600">
              Overdue: {formatCurrencyTotals(home.overdueReceivablesTotals, home.defaultCurrency)}
            </span>
            <Link
              href={`/${orgSlug}/finance/invoices`}
              className="font-medium text-primary hover:underline"
            >
              Invoices →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Two-Column Actionable Body */}
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* Left Column: My Work Today + Recent Connected Flows */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">My Work Today</CardTitle>
                <CardDescription>Assigned tasks &amp; open issues awaiting action</CardDescription>
              </div>
              <Link
                href={`/${orgSlug}/projects/tasks`}
                className="text-xs font-medium text-primary hover:underline"
              >
                All Tasks →
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {tasks.length === 0 && home.myIssues.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="You're all caught up"
                  description="Assigned project tasks and high-priority issues will appear here with inline completion toggles."
                  compact
                  action={{
                    label: "Create Task",
                    icon: <Plus className="size-3.5" />,
                    href: `/${orgSlug}/projects/tasks?new=1`,
                  }}
                />
              ) : (
                <>
                  {tasks.map((task) => {
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
                            onChange={() => handleToggleTaskDone(task)}
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
                  })}

                  {home.myIssues.map((issue) => (
                    <Link
                      key={issue.id}
                      href={`/${orgSlug}/projects/issues`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.03] px-3 py-2 text-sm hover:bg-rose-500/[0.06]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{issue.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          Issue · {issue.projectName}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {issue.severity}
                      </Badge>
                    </Link>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Recent Connected Flows</CardTitle>
                <CardDescription>End-to-end Deal → Project → Invoice links</CardDescription>
              </div>
              <Link
                href={`/${orgSlug}/crm/deals`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Pipeline →
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {home.connectedFlows.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title="No connected flows yet"
                  description="Close a deal in CRM or load sample data to watch Tactiq link the deal, project, and invoice automatically."
                  compact
                  action={
                    canManage
                      ? {
                          label: "Load Sample Workspace",
                          icon: <Sparkles className="size-3.5" />,
                          disabled: isSampleBusy,
                          onClick: handleSeedSample,
                        }
                      : undefined
                  }
                />
              ) : (
                home.connectedFlows.map((flow) => (
                  <div
                    key={flow.dealId}
                    className="space-y-2 rounded-xl border bg-muted/20 p-3.5"
                  >
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
        </div>

        {/* Right Column: Recent Activity Feed + Quick Links */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Activity Feed</CardTitle>
              <CardDescription>Audit updates across CRM, Projects &amp; Finance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {home.recentActivity.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Activity across CRM, Projects, and Finance will appear here as your team works.
                </p>
              ) : (
                home.recentActivity.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          {log.app}
                        </Badge>
                        <span className="truncate font-medium capitalize">{log.action}</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {log.actorName} · {formatDateTimeUtc(log.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Links</CardTitle>
              <CardDescription>Jump to documentation, team setup, or search</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href="/docs"
                className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-muted/40"
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
                className="flex items-center justify-between rounded-lg border p-3 text-sm transition-colors hover:bg-muted/40"
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

              <div className="flex items-center justify-between rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Search className="size-4 text-foreground" />
                  <span>Jump to any deal, project, task, or invoice</span>
                </span>
                <kbd className="rounded border bg-background px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground">
                  ⌘K
                </kbd>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
