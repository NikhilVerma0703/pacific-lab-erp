"use server";

import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/action-result";
import { PermissionError, requirePermission } from "@/lib/session";
import { storage } from "@/lib/storage";
import { suggestProductionNumbers } from "./numbering";
import { productionFormSchema, type ProductionFormInput } from "./schema";
import { deleteProductionSample, ProductionSaveError, saveProductionSample } from "./service";

const PATH = "/production-sample";

async function removeFiles(keys: string[]) {
  // After the transaction committed — a failed file delete must never undo a save.
  await Promise.all(keys.map((k) => storage().delete(k).catch((e) => console.error("file delete", k, e))));
}

export async function saveProductionAction(
  input: ProductionFormInput,
  opts: { id?: string; autoSerial?: boolean; autoSlab?: boolean },
): Promise<ActionResult<{ id: string; serialNo: number; slabNumber: number | null }>> {
  try {
    const user = await requirePermission(opts.id ? "production.edit" : "production.create");

    // Backend validation is the one that counts.
    const parsed = productionFormSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return fail("Some values are not valid — see the highlighted fields.", fieldErrors);
    }

    const r = await saveProductionSample({
      id: opts.id,
      data: parsed.data,
      user,
      autoSerial: !!opts.autoSerial,
      autoSlab: !!opts.autoSlab,
    });
    await removeFiles(r.removedKeys);
    revalidatePath(PATH);
    revalidatePath("/dashboard");
    if (opts.id) revalidatePath(`${PATH}/${opts.id}`);

    const what = `S. No. ${r.serialNo}${r.slabNumber ? ` (Slab ${r.slabNumber})` : ""}`;
    return {
      ok: true,
      data: { id: r.id, serialNo: r.serialNo, slabNumber: r.slabNumber },
      message: opts.id ? `${what} updated.` : `Production sample saved — ${what}.`,
    };
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    if (e instanceof ProductionSaveError) return fail(e.message, e.fieldErrors);
    console.error("saveProductionAction", e);
    return fail("The production sample could not be saved. Nothing was changed — please try again.");
  }
}

export async function deleteProductionAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("production.delete");
    const { serialNo, removedKeys } = await deleteProductionSample(id, user);
    await removeFiles(removedKeys);
    revalidatePath(PATH);
    revalidatePath("/dashboard");
    return { ok: true, data: undefined, message: `Production sample S. No. ${serialNo} deleted.` };
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    if (e instanceof ProductionSaveError) return fail(e.message);
    console.error("deleteProductionAction", e);
    return fail("The production sample could not be deleted.");
  }
}

/** Fresh S. No. / Slab suggestions after a save, without reloading the page. */
export async function nextProductionNumbersAction() {
  await requirePermission("production.create");
  return suggestProductionNumbers();
}
