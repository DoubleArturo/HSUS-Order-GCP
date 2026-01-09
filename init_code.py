import os

# 定義要建立的檔案與內容
files = {
    "app/schemas/bol.py": """
from pydantic import BaseModel
from typing import List, Optional, Any

# 基礎資料結構 (對應 CSV 欄位)
class BolItem(BaseModel):
    bol_number: str
    po_sku_key: str
    shipped_qty: int
    status: Optional[str] = "Fulfilled"

# API 回傳的完整結構 (包含 ID 和日期)
class BolResponse(BolItem):
    id: int
    act_ship_date: Optional[str] = None

    class Config:
        from_attributes = True # 讓 Pydantic 支援讀取 SQLAlchemy 物件

# saveBolData 的輸入結構 (對應 TS 的 savePayload)
class BolSaveRequest(BaseModel):
    poSkuKey: str
    actShipDate: str
    isFulfilled: bool
    # 對應 TS: bols: [{ bolNumber: '...', shippedQty: '...' }]
    bols: List[dict]
""",

    "app/services/bol_service.py": """
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.schemas.bol import BolResponse, BolSaveRequest

class BolService:
    
    @staticmethod
    async def get_initial_bol_data(db: AsyncSession, limit: int = 100):
        query = text('SELECT * FROM bol_db ORDER BY created_at DESC LIMIT :limit')
        result = await db.execute(query, {"limit": limit})
        rows = result.mappings().all()
        return [BolResponse(**row) for row in rows]

    @staticmethod
    async def get_existing_bol_data(db: AsyncSession, po_sku_key: str):
        query = text('SELECT * FROM bol_db WHERE po_sku_key = :key')
        result = await db.execute(query, {"key": po_sku_key})
        rows = result.mappings().all()
        return [BolResponse(**row) for row in rows]

    @staticmethod
    async def save_bol_data(db: AsyncSession, payload: BolSaveRequest):
        try:
            for bol in payload.bols:
                # 簡單的防呆：處理數量可能是字串的問題
                qty = bol.get("shippedQty", 0)
                if isinstance(qty, str):
                    clean_qty = qty.replace(',', '').replace('$', '').strip()
                    try:
                        qty = int(float(clean_qty))
                    except:
                        qty = 0

                insert_query = text(\"\"\"
                    INSERT INTO bol_db (bol_number, po_sku_key, shipped_qty, status, act_ship_date)
                    VALUES (:bol_number, :po_sku_key, :shipped_qty, :status, :act_ship_date)
                \"\"\")
                
                await db.execute(insert_query, {
                    "bol_number": bol.get("bolNumber"),
                    "po_sku_key": payload.poSkuKey,
                    "shipped_qty": qty,
                    "status": "Fulfilled" if payload.isFulfilled else "Pending",
                    "act_ship_date": payload.actShipDate
                })
            
            await db.commit()
            return {"success": True, "message": "Data saved successfully"}
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Transaction Failed: {e}")
            return {"success": False, "error": str(e)}
""",

    "scripts/test_bol_service.py": """
import asyncio
import sys
import os

# 路徑修正：讓腳本能找到 app 模組
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db
from app.services.bol_service import BolService
from app.schemas.bol import BolSaveRequest

async def run_tests():
    print("\\n🚀 Starting Python Migration Tests (mimicking 01_Test_BolService.ts)...\\n")
    
    async for db in get_db():
        
        # === TEST 1: getInitialBolData ===
        print("=== TEST 1: getInitialBolData ===")
        try:
            initial_data = await BolService.get_initial_bol_data(db, limit=5)
            print(f"✅ Success. Retrieved {len(initial_data)} records.")
            if initial_data:
                print(f"   Sample: {initial_data[0].bol_number} - {initial_data[0].status}")
        except Exception as e:
            print(f"❌ Test 1 Failed: {e}")

        # === TEST 3: saveBolData ===
        print("\\n=== TEST 3: saveBolData (Transaction) ===")
        test_key = "PO-TEST-PYTHON-001" 
        payload = BolSaveRequest(
            poSkuKey=test_key,
            actShipDate="2026-01-09",
            isFulfilled=True,
            bols=[
                {"bolNumber": "PY-TRACK-999", "shippedQty": "10"}
            ]
        )
        
        try:
            result = await BolService.save_bol_data(db, payload)
            print(f"✅ Save Result: {result}")
            
            # === TEST 2: getExistingBolData (Verify) ===
            print("\\n=== TEST 2: getExistingBolData (Verify) ===")
            verify = await BolService.get_existing_bol_data(db, test_key)
            if verify:
                print(f"🎉 Verified! Found inserted record: {verify[0].bol_number}")
            else:
                print("❌ Verification Failed: Record not found.")
                
        except Exception as e:
            print(f"❌ Test 3 Failed: {e}")
            
        break

if __name__ == "__main__":
    asyncio.run(run_tests())
"""
}

def create_files():
    for filepath, content in files.items():
        # 確保資料夾存在
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        # 寫入檔案
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content.strip())
        print(f"✅ Created: {filepath}")

if __name__ == "__main__":
    create_files()
