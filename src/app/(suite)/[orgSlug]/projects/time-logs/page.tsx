import { toIsoDate } from "@/lib/dates";
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
  const query = await searchParams;
  const tenant = await requireTenant(orgSlug);
  const { logs, projects, tasks, defaultCurrency } = await listTimeLogs(tenant);

  return (
    <TimeLogsPanel
      orgSlug={orgSlug}
      todayIso={toIsoDate(new Date())}
      logs={logs}
      projects={projects}
      tasks={tasks}
      defaultCurrency={defaultCurrency}
      canWrite={can(tenant.role, "projects.project.write")}
      openCreateInitially={query.new === "1"}
    />
  );
}
