# Deployment

Full spec: see [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md).

## Topology

```
Internet
  ├── Web Dashboard  (container host / Vercel; anon key only)
  └── MCP Server     (container host; HTTPS + MCP_AUTH_TOKEN)
         │
         ▼
     Supabase (hosted PostgreSQL + pgvector + Auth)
```

## Env

See [.env.example](../.env.example) for the canonical list. Secrets are provided by the host platform,
never committed.

## CI/CD

GitHub Actions runs `typecheck`, `lint`, `test` on every push/PR and deploys on `main`.
Workflow lands in Phase 6.

## Dockerfiles

- `apps/mcp-server/Dockerfile` — runs the server via `tsx`.
- `apps/web/Dockerfile` — builds the Next.js standalone output.

Both are finalized (build-tested) in Phase 6.
