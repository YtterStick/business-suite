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
    actorName: string;
    createdAt: string;
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
  const now = new Date();
  const today = startOfUtcDay(now);
  const milestoneCutoff = startOfUtcDay(addDays(now, 14));

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
    recentFlowsRaw,
    auditLogs,
    members,
    companyCount,
    totalTaskCount,
    totalInvoiceCount,
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
      take: 12,
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
      orderBy: [{ createdAt: "desc" }],
      take: 4,
      select: {
        id: true,
        title: true,
        severity: true,
        status: true,
        project: { select: { id: true, name: true } },
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
      select: { id: true, actorId: true, entityType: true, action: true, createdAt: true },
    }),
    db.membership.findMany({
      where: { organizationId },
      select: { user: { select: { id: true, name: true } } },
    }),
    db.company.count({ where: { organizationId } }),
    db.task.count({ where: { organizationId } }),
    db.invoice.count({ where: { organizationId } }),
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
      projectId: i.project.id,
      projectName: i.project.name,
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
      return {
        id: log.id,
        app: info.app,
        action: info.label,
        actorName: log.actorId ? (actorMap.get(log.actorId) ?? "Team Member") : "System",
        createdAt: log.createdAt.toISOString(),
      };
    }),
    onboarding: {
      hasClientOrDeal: companyCount > 0 || recentFlowsRaw.length > 0,
      hasWonDeal: wonDealCount > 0,
      hasTaskOrInvoice: totalTaskCount > 0 || totalInvoiceCount > 0,
    },
  };
}
