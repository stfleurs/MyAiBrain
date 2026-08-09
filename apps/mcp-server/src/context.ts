import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EmbeddingProvider } from "@pam/database";

export interface ToolContext {
  client: SupabaseClient<Database>;
  userId: string;
  embeddingProvider: EmbeddingProvider | null;
}
