import { can } from "@/lib/rbac";
import { ItemsCatalogPanel } from "@/modules/finance/components/items-catalog-panel";
import { listCatalogItems } from "@/modules/finance/finance-suite.service";
import { requireTenant } from "@/server/tenancy";

export default async function ItemsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  const items = await listCatalogItems(tenant);

  return (
    <ItemsCatalogPanel
      orgSlug={orgSlug}
      defaultCurrency={tenant.organization.defaultCurrency}
      items={items}
      canWrite={can(tenant.role, "finance.invoice.write")}
    />
  );
}
