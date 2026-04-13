# CueBI

**Cuemath's AI-powered Business Intelligence Platform**

Ask questions about your data in plain English — CueBI generates SQL, executes it, and returns charts, tables, and AI summaries. No SQL knowledge required.

---

## What is CueBI?

CueBI is an internal GenBI (Generative BI) platform built for Cuemath's data and analytics teams. Connect your database, ask questions in English, and get instant insights.

| Feature | Description |
|---------|-------------|
| **Natural Language → SQL** | Ask questions in English. SQL is generated, validated, and executed automatically |
| **Auto Charts** | Line, bar, pie, horizontal bar — auto-detected from your data shape |
| **AI Summaries** | Every result comes with a plain English insight |
| **AWS Native** | Connect Amazon Redshift, RDS PostgreSQL, and RDS MySQL out of the box |
| **PostgreSQL + MySQL** | Direct connectors with schema extraction, sample values, FK detection |
| **Multi-LLM** | Choose OpenAI GPT-4o or Anthropic Claude |
| **Pin to Dashboard** | Pin any query result as a dashboard card with one-click refresh |
| **Scheduled Reports** | Run queries on a cron schedule, email results as CSV |
| **Alerts** | Monitor metrics against thresholds — get notified when a KPI drops |
| **Multi-User Teams** | Invite team members with role-based access (Admin / Analyst / Viewer) |
| **SQL Explainer** | "Explain this SQL" — breaks down queries for non-technical stakeholders |
| **Schema Explorer** | Browse tables and columns with search |
| **Query History** | All past questions saved with timing and results |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Next.js UI  │────▶│  FastAPI API  │────▶│  Your DB    │
│  (Vercel)    │     │  (Railway)   │     │  (Redshift/ │
└─────────────┘     └──────┬───────┘     │   RDS/PG)   │
                           │             └─────────────┘
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ OpenAI / │ │  Qdrant  │ │PostgreSQL│
        │ Anthropic│ │ (Vectors)│ │ (App DB) │
        └──────────┘ └──────────┘ └──────────┘
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
git clone <internal-repo-url>
cd cuebi
cp .env.example .env
# Edit .env — add OPENAI_API_KEY or ANTHROPIC_API_KEY
docker-compose up --build
```

App runs at:
- Frontend: http://localhost:3000
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

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
│   │   └── services/      # Business logic
│   └── web/               # Next.js frontend
│       ├── app/           # Pages (App Router)
│       ├── components/    # Shared UI components
│       └── lib/           # API client, state store
├── packages/
│   ├── connectors/        # Database connectors (PG, MySQL, Redshift)
│   ├── core/              # Chunker, embedder, prompt builder, SQL validator
│   ├── charts/            # Chart type recommender
│   ├── llm/               # LLM providers (OpenAI, Anthropic)
│   └── email/             # Email notifications
├── docker/                # Docker configs
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
| `FRONTEND_URL` | No | Frontend URL for CORS |
| `SENDGRID_API_KEY` | No | For scheduled report emails |

---

© 2026 Cuemath. Internal use only.
