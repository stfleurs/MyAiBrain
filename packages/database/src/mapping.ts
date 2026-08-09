import type { Knowledge, Project } from "@pam/shared";
import type { Database } from "./types";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type KnowledgeRow = Database["public"]["Tables"]["knowledge"]["Row"];

export function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    repositoryUrl: row.repository_url,
    techStack: row.tech_stack,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapKnowledge(row: KnowledgeRow): Knowledge {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    type: row.type,
    title: row.title,
    content: row.content,
    summary: row.summary,
    source: row.source,
    importance: row.importance,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
