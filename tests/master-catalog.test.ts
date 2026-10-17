import { describe, expect, it } from "vitest";
import { cleanLabel, normalizeKey } from "@/lib/normalize";
import { CATALOG, HIDDEN_CATEGORY_CODES, MASTER, RETIRED_CATEGORY_CODES, TYPED_ONLY_CODES } from "@/modules/master-data/catalog";

const entry = (code: string) => CATALOG.find((c) => c.code === code);

describe("master lists", () => {
  it("material lists start empty — values only come from what people type", () => {
    expect([...TYPED_ONLY_CODES].sort()).toEqual([MASTER.ADDITIVE, MASTER.FILLER, MASTER.GRIT, MASTER.GRIT_SIZE, MASTER.PIGMENT, MASTER.RESIN].sort());
    for (const code of TYPED_ONLY_CODES) expect(entry(code)?.values).toEqual([]);
  });

  it("Design Patterns is called Design Types; the vein lists are gone from Master Data", () => {
    expect(entry(MASTER.DESIGN_PATTERN)?.name).toBe("Design Types");
    expect(entry(MASTER.VEIN_METHOD)).toBeUndefined();
    expect(RETIRED_CATEGORY_CODES).toContain("VEIN_METHOD");
    // Vein Details stays a list (the Kreos / Vein field remembers typed values) but is not shown in Master Data.
    expect(entry(MASTER.VEIN_DETAIL)).toBeDefined();
    expect(HIDDEN_CATEGORY_CODES).toEqual(expect.arrayContaining(["SAMPLE_TYPE", "VEIN_METHOD", "VEIN_DETAIL"]));
  });

  it("values keep letters, numbers and special characters", () => {
    for (const label of ["#red097!", "Add+3%", "Grit@2 (fine)", "0.1/0.4 mm", "Fill&3", "Ivory–Beige*"]) {
      expect(cleanLabel(label)).toBe(label);
      expect(normalizeKey(` ${label.toUpperCase()}  `)).toBe(label.toLowerCase());
    }
  });
});
