import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@pam/database";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set"
    );
  }
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component; can be ignored when middleware
          // already refreshed the session.
        }
      },
    },
  });
}

export async function getUser() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  return user ?? null;
}
