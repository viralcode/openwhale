FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install build dependencies for native modules (better-sqlite3, node-llama-cpp)
RUN apk add --no-cache python3 make g++ curl git

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install
# Build native modules (better-sqlite3, sqlite-vec, etc.)
RUN pnpm approve-builds || true

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p drizzle extensions
# Generate drizzle migrations before building
RUN pnpm run db:generate || true
RUN pnpm build

# Production
FROM base AS runner
ENV NODE_ENV=production

# Copy built output and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Rebuild native modules for this specific Alpine/Node environment
RUN cd /app/node_modules/.pnpm/better-sqlite3@12.8.0/node_modules/better-sqlite3 && \
    npm rebuild better-sqlite3 --build-from-source || \
    (npm install --ignore-scripts=false && node-pre-gyp install --fallback-to-build) || true

# Copy dashboard static assets (CSS + JS served at runtime)
COPY --from=builder /app/src/dashboard/style.css ./dist/dashboard/
COPY --from=builder /app/src/dashboard/main.js ./dist/dashboard/

# Copy runtime directories
COPY --from=builder /app/skills ./skills
# extensions dir may not exist - create it if needed
RUN mkdir -p /app/extensions
COPY --from=builder /app/.env.example ./.env.example

# Create data and config directories
RUN mkdir -p /app/data /app/config /app/.openwhale

# Non-root user for security
RUN addgroup --system --gid 1001 openwhale && \
    adduser --system --uid 1001 openwhale && \
    chown -R openwhale:openwhale /app
USER openwhale

EXPOSE 7777
CMD ["node", "dist/index.js"]
