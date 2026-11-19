import "server-only";

import {
  IssueSeverity,
  IssueStatus,
  MilestoneStatus,
  Prisma,
  ProjectStatus,
  RecordSource,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

import { addDays, startOfUtcDay, toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { recordAudit } from "@/server/audit";
import { authorize, type TenantContext } from "@/server/tenancy";
import type {
  CommentDTO,
  ExtendedTaskStatus,
  IssueRowDTO,
  MentionReferenceItem,
  ProjectActivityLogDTO,
  ProjectBlueprintPhase,
  ProjectSummaryDTO,
  ProjectsWorkspaceDTO,
  ProjectTemplateKey,
  SingleProjectWorkspaceDTO,
  TaskCardDTO,
  TasksBoardDTO,
  TimeLogRowDTO,
} from "@/modules/projects/projects.types";

const TEMPLATE_DEFINITIONS: Record<
  Exclude<ProjectTemplateKey, "NONE">,
  {
    label: string;
    phases: ProjectBlueprintPhase[];
  }
> = {
  CLIENT_ONBOARDING: {
    label: "Client Onboarding",
    phases: [
      {
        name: "Kickoff & Discovery",
        offsetDays: 7,
        tasks: ["Hold stakeholder kickoff", "Collect workspace & billing details"],
      },
      {
        name: "Configuration & Training",
        offsetDays: 21,
        tasks: ["Configure user roles & permissions", "Run team onboarding session"],
      },
      {
        name: "Go-Live & Handover",
        offsetDays: 30,
        tasks: ["Sign off production readiness"],
      },
    ],
  },
  SOFTWARE_DELIVERY: {
    label: "Software Delivery",
    phases: [
      {
        name: "Architecture & Spec",
        offsetDays: 7,
        tasks: ["Finalize technical specification"],
      },
      {
        name: "Core Build",
        offsetDays: 28,
        tasks: ["Implement core modules", "Internal QA & security review"],
      },
      {
        name: "UAT & Deployment",
        offsetDays: 42,
        tasks: ["Client UAT walkthrough", "Production deployment & monitoring"],
      },
    ],
  },
  MARKETING_LAUNCH: {
    label: "Marketing Campaign Launch",
    phases: [
      {
        name: "Creative & Messaging",
        offsetDays: 7,
        tasks: ["Approve campaign brief", "Design landing page & ad assets"],
      },
      {
        name: "Channel Rollout",
        offsetDays: 18,
        tasks: ["Configure email sequences & CRM UTM tracking", "Publish launch announcements"],
      },
      {
        name: "Attribution & Review",
        offsetDays: 30,
        tasks: ["Measure pipeline attribution & ROI"],
      },
    ],
  },
  FINANCE_ERP_ROLLOUT: {
    label: "ERP & Finance Rollout",
    phases: [
      {
        name: "Chart of Accounts & Tax Setup",
        offsetDays: 10,
        tasks: ["Configure PHP/USD tax codes & invoice prefixes", "Import opening balances"],
      },
      {
        name: "CRM Billing Integration",
        offsetDays: 25,
        tasks: ["Validate Closed Won draft invoice automation", "Reconcile payment gateways"],
      },
      {
        name: "Month-End Close Training",
        offsetDays: 35,
        tasks: ["Train finance team & run parallel close"],
      },
    ],
  },
  SECURITY_AUDIT: {
    label: "Security & Compliance Audit",
    phases: [
      {
        name: "Access & Tenant Review",
        offsetDays: 7,
        tasks: ["Audit RBAC roles & MFA coverage", "Verify tenant isolation tests"],
      },
      {
        name: "Remediation",
        offsetDays: 21,
        tasks: ["Resolve high-severity findings", "Update incident response playbook"],
      },
      {
        name: "Sign-off",
        offsetDays: 30,
        tasks: ["Issue final compliance attestation"],
      },
    ],
  },
};

export async function listProjectsWorkspace(ctx: TenantContext): Promise<ProjectsWorkspaceDTO> {
  authorize(ctx, "projects.project.read");
  const organizationId = ctx.organization.id;

  const [projects, groups, memberships, companies, deals, recentTasks, recentIssues, rawAuditLogs] =
    await Promise.all([
      db.project.findMany({
        where: { organizationId },
        orderBy: [{ isArchived: "asc" }, { createdAt: "desc" }],
        include: {
          group: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true, avatarUrl: true } },
          company: { select: { id: true, name: true } },
          deal: { select: { id: true, title: true } },
          tasks: { select: { status: true } },
          issues: { select: { status: true } },
          timeLogs: { select: { hours: true } },
          _count: { select: { milestones: true, expenses: true, expenseClaims: true } },
        },
      }),
      db.projectGroup.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
        include: { _count: { select: { projects: true } } },
      }),
      db.membership.findMany({
        where: { organizationId },
        orderBy: { user: { name: "asc" } },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      db.company.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
        take: 100,
        select: { id: true, name: true },
      }),
      db.deal.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: { id: true, title: true, companyId: true },
      }),
      db.task.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 25,
        select: { id: true, title: true, project: { select: { name: true } } },
      }),
      db.issue.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        take: 25,
        select: { id: true, title: true, project: { select: { name: true } } },
      }),
      db.auditLog.findMany({
        where: {
          organizationId,
          entityType: { in: ["Project", "Task", "Milestone", "Issue", "Deal"] },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    ]);

  const memberNameById = new Map(memberships.map((m) => [m.user.id, m.user.name]));
  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  const summaries: ProjectSummaryDTO[] = projects.map((p) => {
    const taskCount = p.tasks.length;
    const doneTaskCount = p.tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const completionPercent = taskCount > 0 ? Math.round((doneTaskCount / taskCount) * 100) : 0;
    const issueCount = p.issues.length;
    const openIssueCount = p.issues.filter(
      (i) => i.status === IssueStatus.OPEN || i.status === IssueStatus.IN_PROGRESS,
    ).length;
    const hoursLogged = p.timeLogs.reduce((sum, l) => sum + Number(l.hours), 0);

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      source: p.source,
      isStrict: p.isStrict,
      isPublic: p.isPublic,
      isArchived: p.isArchived,
      rollupEnabled: p.rollupEnabled,
      businessHours: p.businessHours,
      taskLayout: p.taskLayout,
      enabledTabs: p.enabledTabs,
      templateName: p.templateName,
      tags: p.tags,
      startDate: p.startDate ? toIsoDate(p.startDate) : null,
      dueDate: p.dueDate ? toIsoDate(p.dueDate) : null,
      budget: p.budget !== null ? Number(p.budget) : null,
      currency: p.currency,
      completionPercent,
      taskCount,
      doneTaskCount,
      milestoneCount: p._count.milestones,
      issueCount,
      openIssueCount,
      expenseCount: p._count.expenses + p._count.expenseClaims,
      hoursLogged,
      group: p.group,
      owner: p.owner,
      company: p.company,
      deal: p.deal,
    };
  });

  const activityLogs: ProjectActivityLogDTO[] = rawAuditLogs.map((log) => {
    const meta = (log.metadata ?? {}) as Record<string, unknown>;
    const actorName = (log.actorId && memberNameById.get(log.actorId)) || "System Automation";
    const metaName =
      typeof meta.name === "string"
        ? meta.name
        : typeof meta.title === "string"
          ? meta.title
          : projectNameById.get(log.entityId) ?? log.entityType;
    const countSuffix = typeof meta.count === "number" ? ` (${meta.count} items)` : "";
    const statusSuffix = typeof meta.status === "string" ? ` → ${meta.status}` : "";
    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      actorName,
      summary: `${log.action.replace(/\./g, " ")} · ${metaName}${statusSuffix}${countSuffix}`,
      createdAt: log.createdAt.toISOString(),
    };
  });

  const mentionItems: MentionReferenceItem[] = [
    ...recentTasks.map((t, idx) => ({
      id: t.id,
      kind: "task" as const,
      code: `TSK-${idx + 1}`,
      title: t.title,
      projectName: t.project.name,
    })),
    ...recentIssues.map((i, idx) => ({
      id: i.id,
      kind: "issue" as const,
      code: `ISS-${idx + 1}`,
      title: i.title,
      projectName: i.project.name,
    })),
  ];

  return {
    projects: summaries,
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      projectCount: g._count.projects,
    })),
    members: memberships.map((m) => m.user),
    companies,
    deals,
    mentionItems,
    activityLogs,
  };
}

