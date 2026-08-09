import { z } from "zod";
import { knowledgeTypeSchema, projectSlugSchema } from "@pam/shared";
import { hybridSearch } from "../services/search.js";
import { fail, formatError, ok, round, type ToolDefinition } from "./util.js";

const inputSchema = z.object({
  query: z.string().min(1).max(2000),
  project: projectSlugSchema.optional(),
  type: knowledgeTypeSchema.optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const findSimilar: ToolDefinition<z.infer<typeof inputSchema>> = {
  name: "find_similar",
  description:
    "Find knowledge semantically similar to a description of an implementation, pattern, or idea.",
  inputSchema: inputSchema.shape,
  async handler(ctx, args) {
    try {
      const results = await hybridSearch(ctx, {
        query: args.query,
        projectSlug: args.project,
        type: args.type,
        limit: args.limit ?? 5,
      });
      return ok(
        JSON.stringify(
          results.map((result) => ({
            id: result.knowledge.id,
            title: result.knowledge.title,
            type: result.knowledge.type,
            project_slug: result.knowledge.projectSlug,
            summary: result.knowledge.summary,
            tags: result.knowledge.tags,
            score: round(result.score),
          })),
          null,
          2
        )
      );
    } catch (err) {
      return fail(`find_similar failed: ${formatError(err)}`);
    }
  },
};
