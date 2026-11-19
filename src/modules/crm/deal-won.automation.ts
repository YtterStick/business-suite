import "server-only";

import {
  ContactLifecycleStage,
  InvoiceStatus,
  MilestoneStatus,
  Prisma,
  ProjectStatus,
  QuoteStatus,
  RecordSource,
  SequenceKind,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";

import { addDays, startOfUtcDay } from "@/lib/dates";
import type { Tx } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/server/audit";
import { computeLineItemsAndTotals, type LineItemDraftInput } from "@/modules/finance/invoice-totals";
import { allocateDocumentNumber } from "@/modules/finance/sequences.service";

export interface DealWonProvisioningResult {
  dealId: string;
  invoice: {
    id: string;
    number: string;
    total: string;
    currency: string;
    created: boolean;
  };
  project: {
    id: string;
    name: string;
    created: boolean;
  };
  contactPromotedToCustomer: boolean;
}

interface ProvisionDealWonParams {
  organizationId: string;
  dealId: string;
  actorId: string | null;
}

/**
 * Cross-module automation invoked inside the same database transaction when a
 * CRM Deal transitions into `CLOSED_WON`.
 *
 * Provisioned resources (strictly idempotent via `(organizationId, automationKey)`):
 * 1. A DRAFT Invoice in Finance pre-populated from the latest ACCEPTED Quote,
 *    the Deal's line items, or a single summary line item matching `deal.amount`.
 * 2. A PLANNING Project in Projects with 3 standard delivery Milestones and 3
 *    actionable kickoff Tasks linked to the deal, company, and contact.
 * 3. Contact lifecycle promotion (`LEAD` / `PROSPECT` -> `CUSTOMER`).
 * 4. Immutable AuditLog entries + a transactional OutboxEvent for async listeners.
 */
export async function provisionDealWonResources(
  tx: Tx,
  params: ProvisionDealWonParams,
): Promise<DealWonProvisioningResult> {
  const { organizationId, dealId, actorId } = params;
  const automationKey = `deal-won:${dealId}`;
  const now = new Date();
  const today = startOfUtcDay(now);

  const deal = await tx.deal.findUnique({
    where: {
      id_organizationId: { id: dealId, organizationId },
    },
    include: {
      organization: {
        select: {
          id: true,
          invoicePrefix: true,
          defaultPaymentTermsDays: true,
        },
      },
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          lifecycleStage: true,
        },
      },
      company: {
        select: {
          id: true,
          name: true,
        },
      },
      lineItems: {
        orderBy: { position: "asc" },
      },
      quotes: {
        where: { status: QuoteStatus.ACCEPTED },
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: {
          lineItems: {
            orderBy: { position: "asc" },
          },
        },
      },
    },
  });

  if (!deal) {
    throw new NotFoundError("Deal not found for this organization.");
  }

  // ── 1. Provision Draft Invoice (idempotent) ────────────────────────────────
  const existingInvoice = await tx.invoice.findUnique({
    where: {
      organizationId_automationKey: { organizationId, automationKey },
    },
    select: {
      id: true,
      number: true,
      total: true,
      currency: true,
    },
  });

  let invoiceSummary: DealWonProvisioningResult["invoice"];

  if (existingInvoice) {
    invoiceSummary = {
      id: existingInvoice.id,
      number: existingInvoice.number,
      total: existingInvoice.total.toFixed(2),
      currency: existingInvoice.currency,
      created: false,
    };
  } else {
    const acceptedQuote = deal.quotes[0] ?? null;

    const draftInputs: LineItemDraftInput[] =
      acceptedQuote && acceptedQuote.lineItems.length > 0
        ? acceptedQuote.lineItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
          }))
        : deal.lineItems.length > 0
          ? deal.lineItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate,
            }))
          : [
              {
                description: `${deal.title} — Professional Services`,
                quantity: new Prisma.Decimal(1),
                unitPrice: deal.amount,
                taxRate: new Prisma.Decimal(0),
              },
            ];

    const computed = computeLineItemsAndTotals(draftInputs);
    const invoiceNumber = await allocateDocumentNumber(
      tx,
      organizationId,
      SequenceKind.INVOICE,
      deal.organization.invoicePrefix,
    );

    const dueDate = startOfUtcDay(addDays(now, deal.organization.defaultPaymentTermsDays));

    const createdInvoice = await tx.invoice.create({
      data: {
        organizationId,
        number: invoiceNumber,
        status: InvoiceStatus.DRAFT,
        source: RecordSource.AUTOMATION,
        automationKey,
        contactId: deal.contactId,
        companyId: deal.companyId,
        dealId: deal.id,
        quoteId: acceptedQuote?.id ?? null,
        createdById: actorId,
        issueDate: today,
        dueDate,
        currency: deal.currency,
        subtotal: computed.subtotal,
        taxTotal: computed.taxTotal,
        total: computed.total,
        notes: `Automatically generated from CRM deal "${deal.title}" upon closing won.`,
        terms: `Net ${deal.organization.defaultPaymentTermsDays} days.`,
        lineItems: {
          create: computed.lineItems.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            lineSubtotal: line.lineSubtotal,
            lineTax: line.lineTax,
            lineTotal: line.lineTotal,
            position: line.position,
          })),
        },
      },
      select: {
        id: true,
        number: true,
        total: true,
        currency: true,
      },
    });

    await recordAudit(tx, {
      organizationId,
      actorId,
      entityType: "Invoice",
      entityId: createdInvoice.id,
      action: "invoice.auto_created_from_deal",
      metadata: {
        dealId: deal.id,
        invoiceNumber: createdInvoice.number,
        quoteId: acceptedQuote?.id ?? null,
        total: createdInvoice.total.toFixed(2),
        currency: createdInvoice.currency,
      },
    });

    invoiceSummary = {
      id: createdInvoice.id,
      number: createdInvoice.number,
      total: createdInvoice.total.toFixed(2),
      currency: createdInvoice.currency,
      created: true,
    };
  }

  // ── 2. Provision Client Project, Milestones & Kickoff Tasks (idempotent) ───
  const existingProject = await tx.project.findUnique({
    where: {
      organizationId_automationKey: { organizationId, automationKey },
    },
    select: {
      id: true,
      name: true,
    },
  });

  let projectSummary: DealWonProvisioningResult["project"];

  if (existingProject) {
    projectSummary = {
      id: existingProject.id,
      name: existingProject.name,
      created: false,
    };
  } else {
    const projectName = deal.company ? `${deal.company.name} — ${deal.title}` : deal.title;
    const projectOwnerId = deal.ownerId ?? actorId;
    const targetDueDate = startOfUtcDay(addDays(now, 45));

    const createdProject = await tx.project.create({
      data: {
        organizationId,
        name: projectName,
        description: `Delivery workspace provisioned automatically when CRM deal "${deal.title}" closed won.`,
        status: ProjectStatus.PLANNING,
        source: RecordSource.AUTOMATION,
        automationKey,
        dealId: deal.id,
        companyId: deal.companyId,
        contactId: deal.contactId,
        ownerId: projectOwnerId,
        startDate: today,
        dueDate: targetDueDate,
        budget: deal.amount,
        currency: deal.currency,
      },
      select: {
        id: true,
        name: true,
      },
    });

    const kickoffMilestone = await tx.milestone.create({
      data: {
        organizationId,
        projectId: createdProject.id,
        name: "Kickoff & Discovery",
        description: "Align stakeholders, finalize requirements, and review billing schedule.",
        status: MilestoneStatus.IN_PROGRESS,
        dueDate: startOfUtcDay(addDays(now, 7)),
        position: 0,
      },
      select: { id: true },
    });

    const deliveryMilestone = await tx.milestone.create({
      data: {
        organizationId,
        projectId: createdProject.id,
        name: "Implementation & Delivery",
        description: "Core build, configuration, and iterative client checkpoints.",
        status: MilestoneStatus.PENDING,
        dueDate: startOfUtcDay(addDays(now, 30)),
        position: 1,
      },
      select: { id: true },
    });

    await tx.milestone.create({
      data: {
        organizationId,
        projectId: createdProject.id,
        name: "Handover & Sign-off",
        description: "User acceptance testing, documentation, and final delivery sign-off.",
        status: MilestoneStatus.PENDING,
        dueDate: targetDueDate,
        position: 2,
      },
    });

    const contactDisplay = deal.contact
      ? `${deal.contact.firstName} ${deal.contact.lastName}`.trim()
      : "client stakeholders";

    await tx.task.createMany({
      data: [
        {
          organizationId,
          projectId: createdProject.id,
          milestoneId: kickoffMilestone.id,
          assigneeId: projectOwnerId,
          reporterId: actorId,
          title: "Schedule client kickoff call",
          description: `Coordinate kickoff meeting with ${contactDisplay} and share onboarding agenda.`,
          status: TaskStatus.TODO,
          priority: TaskPriority.HIGH,
          position: 1024,
          dueDate: startOfUtcDay(addDays(now, 3)),
        },
        {
          organizationId,
          projectId: createdProject.id,
          milestoneId: deliveryMilestone.id,
          assigneeId: projectOwnerId,
          reporterId: actorId,
          title: "Confirm delivery scope & timeline",
          description: `Translate deal deliverables for "${deal.title}" into milestone tasks.`,
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          position: 2048,
          dueDate: startOfUtcDay(addDays(now, 7)),
        },
        {
          organizationId,
          projectId: createdProject.id,
          milestoneId: kickoffMilestone.id,
          assigneeId: projectOwnerId,
          reporterId: actorId,
          title: `Review draft invoice ${invoiceSummary.number} with finance`,
          description: `Verify billing lines (${invoiceSummary.currency} ${invoiceSummary.total}) before sending to client.`,
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
          position: 3072,
          dueDate: startOfUtcDay(addDays(now, 2)),
        },
      ],
    });

    await recordAudit(tx, {
      organizationId,
      actorId,
      entityType: "Project",
      entityId: createdProject.id,
      action: "project.auto_created_from_deal",
      metadata: {
        dealId: deal.id,
        projectName: createdProject.name,
        invoiceId: invoiceSummary.id,
        invoiceNumber: invoiceSummary.number,
      },
    });

    projectSummary = {
      id: createdProject.id,
      name: createdProject.name,
      created: true,
    };
  }

  // ── 3. Promote Contact Lifecycle Stage to CUSTOMER ─────────────────────────
  let contactPromotedToCustomer = false;
  if (
    deal.contact &&
    (deal.contact.lifecycleStage === ContactLifecycleStage.LEAD ||
      deal.contact.lifecycleStage === ContactLifecycleStage.PROSPECT)
  ) {
    await tx.contact.update({
      where: {
        id_organizationId: { id: deal.contact.id, organizationId },
      },
      data: {
        lifecycleStage: ContactLifecycleStage.CUSTOMER,
      },
    });
    contactPromotedToCustomer = true;

    await recordAudit(tx, {
      organizationId,
      actorId,
      entityType: "Contact",
      entityId: deal.contact.id,
      action: "contact.promoted_to_customer",
      metadata: {
        dealId: deal.id,
        previousStage: deal.contact.lifecycleStage,
      },
    });
  }

  // ── 4. Enqueue Transactional Outbox Event ──────────────────────────────────
  if (invoiceSummary.created || projectSummary.created) {
    await tx.outboxEvent.create({
      data: {
        organizationId,
        type: "crm.deal.closed_won",
        aggregateType: "Deal",
        aggregateId: deal.id,
        payload: {
          dealId: deal.id,
          dealTitle: deal.title,
          amount: deal.amount.toFixed(2),
          currency: deal.currency,
          invoiceId: invoiceSummary.id,
          invoiceNumber: invoiceSummary.number,
          projectId: projectSummary.id,
          projectName: projectSummary.name,
          contactPromotedToCustomer,
          triggeredByUserId: actorId,
        },
      },
    });
  }

  return {
    dealId: deal.id,
    invoice: invoiceSummary,
    project: projectSummary,
    contactPromotedToCustomer,
  };
}
