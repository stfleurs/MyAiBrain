# IMPLEMENTATION_PLAN.md

Master specification for **Personal AI Memory** — a private engineering knowledge system owned by you and accessible to any AI agent (ChatGPT, Claude Code, Codex, OpenCode, and future agents) through MCP.

> **Your AI agents are replaceable. Your knowledge stays yours.**

This document is the **source of truth** for implementation. Any architectural change outside this plan must be proposed and approved before implementation.

---

## 0. Principles

1. **Single-user, private.** No multi-tenancy, no public data, no analytics.
2. **Postgres-first.** PostgreSQL + pgvector is the entire data layer. No Redis, no Elasticsearch, no separate vector DB, no Kubernetes.
3. **Boring infrastructure.** Managed services (Supabase, a container host) over self-managed complexity.
4. **Defense in depth.** MCP application-layer auth + Supabase Auth + PostgreSQL RLS + service-role secrets never in the browser.
5. **Structured knowledge, not chat blobs.** Knowledge entries with types, projects, tags, and code references — not raw conversation dumps.
6. **Hybrid search.** Keyword search + vector search, ranked together. Not vector-only.
7. **No automatic ingestion in V1.** The AI asks permission before saving a memory.

---

## 1. Project naming and repository

- **Name:** `personal-ai-memory`
- **Repo:** GitHub, currently at `stfleurs/MyAiBrain`. The plan below assumes the working repo will be laid out as described in §3 regardless of remote name. Rename repo to `personal-ai-memory` at Phase 0 only if approved.
- **Branch strategy:** `main` is the trunk. Feature branches + PRs for non-trivial changes.
- **Semantic versioning** after V1.

---

## 2. Technology decisions (locked for V1)

| Component           | Technology                          |
| ------------------- | ----------------------------------- |
| Web dashboard       | Next.js + TypeScript (App Router)   |
| MCP server          | TypeScript                          |
| MCP SDK             | Official MCP TypeScript SDK         |
| Database            | Supabase PostgreSQL (v15+)          |
| Semantic search     | pgvector                            |
| Authentication      | Supabase Auth (email/password)      |
| Authorization       | PostgreSQL RLS                      |
| Embeddings          | Provider behind a single interface (default: OpenAI `text-embedding-3-small`; must be swappable) |
| MCP hosting         | HTTPS container host (Cloud Run or similar) |
| Local development   | Docker Compose (Supabase local + services) |
| Package manager     | pnpm                                |
| Monorepo tooling    | pnpm workspaces                     |
| Tests               | Vitest                              |
| Formatting          | Prettier                            |
| Linting             | ESLint                              |
| Validation          | Zod                                 |
| SQL migrations      | Supabase migrations (`supabase/migrations`) |

**Do not introduce** in V1: multi-user accounts, teams, billing, mobile app, custom permissions, automatic conversation ingestion, autonomous agents, RAG pipelines, Elasticsearch, separate vector DB, Kubernetes, custom domain, fancy UI.

---

## 3. Repository structure (exact)

