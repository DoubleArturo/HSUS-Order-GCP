/**
 * @fileoverview Backend server-side script for the BOL Entry Tool.
 * [VERSION 13 - Cloud Run API Integration]
 * - ⚡️ MIGRATION: 所有資料操作改為透過 Cloud Run API
 * - ⚡️ 保留前端相容性，確保 UI 不需要修改
 */

// --- API 配置 ---
const API_BASE_URL = PropertiesService.getScriptProperties().getProperty('API_BASE_URL') || 'https://your-cloud-run-url.run.app';
const API_KEY = PropertiesService.getScriptProperties().getProperty('API_KEY') || ''; // 暫時使用 API Key，後續可改為 OAuth

/**
 * Opens the sidebar interface for the BOL Entry Tool.
 */
function openBolEntryTool() {
  const html = HtmlService.createTemplateFromFile('BolEntryTool')
    .evaluate()
    .setTitle('BOL Entry Tool');
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * API Client 輔助函式
 * 統一處理所有 API 呼叫，包含錯誤處理和認證
 * 
 * @param {string} endpoint - API 端點路徑（不含 base URL）
 * @param {string} method - HTTP 方法 ('GET', 'POST', 'DELETE')
 * @param {Object} payload - 請求資料（可選）
 * @returns {Object} API 回應資料
 */
function callApi(endpoint, method = 'GET', payload = null) {
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      muteHttpExceptions: true, // 重要：讓 UrlFetchApp 不自動拋出異常
    };

    // 加入認證 Header
    if (API_KEY) {
      options.headers['Authorization'] = `Bearer ${API_KEY}`;
      // 或者使用 API Key Header（根據後端實作選擇）
      // options.headers['X-API-Key'] = API_KEY;
    }

    // 如果有 payload，加入請求體
    if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.payload = JSON.stringify(payload);
    }

    Logger.log(`[API Call] ${method} ${url}`);
    if (payload) {
      Logger.log(`[API Payload] ${JSON.stringify(payload)}`);
    }

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log(`[API Response] Status: ${responseCode}, Body: ${responseText.substring(0, 200)}`);

    // 檢查 HTTP 狀態碼
    if (responseCode !== 200 && responseCode !== 201) {
      let errorMessage = `API request failed with status ${responseCode}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // 如果無法解析錯誤訊息，使用預設訊息
      }
      throw new Error(errorMessage);
    }

    // 解析回應
    try {
      return JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Failed to parse API response: ${e.message}`);
    }

  } catch (error) {
    Logger.log(`[API Error] ${error.message}`);
    throw error;
  }
}

/**
 * 根據 PO Number 搜尋訂單，取得 po_id (UUID)
 * 這是內部輔助函式，用於將 poSkuKey 轉換為 po_id
 * 
 * @param {string} poNumber - PO 號碼（從 poSkuKey 中提取）
 * @returns {string|null} Purchase Order UUID 或 null
 */
function findPoIdByPoNumber(poNumber) {
  try {
    const result = callApi(`/api/pos?search=${encodeURIComponent(poNumber)}&limit=1`, 'GET');
    
    if (result.success && result.data && result.data.length > 0) {
      // 精確匹配 PO Number（因為搜尋是模糊的）
      const exactMatch = result.data.find(po => po.po_number === poNumber);
      return exactMatch ? exactMatch.id : null;
    }
    return null;
  } catch (error) {
    Logger.log(`Error finding PO ID: ${error.message}`);
    return null;
  }
}

/**
 * 從 poSkuKey (格式: "PO#|SKU") 中提取 PO Number
 * 
 * @param {string} poSkuKey - PO|SKU 鍵值
 * @returns {string} PO Number
 */
function extractPoNumberFromKey(poSkuKey) {
  if (!poSkuKey || typeof poSkuKey !== 'string') {
    return '';
  }
  const parts = poSkuKey.split('|');
  return parts[0] || poSkuKey; // 如果沒有 |，返回整個字串
}

/**
 * 從 poSkuKey (格式: "PO#|SKU") 中提取 SKU
 * 
 * @param {string} poSkuKey - PO|SKU 鍵值
 * @returns {string} SKU
 */
function extractSkuFromKey(poSkuKey) {
  if (!poSkuKey || typeof poSkuKey !== 'string') {
    return '';
  }
  const parts = poSkuKey.split('|');
  return parts.length > 1 ? parts[1] : '';
}

