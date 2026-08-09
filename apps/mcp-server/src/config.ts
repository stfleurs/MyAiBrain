import { z } from "zod";

const envSchema = z.object({
  MCP_PORT: z.coerce.number().int().positive().default(3001),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  MCP_AUTH_TOKEN: z.string().min(1).optional(),
  EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  OPENAI_API_KEY: z.string().optional(),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return envSchema.parse(env);
}
