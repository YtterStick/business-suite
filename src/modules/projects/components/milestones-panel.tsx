"use client";

import * as React from "react";
import type { MilestoneStatus } from "@prisma/client";
import { Flag, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { createMilestoneAction } from "@/modules/projects/projects.actions";

export interface MilestoneRowItem {
  id: string;
  name: string;
  description: string | null;
  projectName: string;
  status: MilestoneStatus;
  taskCount: number;
  dueDateIso: string | null;
}

export function MilestonesPanel({
  orgSlug,
  orgName,
  milestones,
  projects,
  canWrite,
  openCreateInitially = false,
}: {
  orgSlug: string;
  orgName: string;
  milestones: MilestoneRowItem[];
  projects: Array<{ id: string; name: string }>;
  canWrite: boolean;
  openCreateInitially?: boolean;
}) {
  const [open, setOpen] = React.useState(openCreateInitially);
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? "");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (openCreateInitially) setOpen(true);
  }, [openCreateInitially]);

  React.useEffect(() => {
    const onQuickAdd = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "milestones") setOpen(true);
    };
    window.addEventListener("bs-quick-add", onQuickAdd);
    return () => window.removeEventListener("bs-quick-add", onQuickAdd);
  }, []);

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createMilestoneAction({
        orgSlug,
        projectId,
        name,
        description: description || null,
        dueDate: dueDate || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setName("");
      setDescription("");
      setDueDate("");
      setOpen(false);
      toast.success("Phase created");
    });
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Project Phases</h1>
          <p className="text-sm text-muted-foreground">
            Track delivery phases and milestones across all client projects.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <Flag className="size-3.5" />
            {milestones.length} Phases
          </Badge>
          {canWrite && projects.length > 0 && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              New Phase
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phase Schedule</CardTitle>
          <CardDescription>Delivery checkpoints inside {orgName}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phase / Milestone</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead className="text-right">Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No phases created yet.
                  </TableCell>
                </TableRow>
              ) : (
                milestones.map((milestone) => (
                  <TableRow key={milestone.id}>
                    <TableCell>
                      <div className="font-medium">{milestone.name}</div>
                      {milestone.description && (
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {milestone.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{milestone.projectName}</TableCell>
                    <TableCell>
                      <Badge variant={milestone.status === "COMPLETED" ? "default" : "secondary"}>
                        {milestone.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {milestone.taskCount}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {milestone.dueDateIso
                        ? formatDate(milestone.dueDateIso, { withYear: true })
                        : "—"}
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
            <SheetTitle>New Phase / Milestone</SheetTitle>
            <SheetDescription>Add a delivery checkpoint to a project.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreate} className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="ms-project">Project</Label>
              <select
                id="ms-project"
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
              <Label htmlFor="ms-name">Phase Name</Label>
              <Input
                id="ms-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. UAT & Client Sign-off"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms-due">Due Date</Label>
              <Input
                id="ms-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ms-desc">Description</Label>
              <Input
                id="ms-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional phase deliverables..."
              />
            </div>
            <SheetFooter className="p-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Create Phase
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
