import { redirect } from "next/navigation";

import { createWorkspaceAction } from "@/app/(auth)/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight">Create your workspace</h1>
          <p className="text-sm text-muted-foreground">
            Welcome, {user.name}. Name your Tactiq workspace to get started.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <form action={createWorkspaceAction} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="workspaceName">Workspace Name</Label>
            <Input
              id="workspaceName"
              name="workspaceName"
              defaultValue={suggestedName}
              placeholder="e.g. Acme Studio"
              required
              minLength={2}
              maxLength={60}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="defaultCurrency">Default Currency</Label>
            <select
              id="defaultCurrency"
              name="defaultCurrency"
              defaultValue="USD"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="USD">USD ($)</option>
              <option value="PHP">PHP (₱)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="SGD">SGD (S$)</option>
            </select>
          </div>

          <Button type="submit" className="w-full">
            Create Workspace
          </Button>
        </form>
      </div>
    </div>
  );
}
