import "server-only";

import type { MembershipRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/lib/errors";
import { can, type Permission } from "@/lib/rbac";
import { getSession, type SessionUser } from "@/server/auth/session";

/**
 * The tenant context is the ONLY way services learn which organization they
 * operate on. It is derived from the authenticated session + a verified
 * membership — never from client-supplied organization ids.
 */
export interface TenantContext {
  user: SessionUser;
  organization: {
    id: string;
    name: string;
    slug: string;
    defaultCurrency: string;
    timezone: string;
  };
  membershipId: string;
  role: MembershipRole;
}

/** Slugs that collide with top-level routes and must never be assigned to an organization. */
export const RESERVED_ORG_SLUGS = new Set(["api", "login", "logout", "signup", "invite", "_next", "static"]);

export const getTenant = cache(async (orgSlug: string): Promise<TenantContext | null> => {
  const session = await getSession();
  if (!session) return null;

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, isActive: true, organization: { slug: orgSlug } },
    select: {
      id: true,
      role: true,
      organization: {
        select: { id: true, name: true, slug: true, defaultCurrency: true, timezone: true },
      },
    },
  });
  if (!membership) return null;

  return {
    user: session.user,
    organization: membership.organization,
    membershipId: membership.id,
    role: membership.role,
  };
});

/** For Server Components / layouts: redirects to login or renders 404. */
export async function requireTenant(orgSlug: string): Promise<TenantContext> {
  const session = await getSession();
  if (!session) redirect("/login");

  const tenant = await getTenant(orgSlug);
  if (!tenant) notFound();
  return tenant;
}

/** For server actions / route handlers: throws typed errors instead. */
export async function assertTenant(orgSlug: string): Promise<TenantContext> {
  const session = await getSession();
  if (!session) throw new UnauthenticatedError();

  const tenant = await getTenant(orgSlug);
  if (!tenant) throw new NotFoundError("Organization not found.");
  return tenant;
}

export function authorize(ctx: TenantContext, permission: Permission): void {
  if (!can(ctx.role, permission)) {
    throw new ForbiddenError(`Your role does not allow this action (${permission}).`);
  }
}

export async function listUserOrganizations(userId: string) {
  const memberships = await db.membership.findMany({
    where: { userId, isActive: true },
    orderBy: { organization: { name: "asc" } },
    select: { role: true, organization: { select: { id: true, name: true, slug: true } } },
  });
  return memberships.map((m) => ({ ...m.organization, role: m.role }));
}
