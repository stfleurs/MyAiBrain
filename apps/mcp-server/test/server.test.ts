import { beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { EmbeddingProvider } from "@pam/database";
import type { ToolContext } from "../src/context.js";
import { buildMcpServer } from "../src/server.js";

const mocks = vi.hoisted(() => ({
  getProjectBySlug: vi.fn(),
  searchKeyword: vi.fn(),
  semanticSearch: vi.fn(),
  getKnowledgeByIds: vi.fn(),
  getKnowledge: vi.fn(),
  createKnowledge: vi.fn(),
  updateKnowledge: vi.fn(),
  resolveProject: vi.fn(),
  upsertEmbedding: vi.fn(),
  listProjects: vi.fn(),
  listKnowledge: vi.fn(),
}));

vi.mock("@pam/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pam/database")>();
  return {
    ...actual,
    getProjectBySlug: mocks.getProjectBySlug,
    searchKeyword: mocks.searchKeyword,
    semanticSearch: mocks.semanticSearch,
    getKnowledgeByIds: mocks.getKnowledgeByIds,
    getKnowledge: mocks.getKnowledge,
    createKnowledge: mocks.createKnowledge,
    updateKnowledge: mocks.updateKnowledge,
    resolveProject: mocks.resolveProject,
    upsertEmbedding: mocks.upsertEmbedding,
    listProjects: mocks.listProjects,
    listKnowledge: mocks.listKnowledge,
  };
});

const userId = "00000000-0000-0000-0000-000000000001";

