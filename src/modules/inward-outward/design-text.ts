import { bodiesDesignText } from "@/modules/samples/bodies";
import { designSummary } from "@/modules/forms/design-types";
import type { InwardDetail } from "./queries";

/** An entry's design in a few words: "Plain Body", "Roy Body, Carrara", or the earlier form's per-body design. Pure. */
export function inwardDesignText(d: Pick<InwardDetail, "plainBody" | "designTypes" | "bodies" | "legacyBodies">): string {
  if (d.legacyBodies) return bodiesDesignText(d.bodies.map((b) => ({ designCategory: b.designCategory, patterns: b.designPatterns })));
  return designSummary(d.plainBody, d.designTypes.map((t) => t.type));
}
