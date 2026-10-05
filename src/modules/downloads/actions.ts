"use server";

import { requirePermission } from "@/lib/session";
import { countsOn } from "./data";

/** How many records a date has — shown before downloading. */
export async function countsForDateAction(date: string) {
  await requirePermission("downloads.view");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return null;
  return countsOn(date);
}
