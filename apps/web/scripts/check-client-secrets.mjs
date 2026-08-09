#!/usr/bin/env node
/**
 * Verifies the Next.js client bundle (.next/static) contains no secret material.
 *
 * Runs after `next build`. Treats every env var from .env.example that is NOT
 * prefixed with NEXT_PUBLIC_ as secret (name + current value), plus any env var
 * whose name ends in _KEY/_TOKEN/_SECRET/_PASSWORD, and fails if any of it shows
 * up in a file under .next/static. NEXT_PUBLIC_* values are expected and skipped.
 */
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextStatic = join(root, ".next", "static");
const envExample = join(root, "..", "..", ".env.example");
const envFile = join(root, "..", "..", ".env");

const secretNames = [];
if (existsSync(envExample)) {
  const text = await readFile(envExample, "utf8");
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (match && !match[1].startsWith("NEXT_PUBLIC_")) {
      secretNames.push(match[1]);
    }
  }
}

const isSecretKey = (key) => secretNames.includes(key) || /(KEY|TOKEN|SECRET|PASSWORD)$/.test(key);

const forbidden = new Set(secretNames);
// Values exposed through a NEXT_PUBLIC_* var are expected in the client bundle.
const allowedPublicValues = new Set();
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("NEXT_PUBLIC_") && value) allowedPublicValues.add(value);
}
if (existsSync(envFile)) {
  const text = await readFile(envFile, "utf8");
  const lines = [];
  for (const line of text.split("\n")) {
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    lines.push({
      key: line.slice(0, eq).trim(),
      value: line
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, ""),
    });
  }
  for (const { key, value } of lines) {
    if (key.startsWith("NEXT_PUBLIC_") && value) allowedPublicValues.add(value);
  }
  for (const { key, value } of lines) {
    if (key.startsWith("NEXT_PUBLIC_")) continue;
    if (!isSecretKey(key)) continue;
    if (value && value.length >= 8 && !allowedPublicValues.has(value)) {
      forbidden.add(value);
    }
  }
}
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("NEXT_PUBLIC_")) continue;
  if (!isSecretKey(key)) continue;
  if (value && value.length >= 8 && !allowedPublicValues.has(value)) {
    forbidden.add(value);
  }
}

if (!existsSync(nextStatic)) {
  console.log(
    `[check-client-secrets] no ${relative(process.cwd(), nextStatic)}; run after 'next build'.`
  );
  process.exit(0);
}

const files = [];
const walk = async (dir) => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile()) files.push(path);
  }
};
await walk(nextStatic);

const hits = [];
for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const needle of forbidden) {
    if (needle && text.includes(needle)) {
      hits.push({ needle, file: relative(root, file) });
    }
  }
}

if (hits.length > 0) {
  console.error("[check-client-secrets] FAIL: secret material found in client bundle:");
  for (const hit of hits) {
    console.error(`  ${hit.needle} -> ${hit.file}`);
  }
  process.exit(1);
}

console.log(
  `[check-client-secrets] OK: scanned ${files.length} client files; no secret env names/values present.`
);
