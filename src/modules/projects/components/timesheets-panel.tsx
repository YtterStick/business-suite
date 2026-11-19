"use client";

import * as React from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addDays, toIsoDate } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { emitWorkspaceNotification } from "@/lib/notifications";
import { saveWeeklyTimesheetAction } from "@/modules/projects/projects-suite.actions";
import type { TimesheetGridDTO } from "@/modules/projects/projects-suite.service";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface EditableRow {
  localId: string;
  projectId: string;
  taskId: string;
  hoursByDay: Record<string, string>;
}

export function TimesheetsPanel({
  orgSlug,
  initialData,
  canWrite,
}: {
  orgSlug: string;
  initialData: TimesheetGridDTO;
  canWrite: boolean;
}) {
  const [rows, setRows] = React.useState<EditableRow[]>(() =>
    initialData.rows.map((r, idx) => ({
      localId: `row-${idx}-${r.rowKey}`,
      projectId: r.projectId,
      taskId: r.taskId ?? "",
      hoursByDay: Object.fromEntries(
        initialData.weekDays.map((d) => [d, r.hoursByDay[d] ? String(r.hoursByDay[d]) : ""]),
      ),
    })),
  );
  const [notes, setNotes] = React.useState(initialData.timesheet.notes ?? "");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setRows(
      initialData.rows.map((r, idx) => ({
        localId: `row-${idx}-${r.rowKey}`,
        projectId: r.projectId,
        taskId: r.taskId ?? "",
        hoursByDay: Object.fromEntries(
          initialData.weekDays.map((d) => [d, r.hoursByDay[d] ? String(r.hoursByDay[d]) : ""]),
        ),
      })),
    );
    setNotes(initialData.timesheet.notes ?? "");
  }, [initialData]);

  const isLocked = initialData.timesheet.status === "APPROVED";

  const addRow = () => {
    const defaultProj = initialData.projects[0]?.id ?? "";
    if (!defaultProj) return;
    setRows((prev) => [
      ...prev,
      {
        localId: `row-${Date.now()}-${prev.length}`,
        projectId: defaultProj,
        taskId: "",
        hoursByDay: {},
      },
    ]);
  };

  const removeRow = (localId: string) => {
    setRows((prev) => prev.filter((r) => r.localId !== localId));
  };

  const updateHour = (localId: string, dayIso: string, val: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.localId === localId
          ? { ...r, hoursByDay: { ...r.hoursByDay, [dayIso]: val } }
          : r,
      ),
    );
  };

  const dayTotals = initialData.weekDays.map((day) =>
    rows.reduce((sum, r) => sum + (Number(r.hoursByDay[day]) || 0), 0),
  );
  const grandTotal = dayTotals.reduce((a, b) => a + b, 0);

  const prevWeekIso = toIsoDate(
    addDays(new Date(`${initialData.weekStartIso}T00:00:00.000Z`), -7),
  );
  const nextWeekIso = toIsoDate(
    addDays(new Date(`${initialData.weekStartIso}T00:00:00.000Z`), 7),
  );

  const handleSave = (submitForApproval: boolean) => {
    const entries: Array<{
      projectId: string;
      taskId?: string | null;
      dayIso: string;
      hours: number;
    }> = [];

    for (const row of rows) {
      if (!row.projectId) continue;
      for (const dayIso of initialData.weekDays) {
        const num = Number(row.hoursByDay[dayIso] || 0);
        if (num > 0) {
          entries.push({
            projectId: row.projectId,
            taskId: row.taskId || null,
            dayIso,
            hours: num,
          });
        }
      }
    }

    startTransition(async () => {
      const res = await saveWeeklyTimesheetAction({
        orgSlug,
        weekStartIso: initialData.weekStartIso,
        submitForApproval,
        notes: notes || null,
        entries,
      });

      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }

      if (submitForApproval) {
        emitWorkspaceNotification({
          kind: "approval",
          actorName: "Team Member",
          title: `Timesheet submitted (${res.data.totalHours.toFixed(1)}h)`,
          description: `Week of ${initialData.weekStartIso} awaiting manager approval.`,
          entityKey: `TS-${initialData.weekStartIso.slice(5)}`,
          href: `/${orgSlug}/projects/approvals`,
          badgeLabel: "Approval",
        });
      }
      toast.success(
        submitForApproval
          ? `Submitted ${res.data.totalHours.toFixed(2)}h for manager approval`
          : `Saved draft (${res.data.totalHours.toFixed(2)}h)`,
      );
    });
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header + Week Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">Weekly Timesheets</h1>
            <Badge
              variant={
                initialData.timesheet.status === "APPROVED"
                  ? "default"
                  : initialData.timesheet.status === "REJECTED"
                    ? "destructive"
                    : "secondary"
              }
            >
              {initialData.timesheet.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Batch-log hours across projects and tasks, then submit your week for approval.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border bg-background p-0.5">
            <Button asChild size="xs" variant="ghost">
              <Link href={`/${orgSlug}/projects/timesheets?week=${prevWeekIso}`}>
                <ChevronLeft className="size-3.5" />
              </Link>
            </Button>
            <span className="px-2.5 text-xs font-medium">
              Week of {formatDate(initialData.weekStartIso, { withYear: true })}
            </span>
            <Button asChild size="xs" variant="ghost">
              <Link href={`/${orgSlug}/projects/timesheets?week=${nextWeekIso}`}>
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </div>

          <Button asChild size="sm" variant="outline">
            <Link href={`/${orgSlug}/projects/time-logs`}>
              <Clock className="size-4" />
              Time Logs
            </Link>
          </Button>
        </div>
      </div>

      {/* Weekly Grid Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4 text-violet-600" />
              Hours Grid ({grandTotal.toFixed(2)}h total)
            </CardTitle>
            <CardDescription>
              {isLocked
                ? "This timesheet is approved and locked."
                : "Enter hours per day (0.25 increments) and save or submit."}
            </CardDescription>
          </div>

          {canWrite && !isLocked && initialData.projects.length > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={addRow}>
              <Plus className="size-4" />
              Add Row
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-44">Project</TableHead>
                <TableHead className="min-w-44">Task (Optional)</TableHead>
                {initialData.weekDays.map((dayIso, idx) => (
                  <TableHead key={dayIso} className="w-20 text-center">
                    <div className="text-xs font-semibold">{DAY_SHORT[idx]}</div>
                    <div className="text-[10px] font-normal text-muted-foreground">
                      {dayIso.slice(5)}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                    Create a project first, then add a timesheet row to log hours.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const rowTotal = initialData.weekDays.reduce(
                    (sum, d) => sum + (Number(row.hoursByDay[d]) || 0),
                    0,
                  );
                  const projectTasks = initialData.tasks.filter(
                    (t) => t.projectId === row.projectId,
                  );

                  return (
                    <TableRow key={row.localId}>
                      <TableCell>
                        <select
                          disabled={isLocked || !canWrite}
                          value={row.projectId}
                          onChange={(e) => {
                            const nextProj = e.target.value;
                            setRows((prev) =>
                              prev.map((r) =>
                                r.localId === row.localId
                                  ? { ...r, projectId: nextProj, taskId: "" }
                                  : r,
                              ),
                            );
                          }}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          {initialData.projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <select
                          disabled={isLocked || !canWrite}
                          value={row.taskId}
                          onChange={(e) => {
                            const nextTask = e.target.value;
                            setRows((prev) =>
                              prev.map((r) =>
                                r.localId === row.localId ? { ...r, taskId: nextTask } : r,
                              ),
                            );
                          }}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="">General project hours</option>
                          {projectTasks.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      {initialData.weekDays.map((dayIso) => (
                        <TableCell key={dayIso} className="p-1.5">
                          <Input
                            type="number"
                            min="0"
                            max="24"
                            step="0.25"
                            disabled={isLocked || !canWrite}
                            value={row.hoursByDay[dayIso] ?? ""}
                            onChange={(e) => updateHour(row.localId, dayIso, e.target.value)}
                            placeholder="0"
                            className="h-8 text-center text-xs tabular-nums"
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-semibold tabular-nums">
                        {rowTotal.toFixed(2)}h
                      </TableCell>
                      <TableCell>
                        {!isLocked && canWrite && rows.length > 1 && (
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => removeRow(row.localId)}
                          >
                            <Trash2 className="size-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}

              {/* Totals Row */}
              {rows.length > 0 && (
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell colSpan={2}>Daily Total</TableCell>
                  {dayTotals.map((total, idx) => (
                    <TableCell key={initialData.weekDays[idx]} className="text-center tabular-nums">
                      {total.toFixed(1)}h
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums">
                    {grandTotal.toFixed(2)}h
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>

          {canWrite && !isLocked && rows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional weekly summary note for your approver..."
                className="max-w-md text-xs"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleSave(false)}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save Draft
                </Button>
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSave(true)}
                >
                  {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Submit for Approval
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Weekly Timesheets */}
      {initialData.recentTimesheets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week Starting</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialData.recentTimesheets.map((ts) => (
                  <TableRow key={ts.id}>
                    <TableCell>
                      <Link
                        href={`/${orgSlug}/projects/timesheets?week=${ts.weekStartIso}`}
                        className="font-medium hover:underline"
                      >
                        {formatDate(ts.weekStartIso, { withYear: true })}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ts.status === "APPROVED" ? "default" : "secondary"}>
                        {ts.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {ts.totalHours.toFixed(2)}h
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
