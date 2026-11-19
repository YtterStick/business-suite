"use client";

import * as React from "react";
import type { ProjectStatus } from "@prisma/client";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/modules/projects/components/rich-text-editor";
import { TagChipsInput } from "@/modules/projects/components/tag-chips-input";
import { updateProjectAction } from "@/modules/projects/projects.actions";
import type { SingleProjectWorkspaceDTO } from "@/modules/projects/projects.types";

export const WORKSPACE_TAB_OPTIONS: Array<{
  id: string;
  label: string;
  locked?: boolean;
}> = [
  { id: "Dashboard", label: "Dashboard", locked: true },
  { id: "Tasks", label: "Tasks", locked: true },
  { id: "Phases", label: "Phases / Milestones" },
  { id: "Bugs", label: "Issues" },
  { id: "Time Logs", label: "Time Logs" },
  { id: "Finance", label: "Finance" },
  { id: "Documents", label: "Documents" },
  { id: "Users", label: "Project Users" },
  { id: "Feed", label: "Feed" },
];

export function EditProjectSheet({
  open,
  onOpenChange,
  orgSlug,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  data: SingleProjectWorkspaceDTO;
}) {
  const { project, members, groups, companies } = data;

  const [name, setName] = React.useState(project.name);
  const [description, setDescription] = React.useState(project.description ?? "");
  const [status, setStatus] = React.useState<ProjectStatus>(project.status);
  const [ownerId, setOwnerId] = React.useState(project.owner?.id ?? "");
  const [groupId, setGroupId] = React.useState(project.group?.id ?? "");
  const [companyId, setCompanyId] = React.useState(project.company?.id ?? "");
  const [startDate, setStartDate] = React.useState(project.startDate ?? "");
  const [dueDate, setDueDate] = React.useState(project.dueDate ?? "");
  const [budget, setBudget] = React.useState(project.budget !== null ? String(project.budget) : "");
  const [currency, setCurrency] = React.useState(project.currency);
  const [isStrict, setIsStrict] = React.useState(project.isStrict);
  const [isPublic, setIsPublic] = React.useState(project.isPublic);
  const [rollupEnabled, setRollupEnabled] = React.useState(project.rollupEnabled);
  const [enabledTabs, setEnabledTabs] = React.useState<string[]>(project.enabledTabs);
  const [tags, setTags] = React.useState<string[]>(project.tags);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description ?? "");
      setStatus(project.status);
      setOwnerId(project.owner?.id ?? "");
      setGroupId(project.group?.id ?? "");
      setCompanyId(project.company?.id ?? "");
      setStartDate(project.startDate ?? "");
      setDueDate(project.dueDate ?? "");
      setBudget(project.budget !== null ? String(project.budget) : "");
      setCurrency(project.currency);
      setIsStrict(project.isStrict);
      setIsPublic(project.isPublic);
      setRollupEnabled(project.rollupEnabled);
      setEnabledTabs(project.enabledTabs);
      setTags(project.tags);
    }
  }, [open, project]);

  const toggleTab = (id: string, locked?: boolean) => {
    if (locked) return;
    setEnabledTabs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await updateProjectAction({
        orgSlug,
        projectId: project.id,
        name,
        description: description || null,
        status,
        ownerId: ownerId || null,
        groupId: groupId || null,
        companyId: companyId || null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        budget: budget.trim() ? Number(budget) : null,
        currency,
        isStrict,
        isPublic,
        rollupEnabled,
        enabledTabs,
        tags,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      onOpenChange(false);
      toast.success("Project updated");
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>Edit Project</SheetTitle>
          <SheetDescription>
            Update project schedule, budget, status, tags, and visible workspace tabs.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-proj-name">Project Name</Label>
            <Input
              id="edit-proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-proj-status">Status</Label>
              <select
                id="edit-proj-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="PLANNING">Planning</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-proj-owner">Project Owner</Label>
              <select
                id="edit-proj-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-proj-company">Client / Company</Label>
              <select
                id="edit-proj-company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Internal / None</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-proj-group">Project Group</Label>
              <select
                id="edit-proj-group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">No group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-proj-start">Start Date</Label>
              <Input
                id="edit-proj-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-proj-due">Due Date</Label>
              <Input
                id="edit-proj-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="edit-proj-budget">Budget</Label>
              <Input
                id="edit-proj-budget"
                type="number"
                step="0.01"
                min="0"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-proj-currency">Currency</Label>
              <select
                id="edit-proj-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="PHP">PHP</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              members={members.map((m) => ({ id: m.id, name: m.name, email: m.email }))}
              mentionItems={[]}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagChipsInput tags={tags} onChange={setTags} />
          </div>

          {/* Settings Checkboxes */}
          <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isStrict}
                onChange={(e) => setIsStrict(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span className="inline-flex items-center gap-1 text-xs font-medium">
                <Lock className="size-3 text-amber-600" />
                Strict Project
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span className="text-xs font-medium">Public Access</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={rollupEnabled}
                onChange={(e) => setRollupEnabled(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span className="text-xs font-medium">Roll-up Enabled</span>
            </label>
          </div>

          {/* Customize Tabs */}
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-xs font-semibold">Customize Project Tabs</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {WORKSPACE_TAB_OPTIONS.map((tab) => {
                const checked = tab.locked || enabledTabs.includes(tab.id);
                return (
                  <label
                    key={tab.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
                      checked ? "border-primary/40 bg-primary/5 font-medium" : "text-muted-foreground",
                      tab.locked && "cursor-not-allowed opacity-75",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={tab.locked}
                      onChange={() => toggleTab(tab.id, tab.locked)}
                      className="size-3.5 accent-primary"
                    />
                    <span>{tab.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <SheetFooter className="p-0 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
