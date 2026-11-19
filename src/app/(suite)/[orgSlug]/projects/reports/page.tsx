import { ProjectsReportsClient } from "@/modules/projects/components/projects-reports-client";
import { getProjectsReports } from "@/modules/projects/projects-suite.service";
import { requireTenant } from "@/server/tenancy";

export default async function ProjectsReportsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  const reports = await getProjectsReports(tenant);

  return (
    <ProjectsReportsClient
      orgSlug={orgSlug}
      defaultCurrency={tenant.organization.defaultCurrency}
      reports={reports}
    />
  );
}
