import { can } from "@/lib/rbac";
import { ExpensesPanel } from "@/modules/finance/components/expenses-panel";
import { listFinanceExpenses } from "@/modules/finance/finance-suite.service";
import { requireTenant } from "@/server/tenancy";

export default async function ExpensesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  const data = await listFinanceExpenses(tenant);

  return (
    <ExpensesPanel
      orgSlug={orgSlug}
      data={data}
      canWrite={can(tenant.role, "finance.invoice.write")}
    />
  );
}
