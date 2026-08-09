import { z } from "zod";
import { listProjects as listProjectsRepo } from "@pam/database";
import { fail, formatError, ok, type ToolDefinition } from "./util.js";

const inputSchema = z.object({});

export const listProjects: ToolDefinition<z.infer<typeof inputSchema>> = {
  name: "list_projects",
  description: "List all projects in the personal brain with their knowledge counts.",
  inputSchema: inputSchema.shape,
  async handler(ctx) {
    try {
      const projects = await listProjectsRepo(ctx.client, ctx.userId);
      return ok(
        JSON.stringify(
          projects.map((project) => ({
            id: project.id,
            name: project.name,
            slug: project.slug,
            description: project.description,
            tech_stack: project.techStack,
            status: project.status,
            knowledge_count: project.knowledgeCount,
          })),
          null,
          2
        )
      );
    } catch (err) {
      return fail(`list_projects failed: ${formatError(err)}`);
    }
  },
};
