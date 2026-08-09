# Deployment Runbook — one-time provisioning (Phase 6)

Everything below creates **new** resources. Nothing deletes, rotates, or overwrites existing
credentials. Review in `docs/deployment.md` first; this file is the step-by-step execution guide.

## 0. Prerequisites

- [ ] Google Cloud project with billing enabled (create via console: https://console.cloud.google.com)
- [ ] Supabase project (already used for local dev) — you own it
- [ ] GitHub repo `stfleurs/MyAiBrain` (exists)
- [ ] Vercel account (create via https://vercel.com if needed)

Install CLI tools (macOS):

```bash
brew install --cask google-cloud-sdk
npm i -g vercel
```

Verify: `gh --version`, `gcloud --version`, `vercel --version`.

---

## Security model (read before provisioning)

- **Cloud Run is publicly reachable over HTTPS.** The security boundary is the MCP application:
  `/mcp` without a token → `401`, wrong token → `401`, correct `MCP_AUTH_TOKEN` → MCP session.
- `/health` returns only `{"status":"ok"}` — no config, env, or data.
- **`MCP_USER_ID` is the single-owner identity for V1.** It is the Supabase Auth UUID of the owner
  account; all authenticated MCP requests operate within that user's knowledge scope, and
  `MCP_AUTH_TOKEN` is effectively a credential for that user's private MCP. Multi-user MCP
  authentication (identify the caller, scope to their `user_id` / RLS) is **deferred to V2** — do
  not carry this single-owner assumption forward when adding users.
- **The service-role key must NEVER** appear in source, committed `.env` files, Docker build args,
  Docker image layers, `NEXT_PUBLIC_*` env, CI logs, or the browser bundle. Same for `MCP_AUTH_TOKEN`
  and `OPENAI_API_KEY`. The Cloud Run container gets secrets **only from Secret Manager**.
- Workload Identity Federation is bound to repo `stfleurs/MyAiBrain` **and** branch `refs/heads/main`.
- Two SAs, least privilege: **`pam-deploy`** (GitHub Actions → GCP deploy; no runtime data access)
  and **`pam-mcp-runtime`** (Cloud Run identity; reads the 3 secrets + writes logs; no deploy perms).

---

## 1. Values you collect manually (do this first)

| # | Value | Where to get it | Secret/Var it feeds |
| --- | --- | --- | --- |
| V1 | `GCP_PROJECT_ID` | GCP console — pick, e.g. `pam-prod` | `GCP_PROJECT_ID` var |
| V2 | `GCP_REGION` | Pick e.g. `us-central1` | `GCR_LOCATION`, `CLOUD_RUN_REGION` vars |
| V3 | `SUPABASE_URL` | Supabase → Settings → API | `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` |
| V4 | `SUPABASE_ANON_KEY` | Supabase → Settings → API (public, RLS-protected) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| V5 | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (**secret**) | `SUPABASE_SERVICE_ROLE_KEY` (GitHub + GSM) |
| V6 | `MCP_USER_ID` | Supabase → Authentication → Users → **your** account UUID (owner; must equal the web user) | `MCP_USER_ID` |
| V7 | `MCP_AUTH_TOKEN` | Generate: `openssl rand -hex 32` (**secret**) | `MCP_AUTH_TOKEN` (GitHub + GSM) + MCP client config |
| V8 | `OPENAI_API_KEY` | OpenAI dashboard (**secret**) | `OPENAI_API_KEY` (GitHub, GSM, Vercel) |

---

## 2. gcloud — project, APIs, Artifact Registry, Secret Manager, IAM, WIF

Run locally once. Login (non-destructive):

```bash
gcloud auth login
```

### 2.1 Project + APIs

```bash
gcloud projects create "$GCP_PROJECT_ID" --name="Personal AI Memory"   # fails harmlessly if it exists
gcloud config set project "$GCP_PROJECT_ID"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iamcredentials.googleapis.com
```

Capture the numeric project ID for WIF:

```bash
GCP_PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format='value(projectNumber)')
echo "$GCP_PROJECT_NUMBER"
```

### 2.2 Artifact Registry (image repo)

```bash
gcloud artifacts repositories create pam --repository-format=docker \
  --location=us-central1 --description="Personal AI Memory images"
```

### 2.3 Secret Manager (3 secrets)

Values are piped from stdin, so they never appear in shell history or on disk:

```bash
gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --replication-policy=automatic
printf '%s' "<SUPABASE_SERVICE_ROLE_KEY>" | gcloud secrets versions add SUPABASE_SERVICE_ROLE_KEY --data-file=-

gcloud secrets create MCP_AUTH_TOKEN --replication-policy=automatic
printf '%s' "<MCP_AUTH_TOKEN>" | gcloud secrets versions add MCP_AUTH_TOKEN --data-file=-

gcloud secrets create OPENAI_API_KEY --replication-policy=automatic
printf '%s' "<OPENAI_API_KEY>" | gcloud secrets versions add OPENAI_API_KEY --data-file=-
```

If a secret already exists, skip its `create` and run only `versions add`.

### 2.4 Service accounts (least privilege)

**Deploy SA** (`pam-deploy` — used by GitHub Actions):

```bash
gcloud iam service-accounts create pam-deploy --display-name="PAM deploy"
SA="pam-deploy@$GCP_PROJECT_ID.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$SA" --role="roles/run.admin"
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$SA" --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
```

**Runtime SA** (`pam-mcp-runtime` — identity the Cloud Run service runs as). Only secret access +
logging; **no** deployment permissions:

```bash
gcloud iam service-accounts create pam-mcp-runtime --display-name="PAM MCP runtime"
RUNTIME_SA="pam-mcp-runtime@$GCP_PROJECT_ID.iam.gserviceaccount.com"

for SECRET in SUPABASE_SERVICE_ROLE_KEY MCP_AUTH_TOKEN OPENAI_API_KEY; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:$RUNTIME_SA" --role="roles/secretmanager.secretAccessor"
done
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$RUNTIME_SA" --role="roles/logging.logWriter"

# The deploy SA may attach the runtime SA to the Cloud Run service (no broader grant):
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$SA" --role="roles/iam.serviceAccountUser"
```

### 2.5 Workload Identity Federation (GitHub → GCP, no stored keys)

```bash
gcloud iam workload-identity-pools create github-actions --location=global \
  --project="$GCP_PROJECT_ID" --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github --location=global \
  --project="$GCP_PROJECT_ID" --workload-identity-pool=github-actions \
  --display-name="GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository == 'stfleurs/MyAiBrain'"

gcloud iam service-accounts add-iam-policy-binding "$SA" --project="$GCP_PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$GCP_PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/subject/repo:stfleurs/MyAiBrain:ref:refs/heads/main"
```

Two values to hand to GitHub (`gh` section):

```bash
echo "projects/$GCP_PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/providers/github"   # -> WIF_PROVIDER
echo "$SA"                                                                                                    # -> WIF_SERVICE_ACCOUNT
echo "$RUNTIME_SA"                                                                                            # -> CLOUD_RUN_SERVICE_ACCOUNT var
```

---

## 3. gh — GitHub variables and secrets

```bash
# Variables (non-secret)
gh variable set GCP_PROJECT_ID --body "$GCP_PROJECT_ID"
gh variable set GCR_LOCATION --body us-central1
gh variable set GCR_REPOSITORY --body pam
gh variable set CLOUD_RUN_SERVICE --body pam-mcp
gh variable set CLOUD_RUN_REGION --body us-central1
gh variable set CLOUD_RUN_SERVICE_ACCOUNT --body "$RUNTIME_SA"
gh variable set GSM_SERVICE_ROLE_KEY --body SUPABASE_SERVICE_ROLE_KEY
gh variable set GSM_MCP_AUTH_TOKEN --body MCP_AUTH_TOKEN
gh variable set GSM_OPENAI_API_KEY --body OPENAI_API_KEY

# Secrets (gh prompts for each value — nothing hits shell history)
gh secret set WIF_PROVIDER
gh secret set WIF_SERVICE_ACCOUNT
gh secret set SUPABASE_URL
gh secret set NEXT_PUBLIC_SUPABASE_URL
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY
gh secret set SUPABASE_SERVICE_ROLE_KEY
gh secret set MCP_USER_ID
gh secret set MCP_AUTH_TOKEN
gh secret set OPENAI_API_KEY
```

Verify: `gh secret list`, `gh variable list`.

---

## 4. Vercel CLI — link repo + environment variables

Primary path: link the repo, set env, and let git integration auto-deploy `main`.
(The `deploy-web` job in `deploy.yml` is an alternative; it needs `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` secrets and only runs on manual dispatch.)

```bash
vercel login
vercel link --yes --project pam-web        # uses vercel.json (rootDirectory apps/web)

# Values are typed at the prompt (hidden):
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add OPENAI_API_KEY production
```

Then either:
- run `vercel --prod` once now, or
- enable "Git" integration in the Vercel project settings → auto-deploys on push to `main`.

Note: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public by design (RLS is
the boundary). `OPENAI_API_KEY` is server-side only — never create `NEXT_PUBLIC_OPENAI_API_KEY`.

---

## 5. First deployment (explicit production gate)

`deploy.yml` runs **only on manual dispatch** while the system stabilizes — a push to `main` runs
CI (typecheck/lint/tests/build/secret scans) but does **not** deploy. Once stable, we can switch
`deploy.yml` back to `push: branches: [main]`.

```bash
# Push to main (CI + integration validate; nothing deploys yet):
git push

# Deploy explicitly when CI is green:
gh workflow run deploy.yml
```

Watch progress:

```bash
gh run watch $(gh run list --workflow=deploy.yml --limit=1 --json databaseId -q '.[0].databaseId')
```

---

## 6. Verification checklist — first production deployment

```bash
URL=$(gcloud run services describe pam-mcp --region=us-central1 --format='value(status.url)')
```

1. **Cloud Run up**: `curl -s "$URL/health"` → `{"status":"ok"}`
2. **Auth enforced (no token)**: `curl -s -o /dev/null -w '%{http_code}\n' "$URL/mcp"` → `401`
3. **Auth enforced (bad token)**: `curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer wrong" -X POST "$URL/mcp"` → `401`
4. **Auth accepted (real token)** (non-401 response, e.g. an MCP JSON-RPC error, not 401):
   `curl -s -i -H "Authorization: Bearer $MCP_AUTH_TOKEN" -X POST "$URL/mcp" -H 'Content-Type: application/json' -d '{}' | head -5`
5. **Web reachable**: open the Vercel URL → `/login` renders.
6. **Web auth**: sign in with your Supabase account → dashboard loads.
7. **Web create**: create a test memory (title e.g. `deploy-smoke-<date>`).
8. **Web read**: the memory appears in the dashboard + search.
9. **Real MCP call from an agent** (Claude Code / Codex) with config
   `{"mcpServers":{"personal-ai-memory":{"url":"<URL>/mcp","headers":{"Authorization":"Bearer <MCP_AUTH_TOKEN>"}}}}`
   → `search_memory` finds the step-7 memory.
10. **Secret-leak guard green**: CI `check:secrets` + `bundle-secrets.test.ts` passed on the push in step 5.
11. **Secrets not in bundle**: `curl -s <vercel-url> | grep -c SUPABASE_SERVICE_ROLE_KEY` → `0` (and no key substring).
12. **CI green**: all checks passed.

**Final live-data test**: delete the step-7 memory from the dashboard, then re-run the agent's
`search_memory` for its title — it must **not** be found. This proves MCP queries the live database,
not a cached fixture.

Only when all of the above pass is Phase 6 actually complete.
