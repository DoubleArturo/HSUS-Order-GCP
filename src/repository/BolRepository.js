/**
 * BOL Repository
 * 處理所有與 BOL Shipments 相關的資料庫操作
 * 重點：使用 SQL Transaction 確保資料一致性
 */

const { query, getPool } = require('../config/database');

class BolRepository {
  /**
   * 搜尋訂單（支援模糊搜尋）
   * @param {string} searchTerm - 搜尋關鍵字（PO Number 或 Buyer Name）
   * @param {number} limit - 回傳筆數限制
   * @param {number} offset - 分頁偏移
   * @returns {Promise<Array>} 訂單列表
   */
  async searchPurchaseOrders(searchTerm = '', limit = 50, offset = 0) {
    const searchPattern = `%${searchTerm}%`;
    
    const sql = `
      SELECT 
        id,
        po_number,
        buyer_name,
        status,
        created_at,
        updated_at
      FROM purchase_orders
      WHERE 
        ($1::text IS NULL OR $1::text = '' OR 
         po_number ILIKE $1 OR 
         buyer_name ILIKE $1)
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await query(sql, [searchPattern, limit, offset]);
    return result.rows;
  }

  /**
   * 根據 PO ID 取得訂單資訊
   * @param {string} poId - Purchase Order UUID
   * @returns {Promise<Object|null>} 訂單物件或 null
   */
  async getPurchaseOrderById(poId) {
    const sql = `
      SELECT 
        id,
        po_number,
        buyer_name,
        status,
        created_at,
        updated_at
      FROM purchase_orders
      WHERE id = $1
    `;

    const result = await query(sql, [poId]);
    return result.rows[0] || null;
  }

  /**
   * 取得某張 PO 的所有 BOL 出貨紀錄
   * @param {string} poId - Purchase Order UUID
   * @returns {Promise<Array>} BOL 出貨紀錄列表
   */
  async getBolsByPoId(poId) {
    const sql = `
      SELECT 
        bs.id,
        bs.bol_number,
        bs.sku,
        bs.shipped_qty,
        bs.memo,
        bs.created_at,
        po.po_number,
        po.buyer_name
      FROM bol_shipments bs
      INNER JOIN purchase_orders po ON bs.po_id = po.id
      WHERE bs.po_id = $1
      ORDER BY bs.created_at DESC
    `;

    const result = await query(sql, [poId]);
    return result.rows;
  }

  /**
   * 根據 BOL Number 取得出貨紀錄
   * @param {string} bolNumber - BOL 號碼
   * @returns {Promise<Array>} BOL 出貨紀錄列表
   */
  async getBolsByBolNumber(bolNumber) {
    const sql = `
      SELECT 
        bs.id,
        bs.bol_number,
        bs.sku,
        bs.shipped_qty,
        bs.memo,
        bs.created_at,
        po.po_number,
        po.buyer_name
      FROM bol_shipments bs
      INNER JOIN purchase_orders po ON bs.po_id = po.id
      WHERE bs.bol_number = $1
      ORDER BY bs.created_at DESC
    `;

    const result = await query(sql, [bolNumber]);
    return result.rows;
  }

  /**
   * 核心功能：批次建立 BOL 出貨紀錄（使用 Transaction）
   * 
   * 這是整個 Repository 最重要的方法，展示如何正確處理 Transaction：
   * 1. 開始 Transaction
   * 2. 驗證 PO 是否存在
   * 3. 批次插入 items
   * 4. 如果任何步驟失敗，自動 Rollback
   * 5. 成功則 Commit
   * 
   * @param {string} poId - Purchase Order UUID
   * @param {string} bolNumber - BOL 號碼
   * @param {Array<Object>} items - 出貨明細陣列 [{sku: string, qty: number, memo?: string}]
   * @returns {Promise<Object>} 建立結果 { success: boolean, insertedCount: number, ids: string[] }
   */
  async createBolsWithTransaction(poId, bolNumber, items) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      // ===== 步驟 1: 開始 Transaction =====
      await client.query('BEGIN');

      // ===== 步驟 2: 驗證 PO 是否存在 =====
      const poCheckResult = await client.query(
        'SELECT id FROM purchase_orders WHERE id = $1',
        [poId]
      );

      if (poCheckResult.rows.length === 0) {
        throw new Error(`Purchase Order with id ${poId} not found`);
      }

      // ===== 步驟 3: 驗證輸入資料 =====
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Items array is required and must not be empty');
      }

      // 驗證每個 item 的格式
      for (const item of items) {
        if (!item.sku || typeof item.sku !== 'string') {
          throw new Error('Each item must have a valid SKU (string)');
        }
        if (typeof item.qty !== 'number' || item.qty <= 0) {
          throw new Error('Each item must have a valid qty (positive number)');
        }
      }

      // ===== 步驟 4: 批次插入 BOL Shipments =====
      // 使用 VALUES 子句批次插入，比逐筆 INSERT 更高效
      // 每個 item 需要 5 個參數：po_id, bol_number, sku, shipped_qty, memo
      
      const allParams = [];
      const valuePlaceholders = [];

      items.forEach((item, index) => {
        const baseIndex = index * 5; // 每個 item 佔用 5 個參數位置
        valuePlaceholders.push(
          `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`
        );
        
        // 依序加入參數：po_id, bol_number, sku, shipped_qty, memo
        allParams.push(
          poId,
          bolNumber,
          item.sku,
          item.qty || 0,
          item.memo || null
        );
      });

      const insertSql = `
        INSERT INTO bol_shipments (po_id, bol_number, sku, shipped_qty, memo)
        VALUES ${valuePlaceholders.join(', ')}
        RETURNING id, bol_number, sku, shipped_qty, memo, created_at
      `;

      const insertResult = await client.query(insertSql, allParams);

      // ===== 步驟 5: 更新 PO 的 updated_at 時間戳 =====
      await client.query(
        'UPDATE purchase_orders SET updated_at = NOW() WHERE id = $1',
        [poId]
      );

      // ===== 步驟 6: Commit Transaction =====
      await client.query('COMMIT');

      return {
        success: true,
        insertedCount: insertResult.rows.length,
        ids: insertResult.rows.map(row => row.id),
        records: insertResult.rows,
      };

    } catch (error) {
      // ===== 錯誤處理：自動 Rollback =====
      await client.query('ROLLBACK');
      console.error('Transaction failed, rolled back:', error);
      throw error;
    } finally {
      // ===== 釋放連線 =====
      client.release();
    }
  }

  /**
   * 刪除單筆 BOL 出貨紀錄
   * @param {string} bolId - BOL Shipment UUID
   * @returns {Promise<boolean>} 是否成功刪除
   */
  async deleteBolById(bolId) {
    const sql = `
      DELETE FROM bol_shipments
      WHERE id = $1
      RETURNING id
    `;

    const result = await query(sql, [bolId]);
    return result.rows.length > 0;
  }

  /**
   * 根據 BOL Number 刪除所有相關紀錄（使用 Transaction）
   * @param {string} bolNumber - BOL 號碼
   * @returns {Promise<number>} 刪除的筆數
   */
  async deleteBolsByBolNumber(bolNumber) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        'DELETE FROM bol_shipments WHERE bol_number = $1 RETURNING id',
        [bolNumber]
      );

      await client.query('COMMIT');

      return result.rows.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 更新單筆 BOL 出貨紀錄
   * @param {string} bolId - BOL Shipment UUID
   * @param {Object} updates - 要更新的欄位 {sku?, shipped_qty?, memo?}
   * @returns {Promise<Object|null>} 更新後的紀錄或 null
   */
  async updateBolById(bolId, updates) {
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.sku !== undefined) {
        fields.push(`sku = $${paramIndex++}`);
        values.push(updates.sku);
      }
      if (updates.shipped_qty !== undefined) {
        fields.push(`shipped_qty = $${paramIndex++}`);
        values.push(updates.shipped_qty);
      }
      if (updates.memo !== undefined) {
        fields.push(`memo = $${paramIndex++}`);
        values.push(updates.memo);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(bolId);
      const sql = `
        UPDATE bol_shipments
        SET ${fields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING id, po_id, bol_number, sku, shipped_qty, memo, created_at
      `;

      const result = await client.query(sql, values);

      await client.query('COMMIT');

      return result.rows[0] || null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 取得 BOL 統計資訊（依 PO 分組）
   * @param {string} poId - Purchase Order UUID（可選）
   * @returns {Promise<Array>} 統計資料
   */
  async getBolStatistics(poId = null) {
    let sql = `
      SELECT 
        po.id as po_id,
        po.po_number,
        COUNT(bs.id) as total_shipments,
        SUM(bs.shipped_qty) as total_shipped_qty,
        COUNT(DISTINCT bs.bol_number) as unique_bol_count
      FROM purchase_orders po
      LEFT JOIN bol_shipments bs ON po.id = bs.po_id
    `;

    const params = [];
    if (poId) {
      sql += ' WHERE po.id = $1';
      params.push(poId);
    }

    sql += ' GROUP BY po.id, po.po_number ORDER BY po.po_number';

    const result = await query(sql, params);
    return result.rows;
  }
}

module.exports = new BolRepository();

