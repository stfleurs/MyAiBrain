# Personal AI Memory

A private engineering knowledge system that you own and that can be accessed by ChatGPT, Claude Code,
Codex, OpenCode, and future AI agents through MCP.

> **Your AI agents are replaceable. Your knowledge stays yours.**

## Stack

- **Database:** Supabase (PostgreSQL + pgvector + Auth + RLS)
- **MCP server:** TypeScript, official MCP SDK
- **Dashboard:** Next.js + TypeScript
- **Monorepo:** pnpm workspaces · Vitest · ESLint · Prettier

## Repository structure

```text
apps/web/            Next.js dashboard
apps/mcp-server/     MCP server
packages/shared/     shared types, zod schemas, constants
packages/database/   Supabase client + typed schema
supabase/migrations/ SQL migrations
docs/                architecture, security, mcp, deployment
```

## Quickstart

```bash
pnpm install
pnpm dev            # web on :3000, mcp-server on :3001
pnpm typecheck
pnpm lint
pnpm test
```

Copy `.env.example` to `.env` and fill in the Supabase project values (URL, anon key, service role key).
Your local `.env` is gitignored and never committed.

## Scripts

| Script          | What it does                              |
| --------------- | ----------------------------------------- |
| `pnpm dev`      | Run web + mcp-server in watch mode        |
| `pnpm build`    | Build the web app                         |
| `pnpm typecheck`| Typecheck all workspaces                  |
| `pnpm lint`     | Lint all workspaces                       |
| `pnpm test`     | Run all tests                             |
| `pnpm db:migrate` | Push migrations to the linked project   |

## Status

Building V1 per [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md):

- Phase 0 — repository, workspace, tooling (done)
- Phase 1 — Supabase schema, RLS, seed data (done)
- Phase 2 — database layer (next)

## Documentation

- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — master spec
- [docs/architecture.md](docs/architecture.md)
- [docs/security.md](docs/security.md)
- [docs/mcp.md](docs/mcp.md)
- [docs/deployment.md](docs/deployment.md)
