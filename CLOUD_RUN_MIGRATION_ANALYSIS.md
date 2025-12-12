# Cloud Run 遷移分析與建議方案

## 📊 專案現況分析

### 架構概覽
- **平台**: Google Apps Script (V8 Runtime)
- **資料儲存**: Google Sheets (作為資料庫使用)
- **工具數量**: 7+ 個獨立工具
- **UI 架構**: HTML Service (Modal Dialog / Sidebar)
- **非同步處理**: Time-based Triggers + CacheService

### 主要工具清單
1. **PO Editor** - PO 資料修正工具
2. **Shipping Management Tool** - 運輸管理工具
3. **BOL Entry Tool** - BOL 號碼輸入工具
4. **Serial Assignment Tool** - 序號分配工具
5. **GIT Management Tool** - GIT 進度編輯器
6. **Create Estimate Tool** - 建立估價單工具
7. **Manual New PO** - 手動建立 PO 工具

### 現有架構優點
✅ 工具獨立運作，互不干擾  
✅ 使用 `getValues()` 批次讀取優化  
✅ 部分使用 CacheService 減少讀取  
✅ 有 SheetService.js 抽象化層的雛形  

### 現有架構問題

#### 1. 效能瓶頸
- **頻繁的 Sheets API 呼叫**: 每次操作都需要多次讀寫
- **缺乏真正的快取層**: CacheService 僅 5-10 分鐘，且容量有限
- **同步處理限制**: Apps Script 執行時間限制（6 分鐘）
- **單一執行緒**: 無法並行處理多個請求

#### 2. 可維護性問題
- **程式碼分散**: 每個工具獨立檔案，缺乏統一架構
- **硬編碼欄位索引**: 多處使用數字索引（如 `PO_COL.PO_NUMBER - 1`）
- **重複的資料讀取邏輯**: 每個工具都自己實作讀取邏輯
- **缺乏錯誤處理統一機制**

#### 3. 擴展性限制
- **無法水平擴展**: Apps Script 是單體架構
- **無法使用現代開發工具**: 無法使用 npm 套件、TypeScript 等
- **監控與日誌有限**: 僅有 Logger，缺乏完整的監控系統
- **無法使用資料庫**: 完全依賴 Google Sheets

---

## 🚀 Cloud Run 遷移方案

### 架構設計原則

1. **保持 Google Sheets 作為主要資料來源**（符合需求）
2. **引入快取層**提升讀取效能
3. **引入資料庫**用於高頻查詢和狀態管理
4. **微服務化**每個工具獨立部署
5. **統一 API 層**提供一致的介面

### 建議架構

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Web UI)                     │
│  React/Vue.js SPA 或 Google Apps Script HTML Service   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ HTTPS
                       │
┌──────────────────────▼──────────────────────────────────┐
│              API Gateway (Cloud Endpoints)               │
│         - 路由管理 - 認證 - 速率限制                    │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
│  PO Service  │ │ BOL Service│ │Serial Svc  │
│  (Cloud Run) │ │(Cloud Run) │ │(Cloud Run) │
└───────┬──────┘ └─────┬──────┘ └─────┬──────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
│  Sheets API  │ │  Firestore │ │  Redis     │
│   (v4)       │ │   (Cache)  │ │  (Cache)    │
└──────────────┘ └────────────┘ └────────────┘
```

### 核心組件設計

#### 1. **資料存取層 (Data Access Layer)**

**目標**: 統一所有 Google Sheets 的讀寫操作

```typescript
// services/sheet-service.ts
class SheetService {
  // 批次讀取優化
  async readBatch(sheetName: string, range?: string): Promise<Row[]>
  
  // 批次寫入優化
  async writeBatch(sheetName: string, data: Row[]): Promise<void>
  
  // 快取讀取（優先從 Redis 讀取）
  async readWithCache(sheetName: string, ttl: number = 300): Promise<Row[]>
  
