import { NextRequest, NextResponse } from "next/server";

import { AppError } from "@/lib/errors";
import { globalSearch } from "@/modules/search/search.service";
import { assertTenant } from "@/server/tenancy";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await context.params;
    const tenant = await assertTenant(orgSlug);
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const groups = await globalSearch(tenant, q);
    return NextResponse.json({ groups });
  } catch (error) {
    if (error instanceof AppError) {
      const status =
        error.code === "UNAUTHENTICATED"
          ? 401
          : error.code === "FORBIDDEN"
            ? 403
            : error.code === "NOT_FOUND"
              ? 404
              : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("[api/search] unhandled error", error);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
