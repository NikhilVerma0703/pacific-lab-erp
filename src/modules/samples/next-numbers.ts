"use server";

import { requirePermission } from "@/lib/session";
import { suggestNumbers } from "./numbering";

/** Fresh S.No. / Slab suggestions after a save, without reloading the page. */
export async function nextNumbersAction() {
  await requirePermission("sample.create");
  return suggestNumbers();
}
