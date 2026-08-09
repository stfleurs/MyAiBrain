import { z } from "zod";
import { projectSlugSchema } from "@pam/shared";
import { hybridSearch } from "../services/search.js";
import { fail, formatError, ok, round, type ToolDefinition } from "./util.js";

const inputSchema = z.object({
  description: z.string().min(1).max(2000),
  project: projectSlugSchema.optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const findPreviousBug: ToolDefinition<z.infer<typeof inputSchema>> = {
  name: "find_previous_bug",
  description:
    "Search for previously recorded bug fixes matching a symptom or error description. Each result includes the resolution.",
  inputSchema: inputSchema.shape,
  async handler(ctx, args) {
    try {
      const results = await hybridSearch(ctx, {
        query: args.description,
        projectSlug: args.project,
        type: "bug_fix",
        limit: args.limit ?? 5,
      });
      return ok(
        JSON.stringify(
          results.map((result) => ({
            id: result.knowledge.id,
            title: result.knowledge.title,
            summary: result.knowledge.summary,
            content: result.knowledge.content,
            project_slug: result.knowledge.projectSlug,
            tags: result.knowledge.tags,
            score: round(result.score),
          })),
          null,
          2
        )
      );
    } catch (err) {
      return fail(`find_previous_bug failed: ${formatError(err)}`);
    }
  },
};
