"use server";

import { plantToday } from "@/lib/plant-time";
import { requirePermission } from "@/lib/session";
import { countsIn } from "./data";
import { parsePeriod, periodProblem, periodQuery, type Period } from "./period";

/** How many records a Production Date selection holds — shown before downloading. */
export async function countsForPeriodAction(input: Period) {
  await requirePermission("downloads.view");
  if (periodProblem(input)) return null;
  // Re-read through the same parser the download uses, so the count and the file agree.
  return countsIn(parsePeriod(periodQuery(input), plantToday()));
}
