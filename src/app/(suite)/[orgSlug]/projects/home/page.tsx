import {
  AlertTriangle,
  Bug,
  CalendarClock,
  CheckCircle2,
  Clock,
  FolderKanban,
  ListChecks,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { getProjectsHome } from "@/modules/projects/projects-suite.service";
import { requireTenant } from "@/server/tenancy";

export default async function ProjectsHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  const home = await getProjectsHome(tenant);

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Welcome back, {tenant.user.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Your personal Projects command center for {tenant.organization.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/${orgSlug}/projects/timesheets`}>
              <CalendarClock className="size-4" />
              Weekly Timesheet
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/${orgSlug}/projects`}>
              <FolderKanban className="size-4" />
              All Projects
            </Link>
          </Button>
        </div>
      </div>

      {/* Top KPI Widgets */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>My Overdue Tasks</span>
              <AlertTriangle className="size-4 text-rose-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums text-rose-600">
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
            {home.weeklyBillableHours.toFixed(1)}h billable (week of{" "}
            {formatDate(home.weekStartIso)})
          </CardContent>
        </Card>

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

      {/* Overdue & Upcoming Tasks + Open Issues */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="size-4 text-rose-600" />
                Overdue &amp; Upcoming Tasks
              </CardTitle>
              <CardDescription>Assigned to you or owned projects</CardDescription>
            </div>
            <Link
              href={`/${orgSlug}/projects/tasks`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Open Task Board →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {home.overdueTasks.length === 0 && home.upcomingTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                You are all caught up on tasks.
              </p>
            ) : (
              <>
                {home.overdueTasks.map((task) => (
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
                {home.upcomingTasks.map((task) => (
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

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bug className="size-4 text-amber-600" />
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
                  <div
                    key={issue.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
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
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Project Health Roll-Up</CardTitle>
              <CardDescription>
                {home.projectHealth.total} active workspace projects (
                {home.projectHealth.planning} planning · {home.projectHealth.onHold} on hold ·{" "}
                {home.projectHealth.completed} completed)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {home.myProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active projects yet.</p>
              ) : (
                home.myProjects.map((proj) => (
                  <Link
                    key={proj.id}
                    href={`/${orgSlug}/projects/${proj.id}`}
                    className="block space-y-1.5 rounded-lg border p-2.5 transition hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">{proj.name}</span>
                      <span className="text-xs font-semibold tabular-nums">
                        {proj.completionPct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-violet-600"
                        style={{ width: `${proj.completionPct}%` }}
                      />
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
