import { NextRequest, NextResponse } from "next/server";

import { destroySession } from "@/server/auth/session";

export async function POST(request: NextRequest) {
  await destroySession();
  const origin = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/+$/, "");
  return NextResponse.redirect(new URL("/login", origin), { status: 303 });
}
