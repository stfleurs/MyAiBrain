# Deployment

Full spec: see [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md).

## Topology

```
Internet
  ├── Web Dashboard  (Vercel; anon key only)
  └── MCP Server     (Cloud Run; HTTPS + MCP_AUTH_TOKEN)
         │
         ▼
     Supabase (hosted PostgreSQL + pgvector + Auth)
```

## CI/CD

GitHub Actions (in `.github/workflows/`):

| Workflow | Triggers | Runs |
| --- | --- | --- |
| `ci.yml` | push to `main`, every PR | typecheck, lint, unit tests (shared/web/mcp-server), web build, client-bundle secret scan, MCP image build-test |
| `integration.yml` | push to `main`, PR, manual | database integration tests against hosted Supabase (auto-skips until secrets are set) |
| `deploy.yml` | push to `main`, manual | build & push MCP image to Artifact Registry, deploy to Cloud Run; optional Vercel deploy |

### Web (Vercel)

Vercel builds `apps/web` directly from the repo (`vercel.json` sets `rootDirectory`). Link the repo in the Vercel dashboard and configure project env vars:

| Var | Type | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | build | public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build | public anon key (safe to expose; RLS protects data) |
| `OPENAI_API_KEY` | runtime | optional; enables best-effort embeddings when creating knowledge |

The `deploy-web` job in `deploy.yml` is an alternative to Vercel's git integration and only runs on manual dispatch once `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` secrets exist.

### MCP server (Cloud Run)

One-time setup (requires a GCP project):

```bash
gcloud auth login
gcloud config set project <PROJECT_ID>
gcloud services enable run.googleapis.com artifactregistry.googleapis.com

# Artifact Registry repo
gcloud artifacts repositories create pam --repository-format=docker \
  --location=us-central1

# Secret Manager secrets referenced by the container
gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-
gcloud secrets create MCP_AUTH_TOKEN --data-file=-
gcloud secrets create OPENAI_API_KEY --data-file=-
```

Create a service account for deploy + a Workload Identity Federation provider, then configure GitHub repo vars/secrets:

| Kind | Name | Value |
| --- | --- | --- |
| var | `GCP_PROJECT_ID` | GCP project ID |
| var | `GCR_LOCATION` | e.g. `us-central1` |
| var | `GCR_REPOSITORY` | e.g. `pam` |
| var | `CLOUD_RUN_SERVICE` | e.g. `pam-mcp` |
| var | `CLOUD_RUN_REGION` | e.g. `us-central1` |
| var | `GSM_SERVICE_ROLE_KEY` | Secret Manager secret name |
| var | `GSM_MCP_AUTH_TOKEN` | Secret Manager secret name |
| var | `GSM_OPENAI_API_KEY` | Secret Manager secret name |
| secret | `WIF_PROVIDER` | full `projects/<p>/locations/global/workloadIdentityPools/<w>/providers/<prov>` |
| secret | `WIF_SERVICE_ACCOUNT` | deploy service account email |
| secret | `SUPABASE_URL` | Supabase project URL |
| secret | `MCP_USER_ID` | the Supabase auth user ID the MCP acts as |

Non-secret values (`SUPABASE_URL`, `MCP_USER_ID`, `MCP_TRANSPORT`) are passed as plain env vars; keys (`SUPABASE_SERVICE_ROLE_KEY`, `MCP_AUTH_TOKEN`, `OPENAI_API_KEY`) are pulled from Secret Manager. The service runs `--allow-unauthenticated` because MCP clients connect directly; authorization is enforced by the app via `MCP_AUTH_TOKEN` (send `Authorization: Bearer <token>`). `--max-instances=1` keeps in-memory MCP sessions sticky.

Client config (e.g. Claude Desktop / any MCP client):

```
{
  "mcpServers": {
    "personal-ai-memory": {
      "url": "https://<cloud-run-url>/mcp",
      "headers": { "Authorization": "Bearer <MCP_AUTH_TOKEN>" }
    }
  }
}
```

Health check: `curl https://<cloud-run-url>/health`.

## Dockerfiles

- `apps/mcp-server/Dockerfile` — builds the pnpm monorepo and runs the server via `tsx` (no compile step). Cloud Run env sets `PORT`; `loadConfig` in `apps/mcp-server/src/config.ts` falls back to `PORT` when `MCP_PORT` is unset.
- `apps/web/Dockerfile` — builds the Next.js standalone output; `NEXT_PUBLIC_*` must be passed as build args (they are inlined at build time). Used for non-Vercel hosts; Vercel builds from source instead.
- `docker-compose.yml` — local parity (web :3000, mcp-server :3001).

## Env

See [.env.example](../.env.example) for the canonical list. Secrets are provided by the host platform, never committed.

## Secret leak guard

`pnpm --filter @pam/web check:secrets` scans `.next/static` (the client bundle) for any env name/value that is not `NEXT_PUBLIC_*` and fails if found. Runs in CI after `next build`.
