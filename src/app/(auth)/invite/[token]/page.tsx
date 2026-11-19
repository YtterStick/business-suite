import Link from "next/link";

import { InviteAcceptanceCard } from "@/app/(auth)/invite/[token]/invite-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { lookupInvitationByToken } from "@/modules/org/team.service";
import { getSession } from "@/server/auth/session";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [invitation, session] = await Promise.all([
    lookupInvitationByToken(token),
    getSession(),
  ]);

  if (!invitation) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Invitation Unavailable</CardTitle>
            <CardDescription>
              This invitation link is invalid, has already been accepted, or expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="text-sm font-medium text-primary hover:underline">
              Go to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <InviteAcceptanceCard
        token={token}
        organizationName={invitation.organization.name}
        invitedEmail={invitation.email}
        role={invitation.role}
        invitedByName={invitation.invitedBy?.name ?? null}
        signedInEmail={session?.user.email ?? null}
      />
    </div>
  );
}