/**
 * [已修改 V13] 獲取初始資料（待處理和已完成的列表）
 * 
 * 注意：此函式暫時保留從 Planning Sheet 讀取的邏輯，因為：
 * 1. Planning Sheet 的資料結構可能尚未完全遷移到資料庫
 * 2. 此函式主要用於顯示下拉選單，不涉及核心業務邏輯
 * 
 * 未來遷移方向：
 * - 當 Planning Sheet 資料完全遷移到資料庫後，可改為呼叫 API
 * - 建議後端新增端點：GET /api/bols/pending 和 GET /api/bols/fulfilled
 * 
 * @returns {Object} { success: boolean, pendingList: string[], fulfilledList: Object[] }
 */
function getInitialBolData() {
  Logger.log('--- Starting getInitialBolData() [V13 - Hybrid Mode] ---');

  try {
    const cache = CacheService.getScriptCache();
    const cachedPending = cache.get(CACHE_KEY_PENDING);
    const cachedFulfilled = cache.get(CACHE_KEY_FULFILLED);

    if (cachedPending != null && cachedFulfilled != null) {
      Logger.log('[CHECKPOINT] Returning data from cache.');
      return {
        success: true,
        pendingList: JSON.parse(cachedPending),
        fulfilledList: JSON.parse(cachedFulfilled)
      };
    }
    
    // 暫時保留從 Planning Sheet 讀取的邏輯
    // TODO: 未來改為從 API 取得
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const planningSheet = ss.getSheetByName(PLANNING_SHEET_NAME);
    if (!planningSheet) throw new Error(`Sheet '${PLANNING_SHEET_NAME}' not found.`);
    
    const lastRow = planningSheet.getLastRow();
    if (lastRow < 2) {
      Logger.log('INFO: Sheet is empty, returning empty lists.');
      return { success: true, pendingList: [], fulfilledList: [] };
    }

    const dataRange = planningSheet.getRange('A2:G' + lastRow);
    const planningData = dataRange.getValues();
    
    const pendingList = [];
    const fulfilledList = [];

    planningData.forEach(row => {
      const timestamp = row[0]; // Column A
      const key = row[2];       // Column C
      const status = row[6];    // Column G

      if (key) {
        if (status === 'Fulfilled') {
          fulfilledList.push({ key: key, timestamp: timestamp });
        } else {
          pendingList.push(key);
        }
      }
    });
    
    fulfilledList.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp) : new Date(0);
      const dateB = b.timestamp ? new Date(b.timestamp) : new Date(0);
      return dateB - dateA;
    });

    const uniquePendingList = [...new Set(pendingList)].sort();

    // 寫入快取
    cache.put(CACHE_KEY_PENDING, JSON.stringify(uniquePendingList), 300);
    cache.put(CACHE_KEY_FULFILLED, JSON.stringify(fulfilledList), 300);

    return {
      success: true,
      pendingList: uniquePendingList,
      fulfilledList: fulfilledList
    };

  } catch (e) {
    Logger.log(`ERROR: getInitialBolData Error: ${e.message}`);
    return { success: false, message: e.toString() };
  }
}

/**
 * [已修改 V13] 獲取已存在的 BOL 數據
 * 現在透過 API 取得，但保持與前端相容的格式
 * 
 * @param {string} poSkuKey - PO|SKU 鍵值（格式: "PO#|SKU"）
 * @returns {Object} { success: boolean, bols: Array, actShipDate: string, isFulfilled: boolean }
 */
function getExistingBolData(poSkuKey) {
  try {
    Logger.log(`[V13] getExistingBolData called with poSkuKey: ${poSkuKey}`);

    // 1. 從 poSkuKey 提取 PO Number
    const poNumber = extractPoNumberFromKey(poSkuKey);
    const sku = extractSkuFromKey(poSkuKey);

    if (!poNumber) {
      throw new Error('Invalid poSkuKey format');
    }

    // 2. 搜尋對應的 po_id
    const poId = findPoIdByPoNumber(poNumber);
    if (!poId) {
      Logger.log(`PO not found: ${poNumber}`);
      return { 
        success: true, 
        bols: [], 
        actShipDate: null, 
        isFulfilled: false 
      };
    }

    // 3. 呼叫 API 取得該 PO 的所有 BOL 資料
    const apiResponse = callApi(`/api/pos/${poId}/bols`, 'GET');

    if (!apiResponse.success) {
      throw new Error(apiResponse.message || 'Failed to get BOL data');
    }

    // 4. 過濾出符合 SKU 的 BOL 資料（如果 poSkuKey 包含 SKU）
    let filteredShipments = apiResponse.data.shipments || [];
    if (sku) {
      filteredShipments = filteredShipments.filter(shipment => shipment.sku === sku);
    }

    // 5. 轉換為前端期望的格式
    const bols = filteredShipments.map(shipment => ({
      bolNumber: shipment.bol_number,
      shippedQty: shipment.shipped_qty,
      shippingFee: 0, // API 回應中沒有 shippingFee，設為 0
      signed: false // API 回應中沒有 signed 欄位，設為 false
    }));

    // 6. 取得實際出貨日期（從第一個 shipment 取得）
    let actShipDate = null;
    if (filteredShipments.length > 0 && filteredShipments[0].created_at) {
      const date = new Date(filteredShipments[0].created_at);
      actShipDate = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }

    // 7. 判斷是否為 Fulfilled（這裡需要根據實際業務邏輯調整）
    // 暫時假設如果有 BOL 資料就視為 fulfilled
    const isFulfilled = filteredShipments.length > 0;

    return {
      success: true,
      bols: bols,
      actShipDate: actShipDate,
      isFulfilled: isFulfilled
    };

  } catch (e) {
    Logger.log(`getExistingBolData Error: ${e.message}`);
    return { success: false, message: e.toString() };
  }
}

