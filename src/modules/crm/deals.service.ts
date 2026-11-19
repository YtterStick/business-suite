import "server-only";

import { DealStatus, Prisma, StageType } from "@prisma/client";

import { startOfUtcDay, toIsoDate } from "@/lib/dates";
import { db, type Tx } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { recordAudit } from "@/server/audit";
import { authorize, type TenantContext } from "@/server/tenancy";
import {
  provisionDealWonResources,
  type DealWonProvisioningResult,
} from "@/modules/crm/deal-won.automation";
import type {
  CreateDealInput,
  CreateDealResultDTO,
  KanbanBoardDTO,
  KanbanDealCardDTO,
  MoveDealInput,
  MoveDealResultDTO,
} from "@/modules/crm/deals.types";

const POSITION_STEP = 1024;
const MIN_POSITION_GAP = 0.001;

const DEFAULT_PIPELINE_STAGES: Array<{
  name: string;
  type: StageType;
  probability: number;
  position: number;
  color: string;
}> = [
  { name: "Qualified", type: StageType.OPEN, probability: 20, position: 0, color: "#64748b" },
  { name: "Discovery", type: StageType.OPEN, probability: 40, position: 1, color: "#3b82f6" },
  { name: "Proposal / Quote", type: StageType.OPEN, probability: 65, position: 2, color: "#8b5cf6" },
  { name: "Negotiation", type: StageType.OPEN, probability: 85, position: 3, color: "#f59e0b" },
  { name: "Closed Won", type: StageType.WON, probability: 100, position: 4, color: "#10b981" },
  { name: "Closed Lost", type: StageType.LOST, probability: 0, position: 5, color: "#ef4444" },
];

export function stageTypeToDealStatus(stageType: StageType): DealStatus {
  switch (stageType) {
    case StageType.WON:
      return DealStatus.CLOSED_WON;
    case StageType.LOST:
      return DealStatus.CLOSED_LOST;
    case StageType.OPEN:
      return DealStatus.OPEN;
  }
}

/**
 * Ensures an organization has at least one pipeline with standard B2B sales stages.
 */
export async function ensureDefaultPipeline(
  tx: Tx,
  organizationId: string,
): Promise<{ id: string; name: string }> {
  const existing = await tx.pipeline.findFirst({
    where: { organizationId },
    orderBy: [{ isDefault: "desc" }, { position: "asc" }],
    select: { id: true, name: true },
  });

  if (existing) return existing;

  return tx.pipeline.create({
    data: {
      organizationId,
      name: "Sales Pipeline",
      isDefault: true,
      position: 0,
      stages: {
        create: DEFAULT_PIPELINE_STAGES.map((stage) => ({
          name: stage.name,
          type: stage.type,
          probability: stage.probability,
          position: stage.position,
          color: stage.color,
        })),
      },
    },
    select: { id: true, name: true },
  });
}

function mapDealToKanbanCard(deal: {
  id: string;
  title: string;
  stageId: string;
  pipelineId: string;
  status: DealStatus;
  amount: Prisma.Decimal;
  currency: string;
  probability: number;
  position: number;
  expectedCloseDate: Date | null;
  closedAt: Date | null;
  company: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string; email: string | null } | null;
  owner: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { invoices: number; projects: number };
  invoices: Array<{ number: string }>;
  projects: Array<{ id: string }>;
}): KanbanDealCardDTO {
  return {
    id: deal.id,
    title: deal.title,
    stageId: deal.stageId,
    pipelineId: deal.pipelineId,
    status: deal.status,
    amount: Number(deal.amount),
    currency: deal.currency,
    probability: deal.probability,
    position: deal.position,
    expectedCloseDate: deal.expectedCloseDate ? toIsoDate(deal.expectedCloseDate) : null,
    closedAt: deal.closedAt ? deal.closedAt.toISOString() : null,
    company: deal.company,
    contact: deal.contact
      ? {
          id: deal.contact.id,
          fullName: `${deal.contact.firstName} ${deal.contact.lastName}`.trim(),
          email: deal.contact.email,
        }
      : null,
    owner: deal.owner,
    invoiceCount: deal._count.invoices,
    projectCount: deal._count.projects,
    latestInvoiceNumber: deal.invoices[0]?.number ?? null,
    latestProjectId: deal.projects[0]?.id ?? null,
  };
}

