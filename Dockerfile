FROM oven/bun:1.2-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
COPY tsconfig.json ./

ENV NODE_ENV=production
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["sh", "-c", "bun -e \"const port = process.env.PORT || '3002'; fetch('http://127.0.0.1:' + port + '/health').then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); }).catch(() => process.exit(1))\""]

CMD ["bun", "run", "src/index.ts"]
