"use client";

import * as React from "react";
import type { MembershipRole, PortalProfile } from "@prisma/client";
import { CheckSquare, Crown, FolderKanban, Loader2, MessageSquare, Send } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  assignMemberToProjectAction,
  sendQuickChatAction,
  updateMemberRoleAction,
} from "@/modules/org/team.actions";
import type { TeamMemberDTO } from "@/modules/org/team.service";

const ROLE_LABELS: Record<MembershipRole, string> = {
  OWNER: "Administrator",
  ADMIN: "Manager",
  MEMBER: "Employee",
};

const PROFILE_LABELS: Record<PortalProfile, string> = {
  PORTAL_OWNER: "Portal Owner",
  STANDARD: "Standard",
  CLIENT: "Client",
};

export function UserDetailSheet({
  open,
  onOpenChange,
  orgSlug,
  defaultCurrency,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  defaultCurrency: string;
  member: TeamMemberDTO | null;
}) {
  if (!member) return null;

  const capacityPct =
    member.weeklyCapacityHours > 0
      ? Math.round((member.loggedHours / member.weeklyCapacityHours) * 100)
      : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="size-12">
                {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
                <AvatarFallback>{initials(member.name)}</AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "absolute right-0 bottom-0 size-3 rounded-full ring-2 ring-background",
                  member.isOnline ? "bg-emerald-500" : "bg-zinc-400",
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex items-center gap-1.5 truncate">
                <span>{member.name}</span>
                {member.portalProfile === "PORTAL_OWNER" && (
                  <Crown className="size-4 shrink-0 text-amber-500" />
                )}
              </SheetTitle>
              <SheetDescription className="truncate">{member.email}</SheetDescription>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {ROLE_LABELS[member.role]}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {PROFILE_LABELS[member.portalProfile]}
                </Badge>
                <Badge
                  variant={member.isActive ? "default" : "destructive"}
                  className="text-[10px]"
                >
                  {member.isActive ? "Active" : "Deactivated"}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 px-4 py-5 text-sm">
          {/* Rate & Workload Capacity */}
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/60">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-muted-foreground">Billable Cost Rate</p>
                <p className="mt-0.5 text-sm font-semibold tabular-nums">
                  {formatCurrency(member.hourlyCostRate, defaultCurrency)}/hr
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Job Title</p>
                <p className="mt-0.5 font-medium">{member.jobTitle ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Weekly Capacity</p>
                <p className="mt-0.5 font-semibold tabular-nums">
                  {member.weeklyCapacityHours}h/wk
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Active</p>
                <p className="mt-0.5 font-medium">
                  {member.lastActiveAt
                    ? formatDate(member.lastActiveAt.slice(0, 10), { withYear: true })
                    : "—"}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 border-t pt-2.5 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Current Workload / Capacity</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    capacityPct >= 100
                      ? "text-rose-600 dark:text-rose-400"
                      : capacityPct >= 75
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {member.loggedHours.toFixed(1)}h / {member.weeklyCapacityHours}h ({capacityPct}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted dark:bg-zinc-800">
                <div
                  style={{ width: `${Math.min(capacityPct, 100)}%` }}
                  className={cn(
                    "h-full rounded-full transition-all",
                    capacityPct >= 100
                      ? "bg-rose-500"
                      : capacityPct >= 75
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                  )}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border p-2.5 dark:border-zinc-800">
              <p className="text-lg font-bold tabular-nums">{member.projectsAssignedCount}</p>
              <p className="text-[11px] text-muted-foreground">Projects</p>
            </div>
            <div className="rounded-lg border p-2.5 dark:border-zinc-800">
              <p className="text-lg font-bold tabular-nums">
                {member.completedTasksCount}/{member.assignedTasksCount}
              </p>
              <p className="text-[11px] text-muted-foreground">Tasks Done</p>
            </div>
            <div className="rounded-lg border p-2.5 dark:border-zinc-800">
              <p className="text-lg font-bold tabular-nums">{member.openTasks.length}</p>
              <p className="text-[11px] text-muted-foreground">Open Tasks</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Assigned Projects ({member.assignedProjects.length})
            </p>
            {member.assignedProjects.length === 0 ? (
              <p className="text-xs text-muted-foreground">No projects assigned yet.</p>
            ) : (
              <div className="space-y-1.5">
                {member.assignedProjects.map((proj) => (
                  <Link
                    key={proj.id}
                    href={`/${orgSlug}/projects/${proj.id}`}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium hover:bg-accent dark:border-zinc-800"
                  >
                    <FolderKanban className="size-3.5 text-violet-600" />
                    <span className="truncate">{proj.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Open Tasks ({member.openTasks.length})
            </p>
            {member.openTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">No open tasks assigned.</p>
            ) : (
              <div className="space-y-1.5">
                {member.openTasks.map((t) => (
                  <Link
                    key={t.id}
                    href={`/${orgSlug}/projects/tasks?taskId=${t.id}`}
                    onClick={() => onOpenChange(false)}
                    className="flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-xs transition hover:bg-accent dark:border-zinc-800"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">
                        <CheckSquare className="size-3.5 shrink-0 text-primary" />
                        <span className="truncate">{t.title}</span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {t.projectName}
                        {t.dueDate ? ` · Due ${formatDate(t.dueDate)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline" className="px-1.5 py-0 text-[9px]">
                        {t.priority}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {t.status.replace("_", " ")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function EditUserDialog({
  open,
  onOpenChange,
  orgSlug,
  defaultCurrency,
  member,
  isOwner = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  defaultCurrency: string;
  member: TeamMemberDTO | null;
  isOwner?: boolean;
}) {
  const [role, setRole] = React.useState<MembershipRole>("MEMBER");
  const [portalProfile, setPortalProfile] = React.useState<PortalProfile>("STANDARD");
  const [jobTitle, setJobTitle] = React.useState("");
  const [hourlyCostRate, setHourlyCostRate] = React.useState("0");
  const [weeklyCapacityHours, setWeeklyCapacityHours] = React.useState("40");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open && member) {
      setRole(member.role);
      setPortalProfile(member.portalProfile);
      setJobTitle(member.jobTitle ?? "");
      setHourlyCostRate(String(member.hourlyCostRate));
      setWeeklyCapacityHours(String(member.weeklyCapacityHours));
    }
  }, [open, member]);

  if (!member) return null;

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await updateMemberRoleAction({
        orgSlug,
        membershipId: member.membershipId,
        role,
        portalProfile,
        jobTitle: jobTitle || null,
        hourlyCostRate: Number(hourlyCostRate),
        weeklyCapacityHours: Number(weeklyCapacityHours),
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Updated ${member.name}`);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User — {member.name}</DialogTitle>
          <DialogDescription>
            Update role, portal profile, hourly cost rate, and capacity.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-job">Job Title</Label>
            <Input
              id="edit-job"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Solutions Architect"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Role</Label>
              <select
                id="edit-role"
                value={role}
                disabled={portalProfile === "CLIENT"}
                onChange={(e) => {
                  const nextRole = e.target.value as MembershipRole;
                  setRole(nextRole);
                  if (nextRole !== "OWNER" && portalProfile === "PORTAL_OWNER") {
                    setPortalProfile("STANDARD");
                  }
                }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isOwner && <option value="OWNER">Administrator</option>}
                <option value="ADMIN">Manager</option>
                <option value="MEMBER">Employee</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-profile">Portal Profile</Label>
              <select
                id="edit-profile"
                value={portalProfile}
                onChange={(e) => {
                  const nextProfile = e.target.value as PortalProfile;
                  setPortalProfile(nextProfile);
                  if (nextProfile === "CLIENT") {
                    setRole("MEMBER");
                  }
                }}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {isOwner && <option value="PORTAL_OWNER">Portal Owner</option>}
                <option value="STANDARD">Standard</option>
                <option value="CLIENT">Client</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-rate">Hourly Cost Rate ({defaultCurrency})</Label>
              <Input
                id="edit-rate"
                type="number"
                min="0"
                step="0.01"
                value={hourlyCostRate}
                onChange={(e) => setHourlyCostRate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-cap">Capacity (hrs/wk)</Label>
              <Input
                id="edit-cap"
                type="number"
                min="1"
                max="168"
                value={weeklyCapacityHours}
                onChange={(e) => setWeeklyCapacityHours(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AssignProjectDialog({
  open,
  onOpenChange,
  orgSlug,
  member,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  member: TeamMemberDTO | null;
  projects: Array<{ id: string; name: string }>;
}) {
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? "");
  const [asOwner, setAsOwner] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setProjectId(projects[0]?.id ?? "");
      setAsOwner(false);
    }
  }, [open, projects]);

  if (!member) return null;

  const handleAssign = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectId) return;
    startTransition(async () => {
      const res = await assignMemberToProjectAction({
        orgSlug,
        membershipId: member.membershipId,
        projectId,
        asOwner,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Assigned ${member.name} to "${res.data.projectName}"`);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign {member.name} to Project</DialogTitle>
          <DialogDescription>
            Set as Project Owner or create an assigned project onboarding task.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAssign} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="assign-proj">Project</Label>
            <select
              id="assign-proj"
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

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={asOwner}
              onChange={(e) => setAsOwner(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span>Make {member.name} the Project Owner</span>
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || projects.length === 0}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QuickChatDialog({
  open,
  onOpenChange,
  orgSlug,
  member,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  member: TeamMemberDTO | null;
}) {
  const [message, setMessage] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  if (!member) return null;

  const handleSend = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await sendQuickChatAction({
        orgSlug,
        targetUserName: member.name,
        message,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setMessage("");
      onOpenChange(false);
      toast.success(`Posted message to @${member.name} in Collaboration`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-4 text-violet-600" />
            Quick Chat — {member.name}
          </DialogTitle>
          <DialogDescription>
            Send a direct @mention update to {member.name} in your Collaboration stream.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSend} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="quick-chat-msg">Message</Label>
            <textarea
              id="quick-chat-msg"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Hey ${member.name.split(" ")[0]}, can you check...`}
              required
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
              Send Message
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
