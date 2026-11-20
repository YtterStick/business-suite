import { toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import type { CollaborationCalendarEvent } from "@/modules/projects/components/collaboration-calendar-chat";
import {
  CollaborationPanel,
  type CollaborationAuditActivity,
} from "@/modules/projects/components/collaboration-panel";
import {
  getClientAccessibleProjectIds,
  listCollaborationFeed,
} from "@/modules/projects/projects.service";
import { requireTenant } from "@/server/tenancy";

function projectCodePrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (name.slice(0, 2) || "PR").toUpperCase();
}

export default async function CollaborationPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  const orgId = tenant.organization.id;
  const clientIds = await getClientAccessibleProjectIds(tenant);

  const [{ comments, projects }, memberships, auditLogs, tasks, milestones, projectRows] =
    await Promise.all([
      listCollaborationFeed(tenant),
      db.membership.findMany({
        where: { organizationId: orgId, isActive: true },
        orderBy: { user: { name: "asc" } },
        select: { user: { select: { id: true, name: true, email: true } } },
      }),
      db.auditLog.findMany({
        where: {
          organizationId: orgId,
          entityType: { in: ["Project", "Task", "Issue", "Milestone"] },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.task.findMany({
        where: {
          organizationId: orgId,
          ...(clientIds ? { projectId: { in: Array.from(clientIds) } } : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: 80,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          dueDate: true,
          projectId: true,
          assignee: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
      db.milestone.findMany({
        where: {
          organizationId: orgId,
          ...(clientIds ? { projectId: { in: Array.from(clientIds) } } : {}),
        },
        orderBy: { dueDate: "asc" },
        take: 60,
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          dueDate: true,
          projectId: true,
          project: { select: { name: true } },
        },
      }),
      db.project.findMany({
        where: {
          organizationId: orgId,
          isArchived: false,
          ...(clientIds ? { id: { in: Array.from(clientIds) } } : {}),
        },
        select: { id: true, name: true, status: true, dueDate: true },
      }),
    ]);

  const memberNameById = new Map(memberships.map((m) => [m.user.id, m.user.name]));
  const taskById = new Map(tasks.map((t, idx) => [t.id, { ...t, index: idx }]));
  const milestoneById = new Map(milestones.map((m, idx) => [m.id, { ...m, index: idx }]));
  const projectById = new Map(projectRows.map((p, idx) => [p.id, { ...p, index: idx }]));

  const auditActivities: CollaborationAuditActivity[] = auditLogs.map((log) => {
    const meta =
      log.metadata && typeof log.metadata === "object"
        ? (log.metadata as Record<string, unknown>)
        : null;
    const actorName = (log.actorId && memberNameById.get(log.actorId)) || "System";

    if (log.entityType === "Task") {
      const t = taskById.get(log.entityId);
      const projName = t?.project.name ?? (typeof meta?.projectName === "string" ? meta.projectName : null);
      const title = t?.title ?? (typeof meta?.title === "string" ? meta.title : "Task");
      const actionVerb = log.action.includes("create")
        ? "created Task"
        : log.action.includes("status") || log.action.includes("move")
          ? "updated the status of Task"
          : "updated Task";
      return {
        id: log.id,
        actorName,
        category: "task",
        actionVerb,
        entityKey: t ? `${projectCodePrefix(t.project.name)}-T${t.index + 1}` : `T-${log.entityId.slice(-3).toUpperCase()}`,
        entityTitle: title,
        projectId: t?.projectId ?? null,
        projectName: projName,
        description:
          t?.description ??
          (typeof meta?.status === "string" ? `Transitioned status to ${meta.status}` : null),
        summary: `${actionVerb} ${title}`,
        action: log.action,
        createdAt: log.createdAt.toISOString(),
        href: `/${orgSlug}/projects/tasks?taskId=${log.entityId}`,
      };
    }

    if (log.entityType === "Milestone") {
      const ms = milestoneById.get(log.entityId);
      const title = ms?.name ?? (typeof meta?.name === "string" ? meta.name : "Phase");
      return {
        id: log.id,
        actorName,
        category: "phase",
        actionVerb: log.action.includes("create") ? "added Phase" : "updated Phase",
        entityKey: ms ? `PH-${ms.index + 1}` : "PH",
        entityTitle: title,
        projectId: ms?.projectId ?? null,
        projectName: ms?.project.name ?? null,
        description: ms?.description ?? null,
        summary: `${log.action} · ${title}`,
        action: log.action,
        createdAt: log.createdAt.toISOString(),
        href: `/${orgSlug}/projects/phases`,
      };
    }

    const p = projectById.get(log.entityId);
    const title = p?.name ?? (typeof meta?.name === "string" ? meta.name : log.entityType);
    return {
      id: log.id,
      actorName,
      category: log.entityType === "Issue" ? "issue" : "project",
      actionVerb:
        log.entityType === "Issue"
          ? "logged Issue"
          : log.action.includes("create")
            ? "created Project"
            : "updated Project",
      entityKey: p ? `PRJ-${p.index + 1}` : null,
      entityTitle: title,
      projectId: p?.id ?? null,
      projectName: p?.name ?? null,
      description:
        typeof meta?.status === "string" ? `Project status: ${meta.status}` : `${log.action} on ${title}`,
      summary: `${log.action.replace(".", " ")} · ${title}`,
      action: log.action,
      createdAt: log.createdAt.toISOString(),
      href: p ? `/${orgSlug}/projects/${p.id}` : `/${orgSlug}/projects`,
    };
  });

  const calendarEvents: CollaborationCalendarEvent[] = [
    ...tasks
      .filter((t) => t.dueDate !== null)
      .map((t) => ({
        id: `cal-task-${t.id}`,
        title: t.title,
        dateIso: toIsoDate(t.dueDate!),
        kind: "task" as const,
        projectId: t.projectId,
        projectName: t.project.name,
        status: t.status.replace("_", " "),
        assigneeName: t.assignee?.name ?? null,
        href: `/${orgSlug}/projects/tasks?taskId=${t.id}`,
      })),
    ...milestones
      .filter((m) => m.dueDate !== null)
      .map((m) => ({
        id: `cal-ms-${m.id}`,
        title: m.name,
        dateIso: toIsoDate(m.dueDate!),
        kind: "phase" as const,
        projectId: m.projectId,
        projectName: m.project.name,
        status: m.status,
        assigneeName: null,
        href: `/${orgSlug}/projects/phases`,
      })),
    ...projectRows
      .filter((p) => p.dueDate !== null)
      .map((p) => ({
        id: `cal-proj-${p.id}`,
        title: `${p.name} Due`,
        dateIso: toIsoDate(p.dueDate!),
        kind: "project" as const,
        projectId: p.id,
        projectName: p.name,
        status: p.status,
        assigneeName: null,
        href: `/${orgSlug}/projects/${p.id}`,
      })),
  ];

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Collaboration</h1>
        <p className="text-sm text-muted-foreground">
          Feed Status, Activity Stream, Shared Calendar, and Team Chat across{" "}
          {tenant.organization.name}.
        </p>
      </div>

      <CollaborationPanel
        orgSlug={orgSlug}
        todayIso={toIsoDate(new Date())}
        comments={comments}
        projects={projects}
        members={memberships.map((m) => m.user)}
        auditActivities={
          clientIds
            ? auditActivities.filter((a) => a.projectId && clientIds.has(a.projectId))
            : auditActivities
        }
        calendarEvents={calendarEvents}
        showZohoTabs
        currentUserName={tenant.user.name}
        canWrite={can(tenant, "projects.comment.write")}
      />
    </div>
  );
}
