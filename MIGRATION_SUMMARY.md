# Cloud Run 遷移總結

## 📋 專案檢視結果

### 現有架構特點
- ✅ **7+ 個獨立工具**，每個工具獨立運作
- ✅ **Google Sheets 作為資料庫**，所有資料都儲存在 Sheets 中
- ✅ **Apps Script HTML Service** 作為 UI 層
- ✅ **部分快取機制**（CacheService，但限制較多）
- ✅ **非同步處理**（使用 Time-based Triggers）

### 主要問題識別

#### 1. 效能瓶頸 ⚠️
- **頻繁的 Sheets API 呼叫**：每個操作都需要多次讀寫
- **缺乏真正的快取層**：CacheService 僅 5-10 分鐘，容量有限
- **同步處理限制**：Apps Script 6 分鐘執行時間限制
- **無法並行處理**：單一執行緒架構

#### 2. 可維護性問題 ⚠️
- **程式碼分散**：每個工具獨立檔案，缺乏統一架構
- **硬編碼欄位索引**：多處使用數字索引（如 `PO_COL.PO_NUMBER - 1`）
- **重複的資料讀取邏輯**：每個工具都自己實作
- **缺乏統一錯誤處理**

#### 3. 擴展性限制 ⚠️
- **無法水平擴展**：Apps Script 是單體架構
- **無法使用現代工具**：無法使用 npm、TypeScript 等
- **監控與日誌有限**：僅有 Logger
- **完全依賴 Google Sheets**：無法使用真正的資料庫

---

## 🎯 建議解決方案

### 核心改進策略

1. **統一資料存取層**
   - 建立 `SheetService` 統一管理所有 Sheets 操作
   - 使用 Google Sheets API v4（比 Apps Script API 更快）
   - 批次操作減少 API 呼叫

2. **多層快取架構**
   - L1: Memory Cache（Node.js 記憶體）- 1-5 分鐘
   - L2: Redis Cache - 5-15 分鐘
   - L3: Google Sheets API - 原始資料

3. **引入資料庫**
   - Firestore 用於高頻查詢和狀態管理
   - 保留 Google Sheets 作為原始資料儲存

4. **非同步任務處理**
   - Cloud Tasks 取代 Apps Script Triggers
   - Cloud Pub/Sub 處理事件驅動任務

5. **微服務化架構**
   - 每個工具獨立部署為 Cloud Run 服務
   - 統一 API Gateway 管理路由和認證

---

## 📊 預期效益

### 效能提升
- ⚡ **讀取速度**: 提升 **3-5 倍**（快取命中時）
- ⚡ **寫入速度**: 提升 **2-3 倍**（批次操作）
- ⚡ **並發處理**: 支援多個使用者同時操作
- ⚡ **回應時間**: 從 **2-5 秒**降至 **0.5-1 秒**

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

## 💰 成本估算

**每月約 $60-80**（取決於使用量）
- Cloud Run: ~$30
- Memorystore (Redis): ~$30
- Firestore: ~$1
- 網路流量: ~$1

---

## 🚀 遷移路徑

### Phase 1: 基礎建設（2-3 週）
1. 建立 Cloud Run 專案與環境
2. 設定 Google Sheets API 認證
3. 建立 SheetService 核心服務
4. 設定 Redis 快取層
5. 建立基礎 API 框架

### Phase 2: 工具遷移（每個工具 1-2 週）
**優先順序**:
1. PO Editor（最複雜，作為範本）
2. Shipping Management Tool
3. BOL Entry Tool
4. Serial Assignment Tool
5. GIT Management Tool
6. Create Estimate Tool

### Phase 3: 優化與監控（1-2 週）
1. 效能測試與優化
2. 設定監控與告警
3. 文件撰寫
4. 使用者培訓

---

## 📁 交付文件

### 1. 分析報告
- `CLOUD_RUN_MIGRATION_ANALYSIS.md` - 完整的架構分析與建議

### 2. 範例程式碼
- `migration-example/` - 完整的 Cloud Run 服務範例
  - `services/sheet-service.ts` - 統一的 Sheets 存取服務
  - `services/cache-service.ts` - 多層快取服務
  - `api/po-service.ts` - PO Editor API 範例
  - `config/config.ts` - 配置管理
  - `Dockerfile` - 容器化配置
  - `cloudbuild.yaml` - CI/CD 配置

### 3. 關鍵改進點

#### 從硬編碼索引到欄位名稱查詢
```javascript
// 原本（Apps Script）
const poNumber = row[PO_COL.PO_NUMBER - 1]; // 硬編碼索引

// 改進後（Cloud Run）
const poNumber = record['P/O']; // 使用欄位名稱
```

#### 從單次讀寫到批次操作
```javascript
// 原本（Apps Script）
sheet.appendRow([...]); // 每次一行

// 改進後（Cloud Run）
await sheetService.writeBatch('PO_RAW', [record1, record2, ...]); // 批次寫入
```

#### 從同步到非同步處理
```javascript
// 原本（Apps Script）
savePoCorrections_AppendOnly() -> Trigger -> _processPoCorrectionTrigger()

// 改進後（Cloud Run）
POST /api/v1/po/corrections -> Cloud Tasks -> processPoCorrection()
```

---

## ⚠️ 注意事項

### 技術考量
1. **Google Sheets API 配額限制** - 需要實施速率限制與重試機制
2. **認證複雜度** - 使用 Service Account + OAuth 混合模式
3. **資料一致性** - 實作樂觀鎖定與版本控制

### 遷移策略
1. **並行運行** - Apps Script 與 Cloud Run 同時運行
2. **逐步切換** - 一個工具一個工具遷移
3. **保持 UI 一致性** - 減少使用者學習曲線

---

## 📚 下一步行動

1. ✅ **檢視分析報告** - 詳細了解架構設計
2. ✅ **檢視範例程式碼** - 了解實作方式
3. 🔲 **確認需求** - 與團隊確認遷移範圍與優先順序
4. 🔲 **建立 POC** - 選擇一個簡單工具作為概念驗證
5. 🔲 **制定詳細計劃** - 包含時間表、資源分配、測試計劃

---

## 📞 支援

如有任何問題，請參考：
- `CLOUD_RUN_MIGRATION_ANALYSIS.md` - 完整技術文件
- `migration-example/README.md` - 範例程式碼說明
- [Google Cloud Run 文件](https://cloud.google.com/run/docs)
- [Google Sheets API v4 文件](https://developers.google.com/sheets/api)

