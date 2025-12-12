# BOL Entry Service

BOL Entry Tool 的 Cloud Run 服務實作，使用 Node.js + Express + Supabase (PostgreSQL)。

## 專案結構

```
bol-entry-service/
├── src/
│   ├── config/
│   │   └── database.js          # Supabase 資料庫連線配置
│   ├── repository/
│   │   └── BolRepository.js     # 資料存取層（含 Transaction 處理）
│   └── controllers/
│       └── BolController.js     # API 控制器
├── server.js                    # Express 應用程式入口
├── package.json
├── .env.example
└── README.md
```

## 環境設定

1. 複製 `.env.example` 為 `.env`
2. 填入 Supabase 連線資訊：
   ```env
   DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres
   PORT=8080
   NODE_ENV=development
   ```

## 安裝與執行

```bash
# 安裝依賴
npm install

# 開發模式（使用 nodemon）
npm run dev

# 生產模式
npm start
```

## API 端點

### GET /api/pos
搜尋訂單（支援模糊搜尋）

**查詢參數：**
- `search` (optional): 搜尋關鍵字
- `limit` (optional, default: 50): 回傳筆數
- `offset` (optional, default: 0): 分頁偏移

**範例：**
```bash
GET /api/pos?search=PO-123&limit=10
```

### GET /api/pos/:po_id/bols
取得某張 PO 的所有 BOL 出貨紀錄

**範例：**
```bash
GET /api/pos/550e8400-e29b-41d4-a716-446655440000/bols
```

### POST /api/bols
批次建立 BOL 出貨紀錄（**核心功能，使用 Transaction**）

**請求格式：**
```json
{
  "po_id": "550e8400-e29b-41d4-a716-446655440000",
  "bol_number": "BOL-2024-001",
  "items": [
    {
      "sku": "SKU-001",
      "qty": 10,
      "memo": "Optional memo"
    },
    {
      "sku": "SKU-002",
      "qty": 5
    }
  ]
}
```

**重點：** 此端點使用 SQL Transaction 確保所有 items 要麼全部成功，要麼全部失敗。

### DELETE /api/bols/:id
刪除單筆 BOL 出貨紀錄

**範例：**
```bash
DELETE /api/bols/550e8400-e29b-41d4-a716-446655440000
```

### GET /api/bols/statistics
取得 BOL 統計資訊

**查詢參數：**
- `po_id` (optional): 篩選特定 PO

## Transaction 處理說明

`BolRepository.createBolsWithTransaction()` 方法展示了如何正確處理 SQL Transaction：

1. **取得連線**：從連線池取得專用連線
2. **開始 Transaction**：執行 `BEGIN`
3. **驗證資料**：檢查 PO 是否存在、驗證輸入格式
4. **批次插入**：使用 `VALUES` 子句批次插入所有 items
5. **更新時間戳**：更新 PO 的 `updated_at`
6. **Commit**：如果所有步驟成功，執行 `COMMIT`
7. **Rollback**：如果任何步驟失敗，自動執行 `ROLLBACK`
8. **釋放連線**：在 `finally` 區塊確保連線被釋放

## 資料庫 Schema

請確保 Supabase 資料庫已建立以下表格：

```sql
-- 訂單主表
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL,
  buyer_name TEXT,
  status TEXT DEFAULT 'Open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOL 出貨明細表
CREATE TABLE bol_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  bol_number TEXT NOT NULL,
  sku TEXT NOT NULL,
  shipped_qty INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 部署到 Cloud Run

1. 建立 `Dockerfile`
2. 使用 Cloud Build 建置映像
3. 部署到 Cloud Run

詳細部署步驟請參考 Google Cloud Run 文件。

