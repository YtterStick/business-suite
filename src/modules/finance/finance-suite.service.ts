import "server-only";

import {
  ApprovalStatus,
  ExpenseStatus,
  InvoiceStatus,
  Prisma,
  RecordSource,
  SequenceKind,
} from "@prisma/client";

import { addDays, startOfUtcDay, toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { addToTotals } from "@/lib/format";
import { computeLineItemsAndTotals } from "@/modules/finance/invoice-totals";
import { allocateDocumentNumber } from "@/modules/finance/sequences.service";
import { recordAudit } from "@/server/audit";
import { authorize, type TenantContext } from "@/server/tenancy";

// ═══════════════════════════════ Dashboard ══════════════════════════════════

export interface FinanceDashboardDTO {
  defaultCurrency: string;
  receivablesByCurrency: Record<string, number>;
  overdueReceivablesByCurrency: Record<string, number>;
  payablesByCurrency: Record<string, number>;
  collectedByCurrency: Record<string, number>;
  expensesTotalByCurrency: Record<string, number>;
  cashFlow: Array<{
    monthKey: string;
    label: string;
    inflow: number;
    outflow: number;
  }>;
  recentActivity: Array<{
    id: string;
    kind: "invoice" | "payment" | "expense";
    title: string;
    subtitle: string;
    amount: number;
    currency: string;
    dateIso: string;
    badge: string;
  }>;
}

export async function getFinanceDashboard(ctx: TenantContext): Promise<FinanceDashboardDTO> {
  authorize(ctx, "finance.invoice.read");
  const organizationId = ctx.organization.id;
  const todayIso = toIsoDate(startOfUtcDay(new Date()));

  const [invoices, payments, expenses, expenseClaims] = await Promise.all([
    db.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { company: { select: { name: true } } },
    }),
    db.payment.findMany({
      where: { organizationId },
      orderBy: { paidAt: "desc" },
      include: { invoice: { select: { number: true, currency: true, company: { select: { name: true } } } } },
    }),
    db.expense.findMany({
      where: { organizationId },
      orderBy: { expenseDate: "desc" },
      include: { project: { select: { name: true } }, company: { select: { name: true } } },
    }),
    db.expenseClaim.findMany({
      where: { organizationId, status: { in: [ApprovalStatus.PENDING, ApprovalStatus.APPROVED] } },
      select: { amount: true, currency: true, status: true, expenseDate: true },
    }),
  ]);

  const receivablesByCurrency: Record<string, number> = {};
  const overdueReceivablesByCurrency: Record<string, number> = {};
  const payablesByCurrency: Record<string, number> = {};
  const collectedByCurrency: Record<string, number> = {};
  const expensesTotalByCurrency: Record<string, number> = {};

  for (const inv of invoices) {
    if (inv.status === InvoiceStatus.DRAFT || inv.status === InvoiceStatus.VOID || inv.status === InvoiceStatus.PAID) {
      continue;
    }
    const bal = Math.max(0, Number(inv.total) - Number(inv.amountPaid));
    if (bal <= 0) continue;
    addToTotals(receivablesByCurrency, inv.currency, bal);
    if (toIsoDate(inv.dueDate) < todayIso || inv.status === InvoiceStatus.OVERDUE) {
      addToTotals(overdueReceivablesByCurrency, inv.currency, bal);
    }
  }

  for (const pay of payments) {
    addToTotals(collectedByCurrency, pay.invoice.currency, Number(pay.amount));
  }

  for (const exp of expenses) {
    const amt = Number(exp.amount);
    addToTotals(expensesTotalByCurrency, exp.currency, amt);
    if (exp.status !== ExpenseStatus.PAID) {
      addToTotals(payablesByCurrency, exp.currency, amt);
    }
  }

  for (const claim of expenseClaims) {
    const amt = Number(claim.amount);
    addToTotals(expensesTotalByCurrency, claim.currency, amt);
    if (claim.status === ApprovalStatus.PENDING) {
      addToTotals(payablesByCurrency, claim.currency, amt);
    }
  }

  // 6-month rolling cash flow (UTC month buckets)
  const now = new Date();
  const monthBuckets = Array.from({ length: 6 }, (_, idx) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - idx), 1));
    const monthKey = d.toISOString().slice(0, 7);
    const label = new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }).format(d);
    return { monthKey, label, inflow: 0, outflow: 0 };
  });
  const bucketByKey = new Map(monthBuckets.map((b) => [b.monthKey, b]));

  for (const pay of payments) {
    const key = pay.paidAt.toISOString().slice(0, 7);
    const bucket = bucketByKey.get(key);
    if (bucket) bucket.inflow += Number(pay.amount);
  }
  for (const exp of expenses) {
    const key = exp.expenseDate.toISOString().slice(0, 7);
    const bucket = bucketByKey.get(key);
    if (bucket) bucket.outflow += Number(exp.amount);
  }
  for (const claim of expenseClaims) {
    if (claim.status === ApprovalStatus.APPROVED) {
      const key = claim.expenseDate.toISOString().slice(0, 7);
      const bucket = bucketByKey.get(key);
      if (bucket) bucket.outflow += Number(claim.amount);
    }
  }

  const recentActivity: FinanceDashboardDTO["recentActivity"] = [
    ...invoices.slice(0, 5).map((inv) => ({
      id: `inv-${inv.id}`,
      kind: "invoice" as const,
      title: `Invoice ${inv.number}`,
      subtitle: inv.company?.name ?? "Customer",
      amount: Number(inv.total),
      currency: inv.currency,
      dateIso: toIsoDate(inv.issueDate),
      badge: inv.status,
    })),
    ...payments.slice(0, 5).map((pay) => ({
      id: `pay-${pay.id}`,
      kind: "payment" as const,
      title: `Payment for ${pay.invoice.number}`,
      subtitle: `${pay.invoice.company?.name ?? "Customer"} · ${pay.method.replace("_", " ")}`,
      amount: Number(pay.amount),
      currency: pay.invoice.currency,
      dateIso: pay.paidAt.toISOString().slice(0, 10),
      badge: "RECEIVED",
    })),
    ...expenses.slice(0, 5).map((exp) => ({
      id: `exp-${exp.id}`,
      kind: "expense" as const,
      title: exp.title,
      subtitle: exp.project?.name ?? exp.company?.name ?? exp.category,
      amount: Number(exp.amount),
      currency: exp.currency,
      dateIso: toIsoDate(exp.expenseDate),
      badge: exp.status,
    })),
  ]
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso))
    .slice(0, 10);

  return {
    defaultCurrency: ctx.organization.defaultCurrency,
    receivablesByCurrency,
    overdueReceivablesByCurrency,
    payablesByCurrency,
    collectedByCurrency,
    expensesTotalByCurrency,
    cashFlow: monthBuckets,
    recentActivity,
  };
}