export async function createProject(
  ctx: TenantContext,
  input: {
    name: string;
    description?: string | null;
    ownerId?: string | null;
    template: ProjectTemplateKey;
    startDate?: string | null;
    dueDate?: string | null;
    isStrict: boolean;
    isPublic: boolean;
    rollupEnabled: boolean;
    businessHours?: string;
    taskLayout?: string;
    enabledTabs?: string[];
    customPhases?: ProjectBlueprintPhase[];
    groupId?: string | null;
    newGroupName?: string | null;
    tags?: string[];
    budget?: number | null;
    currency?: string;
    companyId?: string | null;
    dealId?: string | null;
  },
): Promise<{ id: string; name: string }> {
  authorize(ctx, "projects.project.write");
  const organizationId = ctx.organization.id;

  return db.$transaction(async (tx) => {
    let resolvedGroupId = input.groupId || null;

    if (input.newGroupName && input.newGroupName.trim().length > 0) {
      const groupName = input.newGroupName.trim();
      const group = await tx.projectGroup.upsert({
        where: { organizationId_name: { organizationId, name: groupName } },
        create: { organizationId, name: groupName },
        update: {},
        select: { id: true },
      });
      resolvedGroupId = group.id;
    }

    const templateDef =
      input.template !== "NONE" ? TEMPLATE_DEFINITIONS[input.template] : null;
    const phasesToCreate =
      input.customPhases && input.customPhases.length > 0
        ? input.customPhases
        : (templateDef?.phases ?? []);
    const baseStart = input.startDate ? startOfUtcDay(new Date(input.startDate)) : startOfUtcDay(new Date());
    const dueDate = input.dueDate ? startOfUtcDay(new Date(input.dueDate)) : null;

    const project = await tx.project.create({
      data: {
        organizationId,
        groupId: resolvedGroupId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        status: ProjectStatus.ACTIVE,
        source: RecordSource.MANUAL,
        ownerId: input.ownerId || ctx.user.id,
        companyId: input.companyId || null,
        dealId: input.dealId || null,
        startDate: baseStart,
        dueDate,
        budget:
          input.budget !== null && input.budget !== undefined
            ? new Prisma.Decimal(input.budget).toDecimalPlaces(2)
            : null,
        currency: (input.currency || ctx.organization.defaultCurrency).toUpperCase(),
        isStrict: input.isStrict,
        isPublic: input.isPublic,
        rollupEnabled: input.rollupEnabled,
        businessHours: input.businessHours || "Standard Business Hours",
        taskLayout: input.taskLayout || "Standard Layout",
        enabledTabs:
          input.enabledTabs && input.enabledTabs.length > 0
            ? input.enabledTabs
            : [
                "Dashboard",
                "Tasks",
                "Users",
                "Reports",
                "Documents",
                "Phases",
                "Time Logs",
                "Bugs",
                "Feed",
                "Timesheet",
              ],
        templateName: templateDef?.label ?? (input.customPhases?.length ? "AI Generated" : null),
        tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
      },
      select: { id: true, name: true, ownerId: true },
    });

    if (phasesToCreate.length > 0) {
      let taskPos = 1024;
      for (const [mIdx, ms] of phasesToCreate.entries()) {
        const milestone = await tx.milestone.create({
          data: {
            organizationId,
            projectId: project.id,
            name: ms.name,
            status: mIdx === 0 ? MilestoneStatus.IN_PROGRESS : MilestoneStatus.PENDING,
            dueDate: startOfUtcDay(addDays(baseStart, ms.offsetDays)),
            position: mIdx,
          },
          select: { id: true },
        });

        for (const taskTitle of ms.tasks) {
          await tx.task.create({
            data: {
              organizationId,
              projectId: project.id,
              milestoneId: milestone.id,
              assigneeId: project.ownerId,
              reporterId: ctx.user.id,
              title: taskTitle,
              status: TaskStatus.TODO,
              priority: TaskPriority.MEDIUM,
              position: taskPos,
              dueDate: startOfUtcDay(addDays(baseStart, ms.offsetDays)),
            },
          });
          taskPos += 1024;
        }
      }
    }

    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Project",
      entityId: project.id,
      action: "project.created",
      metadata: { name: project.name, template: input.template },
    });

    return { id: project.id, name: project.name };
  });
}

export async function toggleProjectArchive(
  ctx: TenantContext,
  projectId: string,
  isArchived: boolean,
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const updated = await db.project.updateMany({
    where: { id: projectId, organizationId: ctx.organization.id },
    data: { isArchived },
  });
  if (updated.count === 0) {
    throw new NotFoundError("Project not found.");
  }
}

export async function updateProjectStatus(
  ctx: TenantContext,
  projectId: string,
  status: ProjectStatus,
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const updated = await db.project.updateMany({
    where: { id: projectId, organizationId: ctx.organization.id },
    data: { status },
  });
  if (updated.count === 0) {
    throw new NotFoundError("Project not found.");
  }
}

export async function bulkArchiveProjects(
  ctx: TenantContext,
  projectIds: string[],
  isArchived: boolean,
): Promise<{ count: number }> {
  authorize(ctx, "projects.project.write");
  const ids = Array.from(new Set(projectIds)).filter(Boolean);
  if (ids.length === 0) {
    throw new ValidationError("Select at least one project.");
  }
  const organizationId = ctx.organization.id;
  return db.$transaction(async (tx) => {
    const res = await tx.project.updateMany({
      where: { organizationId, id: { in: ids } },
      data: { isArchived },
    });
    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Project",
      entityId: ids[0]!,
      action: isArchived ? "project.bulk_archived" : "project.bulk_restored",
      metadata: { count: res.count, projectIds: ids },
    });
    return { count: res.count };
  });
}

