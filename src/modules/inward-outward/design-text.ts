import { bodiesDesignText } from "@/modules/samples/bodies";
import { designSummary, orderTypes, typeOfPattern, type DesignTypeKey } from "@/modules/forms/design-types";
import type { InwardDetail } from "./queries";

/** The earlier form's design per body ("Body 1: Plain Body · Body 2: ROY BODY") — for the Review page. Pure. */
export function inwardDesignText(d: Pick<InwardDetail, "plainBody" | "designTypes" | "bodies" | "legacyBodies">): string {
  if (d.legacyBodies) return bodiesDesignText(d.bodies.map((b) => ({ designCategory: b.designCategory, patterns: b.designPatterns })));
  return designSummary(d.plainBody, d.designTypes.map((t) => t.type));
}

/**
 * Plain Body and the design types of an entry. Entries of the earlier form
 * (a design per body) count as Plain Body – No when any body is Non-Plain,
 * with the design types their design patterns stand for. Pure.
 */
export function inwardDesignOf(d: Pick<InwardDetail, "plainBody" | "designTypes" | "bodies" | "legacyBodies">): { plainBody: boolean | null; types: DesignTypeKey[] } {
  if (d.legacyBodies) {
    const cats = d.bodies.map((b) => b.designCategory).filter(Boolean);
    const plainBody = cats.includes("NON_PLAIN_BODY") ? false : cats.length ? true : null;
    const types = orderTypes(d.bodies.flatMap((b) => b.designPatterns.map((p) => typeOfPattern(p)).filter((k): k is DesignTypeKey => !!k)));
    return { plainBody, types: plainBody === false ? types : [] };
  }
  return { plainBody: d.plainBody, types: d.plainBody === false ? d.designTypes.map((t) => t.type) : [] };
}

/**
 * Register "Design Type": Plain Body, or every selected design type ("Roy Body,
 * Carrara"). Entries of the earlier form show the design types their design
 * patterns stand for. Pure.
 */
export function inwardDesignTypeText(d: Pick<InwardDetail, "plainBody" | "designTypes" | "bodies" | "legacyBodies">): string {
  const { plainBody, types } = inwardDesignOf(d);
  return designSummary(plainBody, types);
}
