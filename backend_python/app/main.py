from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello from Python Cloud Run!"}

@app.get("/test-db")
async def test_db(db: AsyncSession = Depends(get_db)):
    try:
        # 執行查詢
        result = await db.execute(text("SELECT version();"))
        version = result.scalar()
        return {
            "status": "success", 
            "message": "✅ Database Connected Successfully!",
            "version": version
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}
