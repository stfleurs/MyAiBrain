import { z } from "zod";
import { projectSlugSchema } from "@pam/shared";
import { getProjectBySlug, listKnowledge } from "@pam/database";
import { fail, formatError, ok, type ToolDefinition } from "./util.js";

const inputSchema = z.object({
  slug: projectSlugSchema,
  include_knowledge: z.boolean().optional(),
});

export const getProject: ToolDefinition<z.infer<typeof inputSchema>> = {
  name: "get_project",
  description:
    "Get a project by slug, optionally including its knowledge entries (newest first).",
  inputSchema: inputSchema.shape,
  async handler(ctx, args) {
    try {
      const project = await getProjectBySlug(ctx.client, ctx.userId, args.slug);
      if (!project) {
        return fail(`project not found: ${args.slug}`);
      }

      let knowledge: unknown[] = [];
      if (args.include_knowledge) {
        const rows = await listKnowledge(ctx.client, ctx.userId, {
          projectId: project.id,
          limit: 100,
        });
        knowledge = rows
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((entry) => ({
            id: entry.id,
            title: entry.title,
            summary: entry.summary,
            type: entry.type,
            importance: entry.importance,
            created_at: entry.createdAt,
          }));
      }

      return ok(
        JSON.stringify(
          {
            id: project.id,
            name: project.name,
            slug: project.slug,
            description: project.description,
            repository_url: project.repositoryUrl,
            tech_stack: project.techStack,
            status: project.status,
            knowledge,
          },
          null,
          2
        )
      );
    } catch (err) {
      return fail(`get_project failed: ${formatError(err)}`);
    }
  },
};
