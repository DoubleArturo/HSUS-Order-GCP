"""
migrate_to_normalized.py
========================
ETL Script: Migrates data from flat `bol_db` table to normalized `orders` and `shipments` tables.
Run from backend_python directory: ./venv/bin/python scripts/migrate_to_normalized.py
"""

import sys
import os
from pathlib import Path

# ============================================================
# STEP 0: LOAD ENVIRONMENT BEFORE ANYTHING ELSE
# ============================================================

# backend_python/scripts/migrate_to_normalized.py
# -> scripts/ -> backend_python/ -> Root (where .env lives)
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
ROOT_DIR = BACKEND_DIR.parent

# Add backend_python to path so we can import 'app'
sys.path.insert(0, str(BACKEND_DIR))

# Force load .env from project root
from dotenv import load_dotenv
ROOT_ENV = ROOT_DIR / ".env"
print(f"🔧 Loading .env from: {ROOT_ENV}")

if not ROOT_ENV.exists():
    print(f"❌ ERROR: .env file not found at {ROOT_ENV}")
    sys.exit(1)

load_dotenv(ROOT_ENV, override=True)  # override=True ensures it takes precedence

# Verify critical variables are loaded
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL not found in environment variables!")
    print("   Please check your .env file contains DATABASE_URL=postgresql://...")
    sys.exit(1)

# Debug: Print masked connection string
def mask_password(url: str) -> str:
    """Safely mask the password in a connection string."""
    if '@' not in url:
        return url
    # Format: protocol://user:password@host:port/db
    parts = url.split('@')
    credentials = parts[0]  # protocol://user:password
    host_part = parts[1]    # host:port/db
    
    if ':' in credentials:
        # Find last colon (password separator)
        last_colon = credentials.rfind(':')
        protocol_user = credentials[:last_colon]
        return f"{protocol_user}:******@{host_part}"
    return url

print(f"🔗 DATABASE_URL (masked): {mask_password(DATABASE_URL)}")

# ============================================================
# NOW IMPORT DATABASE MODULE (after .env is loaded)
# ============================================================

import asyncio
import json
import re
from datetime import datetime
from typing import Optional

from sqlalchemy import text
from app.database import engine

# ============================================================
# HELPER FUNCTIONS: Data Cleaning
# ============================================================

def clean_money_int(value) -> int:
    """
    Cleans a money string like "$1,200" or "1,500.00" and returns an integer.
    Returns 0 if parsing fails.
    """
    if value is None:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    
    try:
        # Remove $, commas, and whitespace
        cleaned = str(value).replace('$', '').replace(',', '').strip()
        # Handle potential decimal values
        return int(float(cleaned))
    except (ValueError, TypeError):
        return 0


