"use server";

import { MembershipRole, PortalProfile } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { ensureDefaultPipeline } from "@/modules/crm/deals.service";
import { requireUser } from "@/server/auth/session";
import { RESERVED_ORG_SLUGS } from "@/server/tenancy";

const createWorkspaceSchema = z.object({
  workspaceName: z.string().trim().min(2, "Workspace name must be at least 2 characters.").max(60),
  defaultCurrency: z.enum(["PHP", "USD", "EUR", "GBP", "SGD"]).default("USD"),
});

function toSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

export async function createWorkspaceAction(formData: FormData): Promise<void> {
  const user = await requireUser();

  const parsed = createWorkspaceSchema.safeParse({
    workspaceName: formData.get("workspaceName"),
    defaultCurrency: formData.get("defaultCurrency") || "USD",
  });

  if (!parsed.success) {
    redirect(`/onboarding?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid workspace name.")}`);
  }

  const baseSlug = toSlug(parsed.data.workspaceName);
  let slug = RESERVED_ORG_SLUGS.has(baseSlug) ? `${baseSlug}-org` : baseSlug;

  const orgSlug = await db.$transaction(async (tx) => {
    const slugTaken = await tx.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (slugTaken) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const org = await tx.organization.create({
      data: {
        name: parsed.data.workspaceName,
        slug,
        defaultCurrency: parsed.data.defaultCurrency,
        timezone: "UTC",
      },
      select: { id: true, slug: true },
    });

    await tx.membership.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: MembershipRole.OWNER,
        portalProfile: PortalProfile.PORTAL_OWNER,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { lastActiveOrgId: org.id },
    });

    await ensureDefaultPipeline(tx, org.id);
    return org.slug;
  });

  redirect(`/${orgSlug}/projects`);
}
