import { z } from "zod";
import { knowledgeImportanceSchema, knowledgeTypeSchema } from "@pam/shared";
import {
  buildEmbeddingText,
  getKnowledge,
  resolveProject,
  updateKnowledge,
  upsertEmbedding,
} from "@pam/database";
import { fail, formatError, ok, type ToolDefinition } from "./util.js";

const patchSchema = z
  .object({
    project: z.string().min(1).max(100).optional(),
    type: knowledgeTypeSchema.optional(),
    title: z.string().min(1).max(300).optional(),
    content: z.string().min(1).max(100_000).optional(),
    summary: z.string().max(2000).nullable().optional(),
    tags: z.array(z.string().min(1).max(50)).max(20).optional(),
    importance: knowledgeImportanceSchema.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "patch must contain at least one field",
  });

const inputSchema = z.object({
  knowledge_id: z.string().uuid(),
  patch: patchSchema,
});

export const updateMemory: ToolDefinition<z.infer<typeof inputSchema>> = {
  name: "update_memory",
  description:
    "Update an existing knowledge entry. Recomputes the embedding when the title, content, or summary change.",
  inputSchema: inputSchema.shape,
  async handler(ctx, args) {
    try {
      const existing = await getKnowledge(ctx.client, ctx.userId, args.knowledge_id);
      if (!existing) {
        return fail(`knowledge not found: ${args.knowledge_id}`);
      }

      const patch = args.patch;
      const projectId =
        patch.project !== undefined
          ? (await resolveProject(ctx.client, ctx.userId, patch.project)).id
          : existing.projectId;

      const updated = await updateKnowledge(ctx.client, ctx.userId, args.knowledge_id, {
        type: patch.type,
        title: patch.title,
        content: patch.content,
        summary: patch.summary,
        importance: patch.importance,
        projectId,
        tags: patch.tags,
      });
      if (!updated) {
        return fail(`knowledge not found: ${args.knowledge_id}`);
      }

      const contentChanged =
        (patch.title !== undefined && patch.title !== existing.title) ||
        (patch.content !== undefined && patch.content !== existing.content) ||
        (patch.summary !== undefined && patch.summary !== existing.summary);

      let note = "";
      if (contentChanged) {
        if (ctx.embeddingProvider) {
          try {
            const vector = await ctx.embeddingProvider.embed(
              buildEmbeddingText({
                title: updated.title,
                content: updated.content,
                summary: updated.summary,
              })
            );
            await upsertEmbedding(ctx.client, ctx.userId, updated.id, vector, ctx.embeddingProvider.model);
          } catch (err) {
            note = `\n(warning: embedding not refreshed: ${formatError(err)})`;
          }
        } else {
          note = "\n(warning: OPENAI_API_KEY not configured; embedding not refreshed)";
        }
      }

      return ok(
        JSON.stringify(
          {
            id: updated.id,
            title: updated.title,
            type: updated.type,
            summary: updated.summary,
            importance: updated.importance,
            project_slug: updated.projectSlug,
            tags: updated.tags,
            updated_at: updated.updatedAt,
          },
          null,
          2
        ) + note
      );
    } catch (err) {
      return fail(`update_memory failed: ${formatError(err)}`);
    }
  },
};
