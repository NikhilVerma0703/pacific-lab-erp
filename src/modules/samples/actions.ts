"use server";

import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/action-result";
import { PermissionError, requirePermission } from "@/lib/session";
import { storage } from "@/lib/storage";
import { fieldErrorsOf } from "@/modules/forms/fields";
import { suggestLabNumbers } from "./numbering";
import { labFormSchema, visibleLabInput, type LabFormInput } from "./schema";
import { deleteLabSample, LabSaveError, saveLabSample } from "./service";

const PATH = "/samples";

async function removeFiles(keys: string[]) {
  // After the transaction committed — a failed file delete must never undo a save.
  await Promise.all(keys.map((k) => storage().delete(k).catch((e) => console.error("file delete", k, e))));
}

export async function saveLabSampleAction(
  input: LabFormInput,
  opts: { id?: string; autoSerial?: boolean; autoSlab?: boolean },
): Promise<ActionResult<{ id: string; serialNo: number; slabNumber: number | null }>> {
  try {
    const user = await requirePermission(opts.id ? "sample.edit" : "sample.create");

    // Backend validation is the one that counts — on what the form shows only.
    const parsed = labFormSchema.safeParse(visibleLabInput(input));
    if (!parsed.success) return fail("Some values are not valid — see the highlighted fields.", fieldErrorsOf(parsed.error.issues));

    const r = await saveLabSample({ id: opts.id, data: parsed.data, user, autoSerial: !!opts.autoSerial, autoSlab: !!opts.autoSlab });
    await removeFiles(r.removedKeys);
    revalidatePath(PATH);
    revalidatePath("/dashboard");
    if (opts.id) revalidatePath(`${PATH}/${opts.id}`);

    const what = `S.No. ${r.serialNo}${r.slabNumber ? ` (Slab ${r.slabNumber})` : ""}`;
    return {
      ok: true,
      data: { id: r.id, serialNo: r.serialNo, slabNumber: r.slabNumber },
      message: opts.id ? `${what} updated.` : `Lab sample saved — ${what}.`,
    };
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    if (e instanceof LabSaveError) return fail(e.message, e.fieldErrors);
    console.error("saveLabSampleAction", e);
    return fail("The sample could not be saved. Nothing was changed — please try again.");
  }
}

export async function deleteLabSampleAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("sample.delete");
    const { serialNo, removedKeys } = await deleteLabSample(id, user);
    await removeFiles(removedKeys);
    revalidatePath(PATH);
    revalidatePath("/dashboard");
    revalidatePath("/inward-outward");
    return { ok: true, data: undefined, message: `Lab sample S.No. ${serialNo} deleted.` };
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    if (e instanceof LabSaveError) return fail(e.message);
    console.error("deleteLabSampleAction", e);
    return fail("The sample could not be deleted.");
  }
}

/** Fresh S.No. / Slab suggestions after a save, without reloading the page. */
export async function nextLabNumbersAction() {
  await requirePermission("sample.create");
  return suggestLabNumbers();
}
