"use server";

import { MembershipRole, PortalProfile } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { ConflictError, ValidationError } from "@/lib/errors";
import { ensureDefaultPipeline } from "@/modules/crm/deals.service";
import { runAction } from "@/server/action";
import { hashPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { RESERVED_ORG_SLUGS } from "@/server/tenancy";

const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Full name must be at least 2 characters.").max(100),
    email: z.string().trim().email("Please enter a valid email address.").toLowerCase(),
    password: z.string().min(8, "Password must be at least 8 characters.").max(128),
    confirmPassword: z.string().optional(),
    organizationName: z
      .string()
      .trim()
      .min(2, "Workspace name must be at least 2 characters.")
      .max(100),
    defaultCurrency: z.enum(["PHP", "USD", "EUR", "GBP", "SGD"]).default("USD"),
  })
  .refine((data) => data.confirmPassword === undefined || data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

function toSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

export async function signupAction(
  rawInput: z.input<typeof signupSchema>,
): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const parsed = signupSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid sign-up details.");
    }

    const { name, email, password, organizationName, defaultCurrency } = parsed.data;

    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictError("An account with this email already exists. Please sign in.");
    }

    const baseSlug = toSlug(organizationName);
    let slug = RESERVED_ORG_SLUGS.has(baseSlug) ? `${baseSlug}-org` : baseSlug;
    const slugTaken = await db.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (slugTaken) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const passwordHash = await hashPassword(password);

    const created = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
          defaultCurrency,
          timezone: defaultCurrency === "PHP" ? "Asia/Manila" : "UTC",
        },
        select: { id: true, slug: true },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          emailVerifiedAt: new Date(),
          lastActiveOrgId: org.id,
        },
        select: { id: true },
      });

      await tx.membership.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: MembershipRole.OWNER,
          portalProfile: PortalProfile.PORTAL_OWNER,
        },
      });

      await ensureDefaultPipeline(tx, org.id);

      return { userId: user.id, orgSlug: org.slug };
    });

    const reqHeaders = await headers();
    await createSession(created.userId, {
      userAgent: reqHeaders.get("user-agent"),
      ipAddress: reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    const redirectTo = `/${created.orgSlug}/projects`;
    redirect(redirectTo);
  });
}
