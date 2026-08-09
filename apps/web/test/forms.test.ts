import { describe, expect, it } from "vitest";
import { parseImportance, parseOptionalString, parseTags } from "@/lib/forms";

describe("parseTags", () => {
  it("splits on commas and newlines", () => {
    expect(parseTags("one, two\nthree")).toEqual(["one", "two", "three"]);
  });

  it("trims and normalizes tag names", () => {
    expect(parseTags("  Flutter  , firebase")).toEqual(["flutter", "firebase"]);
  });

  it("deduplicates repeated tags", () => {
    expect(parseTags("react, react, node")).toEqual(["react", "node"]);
  });

  it("drops empty parts", () => {
    expect(parseTags("one,,two")).toEqual(["one", "two"]);
  });

  it("returns an empty array for nullish input", () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags("")).toEqual([]);
  });

  it("caps at 20 tags", () => {
    const input = Array.from({ length: 25 }, (_, i) => `tag${i}`).join(",");
    expect(parseTags(input)).toHaveLength(20);
  });
});

describe("parseImportance", () => {
  it("accepts 1-5", () => {
    for (const value of [1, 2, 3, 4, 5]) {
      expect(parseImportance(String(value))).toBe(value);
    }
  });

  it("defaults to 3 for invalid values", () => {
    expect(parseImportance("0")).toBe(3);
    expect(parseImportance("6")).toBe(3);
    expect(parseImportance("abc")).toBe(3);
    expect(parseImportance(null)).toBe(3);
  });
});

describe("parseOptionalString", () => {
  it("trims whitespace", () => {
    expect(parseOptionalString("  hello  ")).toBe("hello");
  });

  it("returns null for empty strings", () => {
    expect(parseOptionalString("")).toBe(null);
    expect(parseOptionalString("   ")).toBe(null);
    expect(parseOptionalString(null)).toBe(null);
  });
});
