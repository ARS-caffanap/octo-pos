// POS-specific types, cart math, and checkout fetchers (OCT-13).
//
// The shared transaction *types* live in `@/lib/transactions` (introduced
// by OCT-15 for the history page). This file owns the POS-only shapes
// and behaviour:
//  * The `CartLine` working set that the cashier builds up before
//    checkout (ephemeral client state).
//  * Pure cart mutators and totals math.
//  * The `createTransaction` POST against the backend.
//
// We intentionally do NOT redeclare `PaymentMethod`, `Transaction`, or
// `TransactionItem` here — those belong to the shared module so the
// history page and the POS stay in sync. The POS-local `Transaction`
// shape we use is just a wide form of the shared one plus a few
// POS-specific bookkeeping fields; the history page can render it
// without any conversion.

import { z } from "zod"

import { api } from "@/lib/api"
import { PRODUCT_STATUS, type Product } from "@/lib/products"
import type {
  PaymentMethod,
  Transaction,
  TransactionItem,
} from "@/lib/transactions"

// --- constants --------------------------------------------------------------

/** Tax rate applied to cart subtotal. 0.1 == 10%. */
export const TAX_RATE = 0.1

/** Minimum quantity that can be added to the cart. */
export const MIN_QUANTITY = 1

/** Soft cap on a single line quantity — anything higher is almost certainly
 *  a typo. The backend can still reject the sale if it exceeds stock. */
export const MAX_QUANTITY = 9999

// --- cart line --------------------------------------------------------------
// A cart line is a local construct. It carries just enough product info to
// render the cart without re-fetching the catalog on every render. The
// `product` reference is held so the checkout submission can include the
// unit price snapshot (the spec says "unit_price = item.price at sale time")
// and the name/SKU can survive any later catalog edits.

export type CartLine = {
  product: Product
  quantity: number
}

// --- cart math --------------------------------------------------------------
// All monetary values are plain JS numbers in major units (e.g. 12.50 USD).
// We do not use BigInt or cents-integers because the spec already rounds at
// the display layer via Intl.NumberFormat; the backend records canonical
// numbers. If the spec ever changes to integer cents, swap these for a
// dedicated money type.

export type CartTotals = {
  subtotal: number
  tax: number
  total: number
  itemCount: number
}

/**
 * Compute subtotal, tax, and total for a cart. Empty cart -> all zeros.
 *
 * Rounding note: we keep the unrounded subtotal internally so the totals
 * stay internally consistent (subtotal + tax === total) even when tax would
 * otherwise introduce a half-cent. The display layer rounds at render time.
 */
export function computeCartTotals(cart: CartLine[]): CartTotals {
  let subtotal = 0;
  let itemCount = 0;
  for (const line of cart) {
    const qty = Math.max(0, line.quantity | 0);
    const price = Number.isFinite(line.product.price) ? line.product.price : 0;
    subtotal += price * qty;
    itemCount += qty;
  }
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;
  return { subtotal, tax, total, itemCount };
}

/** Render a money value with currency formatting. Returns "—" for NaN. */
export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// --- cart mutators (pure) ---------------------------------------------------
// These return a new array; the page-level state setter swaps the reference.

/** Add (or merge) a product into the cart. Out-of-stock and inactive items
 *  are skipped — the caller should not pass them in the first place, but
 *  defending here is cheap and prevents a stale dropdown from sneaking a
 *  bad row in. */
export function addToCart(cart: CartLine[], product: Product, qty = 1): CartLine[] {
  if (!product || product.stock_quantity <= 0) return cart;
  if (product.status && product.status !== PRODUCT_STATUS.ACTIVE) return cart;
  const safeQty = clampQuantity(qty);

  const idx = cart.findIndex((l) => l.product.id === product.id);
  if (idx === -1) {
    return [...cart, { product, quantity: safeQty }];
  }
  const next = cart.slice();
  const merged: CartLine = {
    product: next[idx].product,
    quantity: clampQuantity(next[idx].quantity + safeQty),
  };
  next[idx] = merged;
  return next;
}

export function setLineQuantity(
  cart: CartLine[],
  productId: Product["id"],
  quantity: number,
): CartLine[] {
  if (quantity <= 0) return removeFromCart(cart, productId);
  const safeQty = clampQuantity(quantity);
  return cart.map((line) =>
    line.product.id === productId ? { ...line, quantity: safeQty } : line
  );
}

export function removeFromCart(
  cart: CartLine[],
  productId: Product["id"],
): CartLine[] {
  return cart.filter((line) => line.product.id !== productId);
}

export function clearCart(): CartLine[] {
  return [];
}

function clampQuantity(q: number): number {
  if (!Number.isFinite(q)) return MIN_QUANTITY;
  const rounded = Math.trunc(q);
  if (rounded < MIN_QUANTITY) return MIN_QUANTITY;
  if (rounded > MAX_QUANTITY) return MAX_QUANTITY;
  return rounded;
}

// --- fetchers ---------------------------------------------------------------

export type CreateTransactionInput = {
  items: { product_id: number | string; quantity: number; unit_price: number }[];
  payment_method: PaymentMethod;
};

/** POST /api/transactions — server computes subtotal/tax/total atomically,
 *  decrements stock, and creates inventory movements. We still send
 *  unit_price so the server has a price snapshot to record in
 *  transaction_items (matches the OCT-7 spec). */
export async function createTransaction(
  input: CreateTransactionInput,
): Promise<Transaction> {
  return api<Transaction>("/api/transactions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// --- zod schemas ------------------------------------------------------------

export const paymentMethodSchema = z.enum(["cash", "card"]);

/** Shape of the cart line in the checkout submission. Kept as a schema so a
 *  future "send-cart-to-server" workflow can reuse the same validation. */
export const cartLineSubmissionSchema = z.object({
  product_id: z.union([z.string(), z.number()]),
  quantity: z.number().int().min(MIN_QUANTITY).max(MAX_QUANTITY),
  unit_price: z.number().nonnegative(),
});

export const checkoutSchema = z.object({
  payment_method: paymentMethodSchema,
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;

// --- helpers ----------------------------------------------------------------

/** Re-export the shared PaymentMethod so POS components can keep a single
 *  import site. (Type-only re-export, so no runtime cost.) */
export type { PaymentMethod };

/** Friendly label for a payment method. */
export function paymentMethodLabel(method: PaymentMethod | string): string {
  switch (method) {
    case "cash":
      return "Cash";
    case "card":
      return "Card";
    default:
      // unknown value from server — fall back to a capitalized form
      return typeof method === "string" && method.length > 0
        ? method.charAt(0).toUpperCase() + method.slice(1)
        : "Unknown";
  }
}

/** A subset of the shared Transaction type narrowed to the cart
 *  submission fields. Re-exported here so component imports stay
 *  stable if the shared Transaction shape evolves. */
export type { Transaction, TransactionItem };
