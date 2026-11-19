"use client";

import * as React from "react";
import type { ProjectStatus } from "@prisma/client";
import {
  Activity,
  AlertTriangle,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { TagChipsInput } from "@/modules/projects/components/tag-chips-input";
import {
  importProjectsAction,
  updateProjectAction,
} from "@/modules/projects/projects.actions";
import type {
  ProjectActivityLogDTO,
  ProjectSummaryDTO,
  ProjectsWorkspaceDTO,
} from "@/modules/projects/projects.types";

export interface BackgroundTaskEventPayload {
  id: string;
  label: string;
  progress: number;
  status: "running" | "completed" | "failed";
}

export function emitBackgroundTaskEvent(payload: BackgroundTaskEventPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<BackgroundTaskEventPayload>("bs-bg-task", { detail: payload }));
}

export interface CustomProjectTemplate {
  id: string;
  title: string;
  description: string;
  tags: string[];
  budget: number | null;
  isStrict: boolean;
  isPublic: boolean;
  savedAt: string;
}

export function loadCustomTemplates(orgSlug: string): CustomProjectTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`bs_custom_project_templates_${orgSlug}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomProjectTemplate[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomTemplate(orgSlug: string, template: CustomProjectTemplate): CustomProjectTemplate[] {
  const existing = loadCustomTemplates(orgSlug).filter((t) => t.id !== template.id);
  const next = [template, ...existing];
  try {
    window.localStorage.setItem(`bs_custom_project_templates_${orgSlug}`, JSON.stringify(next));
  } catch {
    // Ignore storage write errors
  }
  return next;
}

export function removeCustomTemplate(orgSlug: string, id: string): CustomProjectTemplate[] {
  const next = loadCustomTemplates(orgSlug).filter((t) => t.id !== id);
  try {
    window.localStorage.setItem(`bs_custom_project_templates_${orgSlug}`, JSON.stringify(next));
  } catch {
    // Ignore storage write errors
  }
  return next;
}

/* ── Quick Edit Project Sheet (inline from Projects List) ──────────────────── */

export function QuickEditProjectSheet({
  project,
  open,
  onOpenChange,
  orgSlug,
  workspace,
}: {
  project: ProjectSummaryDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  workspace: ProjectsWorkspaceDTO;
}) {
  const [name, setName] = React.useState("");
  const [status, setStatus] = React.useState<ProjectStatus>("ACTIVE");
  const [ownerId, setOwnerId] = React.useState("");
  const [groupId, setGroupId] = React.useState("");
  const [companyId, setCompanyId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [currency, setCurrency] = React.useState("PHP");
  const [isStrict, setIsStrict] = React.useState(false);
  const [isPublic, setIsPublic] = React.useState(false);
  const [rollupEnabled, setRollupEnabled] = React.useState(true);
  const [tags, setTags] = React.useState<string[]>([]);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (project && open) {
      setName(project.name);
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
      setTags(project.tags);
    }
  }, [project, open]);

  if (!project) return null;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await updateProjectAction({
        orgSlug,
        projectId: project.id,
        name,
        description: project.description,
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
        enabledTabs: project.enabledTabs,
        tags,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Updated "${name}"`);
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>Edit Project Details</SheetTitle>
          <SheetDescription>
            Quickly update schedule, status, owner, budget, and tags for {project.name}.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="quick-edit-name">Project Name</Label>
            <Input
              id="quick-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quick-edit-status">Status</Label>
              <select
                id="quick-edit-status"
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
              <Label htmlFor="quick-edit-owner">Project Owner</Label>
              <select
                id="quick-edit-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Unassigned</option>
                {workspace.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quick-edit-company">Client / Company (CRM)</Label>
              <select
                id="quick-edit-company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Internal / None</option>
                {workspace.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="quick-edit-group">Project Group</Label>
              <select
                id="quick-edit-group"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">No Group</option>
                {workspace.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quick-edit-start">Start Date</Label>
              <Input
                id="quick-edit-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-edit-due">End Date</Label>
              <Input
                id="quick-edit-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="quick-edit-budget">Budget</Label>
              <Input
                id="quick-edit-budget"
                type="number"
                step="0.01"
                min="0"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quick-edit-currency">Currency</Label>
              <Input
                id="quick-edit-currency"
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagChipsInput tags={tags} onChange={setTags} />
          </div>

          <div className="flex flex-wrap gap-4 rounded-lg border bg-muted/20 p-3 text-xs">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isStrict}
                onChange={(e) => setIsStrict(e.target.checked)}
                className="size-3.5 accent-primary"
              />
              <span>Strict Project</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="size-3.5 accent-primary"
              />
              <span>Public Visibility</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={rollupEnabled}
                onChange={(e) => setRollupEnabled(e.target.checked)}
                className="size-3.5 accent-primary"
              />
              <span>Progress Roll-up</span>
            </label>
          </div>

          <SheetFooter className="border-t pt-4">
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

/* ── Import Projects (CSV / JSON) Dialog ───────────────────────────────────── */

interface ParsedImportRow {
  name: string;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  budget: number | null;
  tags: string[];
  description?: string | null;
}

const VALID_STATUSES = new Set<ProjectStatus>([
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
]);

function normalizeStatus(raw: unknown): ProjectStatus {
  const upper = String(raw ?? "ACTIVE")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return VALID_STATUSES.has(upper as ProjectStatus) ? (upper as ProjectStatus) : "ACTIVE";
}

function parseImportContent(text: string): ParsedImportRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // JSON format
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed: unknown = JSON.parse(trimmed);
    const arr: unknown[] = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { projects?: unknown[] }).projects)
        ? ((parsed as { projects: unknown[] }).projects)
        : [parsed];
    return arr
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .map((item): ParsedImportRow => ({
        name: String(item.name ?? item.title ?? "").trim(),
        status: normalizeStatus(item.status),
        startDate: typeof item.startDate === "string" && item.startDate ? item.startDate.slice(0, 10) : null,
        dueDate: typeof item.dueDate === "string" && item.dueDate ? item.dueDate.slice(0, 10) : null,
        budget:
          item.budget !== undefined && item.budget !== null && String(item.budget).trim() !== ""
            ? Number(item.budget)
            : null,
        tags: Array.isArray(item.tags)
          ? item.tags.map((t: unknown) => String(t).trim()).filter(Boolean)
          : typeof item.tags === "string"
            ? item.tags
                .split(/[;|]/)
                .map((t: string) => t.trim())
                .filter(Boolean)
            : [],
        description: typeof item.description === "string" ? item.description : null,
      }))
      .filter((row: ParsedImportRow) => row.name.length >= 2);
  }

  // CSV format: name,status,startDate,dueDate,budget,tags
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const splitCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const firstCells = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const hasHeader = firstCells.includes("name") || firstCells.includes("project name");
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const idxName = hasHeader
    ? Math.max(0, firstCells.findIndex((h) => h === "name" || h === "project name"))
    : 0;
  const idxStatus = hasHeader ? firstCells.findIndex((h) => h === "status") : 1;
  const idxStart = hasHeader
    ? firstCells.findIndex((h) => h === "startdate" || h === "start date" || h === "start_date")
    : 2;
  const idxDue = hasHeader
    ? firstCells.findIndex(
        (h) => h === "duedate" || h === "due date" || h === "end date" || h === "end_date",
      )
    : 3;
  const idxBudget = hasHeader ? firstCells.findIndex((h) => h === "budget") : 4;
  const idxTags = hasHeader ? firstCells.findIndex((h) => h === "tags") : 5;

  return dataLines
    .map((line) => {
      const cols = splitCsvLine(line);
      const name = (cols[idxName] ?? "").trim();
      const rawBudget = idxBudget >= 0 ? (cols[idxBudget] ?? "").replace(/[^0-9.]/g, "") : "";
      const rawTags = idxTags >= 0 ? (cols[idxTags] ?? "") : "";
      return {
        name,
        status: normalizeStatus(idxStatus >= 0 ? cols[idxStatus] : "ACTIVE"),
        startDate: idxStart >= 0 && cols[idxStart] ? cols[idxStart]!.slice(0, 10) : null,
        dueDate: idxDue >= 0 && cols[idxDue] ? cols[idxDue]!.slice(0, 10) : null,
        budget: rawBudget ? Number(rawBudget) : null,
        tags: rawTags
          .split(/[;|]/)
          .map((t) => t.replace(/^#/, "").trim())
          .filter(Boolean),
      };
    })
    .filter((row) => row.name.length >= 2);
}

const SAMPLE_CSV = `name,status,startDate,dueDate,budget,tags
Q4 Enterprise Portal Rollout,ACTIVE,2026-11-20,2027-01-30,450000,enterprise;portal
Cloud Billing Migration,PLANNING,2026-12-01,2027-02-15,280000,finance;cloud`;

export function ImportProjectsDialog({
  open,
  onOpenChange,
  orgSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
}) {
  const [rawText, setRawText] = React.useState("");
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const previewRows = React.useMemo(() => {
    if (!rawText.trim()) {
      setParseError(null);
      return [];
    }
    try {
      const rows = parseImportContent(rawText);
      setParseError(rows.length === 0 ? "No valid project rows detected." : null);
      return rows;
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse CSV/JSON.");
      return [];
    }
  }, [rawText]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawText(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handleImport = () => {
    if (previewRows.length === 0) return;
    const jobId = `import-${Date.now()}`;
    emitBackgroundTaskEvent({
      id: jobId,
      label: `Importing ${previewRows.length} project(s)`,
      progress: 25,
      status: "running",
    });

    startTransition(async () => {
      emitBackgroundTaskEvent({
        id: jobId,
        label: `Importing ${previewRows.length} project(s)`,
        progress: 65,
        status: "running",
      });
      const res = await importProjectsAction({
        orgSlug,
        rows: previewRows,
      });
      if (!res.ok) {
        emitBackgroundTaskEvent({
          id: jobId,
          label: `Import failed: ${res.error.message}`,
          progress: 100,
          status: "failed",
        });
        toast.error(res.error.message);
        return;
      }
      emitBackgroundTaskEvent({
        id: jobId,
        label: `Imported ${res.data.count} project(s)`,
        progress: 100,
        status: "completed",
      });
      toast.success(`Imported ${res.data.count} project(s) into workspace`);
      setRawText("");
      onOpenChange(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            Import Projects from CSV / JSON
          </DialogTitle>
          <DialogDescription>
            Upload a `.csv` or `.json` file or paste structured rows to bulk-create projects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,text/csv,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="size-3.5" />
                Choose CSV / JSON File
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setRawText(SAMPLE_CSV)}
              >
                <Download className="size-3.5" />
                Load Sample CSV
              </Button>
            </div>

            <Badge variant="secondary" className="gap-1 text-xs">
              <FileJson className="size-3" />
              {previewRows.length} ready
            </Badge>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={6}
            placeholder={`name,status,startDate,dueDate,budget,tags\nWebsite Redesign,ACTIVE,2026-11-20,2027-01-15,150000,web;design`}
            className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          {parseError && (
            <p className="text-xs font-medium text-destructive">{parseError}</p>
          )}

          {previewRows.length > 0 && (
            <div className="max-h-44 overflow-auto rounded-lg border">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-2.5 py-1.5 font-medium">Project Name</th>
                    <th className="px-2.5 py-1.5 font-medium">Status</th>
                    <th className="px-2.5 py-1.5 font-medium">Dates</th>
                    <th className="px-2.5 py-1.5 font-medium">Budget</th>
                    <th className="px-2.5 py-1.5 font-medium">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewRows.slice(0, 10).map((row, i) => (
                    <tr key={`${row.name}-${i}`}>
                      <td className="px-2.5 py-1.5 font-medium">{row.name}</td>
                      <td className="px-2.5 py-1.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-2.5 py-1.5 text-muted-foreground">
                        {row.startDate ?? "Today"} → {row.dueDate ?? "—"}
                      </td>
                      <td className="px-2.5 py-1.5 tabular-nums">
                        {row.budget !== null ? row.budget.toLocaleString() : "—"}
                      </td>
                      <td className="px-2.5 py-1.5 text-muted-foreground">
                        {row.tags.map((t) => `#${t}`).join(" ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || previewRows.length === 0}
            onClick={handleImport}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Import {previewRows.length > 0 ? `${previewRows.length} Project(s)` : "Projects"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Project Activity Log Sheet ────────────────────────────────────────────── */

export function ProjectActivityLogSheet({
  open,
  onOpenChange,
  logs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: ProjectActivityLogDTO[];
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.summary.toLowerCase().includes(q) ||
        l.actorName.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.entityType.toLowerCase().includes(q),
    );
  }, [logs, query]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Activity className="size-4 text-violet-600" />
            Projects Activity Log
          </SheetTitle>
          <SheetDescription>
            Audit stream of project creations, status updates, clones, imports, and automations.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter activity log..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">
                No matching activity records found.
              </p>
            ) : (
              filtered.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border bg-muted/20 p-3 text-xs transition hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{log.actorName}</span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                      {log.entityType}
                    </Badge>
                  </div>
                  <p className="mt-1 text-foreground/90">{log.summary}</p>
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {log.createdAt.slice(0, 16).replace("T", " ")} UTC
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Delete Projects Confirmation Dialog ───────────────────────────────────── */

export function DeleteProjectsConfirmDialog({
  open,
  onOpenChange,
  count,
  singleName,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  singleName?: string;
  isPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" />
            Delete {count === 1 ? "Project" : `${count} Projects`}
          </DialogTitle>
          <DialogDescription>
            {count === 1 && singleName
              ? `Are you sure you want to permanently delete "${singleName}"?`
              : `Are you sure you want to permanently delete ${count} selected projects?`}{" "}
            Associated phases, tasks, issues, and time logs will be removed. Linked Finance
            expenses will be preserved and unlinked.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
            className={cn(isPending && "opacity-70")}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Delete Permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
