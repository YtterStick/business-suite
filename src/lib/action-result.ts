import type { AppErrorCode } from "@/lib/errors";

/** Serializable result envelope returned by every server action. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: AppErrorCode; message: string } };
