from __future__ import annotations

"""CueBI API — main FastAPI application."""
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.api.routes import health, connections, query, schema, dashboard
from apps.api.api.routes import reports, explain, teams


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    print("CueBI API starting...")
    yield
    print("CueBI API shutting down.")


app = FastAPI(
    title="CueBI API",
    description="Cuemath's AI-powered Business Intelligence Platform",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS — allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routes
app.include_router(health.router, tags=["Health"])
app.include_router(connections.router, prefix="/api/connections", tags=["Connections"])
app.include_router(query.router, prefix="/api", tags=["Query"])
app.include_router(schema.router, prefix="/api/schema", tags=["Schema"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(reports.router, prefix="/api/reports", tags=["Scheduled Reports & Alerts"])
app.include_router(explain.router, prefix="/api", tags=["SQL Explain"])
app.include_router(teams.router, prefix="/api/teams", tags=["Teams"])
