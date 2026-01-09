"""
init_bol_db.py
==============
Initialization script: Creates `bol_db` table and loads data from CSV.
Run from backend_python directory: ./venv/bin/python scripts/init_bol_db.py
"""

import asyncio
import sys
import os
import csv
from pathlib import Path

# ============================================================
# STEP 0: LOAD ENVIRONMENT BEFORE ANYTHING ELSE
# ============================================================

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
ROOT_DIR = BACKEND_DIR.parent

sys.path.insert(0, str(BACKEND_DIR))

from dotenv import load_dotenv
ROOT_ENV = ROOT_DIR / ".env"
print(f"🔧 Loading .env from: {ROOT_ENV}")
load_dotenv(ROOT_ENV, override=True)

# ============================================================
# NOW IMPORT DATABASE MODULE
# ============================================================

from sqlalchemy import text
from app.database import engine

# ============================================================
# CSV TO TABLE COLUMN MAPPING
# ============================================================

# CSV headers (as they appear in file) -> DB column names
# ACTUAL HEADERS: ['BOL #', 'PO_SKU_Key', 'Shipped Qty', 'Shipping Fee', 'Act. Ship Date', 'Signed BOL', 'Status( Fulfilled )', 'TimeStamp']
COLUMN_MAPPING = {
    "BOL #": "bol_number",
    "PO_SKU_Key": "po_sku_key",
    "Shipped Qty": "shipped_qty",
    "Shipping Fee": "shipping_fee",
    "Act. Ship Date": "act_ship_date",
    "Signed BOL": "signed_bol",
    "Status( Fulfilled )": "status",
    "TimeStamp": "timestamp",
}

# All columns to create (all TEXT for dirty data tolerance)
DB_COLUMNS = list(COLUMN_MAPPING.values())

# ============================================================
# FIND CSV FILE
# ============================================================

def find_csv_file():
    """Search for the CSV file in common locations."""
    possible_names = [
        "New HSUS Order Status - BOL_DB.csv",
        "New HSUS Order Status - BOL_DB.csv.csv",  # Double extension case
        "BOL_DB.csv",
        "bol_db.csv",
    ]
    
    search_dirs = [
        ROOT_DIR,           # Project root
        BACKEND_DIR,        # backend_python/
        SCRIPT_DIR,         # scripts/
        Path.cwd(),         # Current working directory
    ]
    
    print("\n🔍 Searching for CSV file...")
    for search_dir in search_dirs:
        for name in possible_names:
            csv_path = search_dir / name
            if csv_path.exists():
                print(f"   ✅ Found: {csv_path}")
                return csv_path
            else:
                print(f"   ❌ Not found: {csv_path}")
    
    return None

# ============================================================
# CREATE TABLE DDL
# ============================================================

async def create_table(conn):
    """Drop and recreate bol_db table with all TEXT columns."""
    
    print("\n[1/3] Creating bol_db table...")
    
    # Drop existing table
    await conn.execute(text("DROP TABLE IF EXISTS bol_db CASCADE"))
    print("      Dropped existing table (if any)")
    
    # Create table with auto-increment ID and all TEXT columns
    columns_sql = ", ".join([f"{col} TEXT" for col in DB_COLUMNS])
    create_sql = f"""
        CREATE TABLE bol_db (
            id SERIAL PRIMARY KEY,
            {columns_sql},
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """
    
    await conn.execute(text(create_sql))
    print("      ✅ Table created successfully")

# ============================================================
# LOAD CSV DATA
# ============================================================

def read_csv_data(csv_path):
    """Read CSV and map headers to DB columns."""
    
    print(f"\n[2/3] Reading CSV: {csv_path.name}")
    
    records = []
    skipped = 0
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:  # utf-8-sig handles BOM
        reader = csv.DictReader(f)
        
        # Debug: Show actual headers found
        print(f"      CSV Headers: {reader.fieldnames}")
        
        for row_num, row in enumerate(reader, start=2):  # start=2 because row 1 is header
            try:
                # Map CSV columns to DB columns
                record = {}
                for csv_col, db_col in COLUMN_MAPPING.items():
                    value = row.get(csv_col, "")
                    # Clean up: strip whitespace, handle None
                    record[db_col] = str(value).strip() if value else ""
                
                # Only add if we have at least po_sku_key
                if record.get("po_sku_key"):
                    records.append(record)
                else:
                    skipped += 1
                    
            except Exception as e:
                print(f"      ⚠️ Warning: Row {row_num} - {e}")
                skipped += 1
    
    print(f"      ✅ Read {len(records)} valid records")
    if skipped > 0:
        print(f"      ⚠️ Skipped {skipped} invalid rows")
    
    return records

# ============================================================
# BATCH INSERT
# ============================================================

async def insert_data(conn, records):
    """Batch insert records into bol_db."""
    
    print(f"\n[3/3] Inserting {len(records)} records...")
    
    if not records:
        print("      ❌ No records to insert!")
        return
    
    # Build insert statement
    columns_str = ", ".join(DB_COLUMNS)
    placeholders = ", ".join([f":{col}" for col in DB_COLUMNS])
    
    insert_sql = text(f"""
        INSERT INTO bol_db ({columns_str})
        VALUES ({placeholders})
    """)
    
    # Batch insert (chunks of 100)
    batch_size = 100
    inserted = 0
    
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        
        for record in batch:
            await conn.execute(insert_sql, record)
            inserted += 1
        
        print(f"      Progress: {inserted}/{len(records)}")
    
    print(f"      ✅ Inserted {inserted} records")

# ============================================================
# MAIN
# ============================================================

async def main():
    print("\n" + "=" * 60)
    print("🚀 Initializing bol_db Table")
    print("=" * 60)
    
    # Find CSV
    csv_path = find_csv_file()
    if not csv_path:
        print("\n❌ ERROR: Could not find CSV file!")
        print("   Please ensure 'New HSUS Order Status - BOL_DB.csv' exists in the project root.")
        sys.exit(1)
    
    # Read CSV data
    records = read_csv_data(csv_path)
    
    # Create table and insert data
    async with engine.begin() as conn:
        await create_table(conn)
        await insert_data(conn, records)
    
    print("\n" + "=" * 60)
    print("✅ Initialization Complete!")
    print("=" * 60 + "\n")

# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":
    asyncio.run(main())