export async function bulkUpdateProjectsStatus(
  ctx: TenantContext,
  projectIds: string[],
  status: ProjectStatus,
): Promise<{ count: number }> {
  authorize(ctx, "projects.project.write");
  const ids = Array.from(new Set(projectIds)).filter(Boolean);
  if (ids.length === 0) {
    throw new ValidationError("Select at least one project.");
  }
  const organizationId = ctx.organization.id;
  return db.$transaction(async (tx) => {
    const res = await tx.project.updateMany({
      where: { organizationId, id: { in: ids } },
      data: { status },
    });
    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Project",
      entityId: ids[0]!,
      action: "project.bulk_status_updated",
      metadata: { count: res.count, status, projectIds: ids },
    });
    return { count: res.count };
  });
}

export async function deleteProjects(
  ctx: TenantContext,
  projectIds: string[],
): Promise<{ count: number }> {
  authorize(ctx, "projects.project.write");
  const ids = Array.from(new Set(projectIds)).filter(Boolean);
  if (ids.length === 0) {
    throw new ValidationError("Select at least one project to delete.");
  }
  const organizationId = ctx.organization.id;
  return db.$transaction(async (tx) => {
    const existing = await tx.project.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true, name: true },
    });
    if (existing.length === 0) {
      throw new NotFoundError("No matching projects found.");
    }
    const existingIds = existing.map((p) => p.id);

    // Unlink Finance expenses (onDelete: Restrict) before deleting projects
    await tx.expense.updateMany({
      where: { organizationId, projectId: { in: existingIds } },
      data: { projectId: null },
    });

    const deleted = await tx.project.deleteMany({
      where: { organizationId, id: { in: existingIds } },
    });

    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Project",
      entityId: existingIds[0]!,
      action: deleted.count > 1 ? "project.bulk_deleted" : "project.deleted",
      metadata: {
        count: deleted.count,
        name: existing.length === 1 ? existing[0]!.name : `${existing.length} projects`,
      },
    });

    return { count: deleted.count };
  });
}

export async function cloneProject(
  ctx: TenantContext,
  projectId: string,
): Promise<{ id: string; name: string }> {
  authorize(ctx, "projects.project.write");
  const organizationId = ctx.organization.id;

  return db.$transaction(async (tx) => {
    const src = await tx.project.findFirst({
      where: { id: projectId, organizationId },
      include: {
        milestones: { orderBy: { position: "asc" } },
        tasks: { orderBy: { position: "asc" } },
      },
    });
    if (!src) {
      throw new NotFoundError("Project not found.");
    }

    const clonedName = `${src.name} (Copy)`;
    const cloned = await tx.project.create({
      data: {
        organizationId,
        groupId: src.groupId,
        name: clonedName,
        description: src.description,
        status: ProjectStatus.PLANNING,
        source: RecordSource.MANUAL,
        ownerId: src.ownerId ?? ctx.user.id,
        companyId: src.companyId,
        dealId: null,
        startDate: src.startDate,
        dueDate: src.dueDate,
        budget: src.budget,
        currency: src.currency,
        isStrict: src.isStrict,
        isPublic: src.isPublic,
        isArchived: false,
        rollupEnabled: src.rollupEnabled,
        businessHours: src.businessHours,
        taskLayout: src.taskLayout,
        enabledTabs: src.enabledTabs,
        templateName: src.templateName,
        tags: src.tags,
      },
      select: { id: true, name: true },
    });

    const milestoneMap = new Map<string, string>();
    for (const ms of src.milestones) {
      const createdMs = await tx.milestone.create({
        data: {
          organizationId,
          projectId: cloned.id,
          name: ms.name,
          description: ms.description,
          status: MilestoneStatus.PENDING,
          dueDate: ms.dueDate,
          position: ms.position,
        },
        select: { id: true },
      });
      milestoneMap.set(ms.id, createdMs.id);
    }

    for (const t of src.tasks) {
      await tx.task.create({
        data: {
          organizationId,
          projectId: cloned.id,
          milestoneId: t.milestoneId ? (milestoneMap.get(t.milestoneId) ?? null) : null,
          assigneeId: t.assigneeId,
          reporterId: ctx.user.id,
          title: t.title,
          description: t.description,
          status: TaskStatus.TODO,
          priority: t.priority,
          position: t.position,
          dueDate: t.dueDate,
        },
      });
    }

    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Project",
      entityId: cloned.id,
      action: "project.cloned",
      metadata: { name: cloned.name, sourceProjectId: src.id, sourceName: src.name },
    });

    return cloned;
  });
}

export async function importProjects(
  ctx: TenantContext,
  rows: Array<{
    name: string;
    description?: string | null;
    status?: ProjectStatus;
    startDate?: string | null;
    dueDate?: string | null;
    budget?: number | null;
    tags?: string[];
  }>,
): Promise<{ count: number }> {
  authorize(ctx, "projects.project.write");
  if (rows.length === 0) {
    throw new ValidationError("No valid project rows provided for import.");
  }
  const organizationId = ctx.organization.id;

  return db.$transaction(async (tx) => {
    let count = 0;
    let firstId = "";
    for (const row of rows) {
      const cleanName = row.name.trim();
      if (cleanName.length < 2) continue;
      const created = await tx.project.create({
        data: {
          organizationId,
          name: cleanName.slice(0, 180),
          description: row.description?.trim() || null,
          status: row.status ?? ProjectStatus.ACTIVE,
          source: RecordSource.MANUAL,
          ownerId: ctx.user.id,
          startDate: row.startDate ? startOfUtcDay(new Date(row.startDate)) : startOfUtcDay(new Date()),
          dueDate: row.dueDate ? startOfUtcDay(new Date(row.dueDate)) : null,
          budget:
            row.budget !== null && row.budget !== undefined && Number.isFinite(row.budget)
              ? new Prisma.Decimal(Math.max(0, row.budget)).toDecimalPlaces(2)
              : null,
          currency: ctx.organization.defaultCurrency,
          tags: (row.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12),
        },
        select: { id: true },
      });
      if (!firstId) firstId = created.id;
      count += 1;
    }

    if (count === 0) {
      throw new ValidationError("No valid rows with project names found.");
    }

    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Project",
      entityId: firstId,
      action: "project.imported",
      metadata: { count, name: `${count} imported project(s)` },
    });

    return { count };
  });
}

function buildProjectTaskPrefix(projectName: string): string {
  const words = projectName
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  }
  return (words[0]?.slice(0, 2) || "PR").toUpperCase();
}

