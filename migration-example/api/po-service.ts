/**
 * PO Editor 服務
 * 將原本的 Apps Script PO Editor 轉換為 Cloud Run REST API
 */

import { Router, Request, Response } from 'express';
import { sheetService, Row } from '../services/sheet-service';
import { cacheService } from '../services/cache-service';

const router = Router();

// 工作表名稱（從 config.js 對應）
const PO_RAW_DATA_SHEET = 'Dealer PO | Raw Data';
const PRICE_BOOK_SHEET = 'HSUS Price Book';
const QUEUE_SHEET = 'PO Processing Queue';

/**
 * GET /api/v1/po/correction-data
 * 取得 PO 修正所需的資料（對應原本的 getCorrectionData）
 */
router.get('/correction-data', async (req: Request, res: Response) => {
  try {
    // 讀取多個工作表（並行）
    const [procData, priceBookData] = await Promise.all([
      sheetService.readAllRecords('proc_shipping_management'),
      sheetService.readAllRecords(PRICE_BOOK_SHEET),
    ]);

    // 處理 proc_shipping_management 資料
    const poMap = new Map<string, any>();
    
    procData.forEach((row: Row) => {
      const poNumber = row['PO Number'];
      const status = row['Status'];
      
      if (!poNumber || status !== '') {
        return;
      }

      if (!poMap.has(poNumber)) {
        const rawDate = row['Date'];
        const formattedDate = rawDate instanceof Date 
          ? rawDate.toISOString().split('T')[0] 
          : '';

        poMap.set(poNumber, {
          poNumber,
          pdfUrl: row['File URL'],
          poReceivedDate: formattedDate,
          rsm: row['RSM'],
          paymentTerm: row['Payment Term'],
          shipToContact: row['Contact'],
          shipToPhone: row['Phone'],
          streetAddress: row['Street'] || '',
          city: row['City'] || '',
          state: row['State'] || '',
          zipcode: row['ZIP'] || '',
          buyerName: row['Buyer Name'] || '',
          company: row['Company'] || '',
          spiff: '',
          items: [],
        });
      }

      poMap.get(poNumber).items.push({
        rowNumber: row._rowNumber,
        model: row['Model'] || '',
        sku: row['Derived SKU'] || row['Original SKU'] || '',
        qty: row['QTY'] || '',
        unitPrice: row['Unit Price'] || '',
      });
    });

    // 處理 Price Book 資料
    const modelToSkuMap: Record<string, string> = {};
    const modelToPriceMap: Record<string, number> = {};
    const modelNames: string[] = [];

    priceBookData.forEach((row: Row) => {
      const lookupName = row['Lookup Name'];
      const sku = row['SKU'];
      const price = row['Price'];

      if (lookupName && sku) {
        if (!modelToSkuMap[lookupName]) {
          modelNames.push(lookupName);
        }
        modelToSkuMap[lookupName] = sku;
        modelToPriceMap[lookupName] = price;
      }
    });

    const sortedModelNames = [...new Set(modelNames)].sort();
    const standardModels = sortedModelNames.filter((name) => name.includes('Standard'));
    const nonStandardModels = sortedModelNames.filter((name) => !name.includes('Standard'));
    const finalModelNames = [...nonStandardModels.sort(), ...standardModels.sort()];

    res.json({
      success: true,
      allPOs: Array.from(poMap.values()),
      modelNames: finalModelNames,
      modelToSkuMap,
      modelToPriceMap,
    });
  } catch (error: any) {
    console.error('Error getting correction data:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get correction data',
    });
  }
});

/**
 * POST /api/v1/po/corrections
 * 提交 PO 修正（對應原本的 savePoCorrections_AppendOnly）
 * 改為非同步處理，立即回傳任務 ID
 */
