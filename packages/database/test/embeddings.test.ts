import { describe, expect, it, vi } from "vitest";
import { createEmbeddingProvider, OpenAIEmbeddingProvider } from "../src/embeddings";

describe("createEmbeddingProvider", () => {
  it("throws when OPENAI_API_KEY is missing", () => {
    expect(() => createEmbeddingProvider({})).toThrow();
  });

  it("creates an OpenAI provider when configured", () => {
    const provider = createEmbeddingProvider({
      OPENAI_API_KEY: "test-key",
      EMBEDDING_MODEL: "text-embedding-3-small",
    });
    expect(provider).toBeInstanceOf(OpenAIEmbeddingProvider);
    expect(provider.model).toBe("text-embedding-3-small");
  });
});

describe("OpenAIEmbeddingProvider", () => {
  it("returns the first embedding from the API", async () => {
    const openai = {
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      },
    } as never;

    const provider = new OpenAIEmbeddingProvider(openai, "text-embedding-3-small");
    const result = await provider.embed("hello");
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });

  it("throws when the API returns no data", async () => {
    const openai = {
      embeddings: {
        create: vi.fn().mockResolvedValue({ data: [] }),
      },
    } as never;

    const provider = new OpenAIEmbeddingProvider(openai, "text-embedding-3-small");
    await expect(provider.embed("hello")).rejects.toThrow();
  });
});
