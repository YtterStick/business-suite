import { can } from "@/lib/rbac";
import { DealKanbanBoard } from "@/modules/crm/components/deal-kanban-board";
import { getKanbanBoard } from "@/modules/crm/deals.service";
import { requireTenant } from "@/server/tenancy";

interface DealsPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ pipeline?: string; new?: string }>;
}

export default async function DealsPipelinePage({ params, searchParams }: DealsPageProps) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const tenant = await requireTenant(orgSlug);
  const board = await getKanbanBoard(tenant, query.pipeline);

  return (
    <DealKanbanBoard
      orgSlug={orgSlug}
      defaultCurrency={tenant.organization.defaultCurrency}
      initialBoard={board}
      canWrite={can(tenant.role, "crm.deal.write")}
      openCreateInitially={query.new === "1"}
    />
  );
}
