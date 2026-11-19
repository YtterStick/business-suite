import "server-only";

import {
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  RecordSource,
  SequenceKind,
} from "@prisma/client";

import { addDays, startOfUtcDay, toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { computeLineItemsAndTotals } from "@/modules/finance/invoice-totals";
import { allocateDocumentNumber } from "@/modules/finance/sequences.service";
import type {
  InvoiceRecordDTO,
  InvoicesWorkspaceDTO,
} from "@/modules/finance/invoices.types";
import { recordAudit } from "@/server/audit";
import { authorize, type TenantContext } from "@/server/tenancy";

function resolveEffectiveStatus(
  status: InvoiceStatus,
  dueDateIso: string,
  todayIso: string,
  balanceDue: number,
): InvoiceStatus {
  if (
    (status === InvoiceStatus.SENT || status === InvoiceStatus.PARTIALLY_PAID) &&
    balanceDue > 0 &&
    dueDateIso < todayIso
  ) {
    return InvoiceStatus.OVERDUE;
  }
  return status;
}

export async function getInvoicesWorkspace(ctx: TenantContext): Promise<InvoicesWorkspaceDTO> {
  authorize(ctx, "finance.invoice.read");
  const organizationId = ctx.organization.id;
  const today = startOfUtcDay(new Date());
  const todayIso = toIsoDate(today);
  const dueSoonIso = toIsoDate(addDays(today, 30));

  const [org, invoices, companies, contacts, deals, catalogItems] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        defaultCurrency: true,
        defaultPaymentTermsDays: true,
      },
    }),
    db.invoice.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: "desc" }],
      include: {
        company: {
          select: { id: true, name: true, addressLine1: true, city: true, country: true },
        },
        contact: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        deal: { select: { id: true, title: true } },
        lineItems: { orderBy: { position: "asc" } },
        payments: { orderBy: { paidAt: "desc" } },
      },
    }),
    db.company.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true },
    }),
    db.contact.findMany({
      where: { organizationId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 200,
      select: { id: true, firstName: true, lastName: true, email: true, companyId: true },
    }),
    db.deal.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 150,
      select: {
        id: true,
        title: true,
        companyId: true,
        contactId: true,
        currency: true,
        amount: true,
      },
    }),
    db.catalogItem.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      take: 100,
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        unitPrice: true,
        taxRate: true,
        currency: true,
      },
    }),
  ]);

  const mappedInvoices: InvoiceRecordDTO[] = invoices.map((inv) => {
    const total = Number(inv.total);
    const amountPaid = Number(inv.amountPaid);
    const balanceDue =
      inv.status === InvoiceStatus.VOID ? 0 : Math.max(0, Number((total - amountPaid).toFixed(2)));
    const issueDateIso = toIsoDate(inv.issueDate);
    const dueDateIso = toIsoDate(inv.dueDate);

    return {
      id: inv.id,
      number: inv.number,
      status: inv.status,
      effectiveStatus: resolveEffectiveStatus(inv.status, dueDateIso, todayIso, balanceDue),
      source: inv.source,
      issueDate: issueDateIso,
      dueDate: dueDateIso,
      currency: inv.currency,
      subtotal: Number(inv.subtotal),
      taxTotal: Number(inv.taxTotal),
      total,
      amountPaid,
      balanceDue,
      notes: inv.notes,
      terms: inv.terms,
      sentAt: inv.sentAt ? inv.sentAt.toISOString() : null,
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      voidedAt: inv.voidedAt ? inv.voidedAt.toISOString() : null,
      company: inv.company,
      contact: inv.contact
        ? {
            id: inv.contact.id,
            fullName: `${inv.contact.firstName} ${inv.contact.lastName}`.trim(),
            email: inv.contact.email,
          }
        : null,
      deal: inv.deal,
      lineItems: inv.lineItems.map((line) => ({
        id: line.id,
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        discountRate: Number(line.discountRate),
        taxRate: Number(line.taxRate),
        lineSubtotal: Number(line.lineSubtotal),
        lineTax: Number(line.lineTax),
        lineTotal: Number(line.lineTotal),
        position: line.position,
      })),
      payments: inv.payments.map((pay) => ({
        id: pay.id,
        amount: Number(pay.amount),
        method: pay.method,
        reference: pay.reference,
        paidAt: pay.paidAt.toISOString(),
      })),
    };
  });

  return {
    organization: org,
    todayIso,
    dueSoonIso,
    invoices: mappedInvoices,
    companies,
    contacts: contacts.map((c) => ({
      id: c.id,
      fullName: `${c.firstName} ${c.lastName}`.trim(),
      email: c.email,
      companyId: c.companyId,
    })),
    deals: deals.map((d) => ({
      id: d.id,
      title: d.title,
      companyId: d.companyId,
      contactId: d.contactId,
      currency: d.currency,
      amount: Number(d.amount),
    })),
    catalogItems: catalogItems.map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate),
      currency: item.currency,
    })),
  };
}

