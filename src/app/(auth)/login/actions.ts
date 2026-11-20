"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";
import { can } from "@/lib/rbac";
import { runAction } from "@/server/action";
import { getDummyPasswordHash, verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { listUserOrganizations } from "@/server/tenancy";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address.").toLowerCase(),
  password: z.string().min(1, "Password is required."),
});

export async function loginAction(
  rawInput: z.input<typeof loginSchema>,
): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const parsed = loginSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid credentials.");
    }

    const { email, password } = parsed.data;
    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        passwordHash: true,
        lastActiveOrgId: true,
      },
    });

    const passwordHash = user?.passwordHash ?? (await getDummyPasswordHash());
    const valid = await verifyPassword(password, passwordHash);

    if (user && !user.passwordHash) {
      throw new ValidationError(
        "This account uses Google Sign-In. Please click Continue with Google.",
      );
    }

    if (!user || !user.passwordHash || !valid) {
      throw new ValidationError("Invalid email or password.");
    }

    const reqHeaders = await headers();
    await createSession(user.id, {
      userAgent: reqHeaders.get("user-agent"),
      ipAddress: reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    const orgs = await listUserOrganizations(user.id);
    const preferred = orgs.find((o) => o.id === user.lastActiveOrgId) ?? orgs[0];
    if (!preferred) {
      redirect("/onboarding");
    }

    const redirectTo = can(preferred, "crm.deal.read")
      ? `/${preferred.slug}/crm/deals`
      : `/${preferred.slug}/projects`;
    redirect(redirectTo);
  });
}
