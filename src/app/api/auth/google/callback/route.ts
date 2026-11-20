import { TaskPriority, TaskStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { recordAudit } from "@/server/audit";
import { createSession } from "@/server/auth/session";
import { listUserOrganizations } from "@/server/tenancy";

const OAUTH_COOKIE = "tq_google_oauth";

interface OAuthCookiePayload {
  state: string;
  codeVerifier: string;
  mode: "login" | "signup";
}

interface GoogleTokenResponse {
  access_token?: string;
}

interface GoogleUserInfo {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const origin = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/+$/, "");

  let parsedCookie: OAuthCookiePayload | null = null;
  const rawCookie = cookieStore.get(OAUTH_COOKIE)?.value;
  if (rawCookie) {
    try {
      parsedCookie = JSON.parse(rawCookie) as OAuthCookiePayload;
    } catch {
      parsedCookie = null;
    }
  }

  const mode = parsedCookie?.mode === "signup" ? "signup" : "login";

  const redirectError = (errorCode: string) => {
    cookieStore.delete(OAUTH_COOKIE);
    return NextResponse.redirect(new URL(`/${mode}?error=${errorCode}`, origin));
  };

  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError) {
    return redirectError(oauthError === "access_denied" ? "google_denied" : "google_failed");
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || !parsedCookie || parsedCookie.state !== state || !parsedCookie.codeVerifier) {
    return redirectError("google_state");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return redirectError("google_not_configured");
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: parsedCookie.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: `${origin}/api/auth/google/callback`,
      }),
    });

    if (!tokenRes.ok) {
      return redirectError("google_failed");
    }

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenData.access_token) {
      return redirectError("google_failed");
    }

    const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileRes.ok) {
      return redirectError("google_failed");
    }

    const profile = (await profileRes.json()) as GoogleUserInfo;
    if (!profile.email || profile.email_verified === false) {
      return redirectError("google_email_unverified");
    }

    const email = profile.email.trim().toLowerCase();
    const displayName = profile.name?.trim() || email.split("@")[0] || "Tactiq User";
    const avatarUrl = typeof profile.picture === "string" ? profile.picture : null;

    let userId: string;
    let lastActiveOrgId: string | null = null;

    const existingUser = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        lastActiveOrgId: true,
      },
    });

    if (existingUser) {
      userId = existingUser.id;
      lastActiveOrgId = existingUser.lastActiveOrgId;
      if ((!existingUser.avatarUrl && avatarUrl) || !existingUser.emailVerifiedAt) {
        await db.user.update({
          where: { id: existingUser.id },
          data: {
            ...(avatarUrl && !existingUser.avatarUrl ? { avatarUrl } : {}),
            ...(!existingUser.emailVerifiedAt ? { emailVerifiedAt: new Date() } : {}),
          },
        });
      }
    } else {
      const user = await db.user.create({
        data: {
          name: displayName,
          email,
          avatarUrl,
          passwordHash: null,
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      });
      userId = user.id;
    }

    const now = new Date();
    const pendingInvites = await db.invitation.findMany({
      where: {
        email,
        acceptedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        organizationId: true,
        email: true,
        role: true,
        userType: true,
        portalProfile: true,
        assignedProjectId: true,
      },
    });

    if (pendingInvites.length > 0) {
      lastActiveOrgId = await db.$transaction(async (tx) => {
        let latestOrgId = lastActiveOrgId;
        for (const inv of pendingInvites) {
          await tx.membership.upsert({
            where: {
              organizationId_userId: {
                organizationId: inv.organizationId,
                userId,
              },
            },
            create: {
              organizationId: inv.organizationId,
              userId,
              role: inv.role,
              userType: inv.userType,
              portalProfile: inv.portalProfile,
              isActive: true,
            },
            update: {
              isActive: true,
            },
          });

          if (inv.assignedProjectId) {
            const proj = await tx.project.findUnique({
              where: {
                id_organizationId: {
                  id: inv.assignedProjectId,
                  organizationId: inv.organizationId,
                },
              },
              select: { id: true },
            });
            if (proj) {
              await tx.task.create({
                data: {
                  organizationId: inv.organizationId,
                  projectId: proj.id,
                  assigneeId: userId,
                  title: `Join project kickoff (${inv.email})`,
                  status: TaskStatus.TODO,
                  priority: TaskPriority.MEDIUM,
                  position: 1024,
                },
              });
            }
          }

          await tx.invitation.update({
            where: { id: inv.id },
            data: { acceptedAt: now },
          });

          await recordAudit(tx, {
            organizationId: inv.organizationId,
            actorId: userId,
            entityType: "Invitation",
            entityId: inv.id,
            action: "org.invitation_accepted",
            metadata: { role: inv.role, via: "google" },
          });

          latestOrgId = inv.organizationId;
        }

        if (latestOrgId) {
          await tx.user.update({
            where: { id: userId },
            data: { lastActiveOrgId: latestOrgId },
          });
        }
        return latestOrgId;
      });
    }

    const orgs = await listUserOrganizations(userId);
    const preferred = orgs.find((o) => o.id === lastActiveOrgId) ?? orgs[0];
    const redirectPath = preferred ? `/${preferred.slug}/projects` : "/onboarding";

    cookieStore.delete(OAUTH_COOKIE);
    await createSession(userId, {
      userAgent: req.headers.get("user-agent"),
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    return NextResponse.redirect(new URL(redirectPath, origin));
  } catch {
    return redirectError("google_failed");
  }
}
