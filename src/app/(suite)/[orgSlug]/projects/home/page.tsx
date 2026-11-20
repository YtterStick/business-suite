import { isClientUser } from "@/lib/rbac";
import { ProjectsHomeDashboard } from "@/modules/projects/components/projects-home-dashboard";
import { getProjectsHome } from "@/modules/projects/projects-suite.service";
import { requireTenant } from "@/server/tenancy";

export default async function ProjectsHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  const home = await getProjectsHome(tenant);

  return (
    <ProjectsHomeDashboard
      orgSlug={orgSlug}
      orgName={tenant.organization.name}
      firstName={tenant.user.name.split(" ")[0] ?? tenant.user.name}
      isClient={isClientUser(tenant)}
      home={home}
    />
  );
}
