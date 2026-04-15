from __future__ import annotations

"""
CueBI — Database connection
Uses asyncpg + SQLAlchemy async engine.
"""



"""Async database connection for CueBI's internal PostgreSQL."""
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://cuebi:cuebi_dev@localhost:5432/cuebi")

engine = create_async_engine(DATABASE_URL, echo=False, pool_size=5, max_overflow=10)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields an async DB session."""
    async with async_session() as session:
        yield session