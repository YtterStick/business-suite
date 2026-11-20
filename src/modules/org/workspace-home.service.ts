import "server-only";

import {
  ApprovalStatus,
  DealStatus,
  InvoiceStatus,
  IssueStatus,
  MilestoneStatus,
  ProjectStatus,
  TaskStatus,
  TimesheetStatus,
} from "@prisma/client";

import { addDays, startOfUtcDay, toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { addToTotals } from "@/lib/format";
import { can, ROLE_LABEL } from "@/lib/rbac";
import { authorize, type TenantContext } from "@/server/tenancy";

export interface WorkspaceHomeDTO {
  todayIso: string;
  defaultCurrency: string;
  openPipelineCount: number;
  openPipelineTotals: Record<string, number>;
  activeProjectsCount: number;
  upcomingMilestonesCount: number;
  pendingApprovalsCount: number;
  pendingTimesheetsCount: number;
  pendingExpensesCount: number;
  unpaidReceivablesCount: number;
  unpaidReceivablesTotals: Record<string, number>;
  overdueReceivablesTotals: Record<string, number>;
  workPulse: {
    tasks: { open: number; closed: number };
    issues: { open: number; closed: number };
    phases: { open: number; closed: number };
  };
  myTasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    priority: string;
    dueDate: string | null;
    projectId: string;
    projectName: string;
  }>;
  myIssues: Array<{
    id: string;
    title: string;
    severity: string;
    status: IssueStatus;
    dueDate: string | null;
    projectId: string;
    projectName: string;
  }>;
  myPhases: Array<{
    id: string;
    name: string;
    status: MilestoneStatus;
    dueDate: string | null;
    projectId: string;
    projectName: string;
  }>;
  connectedFlows: Array<{
    dealId: string;
    dealTitle: string;
    dealStatus: DealStatus;
    amount: number;
    currency: string;
    companyName: string | null;
    projectId: string | null;
    projectName: string | null;
    projectStatus: ProjectStatus | null;
    invoiceId: string | null;
    invoiceNumber: string | null;
    invoiceStatus: InvoiceStatus | null;
  }>;
  recentActivity: Array<{
    id: string;
    app: "CRM" | "Projects" | "Finance" | "Workspace";
    action: string;
    entityName: string | null;
    href: string | null;
    actorName: string;
    createdAt: string;
  }>;
  thisWeekTime: {
    weekStartIso: string;
    weekEndIso: string;
    totalHours: number;
    billableHours: number;
    status: TimesheetStatus;
    recentLogs: Array<{
      id: string;
      projectName: string;
      taskTitle: string | null;
      hours: number;
      billable: boolean;
      loggedDate: string;
      notes: string | null;
    }>;
  };
  teamWorkload: Array<{
    userId: string;
    name: string;
    role: string;
    openTasks: number;
    overdueTasks: number;
    openIssues: number;
    highIssues: number;
  }>;
  upcomingSchedule: Array<{
    id: string;
    kind: "Phase" | "Invoice" | "Deal";
    title: string;
    subtitle: string;
    dueDate: string;
    href: string;
  }>;
  onboarding: {
    hasClientOrDeal: boolean;
    hasWonDeal: boolean;
    hasTaskOrInvoice: boolean;
  };
}

const AUDIT_ACTION_MAP: Record<
  string,
  { app: "CRM" | "Projects" | "Finance" | "Workspace"; label: string }
