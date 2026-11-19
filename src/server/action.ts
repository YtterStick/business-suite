import "server-only";

import { unstable_rethrow } from "next/navigation";

import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";

/**
 * Executes server-action logic and maps failures onto a typed, serializable
 * result. Next.js control-flow errors (redirect / notFound) are re-thrown.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);

    if (error instanceof AppError) {
      return { ok: false, error: { code: error.code, message: error.message } };
    }

    console.error("[server-action] unhandled error", error);
    return {
      ok: false,
      error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
    };
  }
}
