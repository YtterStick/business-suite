"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { ValidationError } from "@/lib/errors";
import {
  convertExpensesToDraftInvoice,
  createCatalogItem,
  createFinanceExpense,
  toggleCatalogItemActive,
} from "@/modules/finance/finance-suite.service";
import { runAction } from "@/server/action";
import { assertTenant } from "@/server/tenancy";

const catalogItemSchema = z.object({
  orgSlug: z.string().min(1),
  sku: z.string().trim().min(1, "SKU is required.").max(40),
  name: z.string().trim().min(2, "Item name is required.").max(140),
  description: z.string().max(500).nullable().optional(),
  unitPrice: z.coerce.number().min(0, "Rate cannot be negative."),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  currency: z.string().length(3),
  unit: z.string().trim().min(1).max(30).default("unit"),
});

export async function createCatalogItemAction(
  rawInput: z.input<typeof catalogItemSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = catalogItemSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid catalog item.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    await createCatalogItem(ctx, input);
    revalidatePath(`/${orgSlug}/finance/items`);
    revalidatePath(`/${orgSlug}/finance/invoices`);
    return null;
  });
}

export async function toggleCatalogItemAction(input: {
  orgSlug: string;
  itemId: string;
  isActive: boolean;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    await toggleCatalogItemActive(ctx, input.itemId, input.isActive);
    revalidatePath(`/${input.orgSlug}/finance/items`);
    revalidatePath(`/${input.orgSlug}/finance/invoices`);
    return null;
  });
}

const expenseSchema = z.object({
  orgSlug: z.string().min(1),
  title: z.string().trim().min(2, "Expense title is required.").max(180),
  category: z.string().trim().min(2).max(60),
  vendor: z.string().max(120).nullable().optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0."),
  currency: z.string().length(3),
  billable: z.boolean().default(true),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projectId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function createFinanceExpenseAction(
  rawInput: z.input<typeof expenseSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = expenseSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid expense.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    await createFinanceExpense(ctx, input);
    revalidatePath(`/${orgSlug}/finance/expenses`);
    revalidatePath(`/${orgSlug}/finance/dashboard`);
    return null;
  });
}

export async function convertExpensesToInvoiceAction(input: {
  orgSlug: string;
  expenseIds: string[];
}): Promise<ActionResult<{ invoiceId: string; invoiceNumber: string }>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    const res = await convertExpensesToDraftInvoice(ctx, input.expenseIds);
    revalidatePath(`/${input.orgSlug}/finance/expenses`);
    revalidatePath(`/${input.orgSlug}/finance/invoices`);
    revalidatePath(`/${input.orgSlug}/finance/dashboard`);
    return res;
  });
}
