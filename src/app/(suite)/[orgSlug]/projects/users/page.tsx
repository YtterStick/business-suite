import { toIsoDate } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { UsersPanel } from "@/modules/org/components/users-panel";
import { listOrganizationTeam } from "@/modules/org/team.service";
import { requireTenant } from "@/server/tenancy";

export default async function UsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { orgSlug } = await params;
  const { invite } = await searchParams;
  const tenant = await requireTenant(orgSlug);
  const team = await listOrganizationTeam(tenant);

  return (
    <UsersPanel
      orgSlug={orgSlug}
      orgName={tenant.organization.name}
      todayIso={toIsoDate(new Date())}
      team={team}
      canManage={can(tenant.role, "org.members.manage")}
      openInviteInitially={invite === "1"}
    />
  );
}
