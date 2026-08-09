import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Permanent regression guard: the generated browser bundle must never contain
 * secret material. Specifically OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY and
 * MCP_AUTH_TOKEN (names or values) must not appear in any file under .next/static.
 * NEXT_PUBLIC_* values (public by design) are the only allowed exception.
 */
const SECRET_NAMES = ["OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "MCP_AUTH_TOKEN"];

const webRoot = resolve(__dirname, "..");
const staticDir = join(webRoot, ".next", "static");
const envFile = resolve(webRoot, "../..", ".env");
const envExampleFile = resolve(webRoot, "../..", ".env.example");

function isSecretKey(key: string): boolean {
  return SECRET_NAMES.includes(key) || /(KEY|TOKEN|SECRET|PASSWORD)$/.test(key);
}

function parseEnv(text: string): Array<[string, string]> {
  return text
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const eq = line.indexOf("=");
      const key = line.slice(0, eq).trim();
      const value = line
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      return [key, value] as [string, string];
    });
}

async function collectForbiddenStrings(): Promise<Set<string>> {
  const forbidden = new Set(SECRET_NAMES);
  const allowedPublic = new Set<string>();

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("NEXT_PUBLIC_")) {
      if (value) allowedPublic.add(value);
    } else if (isSecretKey(key) && value && value.length >= 8 && !allowedPublic.has(value)) {
      forbidden.add(value);
    }
  }

  for (const file of [envExampleFile, envFile]) {
    if (!existsSync(file)) continue;
    const pairs = parseEnv(await readFile(file, "utf8"));
    for (const [key, value] of pairs) {
      if (key.startsWith("NEXT_PUBLIC_")) {
        if (value) allowedPublic.add(value);
      }
    }
    for (const [key, value] of pairs) {
      if (key.startsWith("NEXT_PUBLIC_")) continue;
      if (isSecretKey(key) && value && value.length >= 8 && !allowedPublic.has(value)) {
        forbidden.add(value);
      }
    }
  }

  return forbidden;
}

async function listStaticFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listStaticFiles(path)));
    else files.push(path);
  }
  return files;
}

const runOnlyWhenBuilt = existsSync(staticDir) ? describe : describe.skip;

runOnlyWhenBuilt("client bundle contains no secret material", () => {
  it("never inlines OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, or MCP_AUTH_TOKEN", async () => {
    const forbidden = await collectForbiddenStrings();
    const files = await listStaticFiles(staticDir);

    const hits: Array<{ needle: string; file: string }> = [];
    for (const file of files) {
      const text = await readFile(file, "utf8");
      for (const needle of forbidden) {
        if (needle && text.includes(needle)) {
          hits.push({ needle, file: file.slice(webRoot.length + 1) });
        }
      }
    }

    expect(hits, JSON.stringify(hits, null, 2)).toEqual([]);
  });
});
