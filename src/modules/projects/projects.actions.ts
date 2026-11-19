"use server";

import {
  IssueSeverity,
  IssueStatus,
  MilestoneStatus,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { ValidationError } from "@/lib/errors";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import {
  createIssue,
  createMilestone,
  createProject,
  createTask,
  createTimeLog,
  deleteCommentItem,
  moveTaskStatus,
  postComment,
  toggleProjectArchive,
  updateCommentBody,
  updateIssueStatus,
  updateMilestoneStatus,
  updateProject,
  updateProjectStatus,
  updateTaskDetails,
} from "@/modules/projects/projects.service";
import type { TaskCardDTO } from "@/modules/projects/projects.types";
import { runAction } from "@/server/action";
import { assertTenant } from "@/server/tenancy";

const createProjectSchema = z.object({
  orgSlug: z.string().min(1),
  name: z.string().trim().min(2, "Project title must be at least 2 characters.").max(180),
  description: z.string().max(16000).nullable().optional(),
  ownerId: z.string().nullable().optional(),
  template: z
    .enum([
      "NONE",
      "CLIENT_ONBOARDING",
      "SOFTWARE_DELIVERY",
      "MARKETING_LAUNCH",
      "FINANCE_ERP_ROLLOUT",
      "SECURITY_AUDIT",
    ])
    .default("NONE"),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  isStrict: z.boolean().default(false),
  isPublic: z.boolean().default(false),
  rollupEnabled: z.boolean().default(true),
  businessHours: z.string().max(100).optional(),
  taskLayout: z.string().max(100).optional(),
  enabledTabs: z.array(z.string()).optional(),
  customPhases: z
    .array(
      z.object({
        name: z.string().min(1).max(150),
        offsetDays: z.number().int().min(0).max(730),
        tasks: z.array(z.string().min(1).max(200)).max(25),
      }),
    )
    .max(20)
    .optional(),
  groupId: z.string().nullable().optional(),
  newGroupName: z.string().max(80).nullable().optional(),
  tags: z.array(z.string()).optional(),
  budget: z.coerce.number().min(0).nullable().optional(),
  currency: z.string().length(3).optional(),
  companyId: z.string().nullable().optional(),
  dealId: z.string().nullable().optional(),
});

export async function createProjectAction(
  rawInput: z.input<typeof createProjectSchema>,
): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction(async () => {
    const parsed = createProjectSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid project details.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    const created = await createProject(ctx, {
      ...input,
      description: input.description ? sanitizeRichHtml(input.description) : null,
    });
    revalidatePath(`/${orgSlug}/projects`);
    revalidatePath(`/${orgSlug}/projects/tasks`);
    revalidatePath(`/${orgSlug}/projects/milestones`);
    return created;
  });
}

export async function toggleProjectArchiveAction(input: {
  orgSlug: string;
  projectId: string;
  isArchived: boolean;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    await toggleProjectArchive(ctx, input.projectId, input.isArchived);
    revalidatePath(`/${input.orgSlug}/projects`);
    return null;
  });
}

export async function updateProjectStatusAction(input: {
  orgSlug: string;
  projectId: string;
  status: ProjectStatus;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    await updateProjectStatus(ctx, input.projectId, input.status);
    revalidatePath(`/${input.orgSlug}/projects`, "layout");
    return null;
  });
}

const updateProjectSchema = z.object({
  orgSlug: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().trim().min(2, "Project title must be at least 2 characters.").max(180),
  description: z.string().max(16000).nullable().optional(),
  status: z.nativeEnum(ProjectStatus),
  ownerId: z.string().nullable().optional(),
  groupId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  budget: z.coerce.number().min(0).nullable().optional(),
  currency: z.string().length(3).optional(),
  isStrict: z.boolean().default(false),
  isPublic: z.boolean().default(false),
  rollupEnabled: z.boolean().default(true),
  businessHours: z.string().max(100).optional(),
  taskLayout: z.string().max(100).optional(),
  enabledTabs: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export async function updateProjectAction(
  rawInput: z.input<typeof updateProjectSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = updateProjectSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid project details.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    await updateProject(ctx, {
      ...input,
      description: input.description ? sanitizeRichHtml(input.description) : null,
    });
    revalidatePath(`/${orgSlug}/projects`, "layout");
    return null;
  });
}

export async function updateMilestoneStatusAction(input: {
  orgSlug: string;
  milestoneId: string;
  status: MilestoneStatus;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    await updateMilestoneStatus(ctx, input.milestoneId, input.status);
    revalidatePath(`/${input.orgSlug}/projects`, "layout");
    return null;
  });
}