export async function getTasksBoard(
  ctx: TenantContext,
  projectId?: string,
): Promise<TasksBoardDTO> {
  authorize(ctx, "projects.project.read");
  const organizationId = ctx.organization.id;

  const [tasks, projects, milestones, memberships, taskTimeLogs, taskComments, taskAudits] =
    await Promise.all([
      db.task.findMany({
        where: {
          organizationId,
          ...(projectId ? { projectId } : {}),
        },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: {
          project: { select: { name: true } },
          milestone: { select: { name: true } },
          assignee: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      db.project.findMany({
        where: { organizationId, isArchived: false },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db.milestone.findMany({
        where: { organizationId },
        orderBy: [{ position: "asc" }, { name: "asc" }],
        select: { id: true, projectId: true, name: true },
      }),
      db.membership.findMany({
        where: { organizationId },
        orderBy: { user: { name: "asc" } },
        include: { user: { select: { id: true, name: true } } },
      }),
      db.timeLog.findMany({
        where: { organizationId, taskId: { not: null } },
        orderBy: [{ loggedDate: "desc" }, { createdAt: "desc" }],
        include: { user: { select: { name: true } } },
      }),
      db.comment.findMany({
        where: { organizationId, entityType: "Task" },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      }),
      db.auditLog.findMany({
        where: { organizationId, entityType: "Task" },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

  const memberNameMap = new Map(memberships.map((m) => [m.user.id, m.user.name]));
  const logsByTask = new Map<string, NonNullable<TaskCardDTO["timeLogs"]>>();
  for (const log of taskTimeLogs) {
    if (!log.taskId) continue;
    const list = logsByTask.get(log.taskId) ?? [];
    list.push({
      id: log.id,
      userName: log.user?.name ?? "Team Member",
      hours: Number(log.hours),
      billable: log.billable,
      loggedDate: toIsoDate(log.loggedDate),
      notes: log.notes,
    });
    logsByTask.set(log.taskId, list);
  }

  const subtasksByTask = new Map<string, NonNullable<TaskCardDTO["subtasks"]>>();
  const depsByTask = new Map<string, NonNullable<TaskCardDTO["dependencies"]>>();
  const attsByTask = new Map<string, NonNullable<TaskCardDTO["attachments"]>>();
  const commentsByTask = new Map<string, NonNullable<TaskCardDTO["comments"]>>();
  const statusMetaByTask = new Map<string, ExtendedTaskStatus>();
  const tagsByTask = new Map<string, string[]>();

  for (const c of taskComments) {
    if (c.body.startsWith("[STATUS_META]|")) {
      const rawSt = c.body.slice("[STATUS_META]|".length).trim();
      if (rawSt === "DELAYED" || rawSt === "CANCELLED") {
        statusMetaByTask.set(c.entityId, rawSt);
      }
    } else if (c.body.startsWith("[TAGS]|")) {
      const rawTags = c.body
        .slice("[TAGS]|".length)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      tagsByTask.set(c.entityId, rawTags);
    } else if (c.body.startsWith("[SUBTASK]|")) {
      const [, subTitle, doneFlag] = c.body.split("|");
      const list = subtasksByTask.get(c.entityId) ?? [];
      list.push({
        id: c.id,
        commentId: c.id,
        title: subTitle?.trim() || "Subtask",
        done: doneFlag?.trim() === "1",
      });
      subtasksByTask.set(c.entityId, list);
    } else if (c.body.startsWith("[DEP]|")) {
      const [, rel, targetId, targetTitle] = c.body.split("|");
      const list = depsByTask.get(c.entityId) ?? [];
      list.push({
        commentId: c.id,
        relation: rel === "SUCCESSOR" ? "SUCCESSOR" : "PREDECESSOR",
        targetTaskId: targetId?.trim() || "",
        targetTaskTitle: targetTitle?.trim() || "Linked Task",
      });
      depsByTask.set(c.entityId, list);
    } else if (c.body.startsWith("[ATT]|")) {
      const [, fileName, sizeLabel, category, url] = c.body.split("|");
      const list = attsByTask.get(c.entityId) ?? [];
      list.push({
        commentId: c.id,
        name: fileName?.trim() || "Attachment",
        sizeLabel: sizeLabel?.trim() || "—",
        category: category?.trim() || "File",
        url: url?.trim() || "#",
        authorName: c.author?.name ?? "Team Member",
        createdAt: c.createdAt.toISOString(),
      });
      attsByTask.set(c.entityId, list);
    } else {
      const list = commentsByTask.get(c.entityId) ?? [];
      list.push({
        id: c.id,
        authorName: c.author?.name ?? "Team Member",
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      });
      commentsByTask.set(c.entityId, list);
    }
  }

  const auditsByTask = new Map<string, NonNullable<TaskCardDTO["activities"]>>();
  for (const a of taskAudits) {
    const list = auditsByTask.get(a.entityId) ?? [];
    const meta =
      a.metadata && typeof a.metadata === "object"
        ? (a.metadata as Record<string, unknown>)
        : null;
    const statusText = typeof meta?.status === "string" ? `Status -> ${meta.status}` : a.action;
    list.push({
      id: a.id,
      actorName: (a.actorId && memberNameMap.get(a.actorId)) || "Team Member",
      action: a.action,
      summary: statusText,
      createdAt: a.createdAt.toISOString(),
    });
    auditsByTask.set(a.entityId, list);
  }

  const seqByProject = new Map<string, number>();
  const mappedTasks: TaskCardDTO[] = tasks.map((t) => {
    const nextSeq = (seqByProject.get(t.projectId) ?? 0) + 1;
    seqByProject.set(t.projectId, nextSeq);
    const prefix = buildProjectTaskPrefix(t.project.name);

    return {
      id: t.id,
      taskKey: `${prefix}-T${nextSeq}`,
      projectId: t.projectId,
      projectName: t.project.name,
      milestoneId: t.milestoneId,
      milestoneName: t.milestone?.name ?? null,
      reporterId: t.reporterId,
      title: t.title,
      description: t.description,
      status: t.status,
      extendedStatus: statusMetaByTask.get(t.id),
      priority: t.priority,
      position: t.position,
      startDate: toIsoDate(t.createdAt),
      dueDate: t.dueDate ? toIsoDate(t.dueDate) : null,
      assignee: t.assignee,
      tags: tagsByTask.get(t.id) ?? [],
      subtasks: subtasksByTask.get(t.id) ?? [],
      dependencies: depsByTask.get(t.id) ?? [],
      attachments: attsByTask.get(t.id) ?? [],
      comments: commentsByTask.get(t.id) ?? [],
      timeLogs: logsByTask.get(t.id) ?? [],
      activities: auditsByTask.get(t.id) ?? [],
    };
  });

  return {
    tasks: mappedTasks,
    projects,
    milestones,
    members: memberships.map((m) => m.user),
  };
}

export async function createTask(
  ctx: TenantContext,
  input: {
    projectId: string;
    milestoneId?: string | null;
    title: string;
    description?: string | null;
    priority: TaskPriority;
    status?: TaskStatus;
    extendedStatus?: ExtendedTaskStatus;
    tags?: string[];
    assigneeId?: string | null;
    dueDate?: string | null;
  },
): Promise<TaskCardDTO> {
  authorize(ctx, "projects.project.write");
  const organizationId = ctx.organization.id;

  const project = await db.project.findUnique({
    where: { id_organizationId: { id: input.projectId, organizationId } },
    select: { id: true, name: true },
  });
  if (!project) {
    throw new ValidationError("Selected project does not belong to this organization.");
  }

  let verifiedMilestoneId: string | null = null;
  if (input.milestoneId) {
    const ms = await db.milestone.findUnique({
      where: {
        id_projectId_organizationId: {
          id: input.milestoneId,
          projectId: project.id,
          organizationId,
        },
      },
      select: { id: true },
    });
    if (ms) verifiedMilestoneId = ms.id;
  }

  const [tail, existingCount] = await Promise.all([
    db.task.findFirst({
      where: { organizationId, projectId: project.id },
      orderBy: { position: "desc" },
      select: { position: true },
    }),
    db.task.count({ where: { organizationId, projectId: project.id } }),
  ]);

  const status = input.status ?? TaskStatus.TODO;
  const created = await db.task.create({
    data: {
      organizationId,
      projectId: project.id,
      milestoneId: verifiedMilestoneId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      status,
      priority: input.priority,
      assigneeId: input.assigneeId || null,
      reporterId: ctx.user.id,
      position: tail ? tail.position + 1024 : 1024,
      dueDate: input.dueDate ? startOfUtcDay(new Date(input.dueDate)) : null,
      completedAt: status === TaskStatus.DONE ? new Date() : null,
    },
    include: {
      milestone: { select: { name: true } },
      assignee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  if (input.extendedStatus === "DELAYED" || input.extendedStatus === "CANCELLED") {
    await db.comment.create({
      data: {
        organizationId,
        authorId: ctx.user.id,
        entityType: "Task",
        entityId: created.id,
        body: `[STATUS_META]|${input.extendedStatus}`,
      },
    });
  }

  const cleanTags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean);
  if (cleanTags.length > 0) {
    await db.comment.create({
      data: {
        organizationId,
        authorId: ctx.user.id,
        entityType: "Task",
        entityId: created.id,
        body: `[TAGS]|${cleanTags.join(",")}`,
      },
    });
  }

  return {
    id: created.id,
    taskKey: `${buildProjectTaskPrefix(project.name)}-T${existingCount + 1}`,
    projectId: created.projectId,
    projectName: project.name,
    milestoneId: created.milestoneId,
    milestoneName: created.milestone?.name ?? null,
    reporterId: created.reporterId,
    title: created.title,
    description: created.description,
    status: created.status,
    extendedStatus:
      input.extendedStatus === "DELAYED" || input.extendedStatus === "CANCELLED"
        ? input.extendedStatus
        : undefined,
    priority: created.priority,
    position: created.position,
    startDate: toIsoDate(created.createdAt),
    dueDate: created.dueDate ? toIsoDate(created.dueDate) : null,
    assignee: created.assignee,
    tags: cleanTags,
    subtasks: [],
    dependencies: [],
    attachments: [],
    comments: [],
    timeLogs: [],
    activities: [],
  };
}

export async function moveTaskStatus(
  ctx: TenantContext,
  input: {
    taskId: string;
    status: TaskStatus;
    extendedStatus?: ExtendedTaskStatus;
    position?: number;
  },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const organizationId = ctx.organization.id;

  const existing = await db.task.findUnique({
    where: { id_organizationId: { id: input.taskId, organizationId } },
    select: { id: true, title: true, completedAt: true },
  });
  if (!existing) {
    throw new NotFoundError("Task not found.");
  }

  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id_organizationId: { id: existing.id, organizationId } },
      data: {
        status: input.status,
        ...(input.position !== undefined ? { position: input.position } : {}),
        completedAt:
          input.status === TaskStatus.DONE ? (existing.completedAt ?? new Date()) : null,
      },
    });

    await tx.comment.deleteMany({
      where: {
        organizationId,
        entityType: "Task",
        entityId: existing.id,
        body: { startsWith: "[STATUS_META]|" },
      },
    });

    if (input.extendedStatus === "DELAYED" || input.extendedStatus === "CANCELLED") {
      await tx.comment.create({
        data: {
          organizationId,
          authorId: ctx.user.id,
          entityType: "Task",
          entityId: existing.id,
          body: `[STATUS_META]|${input.extendedStatus}`,
        },
      });
    }

    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Task",
      entityId: existing.id,
      action: "task.status_changed",
      metadata: {
        title: existing.title,
        status: input.extendedStatus ?? input.status,
      },
    });
  });
}

export async function updateTaskDetails(
  ctx: TenantContext,
  input: {
    taskId: string;
    title: string;
    description?: string | null;
    status: TaskStatus;
    extendedStatus?: ExtendedTaskStatus;
    priority: TaskPriority;
    assigneeId?: string | null;
    dueDate?: string | null;
  },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const organizationId = ctx.organization.id;

  const existing = await db.task.findUnique({
    where: { id_organizationId: { id: input.taskId, organizationId } },
    select: { id: true, completedAt: true },
  });
  if (!existing) throw new NotFoundError("Task not found.");

  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id_organizationId: { id: existing.id, organizationId } },
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId || null,
        dueDate: input.dueDate ? startOfUtcDay(new Date(`${input.dueDate}T00:00:00.000Z`)) : null,
        completedAt:
          input.status === TaskStatus.DONE ? (existing.completedAt ?? new Date()) : null,
      },
    });

    await tx.comment.deleteMany({
      where: {
        organizationId,
        entityType: "Task",
        entityId: existing.id,
        body: { startsWith: "[STATUS_META]|" },
      },
    });

    if (input.extendedStatus === "DELAYED" || input.extendedStatus === "CANCELLED") {
      await tx.comment.create({
        data: {
          organizationId,
          authorId: ctx.user.id,
          entityType: "Task",
          entityId: existing.id,
          body: `[STATUS_META]|${input.extendedStatus}`,
        },
      });
    }

    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Task",
      entityId: existing.id,
      action: "task.updated",
      metadata: {
        title: input.title.trim(),
        status: input.extendedStatus ?? input.status,
        priority: input.priority,
      },
    });
  });
}

