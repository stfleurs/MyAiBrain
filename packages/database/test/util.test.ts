import { describe, expect, it } from "vitest";
import { buildEmbeddingText, normalizeTagName, parseVector, slugify, vectorToString } from "../src/util";

describe("slugify", () => {
  it("lowercases and replaces spaces", () => {
    expect(slugify("Tally Cart")).toBe("tally-cart");
    expect(slugify("MyAi Brain!")).toBe("myai-brain");
  });

  it("falls back when empty", () => {
    expect(slugify("!!!")).toBe("untitled");
  });
});

describe("normalizeTagName", () => {
  it("normalizes whitespace and case", () => {
    expect(normalizeTagName("  AdMob  ")).toBe("admob");
    expect(normalizeTagName("Revenue Cat")).toBe("revenue-cat");
  });
});

describe("buildEmbeddingText", () => {
  it("combines title, summary and stripped content", () => {
    const text = buildEmbeddingText({
      title: "My Title",
      summary: "A summary",
      content: "# Heading\n\nSome **bold** content\n```js\ncode block\n```",
    });
    expect(text).toContain("My Title");
    expect(text).toContain("A summary");
    expect(text).toContain("Heading");
    expect(text).toContain("bold");
    expect(text).not.toContain("code block");
    expect(text).not.toContain("```");
  });

  it("omits empty summary", () => {
    const text = buildEmbeddingText({ title: "T", content: "C" });
    expect(text).toBe("T\nC");
  });
});

describe("vector helpers", () => {
  it("round-trips a vector", () => {
    const vector = [0.1, -0.2, 0.3];
    const str = vectorToString(vector);
    expect(str).toBe("[0.1,-0.2,0.3]");
    expect(parseVector(str)).toEqual(vector);
  });

  it("parses null as null", () => {
    expect(parseVector(null)).toBeNull();
  });
});
