# API 使用範例

## 1. 搜尋訂單

```bash
# 搜尋所有訂單
curl -X GET "http://localhost:8080/api/pos"

# 模糊搜尋 PO Number 或 Buyer Name
curl -X GET "http://localhost:8080/api/pos?search=PO-123"

# 分頁查詢
curl -X GET "http://localhost:8080/api/pos?search=PO&limit=10&offset=0"
```

**回應範例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "po_number": "PO-2024-001",
      "buyer_name": "ABC Company",
      "status": "Open",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ],
  "count": 1
}
```

## 2. 取得某張 PO 的 BOL 出貨紀錄

```bash
curl -X GET "http://localhost:8080/api/pos/550e8400-e29b-41d4-a716-446655440000/bols"
```

**回應範例：**
```json
{
  "success": true,
  "data": {
    "purchase_order": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "po_number": "PO-2024-001",
      "buyer_name": "ABC Company",
      "status": "Open"
    },
    "shipments": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "bol_number": "BOL-2024-001",
        "sku": "SKU-001",
        "shipped_qty": 10,
        "memo": "First shipment",
        "created_at": "2024-01-16T10:00:00Z"
      }
    ],
    "count": 1
  }
}
```

## 3. 批次建立 BOL 出貨紀錄（核心功能 - 使用 Transaction）

```bash
curl -X POST "http://localhost:8080/api/bols" \
  -H "Content-Type: application/json" \
  -d '{
    "po_id": "550e8400-e29b-41d4-a716-446655440000",
    "bol_number": "BOL-2024-001",
    "items": [
      {
        "sku": "SKU-001",
        "qty": 10,
        "memo": "First item"
      },
      {
        "sku": "SKU-002",
        "qty": 5
      },
      {
        "sku": "SKU-003",
        "qty": 20,
        "memo": "Third item with memo"
      }
    ]
  }'
```

**重點說明：**
- 此 API 使用 **SQL Transaction**，確保所有 items 要麼全部成功，要麼全部失敗
- 如果任何一個 item 插入失敗，整個 Transaction 會自動 Rollback
- 如果 PO 不存在，會回傳 404 錯誤

**成功回應：**
```json
{
  "success": true,
  "message": "Successfully created 3 BOL shipment(s)",
  "data": {
    "insertedCount": 3,
    "ids": [
      "660e8400-e29b-41d4-a716-446655440001",
      "660e8400-e29b-41d4-a716-446655440002",
      "660e8400-e29b-41d4-a716-446655440003"
    ],
    "records": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "bol_number": "BOL-2024-001",
        "sku": "SKU-001",
        "shipped_qty": 10,
        "memo": "First item",
        "created_at": "2024-01-16T10:00:00Z"
      },
      ...
    ]
  }
}
```

**錯誤回應範例：**
```json
{
  "success": false,
  "message": "Purchase Order with id 550e8400-e29b-41d4-a716-446655440000 not found"
}
```

## 4. 刪除單筆 BOL 出貨紀錄

```bash
curl -X DELETE "http://localhost:8080/api/bols/660e8400-e29b-41d4-a716-446655440001"
```

**成功回應：**
```json
{
  "success": true,
  "message": "BOL shipment deleted successfully"
}
```

## 5. 取得統計資訊

```bash
# 取得所有 PO 的統計
curl -X GET "http://localhost:8080/api/bols/statistics"

# 取得特定 PO 的統計
curl -X GET "http://localhost:8080/api/bols/statistics?po_id=550e8400-e29b-41d4-a716-446655440000"
```

**回應範例：**
```json
{
  "success": true,
  "data": [
    {
      "po_id": "550e8400-e29b-41d4-a716-446655440000",
      "po_number": "PO-2024-001",
      "total_shipments": 5,
      "total_shipped_qty": 100,
      "unique_bol_count": 2
    }
  ]
}
```

## Transaction 測試場景

### 測試 1: 正常批次插入
所有 items 都有效，應該全部成功插入。

### 測試 2: PO 不存在
應該回傳 404 錯誤，沒有任何資料被插入。

### 測試 3: 部分資料無效
如果任何一個 item 的資料格式錯誤（例如 qty 為負數），整個 Transaction 會 Rollback，沒有任何資料被插入。

### 測試 4: 資料庫約束違反
如果違反外鍵約束（例如 po_id 不存在），Transaction 會 Rollback。

