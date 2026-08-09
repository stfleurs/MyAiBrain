import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let serviceClient: SupabaseClient<Database> | null = null;

function requiredEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }
  throw new Error(`${names.join(" or ")} must be set`);
}

export function getServiceClient(): SupabaseClient<Database> {
  if (serviceClient) {
    return serviceClient;
  }
  const url = requiredEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  serviceClient = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return serviceClient;
}