```text
personal-ai-memory/
├── apps/
│   ├── web/                          # Next.js dashboard
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/login/page.tsx
│   │   │   │   ├── (dashboard)/page.tsx
│   │   │   │   ├── (dashboard)/projects/[slug]/page.tsx
│   │   │   │   ├── (dashboard)/knowledge/[id]/page.tsx
│   │   │   │   ├── (dashboard)/knowledge/new/page.tsx
│   │   │   │   ├── (dashboard)/knowledge/[id]/edit/page.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   └── globals.css
│   │   │   ├── components/
│   │   │   ├── lib/                  # supabase client, server, middleware
│   │   │   └── actions/              # server actions (create/update/delete knowledge)
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── mcp-server/
│       ├── src/
│       │   ├── index.ts              # server entry, stdio + HTTP transports
│       │   ├── auth.ts               # bearer token auth for HTTP
│       │   ├── tools/
│       │   │   ├── search_memory.ts
│       │   │   ├── get_memory.ts
│       │   │   ├── save_memory.ts
│       │   │   ├── update_memory.ts
│       │   │   ├── list_projects.ts
│       │   │   ├── get_project.ts
│       │   │   ├── find_similar.ts
│       │   │   └── find_previous_bug.ts
│       │   ├── services/
│       │   │   ├── embedding.ts     # embedding provider interface
│       │   │   └── search.ts        # hybrid search orchestration
│       │   └── config.ts
│       ├── test/
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── database/                     # generated types + query helpers
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   ├── client.ts             # supabase client factory (server-only)
│   │   │   ├── projects.ts
│   │   │   ├── knowledge.ts
│   │   │   ├── tags.ts
│   │   │   └── embeddings.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── shared/                       # shared types, validation, constants
│       ├── src/
│       │   ├── schemas.ts            # zod schemas (canonical)
│       │   ├── types.ts
│       │   └── constants.ts          # knowledge types, importance levels
│       ├── package.json
│       └── tsconfig.json
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 0001_extensions.sql
│   │   ├── 0002_projects.sql
│   │   ├── 0003_knowledge.sql
│   │   ├── 0004_tags.sql
│   │   ├── 0005_knowledge_embeddings.sql
│   │   ├── 0006_code_references.sql
│   │   ├── 0007_rls.sql
│   │   ├── 0008_indexes.sql
│   │   └── 0009_triggers.sql
│   └── seed.sql
├── docs/
│   ├── architecture.md
│   ├── security.md
│   ├── mcp.md
│   └── deployment.md
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── .env.example
├── .gitignore
├── .prettierrc
├── .eslintrc.cjs
└── IMPLEMENTATION_PLAN.md
```

---

## 4. Database schema (exact DDL)

### 4.1 Extensions

```sql
create extension if not exists "vector";
create extension if not exists "pgcrypto"; -- gen_random_uuid
```

### 4.2 `projects`

```sql
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  repository_url text,
  tech_stack    text[],             -- e.g. {'flutter','firebase','revenuecat'}
  status        text not null default 'active'
                check (status in ('active','archived','maintained')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index on public.projects (user_id, slug);
```

### 4.3 `knowledge`

```sql
create table public.knowledge (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  project_id  uuid references public.projects(id) on delete set null,
  type        text not null
              check (type in (
                'architecture','decision','pattern','bug_fix',
                'template','lesson','configuration','deployment','feature'
              )),
  title       text not null,
  content     text not null,        -- markdown
  summary     text,
  source      text,                 -- where it came from (e.g. 'claude-code')
  importance  smallint not null default 3
              check (importance between 1 and 5),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on public.knowledge (user_id);
create index on public.knowledge (project_id);
create index on public.knowledge (type);
```

### 4.4 `tags`

```sql
create table public.tags (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name    text not null,
  unique (user_id, name)
);

create table public.knowledge_tags (
  knowledge_id uuid not null references public.knowledge(id) on delete cascade,
  tag_id       uuid not null references public.tags(id) on delete cascade,
  primary key (knowledge_id, tag_id)
);

create index on public.knowledge_tags (tag_id);
```

### 4.5 `knowledge_embeddings`

```sql
create table public.knowledge_embeddings (
  id           uuid primary key default gen_random_uuid(),
  knowledge_id uuid not null references public.knowledge(id) on delete cascade,
  embedding    vector(1536),        -- text-embedding-3-small default; change with model
  model        text not null,
  created_at   timestamptz not null default now(),
  unique (knowledge_id, model)
);

create index on public.knowledge_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

### 4.6 `code_references` (V2 — schema exists in V1, empty in production)

```sql
create table public.code_references (
  id           uuid primary key default gen_random_uuid(),
  knowledge_id uuid not null references public.knowledge(id) on delete cascade,
  project_id   uuid references public.projects(id) on delete set null,
  repository   text,
  file_path    text not null,
  symbol       text,
  line_start   integer,
  line_end     integer,
  commit_sha   text,
  url          text,
  created_at   timestamptz not null default now()
);

