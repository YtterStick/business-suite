import { toIsoDate } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { ProjectsWorkspace } from "@/modules/projects/components/projects-workspace";
import { listProjectsWorkspace } from "@/modules/projects/projects.service";
import { requireTenant } from "@/server/tenancy";

interface ProjectsPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ highlight?: string; new?: string }>;
}

export default async function ProjectsPage({ params, searchParams }: ProjectsPageProps) {
  const { orgSlug } = await params;
  const { highlight, new: newParam } = await searchParams;
  const tenant = await requireTenant(orgSlug);
  const workspace = await listProjectsWorkspace(tenant);

  return (
    <ProjectsWorkspace
      orgSlug={orgSlug}
      defaultCurrency={tenant.organization.defaultCurrency}
      currentUserId={tenant.user.id}
      todayIso={toIsoDate(new Date())}
      canWrite={can(tenant.role, "projects.project.write")}
      workspace={workspace}
      openCreateInitially={newParam === "1"}
      highlightProjectId={highlight}
    />
  );
}
