"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { ValidationError } from "@/lib/errors";
import { runAction } from "@/server/action";
import { assertTenant } from "@/server/tenancy";
import { createDeal, moveDealToStage } from "@/modules/crm/deals.service";
import type { CreateDealResultDTO, MoveDealResultDTO } from "@/modules/crm/deals.types";

const moveDealSchema = z.object({
  orgSlug: z.string().min(1),
  dealId: z.string().min(1),
  targetStageId: z.string().min(1),
  beforeDealId: z.string().nullable().optional(),
  afterDealId: z.string().nullable().optional(),
  lostReason: z.string().max(500).nullable().optional(),
});

const createDealSchema = z.object({
  orgSlug: z.string().min(1),
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  title: z.string().trim().min(2, "Deal title must be at least 2 characters.").max(180),
  amount: z.coerce.number().min(0, "Amount cannot be negative.").max(1_000_000_000),
  currency: z.string().length(3).optional(),
  companyId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  expectedCloseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected close date must be YYYY-MM-DD.")
    .nullable()
    .optional(),
});

export async function moveDealStageAction(
  rawInput: z.input<typeof moveDealSchema>,
): Promise<ActionResult<MoveDealResultDTO>> {
  return runAction(async () => {
    const parsed = moveDealSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid move request.");
    }

    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    const result = await moveDealToStage(ctx, input);

    revalidatePath(`/${orgSlug}/crm/deals`);
    if (result.automation) {
      revalidatePath(`/${orgSlug}/finance/invoices`);
      revalidatePath(`/${orgSlug}/projects`);
    }

    return result;
  });
}

export async function createDealAction(
  rawInput: z.input<typeof createDealSchema>,
): Promise<ActionResult<CreateDealResultDTO>> {
  return runAction(async () => {
    const parsed = createDealSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid deal details.");
    }

    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    const result = await createDeal(ctx, input);

    revalidatePath(`/${orgSlug}/crm/deals`);
    if (result.automation) {
      revalidatePath(`/${orgSlug}/finance/invoices`);
      revalidatePath(`/${orgSlug}/projects`);
    }

    return result;
  });
}
