import "server-only";
import { prisma } from "@/lib/db";
import type { AnnouncementKindValue } from "./kinds";

export interface AnnouncementDTO {
  id: string;
  kind: AnnouncementKindValue;
  title: string;
  message: string;
  important: boolean;
  createdBy: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Live announcements: important first, then newest. */
export async function listAnnouncements(take = 30): Promise<AnnouncementDTO[]> {
  const rows = await prisma.announcement.findMany({
    where: { isArchived: false },
    orderBy: [{ important: "desc" }, { createdAt: "desc" }],
    take,
    include: { createdBy: { select: { name: true } } },
  });
  return rows.map((a) => ({
    id: a.id,
    kind: a.kind,
    title: a.title,
    message: a.message,
    important: a.important,
    createdBy: a.createdBy?.name ?? null,
    createdById: a.createdById,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));
}
