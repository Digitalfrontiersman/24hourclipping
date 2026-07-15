"""Async PostgreSQL engine + session factory.

DATABASE_URL uses the asyncpg driver, e.g.
    postgresql+asyncpg://user:pass@host:5432/dbname
"""
import os
import logging

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from models import Base

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://clipping:clipping@localhost:5432/clipping",
)

engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,     # drop dead connections instead of erroring
    future=True,
)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncSession:
    """FastAPI dependency: a session per request, committed/rolled back by the caller."""
    async with SessionLocal() as session:
        yield session


# Lightweight, idempotent column additions for existing tables. `create_all` only
# creates missing TABLES, not new columns, so additive columns land here until we
# adopt Alembic. Each is safe to re-run (ADD COLUMN IF NOT EXISTS).
from sqlalchemy import text as _sql_text

_COLUMN_MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_email TEXT",
    # Default true grandfathers all existing rows + Google users; new local
    # signups are set false in code until they verify their email.
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE projects ADD COLUMN IF NOT EXISTS official BOOLEAN NOT NULL DEFAULT false",
]


async def init_db() -> None:
    """Create tables if they don't exist, then apply additive column migrations.
    For richer migrations use Alembic; this is the bootstrap path so a fresh (or
    lightly-evolving) Postgres comes up ready."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for stmt in _COLUMN_MIGRATIONS:
            await conn.execute(_sql_text(stmt))
    logger.info("PostgreSQL schema ensured (create_all + %d column migrations)", len(_COLUMN_MIGRATIONS))
