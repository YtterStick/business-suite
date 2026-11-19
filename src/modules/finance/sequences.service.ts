import "server-only";

import type { SequenceKind } from "@prisma/client";

import type { Tx } from "@/lib/db";

/**
 * Allocates the next monotonically increasing, gap-free document number for an
 * organization inside the caller's transaction.
 *
 * `DocumentSequence` stores the *next* unused sequence number (`nextValue`), so
 * an atomic `upsert` either inserts `nextValue = 2` (returning 1) or increments
 * `nextValue` by 1 and uses `row.nextValue - 1`.
 */
export async function allocateDocumentNumber(
  tx: Tx,
  organizationId: string,
  kind: SequenceKind,
  prefix: string,
): Promise<string> {
  const row = await tx.documentSequence.upsert({
    where: { organizationId_kind: { organizationId, kind } },
    create: {
      organizationId,
      kind,
      nextValue: 2,
    },
    update: {
      nextValue: { increment: 1 },
    },
    select: { nextValue: true },
  });

  const sequenceNumber = row.nextValue - 1;
  return `${prefix}${String(sequenceNumber).padStart(5, "0")}`;
}
