# BOL Entry Tool 遷移說明

## 概述

`BolEntryToolgs.js` 已成功遷移到使用 Cloud Run API，但保持與前端 `BolEntryTool.html` 的完全相容性。

## 設定步驟

### 1. 設定 Script Properties

在 Google Apps Script 編輯器中，執行以下程式碼來設定 API 連線資訊：

```javascript
function setupApiConfig() {
  const scriptProperties = PropertiesService.getScriptProperties();
  
  // 設定 Cloud Run API 基礎 URL
  scriptProperties.setProperty('API_BASE_URL', 'https://your-cloud-run-url.run.app');
  
  // 設定 API Key（暫時使用，後續可改為 OAuth）
  scriptProperties.setProperty('API_KEY', 'your-api-key-here');
  
  Logger.log('API configuration set successfully');
}
```

或者手動設定：
1. 在 Apps Script 編輯器中，點選「專案設定」→「指令碼內容」
2. 新增以下屬性：
   - `API_BASE_URL`: Cloud Run 服務的完整 URL
   - `API_KEY`: API 認證金鑰（暫時使用，後續可改為 OAuth）

## 資料格式對應

### 前端 → 後端 API 轉換

#### `getExistingBolData(poSkuKey)`
- **前端格式**: `poSkuKey` (格式: `"PO#|SKU"`)
- **轉換過程**:
  1. 提取 PO Number: `extractPoNumberFromKey(poSkuKey)`
  2. 搜尋對應的 `po_id`: `findPoIdByPoNumber(poNumber)`
  3. 呼叫 API: `GET /api/pos/{po_id}/bols`
  4. 過濾 SKU 相符的資料
  5. 轉換為前端期望格式

#### `saveBolData(data)`
- **前端格式**:
  ```javascript
  {
    poSkuKey: "PO#|SKU",
    actShipDate: "2024-01-15",
    isFulfilled: true,
    bols: [
      {
        bolNumber: "BOL-001",
        shippedQty: 10,
        shippingFee: 100.00,
        signed: true
      }
    ]
  }
  ```
- **轉換為 API 格式**:
  ```javascript
  {
    po_id: "uuid-here",
    bol_number: "BOL-001",
    items: [
      {
        sku: "SKU",
        qty: 10,
        memo: "Shipping Fee: $100.00, Signed: Yes"
      }
    ]
  }
  ```
- **多個 BOL entries 處理**: 如果前端傳入多個 entries，會按照 `bolNumber` 分組，每個 `bolNumber` 建立一個 API 呼叫

## 前端相容性

### ✅ 不需要修改前端 HTML

`BolEntryTool.html` **完全不需要修改**，因為：

1. **回傳格式保持一致**:
   - `getInitialBolData()` 回傳: `{ success, pendingList, fulfilledList }`
   - `getExistingBolData()` 回傳: `{ success, bols, actShipDate, isFulfilled }`
   - `saveBolData()` 回傳: `{ success, message }`

2. **錯誤處理保持一致**:
   - 所有函式都回傳 `{ success: boolean, message?: string }` 格式
   - 前端現有的錯誤處理邏輯完全適用

3. **函式簽名保持一致**:
   - 所有函式的參數和回傳值格式都與原本相同

## 混合模式說明

### `getInitialBolData()` 暫時保留 Sheet 讀取

此函式暫時保留從 `Shipment_Planning_DB` Sheet 讀取的邏輯，原因：

1. Planning Sheet 的資料結構可能尚未完全遷移到資料庫
2. 此函式主要用於顯示下拉選單，不涉及核心業務邏輯
3. 可以逐步遷移，不影響其他功能

**未來遷移方向**:
- 當 Planning Sheet 資料完全遷移到資料庫後，可改為呼叫 API
- 建議後端新增端點：`GET /api/bols/pending` 和 `GET /api/bols/fulfilled`

## API 端點對應

| GAS 函式 | API 端點 | 方法 | 說明 |
|---------|---------|------|------|
| `getExistingBolData()` | `/api/pos/{po_id}/bols` | GET | 取得某張 PO 的 BOL 出貨紀錄 |
| `saveBolData()` | `/api/bols` | POST | 批次建立 BOL 出貨紀錄（使用 Transaction） |
| `findPoIdByPoNumber()` | `/api/pos?search={poNumber}` | GET | 搜尋訂單，取得 po_id |

## 錯誤處理

所有 API 呼叫都透過 `callApi()` 函式統一處理：

1. **HTTP 狀態碼檢查**: 如果 `responseCode !== 200 && responseCode !== 201`，會拋出錯誤
2. **錯誤訊息解析**: 嘗試從 API 回應中解析錯誤訊息
3. **日誌記錄**: 所有 API 呼叫和錯誤都會記錄到 Logger

## 測試建議

1. **測試 API 連線**:
   ```javascript
   function testApiConnection() {
     try {
       const result = callApi('/health', 'GET');
       Logger.log('API Connection Test:', result);
     } catch (error) {
       Logger.log('API Connection Failed:', error.message);
     }
   }
   ```

2. **測試 PO 搜尋**:
   ```javascript
   function testSearchPO() {
     const poId = findPoIdByPoNumber('PO-2024-001');
     Logger.log('Found PO ID:', poId);
   }
   ```

3. **測試取得 BOL 資料**:
   ```javascript
   function testGetBolData() {
     const result = getExistingBolData('PO-2024-001|SKU-001');
     Logger.log('BOL Data:', result);
   }
   ```

## 注意事項

1. **API Key 安全性**: 目前使用 API Key，建議後續改為 OAuth 2.0
2. **多個 BOL entries**: 如果前端傳入多個 entries，每個 `bolNumber` 會建立一個 API 呼叫
3. **SKU 提取**: 目前從 `poSkuKey` 中提取 SKU，確保格式為 `"PO#|SKU"`
4. **快取機制**: `getInitialBolData()` 仍使用快取，減少 Sheet 讀取次數

## 未來改進

1. **OAuth 認證**: 取代 API Key，使用 Google OAuth 2.0
2. **批次 API 呼叫**: 優化多個 BOL entries 的處理，使用批次 API
3. **完全 API 化**: 將 `getInitialBolData()` 改為完全從 API 取得
4. **錯誤重試機制**: 加入自動重試邏輯，處理暫時性網路錯誤

