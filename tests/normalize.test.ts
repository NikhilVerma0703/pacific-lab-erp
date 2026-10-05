import { describe, expect, it } from "vitest";
import { cleanLabel, normalizeKey } from "@/lib/normalize";

describe("master value normalisation", () => {
  it("treats case and spacing as the same value", () => {
    expect(normalizeKey("  Glass ")).toBe(normalizeKey("glass"));
    expect(normalizeKey("ABC   Resin")).toBe("abc resin");
  });
  it("keeps the user's casing in the label", () => {
    expect(cleanLabel("  ABC   Resin ")).toBe("ABC Resin");
  });
});
