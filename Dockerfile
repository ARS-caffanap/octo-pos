# ============================================================
# OctoPOS — Multi-stage Dockerfile
# Builds both backend (Go) and frontend (Next.js) for ARM64
# ============================================================

# ── Stage 1: Backend Builder (Go → ARM64 binary) ──────────
FROM golang:1.25-alpine AS backend-builder

RUN apk add --no-cache git ca-certificates

WORKDIR /build

# Cache Go modules
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Build the Go binary for ARM64
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 \
    go build -ldflags="-s -w" -o /app/octopos-server ./cmd/server/main.go

# ── Stage 2: Frontend Builder (Next.js) ───────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# Root package.json (npm workspaces)
COPY package.json package-lock.json* ./

# Frontend package.json
COPY frontend/package.json frontend/package-lock.json* frontend/

# Install all workspace dependencies
RUN npm ci 2>/dev/null || npm install

# Copy frontend source and build
COPY frontend/ frontend/

# Ensure public directory exists (Next.js needs it)
RUN mkdir -p frontend/public

RUN npm run build --workspace frontend

# ── Stage 3: Runtime (Alpine + binary + Next.js) ──────────
FROM node:20-alpine

RUN apk add --no-cache ca-certificates tzdata curl

WORKDIR /app

# Copy backend binary
COPY --from=backend-builder /app/octopos-server /usr/local/bin/octopos-server

# Copy backend migrations
COPY backend/migrations ./migrations

# Copy frontend build output + node_modules for next start
COPY --from=frontend-builder /build/frontend/.next ./frontend/.next
COPY --from=frontend-builder /build/frontend/public ./frontend/public
COPY --from=frontend-builder /build/frontend/package.json ./frontend/package.json
COPY --from=frontend-builder /build/frontend/next.config.mjs ./frontend/next.config.mjs
COPY --from=frontend-builder /build/node_modules ./node_modules
COPY --from=frontend-builder /build/package.json ./package.json

# Expose ports
# 8080 = backend API (internal container port)
# 3000 = frontend Next.js (internal container port)
EXPOSE 8080 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["/usr/local/bin/octopos-server"]
