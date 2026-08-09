export const KNOWLEDGE_TYPES = [
  "architecture",
  "decision",
  "pattern",
  "bug_fix",
  "template",
  "lesson",
  "configuration",
  "deployment",
  "feature",
] as const;

export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export const KNOWLEDGE_TYPE_LABELS: Record<KnowledgeType, string> = {
  architecture: "Architecture",
  decision: "Decision",
  pattern: "Pattern",
  bug_fix: "Bug Fix",
  template: "Template",
  lesson: "Lesson",
  configuration: "Configuration",
  deployment: "Deployment",
  feature: "Feature",
};

export const KNOWLEDGE_IMPORTANCE = [1, 2, 3, 4, 5] as const;

export type KnowledgeImportance = (typeof KNOWLEDGE_IMPORTANCE)[number];

export const PROJECT_STATUSES = ["active", "archived", "maintained"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const HYBRID_SEARCH_WEIGHTS = {
  keyword: 0.35,
  vector: 0.65,
} as const;

export const SEARCH_DEFAULTS = {
  limit: 10,
  maxLimit: 50,
} as const;

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
