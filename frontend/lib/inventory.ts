// Domain types for the inventory dashboard. These mirror the API contract
// described in OCT-16 (and the parent PRD) and are intentionally permissive
// on optional fields — different backend tickets (OCT-6, OCT-8) may evolve
// the shape slightly, and the dashboard should still render.

export type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  category?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProductsResponse = {
  data: Product[];
  // some endpoints return a bare array — accept both shapes
  total?: number;
  page?: number;
  page_size?: number;
};

export type MovementType = "sale" | "adjustment" | "restock" | string;

export type InventoryMovement = {
  id: string;
  product_id: string;
  product_name?: string;
  movement_type: MovementType;
  quantity_change: number;
  user_id?: string;
  created_by?: string;
  created_at: string;
};

export type MovementsResponse = {
  data: InventoryMovement[];
  total?: number;
};

export type InventorySummary = {
  total_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
};
