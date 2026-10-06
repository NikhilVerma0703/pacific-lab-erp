"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action-result";
import { PermissionError, requirePermission } from "@/lib/session";
import { POST_STATUS_LABEL } from "./kinds";
import { postSchema, replySchema, statusSchema, type PostInput, type ReplyInput } from "./schema";

/**
 * Forum actions. Posts come from the Lab Head / Plant Head / CEO ("forum.post");
 * Lab and R&D users reply ("forum.reply"). Nothing is hard-deleted: a removed
 * post is archived and a removed reply is hidden, so the record stays.
 */

const PATH = "/dashboard";

function fieldErrors(e: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

class NotFound extends Error {}

/** Create (no id) or edit a post. Only its author or an Admin may edit. */
export async function saveForumPostAction(input: PostInput, id?: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("forum.post");
    const parsed = postSchema.safeParse(input);
    if (!parsed.success) return fail("Please complete the highlighted fields.", fieldErrors(parsed.error));
    const data = parsed.data;

    const saved = await prisma.$transaction(async (tx) => {
      if (id) {
        const cur = await tx.announcement.findUnique({ where: { id } });
        if (!cur || cur.isArchived) throw new NotFound();
        if (cur.createdById !== user.id && user.role !== "ADMIN") throw new PermissionError("forum.post");
        const p = await tx.announcement.update({ where: { id }, data });
        await audit(tx, { entityType: "ForumPost", entityId: p.id, action: "UPDATE", summary: p.title, userId: user.id });
        return p;
      }
      const p = await tx.announcement.create({ data: { ...data, createdById: user.id } });
      await audit(tx, { entityType: "ForumPost", entityId: p.id, action: "CREATE", summary: p.title, userId: user.id });
      return p;
    });
    revalidatePath(PATH);
    return { ok: true, data: { id: saved.id }, message: id ? "Post updated." : "Posted to the Forum." };
  } catch (e) {
    if (e instanceof NotFound) return fail("This post no longer exists.");
    if (e instanceof PermissionError) return fail("You can only change posts you created.");
    console.error("saveForumPostAction", e);
    return fail("The post could not be saved.");
  }
}

/** Remove a post from the Forum. Archived, not deleted — the thread stays on record. */
export async function archiveForumPostAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("forum.post");
    const cur = await prisma.announcement.findUnique({ where: { id } });
    if (!cur || cur.isArchived) return fail("This post no longer exists.");
    if (cur.createdById !== user.id && user.role !== "ADMIN") return fail("You can only remove posts you created.");
    await prisma.$transaction(async (tx) => {
      await tx.announcement.update({ where: { id }, data: { isArchived: true } });
      await audit(tx, { entityType: "ForumPost", entityId: id, action: "ARCHIVE", summary: cur.title, userId: user.id });
    });
    revalidatePath(PATH);
    return { ok: true, data: undefined, message: "Post removed from the Forum." };
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    console.error("archiveForumPostAction", e);
    return fail("The post could not be removed.");
  }
}

/** Open → In Progress → Completed (any order). */
export async function setForumPostStatusAction(id: string, status: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("forum.status");
    const parsed = statusSchema.safeParse(status);
    if (!parsed.success) return fail("Choose a valid status.");
    const cur = await prisma.announcement.findUnique({ where: { id } });
    if (!cur || cur.isArchived) return fail("This post no longer exists.");
    if (cur.status === parsed.data) return { ok: true, data: undefined };
    await prisma.$transaction(async (tx) => {
      await tx.announcement.update({ where: { id }, data: { status: parsed.data } });
      await audit(tx, {
        entityType: "ForumPost",
        entityId: id,
        action: "STATUS",
        summary: `${cur.title}: ${POST_STATUS_LABEL[cur.status]} → ${POST_STATUS_LABEL[parsed.data]}`,
        userId: user.id,
      });
    });
    revalidatePath(PATH);
    return { ok: true, data: undefined, message: `Marked as ${POST_STATUS_LABEL[parsed.data]}.` };
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    console.error("setForumPostStatusAction", e);
    return fail("The status could not be changed.");
  }
}

/** Add a reply to a post's thread. */
export async function addForumReplyAction(postId: string, input: ReplyInput): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("forum.reply");
    const parsed = replySchema.safeParse(input);
    if (!parsed.success) return fail("Please complete the highlighted fields.", fieldErrors(parsed.error));

    const reply = await prisma.$transaction(async (tx) => {
      const post = await tx.announcement.findUnique({ where: { id: postId }, select: { id: true, title: true, isArchived: true } });
      if (!post || post.isArchived) throw new NotFound();
      const r = await tx.forumReply.create({
        data: { postId, message: parsed.data.message, authorName: parsed.data.authorName, createdById: user.id },
      });
      await tx.announcement.update({ where: { id: postId }, data: { lastActivityAt: r.createdAt } });
      await audit(tx, { entityType: "ForumReply", entityId: r.id, action: "CREATE", summary: `Reply on “${post.title}”`, userId: user.id });
      return r;
    });
    revalidatePath(PATH);
    return { ok: true, data: { id: reply.id }, message: "Reply posted." };
  } catch (e) {
    if (e instanceof NotFound) return fail("This post was removed — your reply was not sent.");
    if (e instanceof PermissionError) return fail(e.message);
    console.error("addForumReplyAction", e);
    return fail("The reply could not be posted.");
  }
}

/** Remove a reply (hidden, not deleted). Its author or an Admin. */
export async function deleteForumReplyAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("forum.reply");
    const cur = await prisma.forumReply.findUnique({ where: { id } });
    if (!cur || cur.isDeleted) return fail("This reply no longer exists.");
    if (cur.createdById !== user.id && user.role !== "ADMIN") return fail("You can only remove your own replies.");
    await prisma.$transaction(async (tx) => {
      await tx.forumReply.update({ where: { id }, data: { isDeleted: true } });
      await audit(tx, { entityType: "ForumReply", entityId: id, action: "DELETE", summary: cur.message.slice(0, 120), userId: user.id });
    });
    revalidatePath(PATH);
    return { ok: true, data: undefined, message: "Reply removed." };
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    console.error("deleteForumReplyAction", e);
    return fail("The reply could not be removed.");
  }
}
