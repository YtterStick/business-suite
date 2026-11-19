import { NextRequest, NextResponse } from "next/server";

import { destroySession } from "@/server/auth/session";

export async function POST(request: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
