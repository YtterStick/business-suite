import { redirect } from "next/navigation";

import { can } from "@/lib/rbac";
import { TimesheetsPanel } from "@/modules/projects/components/timesheets-panel";
import { getWeeklyTimesheet } from "@/modules/projects/projects-suite.service";
import { requireTenant } from "@/server/tenancy";

export default async function TimesheetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { orgSlug } = await params;
  const { week } = await searchParams;
  const tenant = await requireTenant(orgSlug);
  if (!can(tenant, "projects.time.read")) {
    redirect(`/${orgSlug}/projects`);
  }
  const data = await getWeeklyTimesheet(tenant, week);

  return (
    <TimesheetsPanel
      orgSlug={orgSlug}
      initialData={data}
      canWrite={can(tenant, "projects.project.write")}
    />
  );
}