  // 根據欄位名稱查詢（而非索引）
  async findByField(sheetName: string, field: string, value: any): Promise<Row[]>
}
```

**改進點**:
- ✅ 使用 Google Sheets API v4（比 Apps Script API 更快）
- ✅ 批次操作減少 API 呼叫次數
- ✅ 多層快取（Redis + Memory）
- ✅ 欄位名稱查詢取代硬編碼索引

#### 2. **快取策略**

**多層快取架構**:
```
L1: Memory Cache (Node.js 記憶體) - 1-5 分鐘
L2: Redis Cache - 5-15 分鐘
L3: Google Sheets API - 原始資料
```

**快取失效策略**:
- 寫入操作時自動清除相關快取
- 使用 Cache Tags 精確控制失效範圍
- 支援手動刷新快取

#### 3. **非同步任務處理**

**取代 Apps Script Triggers**:
- 使用 **Cloud Tasks** 處理長時間任務
- 使用 **Cloud Pub/Sub** 處理事件驅動任務
- 使用 **Cloud Scheduler** 處理定時任務

**範例**: PO 修正的非同步處理
```typescript
// 原本: savePoCorrections_AppendOnly -> Trigger
// 新架構:
async function savePoCorrections(data) {
  // 1. 立即回傳
  const taskId = await createTask('processPoCorrection', data);
  return { success: true, taskId };
  
  // 2. Cloud Tasks 在背景處理
  // 3. 狀態更新到 Firestore，前端輪詢或 WebSocket
}
```

#### 4. **資料庫整合**

**Firestore 用途**:
- ✅ 任務佇列狀態追蹤
- ✅ 使用者操作日誌
- ✅ 高頻查詢資料（如 Model Name 對照表）
- ✅ 即時狀態同步

**保留 Google Sheets**:
- ✅ 原始資料儲存（Raw Data）
- ✅ 報表與儀表板
- ✅ 歷史資料歸檔

#### 5. **API 設計**

**RESTful API 結構**:
```
GET    /api/v1/po/{poNumber}           - 取得 PO 資料
POST   /api/v1/po/{poNumber}/corrections - 提交 PO 修正
GET    /api/v1/po/{poNumber}/status    - 查詢處理狀態

GET    /api/v1/bol/pending             - 取得待處理 BOL 列表
POST   /api/v1/bol                      - 儲存 BOL 資料

GET    /api/v1/serial/available        - 取得可用序號
POST   /api/v1/serial/assign            - 分配序號
```

**認證機制**:
- OAuth 2.0 (Google Sign-In)
- Service Account (後端服務間通訊)
- API Keys (可選，用於內部服務)

---

## 📈 效能優化策略

### 1. 讀取優化

**現況問題**:
```javascript
// 每個工具都重複讀取整個 Sheet
const data = sheet.getRange('A2:G' + lastRow).getValues();
```

**優化方案**:
```typescript
// 1. 批次讀取多個 Sheet
const [poData, bolData, serialData] = await Promise.all([
  sheetService.readWithCache('PO_RAW'),
  sheetService.readWithCache('BOL_DB'),
  sheetService.readWithCache('SERIAL_DB')
]);

// 2. 只讀取需要的欄位
const poData = await sheetService.readColumns('PO_RAW', ['P/O', 'SKU', 'QTY']);

// 3. 使用增量同步
const changes = await sheetService.getChangesSince('PO_RAW', lastSyncTime);
```

### 2. 寫入優化

**現況問題**:
```javascript
// 逐行寫入
sheet.appendRow([...]);
sheet.getRange(row, col).setValue(value);
```

**優化方案**:
```typescript
// 批次寫入
await sheetService.writeBatch('PO_RAW', [
  { 'P/O': '123', 'SKU': 'ABC', ... },
  { 'P/O': '124', 'SKU': 'DEF', ... }
]);

// 使用 Batch Update API
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId,
  data: [{
    range: 'Sheet1!A2:C10',
    values: [[...], [...]]
  }]
});
```

### 3. 快取優化

**實作範例**:
```typescript
class CachedSheetService {
  private redis: Redis;
  private memoryCache: Map<string, CacheEntry>;
  
