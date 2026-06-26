# OctoPOS — Deployment Guide

Production-ready deployment with Docker Compose on **ARM64** (Raspberry Pi 5, AWS Graviton, Apple Silicon).

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    Docker Host                   │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ postgres │  │ backend  │  │  frontend    │  │
│  │  :5432   │  │  :8080   │  │  :3000       │  │
│  │ internal │  │ internal │  │  internal    │  │
│  └──────────┘  └────┬─────┘  └──────┬───────┘  │
│                     │               │           │
│               host  │:2323    host  │:3232      │
│                     ▼               ▼           │
│              localhost:2323   localhost:3232     │
└─────────────────────────────────────────────────┘
```

| Service  | Container Port | Host Port | Tech          |
|----------|---------------|-----------|---------------|
| postgres | 5432          | 5432      | PostgreSQL 15 |
| backend  | 8080          | 2323      | Go (Gin)      |
| frontend | 3000          | 3232      | Next.js 14    |

## Prerequisites

- **Docker** 24+ and **Docker Compose** v2+
- ARM64 host (Raspberry Pi 5, Apple Silicon, AWS Graviton)
- Git

## Quick Start

### 1. Clone & Configure

```bash
git clone git@github.com:ARS-caffanap/octo-pos.git
cd octo-pos
```

### 2. Set Environment Variables

Create a `.env` file in the project root:

```bash
# Required: change this in production!
JWT_SECRET=your-secure-random-string-here
```

All other variables have sensible defaults. See [Environment Variables](#environment-variables) for the full list.

### 3. Build & Start

```bash
docker compose up -d --build
```

First build takes 3–5 minutes. Subsequent builds are cached.

### 4. Verify

```bash
# Backend health check
curl http://localhost:2323/health
# → {"status":"ok"}

# Swagger docs
curl -I http://localhost:2323/api-docs/index.html
# → HTTP/1.1 200 OK

# Frontend (redirects to /login if unauthenticated)
curl -I http://localhost:3232
# → HTTP/1.1 307 Temporary Redirect
# → Location: /login
```

### 5. Check Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

## Dockerfile Details

### Multi-stage Build (3 stages)

| Stage | Base Image | Purpose |
|-------|-----------|---------|
| `backend-builder` | `golang:1.25-alpine` | Compile Go binary for **linux/arm64** |
| `frontend-builder` | `node:20-alpine` | Build Next.js `.next` output |
| `runtime` | `node:20-alpine` | Node.js runtime for `next start` + Go binary |

### Key Build Flags

```dockerfile
CGO_ENABLED=0 GOOS=linux GOARCH=arm64 \
    go build -ldflags="-s -w" -o /app/octopos-server
```

- `CGO_ENABLED=0` — pure Go, no libc dependency
- `GOARCH=arm64` — target ARM64 architecture
- `-ldflags="-s -w"` — strip debug info, smaller binary

## Environment Variables

| Variable | Default | Service | Description |
|----------|---------|---------|-------------|
| `HOST` | `0.0.0.0` | backend | Server bind address |
| `PORT` | `8080` | backend | Server port (internal) |
| `ENVIRONMENT` | `production` | backend | `development` or `production` |
| `DB_HOST` | `postgres` | backend | PostgreSQL hostname |
| `DB_PORT` | `5432` | backend | PostgreSQL port |
| `DB_USER` | `octopos` | backend | Database user |
| `DB_PASSWORD` | `octopos` | backend | Database password |
| `DB_NAME` | `octopos` | backend | Database name |
| `DB_SSLMODE` | `disable` | backend | PostgreSQL SSL mode |
| `JWT_SECRET` | (required) | backend | JWT signing secret |
| `NODE_ENV` | `production` | frontend | Node environment |
| `NEXT_PUBLIC_API_URL` | `http://localhost:2323/api/v1` | frontend | Backend API URL for client |

## Useful Commands

```bash
# Stop all services
docker compose down

# Stop and remove volumes (resets database!)
docker compose down -v

# Rebuild a single service
docker compose up -d --build backend

# View resource usage
docker stats octopos-backend octopos-frontend octopos-postgres

# Shell into a container
docker compose exec backend sh
docker compose exec postgres psql -U octopos

# Backup database
docker compose exec postgres pg_dump -U octopos octopos > backup.sql

# Restore database
docker compose exec -T postgres psql -U octopos octopos < backup.sql
```

## Troubleshooting

### "exec format error"

This means the binary was built for the wrong architecture. The Dockerfile explicitly sets `GOARCH=arm64`. If you're on an **amd64** host, change `GOARCH=arm64` to `GOARCH=amd64` in the Dockerfile.

### "Cannot connect to database"

The backend waits for postgres to be healthy before starting. Check:

```bash
docker compose ps postgres
# Should show "healthy" under STATUS

docker compose logs postgres
# Look for "database system is ready to accept connections"
```

### "JWT_SECRET not set"

If `JWT_SECRET` is still the default `change-me-in-production`, authentication will work but is insecure. Generate a secure secret:

```bash
openssl rand -hex 64
```

Add it to your `.env` file and restart:

```bash
docker compose up -d --force-recreate backend
```

### "next build" fails during Docker build

The Next.js build requires all frontend dependencies. Ensure:

1. `frontend/package.json` is present with all dependencies
2. The root `package.json` declares `frontend` as a workspace
3. `npm ci` succeeds (falls back to `npm install` if no lockfile)

### Port conflicts

If ports 2323 or 3232 are already in use:

```bash
# Find what's using the port
sudo lsof -i :2323
sudo lsof -i :3232

# Or change the host port in docker-compose.yml:
#   ports:
#     - "2324:8080"  # change host port only
```

## Production Checklist

- [ ] Set a strong `JWT_SECRET` in `.env`
- [ ] Change default database password (`DB_PASSWORD`)
- [ ] Set `ENVIRONMENT=production`
- [ ] Set up SSL reverse proxy (nginx, Caddy, or Traefik)
- [ ] Configure firewall to block direct access to port 5432
- [ ] Set up regular database backups
- [ ] Monitor container health with `docker compose ps`
