-- ENUM definitions (must come before tables)
CREATE TYPE order_source_enum AS ENUM ('DEALER', 'QUOTE');
CREATE TYPE order_status_enum AS ENUM ('DRAFT', 'CONFIRMED', 'ALLOCATING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'COMPLETED', 'CANCELLED');
CREATE TYPE invoice_status_enum AS ENUM ('OPEN', 'OVERDUE', 'PAID');

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Core tables
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE,
  source order_source_enum NOT NULL,
  status order_status_enum NOT NULL DEFAULT 'DRAFT',
  customer_info JSONB,
  external_id TEXT,
  items JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE invoices (
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

CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tracking_number TEXT,
  carrier TEXT,
  shipped_at TIMESTAMPTZ NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shipments_order_id ON shipments(order_id);