/**
 * [已修改 V13] 儲存 BOL 數據
 * 現在透過 API 儲存，使用 Transaction 確保資料一致性
 * 
 * @param {Object} data - 前端傳來的資料 { poSkuKey, actShipDate, isFulfilled, bols: [...] }
 * @returns {Object} { success: boolean, message: string }
 */
function saveBolData(data) {
  try {
    Logger.log(`[V13] saveBolData called with data: ${JSON.stringify(data)}`);

    const poSkuKey = data.poSkuKey;
    if (!poSkuKey) {
      throw new Error("PO|SKU Key is missing.");
    }

    // 1. 從 poSkuKey 提取 PO Number 和 SKU
    const poNumber = extractPoNumberFromKey(poSkuKey);
    const sku = extractSkuFromKey(poSkuKey);

    if (!poNumber) {
      throw new Error('Invalid poSkuKey format');
    }

    if (!sku) {
      throw new Error('SKU is required in poSkuKey');
    }

    // 2. 搜尋對應的 po_id
    const poId = findPoIdByPoNumber(poNumber);
    if (!poId) {
      throw new Error(`Purchase Order "${poNumber}" not found. Please create the PO first.`);
    }

    // 3. 轉換前端資料格式為 API 格式
    // 前端格式：{ bolNumber, shippedQty, shippingFee, signed }
    // API 格式：{ sku, qty, memo? }
    
    if (!data.bols || data.bols.length === 0) {
      throw new Error('At least one BOL entry is required');
    }

    // 4. 處理多個 BOL entries
    // 如果有多個 entries，每個可能有不同的 bolNumber
    // 我們需要按照 bolNumber 分組，然後為每個 bolNumber 建立一個 API 呼叫
    
    const bolGroups = {};
    data.bols.forEach(bol => {
      const bolNumber = bol.bolNumber;
      if (!bolNumber) {
        throw new Error('BOL Number is required for all entries');
      }
      
      if (!bolGroups[bolNumber]) {
        bolGroups[bolNumber] = [];
      }
      
      bolGroups[bolNumber].push({
        sku: sku, // 使用從 poSkuKey 提取的 SKU
        qty: parseInt(bol.shippedQty, 10) || 0,
        memo: bol.shippingFee || bol.signed ? 
          `Shipping Fee: $${bol.shippingFee || 0}, Signed: ${bol.signed ? 'Yes' : 'No'}` : 
          null
      });
    });

    // 5. 為每個 bolNumber 建立 API 呼叫（使用 Transaction）
    const results = [];
    for (const bolNumber in bolGroups) {
      const items = bolGroups[bolNumber];
      
      const apiPayload = {
        po_id: poId,
        bol_number: bolNumber,
        items: items
      };

      Logger.log(`[V13] Calling API for BOL ${bolNumber} with payload: ${JSON.stringify(apiPayload)}`);

      const apiResponse = callApi('/api/bols', 'POST', apiPayload);

      if (!apiResponse.success) {
        throw new Error(apiResponse.message || `Failed to save BOL data for ${bolNumber}`);
      }
      
      results.push(apiResponse);
    }

    // 6. 清除快取
    const cache = CacheService.getScriptCache();
    cache.remove(CACHE_KEY_PENDING);
    cache.remove(CACHE_KEY_FULFILLED);

    return {
      success: true,
      message: `BOL records saved successfully for '${poSkuKey}'!`
    };

  } catch (e) {
    Logger.log(`saveBolData Error: ${e.message}\n${e.stack}`);
    return { success: false, message: e.toString() };
  }
}

// --- 常數定義（保留以維持相容性）---
const PLANNING_SHEET_NAME = 'Shipment_Planning_DB';
const CACHE_KEY_PENDING = 'pendingBolData';
const CACHE_KEY_FULFILLED = 'fulfilledBolData';
