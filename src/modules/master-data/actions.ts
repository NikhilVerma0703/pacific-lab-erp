"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, type ActionResult } from "@/lib/action-result";
import { cleanLabel, MAX_LABEL_LENGTH, normalizeKey } from "@/lib/normalize";
import { PermissionError, requirePermission } from "@/lib/session";

const labelSchema = z
  .string()
  .transform(cleanLabel)
  .pipe(z.string().min(1, "Enter a value.").max(MAX_LABEL_LENGTH, `Keep it under ${MAX_LABEL_LENGTH} characters.`));

function duplicateMessage(label: string) {
  return `“${label}” already exists in this list (matching ignores case and spaces).`;
}

async function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    console.error(e);
    return fail("Something went wrong. Please try again.");
  }
}

export async function createMasterValue(input: { categoryId: string; label: string }): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const user = await requirePermission("master.manage");
    const parsed = labelSchema.safeParse(input.label);
    if (!parsed.success) return fail(parsed.error.issues[0].message, { label: parsed.error.issues[0].message });
    const label = parsed.data;
    const key = normalizeKey(label);

    const cat = await prisma.masterCategory.findUnique({ where: { id: input.categoryId } });
    if (!cat) return fail("That list no longer exists.");

    const existing = await prisma.masterValue.findUnique({
      where: { categoryId_normalizedKey: { categoryId: cat.id, normalizedKey: key } },
    });
    if (existing) {
      if (!existing.isActive) {
        return fail(`“${existing.label}” already exists but is disabled — reactivate it instead.`, {
          label: "Already exists (disabled).",
        });
      }
      return fail(duplicateMessage(existing.label), { label: "Already in the list." });
    }

    const max = await prisma.masterValue.aggregate({ where: { categoryId: cat.id }, _max: { sortOrder: true } });
    const created = await prisma.$transaction(async (tx) => {
      const v = await tx.masterValue.create({
        data: {
          categoryId: cat.id,
          label,
          normalizedKey: key,
          createdById: user.id,
          sortOrder: (max._max.sortOrder ?? 0) + 10,
        },
      });
      await audit(tx, { entityType: "MasterValue", entityId: v.id, action: "CREATE", summary: `${cat.name}: ${label}`, userId: user.id });
      return v;
    });
    revalidatePath("/master-data");
    return { ok: true, data: { id: created.id }, message: `Added “${label}” to ${cat.name}.` };
  });
}

export async function renameMasterValue(input: { id: string; label: string }): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission("master.manage");
    const parsed = labelSchema.safeParse(input.label);
    if (!parsed.success) return fail(parsed.error.issues[0].message, { label: parsed.error.issues[0].message });
    const label = parsed.data;
    const key = normalizeKey(label);

    const current = await prisma.masterValue.findUnique({ where: { id: input.id } });
    if (!current) return fail("That value no longer exists.");

    const clash = await prisma.masterValue.findFirst({
      where: { categoryId: current.categoryId, normalizedKey: key, NOT: { id: current.id } },
    });
    if (clash) return fail(duplicateMessage(clash.label), { label: "Already in the list." });

    try {
      await prisma.$transaction(async (tx) => {
        await tx.masterValue.update({ where: { id: current.id }, data: { label, normalizedKey: key } });
        await audit(tx, {
          entityType: "MasterValue",
          entityId: current.id,
          action: "UPDATE",
          summary: `Renamed “${current.label}” → “${label}”`,
          userId: user.id,
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return fail(duplicateMessage(label), { label: "Already in the list." });
      }
      throw e;
    }
    revalidatePath("/master-data");
    return { ok: true, data: undefined, message: "Saved. Existing samples now show the new name." };
  });
}

/** Disable / reactivate. Values are never deleted — samples keep pointing at them. */
export async function setMasterValueActive(input: { id: string; isActive: boolean }): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission("master.manage");
    const v = await prisma.masterValue.findUnique({ where: { id: input.id } });
    if (!v) return fail("That value no longer exists.");
    await prisma.$transaction(async (tx) => {
      await tx.masterValue.update({ where: { id: v.id }, data: { isActive: input.isActive } });
      await audit(tx, {
        entityType: "MasterValue",
        entityId: v.id,
        action: input.isActive ? "ENABLE" : "DISABLE",
        summary: v.label,
        userId: user.id,
      });
    });
    revalidatePath("/master-data");
    return {
      ok: true,
      data: undefined,
      message: input.isActive ? `“${v.label}” is back in the dropdowns.` : `“${v.label}” is hidden from new entries.`,
    };
  });
}

/** Move a value up or down in its dropdown. */
export async function moveMasterValue(input: { id: string; direction: "up" | "down" }): Promise<ActionResult> {
  return guard(async () => {
    await requirePermission("master.manage");
    const v = await prisma.masterValue.findUnique({ where: { id: input.id } });
    if (!v) return fail("That value no longer exists.");
    const siblings = await prisma.masterValue.findMany({
      where: { categoryId: v.categoryId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      select: { id: true },
    });
    const idx = siblings.findIndex((s) => s.id === v.id);
    const swap = input.direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swap < 0 || swap >= siblings.length) return { ok: true, data: undefined };
    [siblings[idx], siblings[swap]] = [siblings[swap], siblings[idx]];
    await prisma.$transaction(
      siblings.map((s, i) => prisma.masterValue.update({ where: { id: s.id }, data: { sortOrder: (i + 1) * 10 } })),
    );
    revalidatePath("/master-data");
    return { ok: true, data: undefined };
  });
}
