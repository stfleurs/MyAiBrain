import { z } from "zod";
import { getKnowledge } from "@pam/database";
import { fail, formatError, ok, type ToolDefinition } from "./util.js";

const inputSchema = z.object({
  knowledge_id: z.string().uuid(),
});

export const getMemory: ToolDefinition<z.infer<typeof inputSchema>> = {
  name: "get_memory",
  description:
    "Get a single knowledge entry by id, including tags, project slug, and code references.",
  inputSchema: inputSchema.shape,
  async handler(ctx, args) {
    try {
      const knowledge = await getKnowledge(ctx.client, ctx.userId, args.knowledge_id);
      if (!knowledge) {
        return fail(`knowledge not found: ${args.knowledge_id}`);
      }
      return ok(
        JSON.stringify(
          {
            id: knowledge.id,
            title: knowledge.title,
            type: knowledge.type,
            content: knowledge.content,
            summary: knowledge.summary,
            importance: knowledge.importance,
            source: knowledge.source,
            project_slug: knowledge.projectSlug,
            tags: knowledge.tags,
            created_at: knowledge.createdAt,
            updated_at: knowledge.updatedAt,
            code_references: [],
          },
          null,
          2
        )
      );
    } catch (err) {
      return fail(`get_memory failed: ${formatError(err)}`);
    }
  },
};
