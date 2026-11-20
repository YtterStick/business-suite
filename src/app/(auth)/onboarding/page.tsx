import { redirect } from "next/navigation";

import { OnboardingForm } from "@/app/(auth)/onboarding/onboarding-form";
import { AuthShell } from "@/components/brand/auth-shell";
import { requireUser } from "@/server/auth/session";
import { listUserOrganizations } from "@/server/tenancy";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const orgs = await listUserOrganizations(user.id);
  if (orgs.length > 0) {
    const preferred = orgs.find((o) => o.id === user.lastActiveOrgId) ?? orgs[0]!;
    redirect(`/${preferred.slug}/projects`);
  }

  const { error } = await searchParams;
  const firstWord = user.name.trim().split(/\s+/)[0] || "Tactiq";
  const suggestedName = `${firstWord}'s Workspace`;

  return (
    <AuthShell>
      <OnboardingForm userName={user.name} suggestedName={suggestedName} error={error} />
    </AuthShell>
  );
}
