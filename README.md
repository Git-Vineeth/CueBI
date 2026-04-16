# CueBI

**Cuemath's AI-powered Business Intelligence Platform**

Ask questions about your data in plain English — CueBI generates SQL, executes it, and returns charts, tables, and AI summaries. No SQL knowledge required.

---

## What is CueBI?

CueBI is an internal GenBI (Generative BI) platform built for Cuemath. Connect your database, ask questions in English, and get instant insights — with department-wise access control so each team only sees their own data.

| Feature | Description |
|---------|-------------|
| **Natural Language → SQL** | Ask questions in English. SQL is generated, validated, and executed automatically |
| **Auto Charts** | Line, bar, pie, horizontal bar — auto-detected from your data shape |
| **AI Summaries** | Every result comes with a plain English insight |
| **Google SSO** | Sign in with your @cuemath.com Google Workspace account |
| **Invite-First Access** | Admin pre-provisions users by email — no self-signup |
| **Per-Team Data Access** | Finance sees finance tables only; Marketing sees marketing tables only |
| **Team-Scoped History** | Queries, dashboards, and pinned charts are private to each team |
| **Admin Panel** | Manage teams, members, schema access, and example questions at `/admin` |
| **AWS Native** | Connect Amazon Redshift, RDS PostgreSQL, and RDS MySQL out of the box |
| **PostgreSQL + MySQL** | Direct connectors with schema extraction, sample values, FK detection |
| **Multi-LLM** | Choose OpenAI GPT-4o or Anthropic Claude |
| **Pin to Dashboard** | Pin any query result as a dashboard card with one-click refresh |
| **Scheduled Reports** | Run queries on a cron schedule, email results as CSV |
| **Alerts** | Monitor metrics against thresholds — get notified when a KPI drops |
| **SQL Explainer** | "Explain this SQL" — breaks down queries for non-technical stakeholders |
| **Schema Explorer** | Browse tables and columns with search |
| **Query History** | All past questions saved with timing and results |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Next.js UI  │────▶│  FastAPI API  │────▶│  Your DB    │
│  (Port 3000) │     │  (Port 8000) │     │  (Redshift/ │
└─────────────┘     └──────┬───────┘     │   RDS/PG)   │
                           │             └─────────────┘
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ OpenAI / │ │  Qdrant  │ │PostgreSQL│
        │ Anthropic│ │ (Vectors)│ │ (App DB) │
        └──────────┘ └──────────┘ └──────────┘
```

## Auth Flow

```
Admin provisions user (email + team) via /admin panel
→ User opens CueBI → clicks "Sign in with Google"
→ NextAuth Google OAuth → FastAPI checks email in users table
→ Not provisioned → blocked with error message
→ Provisioned → CueBI JWT issued (user_id, team_id, role)
→ All API calls authenticated via Bearer token
→ Qdrant search filtered to team's allowed tables only
```

## Supported Data Sources

| Connector | Default Port | Notes |
|-----------|-------------|-------|
| PostgreSQL | 5432 | Direct connection |
| MySQL | 3306 | Direct connection |
| Amazon Redshift | 5439 | SSL by default |
| AWS RDS (PostgreSQL) | 5432 | Same connector as PostgreSQL |
| AWS RDS (MySQL) | 3306 | Same connector as MySQL |

## Local Development

**Prerequisites:** Docker, Docker Compose

```bash
git clone https://github.com/Git-Vineeth/CueBI
cd cuebi
cp .env.example .env
# Edit .env — add your API keys and Google OAuth credentials
docker-compose up --build
```

App runs at:
- Frontend: http://localhost:3000
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

**Local dev without Google OAuth:** Set `ENVIRONMENT=development` in `.env`. The API will fall back to a dev seed user (`dev@cuemath.com`) when no Bearer token is provided — no Google credentials needed.

## Running Tests

```bash
PYTHONPATH=. python3 -m pytest tests/ -m "not integration" -v
```

## Project Structure

```
cuebi/
├── apps/
│   ├── api/               # FastAPI backend
│   │   ├── routes/        # API endpoints
│   │   │   ├── auth.py    # Google login, JWT issuance
│   │   │   ├── admin.py   # Team/user/schema management
│   │   │   └── ...
│   │   ├── deps.py        # Auth dependencies (get_current_user, require_admin)
│   │   └── services/      # Business logic
│   └── web/               # Next.js frontend
│       ├── app/           # Pages (App Router)
│       │   ├── admin/     # Admin panel
│       │   └── ...
│       ├── auth.config.ts # NextAuth options (Google provider)
│       ├── middleware.ts  # Route protection
│       ├── components/    # Shared UI components
│       └── lib/           # API client, state store
├── packages/
│   ├── connectors/        # Database connectors (PG, MySQL, Redshift)
│   ├── core/              # Chunker, embedder, prompt builder, SQL validator
│   ├── charts/            # Chart type recommender
│   ├── llm/               # LLM providers (OpenAI, Anthropic)
│   └── email/             # Email notifications
├── docker/
│   └── postgres/          # DB init + migrations
└── tests/                 # Test suite
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes* | OpenAI API key (*or Anthropic) |
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key (*or OpenAI) |
| `DATABASE_URL` | Yes | App PostgreSQL (async) |
| `SYNC_DATABASE_URL` | Yes | App PostgreSQL (sync) |
| `QDRANT_URL` | Yes | Qdrant vector DB URL |
| `REDIS_URL` | Yes | Redis URL for Celery |
| `CUEBI_JWT_SECRET` | Yes | Secret for signing CueBI JWTs |
| `ALLOWED_EMAIL_DOMAIN` | Yes | Restrict login to this domain (e.g. `cuemath.com`) |
| `ENVIRONMENT` | No | Set to `development` to bypass auth locally |
| `NEXTAUTH_SECRET` | Yes | NextAuth session encryption secret |
| `NEXTAUTH_URL` | Yes | Public URL of the frontend (e.g. `http://localhost:3000`) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `FRONTEND_URL` | No | Frontend URL for CORS |
| `SENDGRID_API_KEY` | No | For scheduled report emails |

---

© 2026 Cuemath. Internal use only.
