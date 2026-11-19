import { toIsoDate } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { IssuesPanel } from "@/modules/projects/components/issues-panel";
import { listIssues } from "@/modules/projects/projects.service";
import { requireTenant } from "@/server/tenancy";

export default async function IssuesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { orgSlug } = await params;
  const { new: newParam } = await searchParams;
  const tenant = await requireTenant(orgSlug);
  const data = await listIssues(tenant);

  return (
    <IssuesPanel
      orgSlug={orgSlug}
      todayIso={toIsoDate(new Date())}
      issues={data.issues}
      projects={data.projects}
      members={data.members}
      canWrite={can(tenant.role, "projects.project.write")}
      openCreateInitially={newParam === "1"}
    />
  );
}
