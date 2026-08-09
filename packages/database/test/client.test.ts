import { afterEach, describe, expect, it, vi } from "vitest";
import { getServiceClient } from "../src/client";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getServiceClient", () => {
  it("throws when SUPABASE_URL is missing", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => getServiceClient()).toThrow();
  });
});
