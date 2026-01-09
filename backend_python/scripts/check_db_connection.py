import asyncio
import sys
import os
from dotenv import load_dotenv
from sqlalchemy.engine import make_url

# --- 1. 智慧搜尋 .env ---
current_dir = os.path.dirname(os.path.abspath(__file__)) # .../backend_python/scripts
project_root = os.path.dirname(current_dir)              # .../backend_python
parent_root = os.path.dirname(project_root)              # .../HSUS-Order-Status-GCP (Git Root)

# 定義搜尋路徑優先順序
search_paths = [
    os.path.join(project_root, '.env'),  # 優先找 backend_python/.env
    os.path.join(parent_root, '.env')    # 其次找根目錄 .env
]

env_loaded = False
loaded_path = ""

print("🔍 Hunting for .env file...")
for path in search_paths:
    if os.path.exists(path):
        print(f"   👉 Found at: {path}")
        load_dotenv(dotenv_path=path, override=True)
        # 檢查關鍵變數是否存在
        if os.getenv("DATABASE_URL"):
            env_loaded = True
            loaded_path = path
            break
        else:
            print("      ⚠️ File exists but DATABASE_URL is missing!")
    else:
        print(f"   ❌ Not found at: {path}")

if not env_loaded:
    print("\n🛑 Critical Error: Could not find a valid .env file with DATABASE_URL.")
    print("Please check your file location.")
    sys.exit(1)

print(f"\n✅ Successfully loaded config from: {loaded_path}")

# --- 2. 驗證連線字串 ---
url_str = os.getenv("DATABASE_URL")
try:
    # 移除可能存在的引號
    url_str = url_str.strip("'").strip('"')
    url = make_url(url_str)
    
    print(f"👤 User:        [{url.username}]")
    print(f"KW  Host:        [{url.host}]")
    print(f"🔌 Driver:      [{url.drivername}]")
    
    # 自動修正檢查 (Auto-fix check)
    if url.drivername == 'postgresql':
        print("⚠️  Warning: Driver is 'postgresql' (Sync). Attempting to upgrade to '+asyncpg'...")
        # 這裡不改 .env 檔案，只改記憶體中的變數供測試用
        url_str = url_str.replace('postgresql://', 'postgresql+asyncpg://')
        print("   Create Engine with upgraded URL.")

except Exception as e:
    print(f"❌ URL Parsing Failed: {e}")
    sys.exit(1)

# --- 3. 連線測試 ---
sys.path.append(project_root)
# 這裡我們手動建立 engine 以確保使用正確的 URL (避免 app.database 讀到舊的)
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import ssl

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# 使用修正後的 URL 建立臨時測試引擎
test_engine = create_async_engine(
    url_str,
    connect_args={"ssl": ssl_context}
)

async def test_connection():
    print("\n🔄 Initiating Connection Payload...")
    try:
        async with test_engine.connect() as conn:
            result = await conn.execute(text("SELECT version();"))
            version = result.scalar()
            print(f"✅ Connection Successful!")
            print(f"📊 DB Version: {version}")
    except Exception as e:
        print(f"❌ Connection Failed!")
        print(f"⚠️ Error Detail: {e}")
    finally:
        await test_engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_connection())