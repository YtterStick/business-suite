import { can } from "@/lib/rbac";
import { TimeLogsPanel } from "@/modules/projects/components/time-logs-panel";
import { listTimeLogs } from "@/modules/projects/projects.service";
import { requireTenant } from "@/server/tenancy";

export default async function TimeLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { orgSlug } = await params;
  const { new: newParam } = await searchParams;
  const tenant = await requireTenant(orgSlug);
  const data = await listTimeLogs(tenant);

  return (
    <TimeLogsPanel
      orgSlug={orgSlug}
      logs={data.logs}
      projects={data.projects}
      canWrite={can(tenant.role, "projects.project.write")}
      openCreateInitially={newParam === "1"}
    />
  );
}
