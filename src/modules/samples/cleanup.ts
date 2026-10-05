import "server-only";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";

/** Delete unlinked uploads older than `hours`. Returns how many were removed. */
export async function cleanupOrphanUploads(hours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - hours * 3600_000);
  const orphans = await prisma.sampleAttachment.findMany({
    where: { sampleId: null, createdAt: { lt: cutoff } },
    select: { id: true, storageKey: true },
    take: 500,
  });
  for (const o of orphans) {
    await storage().delete(o.storageKey).catch((e) => console.error("orphan delete", o.storageKey, e));
  }
  if (orphans.length) {
    await prisma.sampleAttachment.deleteMany({ where: { id: { in: orphans.map((o) => o.id) }, sampleId: null } });
  }
  return orphans.length;
}
