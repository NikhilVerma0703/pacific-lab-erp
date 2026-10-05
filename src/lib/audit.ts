import "server-only";
import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db";

export async function audit(
  tx: Tx,
  entry: {
    entityType: string;
    entityId: string;
    action: "CREATE" | "UPDATE" | "DELETE" | "DISABLE" | "ENABLE" | string;
    summary?: string;
    snapshot?: Prisma.InputJsonValue;
    userId?: string | null;
  },
) {
  await tx.auditLog.create({
    data: {
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      summary: entry.summary,
      snapshot: entry.snapshot,
      userId: entry.userId ?? null,
    },
  });
}
