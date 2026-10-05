"use server";

import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/action-result";
import { PermissionError, requirePermission } from "@/lib/session";
import { inwardFormSchema, type InwardFormInput } from "./schema";
import { deleteInward, InwardSaveError, nextInwardSerial, saveInward } from "./service";
import { prisma } from "@/lib/db";

export async function saveInwardAction(
  input: InwardFormInput,
  opts: { id?: string; autoSerial?: boolean },
): Promise<ActionResult<{ id: string; serialNo: number }>> {
  try {
    const user = await requirePermission(opts.id ? "inward.edit" : "inward.create");
    const parsed = inwardFormSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return fail("Some values are not valid — see the highlighted fields.", fieldErrors);
    }
    const r = await saveInward({ id: opts.id, data: parsed.data, user, autoSerial: !!opts.autoSerial });
    revalidatePath("/inward-outward");
    revalidatePath("/samples");
    return {
      ok: true,
      data: r,
      message: opts.id ? `Serial No. ${r.serialNo} updated.` : `Inward / Outward entry saved — Serial No. ${r.serialNo}.`,
    };
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    if (e instanceof InwardSaveError) return fail(e.message, e.fieldErrors);
    console.error("saveInwardAction", e);
    return fail("The entry could not be saved. Nothing was changed — please try again.");
  }
}

export async function deleteInwardAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("inward.delete");
    const { serialNo } = await deleteInward(id, user);
    revalidatePath("/inward-outward");
    return { ok: true, data: undefined, message: `Serial No. ${serialNo} deleted.` };
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    if (e instanceof InwardSaveError) return fail(e.message);
    console.error("deleteInwardAction", e);
    return fail("The entry could not be deleted.");
  }
}

export async function nextInwardSerialAction(): Promise<number> {
  await requirePermission("inward.create");
  return nextInwardSerial(prisma);
}
