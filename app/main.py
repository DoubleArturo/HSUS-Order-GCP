from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import bol
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="HSUS Order Status API",
    version="0.2.0 (FastAPI)",
    description="Migrated backend for HSUS Order System"
)

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(bol.router)

@app.get("/health")
async def health_check():
    return {"status": "ok", "runtime": "python-fastapi"}

@app.on_event("startup")
async def startup_event():
    logger.info("Application Startup: Connecting to Database...")
    # Optional: Test DB connection here
    try:
        from app.database import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("✅ Database connected successfully (AsyncPG)")
    except Exception as e:
        logger.error(f"❌ Database connection failed: {e}")
