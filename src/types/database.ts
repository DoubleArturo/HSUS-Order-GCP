export enum OrderSource {
  DEALER = 'DEALER',
  QUOTE = 'QUOTE',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  ALLOCATING = 'ALLOCATING',
  PARTIALLY_SHIPPED = 'PARTIALLY_SHIPPED',
  SHIPPED = 'SHIPPED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum InvoiceStatus {
  OPEN = 'OPEN',
  OVERDUE = 'OVERDUE',
  PAID = 'PAID',
}

export interface OrderItem {
  sku: string;
  qty: number;
  description?: string;
}

export interface ShipmentItem {
  sku: string;
  qty: number;
}

export interface Order {
  id: string;
  order_number: string;
  source: OrderSource;
  status: OrderStatus;
  customer_info: Record<string, unknown> | null;
  external_id: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  qbo_invoice_id: string;
  qbo_doc_number: string | null;
  estimate_id: string | null;
  amount: string;
  balance: string;
  due_date: string | null;
  status: InvoiceStatus;
  last_synced_at: string | null;
  created_at: string;
}

export interface Shipment {
  id: string;
  order_id: string;
  tracking_number: string | null;
  carrier: string | null;
  shipped_at: string;
  items: ShipmentItem[];
  created_at: string;
}
