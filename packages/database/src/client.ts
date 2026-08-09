import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let serviceClient: SupabaseClient<Database> | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

export function getServiceClient(): SupabaseClient<Database> {
  if (serviceClient) {
    return serviceClient;
  }
  const url = requiredEnv("SUPABASE_URL");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  serviceClient = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return serviceClient;
}
