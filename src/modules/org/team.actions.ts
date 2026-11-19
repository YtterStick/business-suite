"use server";

import { MembershipRole, PortalProfile, UserType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { ValidationError } from "@/lib/errors";
import {
  assignMemberToProject,
  createBatchInvitations,
  createInvitation,
  createTeamGroup,
  removeMemberFromOrg,
  revokeInvitation,
  sendQuickChatNote,
  setMembersActiveStatus,
  updateMemberRole,
} from "@/modules/org/team.service";
import { db } from "@/lib/db";
import { recordAudit } from "@/server/audit";
import { runAction } from "@/server/action";
import { assertTenant, authorize } from "@/server/tenancy";

const inviteSchema = z.object({
  orgSlug: z.string().min(1),
  email: z.string().trim().email("Please enter a valid email address."),
  role: z.nativeEnum(MembershipRole),
  userType: z.nativeEnum(UserType).default(UserType.PORTAL),
  portalProfile: z.nativeEnum(PortalProfile).default(PortalProfile.STANDARD),
  assignedProjectId: z.string().nullable().optional(),
});

const batchInviteSchema = z.object({
  orgSlug: z.string().min(1),
  items: z
    .array(
      z.object({
        email: z.string().trim().email("Invalid email in batch."),
        role: z.nativeEnum(MembershipRole).default(MembershipRole.MEMBER),
        userType: z.nativeEnum(UserType).default(UserType.PORTAL),
        portalProfile: z.nativeEnum(PortalProfile).default(PortalProfile.STANDARD),
        assignedProjectId: z.string().nullable().optional(),
      }),
    )
    .min(1, "Add at least one valid email address.")
    .max(50),
});

const memberUpdateSchema = z.object({
  orgSlug: z.string().min(1),
  membershipId: z.string().min(1),
  role: z.nativeEnum(MembershipRole).optional(),
  portalProfile: z.nativeEnum(PortalProfile).optional(),
  jobTitle: z.string().max(120).nullable().optional(),
  hourlyCostRate: z.coerce.number().min(0).max(1_000_000).optional(),
  weeklyCapacityHours: z.coerce.number().int().min(1).max(168).optional(),
});

const createTeamSchema = z.object({
  orgSlug: z.string().min(1),
  name: z.string().trim().min(2, "Team name must be at least 2 characters.").max(80),
  description: z.string().max(300).nullable().optional(),
  membershipIds: z.array(z.string()).default([]),
});

export async function inviteMemberAction(
  rawInput: z.input<typeof inviteSchema>,
): Promise<ActionResult<{ invitePath: string; email: string; role: MembershipRole }>> {
  return runAction(async () => {
    const parsed = inviteSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid invitation.");
    }

    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    const res = await createInvitation(ctx, input);
    revalidatePath(`/${orgSlug}/projects/users`);
    return { invitePath: res.invitePath, email: res.email, role: res.role };
  });
}

export async function inviteBatchAction(
  rawInput: z.input<typeof batchInviteSchema>,
): Promise<
  ActionResult<{
    created: Array<{ email: string; invitePath: string; role: MembershipRole }>;
    skipped: Array<{ email: string; reason: string }>;
  }>
> {
  return runAction(async () => {
    const parsed = batchInviteSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid batch invite.");
    }
    const { orgSlug, items } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    const res = await createBatchInvitations(ctx, { items });
    revalidatePath(`/${orgSlug}/projects/users`);
    return res;
  });
}

export async function updateMemberRoleAction(
  rawInput: z.input<typeof memberUpdateSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = memberUpdateSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid member update.");
    }

    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    await updateMemberRole(ctx, input);
    revalidatePath(`/${orgSlug}/projects/users`);
    return null;
  });
}

export async function setMembersActiveAction(input: {
  orgSlug: string;
  membershipIds: string[];
  isActive: boolean;
}): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    const count = await setMembersActiveStatus(ctx, input.membershipIds, input.isActive);
    revalidatePath(`/${input.orgSlug}/projects/users`);
    return { count };
  });
}

export async function removeMemberAction(input: {
  orgSlug: string;
  membershipId: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    await removeMemberFromOrg(ctx, input.membershipId);
    revalidatePath(`/${input.orgSlug}/projects/users`);
    return null;
  });
}

export async function assignMemberToProjectAction(input: {
  orgSlug: string;
  membershipId: string;
  projectId: string;
  asOwner: boolean;
}): Promise<ActionResult<{ projectName: string }>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    const projectName = await assignMemberToProject(ctx, input);
    revalidatePath(`/${input.orgSlug}/projects/users`);
    revalidatePath(`/${input.orgSlug}/projects`);
    return { projectName };
  });
}

export async function sendQuickChatAction(input: {
  orgSlug: string;
  targetUserName: string;
  message: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    if (!input.message.trim()) {
      throw new ValidationError("Message cannot be empty.");
    }
    const ctx = await assertTenant(input.orgSlug);
    await sendQuickChatNote(ctx, input);
    revalidatePath(`/${input.orgSlug}/projects/collaboration`);
    return null;
  });
}

export async function createTeamGroupAction(
  rawInput: z.input<typeof createTeamSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = createTeamSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid team details.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    await createTeamGroup(ctx, input);
    revalidatePath(`/${orgSlug}/projects/users`);
    return null;
  });
}

export async function revokeInvitationAction(input: {
  orgSlug: string;
  invitationId: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    await revokeInvitation(ctx, input.invitationId);
    revalidatePath(`/${input.orgSlug}/projects/users`);
    return null;
  });
}

const portalConfigSchema = z.object({
  orgSlug: z.string().min(1),
  name: z.string().trim().min(2, "Portal name must be at least 2 characters.").max(120),
  defaultCurrency: z.enum(["PHP", "USD"]),
  timezone: z.string().trim().min(2).max(60),
});

export async function updatePortalConfigAction(
  rawInput: z.input<typeof portalConfigSchema>,
): Promise<ActionResult<{ name: string; defaultCurrency: string; timezone: string }>> {
  return runAction(async () => {
    const parsed = portalConfigSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid portal configuration.");
    }
    const { orgSlug, name, defaultCurrency, timezone } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    authorize(ctx, "org.settings.manage");

    const updated = await db.$transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id: ctx.organization.id },
        data: { name, defaultCurrency, timezone },
        select: { name: true, defaultCurrency: true, timezone: true },
      });
      await recordAudit(tx, {
        organizationId: ctx.organization.id,
        actorId: ctx.user.id,
        entityType: "Organization",
        entityId: ctx.organization.id,
        action: "organization.portal_updated",
        metadata: { name, defaultCurrency, timezone },
      });
      return org;
    });

    revalidatePath(`/${orgSlug}`, "layout");
    return updated;
  });
}
