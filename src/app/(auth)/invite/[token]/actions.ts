"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { acceptInvitationForUser, lookupInvitationByToken } from "@/modules/org/team.service";
import { runAction } from "@/server/action";
import { hashPassword } from "@/server/auth/password";
import { createSession, getSession } from "@/server/auth/session";

export async function acceptExistingUserInviteAction(
  token: string,
): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const session = await getSession();
    if (!session) {
      throw new ValidationError("Please sign in first.");
    }
    const { orgSlug } = await acceptInvitationForUser(token, session.user);
    redirect(`/${orgSlug}/projects`);
  });
}

const joinSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(2, "Full name must be at least 2 characters.").max(100),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

export async function registerAndAcceptInviteAction(
  rawInput: z.input<typeof joinSchema>,
): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const parsed = joinSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid details.");
    }

    const { token, name, password } = parsed.data;
    const invitation = await lookupInvitationByToken(token);
    if (!invitation) {
      throw new ValidationError("This invitation is invalid or has expired.");
    }

    const existing = await db.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });
    if (existing) {
      throw new ValidationError("An account already exists for this email. Please sign in to accept.");
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        name,
        email: invitation.email,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
      select: { id: true, email: true },
    });

    const reqHeaders = await headers();
    await createSession(user.id, {
      userAgent: reqHeaders.get("user-agent"),
      ipAddress: reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    const { orgSlug } = await acceptInvitationForUser(token, user);
    redirect(`/${orgSlug}/projects`);
  });
}