// ══════════════════════════════ Items Catalog ═══════════════════════════════

export interface CatalogItemDTO {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unitPrice: number;
  taxRate: number;
  currency: string;
  unit: string;
  isActive: boolean;
}

export async function listCatalogItems(ctx: TenantContext): Promise<CatalogItemDTO[]> {
  authorize(ctx, "finance.invoice.read");
  const items = await db.catalogItem.findMany({
    where: { organizationId: ctx.organization.id },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return items.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    description: item.description,
    unitPrice: Number(item.unitPrice),
    taxRate: Number(item.taxRate),
    currency: item.currency,
    unit: item.unit,
    isActive: item.isActive,
  }));
}

export async function createCatalogItem(
  ctx: TenantContext,
  input: {
    sku: string;
    name: string;
    description?: string | null;
    unitPrice: number;
    taxRate: number;
    currency: string;
    unit: string;
  },
): Promise<void> {
  authorize(ctx, "finance.invoice.write");
  const sku = input.sku.trim().toUpperCase();

  const existing = await db.catalogItem.findUnique({
    where: { organizationId_sku: { organizationId: ctx.organization.id, sku } },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(`An item with SKU "${sku}" already exists.`);
  }

  await db.catalogItem.create({
    data: {
      organizationId: ctx.organization.id,
      sku,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      unitPrice: new Prisma.Decimal(input.unitPrice).toDecimalPlaces(2),
      taxRate: new Prisma.Decimal(input.taxRate).toDecimalPlaces(2),
      currency: input.currency.toUpperCase(),
      unit: input.unit.trim() || "unit",
      isActive: true,
    },
  });
}

export async function toggleCatalogItemActive(
  ctx: TenantContext,
  itemId: string,
  isActive: boolean,
): Promise<void> {
  authorize(ctx, "finance.invoice.write");
  const updated = await db.catalogItem.updateMany({
    where: { id: itemId, organizationId: ctx.organization.id },
    data: { isActive },
  });
  if (updated.count === 0) throw new NotFoundError("Catalog item not found.");
}

// ════════════════════════════ Payments Received ═════════════════════════════

export interface PaymentsReceivedDTO {
  defaultCurrency: string;
  payments: Array<{
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    companyName: string;
    amount: number;
    currency: string;
    method: string;
    reference: string | null;
    paidAtIso: string;
  }>;
  unpaidInvoices: Array<{
    id: string;
    number: string;
    companyName: string;
    currency: string;
    balanceDue: number;
  }>;
}

export async function listPaymentsReceived(ctx: TenantContext): Promise<PaymentsReceivedDTO> {
  authorize(ctx, "finance.invoice.read");
  const organizationId = ctx.organization.id;

  const [payments, invoices] = await Promise.all([
    db.payment.findMany({
      where: { organizationId },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            currency: true,
            company: { select: { name: true } },
            contact: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    db.invoice.findMany({
      where: {
        organizationId,
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      orderBy: { dueDate: "asc" },
      include: {
        company: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return {
    defaultCurrency: ctx.organization.defaultCurrency,
    payments: payments.map((p) => ({
      id: p.id,
      invoiceId: p.invoice.id,
      invoiceNumber: p.invoice.number,
      companyName:
        p.invoice.company?.name ??
        (p.invoice.contact
          ? `${p.invoice.contact.firstName} ${p.invoice.contact.lastName}`.trim()
          : "Customer"),
      amount: Number(p.amount),
      currency: p.invoice.currency,
      method: p.method,
      reference: p.reference,
      paidAtIso: p.paidAt.toISOString().slice(0, 10),
    })),
    unpaidInvoices: invoices
      .map((inv) => ({
        id: inv.id,
        number: inv.number,
        companyName:
          inv.company?.name ??
          (inv.contact
            ? `${inv.contact.firstName} ${inv.contact.lastName}`.trim()
            : "Customer"),
        currency: inv.currency,
        balanceDue: Math.max(0, Number(inv.total) - Number(inv.amountPaid)),
      }))
      .filter((i) => i.balanceDue > 0),
  };
}

// ════════════════════════════════ Expenses ══════════════════════════════════

export interface FinanceExpenseDTO {
  id: string;
  title: string;
  category: string;
  vendor: string | null;
  amount: number;
  currency: string;
  billable: boolean;
  status: ExpenseStatus;
  expenseDate: string;
  notes: string | null;
  project: { id: string; name: string } | null;
  company: { id: string; name: string } | null;
  invoice: { id: string; number: string } | null;
}

export interface ExpensesWorkspaceDTO {
  defaultCurrency: string;
  todayIso: string;
  expenses: FinanceExpenseDTO[];
  projects: Array<{ id: string; name: string; companyId: string | null }>;
  companies: Array<{ id: string; name: string }>;
}

export async function listFinanceExpenses(ctx: TenantContext): Promise<ExpensesWorkspaceDTO> {
  authorize(ctx, "finance.invoice.read");
  const organizationId = ctx.organization.id;

  const [expenses, projects, companies] = await Promise.all([
    db.expense.findMany({
      where: { organizationId },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
      include: {
        project: { select: { id: true, name: true } },
        company: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true } },
      },
    }),
    db.project.findMany({
      where: { organizationId, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    }),
    db.company.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    defaultCurrency: ctx.organization.defaultCurrency,
    todayIso: toIsoDate(startOfUtcDay(new Date())),
    expenses: expenses.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      vendor: e.vendor,
      amount: Number(e.amount),
      currency: e.currency,
      billable: e.billable,
      status: e.status,
      expenseDate: toIsoDate(e.expenseDate),
      notes: e.notes,
      project: e.project,
      company: e.company,
      invoice: e.invoice,
    })),
    projects,
    companies,
  };
}

export async function createFinanceExpense(
  ctx: TenantContext,
  input: {
    title: string;
    category: string;
    vendor?: string | null;
    amount: number;
    currency: string;
    billable: boolean;
    expenseDate: string;
    projectId?: string | null;
    companyId?: string | null;
    notes?: string | null;
  },
): Promise<void> {
  authorize(ctx, "finance.invoice.write");
  const organizationId = ctx.organization.id;

  let resolvedCompanyId = input.companyId || null;
  if (input.projectId) {
    const project = await db.project.findUnique({
      where: { id_organizationId: { id: input.projectId, organizationId } },
      select: { id: true, companyId: true },
    });
    if (!project) throw new ValidationError("Selected project not found.");
    if (!resolvedCompanyId && project.companyId) {
      resolvedCompanyId = project.companyId;
    }
  }

  await db.expense.create({
    data: {
      organizationId,
      projectId: input.projectId || null,
      companyId: resolvedCompanyId,
      createdById: ctx.user.id,
      title: input.title.trim(),
      category: input.category.trim() || "Operations",
      vendor: input.vendor?.trim() || null,
      amount: new Prisma.Decimal(input.amount).toDecimalPlaces(2),
      currency: input.currency.toUpperCase(),
      billable: input.billable,
      status: input.billable ? ExpenseStatus.UNBILLED : ExpenseStatus.NON_BILLABLE,
      expenseDate: startOfUtcDay(new Date(`${input.expenseDate}T00:00:00.000Z`)),
      notes: input.notes?.trim() || null,
    },
  });
}

export async function convertExpensesToDraftInvoice(
  ctx: TenantContext,
  expenseIds: string[],
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  authorize(ctx, "finance.invoice.write");
  const organizationId = ctx.organization.id;
  if (expenseIds.length === 0) {
    throw new ValidationError("Select at least one billable expense.");
  }

  return db.$transaction(async (tx) => {
    const expenses = await tx.expense.findMany({
      where: {
        organizationId,
        id: { in: expenseIds },
      },
      include: {
        project: { select: { id: true, dealId: true, companyId: true, contactId: true } },
      },
    });

    if (expenses.length === 0) {
      throw new NotFoundError("No matching expenses found.");
    }
    if (expenses.some((e) => !e.billable || e.status !== ExpenseStatus.UNBILLED)) {
      throw new ConflictError("Only unbilled, billable expenses can be converted to an invoice.");
    }

    const currencies = new Set(expenses.map((e) => e.currency));
    if (currencies.size > 1) {
      throw new ValidationError("Selected expenses must use the same currency.");
    }

    const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { invoicePrefix: true, defaultPaymentTermsDays: true },
    });

    const first = expenses[0]!;
    const currency = first.currency;
    const companyId =
      expenses.find((e) => e.companyId)?.companyId ??
      expenses.find((e) => e.project?.companyId)?.project?.companyId ??
      null;
    const dealId = expenses.find((e) => e.project?.dealId)?.project?.dealId ?? null;
    const contactId = expenses.find((e) => e.project?.contactId)?.project?.contactId ?? null;

    const lineInputs = expenses.map((e) => ({
      description: `${e.title}${e.vendor ? ` (${e.vendor})` : ""} — Reimbursable Expense`,
      quantity: 1,
      unitPrice: e.amount,
      discountRate: 0,
      taxRate: 0,
    }));

    const computed = computeLineItemsAndTotals(lineInputs);
    const number = await allocateDocumentNumber(
      tx,
      organizationId,
      SequenceKind.INVOICE,
      org.invoicePrefix,
    );
    const today = startOfUtcDay(new Date());
    const dueDate = startOfUtcDay(addDays(today, org.defaultPaymentTermsDays));

    const invoice = await tx.invoice.create({
      data: {
        organizationId,
        number,
        status: InvoiceStatus.DRAFT,
        source: RecordSource.MANUAL,
        companyId,
        contactId,
        dealId,
        createdById: ctx.user.id,
        issueDate: today,
        dueDate,
        currency,
        subtotal: computed.subtotal,
        taxTotal: computed.taxTotal,
        total: computed.total,
        notes: `Generated from ${expenses.length} billable project expense(s).`,
        terms: `Net ${org.defaultPaymentTermsDays} days.`,
        lineItems: {
          create: computed.lineItems.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountRate: line.discountRate,
            taxRate: line.taxRate,
            lineSubtotal: line.lineSubtotal,
            lineTax: line.lineTax,
            lineTotal: line.lineTotal,
            position: line.position,
          })),
        },
      },
      select: { id: true, number: true },
    });

    await tx.expense.updateMany({
      where: { organizationId, id: { in: expenses.map((e) => e.id) } },
      data: { status: ExpenseStatus.INVOICED, invoiceId: invoice.id },
    });

    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Invoice",
      entityId: invoice.id,
      action: "invoice.created_from_expenses",
      metadata: { invoiceNumber: invoice.number, expenseCount: expenses.length },
    });

    return { invoiceId: invoice.id, invoiceNumber: invoice.number };
  });
}