export async function getKanbanBoard(
  ctx: TenantContext,
  requestedPipelineId?: string,
): Promise<KanbanBoardDTO> {
  authorize(ctx, "crm.deal.read");
  const organizationId = ctx.organization.id;

  let pipelines = await db.pipeline.findMany({
    where: { organizationId },
    orderBy: [{ isDefault: "desc" }, { position: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });

  if (pipelines.length === 0) {
    const created = await db.$transaction((tx) => ensureDefaultPipeline(tx, organizationId));
    pipelines = [{ ...created, isDefault: true }];
  }

  const activePipeline =
    (requestedPipelineId ? pipelines.find((p) => p.id === requestedPipelineId) : undefined) ??
    pipelines[0];

  if (!activePipeline) {
    throw new NotFoundError("Pipeline not found.");
  }

  const [stages, deals, companies, contacts] = await Promise.all([
    db.pipelineStage.findMany({
      where: { organizationId, pipelineId: activePipeline.id },
      orderBy: { position: "asc" },
      select: {
        id: true,
        pipelineId: true,
        name: true,
        type: true,
        probability: true,
        position: true,
        color: true,
      },
    }),
    db.deal.findMany({
      where: { organizationId, pipelineId: activePipeline.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        stageId: true,
        pipelineId: true,
        status: true,
        amount: true,
        currency: true,
        probability: true,
        position: true,
        expectedCloseDate: true,
        closedAt: true,
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        owner: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { invoices: true, projects: true } },
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { number: true },
        },
        projects: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    }),
    db.company.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, industry: true },
    }),
    db.contact.findMany({
      where: { organizationId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 200,
      select: { id: true, firstName: true, lastName: true, email: true, companyId: true },
    }),
  ]);

  const dealsByStage = new Map<string, KanbanDealCardDTO[]>();
  for (const stage of stages) {
    dealsByStage.set(stage.id, []);
  }
  for (const deal of deals) {
    const bucket = dealsByStage.get(deal.stageId);
    if (bucket) {
      bucket.push(mapDealToKanbanCard(deal));
    }
  }

  return {
    pipeline: { id: activePipeline.id, name: activePipeline.name },
    pipelines,
    stages: stages.map((stage) => ({
      ...stage,
      deals: dealsByStage.get(stage.id) ?? [],
    })),
    companies: companies.map((c) => ({
      id: c.id,
      label: c.name,
      secondary: c.industry,
    })),
    contacts: contacts.map((c) => ({
      id: c.id,
      label: `${c.firstName} ${c.lastName}`.trim(),
      secondary: c.email,
      companyId: c.companyId,
    })),
  };
}

/**
 * Computes a fractional sort position between two optional neighboring deals in
 * the destination stage. If floating-point precision runs thin, renumbers the
 * column cleanly at 1024-step intervals first.
 */
