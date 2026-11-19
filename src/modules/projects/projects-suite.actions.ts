"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { ValidationError } from "@/lib/errors";
import {
  bulkReviewApprovalItems,
  createExpenseClaim,
  postApprovalComment,
  requestMilestoneSignoff,
  reviewApprovalItem,
  saveWeeklyTimesheet,
} from "@/modules/projects/projects-suite.service";
import { runAction } from "@/server/action";
import { assertTenant } from "@/server/tenancy";

const saveTimesheetSchema = z.object({
  orgSlug: z.string().min(1),
  weekStartIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  submitForApproval: z.boolean().default(false),
  notes: z.string().max(1000).nullable().optional(),
  entries: z.array(
    z.object({
      projectId: z.string().min(1),
      taskId: z.string().nullable().optional(),
      dayIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      hours: z.number().min(0).max(24),
    }),
  ),
});

export async function saveWeeklyTimesheetAction(
  rawInput: z.input<typeof saveTimesheetSchema>,
): Promise<ActionResult<{ id: string; status: string; totalHours: number }>> {
  return runAction(async () => {
    const parsed = saveTimesheetSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid timesheet entries.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    const res = await saveWeeklyTimesheet(ctx, input);
    revalidatePath(`/${orgSlug}/projects/timesheets`);
    revalidatePath(`/${orgSlug}/projects/time-logs`);
    revalidatePath(`/${orgSlug}/projects/approvals`);
    revalidatePath(`/${orgSlug}/projects/home`);
    revalidatePath(`/${orgSlug}/projects/reports`);
    return res;
  });
}

const expenseClaimSchema = z.object({
  orgSlug: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().trim().min(2, "Expense title is required.").max(160),
  category: z.string().trim().min(2).max(60),
  amount: z.coerce.number().positive("Amount must be greater than 0."),
  currency: z.string().length(3),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).nullable().optional(),
});

export async function createExpenseClaimAction(
  rawInput: z.input<typeof expenseClaimSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = expenseClaimSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid expense claim.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    await createExpenseClaim(ctx, input);
    revalidatePath(`/${orgSlug}/projects/approvals`);
    revalidatePath(`/${orgSlug}/projects/reports`);
    return null;
  });
}

export async function requestMilestoneSignoffAction(input: {
  orgSlug: string;
  milestoneId: string;
  notes?: string | null;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    await requestMilestoneSignoff(ctx, {
      milestoneId: input.milestoneId,
      notes: input.notes,
    });
    revalidatePath(`/${input.orgSlug}/projects/approvals`);
    revalidatePath(`/${input.orgSlug}/projects/milestones`);
    return null;
  });
}

export async function reviewApprovalAction(input: {
  orgSlug: string;
  kind: "timesheet" | "expense" | "milestone";
  id: string;
  decision: "APPROVED" | "REJECTED";
  reviewNotes?: string | null;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    await reviewApprovalItem(ctx, {
      kind: input.kind,
      id: input.id,
      decision: input.decision,
      reviewNotes: input.reviewNotes,
    });
    revalidatePath(`/${input.orgSlug}/projects/approvals`);
    revalidatePath(`/${input.orgSlug}/projects/timesheets`);
    revalidatePath(`/${input.orgSlug}/projects/milestones`);
    revalidatePath(`/${input.orgSlug}/projects/reports`);
    return null;
  });
}

export async function bulkReviewApprovalsAction(input: {
  orgSlug: string;
  kind: "timesheet" | "expense" | "milestone";
  ids: string[];
  decision: "APPROVED" | "REJECTED";
  reviewNotes?: string | null;
}): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    const result = await bulkReviewApprovalItems(ctx, {
      kind: input.kind,
      ids: input.ids,
      decision: input.decision,
      reviewNotes: input.reviewNotes,
    });
    revalidatePath(`/${input.orgSlug}/projects/approvals`);
    revalidatePath(`/${input.orgSlug}/projects/timesheets`);
    revalidatePath(`/${input.orgSlug}/projects/milestones`);
    revalidatePath(`/${input.orgSlug}/projects/reports`);
    return result;
  });
}

export async function postApprovalCommentAction(input: {
  orgSlug: string;
  kind: "timesheet" | "expense" | "milestone";
  id: string;
  body: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    await postApprovalComment(ctx, {
      kind: input.kind,
      id: input.id,
      body: input.body,
    });
    revalidatePath(`/${input.orgSlug}/projects/approvals`);
    return null;
  });
}
