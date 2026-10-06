/**
 * Where Sample Data Entry goes after a Save — decided by "Physical Sample
 * Available?". Pure, so it is unit-tested.
 *
 * - Yes → the Inward / Outward page, to enter the physical sample (skipped
 *   when it is already recorded there).
 * - No  → the Inward / Outward page, with the sample marked under Rectification.
 * - A draft stays where it is.
 */
export type NextStep = { url: string; kind: "inward" | "rectification" } | null;

export function nextAfterSave(args: {
  id: string;
  status: "DRAFT" | "SUBMITTED";
  physicalSampleAvailable: boolean | null;
  hasInwardEntry: boolean;
}): NextStep {
  if (args.status !== "SUBMITTED") return null;
  if (args.physicalSampleAvailable === true) {
    return args.hasInwardEntry ? null : { url: `/inward-outward?sample=${args.id}#entry`, kind: "inward" };
  }
  if (args.physicalSampleAvailable === false) {
    return { url: `/inward-outward?rectification=${args.id}#rectification`, kind: "rectification" };
  }
  return null;
}
