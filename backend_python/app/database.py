import os
import ssl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv

# 1. 確保載入環境變數
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL is not set in .env file")

# 2. 自動修正 URL Scheme (防止使用者忘記加 +asyncpg)
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

print(f"🔌 Connecting to DB: {DATABASE_URL.split('@')[1]}") # 只印出 Host 確保安全

# 3. 建立 SSL Context (針對 Supabase)
# Supabase 需要 SSL，但通常不需要驗證客戶端憑證 (allow encryption, skip verification for pooler)
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# 4. 建立 Engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={
        "ssl": ssl_context,
        "statement_cache_size": 0,  # Required for PgBouncer Transaction Mode
        "prepared_statement_cache_size": 0  # Belt and suspenders
    }  # 關鍵：將 SSL 注入底層 asyncpg
)

SessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

# Dependency
async def get_db():
    async with SessionLocal() as session:
        yield session