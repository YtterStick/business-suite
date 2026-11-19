"use server";

import { PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { ValidationError } from "@/lib/errors";
import {
  createManualInvoice,
  recordInvoicePayment,
  sendInvoices,
  updateDraftInvoice,
  voidInvoices,
} from "@/modules/finance/invoices.service";
import { runAction } from "@/server/action";
import { assertTenant } from "@/server/tenancy";

const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Item description is required.").max(300),
  quantity: z.coerce.number().positive("Quantity must be greater than 0.").max(1_000_000),
  unitPrice: z.coerce.number().min(0, "Rate cannot be negative.").max(1_000_000_000),
  discountRate: z.coerce.number().min(0).max(100).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

const upsertInvoiceSchema = z.object({
  orgSlug: z.string().min(1),
  invoiceId: z.string().optional(),
  companyId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  dealId: z.string().nullable().optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().length(3),
  notes: z.string().max(2000).nullable().optional(),
  terms: z.string().max(1000).nullable().optional(),
  sendImmediately: z.boolean().default(false),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item.").max(50),
});

export async function createInvoiceAction(
  rawInput: z.input<typeof upsertInvoiceSchema>,
): Promise<ActionResult<{ id: string; number: string }>> {
  return runAction(async () => {
    const parsed = upsertInvoiceSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid invoice details.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    const created = await createManualInvoice(ctx, input);
    revalidatePath(`/${orgSlug}/finance/invoices`);
    return created;
  });
}

export async function updateInvoiceAction(
  rawInput: z.input<typeof upsertInvoiceSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = upsertInvoiceSchema.safeParse(rawInput);
    if (!parsed.success || !parsed.data.invoiceId) {
      throw new ValidationError(
        parsed.success ? "Invoice ID is required." : (parsed.error.issues[0]?.message ?? "Invalid invoice."),
      );
    }
    const { orgSlug, invoiceId, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    await updateDraftInvoice(ctx, { ...input, invoiceId });
    revalidatePath(`/${orgSlug}/finance/invoices`);
    return null;
  });
}

export async function sendInvoicesAction(input: {
  orgSlug: string;
  invoiceIds: string[];
}): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    const count = await sendInvoices(ctx, input.invoiceIds);
    revalidatePath(`/${input.orgSlug}/finance/invoices`);
    return { count };
  });
}

export async function voidInvoicesAction(input: {
  orgSlug: string;
  invoiceIds: string[];
}): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    const count = await voidInvoices(ctx, input.invoiceIds);
    revalidatePath(`/${input.orgSlug}/finance/invoices`);
    return { count };
  });
}

const recordPaymentSchema = z.object({
  orgSlug: z.string().min(1),
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive("Payment amount must be greater than 0."),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.BANK_TRANSFER),
  reference: z.string().max(120).nullable().optional(),
  paidAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export async function recordPaymentAction(
  rawInput: z.input<typeof recordPaymentSchema>,
): Promise<ActionResult<{ status: string; amountPaid: number }>> {
  return runAction(async () => {
    const parsed = recordPaymentSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid payment details.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    const res = await recordInvoicePayment(ctx, input);
    revalidatePath(`/${orgSlug}/finance/invoices`);
    return res;
  });
}
