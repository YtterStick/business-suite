import "server-only";

import { cache } from "react";

import { isClientUser } from "@/lib/rbac";
import { getSession } from "@/server/auth/session";
import { listUserOrganizations } from "@/server/tenancy";

export interface MarketingViewer {
  name: string;
  workspaceHref: string;
  workspaceSlug: string | null;
  workspaceName: string | null;
}

export const getMarketingViewer = cache(async (): Promise<MarketingViewer | null> => {
  try {
    const session = await getSession();
    if (!session) return null;
    const orgs = await listUserOrganizations(session.user.id);
    const preferred = orgs.find((o) => o.id === session.user.lastActiveOrgId) ?? orgs[0];
    const workspaceHref = preferred
      ? isClientUser(preferred)
        ? `/${preferred.slug}/projects`
        : `/${preferred.slug}/home`
      : "/onboarding";
    return {
      name: session.user.name,
      workspaceHref,
      workspaceSlug: preferred?.slug ?? null,
      workspaceName: preferred?.name ?? null,
    };
  } catch {
    return null;
  }
});
