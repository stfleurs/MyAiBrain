import type { KnowledgeImportance } from "@pam/shared";
import { normalizeTagName } from "@pam/database";

export function parseTags(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of value.split(/[,\n]/)) {
    const tag = normalizeTagName(part);
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags.slice(0, 20);
}

export function parseImportance(value: FormDataEntryValue | null): KnowledgeImportance {
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 5) {
    return n as KnowledgeImportance;
  }
  return 3;
}

export function parseOptionalString(
  value: FormDataEntryValue | null
): string | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}
