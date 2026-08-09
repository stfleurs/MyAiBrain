import { z } from "zod";
import { KNOWLEDGE_IMPORTANCE, KNOWLEDGE_TYPES, SEARCH_DEFAULTS } from "./constants";

export const projectSlugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with dashes");

export const knowledgeTypeSchema = z.enum(KNOWLEDGE_TYPES);

export const knowledgeImportanceSchema = z
  .number()
  .int()
  .min(Math.min(...KNOWLEDGE_IMPORTANCE))
  .max(Math.max(...KNOWLEDGE_IMPORTANCE));

const limitSchema = (defaultLimit: number) =>
  z.number().int().min(1).max(SEARCH_DEFAULTS.maxLimit).optional().default(defaultLimit);

export const searchMemoryInputSchema = z.object({
  query: z.string().min(1).max(2000),
  project: projectSlugSchema.optional(),
  type: knowledgeTypeSchema.optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  limit: limitSchema(SEARCH_DEFAULTS.limit),
});

export const getMemoryInputSchema = z.object({
  knowledgeId: z.string().uuid(),
});

export const saveMemoryInputSchema = z.object({
  project: z.string().min(1).max(100).optional(),
  type: knowledgeTypeSchema,
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(100_000),
  summary: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  importance: knowledgeImportanceSchema.optional().default(3),
});

export const updateMemoryInputSchema = z.object({
  knowledgeId: z.string().uuid(),
  patch: z
    .object({
      project: z.string().min(1).max(100).optional(),
      type: knowledgeTypeSchema.optional(),
      title: z.string().min(1).max(300).optional(),
      content: z.string().min(1).max(100_000).optional(),
      summary: z.string().max(2000).nullable().optional(),
      tags: z.array(z.string().min(1).max(50)).max(20).optional(),
      importance: knowledgeImportanceSchema.optional(),
    })
    .refine((p) => Object.keys(p).length > 0, "patch must contain at least one field"),
});

export const listProjectsInputSchema = z.object({});

export const getProjectInputSchema = z.object({
  slug: projectSlugSchema,
  includeKnowledge: z.boolean().optional().default(false),
});

export const findSimilarInputSchema = z.object({
  query: z.string().min(1).max(2000),
  project: projectSlugSchema.optional(),
  type: knowledgeTypeSchema.optional(),
  limit: limitSchema(5),
});

export const findPreviousBugInputSchema = z.object({
  description: z.string().min(1).max(2000),
  project: projectSlugSchema.optional(),
  limit: limitSchema(5),
});

export type SearchMemoryInput = z.infer<typeof searchMemoryInputSchema>;
export type GetMemoryInput = z.infer<typeof getMemoryInputSchema>;
export type SaveMemoryInput = z.infer<typeof saveMemoryInputSchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemoryInputSchema>;
export type GetProjectInput = z.infer<typeof getProjectInputSchema>;
export type FindSimilarInput = z.infer<typeof findSimilarInputSchema>;
export type FindPreviousBugInput = z.infer<typeof findPreviousBugInputSchema>;