const createTaskSchema = z.object({
  orgSlug: z.string().min(1),
  projectId: z.string().min(1),
  milestoneId: z.string().nullable().optional(),
  title: z.string().trim().min(2, "Task title must be at least 2 characters.").max(180),
  description: z.string().max(2000).nullable().optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export async function createTaskAction(
  rawInput: z.input<typeof createTaskSchema>,
): Promise<ActionResult<TaskCardDTO>> {
  return runAction(async () => {
    const parsed = createTaskSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid task details.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    const task = await createTask(ctx, input);
    revalidatePath(`/${orgSlug}/projects`, "layout");
    return task;
  });
}

export async function moveTaskStatusAction(input: {
  orgSlug: string;
  taskId: string;
  status: TaskStatus;
  position?: number;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    await moveTaskStatus(ctx, {
      taskId: input.taskId,
      status: input.status,
      position: input.position,
    });
    revalidatePath(`/${input.orgSlug}/projects`, "layout");
    return null;
  });
}

const updateTaskDetailsSchema = z.object({
  orgSlug: z.string().min(1),
  taskId: z.string().min(1),
  title: z.string().trim().min(2, "Task title is required.").max(180),
  description: z.string().max(4000).nullable().optional(),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(TaskPriority),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export async function updateTaskDetailsAction(
  rawInput: z.input<typeof updateTaskDetailsSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = updateTaskDetailsSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid task update.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    await updateTaskDetails(ctx, input);
    revalidatePath(`/${orgSlug}/projects`, "layout");
    return null;
  });
}

const createIssueSchema = z.object({
  orgSlug: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().trim().min(2, "Issue title is required.").max(180),
  description: z.string().max(2000).nullable().optional(),
  severity: z.nativeEnum(IssueSeverity).default(IssueSeverity.MEDIUM),
  assigneeId: z.string().nullable().optional(),
});

export async function createIssueAction(
  rawInput: z.input<typeof createIssueSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = createIssueSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid issue.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    await createIssue(ctx, input);
    revalidatePath(`/${orgSlug}/projects`, "layout");
    return null;
  });
}

export async function updateIssueStatusAction(input: {
  orgSlug: string;
  issueId: string;
  status: IssueStatus;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    await updateIssueStatus(ctx, input.issueId, input.status);
    revalidatePath(`/${input.orgSlug}/projects`, "layout");
    return null;
  });
}

const timeLogSchema = z.object({
  orgSlug: z.string().min(1),
  projectId: z.string().min(1),
  taskId: z.string().nullable().optional(),
  hours: z.coerce.number().positive("Hours must be greater than 0.").max(24),
  billable: z.boolean().default(true),
  loggedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).nullable().optional(),
});

export async function createTimeLogAction(
  rawInput: z.input<typeof timeLogSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = timeLogSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid time log.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    await createTimeLog(ctx, input);
    revalidatePath(`/${orgSlug}/projects`, "layout");
    return null;
  });
}

const milestoneSchema = z.object({
  orgSlug: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().trim().min(2, "Phase name is required.").max(150),
  description: z.string().max(1000).nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export async function createMilestoneAction(
  rawInput: z.input<typeof milestoneSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = milestoneSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid phase details.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    await createMilestone(ctx, input);
    revalidatePath(`/${orgSlug}/projects`, "layout");
    return null;
  });
}

const commentSchema = z.object({
  orgSlug: z.string().min(1),
  entityType: z.enum(["Project", "Task", "Issue", "Deal", "Workspace"]),
  entityId: z.string().min(1),
  body: z.string().trim().min(1, "Comment cannot be empty.").max(2000),
});

export async function postCommentAction(
  rawInput: z.input<typeof commentSchema>,
): Promise<ActionResult<null>> {
  return runAction(async () => {
    const parsed = commentSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid comment.");
    }
    const { orgSlug, ...input } = parsed.data;
    const ctx = await assertTenant(orgSlug);
    await postComment(ctx, input);
    revalidatePath(`/${orgSlug}/projects`, "layout");
    return null;
  });
}

export async function toggleTaskMetaCommentAction(input: {
  orgSlug: string;
  commentId: string;
  body: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    await updateCommentBody(ctx, input.commentId, input.body);
    revalidatePath(`/${input.orgSlug}/projects`, "layout");
    return null;
  });
}

export async function deleteTaskMetaCommentAction(input: {
  orgSlug: string;
  commentId: string;
}): Promise<ActionResult<null>> {
  return runAction(async () => {
    const ctx = await assertTenant(input.orgSlug);
    await deleteCommentItem(ctx, input.commentId);
    revalidatePath(`/${input.orgSlug}/projects`, "layout");
    return null;
  });
}
