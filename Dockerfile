# ============================================
# Smart Job Matching Platform — Docker Image
# ============================================

FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 (native addon)
RUN apk add --no-cache python3 make g++

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production

# ---

FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies for better-sqlite3
RUN apk add --no-cache libstdc++

# Copy built node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY package.json ./
COPY src/ ./src/
COPY frontend/ ./frontend/

# Create directories for persistent data
RUN mkdir -p /app/data /app/uploads

# Environment variables
ENV NODE_ENV=production
ENV PORT=8000
ENV DATABASE_PATH=/app/data/smart_jobs.db

# Expose the port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

# Start the application
CMD ["node", "src/index.js"]
