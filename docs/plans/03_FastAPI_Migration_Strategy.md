# FastAPI Migration Strategy Report 🐍

**Objective**: Migrate HSUS Order Status Backend from Node.js (TypeScript) to Python (FastAPI) to leverage `AsyncPG` performance and standard Python data science ecosystems if needed later.

## 1. Architecture Mapping

We will map the existing 3-Layer Architecture (Controller-Service-Repository) to FastAPI's equivalent patterns.

| Layer | Node.js Component | FastAPI Equivalent | Responsibility |
| :--- | :--- | :--- | :--- |
| **HTTP** | `src/controllers/bolController.ts` | **Routers** (`app/routers/bol.py`) | Handle Requests, Validate Input (Pydantic), Return JSON. |
| **Logic** | `src/services/BolService.ts` | **Services** (`app/services/bol_service.py`) | Business Logic, Orchestration. |
| **Data** | `src/repositories/` | **CRUD** (`app/crud/`) | Database interactions (SQLAlchemy Core / AsyncPG). |

### Example Transformation: BolController

**Current Node.js (`src/controllers/bolController.ts`):**
```typescript
export const getExistingData = async (req, res, next) => {
  try {
    const { poSkuKey } = req.params;
    const data = await BolService.getExistingBolData(poSkuKey);
    ok(res, data);
  } catch (err) { next(err); }
};
```

**Target FastAPI (`app/routers/bol.py`):**
```python
from fastapi import APIRouter, Depends, HTTPException
from app.services.bol_service import BolService
from app.dependencies import get_db

router = APIRouter(prefix="/api/bol", tags=["BOL"])

@router.get("/{po_sku_key}")
async def get_existing_data(
    po_sku_key: str, 
    db = Depends(get_db)  # Dependency Injection
):
    result = await BolService.get_existing_bol_data(db, po_sku_key)
    if not result:
        raise HTTPException(status_code=404, detail="Order not found")
    return result
```

## 2. Database Upgrade: AsyncPG + SQLAlchemy

We will move from `pg` (Node) to `asyncpg` (Python), known for being the fastest PostgreSQL driver for Python.

### Technologies
*   **Driver**: `asyncpg` (Asynchronous PostgreSQL driver)
*   **ORM/Core**: `SQLAlchemy 2.0` (Async support)
*   **Validation**: `Pydantic V2` (Schema validation)

### Database Connection Template (`app/database.py`)

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

# Use postgresql+asyncpg:// scheme
DATABASE_URL = os.getenv("DATABASE_URL").replace("postgresql://", "postgresql+asyncpg://")

# Supabase Optimization: 
# pool_pre_ping=True helps detect dropped connections
# pool_size=20 handles concurrency
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

# Dependency for Routes
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

## 3. Dependency Injection (The `Depends` Power)

In Node.js `BolService`, we manually handled pool clients:
```typescript
const client = await pool.connect();
try { await client.query('BEGIN'); ... } finally { client.release(); }
```

In FastAPI/SQLAlchemy, `Depends(get_db)` handles the session lifecycle automatically.

*   **Request Scope**: A DB session is created when a request starts and closed when it ends.
*   **Transaction Management**: Services will receive `session: AsyncSession`.
    *   Explicit commits: `await session.commit()`
    *   Rollback on error is verified in the Exception Handler.

## 4. Deployment Changes (Cloud Run)

We switch runtime from Node.js to Python 3.11-slim.

### Target Dockerfile

```dockerfile
# Use official lightweight Python image
FROM python:3.11-slim

# Prevent Python from buffering stdout/stderr (Log visualization)
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

WORKDIR /app

# Install system dependencies (build-essential for some python libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy App Code
COPY . .

# Start Uvicorn Server
# --host 0.0.0.0 is crucial for Cloud Run
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
```

## 5. Next Steps
1.  Initialize FastAPI project structure (`app/main.py`, `app/routers/`, `app/crud/`).
2.  Install dependencies (`fastapi`, `uvicorn`, `sqlalchemy`, `asyncpg`, `pydantic-settings`).
3.  Migrate `BolService` logic to Python.
