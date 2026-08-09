# Architecture

Full spec: see [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md).

## High-level

- **Agents** (ChatGPT, Claude Code, Codex, OpenCode) talk to a single **MCP server** over HTTPS.
- The **MCP server** owns the service-role Supabase key and exposes `search_memory`, `get_memory`,
  `save_memory`, `update_memory`, `list_projects`, `get_project`, `find_similar`, `find_previous_bug`.
- **Supabase** provides PostgreSQL + pgvector + Auth. Row Level Security restricts every row to its owner.
- A **Next.js dashboard** provides human search/browse/edit against the same data (anon key only).

## Repo layout

- `apps/web` — Next.js dashboard
- `apps/mcp-server` — MCP server (tsx runtime)
- `packages/shared` — shared types, zod schemas, constants
- `packages/database` — Supabase client factory and typed `Database` schema
- `supabase/migrations` — SQL schema + RLS
- `docs` — architecture, security, MCP, deployment notes

## Hybrid search

Keyword search (Postgres `tsvector`) and vector search (pgvector cosine) are combined:

`score = 0.35 * keyword_score + 0.65 * vector_score`

Weights live in `packages/shared/src/constants.ts` (`HYBRID_SEARCH_WEIGHTS`).
