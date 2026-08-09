import { describe, expect, it } from "vitest";
import { verifyAuthToken } from "../src/auth";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("applies defaults", () => {
    const config = loadConfig({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "key",
    });
    expect(config.MCP_PORT).toBe(3001);
    expect(config.EMBEDDING_MODEL).toBe("text-embedding-3-small");
  });

  it("throws when required env is missing", () => {
    expect(() => loadConfig({})).toThrow();
  });
});

describe("verifyAuthToken", () => {
  it("rejects when expected token is not configured", () => {
    expect(verifyAuthToken("anything", undefined)).toBe(false);
  });

  it("rejects null/undefined token", () => {
    expect(verifyAuthToken(null, "secret")).toBe(false);
  });

  it("rejects a mismatch", () => {
    expect(verifyAuthToken("wrong", "secret")).toBe(false);
  });

  it("accepts a match", () => {
    expect(verifyAuthToken("secret", "secret")).toBe(true);
  });
});
