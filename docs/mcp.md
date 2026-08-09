# MCP

Full spec: see [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md).

## Transport

- Local development: stdio and HTTP on `MCP_PORT` (default `3001`).
- Production: HTTPS (terminated by the container host), bearer token auth via `MCP_AUTH_TOKEN`.

## V1 tools

| Tool                | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `search_memory`     | Hybrid keyword + vector search with filters     |
| `get_memory`        | Full record (content, tags, project, code refs) |
| `save_memory`       | Create knowledge + tags + embedding             |
| `update_memory`     | Update knowledge, re-embed on content change    |
| `list_projects`     | Projects with knowledge counts                  |
| `get_project`       | Project details, optionally its knowledge       |
| `find_similar`      | Semantic search for similar implementations     |
| `find_previous_bug` | Semantic search scoped to `bug_fix` entries     |

Inputs are validated with Zod (`packages/shared/src/schemas.ts`).

## Client configuration

An MCP client (e.g. Claude Code, OpenCode) points at the HTTPS endpoint and supplies the bearer token.
Example `claude_desktop_config.json` / `opencode.json` entries will be added in Phase 7.
