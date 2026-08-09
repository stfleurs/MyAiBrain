import { z } from "zod";

const envSchema = z.object({
  MCP_PORT: z.coerce.number().int().positive().default(3001),
  MCP_TRANSPORT: z.enum(["http", "stdio"]).default("http"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MCP_AUTH_TOKEN: z.string().min(1),
  // Single-owner identity for V1: every authenticated MCP request operates
  // within this user's knowledge scope, so MCP_AUTH_TOKEN is effectively a
  // credential for this user's private MCP. Multi-user MCP authentication
  // (identify the calling user and scope to their user_id / RLS) is deferred.
  MCP_USER_ID: z.string().uuid(),
  EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  OPENAI_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const resolved = { ...env };
  if (resolved.MCP_PORT === undefined && resolved.PORT !== undefined) {
    resolved.MCP_PORT = resolved.PORT;
  }
  return envSchema.parse(resolved);
}
