FROM node:22-alpine AS base
RUN corepack enable pnpm

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma 7 loads prisma.config.ts which requires DATABASE_URL.
# Provide a dummy — generate only reads the schema, never connects.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
# Increase Node heap and disable telemetry for Docker builds
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec prisma generate
RUN pnpm build

# --- Runner ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# pg_dump for database backups (jobs container)
RUN apk add --no-cache postgresql16-client
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
# Next.js standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Prisma schema + config for migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
# Generated Prisma client (jobs import from src/generated/prisma/client)
COPY --from=builder /app/src/generated ./src/generated
# Jobs runner + full node_modules (jobs need node-cron, pino, yahoo-finance2, etc.)
COPY --from=builder /app/jobs ./jobs
COPY --from=deps /app/node_modules ./node_modules
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
