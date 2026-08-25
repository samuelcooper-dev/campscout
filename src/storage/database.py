import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

_url = os.environ["DATABASE_URL"]
# SQLAlchemy's psycopg3 driver requires the postgresql+psycopg:// scheme.
if _url.startswith("postgresql://"):
    _url = _url.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(
    _url,
    pool_pre_ping=True,
    pool_size=3,              # Reduce from default 5 (Neon free tier has limited connections)
    max_overflow=2,           # Reduce from default 10
    pool_recycle=3600,        # Recycle connections after 1 hour (avoid stale connections)
    pool_timeout=30,          # Fail fast if no connection available
    echo_pool=False,          # Disable connection pool logging for less overhead
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass
