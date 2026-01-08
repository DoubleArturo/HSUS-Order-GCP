-- 正式環境資料庫架構 (Option A Schema)
-- 包含 Orders, Invoices, Shipments 三大核心表
-- 請直接在 Supabase SQL Editor 執行此腳本

-- 1. ENUM 定義 (使用 DO block 避免重複建立錯誤)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_source_enum') THEN
        CREATE TYPE order_source_enum AS ENUM ('DEALER', 'QUOTE');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status_enum') THEN
        CREATE TYPE order_status_enum AS ENUM ('DRAFT', 'CONFIRMED', 'ALLOCATING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'COMPLETED', 'CANCELLED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status_enum') THEN
        CREATE TYPE invoice_status_enum AS ENUM ('OPEN', 'OVERDUE', 'PAID');
    END IF;
END $$;

-- 2. 擴充功能 (用於生成 UUID)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. 核心資料表：訂單 (Orders)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE,          -- 對應舊系統的 Key (PO|SKU)
  source order_source_enum NOT NULL,
  status order_status_enum NOT NULL DEFAULT 'DRAFT', -- 對應舊系統的 Status
  customer_info JSONB,
  external_id TEXT,
  items JSONB NOT NULL DEFAULT '[]'::JSONB,   -- 訂單項目
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- 對應舊系統的 Timestamp
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 核心資料表：發票 (Invoices)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  qbo_invoice_id TEXT NOT NULL UNIQUE,
  qbo_doc_number TEXT,
  estimate_id UUID REFERENCES orders(id),
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_date DATE,
  status invoice_status_enum NOT NULL DEFAULT 'OPEN',
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 核心資料表：出貨單 (Shipments)
-- 這張表將取代舊有的 BOL_DB
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE, -- 關聯回訂單
  tracking_number TEXT,                       -- 對應 BOL Number
  carrier TEXT,
  shipped_at TIMESTAMPTZ NOT NULL,            -- 對應 ActShipDate
  items JSONB NOT NULL,                       -- 出貨內容 (包含 Qty)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);