export async function quickUpdateTask(
  ctx: TenantContext,
  input: {
    taskId: string;
    priority?: TaskPriority;
    assigneeId?: string | null;
    dueDate?: string | null;
    tags?: string[];
  },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const organizationId = ctx.organization.id;

  const existing = await db.task.findUnique({
    where: { id_organizationId: { id: input.taskId, organizationId } },
    select: { id: true, title: true },
  });
  if (!existing) throw new NotFoundError("Task not found.");

  await db.$transaction(async (tx) => {
    const data: Prisma.TaskUncheckedUpdateInput = {};
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId || null;
    if (input.dueDate !== undefined) {
      data.dueDate = input.dueDate
        ? startOfUtcDay(new Date(`${input.dueDate}T00:00:00.000Z`))
        : null;
    }

    if (Object.keys(data).length > 0) {
      await tx.task.update({
        where: { id_organizationId: { id: existing.id, organizationId } },
        data,
      });
    }

    if (input.tags !== undefined) {
      await tx.comment.deleteMany({
        where: {
          organizationId,
          entityType: "Task",
          entityId: existing.id,
          body: { startsWith: "[TAGS]|" },
        },
      });
      const cleanTags = input.tags.map((t) => t.trim()).filter(Boolean);
      if (cleanTags.length > 0) {
        await tx.comment.create({
          data: {
            organizationId,
            authorId: ctx.user.id,
            entityType: "Task",
            entityId: existing.id,
            body: `[TAGS]|${cleanTags.join(",")}`,
          },
        });
      }
    }

    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Task",
      entityId: existing.id,
      action: "task.quick_updated",
      metadata: { title: existing.title },
    });
  });
}

