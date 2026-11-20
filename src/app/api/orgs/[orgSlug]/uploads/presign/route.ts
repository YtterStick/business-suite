import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AppError, ForbiddenError } from "@/lib/errors";
import {
  createR2PresignedPutUrl,
  isR2Configured,
  R2_ALLOWED_CONTENT_TYPES,
  R2_ALLOWED_FOLDERS,
  R2_MAX_UPLOAD_BYTES,
} from "@/lib/r2";
import { can } from "@/lib/rbac";
import { assertTenant } from "@/server/tenancy";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

const presignSchema = z.object({
  filename: z.string().trim().min(1, "Filename is required.").max(180),
  contentType: z.enum(R2_ALLOWED_CONTENT_TYPES, {
    message: "Unsupported file type for upload.",
  }),
  sizeBytes: z
    .number()
    .int()
    .positive("File size must be greater than zero.")
    .max(R2_MAX_UPLOAD_BYTES, "File exceeds the 25 MB upload limit."),
  folder: z.enum(R2_ALLOWED_FOLDERS).default("attachments"),
});

/** Issues a short-lived Cloudflare R2 presigned PUT URL for direct browser uploads. */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await context.params;
    const tenant = await assertTenant(orgSlug);

    const canUpload =
      can(tenant, "projects.project.write") ||
      can(tenant, "projects.issue.write") ||
      can(tenant, "projects.comment.write");
    if (!canUpload) {
      throw new ForbiddenError("You do not have permission to upload files.");
    }

    if (!isR2Configured()) {
      return NextResponse.json(
        {
          error:
            "Cloudflare R2 storage is not configured on this server. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.",
        },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    const body: unknown = await request.json();
    const parsed = presignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid upload request." },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (
      parsed.data.folder === "receipts" &&
      !can(tenant, "finance.invoice.write") &&
      !can(tenant, "projects.project.write")
    ) {
      throw new ForbiddenError("You do not have permission to upload financial receipts.");
    }

    const presigned = createR2PresignedPutUrl({
      organizationId: tenant.organization.id,
      folder: parsed.data.folder,
      filename: parsed.data.filename,
      expiresInSeconds: 300,
    });

    return NextResponse.json(
      {
        uploadUrl: presigned.uploadUrl,
        publicUrl: presigned.publicUrl,
        key: presigned.key,
        method: "PUT",
        expiresInSeconds: presigned.expiresInSeconds,
        headers: {
          "Content-Type": parsed.data.contentType,
        },
      },
      { status: 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof AppError) {
      const status =
        error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: error.message }, { status, headers: NO_STORE_HEADERS });
    }
    console.error("[api/uploads/presign] error", error);
    return NextResponse.json(
      { error: "Failed to prepare file upload." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
