import "server-only";

import type { Prisma } from "@prisma/client";

import type { Tx } from "@/lib/db";

export interface AuditEntry {
  organizationId: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata?: Prisma.InputJsonObject;
}

/** Appends an immutable audit record inside the caller's transaction. */
export async function recordAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      organizationId: entry.organizationId,
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      metadata: entry.metadata,
    },
  });
}
