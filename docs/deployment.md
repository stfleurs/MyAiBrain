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
| `ci.yml` | push to `main`, every PR | typecheck, lint, unit tests (shared/mcp-server/web, the latter scanning the built bundle), web build, client-bundle secret scan, MCP image build-test |
| `integration.yml` | push to `main`, PR, manual | database integration tests against hosted Supabase (auto-skips until secrets are set) |
| `deploy.yml` | **manual (`workflow_dispatch`) only** | build & push MCP image to Artifact Registry, deploy to Cloud Run; optional Vercel deploy |

### Security boundary (read first)

Cloud Run is publicly reachable over HTTPS (`--allow-unauthenticated`); **the MCP application is the
security boundary**, not the platform:

- `/mcp` without a token → `401`
- `/mcp` with a wrong token → `401`
- `/mcp` with the correct `MCP_AUTH_TOKEN` → MCP session

`/health` is a minimal liveness probe returning `{"status":"ok"}` and never leaks config,
environment, or data. The service is deliberately single-owner in V1: `MCP_USER_ID` is the Supabase
Auth UUID of the owner account and every authenticated request operates in that user's scope, so
`MCP_AUTH_TOKEN` is effectively a credential for that user's private MCP. Multi-user MCP
authentication is deferred to V2.

### Service accounts (least privilege)

- **`pam-deploy`** — GitHub Actions identity (via WIF). Only what deploying needs:
  `run.admin`, `artifactregistry.writer`, and `iam.serviceAccountUser` on the runtime SA (to attach
  it to the service). It has **no access to secret values**. WIF is bound to
  `stfleurs/MyAiBrain` **and** `refs/heads/main`.
- **`pam-mcp-runtime`** — the Cloud Run runtime identity. Only reads the three GSM secrets and
  writes logs; it has no deployment permissions.

Deployment permission chain:

```
GitHub Actions (repo stfleurs/MyAiBrain @ main)
   ↓ WIF (no stored keys)
pam-deploy
   ↓ deploy-cloudrun
Cloud Run service (runtime identity: pam-mcp-runtime)
   ↓ secretmanager.secretAccessor
Secret Manager (SUPABASE_SERVICE_ROLE_KEY, MCP_AUTH_TOKEN, OPENAI_API_KEY)
```

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
| var | `CLOUD_RUN_SERVICE_ACCOUNT` | runtime SA email, e.g. `pam-mcp-runtime@<project>.iam.gserviceaccount.com` |
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

Health check: `curl https://<cloud-run-url>/health` → `{"status":"ok"}`.

## Secret hygiene (must NEVER)

The following secrets must never be exposed:

| Item | Rule |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | never in source, committed `.env`, Docker build args, image layers, `NEXT_PUBLIC_*`, CI logs, or the browser bundle |
| `MCP_AUTH_TOKEN` | same rules; the only places are the GitHub secret, Secret Manager, and your MCP client config |
| `OPENAI_API_KEY` | server-side only on Vercel/Cloud Run; **never** `NEXT_PUBLIC_OPENAI_API_KEY` |

The Cloud Run container receives secrets **only from Secret Manager**, never from GitHub or build
context. `.dockerignore` excludes `.env` files so they never enter a build context. Two independent
CI checks (the `check:secrets` script and the `bundle-secrets.test.ts` regression test) fail if any
of these appear in the generated browser bundle — keep both permanently.

## Token rotation

```text
generate new MCP_AUTH_TOKEN            openssl rand -hex 32
   ↓
update GitHub secret                   gh secret set MCP_AUTH_TOKEN
   ↓
update Secret Manager                  gcloud secrets versions add MCP_AUTH_TOKEN --data-file=-
   ↓
redeploy Cloud Run                     gh workflow run deploy.yml
   ↓
old token invalid                      (secret is read as latest at deploy; the old
                                       version stays in Secret Manager for rollback)
```

Rolling back = redeploy with the previous Secret Manager version (drop the `:latest` reference).

## Dockerfiles

- `apps/mcp-server/Dockerfile` — builds the pnpm monorepo and runs the server via `tsx` (no compile step). Cloud Run env sets `PORT`; `loadConfig` in `apps/mcp-server/src/config.ts` falls back to `PORT` when `MCP_PORT` is unset.
- `apps/web/Dockerfile` — builds the Next.js standalone output; `NEXT_PUBLIC_*` must be passed as build args (they are inlined at build time). Used for non-Vercel hosts; Vercel builds from source instead.
- `docker-compose.yml` — local parity (web :3000, mcp-server :3001).

## Env

See [.env.example](../.env.example) for the canonical list. Secrets are provided by the host platform, never committed.

## Secret leak guard

Two layers, both permanent:

- `pnpm --filter @pam/web check:secrets` — scans `.next/static` (the client bundle) for any env
  name/value that is not `NEXT_PUBLIC_*` and fails if found. Runs in CI after `next build`.
- `apps/web/test/bundle-secrets.test.ts` — a vitest regression test that explicitly asserts
  `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `MCP_AUTH_TOKEN` (names and values) never appear
  in the built bundle. Runs in CI after the build; skips when no build output exists yet.
