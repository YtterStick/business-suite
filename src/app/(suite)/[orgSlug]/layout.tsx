import * as React from "react";
import { ApprovalStatus, TimesheetStatus } from "@prisma/client";

import { AppSwitcherSidebar } from "@/components/shell/app-switcher-sidebar";
import { GlobalTopBar, type TopBarNotificationItem } from "@/components/shell/global-top-bar";
import { SuiteBottomBar } from "@/components/shell/suite-bottom-bar";
import { toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { listUserOrganizations, requireTenant } from "@/server/tenancy";

interface SuiteLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
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
      title: "Deal-to-Project Automation",
      description: `${actorName} triggered automated provisioning (${log.action}).`,
      createdAt: log.createdAt.toISOString(),
      href: `/${orgSlug}/projects`,
      badgeLabel: "Automation",
    };
  }

  if (log.entityType === "Task" || log.action.startsWith("task.")) {
    const statusText = typeof meta?.status === "string" ? ` -> ${meta.status}` : "";
    const titleText = typeof meta?.title === "string" ? `"${meta.title}"` : "Task";
    return {
      id: `audit-${log.id}`,
      kind: "task",
      title: `${titleText} updated${statusText}`,
      description: `${actorName} performed ${log.action}.`,
      createdAt: log.createdAt.toISOString(),
      href: `/${orgSlug}/projects/tasks`,
      badgeLabel: "Task",
    };
  }

  if (log.entityType === "Project" || log.action.startsWith("project.")) {
    return {
      id: `audit-${log.id}`,
      kind: "automation",
      title: `Project activity (${log.action})`,
      description: `${actorName} updated a project record.`,
      createdAt: log.createdAt.toISOString(),
      href: `/${orgSlug}/projects`,
      badgeLabel: "Project",
    };
  }

  return null;
}

export default async function SuiteLayout({ children, params }: SuiteLayoutProps) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  const orgId = tenant.organization.id;

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
      where: { organizationId: orgId, isArchived: false },
      orderBy: { name: "asc" },
      take: 50,
      select: { id: true, name: true },
    }),
    db.contact.findMany({
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
      where: { organizationId: orgId },
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
    db.timesheet.findMany({
      where: { organizationId: orgId, status: TimesheetStatus.SUBMITTED },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } } },
    }),
    db.expenseClaim.findMany({
      where: { organizationId: orgId, status: ApprovalStatus.PENDING },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        submitter: { select: { name: true } },
        project: { select: { name: true } },
      },
    }),
    db.milestone.findMany({
      where: { organizationId: orgId, signoffStatus: ApprovalStatus.PENDING },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { project: { select: { name: true } } },
    }),
    db.membership.findMany({
      where: { organizationId: orgId },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const actorNameById = new Map(members.map((m) => [m.user.id, m.user.name]));

  const notifications: TopBarNotificationItem[] = [
    // @mentions & collaboration updates
    ...comments
      .filter((c) => c.body.includes("@"))
      .slice(0, 6)
      .map((c) => ({
        id: `mention-${c.id}`,
        kind: "mention" as const,
        title: `${c.author?.name ?? "Team Member"} mentioned someone`,
        description: c.body,
        createdAt: c.createdAt.toISOString(),
        href: `/${orgSlug}/projects/collaboration`,
        badgeLabel: "@Mention",
      })),
    // Approval requests (Timesheets, Expense Claims, Phase Sign-offs)
    ...submittedTimesheets.map((ts) => ({
      id: `ts-${ts.id}`,
      kind: "approval" as const,
      title: `Timesheet awaiting approval (${Number(ts.totalHours).toFixed(1)}h)`,
      description: `Submitted by ${ts.user.name} for week starting ${toIsoDate(ts.weekStartDate)}.`,
      createdAt: (ts.submittedAt ?? ts.createdAt).toISOString(),
      href: `/${orgSlug}/projects/approvals`,
      badgeLabel: "Approval",
    })),
    ...pendingExpenses.map((exp) => ({
      id: `exp-${exp.id}`,
      kind: "approval" as const,
      title: `Expense claim: ${exp.title}`,
      description: `${exp.submitter?.name ?? "Team Member"} requested ${exp.currency} ${Number(exp.amount).toLocaleString()} for ${exp.project.name}.`,
      createdAt: exp.createdAt.toISOString(),
      href: `/${orgSlug}/projects/approvals?tab=expenses`,
      badgeLabel: "Approval",
    })),
    ...pendingSignoffs.map((ms) => ({
      id: `ms-${ms.id}`,
      kind: "approval" as const,
      title: `Phase sign-off requested: ${ms.name}`,
      description: `${ms.project.name} phase deliverables ready for review.`,
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
    .slice(0, 15);

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
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-muted/20">
      {/* Desktop App Switcher Rail + Active Module Navigation */}
      <AppSwitcherSidebar
        orgSlug={orgSlug}
        activeOrg={activeOrg}
        role={tenant.role}
        organizations={organizations}
        user={userSummary}
        className="hidden md:flex"
      />

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <GlobalTopBar
          orgSlug={orgSlug}
          activeOrg={activeOrg}
          portalConfig={portalConfig}
          role={tenant.role}
          organizations={organizations}
          user={userSummary}
          notifications={notifications}
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
          recentChats={comments.map((c) => ({
            id: c.id,
            authorName: c.author?.name ?? "Team Member",
            body: c.body,
            createdAt: c.createdAt.toISOString(),
          }))}
          canWriteProjects={can(tenant.role, "projects.project.write")}
        />
      </div>
    </div>
  );
}
