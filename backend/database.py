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


async def init_db() -> None:
    """Create tables if they don't exist. For real migrations use Alembic; this is
    the bootstrap path so a fresh Postgres comes up ready."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("PostgreSQL schema ensured (create_all)")
