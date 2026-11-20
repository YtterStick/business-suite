import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Validates `Authorization: Bearer <CRON_SECRET>` using constant-time comparison.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return false;

  const providedToken = authHeader.slice("Bearer ".length).trim();
  if (!providedToken) return false;

  const expectedBuf = Buffer.from(secret, "utf8");
  const providedBuf = Buffer.from(providedToken, "utf8");
  if (expectedBuf.length !== providedBuf.length) return false;

  return timingSafeEqual(expectedBuf, providedBuf);
}
