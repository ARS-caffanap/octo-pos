# OctoPOS

Point-of-Sale SaaS with multi-tenant architecture.

## Tech Stack

- **Backend**: Go 1.21+ with Gin framework
- **Database**: PostgreSQL 15+ (Docker)
- **Frontend**: Next.js 14 (npm workspace, see OCT-10)

## Project Structure

```
octo-pos/
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go          # Entry point
│   ├── internal/
│   │   ├── config/              # Environment configuration
│   │   ├── handlers/            # HTTP handlers
│   │   └── server/              # Gin engine setup
│   ├── pkg/                     # Public libraries (future)
│   ├── migrations/              # SQL migrations (OCT-19)
│   ├── go.mod
│   └── go.sum
├── frontend/                    # Next.js app (OCT-10)
├── docker-compose.yml           # PostgreSQL container
├── package.json                 # npm workspaces root
└── README.md
```

## Quick Start

### Prerequisites

- Go 1.21+
- Node.js 18+
- Docker & Docker Compose

### 1. Start PostgreSQL

```bash
docker compose up -d
```

### 2. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your settings if needed
```

### 3. Run the Backend

```bash
cd backend
go run cmd/server/main.go
```

The API server starts on `http://localhost:8080`.

### 4. Health Check

```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

## Environment Variables

See `backend/.env.example` for all available configuration options.

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Server bind address |
| `PORT` | `8080` | Server port |
| `ENVIRONMENT` | `development` | `development` or `production` |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `octopos` | Database user |
| `DB_PASSWORD` | `octopos` | Database password |
| `DB_NAME` | `octopos` | Database name |
| `DB_SSLMODE` | `disable` | PostgreSQL SSL mode |
| `JWT_SECRET` | `change-me-in-production` | JWT signing secret |
