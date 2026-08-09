import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { createMcpServer } from "../src/server";
import { createHttpApp } from "../src/http";

const config = loadConfig({
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "key",
  MCP_AUTH_TOKEN: "secret-token",
  MCP_USER_ID: "00000000-0000-0000-0000-000000000001",
});

let base = "";
let server: ReturnType<typeof createServer>;

beforeAll(async () => {
  const app = createHttpApp(config, () => createMcpServer(config));
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  server.close();
});

it("exposes a minimal health endpoint (no data or config leaked)", async () => {
  const response = await fetch(`${base}/health`);
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});

it("rejects /mcp without a token", async () => {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  expect(response.status).toBe(401);
});

it("rejects /mcp with a wrong token", async () => {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer wrong" },
    body: "{}",
  });
  expect(response.status).toBe(401);
});

it("rejects /mcp with a malformed auth header", async () => {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { authorization: "Token abc" },
    body: "{}",
  });
  expect(response.status).toBe(401);
});

it("allows authorized requests through to the protocol handler", async () => {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer secret-token" },
    body: "{}",
  });
  expect(response.status).not.toBe(401);
});