> = {
  "project.auto_created_from_deal": {
    app: "Projects",
    label: "Project auto-created from deal",
  },
  "invoice.auto_created_from_deal": {
    app: "Finance",
    label: "Invoice auto-created from deal",
  },
  "contact.promoted_to_customer": {
    app: "CRM",
    label: "Contact promoted to customer",
  },
  "deal.stage_changed": { app: "CRM", label: "Deal stage updated" },
  "deal.created": { app: "CRM", label: "Deal created" },
  "deal.updated": { app: "CRM", label: "Deal updated" },
  "invoice.created_from_expenses": {
    app: "Finance",
    label: "Invoice generated from expenses",
  },
  "invoice.payment_recorded": {
    app: "Finance",
    label: "Invoice payment recorded",
  },
  "invoice.created": { app: "Finance", label: "Invoice created" },
  "invoice.sent": { app: "Finance", label: "Invoice sent to client" },
  "invoice.updated": { app: "Finance", label: "Invoice updated" },
  "project.created": { app: "Projects", label: "Project created" },
  "project.updated": { app: "Projects", label: "Project updated" },
  "project.cloned": { app: "Projects", label: "Project cloned" },
  "project.imported": { app: "Projects", label: "Projects imported from CSV" },
  "project.bulk_status_updated": {
    app: "Projects",
    label: "Projects updated in bulk",
  },
  "task.status_changed": { app: "Projects", label: "Task status updated" },
  "task.reopened": { app: "Projects", label: "Task reopened" },
  "task.archived": { app: "Projects", label: "Closed tasks archived" },
  "task.updated": { app: "Projects", label: "Task updated" },
  "task.quick_updated": { app: "Projects", label: "Task details updated" },
  "task.imported": { app: "Projects", label: "Tasks imported from CSV" },
  "task.created": { app: "Projects", label: "Task created" },
  "organization.portal_updated": {
    app: "Workspace",
    label: "Workspace settings updated",
  },
  "organization.created": { app: "Workspace", label: "Workspace created" },
  "org.member_invited": { app: "Workspace", label: "Team member invited" },
  "org.member_updated": {
    app: "Workspace",
    label: "Member permissions updated",
  },
  "org.invitation_accepted": {
    app: "Workspace",
    label: "Workspace invitation accepted",
  },
};

function formatAuditActionLabel(action: string, entityType: string): {
  app: "CRM" | "Projects" | "Finance" | "Workspace";
  label: string;
} {
  const normalized = action.trim().toLowerCase();
  const mapped = AUDIT_ACTION_MAP[normalized];
  if (mapped) {
    return mapped;
  }

  let app: "CRM" | "Projects" | "Finance" | "Workspace" = "Workspace";
  if (
    normalized.startsWith("deal.") ||
    normalized.startsWith("contact.") ||
    normalized.startsWith("company.") ||
    normalized.includes("deal")
  ) {
    app = "CRM";
  } else if (
    normalized.startsWith("invoice.") ||
    normalized.startsWith("payment.") ||
    normalized.startsWith("quote.") ||
    normalized.startsWith("expense.") ||
    normalized.includes("invoice")
  ) {
    app = "Finance";
  } else if (
    normalized.startsWith("project.") ||
    normalized.startsWith("task.") ||
    normalized.startsWith("milestone.") ||
    normalized.startsWith("issue.") ||
    normalized.startsWith("timesheet.") ||
    normalized.includes("project") ||
    normalized.includes("task")
  ) {
    app = "Projects";
  }

  const parts = normalized.split(".").filter(Boolean);
  const rawEntity = parts.length > 1 ? parts[0]! : entityType.replace(/[._]+/g, " ").trim().toLowerCase();
  const cleanEntity = rawEntity === "org" ? "workspace" : rawEntity;
  const rawVerb = (parts.length > 1 ? parts.slice(1).join(" ") : normalized)
    .replace(/auto[_\s]?created/g, "auto-created")
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const combined =
    cleanEntity && !rawVerb.includes(cleanEntity)
      ? `${cleanEntity} ${rawVerb}`.trim()
      : rawVerb || `${cleanEntity} updated`.trim();

  const sentenceCased = combined
    .replace(/\bcsv\b/gi, "CSV")
    .replace(/^([a-z])/, (ch) => ch.toUpperCase());

  return { app, label: sentenceCased };
}

