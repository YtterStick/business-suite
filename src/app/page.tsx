import { redirect } from "next/navigation";

import { getSession } from "@/server/auth/session";
import { listUserOrganizations } from "@/server/tenancy";

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const orgs = await listUserOrganizations(session.user.id);
  const preferred =
    orgs.find((o) => o.id === session.user.lastActiveOrgId) ?? orgs[0];

  if (!preferred) {
    redirect("/login");
  }

  redirect(`/${preferred.slug}/crm/deals`);
}
