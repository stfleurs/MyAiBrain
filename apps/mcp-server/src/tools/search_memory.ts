import { z } from "zod";
import { knowledgeTypeSchema, projectSlugSchema } from "@pam/shared";
import { hybridSearch } from "../services/search.js";
import { fail, formatError, ok, round, type ToolDefinition } from "./util.js";

const inputSchema = z.object({
  query: z.string().min(1).max(2000),
  project: projectSlugSchema.optional(),
  type: knowledgeTypeSchema.optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const searchMemory: ToolDefinition<z.infer<typeof inputSchema>> = {
  name: "search_memory",
  description:
    "Search the personal memory by keyword and semantic relevance combined. Returns ranked knowledge entries. Optionally filter by project slug, type, and tags (all must match).",
  inputSchema: inputSchema.shape,
  async handler(ctx, args) {
    try {
      const results = await hybridSearch(ctx, {
        query: args.query,
        projectSlug: args.project,
        type: args.type,
        tags: args.tags,
        limit: args.limit ?? 10,
      });
      return ok(
        JSON.stringify(
          results.map((result) => ({
            id: result.knowledge.id,
            title: result.knowledge.title,
            type: result.knowledge.type,
            project_slug: result.knowledge.projectSlug,
            summary: result.knowledge.summary,
            importance: result.knowledge.importance,
            tags: result.knowledge.tags,
            score: round(result.score),
          })),
          null,
          2
        )
      );
    } catch (err) {
      return fail(`search_memory failed: ${formatError(err)}`);
    }
  },
};