create index on public.code_references (knowledge_id);
create index on public.code_references (file_path);
```

### 4.7 Trigger: `updated_at`

```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.knowledge
  for each row execute function public.set_updated_at();
```

---

## 5. Row Level Security (exact policies)

Rule for every table: **authenticated users may touch only rows where `user_id = auth.uid()`; the owner column is forced to the authenticated user; no public access.**

### 5.1 `projects`

```sql
alter table public.projects enable row level security;

create policy "own projects" on public.projects
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### 5.2 `knowledge`

```sql
alter table public.knowledge enable row level security;

create policy "own knowledge" on public.knowledge
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### 5.3 `tags` / `knowledge_tags`

`tags` follows the same owner pattern. `knowledge_tags` uses an **owner-aware join** policy:

```sql
alter table public.tags enable row level security;
create policy "own tags" on public.tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.knowledge_tags enable row level security;
create policy "own knowledge_tags" on public.knowledge_tags
  for all using (
    exists (
      select 1 from public.knowledge k
      where k.id = knowledge_id and k.user_id = auth.uid()
    )
  );
```

### 5.4 `knowledge_embeddings`

```sql
alter table public.knowledge_embeddings enable row level security;
create policy "own embeddings" on public.knowledge_embeddings
  for all using (
    exists (
      select 1 from public.knowledge k
      where k.id = knowledge_id and k.user_id = auth.uid()
    )
  );
```

### 5.5 `code_references`

Same owner-aware policy via `knowledge` join.

### 5.6 Hard rules

- `anon` role: **no** SELECT/INSERT/UPDATE/DELETE anywhere.
- Service-role key bypasses RLS and **must never** reach the browser or MCP client; only the MCP server backend uses it.
- All `user_id` columns default to `auth.uid()` and are force-set server-side; a client cannot write another `user_id`.

---

## 6. Knowledge types, importance, tags

**Knowledge types (enum, fixed in V1):**

```
architecture | decision | pattern | bug_fix | template | lesson | configuration | deployment | feature
```

**Importance:** 1 (low) – 5 (critical), default 3.

**Tags:** free-form lowercase (`firebase`, `firestore`, `flutter`, `streams`, `revenuecat`, …). Unique per user, deduplicated on insert.

---

## 7. Embeddings

- One embedding per `knowledge` row per `model`.
- **Embedding input text** = `title + "\n" + summary + "\n" + content` (markdown stripped).
- **Default model:** `text-embedding-3-small` (1536 dims). Model is stored per row; when the model changes, re-embed.
- Embedding generation happens **server-side only** (MCP server and server actions), never in the browser.
- Provider lives behind a single interface in `packages/database` / `apps/mcp-server/src/services/embedding.ts` so it can be swapped (e.g. local model later).

---

## 8. MCP tools — V1 (exact signatures)

All tool inputs validated with Zod. All tools require authentication when served over HTTP.

### `search_memory`

```ts
input: {
  query: string,          // required, free text
  project?: string,       // project slug
  type?: KnowledgeType,   // one of the 9 types
  tags?: string[],        // all must match
  limit?: number,         // default 10, max 50
}
// returns: ranked list of { id, title, type, project_slug, summary, importance, tags, score }
```

### `get_memory`

```ts
input: { knowledge_id: string }
// returns: full record + tags + project + code references
```

### `save_memory`

```ts
input: {
  project?: string,        // slug (existing) or name (auto-create project)
  type: KnowledgeType,
  title: string,
  content: string,
  summary?: string,
  tags?: string[],
  importance?: 1|2|3|4|5,
}
// creates project if needed, inserts knowledge + tags + embedding
// returns: { id, title, type, project_slug, tags }
```

### `update_memory`

```ts
input: {
  knowledge_id: string,
  patch: {                  // all optional; at least one required
    title?, content?, summary?, type?, importance?, project?, tags?
  }
}
// re-embeds content if title/content/summary changed
// returns: updated record
```

### `list_projects`

```ts
input: {}
// returns: [{ id, name, slug, description, tech_stack, status, knowledge_count }]
```

### `get_project`

```ts
input: { slug: string, include_knowledge?: boolean }
// returns: project + its knowledge (titles/summaries), newest first
```

### `find_similar`

```ts
input: {
  query: string,       // describe the implementation you're looking for
  project?: string,
  type?: KnowledgeType,
  limit?: number,      // default 5
}
// returns: ranked semantically-similar knowledge
```

### `find_previous_bug`

```ts
input: {
  description: string, // describe the bug/symptom
  project?: string,
  limit?: number,      // default 5
}
// returns: bug_fix knowledge ranked by similarity; each result includes the resolution
```

---

## 9. Hybrid search algorithm

For `search_memory` and `find_similar`/`find_previous_bug`:

```text
Query
  │
  ├─→ keyword search (Postgres): tsvector over title+summary+content
  │       using websearch_to_tsquery('english', query)
  │       score = ts_rank(...)
  │
  └─→ vector search (pgvector): embedding(query) vs knowledge_embeddings
          score = 1 - (embedding <=> query_embedding)   -- cosine
  │
  ▼
