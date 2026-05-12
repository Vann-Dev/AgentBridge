FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/cli/package.json ./packages/cli/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
ENV AUTH_SECRET="docker-build-placeholder"
ENV DATABASE_URL="postgresql://agentbridge:agentbridge@localhost:5432/agentbridge?schema=public"
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/cli/node_modules ./packages/cli/node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build:web

FROM base AS runner
ENV NODE_ENV="production"
ENV NEXT_TELEMETRY_DISABLED="1"

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/generated ./apps/web/generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["pnpm", "--filter", "@agentbridge/web", "start", "--", "-H", "0.0.0.0"]
