import { describe, expect, it } from "vitest";
import {
  findPreviousBugInputSchema,
  projectSlugSchema,
  saveMemoryInputSchema,
  searchMemoryInputSchema,
  updateMemoryInputSchema,
} from "../src/schemas";

describe("projectSlugSchema", () => {
  it("accepts lowercase slugs with dashes", () => {
    expect(projectSlugSchema.parse("tally-cart")).toBe("tally-cart");
  });

  it("rejects invalid slugs", () => {
    expect(() => projectSlugSchema.parse("Tally Cart")).toThrow();
    expect(() => projectSlugSchema.parse("")).toThrow();
  });
});

describe("searchMemoryInputSchema", () => {
  it("applies default limit", () => {
    const result = searchMemoryInputSchema.parse({ query: "firestore" });
    expect(result.limit).toBe(10);
  });

  it("rejects a query that is too long", () => {
    expect(() => searchMemoryInputSchema.parse({ query: "x".repeat(2001) })).toThrow();
  });

  it("rejects invalid type", () => {
    expect(() => searchMemoryInputSchema.parse({ query: "x", type: "nope" })).toThrow();
  });
});

describe("saveMemoryInputSchema", () => {
  it("defaults importance to 3", () => {
    const result = saveMemoryInputSchema.parse({
      type: "bug_fix",
      title: "Firestore stream timeout",
      content: "Remove the timeout from the persistent stream.",
    });
    expect(result.importance).toBe(3);
  });

  it("rejects empty content", () => {
    expect(() =>
      saveMemoryInputSchema.parse({ type: "pattern", title: "x", content: "" })
    ).toThrow();
  });
});

describe("updateMemoryInputSchema", () => {
  it("rejects an empty patch", () => {
    expect(() =>
      updateMemoryInputSchema.parse({
        knowledgeId: "00000000-0000-4000-8000-000000000000",
        patch: {},
      })
    ).toThrow();
  });
});

describe("findPreviousBugInputSchema", () => {
  it("applies default limit of 5", () => {
    const result = findPreviousBugInputSchema.parse({ description: "stream stops" });
    expect(result.limit).toBe(5);
  });
});
