// Receipt/transaction types and helpers. Mirrors the shape that the Golang
// backend will return from POST /api/transactions. Kept narrow on purpose —
// the receipt UI is a pure presentational component, so a stable contract
// lets us swap the live fetch for fixtures without touching the component.

export type PaymentMethod = "cash" | "card" | "qris" | "e_wallet" | "other";

export type ReceiptItem = {
  id: string;
  name: string;
  /** Unit price in the smallest currency unit (e.g. rupiah). */
  unit_price: number;
  quantity: number;
  /** Optional line-level discount in the smallest currency unit. */
  discount?: number;
};

export type Receipt = {
  /** Backend-issued transaction number, e.g. "TRX-20260624-0001". */
  transaction_number: string;
  /** ISO 8601 timestamp from the backend. */
  created_at: string;
  /** Human-readable store/tenant label rendered in the header. */
  store_name?: string;
  /** Cashier display name. */
  cashier_name?: string;
  items: ReceiptItem[];
  /** Subtotal in the smallest currency unit, before tax/discount. */
  subtotal: number;
  /** Order-level discount in the smallest currency unit. */
  discount?: number;
  /** Tax in the smallest currency unit. */
  tax: number;
  /** Grand total in the smallest currency unit. */
  total: number;
  /** Amount actually paid by the customer. */
  amount_paid?: number;
  /** Change returned. */
  change_due?: number;
  payment_method: PaymentMethod;
  /** Optional free-form note printed at the bottom. */
  note?: string;
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  qris: "QRIS",
  e_wallet: "E-Wallet",
  other: "Other",
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Format a smallest-unit integer as currency. */
export function formatCurrency(amount: number | undefined | null): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return currencyFormatter.format(amount / 100);
}

/** Like formatCurrency but drops trailing .00 — nice for unit prices. */
export function formatPrice(amount: number | undefined | null): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return compactCurrencyFormatter.format(amount / 100);
}

export function formatReceiptDateTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return dateTimeFormatter.format(d);
}

export function paymentLabel(method: PaymentMethod): string {
  return PAYMENT_LABELS[method] ?? method;
}

export function lineSubtotal(item: ReceiptItem): number {
  return item.unit_price * item.quantity - (item.discount ?? 0);
}

/** Plain-text rendering used by the copy-to-clipboard action. */
export function receiptToText(receipt: Receipt): string {
  const store = receipt.store_name ?? "OctoPOS";
  const lines: string[] = [];
  const push = (s = "") => lines.push(s);

  push(store);
  push("=".repeat(32));
  push(`Transaction: ${receipt.transaction_number}`);
  push(`Date:        ${formatReceiptDateTime(receipt.created_at)}`);
  if (receipt.cashier_name) push(`Cashier:     ${receipt.cashier_name}`);
  push("-".repeat(32));

  for (const item of receipt.items) {
    const qty = `x${item.quantity}`;
    const sub = formatPrice(lineSubtotal(item));
    push(item.name);
    push(`  ${formatPrice(item.unit_price)}  ${qty}  ${sub}`.padEnd(32));
  }

  push("-".repeat(32));
  push(`Subtotal: ${formatCurrency(receipt.subtotal)}`);
  if (receipt.discount) push(`Discount: -${formatCurrency(receipt.discount)}`);
  push(`Tax:      ${formatCurrency(receipt.tax)}`);
  push(`Total:    ${formatCurrency(receipt.total)}`);
  push(`Payment:  ${paymentLabel(receipt.payment_method)}`);
  if (receipt.amount_paid != null) {
    push(`Paid:     ${formatCurrency(receipt.amount_paid)}`);
  }
  if (receipt.change_due != null) {
    push(`Change:   ${formatCurrency(receipt.change_due)}`);
  }
  push("=".repeat(32));
  push("Thank you for your purchase!");
  if (receipt.note) push(receipt.note);

  return lines.join("\n");
}