export interface UpsertInvoiceInput {
  invoiceId?: string;
  companyId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  notes?: string | null;
  terms?: string | null;
  sendImmediately?: boolean;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    discountRate: number;
    taxRate: number;
  }>;
}

export async function createManualInvoice(
  ctx: TenantContext,
  input: UpsertInvoiceInput,
): Promise<{ id: string; number: string }> {
  authorize(ctx, "finance.invoice.write");
  const organizationId = ctx.organization.id;

  if (input.lineItems.length === 0) {
    throw new ValidationError("Add at least one line item.");
  }

  return db.$transaction(async (tx) => {
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { invoicePrefix: true },
    });

    const computed = computeLineItemsAndTotals(input.lineItems);
    const number = await allocateDocumentNumber(
      tx,
      organizationId,
      SequenceKind.INVOICE,
      org.invoicePrefix,
    );

    const status = input.sendImmediately ? InvoiceStatus.SENT : InvoiceStatus.DRAFT;

    const created = await tx.invoice.create({
      data: {
        organizationId,
        number,
        status,
        source: RecordSource.MANUAL,
        companyId: input.companyId || null,
        contactId: input.contactId || null,
        dealId: input.dealId || null,
        createdById: ctx.user.id,
        issueDate: startOfUtcDay(new Date(`${input.issueDate}T00:00:00.000Z`)),
        dueDate: startOfUtcDay(new Date(`${input.dueDate}T00:00:00.000Z`)),
        currency: input.currency.toUpperCase(),
        subtotal: computed.subtotal,
        taxTotal: computed.taxTotal,
        total: computed.total,
        notes: input.notes?.trim() || null,
        terms: input.terms?.trim() || null,
        sentAt: input.sendImmediately ? new Date() : null,
        lineItems: {
          create: computed.lineItems.map((line) => ({
            description: line.description.trim(),
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

    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Invoice",
      entityId: created.id,
      action: input.sendImmediately ? "invoice.created_and_sent" : "invoice.created_draft",
      metadata: { number: created.number, total: computed.total.toFixed(2) },
    });

    return created;
  });
}

export async function updateDraftInvoice(
  ctx: TenantContext,
  input: UpsertInvoiceInput & { invoiceId: string },
): Promise<void> {
  authorize(ctx, "finance.invoice.write");
  const organizationId = ctx.organization.id;

  return db.$transaction(async (tx) => {
    const existing = await tx.invoice.findUnique({
      where: { id_organizationId: { id: input.invoiceId, organizationId } },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundError("Invoice not found.");
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new ConflictError("Only Draft invoices can be edited.");
    }

    const computed = computeLineItemsAndTotals(input.lineItems);
    const nextStatus = input.sendImmediately ? InvoiceStatus.SENT : InvoiceStatus.DRAFT;

    await tx.invoiceLineItem.deleteMany({
      where: { organizationId, invoiceId: existing.id },
    });

    await tx.invoice.update({
      where: { id_organizationId: { id: existing.id, organizationId } },
      data: {
        status: nextStatus,
        companyId: input.companyId || null,
        contactId: input.contactId || null,
        dealId: input.dealId || null,
        issueDate: startOfUtcDay(new Date(`${input.issueDate}T00:00:00.000Z`)),
        dueDate: startOfUtcDay(new Date(`${input.dueDate}T00:00:00.000Z`)),
        currency: input.currency.toUpperCase(),
        subtotal: computed.subtotal,
        taxTotal: computed.taxTotal,
        total: computed.total,
        notes: input.notes?.trim() || null,
        terms: input.terms?.trim() || null,
        sentAt: input.sendImmediately ? new Date() : undefined,
        lineItems: {
          create: computed.lineItems.map((line) => ({
            description: line.description.trim(),
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
    });
  });
}

export async function sendInvoices(ctx: TenantContext, invoiceIds: string[]): Promise<number> {
  authorize(ctx, "finance.invoice.write");
  const organizationId = ctx.organization.id;
  if (invoiceIds.length === 0) return 0;

  const updated = await db.invoice.updateMany({
    where: {
      organizationId,
      id: { in: invoiceIds },
      status: InvoiceStatus.DRAFT,
    },
    data: {
      status: InvoiceStatus.SENT,
      sentAt: new Date(),
    },
  });
  return updated.count;
}

export async function voidInvoices(ctx: TenantContext, invoiceIds: string[]): Promise<number> {
  authorize(ctx, "finance.invoice.void");
  const organizationId = ctx.organization.id;
  if (invoiceIds.length === 0) return 0;

  const updated = await db.invoice.updateMany({
    where: {
      organizationId,
      id: { in: invoiceIds },
      status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.VOID] },
    },
    data: {
      status: InvoiceStatus.VOID,
      voidedAt: new Date(),
    },
  });
  return updated.count;
}

export async function recordInvoicePayment(
  ctx: TenantContext,
  input: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    reference?: string | null;
    paidAt?: string | null;
  },
): Promise<{ status: InvoiceStatus; amountPaid: number }> {
  authorize(ctx, "finance.invoice.write");
  const organizationId = ctx.organization.id;

  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({
      where: { id_organizationId: { id: input.invoiceId, organizationId } },
      select: { id: true, number: true, status: true, total: true, amountPaid: true },
    });

    if (!invoice) throw new NotFoundError("Invoice not found.");
    if (invoice.status === InvoiceStatus.VOID) {
      throw new ConflictError("Cannot record a payment on a voided invoice.");
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictError("This invoice is already paid in full.");
    }

    const totalDec = invoice.total;
    const paidSoFar = invoice.amountPaid;
    const paymentDec = new Prisma.Decimal(input.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const remaining = totalDec.minus(paidSoFar);

    if (paymentDec.lte(0)) {
      throw new ValidationError("Payment amount must be greater than zero.");
    }
    if (paymentDec.gt(remaining)) {
      throw new ValidationError(
        `Payment (${paymentDec.toFixed(2)}) exceeds remaining balance (${remaining.toFixed(2)}).`,
      );
    }

    const newAmountPaid = paidSoFar.plus(paymentDec).toDecimalPlaces(2);
    const isPaidInFull = newAmountPaid.gte(totalDec);
    const nextStatus = isPaidInFull ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID;
    const paidAtDate = input.paidAt ? new Date(`${input.paidAt}T12:00:00.000Z`) : new Date();

    await tx.payment.create({
      data: {
        organizationId,
        invoiceId: invoice.id,
        amount: paymentDec,
        method: input.method,
        reference: input.reference?.trim() || null,
        paidAt: paidAtDate,
      },
    });

    await tx.invoice.update({
      where: { id_organizationId: { id: invoice.id, organizationId } },
      data: {
        amountPaid: newAmountPaid,
        status: nextStatus,
        paidAt: isPaidInFull ? paidAtDate : null,
      },
    });

    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Invoice",
      entityId: invoice.id,
      action: "invoice.payment_recorded",
      metadata: {
        invoiceNumber: invoice.number,
        amount: paymentDec.toFixed(2),
        method: input.method,
        nextStatus,
      },
    });

    return { status: nextStatus, amountPaid: Number(newAmountPaid) };
  });
}
