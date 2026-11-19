import { BarChart3, Clock, TrendingDown, Users, Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getProjectsReports } from "@/modules/projects/projects-suite.service";
import { requireTenant } from "@/server/tenancy";

export default async function ProjectsReportsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  const reports = await getProjectsReports(tenant);

  const maxBurndown = Math.max(
    1,
    ...reports.burndown.flatMap((b) => [b.idealRemaining, b.actualRemaining]),
  );

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Projects Reports</h1>
          <p className="text-sm text-muted-foreground">
            Task burn-down, resource utilization, planned vs. actual hours, and budget variance.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <BarChart3 className="size-3.5" />
          Live Neon Analytics
        </Badge>
      </div>

      {/* Burn-Down + Resource Utilization */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="size-4 text-violet-600" />
              7-Day Task Burn-Down
            </CardTitle>
            <CardDescription>
              Ideal remaining tasks vs. actual remaining tasks across all projects
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-3 pt-2">
              {reports.burndown.map((day) => {
                const idealPct = Math.round((day.idealRemaining / maxBurndown) * 100);
                const actualPct = Math.round((day.actualRemaining / maxBurndown) * 100);
                return (
                  <div key={day.label} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-36 w-full items-end justify-center gap-1">
                      <div
                        title={`Ideal: ${day.idealRemaining}`}
                        className="w-3 rounded-t bg-muted-foreground/25"
                        style={{ height: `${Math.max(4, idealPct)}%` }}
                      />
                      <div
                        title={`Actual: ${day.actualRemaining}`}
                        className="w-3 rounded-t bg-violet-600"
                        style={{ height: `${Math.max(4, actualPct)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{day.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-4 border-t pt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-muted-foreground/30" />
                Ideal Remaining
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-violet-600" />
                Actual Remaining
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-blue-600" />
              Resource Utilization
            </CardTitle>
            <CardDescription>Logged hours vs. 40h weekly capacity per team member</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {reports.resourceUtilization.length === 0 ? (
              <p className="text-sm text-muted-foreground">No organization members found.</p>
            ) : (
              reports.resourceUtilization.map((member) => (
                <div key={member.userId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{member.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {member.loggedHours.toFixed(1)}h ({member.utilizationPct}%) ·{" "}
                      {member.completedTasks}/{member.assignedTasks} tasks
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        member.utilizationPct >= 85 ? "bg-amber-500" : "bg-blue-600",
                      )}
                      style={{ width: `${member.utilizationPct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Planned vs Actual Hours + Budget Variance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4 text-emerald-600" />
              Planned vs. Actual Hours
            </CardTitle>
            <CardDescription>
              Baseline task estimate (4h/task) compared against logged Time Logs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.plannedVsActual.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                      No active projects.
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.plannedVsActual.map((row) => (
                    <TableRow key={row.projectId}>
                      <TableCell className="font-medium">{row.projectName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.plannedHours.toFixed(1)}h
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.actualHours.toFixed(1)}h
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold tabular-nums",
                          row.varianceHours < 0 ? "text-rose-600" : "text-emerald-600",
                        )}
                      >
                        {row.varianceHours >= 0 ? "+" : ""}
                        {row.varianceHours.toFixed(1)}h
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-amber-600" />
              Budget Variance
            </CardTitle>
            <CardDescription>
              Project budget vs. approved expenses + billable labor benchmark
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Actual Cost</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.budgetVariance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                      No active projects.
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.budgetVariance.map((row) => {
                    const actualCost = row.approvedExpenses + row.loggedLaborValue;
                    return (
                      <TableRow key={row.projectId}>
                        <TableCell className="font-medium">{row.projectName}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.budget, row.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(actualCost, row.currency)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold tabular-nums",
                            row.variance < 0 ? "text-rose-600" : "text-emerald-600",
                          )}
                        >
                          {formatCurrency(row.variance, row.currency)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
