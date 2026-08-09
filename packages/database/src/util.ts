export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return slug || "untitled";
}

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 50);
}

export function buildEmbeddingText(input: {
  title: string;
  summary?: string | null;
  content: string;
}): string {
  const content = input.content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [input.title.trim(), input.summary?.trim(), content].filter(Boolean).join("\n");
}

export function vectorToString(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export function parseVector(value: string | null): number[] | null {
  if (!value) {
    return null;
  }
  const inner = value.slice(1, -1);
  if (!inner) {
    return [];
  }
  return inner.split(",").map((part) => Number(part));
}
