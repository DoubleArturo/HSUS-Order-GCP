# Cloud Run 遷移範例

此目錄包含將 Apps Script 轉換為 Cloud Run 服務的範例程式碼。

## 目錄結構

```
migration-example/
├── README.md
├── services/
│   ├── sheet-service.ts          # 統一的 Google Sheets 存取服務
│   └── cache-service.ts          # 快取服務
├── api/
│   └── po-service.ts             # PO Editor 服務範例
├── config/
│   └── config.ts                 # 配置管理
└── package.json                  # 依賴套件
```

## 快速開始

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

```bash
export GOOGLE_SHEET_ID=your-sheet-id
export GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
export REDIS_HOST=your-redis-host
export REDIS_PORT=6379
```

### 3. 執行服務

```bash
npm run dev
```

## 範例說明

### SheetService
展示了如何：
- 使用 Google Sheets API v4 取代 Apps Script API
- 實作多層快取機制
- 批次讀寫優化
- 欄位名稱查詢取代硬編碼索引

### PO Service
展示了如何：
- 將 Apps Script 函數轉換為 REST API
- 使用非同步任務處理長時間操作
- 實作統一的錯誤處理

