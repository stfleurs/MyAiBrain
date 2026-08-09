import { z } from "zod";
import { knowledgeImportanceSchema, knowledgeTypeSchema } from "@pam/shared";
import {
  buildEmbeddingText,
  createKnowledge,
  resolveProject,
  upsertEmbedding,
} from "@pam/database";
import { fail, formatError, ok, type ToolDefinition } from "./util.js";

const inputSchema = z.object({
  project: z.string().min(1).max(100).optional(),
  type: knowledgeTypeSchema,
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(100_000),
  summary: z.string().max(2000).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  importance: knowledgeImportanceSchema.optional(),
});

export const saveMemory: ToolDefinition<z.infer<typeof inputSchema>> = {
  name: "save_memory",
  description:
    "Persist a knowledge entry to the personal brain. Creates the project from a slug or name if it does not exist, then stores an embedding for semantic search.",
  inputSchema: inputSchema.shape,
  async handler(ctx, args) {
    try {
      const projectId = args.project
        ? (await resolveProject(ctx.client, ctx.userId, args.project)).id
        : null;
      const knowledge = await createKnowledge(ctx.client, ctx.userId, {
        type: args.type,
        title: args.title,
        content: args.content,
        summary: args.summary ?? null,
        source: "mcp",
        importance: args.importance ?? 3,
        projectId,
        tags: args.tags,
      });

      let note = "";
      if (ctx.embeddingProvider) {
        try {
          const vector = await ctx.embeddingProvider.embed(
            buildEmbeddingText({
              title: knowledge.title,
              content: knowledge.content,
              summary: knowledge.summary,
            })
          );
          await upsertEmbedding(ctx.client, ctx.userId, knowledge.id, vector, ctx.embeddingProvider.model);
        } catch (err) {
          note = `\n(warning: embedding not stored: ${formatError(err)})`;
        }
      } else {
        note = "\n(warning: OPENAI_API_KEY not configured; no embedding stored)";
      }

      return ok(
        JSON.stringify(
          {
            id: knowledge.id,
            title: knowledge.title,
            type: knowledge.type,
            project_slug: knowledge.projectSlug,
            tags: knowledge.tags,
          },
          null,
          2
        ) + note
      );
    } catch (err) {
      return fail(`save_memory failed: ${formatError(err)}`);
    }
  },
};
