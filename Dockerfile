# ============================================================
# Production Dockerfile for Agentic Research Intelligence Platform
# ============================================================
# Build: docker build -t research-platform .
# Run:   docker run -p 3000:3000 --env-file .env research-platform
# ============================================================

FROM node:20-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssl \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN npm install -g bun

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile || bun install

# Copy source code
COPY . .

# Generate Prisma Client
RUN bun run db:generate

# Build the application
RUN bun run build

# ============================================================
# Production image
# ============================================================
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built application from base stage
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/package.json ./
COPY --from=base /app/bun.lockb* ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Start the application
CMD ["node", "server.js"]
