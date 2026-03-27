from __future__ import annotations

"""BharatBI API — main FastAPI application."""
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.api.routes import health, connections, query, schema, tally


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown events."""
    print("🇮🇳 BharatBI API starting...")
    yield
    print("BharatBI API shutting down.")


app = FastAPI(
    title="BharatBI API",
    description="India's First Open-Source GenBI System",
    version="0.1.0",
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
app.include_router(tally.router, prefix="/api/tally", tags=["Tally"])