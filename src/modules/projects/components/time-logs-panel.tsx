"use client";

import * as React from "react";
import { Clock, Loader2, Plus } from "lucide-react";
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
import { createTimeLogAction } from "@/modules/projects/projects.actions";
import type { TimeLogRowDTO } from "@/modules/projects/projects.types";

export function TimeLogsPanel({
  orgSlug,
  logs,
  projects,
  canWrite,
  openCreateInitially = false,
}: {
  orgSlug: string;
  logs: TimeLogRowDTO[];
  projects: Array<{ id: string; name: string }>;
  canWrite: boolean;
  openCreateInitially?: boolean;
}) {
  const [open, setOpen] = React.useState(openCreateInitially);
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? "");
  const [hours, setHours] = React.useState("2");
  const [loggedDate, setLoggedDate] = React.useState("");
  const [billable, setBillable] = React.useState(true);
  const [notes, setNotes] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setLoggedDate((prev) => prev || new Date().toISOString().slice(0, 10));
  }, []);

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

  const totalHours = logs.reduce((sum, l) => sum + l.hours, 0);

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createTimeLogAction({
        orgSlug,
        projectId,
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
      setOpen(false);
      toast.success("Time logged");
    });
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Time Logs</h1>
          <p className="text-sm text-muted-foreground">
            Track billable and non-billable hours across client projects.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <Clock className="size-3.5" />
            {totalHours.toFixed(2)} hrs logged
          </Badge>
          {canWrite && projects.length > 0 && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              Log Time
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timesheet Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No time logs recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(log.loggedDate, { withYear: true })}
                    </TableCell>
                    <TableCell className="font-medium">{log.projectName}</TableCell>
                    <TableCell className="text-sm">{log.userName}</TableCell>
                    <TableCell>
                      <Badge variant={log.billable ? "default" : "secondary"}>
                        {log.billable ? "Billable" : "Non-billable"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {log.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {log.hours.toFixed(2)}h
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Log Time</SheetTitle>
            <SheetDescription>Record work hours against a project.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="log-project">Project</Label>
              <select
                id="log-project"
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="log-hours">Hours</Label>
                <Input
                  id="log-hours"
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
                <Label htmlFor="log-date">Date</Label>
                <Input
                  id="log-date"
                  type="date"
                  value={loggedDate}
                  onChange={(e) => setLoggedDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="size-4 rounded border-input accent-primary"
              />
              <span>Billable hours</span>
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="log-notes">Notes</Label>
              <Input
                id="log-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Work completed..."
              />
            </div>
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Save Log
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
