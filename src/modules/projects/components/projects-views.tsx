"use client";

import * as React from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ProjectStatus } from "@prisma/client";
import {
  ArrowRight,
  Bug,
  Calendar,
  CheckSquare,
  Flag,
  GripVertical,
  Lock,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { updateProjectStatusAction } from "@/modules/projects/projects.actions";
import type { ProjectSummaryDTO } from "@/modules/projects/projects.types";

const TAG_PALETTE = [
  "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
];

export function getTagPillClass(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i += 1) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return TAG_PALETTE[hash % TAG_PALETTE.length]!;
}

export function isProjectOverdue(project: ProjectSummaryDTO, todayIso: string): boolean {
  if (!project.dueDate) return false;
  if (project.status === "COMPLETED" || project.status === "CANCELLED") return false;
  return project.dueDate < todayIso;
}

const BOARD_STATUS_COLUMNS: Array<{ status: ProjectStatus; label: string; dot: string }> = [
  { status: "PLANNING", label: "Planning", dot: "bg-slate-500" },
  { status: "ACTIVE", label: "Active", dot: "bg-blue-500" },
  { status: "ON_HOLD", label: "On Hold", dot: "bg-amber-500" },
  { status: "COMPLETED", label: "Completed", dot: "bg-emerald-500" },
  { status: "CANCELLED", label: "Cancelled", dot: "bg-rose-500" },
];

