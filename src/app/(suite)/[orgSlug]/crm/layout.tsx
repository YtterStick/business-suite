import * as React from "react";
import { redirect } from "next/navigation";

import { can } from "@/lib/rbac";
import { requireTenant } from "@/server/tenancy";

export default async function CrmLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  if (!can(tenant, "crm.deal.read")) {
    redirect(`/${orgSlug}/projects`);
  }
  return <>{children}</>;
}
