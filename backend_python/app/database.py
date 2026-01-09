from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import ssl
import os
from pathlib import Path
from dotenv import load_dotenv

# 1. Load .env from Root Directory (HSUS-Order-Status-GCP/.env)
# Path: backend_python/app/database.py -> backend_python/ -> Root
BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_ENV = BASE_DIR.parent / ".env"
load_dotenv(ROOT_ENV)

# 2. Get and Clean DATABASE_URL
DATABASE_URL = os.getenv("DATABASE_URL", "")

if DATABASE_URL:
    # Switch driver to asyncpg
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    
    # Remove sslmode=require (conflicts with explicit ssl_context below)
    # Handle both query param ?sslmode=require and appended &sslmode=require
    DATABASE_URL = DATABASE_URL.replace("?sslmode=require", "")
    DATABASE_URL = DATABASE_URL.replace("&sslmode=require", "")

print(f"Connecting to DB (Driver Configured): {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'UNKNOWN'}")

# 3. Explicit SSL Context for Supabase
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    connect_args={"ssl": ssl_context}
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
