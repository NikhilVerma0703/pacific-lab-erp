"use server";

import { revalidatePath } from "next/cache";
import { fail, type ActionResult } from "@/lib/action-result";
import { PermissionError, requirePermission } from "@/lib/session";
import { storage } from "@/lib/storage";
import { sampleFormSchema, type SampleFormInput } from "./schema";
import { nextAfterSave, type NextStep } from "./next-step";
import { deleteSample, saveSample, SampleSaveError } from "./service";

async function removeFiles(keys: string[]) {
  // After the transaction committed — a failed file delete must never undo a save.
  await Promise.all(keys.map((k) => storage().delete(k).catch((e) => console.error("file delete", k, e))));
}

export async function saveSampleAction(
  input: SampleFormInput,
  opts: { id?: string; status: "DRAFT" | "SUBMITTED"; autoSerial?: boolean; autoSlab?: boolean },
): Promise<ActionResult<{ id: string; serialNo: number; slabNumber: number | null; next: NextStep }>> {
  try {
    const user = await requirePermission(opts.id ? "sample.edit" : "sample.create");

    // Backend validation is the one that counts.
    const parsed = sampleFormSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return fail("Some values are not valid — see the highlighted fields.", fieldErrors);
    }
    // A saved (not draft) sample must say where its physical sample stands.
    if (opts.status === "SUBMITTED" && parsed.data.physicalSamplePresent === null) {
      return fail("Answer “Physical Sample Available?” before saving.", { physicalSamplePresent: "Choose Yes or No." });
    }

    const result = await saveSample({
      id: opts.id,
      data: parsed.data,
      status: opts.status,
      user,
      autoSerial: !!opts.autoSerial,
      autoSlab: !!opts.autoSlab,
    });
    await removeFiles(result.removedKeys);
    revalidatePath("/samples");
    revalidatePath("/inward-outward");
    if (opts.id) revalidatePath(`/samples/${opts.id}`);

    const what = `S.No. ${result.serialNo}${result.slabNumber ? ` (Slab ${result.slabNumber})` : ""}`;
    return {
      ok: true,
      data: {
        id: result.id,
        serialNo: result.serialNo,
        slabNumber: result.slabNumber,
        next: nextAfterSave({
          id: result.id,
          status: opts.status,
          physicalSampleAvailable: result.physicalSampleAvailable,
          hasInwardEntry: result.hasInwardEntry,
        }),
      },
      message:
        opts.status === "DRAFT"
          ? `Draft saved — ${what}.`
          : opts.id
            ? `${what} updated.`
            : `Sample saved — ${what}.`,
    };
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    if (e instanceof SampleSaveError) return fail(e.message, e.fieldErrors);
    console.error("saveSampleAction", e);
    return fail("The sample could not be saved. Nothing was changed — please try again.");
  }
}

export async function deleteSampleAction(id: string): Promise<ActionResult> {
  try {
    const user = await requirePermission("sample.delete");
    const { serialNo, removedKeys } = await deleteSample(id, user);
    await removeFiles(removedKeys);
    revalidatePath("/samples");
    revalidatePath("/inward-outward");
    return { ok: true, data: undefined, message: `S.No. ${serialNo} deleted.` };
  } catch (e) {
    if (e instanceof PermissionError) return fail(e.message);
    if (e instanceof SampleSaveError) return fail(e.message);
    console.error("deleteSampleAction", e);
    return fail("The sample could not be deleted.");
  }
}
