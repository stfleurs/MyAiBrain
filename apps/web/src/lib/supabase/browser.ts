import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@pam/database";

export function createClient(): ReturnType<typeof createBrowserClient<Database>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set"
    );
  }
  return createBrowserClient<Database>(url, anonKey);
}
