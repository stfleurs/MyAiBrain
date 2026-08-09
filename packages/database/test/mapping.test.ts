import { describe, expect, it } from "vitest";
import { mapKnowledge, mapProject } from "../src/mapping";

describe("mapProject", () => {
  it("maps snake_case row to domain type", () => {
    const project = mapProject({
      id: "p1",
      user_id: "u1",
      name: "Vendrex",
      slug: "vendrex",
      description: "desc",
      repository_url: "https://github.com/x/y",
      tech_stack: ["flutter"],
      status: "active",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });
    expect(project).toMatchObject({
      userId: "u1",
      repositoryUrl: "https://github.com/x/y",
      techStack: ["flutter"],
      status: "active",
    });
  });
});

describe("mapKnowledge", () => {
  it("maps snake_case row to domain type", () => {
    const knowledge = mapKnowledge({
      id: "k1",
      user_id: "u1",
      project_id: null,
      type: "bug_fix",
      title: "Firestore timeout",
      content: "Resolution text",
      summary: null,
      source: "manual",
      importance: 4,
      search_tsv: "''",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });
    expect(knowledge).toMatchObject({
      projectId: null,
      type: "bug_fix",
      importance: 4,
      source: "manual",
    });
  });
});
