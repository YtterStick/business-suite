import { notFound, redirect } from "next/navigation";

import { toIsoDate } from "@/lib/dates";
import { ForbiddenError } from "@/lib/errors";
import { can, isClientUser } from "@/lib/rbac";
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
  let workspace;
  try {
    workspace = await getSingleProjectWorkspace(tenant, projectId);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      redirect(`/${orgSlug}/projects`);
    }
    throw err;
  }

  if (!workspace) notFound();

  return (
    <SingleProjectWorkspace
      orgSlug={orgSlug}
      orgName={tenant.organization.name}
      todayIso={toIsoDate(new Date())}
      canWrite={can(tenant, "projects.project.write")}
      canManageProject={can(tenant, "projects.project.manage")}
      canWriteIssues={can(tenant, "projects.issue.write")}
      canWriteComments={can(tenant, "projects.comment.write")}
      canManageUsers={can(tenant, "org.members.manage")}
      isOwner={tenant.role === "OWNER"}
      isClient={isClientUser(tenant)}
      data={workspace}
    />
  );
}
