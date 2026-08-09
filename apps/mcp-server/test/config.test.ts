import { describe, expect, it } from "vitest";
import { verifyAuthToken } from "../src/auth";
import { loadConfig } from "../src/config";

const baseEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "key",
  MCP_AUTH_TOKEN: "secret",
  MCP_USER_ID: "00000000-0000-0000-0000-000000000001",
};

describe("loadConfig", () => {
  it("applies defaults", () => {
    const config = loadConfig(baseEnv);
    expect(config.MCP_PORT).toBe(3001);
    expect(config.MCP_TRANSPORT).toBe("http");
    expect(config.EMBEDDING_MODEL).toBe("text-embedding-3-small");
    expect(config.OPENAI_API_KEY).toBeUndefined();
  });

  it("parses stdio transport", () => {
    const config = loadConfig({ ...baseEnv, MCP_TRANSPORT: "stdio" });
    expect(config.MCP_TRANSPORT).toBe("stdio");
  });

  it("throws when required env is missing", () => {
    expect(() => loadConfig({})).toThrow();
  });

  it("throws when MCP_USER_ID is missing", () => {
    const { MCP_USER_ID: _omitted, ...rest } = baseEnv;
    expect(_omitted).toBeDefined();
    expect(() => loadConfig(rest)).toThrow();
  });

  it("throws when MCP_USER_ID is not a uuid", () => {
    expect(() => loadConfig({ ...baseEnv, MCP_USER_ID: "not-a-uuid" })).toThrow();
  });
});

describe("verifyAuthToken", () => {
  it("rejects when expected token is not configured", () => {
    expect(verifyAuthToken("Bearer anything", undefined)).toBe(false);
  });

  it("rejects null/undefined token", () => {
    expect(verifyAuthToken(null, "secret")).toBe(false);
  });

  it("rejects a non-bearer header", () => {
    expect(verifyAuthToken("Token secret", "secret")).toBe(false);
  });

  it("rejects a mismatch", () => {
    expect(verifyAuthToken("Bearer wrong", "secret")).toBe(false);
  });

  it("accepts a match", () => {
    expect(verifyAuthToken("Bearer secret", "secret")).toBe(true);
  });
});