router.post('/corrections', async (req: Request, res: Response) => {
  try {
    const { poNumber, basicInfo, items } = req.body;

    if (!poNumber || !basicInfo || !items) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: poNumber, basicInfo, items',
      });
    }

    // 建立任務 ID
    const taskId = `po_correction_${poNumber}_${Date.now()}`;
    
    // 將任務資料存入快取（或 Firestore）
    await cacheService.set(`task:${taskId}`, {
      poNumber,
      basicInfo,
      items,
      status: 'queued',
      createdAt: new Date().toISOString(),
    }, 3600); // 1 小時

    // TODO: 將任務加入 Cloud Tasks 佇列
    // await cloudTasks.createTask('processPoCorrection', { taskId });

    res.json({
      success: true,
      taskId,
      message: 'Your changes have been submitted. Processing will start shortly.',
    });
  } catch (error: any) {
    console.error('Error submitting PO correction:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit PO correction',
    });
  }
});

/**
 * GET /api/v1/po/corrections/:taskId/status
 * 查詢 PO 修正任務狀態
 */
router.get('/corrections/:taskId/status', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = await cacheService.get<any>(`task:${taskId}`);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }

    res.json({
      success: true,
      status: task.status,
      result: task.result,
    });
  } catch (error: any) {
    console.error('Error getting task status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get task status',
    });
  }
});

/**
 * 實際處理 PO 修正的核心邏輯
 * （對應原本的 _savePoCorrectionsCore）
 * 這個函數應該由 Cloud Tasks 觸發執行
 */
export async function processPoCorrection(taskId: string): Promise<void> {
  try {
    // 從快取取得任務資料
    const task = await cacheService.get<any>(`task:${taskId}`);
    if (!task) {
      throw new Error('Task not found');
    }

    const { poNumber, basicInfo, items } = task;

    // 讀取 PO Raw Data
    const poRecords = await sheetService.readAllRecords(PO_RAW_DATA_SHEET);

    // 尋找現有的 PO 記錄
    const existingRecords = poRecords.filter(
      (r: Row) => r['P/O'] === poNumber && r['Status'] === ''
    );

    if (existingRecords.length === 0) {
      throw new Error(`PO #${poNumber} not found or already processed`);
    }

    // 更新現有記錄狀態為 'Change'
    const templateRow = existingRecords[0];
    const updatedRecords = existingRecords.map((r: Row) => ({
      ...r,
      Status: 'Change',
      'Change Note': basicInfo.changeNote,
      Timestamp: new Date(),
    }));

    // 批次更新現有記錄
    await sheetService.writeBatch(PO_RAW_DATA_SHEET, updatedRecords);

    // 建立新記錄
    const newPoNumber = basicInfo.newPoNumber || poNumber;
    const poTotal = items.reduce(
      (sum: number, item: any) =>
        sum + (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0),
      0
    );

    const newRecords: Row[] = items.map((item: any) => ({
      'P/O Received Date': new Date(basicInfo.poReceivedDate),
      'Buyer Name': basicInfo.buyerName,
      RSM: basicInfo.rsm,
      'P/O': newPoNumber,
      'P/O - Total': poTotal,
      'Payment Term': basicInfo.paymentTerm,
      Company: basicInfo.company,
      'P/O Line Items': item.model,
      'P/O Unit Price': parseFloat(item.unitPrice),
      'P/O QTY': parseFloat(item.qty),
      'File URL': templateRow['File URL'],
      'Ship To Contact': basicInfo.contact,
      'Ship To Phone': basicInfo.phone,
      'Street Address': basicInfo.street,
      City: basicInfo.city,
      State: basicInfo.state,
      Zipcode: basicInfo.zipcode,
      'Change Note': basicInfo.changeNote,
      Timestamp: new Date(),
      SPIFF: basicInfo.spiff,
    }));

    // 批次寫入新記錄
    await sheetService.writeBatch(PO_RAW_DATA_SHEET, newRecords);

    // 更新任務狀態
    await cacheService.set(`task:${taskId}`, {
      ...task,
      status: 'completed',
      result: { success: true, newPoNumber },
      completedAt: new Date().toISOString(),
    }, 3600);
  } catch (error: any) {
    console.error('Error processing PO correction:', error);
    
    // 更新任務狀態為失敗
    const task = await cacheService.get<any>(`task:${taskId}`);
    if (task) {
      await cacheService.set(`task:${taskId}`, {
        ...task,
        status: 'failed',
        result: { success: false, message: error.message },
        completedAt: new Date().toISOString(),
      }, 3600);
    }
    
    throw error;
  }
}

export default router;