export async function importTasks(
  ctx: TenantContext,
  input: {
    projectId: string;
    rows: Array<{
      title: string;
      priority?: TaskPriority;
      status?: TaskStatus;
      dueDate?: string | null;
      tags?: string[];
    }>;
  },
): Promise<{ count: number }> {
  authorize(ctx, "projects.project.write");
  const organizationId = ctx.organization.id;
  const project = await db.project.findUnique({
    where: { id_organizationId: { id: input.projectId, organizationId } },
    select: { id: true, name: true },
  });
  if (!project) throw new NotFoundError("Selected project not found.");

  return db.$transaction(async (tx) => {
    const tail = await tx.task.findFirst({
      where: { organizationId, projectId: project.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    let pos = tail ? tail.position + 1024 : 1024;
    let count = 0;

    for (const row of input.rows) {
      const title = row.title.trim();
      if (title.length < 2) continue;
      const st = row.status ?? TaskStatus.TODO;
      const created = await tx.task.create({
        data: {
          organizationId,
          projectId: project.id,
          title: title.slice(0, 180),
          priority: row.priority ?? TaskPriority.MEDIUM,
          status: st,
          reporterId: ctx.user.id,
          position: pos,
          dueDate: row.dueDate ? startOfUtcDay(new Date(`${row.dueDate}T00:00:00.000Z`)) : null,
          completedAt: st === TaskStatus.DONE ? new Date() : null,
        },
        select: { id: true },
      });
      const cleanTags = (row.tags ?? []).map((t) => t.trim()).filter(Boolean);
      if (cleanTags.length > 0) {
        await tx.comment.create({
          data: {
            organizationId,
            authorId: ctx.user.id,
            entityType: "Task",
            entityId: created.id,
            body: `[TAGS]|${cleanTags.join(",")}`,
          },
        });
      }
      pos += 1024;
      count += 1;
    }

    if (count === 0) throw new ValidationError("No valid task rows found.");

    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Task",
      entityId: project.id,
      action: "task.imported",
      metadata: { count, title: `${count} tasks imported into ${project.name}` },
    });

    return { count };
  });
}

export async function listIssues(ctx: TenantContext): Promise<{
  issues: IssueRowDTO[];
  projects: Array<{ id: string; name: string }>;
  members: Array<{ id: string; name: string }>;
}> {
  authorize(ctx, "projects.project.read");
  const organizationId = ctx.organization.id;

  const [issues, projects, memberships] = await Promise.all([
    db.issue.findMany({
      where: { organizationId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        project: { select: { name: true } },
        assignee: { select: { id: true, name: true } },
        reporter: { select: { id: true, name: true } },
      },
    }),
    db.project.findMany({
      where: { organizationId, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.membership.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    issues: issues.map((i) => ({
      id: i.id,
      projectId: i.projectId,
      projectName: i.project.name,
      title: i.title,
      description: i.description,
      severity: i.severity,
      status: i.status,
      dueDate: i.dueDate ? toIsoDate(i.dueDate) : null,
      assignee: i.assignee,
      reporter: i.reporter,
      createdAt: i.createdAt.toISOString(),
    })),
    projects,
    members: memberships.map((m) => m.user),
  };
}

export async function createIssue(
  ctx: TenantContext,
  input: {
    projectId: string;
    title: string;
    description?: string | null;
    severity: IssueSeverity;
    assigneeId?: string | null;
  },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const organizationId = ctx.organization.id;

  const project = await db.project.findUnique({
    where: { id_organizationId: { id: input.projectId, organizationId } },
    select: { id: true },
  });
  if (!project) throw new ValidationError("Project not found.");

  await db.issue.create({
    data: {
      organizationId,
      projectId: project.id,
      reporterId: ctx.user.id,
      assigneeId: input.assigneeId || null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      severity: input.severity,
      status: IssueStatus.OPEN,
    },
  });
}

export async function updateIssueStatus(
  ctx: TenantContext,
  issueId: string,
  status: IssueStatus,
): Promise<void> {
  authorize(ctx, "projects.project.write");
  await db.issue.updateMany({
    where: { id: issueId, organizationId: ctx.organization.id },
    data: { status },
  });
}

export async function updateIssueDetails(
  ctx: TenantContext,
  input: {
    issueId: string;
    title?: string;
    description?: string | null;
    severity?: IssueSeverity;
    status?: IssueStatus;
    assigneeId?: string | null;
    dueDate?: string | null;
  },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const updated = await db.issue.updateMany({
    where: { id: input.issueId, organizationId: ctx.organization.id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.severity !== undefined ? { severity: input.severity } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId || null } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? startOfUtcDay(new Date(input.dueDate)) : null }
        : {}),
    },
  });
  if (updated.count === 0) {
    throw new NotFoundError("Issue not found.");
  }
}

export async function listTimeLogs(ctx: TenantContext): Promise<{
  logs: TimeLogRowDTO[];
  projects: Array<{ id: string; name: string }>;
  tasks: Array<{ id: string; projectId: string; title: string }>;
  defaultCurrency: string;
}> {
  authorize(ctx, "projects.project.read");
  const organizationId = ctx.organization.id;

  const [logs, projects, tasks, memberships] = await Promise.all([
    db.timeLog.findMany({
      where: { organizationId },
      orderBy: [{ loggedDate: "desc" }, { createdAt: "desc" }],
      take: 150,
      include: {
        project: { select: { name: true, currency: true } },
        task: { select: { id: true, title: true } },
        user: { select: { id: true, name: true } },
        timesheet: { select: { status: true } },
      },
    }),
    db.project.findMany({
      where: { organizationId, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.task.findMany({
      where: { organizationId, project: { isArchived: false } },
      orderBy: [{ projectId: "asc" }, { title: "asc" }],
      select: { id: true, projectId: true, title: true },
    }),
    db.membership.findMany({
      where: { organizationId },
      select: { userId: true, hourlyCostRate: true },
    }),
  ]);

  const rateByUserId = new Map<string, number>();
  for (const m of memberships) {
    rateByUserId.set(m.userId, Number(m.hourlyCostRate));
  }

  return {
    logs: logs.map((l) => {
      const tsStatus = l.timesheet?.status;
      const approvalStatus: "Approved" | "Pending" | "Rejected" =
        tsStatus === "APPROVED"
          ? "Approved"
          : tsStatus === "REJECTED"
            ? "Rejected"
            : "Pending";
      const memberRate = l.user?.id ? (rateByUserId.get(l.user.id) ?? 0) : 0;
      const hourlyRate = memberRate > 0 ? memberRate : 95;
      return {
        id: l.id,
        projectId: l.projectId,
        projectName: l.project.name,
        taskId: l.task?.id ?? l.taskId ?? null,
        taskTitle: l.task?.title ?? null,
        userName: l.user?.name ?? "Unknown",
        hours: Number(l.hours),
        billable: l.billable,
        loggedDate: toIsoDate(l.loggedDate),
        notes: l.notes,
        hourlyRate,
        currency: l.project.currency || ctx.organization.defaultCurrency,
        approvalStatus,
      };
    }),
    projects,
    tasks,
    defaultCurrency: ctx.organization.defaultCurrency,
  };
}

export async function createTimeLog(
  ctx: TenantContext,
  input: {
    projectId: string;
    taskId?: string | null;
    hours: number;
    billable: boolean;
    loggedDate: string;
    notes?: string | null;
  },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const organizationId = ctx.organization.id;

  const project = await db.project.findUnique({
    where: { id_organizationId: { id: input.projectId, organizationId } },
    select: { id: true },
  });
  if (!project) throw new ValidationError("Project not found.");

  await db.timeLog.create({
    data: {
      organizationId,
      projectId: project.id,
      taskId: input.taskId || null,
      userId: ctx.user.id,
      hours: new Prisma.Decimal(input.hours).toDecimalPlaces(2),
      billable: input.billable,
      loggedDate: startOfUtcDay(new Date(input.loggedDate)),
      notes: input.notes?.trim() || null,
    },
  });
}

export async function createMilestone(
  ctx: TenantContext,
  input: {
    projectId: string;
    name: string;
    description?: string | null;
    dueDate?: string | null;
  },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const organizationId = ctx.organization.id;

  const project = await db.project.findUnique({
    where: { id_organizationId: { id: input.projectId, organizationId } },
    select: { id: true },
  });
  if (!project) throw new ValidationError("Selected project not found.");

  const last = await db.milestone.findFirst({
    where: { organizationId, projectId: project.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await db.milestone.create({
    data: {
      organizationId,
      projectId: project.id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: MilestoneStatus.PENDING,
      dueDate: input.dueDate ? startOfUtcDay(new Date(`${input.dueDate}T00:00:00.000Z`)) : null,
      position: last ? last.position + 1 : 0,
    },
  });
}

export async function listCollaborationFeed(
  ctx: TenantContext,
  filter?: { entityType?: string; entityId?: string },
): Promise<{
  comments: CommentDTO[];
  projects: Array<{ id: string; name: string }>;
}> {
  authorize(ctx, "projects.project.read");
  const organizationId = ctx.organization.id;

  const [comments, projects] = await Promise.all([
    db.comment.findMany({
      where: {
        organizationId,
        ...(filter?.entityType ? { entityType: filter.entityType } : {}),
        ...(filter?.entityId ? { entityId: filter.entityId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    db.project.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  const projectNames = new Map(projects.map((p) => [p.id, p.name]));

  return {
    comments: comments.map((c) => ({
      id: c.id,
      entityType: c.entityType,
      entityId: c.entityId,
      entityLabel:
        c.entityType === "Project"
          ? (projectNames.get(c.entityId) ?? "Project")
          : `${c.entityType} #${c.entityId.slice(-6)}`,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      author: c.author,
    })),
    projects,
  };
}

export async function postComment(
  ctx: TenantContext,
  input: {
    entityType: "Project" | "Task" | "Issue" | "Deal" | "Workspace";
    entityId: string;
    body: string;
  },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  await db.comment.create({
    data: {
      organizationId: ctx.organization.id,
      authorId: ctx.user.id,
      entityType: input.entityType,
      entityId: input.entityId,
      body: input.body.trim(),
    },
  });
}

export async function updateCommentBody(
  ctx: TenantContext,
  commentId: string,
  body: string,
): Promise<void> {
  authorize(ctx, "projects.project.write");
  await db.comment.updateMany({
    where: { id: commentId, organizationId: ctx.organization.id },
    data: { body: body.trim() },
  });
}

export async function deleteCommentItem(
  ctx: TenantContext,
  commentId: string,
): Promise<void> {
  authorize(ctx, "projects.project.write");
  await db.comment.deleteMany({
    where: { id: commentId, organizationId: ctx.organization.id },
  });
}

export async function updateMilestoneStatus(
  ctx: TenantContext,
  milestoneId: string,
  status: MilestoneStatus,
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const updated = await db.milestone.updateMany({
    where: { id: milestoneId, organizationId: ctx.organization.id },
    data: { status },
  });
  if (updated.count === 0) {
    throw new NotFoundError("Phase / milestone not found.");
  }
}

export async function updateMilestoneDetails(
  ctx: TenantContext,
  input: {
    milestoneId: string;
    name?: string;
    description?: string | null;
    status?: MilestoneStatus;
    dueDate?: string | null;
  },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const updated = await db.milestone.updateMany({
    where: { id: input.milestoneId, organizationId: ctx.organization.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? startOfUtcDay(new Date(input.dueDate)) : null }
        : {}),
    },
  });
  if (updated.count === 0) {
    throw new NotFoundError("Phase / milestone not found.");
  }
}

export async function updateProject(
  ctx: TenantContext,
  input: {
    projectId: string;
    name: string;
    description?: string | null;
    status: ProjectStatus;
    ownerId?: string | null;
    groupId?: string | null;
    companyId?: string | null;
    startDate?: string | null;
    dueDate?: string | null;
    budget?: number | null;
    currency?: string;
    isStrict: boolean;
    isPublic: boolean;
    rollupEnabled: boolean;
    businessHours?: string;
    taskLayout?: string;
    enabledTabs: string[];
    tags: string[];
  },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const organizationId = ctx.organization.id;

  const existing = await db.project.findUnique({
    where: { id_organizationId: { id: input.projectId, organizationId } },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Project not found.");

  await db.$transaction(async (tx) => {
    await tx.project.update({
      where: { id_organizationId: { id: input.projectId, organizationId } },
      data: {
        name: input.name.trim(),
        description: input.description || null,
        status: input.status,
        ownerId: input.ownerId || null,
        groupId: input.groupId || null,
        companyId: input.companyId || null,
        startDate: input.startDate ? startOfUtcDay(new Date(`${input.startDate}T00:00:00.000Z`)) : null,
        dueDate: input.dueDate ? startOfUtcDay(new Date(`${input.dueDate}T00:00:00.000Z`)) : null,
        budget:
          input.budget !== undefined && input.budget !== null
            ? new Prisma.Decimal(input.budget).toDecimalPlaces(2)
            : null,
        currency: input.currency ?? ctx.organization.defaultCurrency,
        isStrict: input.isStrict,
        isPublic: input.isPublic,
        rollupEnabled: input.rollupEnabled,
        businessHours: input.businessHours || "Standard Business Hours",
        taskLayout: input.taskLayout || "Standard Layout",
        enabledTabs:
          input.enabledTabs.length > 0
            ? input.enabledTabs
            : ["Dashboard", "Tasks", "Users", "Phases", "Time Logs", "Finance", "Documents", "Bugs"],
        tags: input.tags,
      },
    });

    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Project",
      entityId: input.projectId,
      action: "project.updated",
      metadata: { name: input.name.trim(), status: input.status },
    });
  });
}

export async function getSingleProjectWorkspace(
  ctx: TenantContext,
  projectId: string,
): Promise<SingleProjectWorkspaceDTO | null> {
  authorize(ctx, "projects.project.read");
  const organizationId = ctx.organization.id;

  const project = await db.project.findUnique({
    where: { id_organizationId: { id: projectId, organizationId } },
    include: {
      group: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      company: { select: { id: true, name: true } },
      deal: {
        select: {
          id: true,
          title: true,
          amount: true,
          currency: true,
          status: true,
          invoices: {
            orderBy: { issueDate: "desc" },
            select: {
              id: true,
              number: true,
              status: true,
              issueDate: true,
              dueDate: true,
              total: true,
              amountPaid: true,
              currency: true,
            },
          },
        },
      },
      milestones: { orderBy: { position: "asc" } },
      tasks: {
        orderBy: [{ status: "asc" }, { position: "asc" }],
        include: {
          milestone: { select: { name: true } },
          assignee: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      issues: {
        orderBy: { createdAt: "desc" },
        include: {
          assignee: { select: { id: true, name: true } },
          reporter: { select: { id: true, name: true } },
        },
      },
      timeLogs: {
        orderBy: [{ loggedDate: "desc" }, { createdAt: "desc" }],
        include: {
          task: { select: { title: true } },
          user: { select: { id: true, name: true } },
        },
      },
      expenses: {
        orderBy: { expenseDate: "desc" },
      },
      expenseClaims: {
        orderBy: { expenseDate: "desc" },
      },
    },
  });

  if (!project) return null;

  const [allProjects, memberships, groups, companies, feed] = await Promise.all([
    db.project.findMany({
      where: { organizationId },
      orderBy: [{ isArchived: "asc" }, { name: "asc" }],
      select: { id: true, name: true, status: true },
    }),
    db.membership.findMany({
      where: { organizationId, isActive: true },
      orderBy: { user: { name: "asc" } },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
    db.projectGroup.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.company.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listCollaborationFeed(ctx, { entityType: "Project", entityId: project.id }),
  ]);

  const totalTasks = project.tasks.length;
  const doneTasks = project.tasks.filter((t) => t.status === TaskStatus.DONE).length;
  const completionPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      source: project.source,
      isStrict: project.isStrict,
      isPublic: project.isPublic,
      isArchived: project.isArchived,
      rollupEnabled: project.rollupEnabled,
      businessHours: project.businessHours,
      taskLayout: project.taskLayout,
      enabledTabs: project.enabledTabs,
      templateName: project.templateName,
      tags: project.tags,
      startDate: project.startDate ? toIsoDate(project.startDate) : null,
      dueDate: project.dueDate ? toIsoDate(project.dueDate) : null,
      budget: project.budget !== null ? Number(project.budget) : null,
      currency: project.currency,
      completionPercent,
      group: project.group,
      owner: project.owner,
      company: project.company,
      deal: project.deal
        ? {
            id: project.deal.id,
            title: project.deal.title,
            amount: Number(project.deal.amount),
            currency: project.deal.currency,
            status: project.deal.status,
          }
        : null,
    },
    allProjects,
    milestones: project.milestones.map((m) => {
      const mTasks = project.tasks.filter((t) => t.milestoneId === m.id);
      return {
        id: m.id,
        name: m.name,
        description: m.description,
        status: m.status,
        dueDate: m.dueDate ? toIsoDate(m.dueDate) : null,
        position: m.position,
        signoffStatus: m.signoffStatus,
        taskCount: mTasks.length,
        doneTaskCount: mTasks.filter((t) => t.status === TaskStatus.DONE).length,
      };
    }),
    tasks: project.tasks.map((t) => ({
      id: t.id,
      projectId: project.id,
      projectName: project.name,
      milestoneId: t.milestoneId,
      milestoneName: t.milestone?.name ?? null,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      position: t.position,
      dueDate: t.dueDate ? toIsoDate(t.dueDate) : null,
      assignee: t.assignee,
    })),
    issues: project.issues.map((i) => ({
      id: i.id,
      projectId: project.id,
      projectName: project.name,
      title: i.title,
      description: i.description,
      severity: i.severity,
      status: i.status,
      dueDate: i.dueDate ? toIsoDate(i.dueDate) : null,
      assignee: i.assignee,
      reporter: i.reporter,
      createdAt: i.createdAt.toISOString(),
    })),
    timeLogs: project.timeLogs.map((l) => ({
      id: l.id,
      projectId: project.id,
      projectName: project.name,
      taskTitle: l.task?.title ?? null,
      userName: l.user?.name ?? "Team Member",
      hours: Number(l.hours),
      billable: l.billable,
      loggedDate: toIsoDate(l.loggedDate),
      notes: l.notes,
    })),
    invoices: (project.deal?.invoices ?? []).map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.number,
      status: inv.status,
      issueDate: toIsoDate(inv.issueDate),
      dueDate: toIsoDate(inv.dueDate),
      total: Number(inv.total),
      balanceDue: Math.max(0, Number(inv.total) - Number(inv.amountPaid)),
      currency: inv.currency,
    })),
    expenses: [
      ...project.expenses.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        amount: Number(e.amount),
        currency: e.currency,
        billable: e.billable,
        expenseDate: toIsoDate(e.expenseDate),
        source: "FINANCE" as const,
        status: e.status,
      })),
      ...project.expenseClaims.map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        amount: Number(c.amount),
        currency: c.currency,
        billable: true,
        expenseDate: toIsoDate(c.expenseDate),
        source: "CLAIM" as const,
        status: c.status,
      })),
    ].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)),
    members: memberships.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      portalProfile: m.portalProfile,
      jobTitle: m.jobTitle,
      hourlyCostRate: Number(m.hourlyCostRate),
      assignedTaskCount: project.tasks.filter((t) => t.assigneeId === m.user.id).length,
      hoursLogged: project.timeLogs
        .filter((l) => l.user?.id === m.user.id)
        .reduce((sum, l) => sum + Number(l.hours), 0),
    })),
    groups,
    companies,
    comments: feed.comments,
  };
}
