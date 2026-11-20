import * as React from "react";
import { ApprovalStatus, TaskStatus, TimesheetStatus } from "@prisma/client";

import { AppSwitcherSidebar } from "@/components/shell/app-switcher-sidebar";
import { GlobalTopBar, type TopBarNotificationItem } from "@/components/shell/global-top-bar";
import { SuiteBottomBar } from "@/components/shell/suite-bottom-bar";
import { startOfUtcDay, toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { can, isClientUser } from "@/lib/rbac";
import { getClientAccessibleProjectIds } from "@/modules/projects/projects.service";
import { listUserOrganizations, requireTenant } from "@/server/tenancy";

interface SuiteLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

function projectCodePrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
  }
  return (name.slice(0, 2) || "PR").toUpperCase();
}

function formatAuditNotification(
  log: {
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    metadata: unknown;
    createdAt: Date;
  },
  actorName: string,
  orgSlug: string,
): TopBarNotificationItem | null {
  const meta =
    log.metadata && typeof log.metadata === "object"
      ? (log.metadata as Record<string, unknown>)
      : null;

  if (log.action.includes("deal_won") || log.action.includes("automation")) {
    return {
      id: `audit-${log.id}`,
      kind: "automation",
      actorName,
      title: "Deal-to-Project Automation",
      description: `${actorName} triggered automated provisioning (${log.action}).`,
      entityKey: "AUTO",
      projectName: typeof meta?.projectName === "string" ? meta.projectName : null,
      createdAt: log.createdAt.toISOString(),
      href: `/${orgSlug}/projects`,
      badgeLabel: "Automation",
    };
  }

  if (log.entityType === "Task" || log.action.startsWith("task.")) {
    const statusText = typeof meta?.status === "string" ? ` -> ${meta.status}` : "";
    const titleText = typeof meta?.title === "string" ? `${meta.title}` : "Task updated";
    return {
      id: `audit-${log.id}`,
      kind: "assignment",
      actorName,
      title: `${actorName} updated task ${titleText}${statusText}`,
      description: `Activity logged via ${log.action}`,
      entityKey: `T-${log.entityId.slice(-3).toUpperCase()}`,
      projectName: typeof meta?.projectName === "string" ? meta.projectName : null,
      createdAt: log.createdAt.toISOString(),
      href: `/${orgSlug}/projects/tasks?taskId=${log.entityId}`,
      badgeLabel: "Task",
    };
  }

  if (log.entityType === "Project" || log.action.startsWith("project.")) {
    return {
      id: `audit-${log.id}`,
      kind: "assignment",
      actorName,
      title: `${actorName} updated project workspace`,
      description: `Action: ${log.action}`,
      entityKey: "PRJ",
      projectName: typeof meta?.name === "string" ? meta.name : null,
      createdAt: log.createdAt.toISOString(),
      href: `/${orgSlug}/projects/${log.entityId}`,
      badgeLabel: "Project",
    };
  }

  return null;
}

