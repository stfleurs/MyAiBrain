import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmbeddingProvider } from "@pam/database";
import { hybridSearch } from "../src/services/search.js";
import type { ToolContext } from "../src/context.js";

const mocks = vi.hoisted(() => ({
  getProjectBySlug: vi.fn(),
  searchKeyword: vi.fn(),
  semanticSearch: vi.fn(),
  getKnowledgeByIds: vi.fn(),
}));

vi.mock("@pam/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pam/database")>();
  return {
    ...actual,
    getProjectBySlug: mocks.getProjectBySlug,
    searchKeyword: mocks.searchKeyword,
    semanticSearch: mocks.semanticSearch,
    getKnowledgeByIds: mocks.getKnowledgeByIds,
  };
});

const userId = "00000000-0000-0000-0000-000000000001";

function knowledge(id: string) {
  return {
    id,
    userId,
    projectId: null,
    type: "lesson" as const,
    title: `Entry ${id}`,
    content: "content",
    summary: null,
    source: null,
    importance: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function withMeta(id: string, tags: string[] = []): Record<string, unknown> {
  return { ...knowledge(id), tags, projectSlug: null };
}

function makeCtx(provider: EmbeddingProvider | null): ToolContext {
  return { client: {} as never, userId, embeddingProvider: provider };
}

function fakeProvider(): EmbeddingProvider {
  return { model: "test-model", embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hybridSearch", () => {
  it("combines normalized keyword and vector scores with the configured weights", async () => {
    const k1 = knowledge("00000000-0000-0000-0000-000000000001");
    const k2 = knowledge("00000000-0000-0000-0000-000000000002");
    mocks.searchKeyword.mockResolvedValue([
      { knowledge: k1, keywordScore: 0.8 },
      { knowledge: k2, keywordScore: 0.4 },
    ]);
    mocks.semanticSearch.mockResolvedValue([
      { knowledge: k1, vectorScore: 0.6 },
      { knowledge: k2, vectorScore: 0.2 },
    ]);
    mocks.getKnowledgeByIds.mockResolvedValue([withMeta(k1.id), withMeta(k2.id)]);

    const results = await hybridSearch(makeCtx(fakeProvider()), { query: "q", limit: 10 });

    expect(results).toHaveLength(2);
    expect(results[0]?.knowledge.id).toBe(k1.id);
    expect(results[0]?.score).toBeCloseTo(0.35 * 1 + 0.65 * 0.6, 5); // 0.74
    expect(results[1]?.knowledge.id).toBe(k2.id);
    expect(results[1]?.score).toBeCloseTo(0.35 * 0.5 + 0.65 * 0.2, 5); // 0.305
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  it("returns keyword-only results when no embedding provider is configured", async () => {
    const k1 = knowledge("00000000-0000-0000-0000-000000000001");
    mocks.searchKeyword.mockResolvedValue([{ knowledge: k1, keywordScore: 0.4 }]);
    mocks.semanticSearch.mockResolvedValue([]);
    mocks.getKnowledgeByIds.mockResolvedValue([withMeta(k1.id)]);

    const results = await hybridSearch(makeCtx(null), { query: "q", limit: 10 });

    expect(results).toHaveLength(1);
    expect(results[0]?.vectorScore).toBe(0);
    expect(results[0]?.score).toBeCloseTo(0.35 * 1, 5);
    expect(mocks.semanticSearch).not.toHaveBeenCalled();
  });

  it("includes vector-only hits that have no keyword match", async () => {
    const k1 = knowledge("00000000-0000-0000-0000-000000000001");
    mocks.searchKeyword.mockResolvedValue([]);
    mocks.semanticSearch.mockResolvedValue([{ knowledge: k1, vectorScore: 0.9 }]);
    mocks.getKnowledgeByIds.mockResolvedValue([withMeta(k1.id)]);

    const results = await hybridSearch(makeCtx(fakeProvider()), { query: "q", limit: 10 });

    expect(results).toHaveLength(1);
    expect(results[0]?.keywordScore).toBe(0);
    expect(results[0]?.score).toBeCloseTo(0.65 * 0.9, 5);
  });

  it("clamps negative vector scores to zero", async () => {
    const k1 = knowledge("00000000-0000-0000-0000-000000000001");
    mocks.searchKeyword.mockResolvedValue([]);
    mocks.semanticSearch.mockResolvedValue([{ knowledge: k1, vectorScore: -0.2 }]);
    mocks.getKnowledgeByIds.mockResolvedValue([withMeta(k1.id)]);

    const results = await hybridSearch(makeCtx(fakeProvider()), { query: "q", limit: 10 });

    expect(results[0]?.vectorScore).toBe(0);
  });

  it("resolves the project slug and passes it to both search paths", async () => {
    const project = { id: "proj-1", name: "Vendrex" };
    mocks.getProjectBySlug.mockResolvedValue(project);
    mocks.searchKeyword.mockResolvedValue([]);
    mocks.semanticSearch.mockResolvedValue([]);

    await hybridSearch(makeCtx(fakeProvider()), { query: "q", projectSlug: "vendrex", limit: 10 });

    expect(mocks.getProjectBySlug).toHaveBeenCalledWith(expect.anything(), userId, "vendrex");
    expect(mocks.searchKeyword).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      "q",
      expect.objectContaining({ filters: expect.objectContaining({ projectId: "proj-1" }) })
    );
    expect(mocks.semanticSearch).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      [0.1, 0.2, 0.3],
      expect.objectContaining({ filters: expect.objectContaining({ projectId: "proj-1" }) })
    );
  });

  it("does not filter by project when the slug is unknown", async () => {
    mocks.getProjectBySlug.mockResolvedValue(null);
    mocks.searchKeyword.mockResolvedValue([]);
    mocks.semanticSearch.mockResolvedValue([]);

    await hybridSearch(makeCtx(fakeProvider()), { query: "q", projectSlug: "missing", limit: 10 });

    expect(mocks.searchKeyword).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      "q",
      expect.objectContaining({ filters: expect.objectContaining({ projectId: undefined }) })
    );
  });

  it("passes the type filter to both search paths", async () => {
    mocks.searchKeyword.mockResolvedValue([]);
    mocks.semanticSearch.mockResolvedValue([]);

    await hybridSearch(makeCtx(fakeProvider()), { query: "q", type: "bug_fix", limit: 10 });

    expect(mocks.searchKeyword).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      "q",
      expect.objectContaining({ filters: expect.objectContaining({ type: "bug_fix" }) })
    );
  });

  it("keeps only results matching all requested tags, normalizing tag names", async () => {
    const k1 = knowledge("00000000-0000-0000-0000-000000000001");
    mocks.searchKeyword.mockResolvedValue([{ knowledge: k1, keywordScore: 0.5 }]);
    mocks.semanticSearch.mockResolvedValue([{ knowledge: k1, vectorScore: 0.5 }]);
    mocks.getKnowledgeByIds.mockResolvedValue([withMeta(k1.id, ["supabase", "rls"])]);

    const matching = await hybridSearch(makeCtx(fakeProvider()), {
      query: "q",
      tags: ["Supabase", "rls"],
      limit: 10,
    });
    expect(matching).toHaveLength(1);

    mocks.getKnowledgeByIds.mockResolvedValue([withMeta(k1.id, ["supabase"])]);
    const missing = await hybridSearch(makeCtx(fakeProvider()), {
      query: "q",
      tags: ["supabase", "firebase"],
      limit: 10,
    });
    expect(missing).toHaveLength(0);
  });

  it("returns an empty list when there are no hits at all", async () => {
    mocks.searchKeyword.mockResolvedValue([]);
    mocks.semanticSearch.mockResolvedValue([]);

    const results = await hybridSearch(makeCtx(fakeProvider()), { query: "q", limit: 10 });

    expect(results).toEqual([]);
    expect(mocks.getKnowledgeByIds).not.toHaveBeenCalled();
  });

  it("respects the requested limit and orders results descending", async () => {
    const k1 = knowledge("00000000-0000-0000-0000-000000000001");
    const k2 = knowledge("00000000-0000-0000-0000-000000000002");
    const k3 = knowledge("00000000-0000-0000-0000-000000000003");
    mocks.searchKeyword.mockResolvedValue([
      { knowledge: k1, keywordScore: 0.9 },
      { knowledge: k2, keywordScore: 0.5 },
      { knowledge: k3, keywordScore: 0.1 },
    ]);
    mocks.semanticSearch.mockResolvedValue([]);
    mocks.getKnowledgeByIds.mockResolvedValue([
      withMeta(k1.id),
      withMeta(k2.id),
      withMeta(k3.id),
    ]);

    const results = await hybridSearch(makeCtx(null), { query: "q", limit: 2 });

    expect(results).toHaveLength(2);
    expect(results[0]?.knowledge.id).toBe(k1.id);
    expect(results[1]?.knowledge.id).toBe(k2.id);
  });
});
