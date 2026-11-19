import { notFound } from "next/navigation";

import { toIsoDate } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { SingleProjectWorkspace } from "@/modules/projects/components/single-project-workspace";
import { getSingleProjectWorkspace } from "@/modules/projects/projects.service";
import { requireTenant } from "@/server/tenancy";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectId: string }>;
}) {
  const { orgSlug, projectId } = await params;
  const tenant = await requireTenant(orgSlug);
  const workspace = await getSingleProjectWorkspace(tenant, projectId);

  if (!workspace) notFound();

  return (
    <SingleProjectWorkspace
      orgSlug={orgSlug}
      orgName={tenant.organization.name}
      todayIso={toIsoDate(new Date())}
      canWrite={can(tenant.role, "projects.project.write")}
      canManageUsers={can(tenant.role, "org.members.manage")}
      data={workspace}
    />
  );
}
