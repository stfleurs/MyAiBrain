# Security

Full spec: see [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md).

## Principles

1. **Single-user.** The system is a personal tool, not a SaaS.
2. **RLS is the enforcement layer.** Every table has Row Level Security; users can only read/write rows
   where `user_id = auth.uid()`. Join tables are protected via owner-aware policies.
3. **Service-role key is server-only.** It bypasses RLS and must never reach the browser or MCP clients.
   The web app uses the anon key; the MCP server holds the service-role key.
4. **MCP auth over HTTPS.** The MCP HTTP endpoint requires a bearer token (`MCP_AUTH_TOKEN`).
5. **Defense in depth.** Even if the MCP application layer is compromised, PostgreSQL RLS still
   restricts data access to the owning account.

## Rules

- `anon` role: no access to any table.
- Secrets are never committed; `.env*` is gitignored (`.env.example` is tracked).
- `NEXT_PUBLIC_*` vars are only the Supabase project URL and anon key.
