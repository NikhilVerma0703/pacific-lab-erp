import { describe, expect, it } from "vitest";
import { bodiesDesignText, bodyDesignsOrLegacy, categoriesOf, designText, unionLabels } from "@/modules/samples/bodies";

const p = (label: string) => ({ label });

describe("body-wise designs", () => {
  it("writes one body's design", () => {
    expect(designText({ designCategory: "PLAIN_BODY", patterns: [] })).toBe("Plain Body");
    expect(designText({ designCategory: "NON_PLAIN_BODY", patterns: [p("CARRARA"), p("ROY BODY")] })).toBe("CARRARA, ROY BODY");
    expect(designText({ designCategory: "NON_PLAIN_BODY", patterns: [] })).toBe("Non-Plain Body");
    expect(designText({ designCategory: null, patterns: [] })).toBe("");
  });

  it("summarises bodies for a register cell", () => {
    const plain = { designCategory: "PLAIN_BODY" as const, patterns: [] };
    const roy = { designCategory: "NON_PLAIN_BODY" as const, patterns: [p("ROY BODY")] };
    expect(bodiesDesignText([plain, plain])).toBe("Plain Body");
    expect(bodiesDesignText([plain, roy])).toBe("Body 1: Plain Body · Body 2: ROY BODY");
    expect(bodiesDesignText([plain, { designCategory: null, patterns: [] }])).toBe("Body 1: Plain Body");
    expect(bodiesDesignText([])).toBe("");
    expect(categoriesOf([roy, plain])).toEqual(["PLAIN_BODY", "NON_PLAIN_BODY"]);
    expect(unionLabels([[p("Kreos"), p("ROY BODY")], [p("kreos"), p("Pull")]])).toEqual(["Kreos", "ROY BODY", "Pull"]);
  });

  it("copies an older record's one design onto every body", () => {
    const legacy = { designCategory: "NON_PLAIN_BODY" as const, patterns: [p("VEIN")] };
    expect(bodyDesignsOrLegacy([], legacy, 3)).toEqual([legacy, legacy, legacy]);
    expect(bodyDesignsOrLegacy([], legacy, null)).toEqual([legacy]); // blank n but a design → one body
    expect(bodyDesignsOrLegacy([], { designCategory: null, patterns: [] }, null)).toEqual([]);
    const own = [
      { bodyIndex: 2, designCategory: "PLAIN_BODY" as const, patterns: [] },
      { bodyIndex: 1, designCategory: null, patterns: [] },
    ];
    expect(bodyDesignsOrLegacy(own, legacy, 2).map((b) => b.designCategory)).toEqual([null, "PLAIN_BODY"]);
  });
});
