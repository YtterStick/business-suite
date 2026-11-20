import { can } from "@/lib/rbac";
import { InvoicesWorkspace } from "@/modules/finance/components/invoices-workspace";
import { getInvoicesWorkspace } from "@/modules/finance/invoices.service";
import { requireTenant } from "@/server/tenancy";

interface InvoicesPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ highlight?: string; new?: string }>;
}

export default async function InvoicesPage({ params, searchParams }: InvoicesPageProps) {
  const { orgSlug } = await params;
  const { highlight, new: newParam } = await searchParams;
  const tenant = await requireTenant(orgSlug);
  const workspace = await getInvoicesWorkspace(tenant);

  return (
    <InvoicesWorkspace
      orgSlug={orgSlug}
      workspace={workspace}
      canWrite={can(tenant, "finance.invoice.write")}
      canVoid={can(tenant, "finance.invoice.void")}
      openCreateInitially={newParam === "1"}
      highlightInvoiceId={highlight}
    />
  );
}
