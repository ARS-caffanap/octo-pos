"use client";

import * as React from "react";
import { Check, Copy, Loader2, Printer, Receipt as ReceiptIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter as UiTableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type Receipt,
  formatCurrency,
  formatPrice,
  formatReceiptDateTime,
  lineSubtotal,
  paymentLabel,
  receiptToText,
} from "@/lib/receipt";
import { cn } from "@/lib/utils";

type ReceiptDisplayProps = {
  receipt: Receipt;
  /** Hide the toolbar (copy/print). Useful when the receipt is embedded in a
   *  print-only view. Defaults to false. */
  hideActions?: boolean;
  className?: string;
};

/**
 * Transaction receipt — pure presentational. Renders a shadcn Card with the
 * store header, items table, totals stack, and payment summary. The footer
 * hosts the Copy/Print actions (suppressed by @media print, see globals.css).
 *
 * Items are shown in a shadcn Table that mirrors a real receipt printer
 * layout: name on the left, qty/price/subtotal right-aligned. Totals are
 * stacked beneath the table with Separator dividers.
 */
export function ReceiptDisplay({
  receipt,
  hideActions = false,
  className,
}: ReceiptDisplayProps) {
  const [copyState, setCopyState] = React.useState<"idle" | "copying" | "done">(
    "idle",
  );

  // Reset the "copied" indicator so the icon swaps back to Copy after a beat.
  React.useEffect(() => {
    if (copyState !== "done") return;
    const t = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(t);
  }, [copyState]);

  const handleCopy = React.useCallback(async () => {
    const text = receiptToText(receipt);
    setCopyState("copying");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers / insecure contexts.
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopyState("done");
      toast.success("Receipt copied to clipboard");
    } catch (err) {
      setCopyState("idle");
      toast.error("Could not copy receipt", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, [receipt]);

  const handlePrint = React.useCallback(() => {
    // window.print() is intercepted by the @media print rules in globals.css
    // to hide the action toolbar and any surrounding navigation.
    window.print();
  }, []);

  const hasOrderDiscount =
    typeof receipt.discount === "number" && receipt.discount > 0;

  return (
    <Card
      className={cn(
        // `receipt-root` is the print-CSS hook: in @media print we tighten
        // padding, drop the shadow, and force the card onto its own page.
        "receipt-root mx-auto w-full max-w-md print:max-w-full print:shadow-none",
        className,
      )}
      aria-label={`Receipt ${receipt.transaction_number}`}
    >
      <CardHeader className="receipt-header text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary print:hidden">
          <ReceiptIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <CardTitle className="text-lg">
          {receipt.store_name ?? "OctoPOS"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {receipt.transaction_number}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatReceiptDateTime(receipt.created_at)}
        </p>
        {receipt.cashier_name ? (
          <p className="text-xs text-muted-foreground">
            Cashier: {receipt.cashier_name}
          </p>
        ) : null}
      </CardHeader>

      <Separator />

      <CardContent className="space-y-4 pt-4">
        <div className="receipt-items">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-full">Item</TableHead>
                <TableHead className="w-12 text-right">Qty</TableHead>
                <TableHead className="w-20 text-right">Price</TableHead>
                <TableHead className="w-24 text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipt.items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground"
                  >
                    No items on this receipt.
                  </TableCell>
                </TableRow>
              ) : (
                receipt.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(item.unit_price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPrice(lineSubtotal(item))}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <UiTableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right">
                  Subtotal
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(receipt.subtotal)}
                </TableCell>
              </TableRow>
            </UiTableFooter>
          </Table>
        </div>

        <Separator />

        <div className="receipt-totals space-y-2 text-sm">
          {hasOrderDiscount ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span className="tabular-nums">
                -{formatCurrency(receipt.discount)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="tabular-nums">{formatCurrency(receipt.tax)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-base font-semibold">
            <span>Total</span>
            <span className="tabular-nums">
              {formatCurrency(receipt.total)}
            </span>
          </div>
        </div>

        <Separator />

        <div className="receipt-payment space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Payment method</span>
            <span className="font-medium">
              {paymentLabel(receipt.payment_method)}
            </span>
          </div>
          {receipt.amount_paid != null ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Amount paid</span>
              <span className="tabular-nums">
                {formatCurrency(receipt.amount_paid)}
              </span>
            </div>
          ) : null}
          {receipt.change_due != null ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Change</span>
              <span className="tabular-nums">
                {formatCurrency(receipt.change_due)}
              </span>
            </div>
          ) : null}
        </div>

        {receipt.note ? (
          <>
            <Separator />
            <p className="text-center text-xs text-muted-foreground">
              {receipt.note}
            </p>
          </>
        ) : null}
      </CardContent>

      {!hideActions ? (
        <CardFooter className="receipt-actions flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={copyState === "copying"}
            aria-label="Copy receipt to clipboard"
          >
            {copyState === "copying" ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : copyState === "done" ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copyState === "done" ? "Copied" : "Copy"}
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handlePrint}
            aria-label="Print receipt"
          >
            <Printer aria-hidden="true" />
            Print
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