function ProjectBoardCardSurface({
  orgSlug,
  project,
  todayIso,
  canWrite,
  isDragging = false,
  isOverlay = false,
  dragProps,
}: {
  orgSlug: string;
  project: ProjectSummaryDTO;
  todayIso: string;
  canWrite: boolean;
  isDragging?: boolean;
  isOverlay?: boolean;
  dragProps?: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const router = useRouter();
  const overdue = isProjectOverdue(project, todayIso);

  return (
    <article
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button")) return;
        router.push(`/${orgSlug}/projects/${project.id}`);
      }}
      className={cn(
        "cursor-pointer rounded-xl border bg-card p-3.5 shadow-2xs transition hover:border-primary/40 hover:shadow-md",
        isDragging && "opacity-35",
        isOverlay && "rotate-1 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-start gap-1.5">
        {canWrite && (
          <button
            type="button"
            aria-label={`Move ${project.name}`}
            className="mt-0.5 cursor-grab text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
            {...dragProps}
          >
            <GripVertical className="size-3.5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/${orgSlug}/projects/${project.id}`}
              className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary hover:underline"
            >
              {project.name}
            </Link>
            {project.isStrict && <Lock className="size-3 shrink-0 text-amber-600" />}
            {project.source === "AUTOMATION" && (
              <Sparkles className="size-3 shrink-0 text-violet-600" />
            )}
          </div>
          {project.company && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{project.company.name}</p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-[11px] tabular-nums">
          <span className="font-medium">{project.completionPercent}%</span>
          <span className="text-muted-foreground">
            {project.doneTaskCount}/{project.taskCount} tasks
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-violet-600"
            style={{ width: `${project.completionPercent}%` }}
          />
        </div>
      </div>

      {/* Counters */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CheckSquare className="size-3" />
          {project.doneTaskCount}/{project.taskCount}
        </span>
        <span className="inline-flex items-center gap-1">
          <Flag className="size-3" />
          {project.milestoneCount} phases
        </span>
        <span className="inline-flex items-center gap-1">
          <Bug className="size-3" />
          {project.openIssueCount}/{project.issueCount}
        </span>
      </div>

      {/* Tags */}
      {project.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {project.tags.slice(0, 3).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className={cn("px-1.5 py-0 text-[10px]", getTagPillClass(tag))}
            >
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t pt-2 text-[11px]">
        <span
          className={cn(
            "inline-flex items-center gap-1",
            overdue ? "font-semibold text-rose-600" : "text-muted-foreground",
          )}
        >
          <Calendar className="size-3" />
          {project.dueDate ? formatDate(project.dueDate) : "No due date"}
        </span>
        <div className="flex items-center gap-2">
          {project.budget !== null && (
            <span className="font-semibold tabular-nums">
              {formatCurrency(project.budget, project.currency, { compact: true })}
            </span>
          )}
          {project.owner && (
            <Avatar className="size-5" title={project.owner.name}>
              {project.owner.avatarUrl && (
                <AvatarImage src={project.owner.avatarUrl} alt={project.owner.name} />
              )}
              <AvatarFallback className="text-[9px]">{initials(project.owner.name)}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </article>
  );
}

function SortableProjectBoardCard({
  orgSlug,
  project,
  todayIso,
  canWrite,
}: {
  orgSlug: string;
  project: ProjectSummaryDTO;
  todayIso: string;
  canWrite: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    disabled: !canWrite,
  });

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <ProjectBoardCardSurface
        orgSlug={orgSlug}
        project={project}
        todayIso={todayIso}
        canWrite={canWrite}
        isDragging={isDragging}
        dragProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function ProjectBoardColumn({
  orgSlug,
  status,
  label,
  dot,
  projects,
  todayIso,
  canWrite,
}: {
  orgSlug: string;
  status: ProjectStatus;
  label: string;
  dot: string;
  projects: ProjectSummaryDTO[];
  todayIso: string;
  canWrite: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` });

  return (
    <section
      className={cn(
        "flex w-76 shrink-0 flex-col rounded-xl border bg-muted/35",
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between border-b px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn("size-2.5 rounded-full", dot)} />
          <h3 className="text-sm font-semibold">{label}</h3>
          <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
            {projects.length}
          </Badge>
        </div>
      </div>

      <div ref={setNodeRef} className="flex min-h-40 flex-1 flex-col gap-2.5 p-2.5">
        <SortableContext items={projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {projects.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
              Drop project here
            </div>
          ) : (
            projects.map((project) => (
              <SortableProjectBoardCard
                key={project.id}
                orgSlug={orgSlug}
                project={project}
                todayIso={todayIso}
                canWrite={canWrite}
              />
            ))
          )}
        </SortableContext>
      </div>
    </section>
  );
}

export function ProjectsBoardView({
  orgSlug,
  projects,
  todayIso,
  canWrite,
}: {
  orgSlug: string;
  projects: ProjectSummaryDTO[];
  todayIso: string;
  canWrite: boolean;
}) {
  const dndId = React.useId();
  const [items, setItems] = React.useState(projects);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  React.useEffect(() => {
    setItems(projects);
  }, [projects]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const activeProject = React.useMemo(
    () => (activeId ? (items.find((p) => p.id === activeId) ?? null) : null),
    [activeId, items],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !canWrite) return;

    const projectId = String(active.id);
    const overId = String(over.id);

    let targetStatus: ProjectStatus | null = null;
    if (overId.startsWith("status:")) {
      targetStatus = overId.slice(7) as ProjectStatus;
    } else {
      targetStatus = items.find((p) => p.id === overId)?.status ?? null;
    }

    const current = items.find((p) => p.id === projectId);
    if (!current || !targetStatus || current.status === targetStatus) return;

    const prev = items;
    setItems((list) =>
      list.map((p) => (p.id === projectId ? { ...p, status: targetStatus! } : p)),
    );

    startTransition(async () => {
      const res = await updateProjectStatusAction({
        orgSlug,
        projectId,
        status: targetStatus!,
      });
      if (!res.ok) {
        setItems(prev);
        toast.error(res.error.message);
      } else {
        toast.success(`Moved "${current.name}" to ${targetStatus!.replace("_", " ")}`);
      }
    });
  };

  return (
    <div className="overflow-x-auto pb-2">
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex min-h-[440px] gap-4">
          {BOARD_STATUS_COLUMNS.map((col) => (
            <ProjectBoardColumn
              key={col.status}
              orgSlug={orgSlug}
              status={col.status}
              label={col.label}
              dot={col.dot}
              projects={items.filter((p) => p.status === col.status)}
              todayIso={todayIso}
              canWrite={canWrite}
            />
          ))}
        </div>

        <DragOverlay>
          {activeProject ? (
            <div className="w-72">
              <ProjectBoardCardSurface
                orgSlug={orgSlug}
                project={activeProject}
                todayIso={todayIso}
                canWrite={canWrite}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

export function ProjectsGanttView({
  orgSlug,
  projects,
  todayIso,
}: {
  orgSlug: string;
  projects: ProjectSummaryDTO[];
  todayIso: string;
}) {
  const datedProjects = projects.map((p) => {
    const startMs = Date.parse(p.startDate ?? p.dueDate ?? todayIso);
    const rawEndMs = Date.parse(p.dueDate ?? p.startDate ?? todayIso);
    const endMs = Math.max(rawEndMs, startMs + 7 * 24 * 60 * 60 * 1000);
    return { project: p, startMs, endMs };
  });

  if (datedProjects.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
        No projects match the current filter.
      </div>
    );
  }

  const minMs = Math.min(...datedProjects.map((d) => d.startMs));
  const maxMs = Math.max(...datedProjects.map((d) => d.endMs));
  const spanMs = Math.max(maxMs - minMs, 14 * 24 * 60 * 60 * 1000);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const iso = new Date(minMs + spanMs * ratio).toISOString().slice(0, 10);
    return { ratio, label: formatDate(iso, { withYear: true }) };
  });

  const todayMs = Date.parse(todayIso);
  const todayPct = ((todayMs - minMs) / spanMs) * 100;

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div className="min-w-[760px]">
        {/* Header Row */}
        <div className="grid grid-cols-12 border-b bg-muted/40 px-4 py-2.5 text-xs font-medium text-muted-foreground">
          <div className="col-span-4">Project</div>
          <div className="col-span-8 flex items-center justify-between">
            {ticks.map((t) => (
              <span key={`${t.ratio}-${t.label}`}>{t.label}</span>
            ))}
          </div>
        </div>

        {/* Timeline Rows */}
        <div className="relative divide-y">
          {todayPct >= 0 && todayPct <= 100 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-0 z-10 border-l border-dashed border-rose-500/70"
              style={{ left: `calc(33.3333% + ${(todayPct * 66.6667) / 100}%)` }}
            />
          )}

          {datedProjects.map(({ project, startMs, endMs }) => {
            const leftPct = Math.max(0, ((startMs - minMs) / spanMs) * 100);
            const widthPct = Math.max(6, ((endMs - startMs) / spanMs) * 100);
            const overdue = isProjectOverdue(project, todayIso);

            return (
              <div
                key={project.id}
                className="grid grid-cols-12 items-center px-4 py-3 text-sm hover:bg-muted/20"
              >
                <div className="col-span-4 pr-4">
                  <Link
                    href={`/${orgSlug}/projects/${project.id}`}
                    className="block truncate font-medium hover:text-primary hover:underline"
                  >
                    {project.name}
                  </Link>
                  <p className="text-[11px] text-muted-foreground">
                    {project.owner?.name ?? "Unassigned"} · {project.completionPercent}%
                  </p>
                </div>

                <div className="col-span-8">
                  <div className="relative h-7 rounded-md bg-muted/35">
                    <Link
                      href={`/${orgSlug}/projects/${project.id}`}
                      title={`${project.name} (${project.completionPercent}%)`}
                      className={cn(
                        "absolute top-1 bottom-1 flex items-center overflow-hidden rounded-md border px-2 text-[11px] font-medium shadow-2xs transition hover:brightness-95",
                        overdue
                          ? "border-rose-500/40 bg-rose-500/15 text-rose-800 dark:text-rose-200"
                          : "border-violet-500/40 bg-violet-500/15 text-violet-900 dark:text-violet-100",
                      )}
                      style={{
                        left: `${Math.min(leftPct, 94)}%`,
                        width: `${Math.min(widthPct, 100 - Math.min(leftPct, 94))}%`,
                      }}
                    >
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 opacity-25",
                          overdue ? "bg-rose-600" : "bg-violet-600",
                        )}
                        style={{ width: `${project.completionPercent}%` }}
                      />
                      <span className="relative z-10 truncate">
                        {project.completionPercent}% · {project.doneTaskCount}/{project.taskCount}
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ProjectsAutomationDialog({
  open,
  onOpenChange,
  orgSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
}) {
  const rules = [
    {
      title: "CRM Deal Closed Won → Auto-Create Project & Draft Invoice",
      status: "Active",
      trigger: "When Deal transitions to CLOSED_WON",
      actions:
        "Creates a Planning Project with 3 standard Phases & 3 kickoff Tasks, generates a gap-free Draft Invoice in Finance, and promotes Contact to Customer.",
      href: `/${orgSlug}/crm/deals`,
      cta: "Open CRM Deals",
    },
    {
      title: "Task Completion Roll-Up → Project Progress %",
      status: "Active",
      trigger: "When Task status moves to DONE",
      actions:
        "Automatically recalculates project completion percentage across List, Board, and Gantt views.",
      href: `/${orgSlug}/projects/tasks`,
      cta: "Open Task Board",
    },
    {
      title: "Template & AI Blueprint Phase Scaffolding",
      status: "Active",
      trigger: "When creating a Project from Template or AI Blueprint",
      actions:
        "Seeds phased Milestones, offset due dates, and assigned starter Tasks inside a single atomic transaction.",
      href: `/${orgSlug}/finance/invoices`,
      cta: "View Finance Invoices",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="size-4 text-emerald-600" />
            Projects &amp; Cross-Module Automation
          </DialogTitle>
          <DialogDescription>
            Workflows connecting CRM, Finance, and Projects for this organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.title} className="rounded-lg border bg-muted/20 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{rule.title}</p>
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  {rule.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                Trigger: {rule.trigger}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{rule.actions}</p>
              <div className="mt-2.5 flex justify-end">
                <Button asChild size="xs" variant="outline">
                  <Link href={rule.href} onClick={() => onOpenChange(false)}>
                    {rule.cta}
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
