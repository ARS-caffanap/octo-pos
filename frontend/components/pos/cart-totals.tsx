"use client";

// Right-rail summary card for the POS screen. Shows item count, subtotal,
// tax (at the hard-coded TAX_RATE), and the grand total. Pure presentation —
// the page does the math and passes in `totals`. We keep the math out of
// the component so it can be unit-tested independently later.

import { Receipt } from "lucide-react";

import { formatMoney, TAX_RATE, type CartTotals } from "@/lib/pos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type CartTotalsCardProps = {
  totals: CartTotals;
  canCheckout: boolean;
  isSubmitting: boolean;
  onCheckout: () => void;
  onClear: () => void;
};

export function CartTotalsCard({
  totals,
  canCheckout,
  isSubmitting,
  onCheckout,
  onClear,
}: CartTotalsCardProps) {
  const empty = totals.itemCount === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4" />
          Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Items</span>
          <span className="tabular-nums">{totals.itemCount}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Tax ({Math.round(TAX_RATE * 100)}%)
          </span>
          <span className="tabular-nums">{formatMoney(totals.tax)}</span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold">Total</span>
          <span className="text-2xl font-bold tabular-nums">
            {formatMoney(totals.total)}
          </span>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            size="lg"
            onClick={onCheckout}
            disabled={!canCheckout || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Processing…" : "Checkout"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClear}
            disabled={empty || isSubmitting}
            className="w-full"
          >
            Clear cart
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
