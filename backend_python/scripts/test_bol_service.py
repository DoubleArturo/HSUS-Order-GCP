import asyncio
import sys
import os

# Ensure we can import 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_db
from app.services.bol_service import BolService
from app.schemas.bol import BolSaveRequest, BolItem

async def run_tests():
    print("\n🚀 Starting Python Migration Tests (mimicking 01_Test_BolService.ts)...\n")
    
    # Manually get a session since we are not in FastAPI context
    async for db in get_db():
        
        # === TEST 1: getInitialBolData ===
        print("=== TEST 1: getInitialBolData ===")
        try:
            initial_data = await BolService.get_initial_bol_data(db)
            print(f"✅ Success. Result: {initial_data['success']}")
            # print(initial_data) # Verbose
        except Exception as e:
            print(f"❌ Test 1 Failed: {e}")

        # === TEST 3: saveBolData ===
        print("\n=== TEST 3: saveBolData (Transaction) ===")
        test_key = "PO-TEST-001" 
        # Note: Must align with existing data in DB or insert it first ideally.
        # Assuming PO-TEST-001 exists from previous Node.js tests
        
        payload = BolSaveRequest(
            poSkuKey=test_key,
            actShipDate="2026-01-09",
            isFulfilled=True,
            bols=[
                BolItem(bolNumber="PY-TRACK-999", shippedQty=10, signed=False, shippingFee=0)
            ]
        )
        
        try:
            result = await BolService.save_bol_data(db, payload)
            print(f"✅ Save Result: {result}")
            
            # === TEST 2: getExistingBolData (Verify) ===
            print("\n=== TEST 2: getExistingBolData (Verify) ===")
            verify = await BolService.get_existing_bol_data(db, test_key)
            
            if verify['success'] and verify['bols']:
                found = any(b['bolNumber'] == "PY-TRACK-999" for b in verify['bols'])
                if found:
                    print(f"🎉 Verified! Found inserted record: PY-TRACK-999")
                else:
                    print(f"❌ Verification Failed: Record not found. Data: {verify}")
            else:
                print(f"❌ Verification Failed: {verify}")
                
        except Exception as e:
            print(f"❌ Test 3 Failed: {e}")
            
        break # One session usage

if __name__ == "__main__":
    asyncio.run(run_tests())
