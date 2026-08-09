import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext } from "../context.js";
import { searchMemory } from "./search_memory.js";
import { getMemory } from "./get_memory.js";
import { saveMemory } from "./save_memory.js";
import { updateMemory } from "./update_memory.js";
import { listProjects } from "./list_projects.js";
import { getProject } from "./get_project.js";
import { findSimilar } from "./find_similar.js";
import { findPreviousBug } from "./find_previous_bug.js";

const tools = [
  searchMemory,
  getMemory,
  saveMemory,
  updateMemory,
  listProjects,
  getProject,
  findSimilar,
  findPreviousBug,
];

export function registerTools(server: McpServer, ctx: ToolContext): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      (args) => tool.handler(ctx, args as never)
    );
  }
}
