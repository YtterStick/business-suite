import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
} as const;

/** Lightweight health probe for Render & Cloudflare keep-alive pings. */
export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: NO_STORE_HEADERS });
}

/**
 * Keep-alive & health endpoint.
 * Default response stays DB-free so 10-minute pings let Neon scale to zero;
 * pass `?db=1` (or `?deep=1`) with `Authorization: Bearer <CRON_SECRET>` to verify PostgreSQL.
 */
export async function GET(request: NextRequest) {
  const deepCheck =
    request.nextUrl.searchParams.get("db") === "1" ||
    request.nextUrl.searchParams.get("deep") === "1";

  if (!deepCheck) {
    return NextResponse.json(
      {
        ok: true,
        service: "tactiq",
        timestamp: new Date().toISOString(),
        uptimeSec: Math.round(process.uptime()),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  }

  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  const startedAt = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        ok: true,
        service: "tactiq",
        db: "connected",
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[api/health] DB check failed", error);
    return NextResponse.json(
      {
        ok: false,
        service: "tactiq",
        db: "error",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}
