FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS prod-deps
COPY . .
RUN pnpm install --prod --frozen-lockfile

FROM base AS run
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/mcp-server ./apps/mcp-server
COPY --from=prod-deps /app/packages ./packages
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
EXPOSE 3001
CMD ["pnpm", "--filter", "@pam/mcp-server", "start"]
