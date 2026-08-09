import { describe, expect, it } from "vitest";
import { parseInline, tokenizeMarkdown } from "@/lib/markdown";

describe("tokenizeMarkdown", () => {
  it("returns an empty list for empty input", () => {
    expect(tokenizeMarkdown("")).toEqual([]);
    expect(tokenizeMarkdown("  \n\n  ")).toEqual([]);
  });

  it("groups consecutive lines into a single paragraph", () => {
    const blocks = tokenizeMarkdown("first line\nsecond line");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "paragraph" });
  });

  it("parses headings of every level", () => {
    const blocks = tokenizeMarkdown("# One\n## Two\n### Three");
    expect(blocks.map((b) => (b.type === "heading" ? b.level : 0))).toEqual([
      1, 2, 3,
    ]);
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
  });

  it("parses fenced code blocks and ignores the language tag", () => {
    const blocks = tokenizeMarkdown("```ts\nconst x = 1;\n```");
    expect(blocks).toEqual([
      { type: "code", code: "const x = 1;" },
    ]);
  });

  it("keeps the full code block across multiple lines", () => {
    const blocks = tokenizeMarkdown("```\na\nb\nc\n```");
    expect(blocks).toEqual([{ type: "code", code: "a\nb\nc" }]);
  });

  it("parses unordered and ordered lists", () => {
    const blocks = tokenizeMarkdown("- one\n- two\n\n1. first\n2. second");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: "list", ordered: false });
    expect(blocks[1]).toMatchObject({ type: "list", ordered: true });
  });

  it("parses a horizontal rule", () => {
    const blocks = tokenizeMarkdown("---");
    expect(blocks).toEqual([{ type: "hr" }]);
  });

  it("parses blockquotes and strips the marker", () => {
    const blocks = tokenizeMarkdown("> hello\n> world");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "quote" });
  });

  it("separates blocks that are adjacent", () => {
    const blocks = tokenizeMarkdown("## Title\n\nSome text\n\n- a\n- b");
    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "list",
    ]);
  });
});

describe("parseInline", () => {
  it("treats plain text as a single text token", () => {
    expect(parseInline("hello world")).toEqual([{ type: "text", text: "hello world" }]);
  });

  it("parses inline code", () => {
    expect(parseInline("use `foo()` now")).toMatchObject([
      { type: "text", text: "use " },
      { type: "code", text: "foo()" },
      { type: "text", text: " now" },
    ]);
  });

  it("parses bold text", () => {
    expect(parseInline("**important**")).toMatchObject([
      { type: "bold", children: [{ type: "text", text: "important" }] },
    ]);
  });

  it("parses italic text", () => {
    expect(parseInline("*maybe*")).toMatchObject([
      { type: "italic", children: [{ type: "text", text: "maybe" }] },
    ]);
  });

  it("parses links", () => {
    expect(parseInline("see [docs](https://docs.example.com) here")).toMatchObject([
      { type: "text", text: "see " },
      { type: "link", href: "https://docs.example.com" },
      { type: "text", text: " here" },
    ]);
  });

  it("leaves unmatched asterisks as text", () => {
    expect(parseInline("2 * 3")).toEqual([{ type: "text", text: "2 * 3" }]);
  });
});
