import "server-only";

import { cache } from "react";

import { getSession } from "@/server/auth/session";
import { listUserOrganizations } from "@/server/tenancy";

export interface MarketingViewer {
  name: string;
  workspaceHref: string;
  workspaceSlug: string | null;
  workspaceName: string | null;
}

/**
 * Resolves the signed-in visitor (if any) for public marketing & docs pages so
 * the navbar can offer "Open Workspace" instead of Log In / Sign Up.
 * Never throws — public pages must render even if the session store is down.
 */
export const getMarketingViewer = cache(async (): Promise<MarketingViewer | null> => {
  try {
    const session = await getSession();
    if (!session) return null;
    const orgs = await listUserOrganizations(session.user.id);
    const preferred = orgs.find((o) => o.id === session.user.lastActiveOrgId) ?? orgs[0];
    return {
      name: session.user.name,
      workspaceHref: preferred ? `/${preferred.slug}/projects` : "/onboarding",
      workspaceSlug: preferred?.slug ?? null,
      workspaceName: preferred?.name ?? null,
    };
  } catch {
    return null;
  }
});
