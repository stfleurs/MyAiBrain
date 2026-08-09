import type { KnowledgeImportance, KnowledgeType, ProjectStatus } from "./constants";

export interface Project {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  repositoryUrl: string | null;
  techStack: string[];
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Knowledge {
  id: string;
  userId: string;
  projectId: string | null;
  type: KnowledgeType;
  title: string;
  content: string;
  summary: string | null;
  source: string | null;
  importance: KnowledgeImportance;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  userId: string;
  name: string;
}

export interface CodeReference {
  id: string;
  knowledgeId: string;
  projectId: string | null;
  repository: string | null;
  filePath: string;
  symbol: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  commitSha: string | null;
  url: string | null;
  createdAt: string;
}

export interface KnowledgeWithMeta extends Knowledge {
  tags: string[];
  projectSlug: string | null;
  score?: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  techStack: string[];
  status: ProjectStatus;
  knowledgeCount: number;
}

export interface SearchResult {
  knowledge: KnowledgeWithMeta;
  keywordScore: number;
  vectorScore: number;
  score: number;
}
