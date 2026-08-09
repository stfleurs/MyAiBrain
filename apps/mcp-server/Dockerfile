# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Install every workspace dependency (tsx runs the server at runtime, so devDeps are required).
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/mcp-server/package.json apps/mcp-server/
COPY packages/shared/package.json packages/shared/
COPY packages/database/package.json packages/database/
RUN pnpm install --frozen-lockfile

FROM base AS run
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/mcp-server ./apps/mcp-server
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-workspace.yaml ./
EXPOSE 3001
CMD ["pnpm", "--filter", "@pam/mcp-server", "start"]
