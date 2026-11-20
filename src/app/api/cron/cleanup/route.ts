import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
} as const;

async function handleCleanup(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const now = new Date();
  const [sessionsRes, invitationsRes] = await Promise.all([
    db.session.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    db.invitation.deleteMany({
      where: {
        acceptedAt: null,
        expiresAt: { lt: now },
      },
    }),
  ]);

  return NextResponse.json(
    {
      ok: true,
      deletedSessions: sessionsRes.count,
      deletedInvitations: invitationsRes.count,
      timestamp: now.toISOString(),
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

/** Daily maintenance cron to prune expired sessions and unaccepted invitations. */
export async function POST(request: NextRequest) {
  return handleCleanup(request);
}

export async function GET(request: NextRequest) {
  return handleCleanup(request);
}
