"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action-result";
import { PermissionError, requirePermission } from "@/lib/session";
import { ANNOUNCEMENT_KIND_VALUES } from "./kinds";

const schema = z.object({
  kind: z.enum(ANNOUNCEMENT_KIND_VALUES as [string, ...string[]]),
  title: z.string().trim().min(1, "Enter a title.").max(150, "Keep the title under 150 characters."),
  message: z.string().trim().min(1, "Enter the message.").max(4000, "Keep the message under 4000 characters."),
  important: z.boolean(),
});

export type AnnouncementInput = z.input<typeof schema>;

function fieldErrors(e: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

/** Create (no id) or edit. Only the author or an Admin may edit. */
export async function saveAnnouncementAction(input: AnnouncementInput, id?: string): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requirePermission("announcement.publish");
    const parsed = schema.safeParse(input);
    if (!parsed.success) return fail("Please complete the highlighted fields.", fieldErrors(parsed.error));
    const data = { ...parsed.data, kind: parsed.data.kind as never };

    const saved = await prisma.$transaction(async (tx) => {
      if (id) {
        const cur = await tx.announcement.findUnique({ where: { id } });
        if (!cur || cur.isArchived) throw new PermissionError("announcement.publish");
        if (cur.createdById !== user.id && user.role !== "ADMIN") throw new PermissionError("announcement.publish");
        const a = await tx.announcement.update({ where: { id }, data });
        await audit(tx, { entityType: "Announcement", entityId: a.id, action: "UPDATE", summary: a.title, userId: user.id });
        return a;
      }
      const a = await tx.announcement.create({ data: { ...data, createdById: user.id } });
      await audit(tx, { entityType: "Announcement", entityId: a.id, action: "CREATE", summary: a.title, userId: user.id });
      return a;
    });
    revalidatePath("/dashboard");
    return { ok: true, data: { id: saved.id }, message: id ? "Announcement updated." : "Announcement published to the team." };
  } catch (e) {
    if (e instanceof PermissionError) return fail("You can only change announcements you published.");
    console.error("saveAnnouncementAction", e);
    return fail("The announcement could not be saved.");
  }
}

/** Remove from the dashboard. Archived, not deleted — the record stays. */
export async function archiveAnnouncementAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("announcement.publish");
    const cur = await prisma.announcement.findUnique({ where: { id } });
    if (!cur) return fail("This announcement no longer exists.");
    if (cur.createdById !== user.id && user.role !== "ADMIN") return fail("You can only remove announcements you published.");
    await prisma.$transaction(async (tx) => {
      await tx.announcement.update({ where: { id }, data: { isArchived: true } });
      await audit(tx, { entityType: "Announcement", entityId: id, action: "ARCHIVE", summary: cur.title, userId: user.id });
    });
    revalidatePath("/dashboard");
    return { ok: true, data: undefined, message: "Announcement removed from the dashboard." };
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    console.error("archiveAnnouncementAction", e);
    return fail("The announcement could not be removed.");
  }
}
