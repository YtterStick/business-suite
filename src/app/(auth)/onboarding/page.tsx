import { redirect } from "next/navigation";

import { OnboardingForm } from "@/app/(auth)/onboarding/onboarding-form";
import { AuthShell } from "@/components/brand/auth-shell";
import { requireUser } from "@/server/auth/session";
import { listUserOrganizations } from "@/server/tenancy";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; new?: string }>;
}) {
  const user = await requireUser();
  const { error, new: isNew } = await searchParams;
  const orgs = await listUserOrganizations(user.id);
  if (orgs.length > 0 && isNew !== "1") {
    const preferred = orgs.find((o) => o.id === user.lastActiveOrgId) ?? orgs[0]!;
    redirect(`/${preferred.slug}/projects`);
  }

  return (
    <AuthShell>
      <OnboardingForm userName={user.name} error={error} />
    </AuthShell>
  );
}
