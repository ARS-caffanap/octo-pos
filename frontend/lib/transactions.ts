// Domain types for the transaction history page. Mirrors the OCT-15 spec
// and the parent PRD (transactions + transaction_items tables).
//
// The backend may evolve field names slightly between tickets (OCT-7 vs
// the not-yet-merged OCT-14 work), so types are intentionally permissive
// on optional fields and accept either a `{ data, total, ... }` envelope
// or a bare array.

export type PaymentMethod = "cash" | "card" | string;

export type TransactionStatus = "completed" | "voided" | "refunded" | string;

export type TransactionItem = {
  id?: string;
  product_id?: string;
  product_name?: string;
  name?: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
};

export type Transaction = {
  id: string;
  transaction_number: string;
  total_amount: number;
  subtotal?: number;
  tax_amount?: number;
  payment_method: PaymentMethod;
  status: TransactionStatus;
  user_id?: string;
  created_by?: string;
  created_at: string;
  items?: TransactionItem[];
};

export type TransactionsResponse = {
  data: Transaction[];
  // some endpoints return a bare array — accept both shapes
  total?: number;
  page?: number;
  page_size?: number;
};

export type TransactionFilters = {
  from?: string;
  to?: string;
  payment_method?: PaymentMethod | "all";
  q?: string;
  page?: number;
  page_size?: number;
};