export default async function SuiteLayout({ children, params }: SuiteLayoutProps) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  const orgId = tenant.organization.id;
  const todayStart = startOfUtcDay(new Date());
  const clientIds = await getClientAccessibleProjectIds(tenant);
  const isClient = isClientUser(tenant);
  const clientProjFilter = clientIds ? { id: { in: Array.from(clientIds) } } : {};
  const clientProjRelFilter = clientIds ? { projectId: { in: Array.from(clientIds) } } : {};

  const [
    orgDetails,
    organizations,
    projects,
    contacts,
    comments,
    auditLogs,
    submittedTimesheets,
    pendingExpenses,
    pendingSignoffs,
    overdueTasks,
    assignedTasks,
    members,
  ] = await Promise.all([
    db.organization.findUnique({
      where: { id: orgId },
      select: {
        invoicePrefix: true,
        quotePrefix: true,
        defaultPaymentTermsDays: true,
      },
    }),
    listUserOrganizations(tenant.user.id),
    db.project.findMany({
      where: { organizationId: orgId, isArchived: false, ...clientProjFilter },
      orderBy: { name: "asc" },
      take: 50,
      select: { id: true, name: true },
    }),
    isClient
      ? Promise.resolve([])
      : db.contact.findMany({
          where: { organizationId: orgId },
          orderBy: { updatedAt: "desc" },
          take: 25,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            lifecycleStage: true,
            company: { select: { name: true } },
          },
        }),
    db.comment.findMany({
      where: {
        organizationId: orgId,
        ...(clientIds
          ? {
              OR: [
                { entityType: "Workspace" },
                { entityType: "Project", entityId: { in: Array.from(clientIds) } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { author: { select: { name: true } } },
    }),
    db.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        actorId: true,
        entityType: true,
        entityId: true,
        action: true,
        metadata: true,
        createdAt: true,
      },
    }),
    isClient
      ? Promise.resolve([])
      : db.timesheet.findMany({
          where: { organizationId: orgId, status: TimesheetStatus.SUBMITTED },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { user: { select: { name: true } } },
        }),
    isClient
      ? Promise.resolve([])
      : db.expenseClaim.findMany({
          where: { organizationId: orgId, status: ApprovalStatus.PENDING },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            submitter: { select: { name: true } },
            project: { select: { name: true } },
          },
        }),
    isClient
      ? Promise.resolve([])
      : db.milestone.findMany({
          where: { organizationId: orgId, signoffStatus: ApprovalStatus.PENDING },
          orderBy: { updatedAt: "desc" },
          take: 5,
          include: { project: { select: { name: true } } },
        }),
    db.task.findMany({
      where: {
        organizationId: orgId,
        status: { not: TaskStatus.DONE },
        dueDate: { lt: todayStart },
        ...clientProjRelFilter,
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      include: {
        project: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    }),
    db.task.findMany({
      where: {
        organizationId: orgId,
        assigneeId: { not: null },
        ...clientProjRelFilter,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        project: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    }),
    db.membership.findMany({
      where: { organizationId: orgId },
      select: { jobTitle: true, user: { select: { id: true, name: true } } },
    }),
  ]);

  const actorNameById = new Map(members.map((m) => [m.user.id, m.user.name]));
  const projectNameMap = new Map(projects.map((p) => [p.id, p.name]));

  const notifications: TopBarNotificationItem[] = [
    // @mentions & collaboration updates
    ...comments
      .filter((c) => c.body.includes("@"))
      .slice(0, 6)
      .map((c) => ({
        id: `mention-${c.id}`,
        kind: "mention" as const,
        actorName: c.author?.name ?? "Team Member",
        title: `${c.author?.name ?? "Team Member"} mentioned someone`,
        description: c.body,
        entityKey: c.entityType === "Task" ? `T-${c.entityId.slice(-3).toUpperCase()}` : "FEED",
        projectName:
          c.entityType === "Project" ? (projectNameMap.get(c.entityId) ?? null) : null,
        createdAt: c.createdAt.toISOString(),
        href: `/${orgSlug}/projects/collaboration`,
        badgeLabel: "@Mention",
      })),
    // Overdue tasks
    ...overdueTasks.map((t, idx) => ({
      id: `overdue-${t.id}`,
      kind: "overdue" as const,
      actorName: t.assignee?.name ?? tenant.user.name,
      title: `Overdue: ${t.title}`,
      description: `Due ${t.dueDate ? toIsoDate(t.dueDate) : "past due"} · Assigned to ${t.assignee?.name ?? "Unassigned"}`,
      entityKey: `${projectCodePrefix(t.project.name)}-T${idx + 1}`,
      projectName: t.project.name,
      createdAt: (t.dueDate ?? t.updatedAt).toISOString(),
      href: `/${orgSlug}/projects/tasks?taskId=${t.id}`,
      badgeLabel: "Overdue",
    })),
    // Recent task assignments
    ...assignedTasks.map((t, idx) => ({
      id: `assign-${t.id}`,
      kind: "assignment" as const,
      actorName: t.assignee?.name ?? "Team Member",
      title: `${t.assignee?.name ?? "Member"} assigned to ${t.title}`,
      description: `Status: ${t.status.replace("_", " ")} · Priority: ${t.priority}`,
      entityKey: `${projectCodePrefix(t.project.name)}-T${idx + 1}`,
      projectName: t.project.name,
      createdAt: t.updatedAt.toISOString(),
      href: `/${orgSlug}/projects/tasks?taskId=${t.id}`,
      badgeLabel: "Assigned",
    })),
    // Approval requests (Timesheets, Expense Claims, Phase Sign-offs)
    ...submittedTimesheets.map((ts) => ({
      id: `ts-${ts.id}`,
      kind: "approval" as const,
      actorName: ts.user.name,
      title: `Timesheet awaiting approval (${Number(ts.totalHours).toFixed(1)}h)`,
      description: `Submitted by ${ts.user.name} for week starting ${toIsoDate(ts.weekStartDate)}.`,
      entityKey: `TS-${toIsoDate(ts.weekStartDate).slice(5)}`,
      projectName: null,
      createdAt: (ts.submittedAt ?? ts.createdAt).toISOString(),
      href: `/${orgSlug}/projects/approvals`,
      badgeLabel: "Approval",
    })),
    ...pendingExpenses.map((exp) => ({
      id: `exp-${exp.id}`,
      kind: "approval" as const,
      actorName: exp.submitter?.name ?? "Team Member",
      title: `Expense claim: ${exp.title}`,
      description: `${exp.submitter?.name ?? "Team Member"} requested ${exp.currency} ${Number(exp.amount).toLocaleString()} for ${exp.project.name}.`,
      entityKey: "EXP",
      projectName: exp.project.name,
      createdAt: exp.createdAt.toISOString(),
      href: `/${orgSlug}/projects/approvals?tab=expenses`,
      badgeLabel: "Approval",
    })),
    ...pendingSignoffs.map((ms, idx) => ({
      id: `ms-${ms.id}`,
      kind: "approval" as const,
      actorName: tenant.user.name,
      title: `Phase sign-off requested: ${ms.name}`,
      description: `${ms.project.name} phase deliverables ready for review.`,
      entityKey: `PH-${idx + 1}`,
      projectName: ms.project.name,
      createdAt: (ms.signoffRequestedAt ?? ms.updatedAt).toISOString(),
      href: `/${orgSlug}/projects/approvals`,
      badgeLabel: "Sign-off",
    })),
    // Task status changes & deal-to-project automations from audit log
    ...auditLogs
      .map((log) =>
        formatAuditNotification(
          log,
          (log.actorId && actorNameById.get(log.actorId)) || "System",
          orgSlug,
        ),
      )
      .filter((item): item is TopBarNotificationItem => item !== null)
      .slice(0, 8),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 25);

  const activeOrg = {
    id: orgId,
    name: tenant.organization.name,
    slug: tenant.organization.slug,
  };

  const portalConfig = {
    name: tenant.organization.name,
    slug: tenant.organization.slug,
    defaultCurrency: tenant.organization.defaultCurrency,
    timezone: tenant.organization.timezone,
    invoicePrefix: orgDetails?.invoicePrefix ?? "INV-",
    quotePrefix: orgDetails?.quotePrefix ?? "QT-",
    defaultPaymentTermsDays: orgDetails?.defaultPaymentTermsDays ?? 30,
  };

  const userSummary = {
    id: tenant.user.id,
    name: tenant.user.name,
    email: tenant.user.email,
    avatarUrl: tenant.user.avatarUrl,
    jobTitle: members.find((m) => m.user.id === tenant.user.id)?.jobTitle ?? null,
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-muted/20">
      {/* Desktop App Switcher Rail + Active Module Navigation */}
      <AppSwitcherSidebar
        orgSlug={orgSlug}
        activeOrg={activeOrg}
        role={tenant.role}
        portalProfile={tenant.portalProfile}
        userType={tenant.userType}
        organizations={organizations}
        user={userSummary}
        recentProjects={projects}
        className="hidden md:flex"
      />

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <GlobalTopBar
          orgSlug={orgSlug}
          activeOrg={activeOrg}
          portalConfig={portalConfig}
          role={tenant.role}
          portalProfile={tenant.portalProfile}
          userType={tenant.userType}
          organizations={organizations}
          user={userSummary}
          notifications={notifications}
          recentProjects={projects}
        />
        <main className="flex-1 overflow-auto">{children}</main>
        <SuiteBottomBar
          orgSlug={orgSlug}
          todayIso={toIsoDate(new Date())}
          projects={projects}
          contacts={contacts.map((c) => ({
            id: c.id,
            fullName: `${c.firstName} ${c.lastName}`.trim(),
            email: c.email,
            companyName: c.company?.name ?? null,
            lifecycleStage: c.lifecycleStage,
          }))}
          recentChats={comments
            .filter(
              (c) =>
                !c.body.startsWith("[WIKI]|") &&
                !c.body.startsWith("[FORUM]|") &&
                !c.body.startsWith("[REPLY]|") &&
                !c.body.startsWith("[FDOC]|") &&
                !c.body.startsWith("[FEED_REPLY]|") &&
                !c.body.startsWith("[SUBTASK]|") &&
                !c.body.startsWith("[DEP]|") &&
                !c.body.startsWith("[ATTACH]|"),
            )
            .map((c) => ({
              id: c.id,
              authorName: c.author?.name ?? "Team Member",
              body: c.body,
              createdAt: c.createdAt.toISOString(),
              projectId: c.entityType === "Project" ? c.entityId : "workspace",
              projectName:
                c.entityType === "Project"
                  ? (projectNameMap.get(c.entityId) ?? "Project")
                  : "General Workspace",
            }))}
          currentUserName={tenant.user.name}
          canWriteProjects={can(tenant, "projects.comment.write")}
          canLogTime={can(tenant, "projects.project.write")}
          canViewContacts={can(tenant, "crm.contact.read")}
        />
      </div>
    </div>
  );
}
