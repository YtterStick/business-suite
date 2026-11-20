import { redirect } from "next/navigation";

import { can, isClientUser } from "@/lib/rbac";
import { WorkspaceHomeDashboard } from "@/modules/org/components/workspace-home-dashboard";
import { getWorkspaceHome } from "@/modules/org/workspace-home.service";
import { requireTenant } from "@/server/tenancy";

export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);

  if (isClientUser(tenant)) {
    redirect(`/${orgSlug}/projects`);
  }

  const home = await getWorkspaceHome(tenant);

  return (
    <WorkspaceHomeDashboard
      orgSlug={orgSlug}
      orgName={tenant.organization.name}
      firstName={tenant.user.name.split(" ")[0] ?? tenant.user.name}
      canManage={can(tenant, "projects.project.manage")}
      home={home}
    />
  );
}
