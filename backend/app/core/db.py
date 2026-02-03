from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool
from sqlalchemy import text

from app.core.config import settings

# Connection pooling configuration for free tier
connect_args = {
    "check_same_thread": False,
    "timeout": 30  # 30 second timeout for queries
}

if settings.DATABASE_URI.startswith("sqlite"):
    # Use StaticPool for SQLite to share single connection
    engine = create_engine(
        settings.DATABASE_URI, 
        connect_args=connect_args,
        poolclass=StaticPool,
        echo=False  # Disable SQL logging for performance
    )
else:
    # For PostgreSQL (future upgrade)
    engine = create_engine(
        settings.DATABASE_URI,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True
    )

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    
    # Enable WAL mode for SQLite (better concurrency)
    if settings.DATABASE_URI.startswith("sqlite"):
        with engine.connect() as conn:
            conn.execute(text("PRAGMA journal_mode=WAL"))
            conn.execute(text("PRAGMA synchronous=NORMAL"))
            conn.execute(text("PRAGMA cache_size=-64000"))  # 64MB cache
            conn.execute(text("PRAGMA temp_store=MEMORY"))
            conn.commit()

def get_session():
    with Session(engine) as session:
        yield session
