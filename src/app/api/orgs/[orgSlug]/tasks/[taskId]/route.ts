import { TaskPriority, TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import { moveTaskStatus, updateTaskDetails } from "@/modules/projects/projects.service";
import { assertTenant } from "@/server/tenancy";

const patchTaskSchema = z.object({
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().max(4000).nullable().optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  extendedStatus: z
    .enum([
      "DELAYED",
      "TODO",
      "IN_PROGRESS",
      "IN_REVIEW",
      "TO_BE_TESTED",
      "ON_HOLD",
      "DONE",
      "CANCELLED",
    ])
    .optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  position: z.number().optional(),
  reopenReason: z.string().max(500).nullable().optional(),
  isGraceUndo: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ orgSlug: string; taskId: string }> },
) {
  try {
    const { orgSlug, taskId } = await context.params;
    const ctx = await assertTenant(orgSlug);
    const body = await request.json();
    const parsed = patchTaskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid task update payload." },
        { status: 400 },
      );
    }

    const data = parsed.data;
    if (data.title !== undefined && data.status !== undefined && data.priority !== undefined) {
      await updateTaskDetails(ctx, {
        taskId,
        title: data.title,
        description: data.description,
        status: data.status,
        extendedStatus: data.extendedStatus,
        priority: data.priority,
        assigneeId: data.assigneeId,
        dueDate: data.dueDate,
        reopenReason: data.reopenReason,
        isGraceUndo: data.isGraceUndo,
      });
    } else if (data.status !== undefined) {
      await moveTaskStatus(ctx, {
        taskId,
        status: data.status,
        extendedStatus: data.extendedStatus,
        position: data.position,
        reopenReason: data.reopenReason,
        isGraceUndo: data.isGraceUndo,
      });
    } else {
      return NextResponse.json(
        { error: "Provide status (or full task fields) to update task." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      const httpStatus =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "UNAUTHENTICATED"
            ? 401
            : error.code === "NOT_FOUND"
              ? 404
              : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status: httpStatus });
    }
    console.error("[api/tasks/PATCH]", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