Combine: score = w_k * keyword_score + w_v * vector_score
  (V1 default w_k = 0.35, w_v = 0.65; both normalized 0..1)
  ▼
Apply filters: project slug, type, tags (ALL match), limit
  ▼
Rank desc, return
```

- Keyword search covers `knowledge` (and tags via join).
- `find_previous_bug` additionally filters `type = 'bug_fix'`.
- Weight constants live in `packages/shared` and are documented in `docs/architecture.md`.

---

## 10. Web dashboard — V1 pages

| Route | Purpose |
|---|---|
| `/login` | Supabase Auth email/password sign in |
| `/` | Dashboard: global search, project list, knowledge by type |
| `/projects/[slug]` | Project detail + its knowledge |
| `/knowledge/[id]` | Knowledge detail (content, tags, related code refs) |
| `/knowledge/new` | Create knowledge (form: project, type, title, content, summary, tags, importance) |
| `/knowledge/[id]/edit` | Edit knowledge |

- All dashboard routes protected by middleware redirecting unauthenticated users to `/login`.
- Server-side RLS ensures the client can only read/write its own data.
- Web app uses **anon key** only; never the service-role key.

---

## 11. Environment variables (`.env.example`)

```env
# Shared
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
EMBEDDING_MODEL=text-embedding-3-small

# Embedding provider
OPENAI_API_KEY=

# Supabase (web app)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only; never exposed to browser

# MCP server
MCP_PORT=3001
MCP_AUTH_TOKEN=                   # required for HTTP transport
MCP_ACCESS_TOKEN=                 # optional long-lived token used by MCP clients
```

**Security rules:** `*_KEY` and `SUPABASE_SERVICE_ROLE_KEY` never appear client-side. `NEXT_PUBLIC_*` are only the anon key + project URL.

---

## 12. Local development

- `docker-compose.yml` runs **Supabase local** (via `supabase start`) plus the MCP server and web app.
- Required commands (documented in README):
  - `pnpm install`
  - `pnpm supabase start` / `pnpm dev` (runs web + mcp in watch mode)
  - `pnpm db:migrate` / `pnpm db:seed`
  - `pnpm typecheck` / `pnpm lint` / `pnpm test`
- Tests must pass locally before any deploy.

---

## 13. Deployment (V1)

```text
Internet
   │
   ├── Web Dashboard  (Vercel or container host; env: NEXT_PUBLIC_* + service role server-side)
   └── MCP Server     (container host, HTTPS; env: SUPABASE_URL, SERVICE_ROLE_KEY, MCP_AUTH_TOKEN)
          │
          ▼
      Supabase (hosted PostgreSQL + pgvector + Auth)
