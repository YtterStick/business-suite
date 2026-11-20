import { redirect } from "next/navigation";

import { isClientUser } from "@/lib/rbac";
import { requireTenant } from "@/server/tenancy";

export default async function OrgRootPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  redirect(isClientUser(tenant) ? `/${orgSlug}/projects` : `/${orgSlug}/home`);
}
