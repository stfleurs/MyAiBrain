import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@pam/database";
import type { Config } from "./config.js";
import { getEmbeddingProvider } from "./services/embedding.js";
import type { ToolContext } from "./context.js";
import { registerTools } from "./tools/index.js";

export function buildMcpServer(ctx: ToolContext): McpServer {
  const server = new McpServer({ name: "personal-ai-memory", version: "0.1.0" });
  registerTools(server, ctx);
  return server;
}

export function createMcpServer(config: Config): McpServer {
  const client: SupabaseClient<Database> = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
  const ctx: ToolContext = {
    client,
    userId: config.MCP_USER_ID,
    embeddingProvider: getEmbeddingProvider(config),
  };
  return buildMcpServer(ctx);
}
