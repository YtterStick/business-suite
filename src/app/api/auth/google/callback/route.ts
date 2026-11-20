import { MembershipRole, PortalProfile } from "@prisma/client";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { db, type Tx } from "@/lib/db";
import { ensureDefaultPipeline } from "@/modules/crm/deals.service";
import { createSession } from "@/server/auth/session";
import { listUserOrganizations, RESERVED_ORG_SLUGS } from "@/server/tenancy";

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

function toSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "workspace";
}

async function provisionWorkspace(tx: Tx, userId: string, displayName: string): Promise<string> {
  const firstWord = displayName.trim().split(/\s+/)[0] || "Tactiq";
  const orgName = `${firstWord}'s Workspace`;
  const baseSlug = toSlug(orgName);
  let slug = RESERVED_ORG_SLUGS.has(baseSlug) ? `${baseSlug}-org` : baseSlug;

  const slugTaken = await tx.organization.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (slugTaken) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const org = await tx.organization.create({
    data: {
      name: orgName,
      slug,
      defaultCurrency: "USD",
      timezone: "UTC",
    },
    select: { id: true, slug: true },
  });

  await tx.membership.create({
    data: {
      organizationId: org.id,
      userId,
      role: MembershipRole.OWNER,
      portalProfile: PortalProfile.PORTAL_OWNER,
    },
  });

  await tx.user.update({
    where: { id: userId },
    data: { lastActiveOrgId: org.id },
  });

  await ensureDefaultPipeline(tx, org.id);
  return org.slug;
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

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
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
    let redirectSlug: string;

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
      if ((!existingUser.avatarUrl && avatarUrl) || !existingUser.emailVerifiedAt) {
        await db.user.update({
          where: { id: existingUser.id },
          data: {
            ...(avatarUrl && !existingUser.avatarUrl ? { avatarUrl } : {}),
            ...(!existingUser.emailVerifiedAt ? { emailVerifiedAt: new Date() } : {}),
          },
        });
      }

      const orgs = await listUserOrganizations(existingUser.id);
      const preferred = orgs.find((o) => o.id === existingUser.lastActiveOrgId) ?? orgs[0];
      if (preferred) {
        redirectSlug = preferred.slug;
      } else {
        redirectSlug = await db.$transaction((tx) =>
          provisionWorkspace(tx, existingUser.id, displayName),
        );
      }
    } else {
      const created = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: displayName,
            email,
            avatarUrl,
            passwordHash: null,
            emailVerifiedAt: new Date(),
          },
          select: { id: true },
        });
        const orgSlug = await provisionWorkspace(tx, user.id, displayName);
        return { userId: user.id, orgSlug };
      });
      userId = created.userId;
      redirectSlug = created.orgSlug;
    }

    cookieStore.delete(OAUTH_COOKIE);
    await createSession(userId, {
      userAgent: req.headers.get("user-agent"),
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    return NextResponse.redirect(new URL(`/${redirectSlug}/projects`, origin));
  } catch {
    return redirectError("google_failed");
  }
}