const knowledge = {
  id: "11111111-1111-1111-1111-111111111111",
  userId,
  projectId: null,
  type: "lesson",
  title: "Supabase RLS is enforced",
  content: "Row Level Security isolates users at the database layer.",
  summary: "RLS notes",
  source: null,
  importance: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as const;

const withMeta = { ...knowledge, tags: ["supabase", "rls"], projectSlug: null };

const project = {
  id: "22222222-2222-2222-2222-222222222222",
  userId,
  name: "Vendrex",
  slug: "vendrex",
  description: null,
  repositoryUrl: null,
  techStack: ["flutter", "firebase"],
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as const;

const fakeProvider: EmbeddingProvider = {
  model: "text-embedding-3-small",
  embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
};

function textOf(result: Record<string, unknown>): string {
  const content = result.content;
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((entry) => {
      if (entry && typeof entry === "object" && "text" in entry) {
        return String((entry as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("");
}

async function setup(provider: EmbeddingProvider | null = null) {
  const ctx: ToolContext = { client: {} as never, userId, embeddingProvider: provider };
  const server = buildMcpServer(ctx);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tool discovery", () => {
  it("exposes the 8 V1 tools", async () => {
    const { client } = await setup();
    const { tools } = await client.listTools();
    expect(
      tools.map((tool) => tool.name).sort()
    ).toEqual(
      [
        "search_memory",
        "get_memory",
        "save_memory",
        "update_memory",
        "list_projects",
        "get_project",
        "find_similar",
        "find_previous_bug",
      ].sort()
    );
  });
});

describe("input validation", () => {
  it("rejects invalid arguments", async () => {
    const { client } = await setup();
    const result = await client.callTool({
      name: "get_memory",
      arguments: { knowledge_id: "not-a-uuid" },
    });
    expect(result.isError).toBe(true);
  });
});

describe("search_memory", () => {
  it("returns an empty list when nothing matches", async () => {
    mocks.searchKeyword.mockResolvedValue([]);
    mocks.semanticSearch.mockResolvedValue([]);
    const { client } = await setup(fakeProvider);

    const result = await client.callTool({
      name: "search_memory",
      arguments: { query: "gluconaut" },
    });

    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("[]");
    expect(mocks.getKnowledgeByIds).not.toHaveBeenCalled();
  });

  it("combines keyword and vector scores into a ranked list", async () => {
    mocks.searchKeyword.mockResolvedValue([{ knowledge, keywordScore: 0.5 }]);
    mocks.semanticSearch.mockResolvedValue([{ knowledge, vectorScore: 0.9 }]);
    mocks.getKnowledgeByIds.mockResolvedValue([withMeta]);
    const { client } = await setup(fakeProvider);

    const result = await client.callTool({
      name: "search_memory",
      arguments: { query: "rls", limit: 5 },
    });

    expect(result.isError).toBeUndefined();
    const text = textOf(result);
    expect(text).toContain("Supabase RLS is enforced");
    expect(text).toContain("0.935");
  });

  it("filters out results that do not match all requested tags", async () => {
    mocks.searchKeyword.mockResolvedValue([{ knowledge, keywordScore: 0.5 }]);
    mocks.semanticSearch.mockResolvedValue([]);
    mocks.getKnowledgeByIds.mockResolvedValue([withMeta]);
    const { client } = await setup(fakeProvider);

    const result = await client.callTool({
      name: "search_memory",
      arguments: { query: "rls", tags: ["firebase"] },
    });

    expect(textOf(result)).toContain("[]");
  });
});

describe("get_memory", () => {
  it("returns the full record", async () => {
    mocks.getKnowledge.mockResolvedValue(withMeta);
    const { client } = await setup();

    const result = await client.callTool({
      name: "get_memory",
      arguments: { knowledge_id: withMeta.id },
    });

    expect(result.isError).toBeUndefined();
    const text = textOf(result);
    expect(text).toContain("Supabase RLS is enforced");
    expect(text).toContain("supabase");
  });

  it("errors when the knowledge does not exist", async () => {
    mocks.getKnowledge.mockResolvedValue(null);
    const { client } = await setup();

    const result = await client.callTool({
      name: "get_memory",
      arguments: { knowledge_id: withMeta.id },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("not found");
  });
});

describe("save_memory", () => {
  it("resolves the project, stores the entry, and embeds it", async () => {
    mocks.resolveProject.mockResolvedValue(project);
    mocks.createKnowledge.mockResolvedValue({ ...withMeta, projectSlug: "vendrex" });
    mocks.upsertEmbedding.mockResolvedValue(undefined);
    const { client } = await setup(fakeProvider);

    const result = await client.callTool({
      name: "save_memory",
      arguments: {
        project: "Vendrex",
        type: "lesson",
        title: "Supabase RLS is enforced",
        content: "Row Level Security isolates users.",
        tags: ["supabase"],
      },
    });

    expect(result.isError).toBeUndefined();
    const text = textOf(result);
    expect(text).toContain(withMeta.id);
    expect(text).toContain("vendrex");
    expect(mocks.resolveProject).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      "Vendrex"
    );
    expect(mocks.upsertEmbedding).toHaveBeenCalledTimes(1);
  });

  it("warns but still saves when no embedding provider is configured", async () => {
    mocks.createKnowledge.mockResolvedValue(withMeta);
    const { client } = await setup(null);

    const result = await client.callTool({
      name: "save_memory",
      arguments: { type: "lesson", title: "T", content: "C" },
    });

    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("OPENAI_API_KEY not configured");
    expect(mocks.upsertEmbedding).not.toHaveBeenCalled();
  });
});

describe("update_memory", () => {
  it("errors when the knowledge does not exist", async () => {
    mocks.getKnowledge.mockResolvedValue(null);
    const { client } = await setup();

    const result = await client.callTool({
      name: "update_memory",
      arguments: { knowledge_id: withMeta.id, patch: { title: "New" } },
    });

    expect(result.isError).toBe(true);
  });

  it("re-embeds when the title changes", async () => {
    mocks.getKnowledge.mockResolvedValue(withMeta);
    mocks.updateKnowledge.mockResolvedValue({ ...withMeta, title: "New title" });
    mocks.upsertEmbedding.mockResolvedValue(undefined);
    const { client } = await setup(fakeProvider);

    const result = await client.callTool({
      name: "update_memory",
      arguments: { knowledge_id: withMeta.id, patch: { title: "New title" } },
    });

    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("New title");
    expect(mocks.upsertEmbedding).toHaveBeenCalledTimes(1);
  });
});

describe("list_projects", () => {
  it("returns projects with snake_case fields", async () => {
    mocks.listProjects.mockResolvedValue([
      {
        id: project.id,
        name: "Vendrex",
        slug: "vendrex",
        description: null,
        techStack: ["flutter"],
        status: "active",
        knowledgeCount: 3,
      },
    ]);
    const { client } = await setup();

    const result = await client.callTool({ name: "list_projects", arguments: {} });

    expect(result.isError).toBeUndefined();
    const text = textOf(result);
    expect(text).toContain("vendrex");
    expect(text).toContain("knowledge_count");
    expect(text).toContain('"tech_stack"');
  });
});

describe("get_project", () => {
  it("includes knowledge entries when requested", async () => {
    mocks.getProjectBySlug.mockResolvedValue(project);
    mocks.listKnowledge.mockResolvedValue([withMeta]);
    const { client } = await setup();

    const result = await client.callTool({
      name: "get_project",
      arguments: { slug: "vendrex", include_knowledge: true },
    });

    expect(result.isError).toBeUndefined();
    const text = textOf(result);
    expect(text).toContain("vendrex");
    expect(text).toContain("Supabase RLS is enforced");
  });

  it("errors for an unknown slug", async () => {
    mocks.getProjectBySlug.mockResolvedValue(null);
    const { client } = await setup();

    const result = await client.callTool({
      name: "get_project",
      arguments: { slug: "nope" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("project not found");
  });
});

describe("find_similar", () => {
  it("ranks semantically similar knowledge", async () => {
    mocks.searchKeyword.mockResolvedValue([]);
    mocks.semanticSearch.mockResolvedValue([{ knowledge, vectorScore: 0.8 }]);
    mocks.getKnowledgeByIds.mockResolvedValue([withMeta]);
    const { client } = await setup(fakeProvider);

    const result = await client.callTool({
      name: "find_similar",
      arguments: { query: "database access rules" },
    });

    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("Supabase RLS is enforced");
  });
});

describe("find_previous_bug", () => {
  it("filters to bug_fix knowledge and includes the resolution", async () => {
    mocks.searchKeyword.mockResolvedValue([{ knowledge, keywordScore: 0.4 }]);
    mocks.semanticSearch.mockResolvedValue([]);
    mocks.getKnowledgeByIds.mockResolvedValue([withMeta]);
    const { client } = await setup(fakeProvider);

    const result = await client.callTool({
      name: "find_previous_bug",
      arguments: { description: "login fails with 403" },
    });

    expect(result.isError).toBeUndefined();
    const text = textOf(result);
    expect(text).toContain("Row Level Security isolates users");
    expect(mocks.searchKeyword).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      "login fails with 403",
      expect.objectContaining({
        filters: expect.objectContaining({ type: "bug_fix" }),
      })
    );
  });
});
