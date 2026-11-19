import { toIsoDate } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { PaymentsPanel } from "@/modules/finance/components/payments-panel";
import { listPaymentsReceived } from "@/modules/finance/finance-suite.service";
import { requireTenant } from "@/server/tenancy";

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  const data = await listPaymentsReceived(tenant);

  return (
    <PaymentsPanel
      orgSlug={orgSlug}
      todayIso={toIsoDate(new Date())}
      data={data}
      canWrite={can(tenant.role, "finance.invoice.write")}
    />
  );
}