```

- MCP server container listens on HTTP; platform terminates TLS. No custom domain required initially.
- CI (GitHub Actions): typecheck → lint → test → build on every push/PR. Deploy on push to `main`.

---

## 14. Testing requirements (exact)

| Area | Tests |
|---|---|
| Database | create project; create/update/delete memory; tag dedup; embedding upsert |
| Security | user A cannot read/update/delete user B's knowledge; `anon` sees nothing; service key not exposed client-side |
| Search | keyword; semantic; combined; project filter; type filter; tag filter; limit |
| MCP | tool discovery; auth required; each of the 8 tools happy path + validation errors |
| Web | login; logout; dashboard; search; create memory; edit memory |
| Embeddings | provider interface contract; re-embed on content change |

---

## 15. Definition of done — V1

1. Claude Code (or any MCP client) connects to the MCP server over HTTPS.
2. Query "search my previous projects for a similar RevenueCat implementation" returns Vendrex + Tally Cart knowledge.
3. `save_memory` from an agent persists knowledge that appears in the web dashboard.
4. RLS isolation proven by test (user A cannot see user B's data).
5. Web dashboard supports login, search, browse, create, edit.
6. CI green on `main`.

---

## 16. Phases and acceptance criteria

### Phase 0 — Architecture
Repo layout, pnpm workspace, config (prettier/eslint/tsconfig), `.env.example`, docker-compose, README, docs stubs.
**AC:** `pnpm install && pnpm typecheck && pnpm lint && pnpm test` green with empty test suite.

### Phase 1 — Supabase
Project setup, migrations 0001–0009, seed data (projects: Tally Cart, Vendrex, Monetix, BoyoMart, VeganSandy + sample knowledge).
**AC:** migrations apply cleanly; RLS policies verified via SQL queries; seed runs idempotently.

### Phase 2 — Database layer
`packages/database` + `packages/shared`: zod schemas, types, repositories, CRUD, embedding service.
**AC:** unit tests pass; all repo methods honor RLS.

### Phase 3 — MCP server
Server entry (stdio + HTTP), auth, the 8 tools, error handling, logging.
**AC:** tests for discovery + all tools; unauthorized requests rejected.

### Phase 4 — Search
Hybrid keyword+vector search with ranking and filters.
**AC:** tests for keyword/semantic/combined/filtering pass; ranking sane on seed data.

### Phase 5 — Dashboard
Auth, project pages, knowledge browser, search, create/edit forms.
**AC:** web tests pass; manual login→search→create→edit works.

### Phase 6 — Deployment
Containerization, CI/CD, HTTPS, env secrets, production deploy.
**AC:** deployed web + MCP reachable over HTTPS; env vars verified absent from client bundle.

### Phase 7 — Agent integration
Configure Claude Code, Codex, OpenCode (and ChatGPT where supported) to use the MCP endpoint.
**AC:** end-to-end from §15 works from at least one agent.

### Phase 8 — GitHub integration (V2)
`search_code`, `get_file`, `find_symbol`, `find_commit`, `find_related_code`; populate `code_references`.
**AC:** MCP can answer "find the previous implementation of multi-currency handling" with file/commit references.

### Phase 9 — Intelligent memory (V2/V3)
Agent proposes "would you like me to save this?" → user confirms → `save_memory`. Summarization, memory maintenance.
**AC:** flagged decisions can be saved with one confirmation; no auto-ingestion.

---

## 17. What is out of scope for V1 (do not build)

Multi-user accounts · teams · billing · mobile app · complex permissions · automatic conversation ingestion · autonomous agents · large RAG pipelines · Elasticsearch · separate vector database · Kubernetes · custom domain · fancy UI · GitHub code search (V2).

---

## 18. Agent guardrails

- The coding agent follows this plan phase by phase and **must flag any deviation** before implementing.
- No architectural changes (schema, tools, stack) without approval.
- Secrets never committed; `.env*` gitignored; only `.env.example` is tracked.
- Comments in code only where they clarify non-obvious intent; no noise.
