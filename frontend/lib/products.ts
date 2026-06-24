// Domain types + API helpers + zod schemas for the Products feature (OCT-12).
//
// The backend exposes /api/products (GET, POST) and /api/products/{id}
// (GET, PUT, DELETE) with tenant-isolated auth. See OCT-6. The frontend
// mirrors the wire shape exactly so JSON.parse -> render is lossless.

import { z } from "zod";

import { api } from "@/lib/api";

// --- types ------------------------------------------------------------------

export const PRODUCT_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type ProductStatus = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

export type Product = {
  id: number;
  tenant_id?: string;
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  category?: string;
  status: ProductStatus | string;
  created_at?: string;
  updated_at?: string;
};

export type ProductListResponse = {
  data: Product[];
  total: number;
  limit: number;
  offset: number;
};

// --- query keys -------------------------------------------------------------
// Centralized so invalidation / refetch logic never diverges between pages.

export const productKeys = {
  all: ["products"] as const,
  list: (params: ListProductsParams) =>
    [...productKeys.all, "list", params] as const,
  detail: (id: number) =>
    [...productKeys.all, "detail", id] as const,
};

// --- list params ------------------------------------------------------------

export type ListProductsParams = {
  limit: number;
  offset: number;
  category?: string;
  status?: string;
};

// --- fetchers ---------------------------------------------------------------

export async function fetchProducts(
  params: ListProductsParams,
): Promise<ProductListResponse> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit));
  qs.set("offset", String(params.offset));
  if (params.category && params.category !== "all")
    qs.set("category", params.category);
  if (params.status && params.status !== "all")
    qs.set("status", params.status);

  return api<ProductListResponse>(`/api/products?${qs.toString()}`);
}

export async function fetchProduct(id: number): Promise<Product> {
  return api<Product>(`/api/products/${id}`);
}

export type CreateProductInput = {
  name: string;
  sku: string;
  price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  category?: string;
  status: ProductStatus;
};

export type UpdateProductInput = Partial<CreateProductInput>;

export async function createProduct(
  input: CreateProductInput,
): Promise<Product> {
  return api<Product>("/api/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateProduct(
  id: number,
  input: UpdateProductInput,
): Promise<Product> {
  return api<Product>(`/api/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteProduct(id: number): Promise<void> {
  await api<{ message: string }>(`/api/products/${id}`, {
    method: "DELETE",
  });
}

// --- zod schemas ------------------------------------------------------------
// Mirrors the backend validator tags (required / min / max / gte / oneof).
// The server still re-validates; this is just for fast client feedback.

const statusEnum = z.enum([PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.INACTIVE]);

const numberFromString = (opts: {
  required: boolean;
  integer?: boolean;
  min?: number;
  label: string;
}) =>
  z
    .union([z.string(), z.number()])
    .transform((v, ctx) => {
      if (v === "" || v === undefined || v === null) {
        if (opts.required) {
          ctx.addIssue({
            code: "custom",
            message: `${opts.label} is required`,
          });
          return z.NEVER;
        }
        return undefined as unknown as number;
      }
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isNaN(n)) {
        ctx.addIssue({ code: "custom", message: `${opts.label} must be a number` });
        return z.NEVER;
      }
      if (opts.integer && !Number.isInteger(n)) {
        ctx.addIssue({ code: "custom", message: `${opts.label} must be a whole number` });
        return z.NEVER;
      }
      return n;
    })
    .pipe(
      z
        .number()
        .refine((n) => (opts.min === undefined ? true : n >= opts.min!), {
          message: opts.min === 0 ? `${opts.label} cannot be negative` : `${opts.label} must be ≥ ${opts.min}`,
        }),
    );

const requiredString = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

export const createProductSchema = z.object({
  name: requiredString("Name", 255),
  sku: requiredString("SKU", 100),
  price: numberFromString({ required: true, min: 0, label: "Price" }),
  stock_quantity: numberFromString({ required: true, integer: true, min: 0, label: "Stock quantity" }),
  low_stock_threshold: numberFromString({ required: true, integer: true, min: 0, label: "Low stock threshold" }),
  category: z
    .string()
    .trim()
    .max(100, "Category must be at most 100 characters")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  status: statusEnum,
});

export type CreateProductFormValues = z.infer<typeof createProductSchema>;

// For edit, every field becomes optional (PATCH semantics). The backend
// accepts a partial body and we mirror that so submitting an unchanged
// product still works.
export const updateProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(255, "Name must be at most 255 characters")
    .optional()
    .or(z.literal("")),
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(100, "SKU must be at most 100 characters")
    .optional()
    .or(z.literal("")),
  price: numberFromString({ required: false, min: 0, label: "Price" }).optional(),
  stock_quantity: numberFromString({ required: false, integer: true, min: 0, label: "Stock quantity" }).optional(),
  low_stock_threshold: numberFromString({ required: false, integer: true, min: 0, label: "Low stock threshold" }).optional(),
  category: z
    .string()
    .trim()
    .max(100, "Category must be at most 100 characters")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  status: statusEnum.optional(),
});

export type UpdateProductFormValues = z.infer<typeof updateProductSchema>;

// --- helpers ----------------------------------------------------------------

export function isLowStock(p: Product): boolean {
  return p.stock_quantity <= p.low_stock_threshold;
}

export function isOutOfStock(p: Product): boolean {
  return p.stock_quantity <= 0;
}

export function formatPrice(value: number): string {
  if (Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export function totalPages(total: number, limit: number): number {
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / limit));
}