  async readWithCache(sheetName: string): Promise<Row[]> {
    // L1: Memory Cache
    const memCached = this.memoryCache.get(sheetName);
    if (memCached && !memCached.isExpired()) {
      return memCached.data;
    }
    
    // L2: Redis Cache
    const redisCached = await this.redis.get(`sheet:${sheetName}`);
    if (redisCached) {
      const data = JSON.parse(redisCached);
      this.memoryCache.set(sheetName, new CacheEntry(data));
      return data;
    }
    
    // L3: API Call
    const data = await this.readFromSheets(sheetName);
    
    // 寫回快取
    await this.redis.setex(`sheet:${sheetName}`, 300, JSON.stringify(data));
    this.memoryCache.set(sheetName, new CacheEntry(data, 60));
    
    return data;
  }
}
```

---

## 🛠️ 技術棧建議

### 後端
- **Runtime**: Node.js 18+ (LTS)
- **Framework**: Express.js 或 Fastify
- **Language**: TypeScript
- **Google APIs**: `@googleapis/sheets`, `@google-cloud/firestore`
- **快取**: Redis (Memorystore for Redis)
- **任務佇列**: Cloud Tasks

### 前端（可選）
- **選項 1**: 保留 Apps Script HTML Service（最小改動）
- **選項 2**: React/Vue.js SPA（更好的 UX）
- **選項 3**: Google Apps Script 作為前端，呼叫 Cloud Run API

### 基礎設施
- **部署**: Cloud Run
- **API Gateway**: Cloud Endpoints 或 API Gateway
- **監控**: Cloud Monitoring + Cloud Logging
- **CI/CD**: Cloud Build + Cloud Deploy

---

## 📋 遷移步驟建議

### Phase 1: 基礎建設（2-3 週）
1. ✅ 建立 Cloud Run 專案與環境
2. ✅ 設定 Google Sheets API 認證
3. ✅ 建立 SheetService 核心服務
4. ✅ 設定 Redis 快取層
5. ✅ 建立基礎 API 框架

### Phase 2: 工具遷移（每個工具 1-2 週）
**優先順序**:
1. **PO Editor**（最複雜，作為範本）
2. **Shipping Management Tool**
3. **BOL Entry Tool**
4. **Serial Assignment Tool**
5. **GIT Management Tool**
6. **Create Estimate Tool**

**遷移模式**:
- 保持原有功能不變
- 逐步重構程式碼
- 並行運行（Apps Script + Cloud Run）
- 逐步切換流量

### Phase 3: 優化與監控（1-2 週）
1. ✅ 效能測試與優化
2. ✅ 設定監控與告警
3. ✅ 文件撰寫
4. ✅ 使用者培訓

---

## 💰 成本估算

### Cloud Run
- **請求數**: ~100,000/月 → $0.40
- **CPU/記憶體**: 2 vCPU, 2GB RAM, 50% 使用率 → ~$30/月
- **網路**: 出站流量 ~10GB → $1.20

### Memorystore (Redis)
- **基本層**: 1GB → ~$30/月

### Firestore
- **讀取**: ~1M 次 → $0.06
- **寫入**: ~100K 次 → $0.18
- **儲存**: ~1GB → $0.18

### Google Sheets API
- **免費配額**: 300 requests/100 seconds/user
- **通常不需要額外費用**

**總計**: 約 **$60-80/月**（取決於使用量）

---

## ⚠️ 風險與注意事項

### 技術風險
1. **Google Sheets API 配額限制**
   - 解決: 實施速率限制與重試機制
   
2. **認證複雜度**
   - 解決: 使用 Service Account + OAuth 混合模式
   
3. **資料一致性**
   - 解決: 實作樂觀鎖定與版本控制

### 業務風險
1. **遷移期間服務中斷**
   - 解決: 並行運行，逐步切換
   
2. **使用者學習曲線**
   - 解決: 保持 UI 一致性，提供培訓

---

## ✅ 預期效益

### 效能提升
- ⚡ **讀取速度**: 提升 3-5 倍（快取命中時）
- ⚡ **寫入速度**: 提升 2-3 倍（批次操作）
- ⚡ **並發處理**: 支援多個使用者同時操作
- ⚡ **回應時間**: 從 2-5 秒降至 0.5-1 秒

### 可維護性提升
- 📝 **程式碼組織**: 模組化、可測試
- 📝 **錯誤處理**: 統一錯誤處理機制
- 📝 **日誌與監控**: 完整的追蹤與除錯能力
- 📝 **版本控制**: 使用 Git，支援 CI/CD

### 擴展性提升
- 📈 **水平擴展**: Cloud Run 自動擴展
- 📈 **新功能開發**: 更容易新增工具
- 📈 **整合能力**: 可整合其他 Google Cloud 服務

---

## 🎯 下一步行動

1. **確認需求**: 與團隊確認遷移範圍與優先順序
2. **建立 POC**: 選擇一個簡單工具（如 GIT Tool）作為概念驗證
3. **技術選型**: 確認技術棧與架構設計
4. **制定詳細計劃**: 包含時間表、資源分配、測試計劃
5. **開始 Phase 1**: 建立基礎建設

---

## 📚 參考資源

- [Google Sheets API v4 文件](https://developers.google.com/sheets/api)
- [Cloud Run 最佳實踐](https://cloud.google.com/run/docs/best-practices)
- [Firestore 資料建模](https://cloud.google.com/firestore/docs/best-practices)
- [Memorystore for Redis](https://cloud.google.com/memorystore/docs/redis)