async function computeTargetPosition(
  tx: Tx,
  params: {
    organizationId: string;
    pipelineId: string;
    stageId: string;
    movingDealId: string;
    beforeDealId?: string | null;
    afterDealId?: string | null;
  },
): Promise<number> {
  const { organizationId, pipelineId, stageId, movingDealId, beforeDealId, afterDealId } = params;

  const computeFromCurrentNeighbors = async (): Promise<{ position: number; needsRebalance: boolean }> => {
    if (beforeDealId || afterDealId) {
      const [beforeDeal, afterDeal] = await Promise.all([
        beforeDealId
          ? tx.deal.findFirst({
              where: {
                id: beforeDealId,
                organizationId,
                pipelineId,
                stageId,
                NOT: { id: movingDealId },
              },
              select: { position: true },
            })
          : Promise.resolve(null),
        afterDealId
          ? tx.deal.findFirst({
              where: {
                id: afterDealId,
                organizationId,
                pipelineId,
                stageId,
                NOT: { id: movingDealId },
              },
              select: { position: true },
            })
          : Promise.resolve(null),
      ]);

      if (beforeDeal && afterDeal) {
        const gap = Math.abs(afterDeal.position - beforeDeal.position);
        return {
          position: (beforeDeal.position + afterDeal.position) / 2,
          needsRebalance: gap < MIN_POSITION_GAP,
        };
      }
      if (beforeDeal) {
        return { position: beforeDeal.position + POSITION_STEP, needsRebalance: false };
      }
      if (afterDeal) {
        return { position: afterDeal.position - POSITION_STEP, needsRebalance: false };
      }
    }

    const tail = await tx.deal.findFirst({
      where: {
        organizationId,
        pipelineId,
        stageId,
        NOT: { id: movingDealId },
      },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    return {
      position: tail ? tail.position + POSITION_STEP : POSITION_STEP,
      needsRebalance: false,
    };
  };

  const initial = await computeFromCurrentNeighbors();
  if (!initial.needsRebalance) {
    return initial.position;
  }

  // Rebalance stage column positions at clean 1024-step spacing.
  const stageDeals = await tx.deal.findMany({
    where: {
      organizationId,
      pipelineId,
      stageId,
      NOT: { id: movingDealId },
    },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  await Promise.all(
    stageDeals.map((row, idx) =>
      tx.deal.update({
        where: { id_organizationId: { id: row.id, organizationId } },
        data: { position: (idx + 1) * POSITION_STEP },
      }),
    ),
  );

  const afterRebalance = await computeFromCurrentNeighbors();
  return afterRebalance.position;
}

/**
 * Moves a deal within or across Kanban stages inside a Serializable transaction.
 * When the transition moves a deal into a `WON` stage (`CLOSED_WON`), executes
 * `provisionDealWonResources` in the exact same transaction so the draft invoice
 * and client project are committed atomically with the deal stage change.
 */
export async function moveDealToStage(
  ctx: TenantContext,
  input: MoveDealInput,
): Promise<MoveDealResultDTO> {
  authorize(ctx, "crm.deal.write");
  const organizationId = ctx.organization.id;

  return db.$transaction(
    async (tx) => {
      const existingDeal = await tx.deal.findUnique({
        where: {
          id_organizationId: { id: input.dealId, organizationId },
        },
        select: {
          id: true,
          pipelineId: true,
          stageId: true,
          status: true,
          closedAt: true,
          lostReason: true,
        },
      });

      if (!existingDeal) {
        throw new NotFoundError("Deal not found.");
      }

      const targetStage = await tx.pipelineStage.findUnique({
        where: {
          id_pipelineId_organizationId: {
            id: input.targetStageId,
            pipelineId: existingDeal.pipelineId,
            organizationId,
          },
        },
        select: {
          id: true,
          name: true,
          type: true,
          probability: true,
        },
      });

      if (!targetStage) {
        throw new ValidationError("Target pipeline stage does not exist in this deal's pipeline.");
      }

      const nextPosition = await computeTargetPosition(tx, {
        organizationId,
        pipelineId: existingDeal.pipelineId,
        stageId: targetStage.id,
        movingDealId: existingDeal.id,
        beforeDealId: input.beforeDealId,
        afterDealId: input.afterDealId,
      });

      const nextStatus = stageTypeToDealStatus(targetStage.type);
      const isClosedStatus = nextStatus === DealStatus.CLOSED_WON || nextStatus === DealStatus.CLOSED_LOST;
      const nextClosedAt = isClosedStatus ? (existingDeal.closedAt ?? new Date()) : null;
      const nextLostReason =
        nextStatus === DealStatus.CLOSED_LOST
          ? (input.lostReason?.trim() || existingDeal.lostReason || null)
          : null;

      const updatedDeal = await tx.deal.update({
        where: {
          id_organizationId: { id: existingDeal.id, organizationId },
        },
        data: {
          stageId: targetStage.id,
          status: nextStatus,
          probability: targetStage.probability,
          position: nextPosition,
          closedAt: nextClosedAt,
          lostReason: nextLostReason,
        },
        select: {
          id: true,
          stageId: true,
          status: true,
          probability: true,
          position: true,
          closedAt: true,
        },
      });

      if (existingDeal.stageId !== targetStage.id) {
        await recordAudit(tx, {
          organizationId,
          actorId: ctx.user.id,
          entityType: "Deal",
          entityId: updatedDeal.id,
          action: "deal.stage_changed",
          metadata: {
            fromStageId: existingDeal.stageId,
            toStageId: targetStage.id,
            toStageName: targetStage.name,
            previousStatus: existingDeal.status,
            nextStatus,
          },
        });
      }

      let automation: DealWonProvisioningResult | null = null;
      if (
        existingDeal.status !== DealStatus.CLOSED_WON &&
        nextStatus === DealStatus.CLOSED_WON
      ) {
        automation = await provisionDealWonResources(tx, {
          organizationId,
          dealId: updatedDeal.id,
          actorId: ctx.user.id,
        });
      }

      return {
        deal: {
          id: updatedDeal.id,
          stageId: updatedDeal.stageId,
          status: updatedDeal.status,
          probability: updatedDeal.probability,
          position: updatedDeal.position,
          closedAt: updatedDeal.closedAt ? updatedDeal.closedAt.toISOString() : null,
        },
        automation,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function createDeal(
  ctx: TenantContext,
  input: CreateDealInput,
): Promise<CreateDealResultDTO> {
  authorize(ctx, "crm.deal.write");
  const organizationId = ctx.organization.id;

  return db.$transaction(async (tx) => {
    const stage = await tx.pipelineStage.findUnique({
      where: {
        id_pipelineId_organizationId: {
          id: input.stageId,
          pipelineId: input.pipelineId,
          organizationId,
        },
      },
      select: {
        id: true,
        pipelineId: true,
        type: true,
        probability: true,
      },
    });

    if (!stage) {
      throw new ValidationError("Selected pipeline stage does not belong to this organization.");
    }

    if (input.companyId) {
      const companyExists = await tx.company.findUnique({
        where: { id_organizationId: { id: input.companyId, organizationId } },
        select: { id: true },
      });
      if (!companyExists) {
        throw new ValidationError("Selected company does not belong to this organization.");
      }
    }

    if (input.contactId) {
      const contactExists = await tx.contact.findUnique({
        where: { id_organizationId: { id: input.contactId, organizationId } },
        select: { id: true },
      });
      if (!contactExists) {
        throw new ValidationError("Selected contact does not belong to this organization.");
      }
    }

    const tail = await tx.deal.findFirst({
      where: { organizationId, pipelineId: stage.pipelineId, stageId: stage.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const status = stageTypeToDealStatus(stage.type);
    const closedAt = status === DealStatus.OPEN ? null : new Date();
    const expectedCloseDate = input.expectedCloseDate
      ? startOfUtcDay(new Date(input.expectedCloseDate))
      : null;

    const created = await tx.deal.create({
      data: {
        organizationId,
        pipelineId: stage.pipelineId,
        stageId: stage.id,
        companyId: input.companyId || null,
        contactId: input.contactId || null,
        ownerId: ctx.user.id,
        title: input.title.trim(),
        amount: new Prisma.Decimal(input.amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
        currency: (input.currency ?? ctx.organization.defaultCurrency).toUpperCase(),
        status,
        probability: stage.probability,
        position: tail ? tail.position + POSITION_STEP : POSITION_STEP,
        expectedCloseDate,
        closedAt,
      },
      select: {
        id: true,
        title: true,
        stageId: true,
        pipelineId: true,
        status: true,
        amount: true,
        currency: true,
        probability: true,
        position: true,
        expectedCloseDate: true,
        closedAt: true,
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        owner: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { invoices: true, projects: true } },
        invoices: { orderBy: { createdAt: "desc" }, take: 1, select: { number: true } },
        projects: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
      },
    });

    await recordAudit(tx, {
      organizationId,
      actorId: ctx.user.id,
      entityType: "Deal",
      entityId: created.id,
      action: "deal.created",
      metadata: {
        title: created.title,
        stageId: created.stageId,
        amount: created.amount.toFixed(2),
        currency: created.currency,
      },
    });

    let automation: DealWonProvisioningResult | null = null;
    if (status === DealStatus.CLOSED_WON) {
      automation = await provisionDealWonResources(tx, {
        organizationId,
        dealId: created.id,
        actorId: ctx.user.id,
      });
    }

    const dto = mapDealToKanbanCard(created);
    if (automation) {
      dto.invoiceCount = 1;
      dto.projectCount = 1;
      dto.latestInvoiceNumber = automation.invoice.number;
      dto.latestProjectId = automation.project.id;
    }

    return { deal: dto, automation };
  });
}
