"use server";

import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/action-result";
import { PermissionError, requirePermission } from "@/lib/session";
import { storage } from "@/lib/storage";
import { fieldErrorsOf } from "@/modules/forms/fields";
import { suggestInwardNumbers } from "./numbering";
import { inwardFormSchema, visibleInwardInput, type InwardFormInput } from "./schema";
import { deleteInward, InwardSaveError, saveInward } from "./service";

const PATH = "/inward-outward";

async function removeFiles(keys: string[]) {
  // After the transaction committed — a failed file delete must never undo a save.
  await Promise.all(keys.map((k) => storage().delete(k).catch((e) => console.error("file delete", k, e))));
}

export async function saveInwardAction(
  input: InwardFormInput,
  opts: { id?: string; autoSerial?: boolean; autoSlab?: boolean },
): Promise<ActionResult<{ id: string; serialNo: number; slabNumber: number | null }>> {
  try {
    const user = await requirePermission(opts.id ? "inward.edit" : "inward.create");

    // Backend validation is the one that counts — on what the form shows only.
    const parsed = inwardFormSchema.safeParse(visibleInwardInput(input));
    if (!parsed.success) return fail("Some values are not valid — see the highlighted fields.", fieldErrorsOf(parsed.error.issues));

    const r = await saveInward({ id: opts.id, data: parsed.data, user, autoSerial: !!opts.autoSerial, autoSlab: !!opts.autoSlab });
    await removeFiles(r.removedKeys);
    revalidatePath(PATH);
    revalidatePath("/dashboard");
    if (opts.id) revalidatePath(`${PATH}/${opts.id}`);

    const what = `S.No. ${r.serialNo}${r.slabNumber ? ` (Slab ${r.slabNumber})` : ""}`;
    return {
      ok: true,
      data: { id: r.id, serialNo: r.serialNo, slabNumber: r.slabNumber },
      message: opts.id ? `${what} updated.` : `Inward / Outward entry saved — ${what}.`,
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
    const { serialNo, removedKeys } = await deleteInward(id, user);
    await removeFiles(removedKeys);
    revalidatePath(PATH);
    revalidatePath("/dashboard");
    return { ok: true, data: undefined, message: `Inward / Outward S.No. ${serialNo} deleted.` };
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    if (e instanceof InwardSaveError) return fail(e.message);
    console.error("deleteInwardAction", e);
    return fail("The entry could not be deleted.");
  }
}

/** Fresh S.No. / Slab suggestions after a save, without reloading the page. */
export async function nextInwardNumbersAction() {
  await requirePermission("inward.create");
  return suggestInwardNumbers();
}
