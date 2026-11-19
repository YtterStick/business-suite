import { toIsoDate } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { ApprovalsPanel } from "@/modules/projects/components/approvals-panel";
import { getApprovalsQueue } from "@/modules/projects/projects-suite.service";
import { requireTenant } from "@/server/tenancy";

export default async function ApprovalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ tab?: string; new?: string }>;
}) {
  const { orgSlug } = await params;
  const { tab, new: newParam } = await searchParams;
  const tenant = await requireTenant(orgSlug);
  const queue = await getApprovalsQueue(tenant);

  const defaultTab =
    tab === "expenses" || tab === "milestones" || tab === "timesheets" ? tab : undefined;

  return (
    <ApprovalsPanel
      orgSlug={orgSlug}
      defaultCurrency={tenant.organization.defaultCurrency}
      todayIso={toIsoDate(new Date())}
      queue={queue}
      canWrite={can(tenant.role, "projects.project.write")}
      canApprove={can(tenant.role, "org.members.manage")}
      defaultTab={defaultTab}
      openExpenseInitially={tab === "expenses" && newParam === "1"}
    />
  );
}
