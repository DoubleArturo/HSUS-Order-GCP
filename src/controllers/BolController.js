/**
 * BOL Controller
 * 處理 HTTP 請求與回應
 * 負責參數驗證、錯誤處理、回應格式化
 */

const bolRepository = require('../repository/BolRepository');

class BolController {
  /**
   * GET /api/pos
   * 搜尋訂單（支援模糊搜尋）
   */
  async searchPurchaseOrders(req, res) {
    try {
      const { search, limit = 50, offset = 0 } = req.query;

      const orders = await bolRepository.searchPurchaseOrders(
        search || '',
        parseInt(limit, 10),
        parseInt(offset, 10)
      );

      res.json({
        success: true,
        data: orders,
        count: orders.length,
      });
    } catch (error) {
      console.error('Error searching purchase orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search purchase orders',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  /**
   * GET /api/pos/:po_id/bols
   * 取得某張 PO 的所有 BOL 出貨紀錄
   */
  async getBolsByPoId(req, res) {
    try {
      const { po_id } = req.params;

      // 驗證 UUID 格式
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(po_id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid PO ID format',
        });
      }

      // 先檢查 PO 是否存在
      const po = await bolRepository.getPurchaseOrderById(po_id);
      if (!po) {
        return res.status(404).json({
          success: false,
          message: 'Purchase Order not found',
        });
      }

      const bols = await bolRepository.getBolsByPoId(po_id);

      res.json({
        success: true,
        data: {
          purchase_order: po,
          shipments: bols,
          count: bols.length,
        },
      });
    } catch (error) {
      console.error('Error getting BOLs by PO ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get BOL shipments',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  /**
   * POST /api/bols
   * 核心功能：批次建立 BOL 出貨紀錄
   * 請求格式：{ po_id: string, bol_number: string, items: [{sku: string, qty: number, memo?: string}] }
   */
  async createBols(req, res) {
    try {
      const { po_id, bol_number, items } = req.body;

      // ===== 參數驗證 =====
      if (!po_id) {
        return res.status(400).json({
          success: false,
          message: 'po_id is required',
        });
      }

      if (!bol_number || typeof bol_number !== 'string' || bol_number.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'bol_number is required and must be a non-empty string',
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'items is required and must be a non-empty array',
        });
      }

      // 驗證每個 item
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.sku || typeof item.sku !== 'string') {
          return res.status(400).json({
            success: false,
            message: `items[${i}].sku is required and must be a string`,
          });
        }
        if (typeof item.qty !== 'number' || item.qty <= 0) {
          return res.status(400).json({
            success: false,
            message: `items[${i}].qty is required and must be a positive number`,
          });
        }
      }

      // ===== 驗證 UUID 格式 =====
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(po_id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid PO ID format',
        });
      }

      // ===== 呼叫 Repository（使用 Transaction） =====
      const result = await bolRepository.createBolsWithTransaction(
        po_id,
        bol_number.trim(),
        items.map(item => ({
          sku: item.sku.trim(),
          qty: parseInt(item.qty, 10),
          memo: item.memo ? item.memo.trim() : null,
        }))
      );

      res.status(201).json({
        success: true,
        message: `Successfully created ${result.insertedCount} BOL shipment(s)`,
        data: result,
      });
    } catch (error) {
      console.error('Error creating BOLs:', error);

      // 處理已知錯誤
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      // 處理資料庫約束錯誤
      if (error.code === '23503') { // Foreign key violation
        return res.status(400).json({
          success: false,
          message: 'Invalid PO ID or reference constraint violation',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create BOL shipments',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  /**
   * DELETE /api/bols/:id
   * 刪除單筆 BOL 出貨紀錄
   */
  async deleteBol(req, res) {
    try {
      const { id } = req.params;

      // 驗證 UUID 格式
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid BOL ID format',
        });
      }

      const deleted = await bolRepository.deleteBolById(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'BOL shipment not found',
        });
      }

      res.json({
        success: true,
        message: 'BOL shipment deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting BOL:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete BOL shipment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }

  /**
   * GET /api/bols/statistics
   * 取得 BOL 統計資訊（可選：依 PO 篩選）
   */
  async getStatistics(req, res) {
    try {
      const { po_id } = req.query;

      const statistics = await bolRepository.getBolStatistics(po_id || null);

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error('Error getting statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
}

module.exports = new BolController();

