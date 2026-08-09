export type InlineToken =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "bold"; children: InlineToken[] }
  | { type: "italic"; children: InlineToken[] }
  | { type: "link"; href: string; children: InlineToken[] };

export type BlockToken =
  | { type: "paragraph"; children: InlineToken[] }
  | { type: "heading"; level: number; children: InlineToken[] }
  | { type: "code"; code: string }
  | { type: "quote"; children: InlineToken[] }
  | { type: "list"; ordered: boolean; items: { children: InlineToken[] }[] }
  | { type: "hr" };

export function tokenizeMarkdown(source: string): BlockToken[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: BlockToken[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) {
      break;
    }

    const trimmed = line.trim();
    if (trimmed === "") {
      i++;
      continue;
    }

    const fence = trimmed.match(/^```([\w-]*)\s*$/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i]?.trim() ?? "").startsWith("```")) {
        code.push(lines[i] ?? "");
        i++;
      }
      i++;
      blocks.push({ type: "code", code: code.join("\n") });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1]!.length,
        children: parseInline(heading[2] ?? ""),
      });
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && (lines[i]?.trim() ?? "").startsWith(">")) {
        quote.push((lines[i] ?? "").replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", children: parseInline(quote.join("\n")) });
      continue;
    }

    const listMarker = trimmed.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (listMarker) {
      const ordered = /\d/.test(listMarker[2] ?? "");
      const items: { children: InlineToken[] }[] = [];
      const indent = (listMarker[1] ?? "").length;
      while (i < lines.length) {
        const current = lines[i] ?? "";
        const currentTrimmed = current.trim();
        if (currentTrimmed === "") {
          break;
        }
        const currentMarker = currentTrimmed.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
        const currentIndent = currentMarker ? (currentMarker[1] ?? "").length : indent + 1;
        if (!currentMarker || currentIndent < indent) {
          break;
        }
        items.push({ children: parseInline(currentMarker[3] ?? "") });
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length) {
      const current = lines[i] ?? "";
      const currentTrimmed = current.trim();
      if (currentTrimmed === "") {
        break;
      }
      if (
        /^```/.test(currentTrimmed) ||
        /^#{1,6}\s+/.test(currentTrimmed) ||
        /^(-{3,}|\*{3,}|_{3,})\s*$/.test(currentTrimmed) ||
        currentTrimmed.startsWith(">") ||
        /^(\s*)([-*+]|\d+[.)])\s+/.test(currentTrimmed)
      ) {
        break;
      }
      paragraph.push(current);
      i++;
    }
    blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
  }

  return blocks;
}

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let buffer = "";
  let i = 0;

  const pushText = () => {
    if (buffer) {
      tokens.push({ type: "text", text: buffer });
      buffer = "";
    }
  };

  while (i < text.length) {
    const rest = text.slice(i);

    if (rest.startsWith("`")) {
      const end = rest.indexOf("`", 1);
      if (end !== -1) {
        pushText();
        tokens.push({ type: "code", text: rest.slice(1, end) });
        i += end + 1;
        continue;
      }
    }

    const link = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
    if (link) {
      pushText();
      tokens.push({
        type: "link",
        href: link[2] ?? "",
        children: parseInline(link[1] ?? ""),
      });
      i += link[0].length;
      continue;
    }

    if (rest.startsWith("**")) {
      const end = rest.indexOf("**", 2);
      if (end !== -1) {
        pushText();
        tokens.push({ type: "bold", children: parseInline(rest.slice(2, end)) });
        i += end + 2;
        continue;
      }
    }

    if (rest.startsWith("*")) {
      const end = rest.indexOf("*", 1);
      if (end !== -1) {
        pushText();
        tokens.push({ type: "italic", children: parseInline(rest.slice(1, end)) });
        i += end + 1;
        continue;
      }
    }

    buffer += text[i] ?? "";
    i++;
  }

  pushText();
  return tokens;
}