def parse_flexible_date(value) -> Optional[datetime]:
    """
    Attempts to parse various date formats commonly found in messy data.
    Supported formats:
    - YYYY-MM-DD, YYYY/MM/DD
    - MM/DD/YYYY, MM-DD-YYYY
    - DD/MM/YYYY (European, less common)
    - With or without time, including AM/PM
    
    Returns None if parsing fails.
    """
    if value is None:
        return None
    
    date_str = str(value).strip()
    if not date_str:
        return None
    
    # List of common formats to try
    formats = [
        # ISO formats
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        
        # US formats (MM/DD/YYYY)
        "%m/%d/%Y",
        "%m-%d-%Y",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %I:%M:%S %p",  # With AM/PM
        "%m/%d/%Y %I:%M %p",
        
        # European formats (DD/MM/YYYY) - tried last as fallback
        "%d/%m/%Y",
        "%d-%m-%Y",
        
        # Other common formats
        "%Y%m%d",
        "%B %d, %Y",  # e.g., "January 15, 2026"
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    
    # Last resort: try to extract date-like patterns
    # Pattern: anything that looks like YYYY-MM-DD or MM/DD/YYYY
    iso_pattern = re.search(r'(\d{4}[-/]\d{1,2}[-/]\d{1,2})', date_str)
    if iso_pattern:
        try:
            return datetime.strptime(iso_pattern.group(1).replace('/', '-'), "%Y-%m-%d")
        except ValueError:
            pass
    
    us_pattern = re.search(r'(\d{1,2}[-/]\d{1,2}[-/]\d{4})', date_str)
    if us_pattern:
        try:
            return datetime.strptime(us_pattern.group(1).replace('-', '/'), "%m/%d/%Y")
        except ValueError:
            pass
    
    print(f"  ⚠️  WARNING: Could not parse date '{date_str}'")
    return None


# ============================================================
# MAIN MIGRATION LOGIC
# ============================================================

async def migrate_data():
    """
    Main ETL pipeline:
    1. Extract all records from bol_db
    2. Transform (clean) the data
    3. Load into orders and shipments tables
    """
    print("\n" + "=" * 60)
    print("🚀 Starting Migration: bol_db → orders + shipments")
    print("=" * 60 + "\n")
    
    async with engine.begin() as conn:
        # ========================================
        # STEP 1: EXTRACT
        # ========================================
        print("[1/3] Extracting data from bol_db...")
        result = await conn.execute(text("SELECT * FROM bol_db"))
        rows = result.mappings().all()
        total = len(rows)
        print(f"      Found {total} records.\n")
        
        if total == 0:
            print("❌ No data found in bol_db. Exiting.")
            return
        
        # ========================================
        # STEP 2 & 3: TRANSFORM + LOAD
        # ========================================
        print("[2/3] Processing and migrating records...")
        
        orders_created = 0
        orders_updated = 0
        shipments_created = 0
        shipments_skipped = 0
        
        for idx, row in enumerate(rows, start=1):
            # Progress indicator
            if idx % 50 == 0 or idx == total:
                print(f"      Processing {idx}/{total}...")
            
            # --- Extract raw values ---
            po_sku_key = row.get('po_sku_key') or row.get('poSkuKey')
            bol_number = row.get('bol_number') or row.get('bolNumber')
            raw_qty = row.get('shipped_qty') or row.get('shippedQty')
            raw_date = row.get('act_ship_date') or row.get('actShipDate')
            status = row.get('status', 'Fulfilled')
            
            if not po_sku_key:
                print(f"  ⚠️  Row {idx}: Missing po_sku_key, skipping entirely.")
                continue
            
            # --- Transform ---
            cleaned_qty = clean_money_int(raw_qty)
            parsed_date = parse_flexible_date(raw_date)
            
            # --- Load: Step A - Upsert Order ---
            # Use ON CONFLICT to handle duplicates
            upsert_order_sql = text("""
                INSERT INTO orders (order_number, source, status, items)
                VALUES (:order_number, 'DEALER', 'SHIPPED', :items)
                ON CONFLICT (order_number) DO UPDATE SET 
                    updated_at = NOW()
                RETURNING id, (xmax = 0) AS inserted
            """)
            
            items_json = json.dumps([{"sku": po_sku_key, "original_qty": cleaned_qty}])
            
            order_result = await conn.execute(upsert_order_sql, {
                "order_number": po_sku_key,
                "items": items_json
            })
            order_row = order_result.fetchone()
            order_id = order_row.id
            was_inserted = order_row.inserted
            
            if was_inserted:
                orders_created += 1
            else:
                orders_updated += 1
            
            # --- Load: Step B - Insert Shipment (if valid) ---
            if parsed_date and cleaned_qty > 0:
                # Check if shipment with same tracking number already exists for this order
                # to avoid duplicates on re-runs
                check_sql = text("""
                    SELECT 1 FROM shipments 
                    WHERE order_id = :order_id AND tracking_number = :tracking
                    LIMIT 1
                """)
                existing = await conn.execute(check_sql, {
                    "order_id": order_id,
                    "tracking": bol_number or ''
                })
                
                if existing.fetchone() is None:
                    insert_shipment_sql = text("""
                        INSERT INTO shipments (order_id, tracking_number, shipped_at, items)
                        VALUES (:order_id, :tracking, :shipped_at, :items)
                    """)
                    
                    shipment_items = json.dumps({"qty": cleaned_qty})
                    
                    await conn.execute(insert_shipment_sql, {
                        "order_id": order_id,
                        "tracking": bol_number or '',
                        "shipped_at": parsed_date,
                        "items": shipment_items
                    })
                    shipments_created += 1
                else:
                    shipments_skipped += 1  # Already exists
            else:
                shipments_skipped += 1
                if not parsed_date:
                    pass  # Warning already printed by parse_flexible_date
        
        print("\n[3/3] Migration Complete!")
        print("-" * 40)
        print(f"   📦 Orders Created:   {orders_created}")
        print(f"   🔄 Orders Updated:   {orders_updated}")
        print(f"   🚚 Shipments Created: {shipments_created}")
        print(f"   ⏭️  Shipments Skipped: {shipments_skipped}")
        print("-" * 40)
        print("✅ All changes committed.\n")


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    print("\n📋 Migration Script: bol_db → Normalized Tables")
    print("   Uses async SQLAlchemy + asyncpg")
    print("   Target: orders, shipments (per bol_entry.sql)\n")
    
    asyncio.run(migrate_data())
