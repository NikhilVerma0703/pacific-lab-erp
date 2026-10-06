import "server-only";
import { prisma } from "@/lib/db";
import type { PostKind, PostStatus } from "./kinds";

export interface ForumReplyDTO {
  id: string;
  message: string;
  author: string;
  createdById: string | null;
  createdAt: string;
}

export interface ForumPostDTO {
  id: string;
  kind: PostKind;
  title: string;
  message: string;
  important: boolean;
  status: PostStatus;
  author: string;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  /** Oldest first — the thread reads top to bottom. */
  replies: ForumReplyDTO[];
}

const nameOf = (typed: string | null, user: { name: string } | null) => typed?.trim() || user?.name || "—";

/**
 * Live Forum posts with their threads.
 * Order: open work first (Important pinned on top, then latest activity),
 * completed posts after it.
 */
export async function listForumPosts(take = 50): Promise<ForumPostDTO[]> {
  const rows = await prisma.announcement.findMany({
    where: { isArchived: false },
    orderBy: { lastActivityAt: "desc" },
    take,
    include: {
      createdBy: { select: { name: true } },
      replies: {
        where: { isDeleted: false },
        orderBy: { createdAt: "asc" },
        include: { createdBy: { select: { name: true } } },
      },
    },
  });

  const posts: ForumPostDTO[] = rows.map((p) => ({
    id: p.id,
    kind: p.kind,
    title: p.title,
    message: p.message,
    important: p.important,
    status: p.status,
    author: nameOf(p.authorName, p.createdBy),
    createdById: p.createdById,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    lastActivityAt: p.lastActivityAt.toISOString(),
    replies: p.replies.map((r) => ({
      id: r.id,
      message: r.message,
      author: nameOf(r.authorName, r.createdBy),
      createdById: r.createdById,
      createdAt: r.createdAt.toISOString(),
    })),
  }));

  const rank = (p: ForumPostDTO) => (p.status === "COMPLETED" ? 2 : p.important ? 0 : 1);
  // Array.sort is stable, so latest activity is kept within each group.
  return posts.sort((a, b) => rank(a) - rank(b));
}