export async function getWorkspaceHome(ctx: TenantContext): Promise<WorkspaceHomeDTO> {
  authorize(ctx, "projects.project.read");

  const organizationId = ctx.organization.id;
  const orgSlug = ctx.organization.slug;
  const now = new Date();
  const today = startOfUtcDay(now);
  const milestoneCutoff = startOfUtcDay(addDays(now, 14));
  const dow = today.getUTCDay();
  const weekStart = addDays(today, dow === 0 ? -6 : 1 - dow);
  const weekEnd = addDays(weekStart, 6);
  const canManageTeam = can(ctx, "projects.project.manage");

  const [
    openDeals,
    wonDealCount,
    activeProjectsCount,
    upcomingMilestonesCount,
    pendingTimesheetsCount,
    pendingExpensesCount,
    unpaidInvoices,
    myTasksRaw,
    myIssuesRaw,
    myPhasesRaw,
    openTasksCount,
    closedTasksCount,
    openIssuesCount,
    closedIssuesCount,
    openPhasesCount,
    closedPhasesCount,
    recentFlowsRaw,
    auditLogs,
    members,
    companyCount,
    totalTaskCount,
    totalInvoiceCount,
    weeklyTimeLogs,
    weeklyTimesheet,
    recentTimeLogsRaw,
    teamTasksRaw,
    teamIssuesRaw,
    upcomingScheduleInvoices,
    upcomingScheduleDeals,
  ] = await Promise.all([
    db.deal.findMany({
      where: { organizationId, status: DealStatus.OPEN },
      select: { amount: true, currency: true },
    }),
    db.deal.count({
      where: { organizationId, status: DealStatus.CLOSED_WON },
    }),
    db.project.count({
      where: { organizationId, isArchived: false, status: ProjectStatus.ACTIVE },
    }),
    db.milestone.count({
      where: {
        organizationId,
        status: { not: MilestoneStatus.COMPLETED },
        dueDate: { gte: today, lte: milestoneCutoff },
        project: { isArchived: false },
      },
    }),
    db.timesheet.count({
      where: { organizationId, status: TimesheetStatus.SUBMITTED },
    }),
    db.expenseClaim.count({
      where: { organizationId, status: ApprovalStatus.PENDING },
    }),
    db.invoice.findMany({
      where: {
        organizationId,
        status: { in: [InvoiceStatus.DRAFT, InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      select: { status: true, total: true, amountPaid: true, currency: true, dueDate: true },
    }),
    db.task.findMany({
      where: {
        organizationId,
        status: { not: TaskStatus.DONE },
        project: { isArchived: false },
        OR: [{ assigneeId: ctx.user.id }, { assigneeId: null }],
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
      take: 25,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
      },
    }),
    db.issue.findMany({
      where: {
        organizationId,
        status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] },
        project: { isArchived: false },
        OR: [{ assigneeId: ctx.user.id }, { assigneeId: null }],
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 15,
      select: {
        id: true,
        title: true,
        severity: true,
        status: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
      },
    }),
    db.milestone.findMany({
      where: {
        organizationId,
        status: { not: MilestoneStatus.COMPLETED },
        project: { isArchived: false },
      },
      orderBy: [{ dueDate: "asc" }, { position: "asc" }],
      take: 15,
      select: {
        id: true,
        name: true,
        status: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
      },
    }),
    db.task.count({
      where: { organizationId, status: { not: TaskStatus.DONE }, project: { isArchived: false } },
    }),
    db.task.count({
      where: { organizationId, status: TaskStatus.DONE, project: { isArchived: false } },
    }),
    db.issue.count({
      where: {
        organizationId,
        status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] },
        project: { isArchived: false },
      },
    }),
    db.issue.count({
      where: {
        organizationId,
        status: { in: [IssueStatus.RESOLVED, IssueStatus.CLOSED] },
        project: { isArchived: false },
      },
    }),
    db.milestone.count({
      where: {
        organizationId,
        status: { not: MilestoneStatus.COMPLETED },
        project: { isArchived: false },
      },
    }),
    db.milestone.count({
      where: {
        organizationId,
        status: MilestoneStatus.COMPLETED,
        project: { isArchived: false },
      },
    }),
    db.deal.findMany({
      where: { organizationId },
      orderBy: [{ updatedAt: "desc" }],
      take: 4,
      select: {
        id: true,
        title: true,
        status: true,
        amount: true,
        currency: true,
        company: { select: { name: true } },
        projects: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, status: true },
        },
        invoices: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { id: true, number: true, status: true },
        },
      },
    }),
    db.auditLog.findMany({
      where: { organizationId },
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
    db.membership.findMany({
      where: { organizationId, isActive: true },
      select: { role: true, user: { select: { id: true, name: true } } },
    }),
    db.company.count({ where: { organizationId } }),
    db.task.count({ where: { organizationId } }),
    db.invoice.count({ where: { organizationId } }),
    db.timeLog.findMany({
      where: {
        organizationId,
        userId: ctx.user.id,
        loggedDate: { gte: weekStart, lte: weekEnd },
      },
      select: { hours: true, billable: true },
    }),
    db.timesheet.findUnique({
      where: {
        organizationId_userId_weekStartDate: {
          organizationId,
          userId: ctx.user.id,
          weekStartDate: weekStart,
        },
      },
      select: { status: true },
    }),
    db.timeLog.findMany({
      where: { organizationId, userId: ctx.user.id },
      orderBy: [{ loggedDate: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        hours: true,
        billable: true,
        loggedDate: true,
        notes: true,
        project: { select: { name: true } },
        task: { select: { title: true } },
      },
    }),
    canManageTeam
      ? db.task.findMany({
          where: {
            organizationId,
            status: { not: TaskStatus.DONE },
            project: { isArchived: false },
            assigneeId: { not: null },
          },
          select: { assigneeId: true, dueDate: true },
        })
      : Promise.resolve([]),
    canManageTeam
      ? db.issue.findMany({
          where: {
            organizationId,
            status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] },
            project: { isArchived: false },
            assigneeId: { not: null },
          },
          select: { assigneeId: true, severity: true },
        })
      : Promise.resolve([]),
    db.invoice.findMany({
      where: {
        organizationId,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
        dueDate: { gte: today, lte: milestoneCutoff },
      },
      orderBy: { dueDate: "asc" },
      take: 6,
      select: {
        id: true,
        number: true,
        dueDate: true,
        company: { select: { name: true } },
      },
    }),
    db.deal.findMany({
      where: {
        organizationId,
        status: DealStatus.OPEN,
        expectedCloseDate: { gte: today, lte: milestoneCutoff },
      },
      orderBy: { expectedCloseDate: "asc" },
      take: 6,
      select: {
        id: true,
        title: true,
        expectedCloseDate: true,
        company: { select: { name: true } },
      },
    }),
  ]);

  const openPipelineTotals: Record<string, number> = {};
  for (const d of openDeals) {
    addToTotals(openPipelineTotals, d.currency, Number(d.amount));
  }

  const unpaidReceivablesTotals: Record<string, number> = {};
  const overdueReceivablesTotals: Record<string, number> = {};
  const todayIso = toIsoDate(today);
  let unpaidReceivablesCount = 0;

  for (const inv of unpaidInvoices) {
    const balance = Math.max(0, Number(inv.total) - Number(inv.amountPaid));
    if (inv.status === InvoiceStatus.DRAFT || balance <= 0) continue;
    unpaidReceivablesCount += 1;
    addToTotals(unpaidReceivablesTotals, inv.currency, balance);
    const dueIso = toIsoDate(inv.dueDate);
    if (inv.status === InvoiceStatus.OVERDUE || dueIso < todayIso) {
      addToTotals(overdueReceivablesTotals, inv.currency, balance);
    }
  }

  const actorMap = new Map(members.map((m) => [m.user.id, m.user.name]));

  const projectIds = new Set<string>();
  const taskIds = new Set<string>();
  const dealIds = new Set<string>();
  const invoiceIds = new Set<string>();
  const companyIds = new Set<string>();
  const contactIds = new Set<string>();

  for (const log of auditLogs) {
    if (!log.entityId) continue;
    const et = log.entityType.toLowerCase();
    if (et === "project" || log.action.startsWith("project.")) projectIds.add(log.entityId);
    else if (et === "task" || log.action.startsWith("task.")) taskIds.add(log.entityId);
    else if (et === "deal" || log.action.startsWith("deal.")) dealIds.add(log.entityId);
    else if (et === "invoice" || log.action.startsWith("invoice.")) invoiceIds.add(log.entityId);
    else if (et === "company" || log.action.startsWith("company.")) companyIds.add(log.entityId);
    else if (et === "contact" || log.action.startsWith("contact.")) contactIds.add(log.entityId);
  }

  const [projectsRef, tasksRef, dealsRef, invoicesRef, companiesRef, contactsRef] =
    await Promise.all([
      projectIds.size > 0
        ? db.project.findMany({
            where: { organizationId, id: { in: [...projectIds] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      taskIds.size > 0
        ? db.task.findMany({
            where: { organizationId, id: { in: [...taskIds] } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      dealIds.size > 0
        ? db.deal.findMany({
            where: { organizationId, id: { in: [...dealIds] } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      invoiceIds.size > 0
        ? db.invoice.findMany({
            where: { organizationId, id: { in: [...invoiceIds] } },
            select: { id: true, number: true },
          })
        : Promise.resolve([]),
      companyIds.size > 0
        ? db.company.findMany({
            where: { organizationId, id: { in: [...companyIds] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      contactIds.size > 0
        ? db.contact.findMany({
            where: { organizationId, id: { in: [...contactIds] } },
            select: { id: true, firstName: true, lastName: true },
          })
        : Promise.resolve([]),
    ]);

  const projectMap = new Map(projectsRef.map((p) => [p.id, p.name]));
  const taskMap = new Map(tasksRef.map((t) => [t.id, t.title]));
  const dealMap = new Map(dealsRef.map((d) => [d.id, d.title]));
  const invoiceMap = new Map(invoicesRef.map((i) => [i.id, i.number]));
  const companyMap = new Map(companiesRef.map((c) => [c.id, c.name]));
  const contactMap = new Map(
    contactsRef.map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()]),
  );

  let weeklyTotalHours = 0;
  let weeklyBillableHours = 0;
  for (const log of weeklyTimeLogs) {
    const h = Number(log.hours);
    weeklyTotalHours += h;
    if (log.billable) weeklyBillableHours += h;
  }
  weeklyTotalHours = Math.round(weeklyTotalHours * 100) / 100;
  weeklyBillableHours = Math.round(weeklyBillableHours * 100) / 100;

  const workloadMap = new Map(
    members.map((m) => [
      m.user.id,
      {
        userId: m.user.id,
        name: m.user.name,
        role: ROLE_LABEL[m.role],
        openTasks: 0,
        overdueTasks: 0,
        openIssues: 0,
        highIssues: 0,
      },
    ]),
  );
  for (const t of teamTasksRaw) {
    if (!t.assigneeId) continue;
    const entry = workloadMap.get(t.assigneeId);
    if (!entry) continue;
    entry.openTasks += 1;
    if (t.dueDate && toIsoDate(t.dueDate) < todayIso) {
      entry.overdueTasks += 1;
    }
  }
  for (const i of teamIssuesRaw) {
    if (!i.assigneeId) continue;
    const entry = workloadMap.get(i.assigneeId);
    if (!entry) continue;
    entry.openIssues += 1;
    if (i.severity === "HIGH" || i.severity === "CRITICAL") {
      entry.highIssues += 1;
    }
  }
  const teamWorkload = [...workloadMap.values()].sort(
    (a, b) => b.openTasks + b.openIssues - (a.openTasks + a.openIssues),
  );

  const upcomingCutoffIso = toIsoDate(milestoneCutoff);
  const upcomingSchedule: WorkspaceHomeDTO["upcomingSchedule"] = [
    ...myPhasesRaw
      .filter((p) => {
        if (!p.dueDate) return false;
        const iso = toIsoDate(p.dueDate);
        return iso >= todayIso && iso <= upcomingCutoffIso;
      })
      .map((p) => ({
        id: `phase-${p.id}`,
        kind: "Phase" as const,
        title: p.name,
        subtitle: p.project.name,
        dueDate: toIsoDate(p.dueDate!),
        href: `/${orgSlug}/projects/${p.project.id}`,
      })),
    ...upcomingScheduleInvoices.map((inv) => ({
      id: `inv-${inv.id}`,
      kind: "Invoice" as const,
      title: inv.number,
      subtitle: inv.company?.name ?? "Invoice due",
      dueDate: toIsoDate(inv.dueDate),
      href: `/${orgSlug}/finance/invoices?highlight=${inv.id}`,
    })),
    ...upcomingScheduleDeals
      .filter((d) => d.expectedCloseDate !== null)
      .map((d) => ({
        id: `deal-${d.id}`,
        kind: "Deal" as const,
        title: d.title,
        subtitle: d.company?.name ?? "Expected close",
        dueDate: toIsoDate(d.expectedCloseDate!),
        href: `/${orgSlug}/crm/deals`,
      })),
  ]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 10);

  return {
    todayIso,
    defaultCurrency: ctx.organization.defaultCurrency,
    openPipelineCount: openDeals.length,
    openPipelineTotals,
    activeProjectsCount,
    upcomingMilestonesCount,
    pendingApprovalsCount: pendingTimesheetsCount + pendingExpensesCount,
    pendingTimesheetsCount,
    pendingExpensesCount,
    unpaidReceivablesCount,
    unpaidReceivablesTotals,
    overdueReceivablesTotals,
    workPulse: {
      tasks: { open: openTasksCount, closed: closedTasksCount },
      issues: { open: openIssuesCount, closed: closedIssuesCount },
      phases: { open: openPhasesCount, closed: closedPhasesCount },
    },
    myTasks: myTasksRaw.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ? toIsoDate(t.dueDate) : null,
      projectId: t.project.id,
      projectName: t.project.name,
    })),
    myIssues: myIssuesRaw.map((i) => ({
      id: i.id,
      title: i.title,
      severity: i.severity,
      status: i.status,
      dueDate: i.dueDate ? toIsoDate(i.dueDate) : null,
      projectId: i.project.id,
      projectName: i.project.name,
    })),
    myPhases: myPhasesRaw.map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      dueDate: m.dueDate ? toIsoDate(m.dueDate) : null,
      projectId: m.project.id,
      projectName: m.project.name,
    })),
    connectedFlows: recentFlowsRaw.map((d) => ({
      dealId: d.id,
      dealTitle: d.title,
      dealStatus: d.status,
      amount: Number(d.amount),
      currency: d.currency,
      companyName: d.company?.name ?? null,
      projectId: d.projects[0]?.id ?? null,
      projectName: d.projects[0]?.name ?? null,
      projectStatus: d.projects[0]?.status ?? null,
      invoiceId: d.invoices[0]?.id ?? null,
      invoiceNumber: d.invoices[0]?.number ?? null,
      invoiceStatus: d.invoices[0]?.status ?? null,
    })),
    recentActivity: auditLogs.map((log) => {
      const info = formatAuditActionLabel(log.action, log.entityType);
      const meta =
        log.metadata && typeof log.metadata === "object"
          ? (log.metadata as Record<string, unknown>)
          : null;
      const metaStr = (keys: string[]): string | null => {
        if (!meta) return null;
        for (const k of keys) {
          const val = meta[k];
          if (typeof val === "string" && val.trim()) return val.trim();
        }
        return null;
      };

      const et = log.entityType.toLowerCase();
      let entityName: string | null = null;
      let href: string | null = null;

      if (et === "project" || log.action.startsWith("project.")) {
        entityName =
          projectMap.get(log.entityId) ?? metaStr(["projectName", "name", "title"]);
        href = projectMap.has(log.entityId)
          ? `/${orgSlug}/projects/${log.entityId}`
          : `/${orgSlug}/projects`;
      } else if (et === "task" || log.action.startsWith("task.")) {
        const rawTitle = taskMap.get(log.entityId) ?? metaStr(["title", "name"]);
        const taskKey = metaStr(["taskKey"]);
        entityName = rawTitle && taskKey ? `${taskKey} ${rawTitle}` : rawTitle;
        href = taskMap.has(log.entityId)
          ? `/${orgSlug}/projects/tasks?taskId=${log.entityId}`
          : `/${orgSlug}/projects/tasks`;
      } else if (et === "deal" || log.action.startsWith("deal.")) {
        entityName = dealMap.get(log.entityId) ?? metaStr(["dealTitle", "title", "name"]);
        href = `/${orgSlug}/crm/deals`;
      } else if (et === "invoice" || log.action.startsWith("invoice.")) {
        entityName =
          invoiceMap.get(log.entityId) ?? metaStr(["invoiceNumber", "number", "title"]);
        href = invoiceMap.has(log.entityId)
          ? `/${orgSlug}/finance/invoices?highlight=${log.entityId}`
          : `/${orgSlug}/finance/invoices`;
      } else if (et === "company" || log.action.startsWith("company.")) {
        entityName = companyMap.get(log.entityId) ?? metaStr(["name", "companyName"]);
        href = `/${orgSlug}/crm/companies`;
      } else if (et === "contact" || log.action.startsWith("contact.")) {
        entityName = contactMap.get(log.entityId) ?? metaStr(["name", "email"]);
        href = `/${orgSlug}/crm/contacts`;
      } else if (
        et === "organization" ||
        et === "membership" ||
        et === "invitation" ||
        et === "workspace" ||
        log.action.startsWith("org.")
      ) {
        entityName = metaStr(["email", "name"]) ?? ctx.organization.name;
        href = `/${orgSlug}/projects/users`;
      }

      return {
        id: log.id,
        app: info.app,
        action: info.label,
        entityName,
        href,
        actorName: log.actorId ? (actorMap.get(log.actorId) ?? "Team Member") : "System",
        createdAt: log.createdAt.toISOString(),
      };
    }),
    thisWeekTime: {
      weekStartIso: toIsoDate(weekStart),
      weekEndIso: toIsoDate(weekEnd),
      totalHours: weeklyTotalHours,
      billableHours: weeklyBillableHours,
      status: weeklyTimesheet?.status ?? TimesheetStatus.DRAFT,
      recentLogs: recentTimeLogsRaw.map((l) => ({
        id: l.id,
        projectName: l.project.name,
        taskTitle: l.task?.title ?? null,
        hours: Number(l.hours),
        billable: l.billable,
        loggedDate: toIsoDate(l.loggedDate),
        notes: l.notes ?? null,
      })),
    },
    teamWorkload,
    upcomingSchedule,
    onboarding: {
      hasClientOrDeal: companyCount > 0 || recentFlowsRaw.length > 0,
      hasWonDeal: wonDealCount > 0,
      hasTaskOrInvoice: totalTaskCount > 0 || totalInvoiceCount > 0,
    },
  };
}
