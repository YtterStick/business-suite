import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const OAUTH_COOKIE = "tq_google_oauth";

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") === "signup" ? "signup" : "login";
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const origin = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/+$/, "");

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL(`/${mode}?error=google_not_configured`, origin));
  }

  const state = randomBytes(24).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const redirectUri = `${origin}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );

  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, codeVerifier, mode }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return response;
}
