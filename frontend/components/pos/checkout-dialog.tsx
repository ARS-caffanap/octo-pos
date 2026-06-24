"use client";

// Checkout confirmation dialog for the POS screen. Owns the payment-method
// selection and the optional cash-tendered input. Calls the parent's
// `onConfirm` with the chosen method, which the page wires to the
// `createTransaction` mutation.
//
// Why the dialog owns the form (and not the page):
//  * The dialog is only relevant while it's open. We don't want the
//    selected payment method to leak into the page state and then
//    survive after a sale completes.
//  * Local state keeps the form reset path trivial: when the dialog
//    closes, all input goes away.
//
// Cash flow:
//  * If the cashier selects "Cash" we render an amount-tendered input
//    and a small "Change due" line. The server doesn't need the tendered
//    amount (it only stores `payment_method`); this is purely UX so the
//    cashier can tell the customer their change.

import { useEffect, useState } from "react";
import { CreditCard, Loader2, Wallet } from "lucide-react";

import {
  formatMoney,
  paymentMethodLabel,
  type CartLine,
  type CartTotals,
  type PaymentMethod,
} from "@/lib/pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";

type CheckoutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartLine[];
  totals: CartTotals;
  isSubmitting: boolean;
  errorMessage: string | null;
  onConfirm: (input: { paymentMethod: PaymentMethod }) => void;
};

export function CheckoutDialog({
  open,
  onOpenChange,
  cart,
  totals,
  isSubmitting,
  errorMessage,
  onConfirm,
}: CheckoutDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    "cash",
  );
  const [tenderedRaw, setTenderedRaw] = useState("");

  // Reset form state when the dialog re-opens so a previous attempt's
  // typed values don't bleed into the next sale.
  useEffect(() => {
    if (open) {
      setPaymentMethod("cash");
      setTenderedRaw("");
    }
  }, [open]);

  const tendered = (() => {
    const n = Number.parseFloat(tenderedRaw);
    return Number.isFinite(n) && n >= 0 ? n : null;
  })();
  const change = tendered !== null ? Math.max(0, tendered - totals.total) : null;
  const insufficientCash =
    paymentMethod === "cash" &&
    tendered !== null &&
    tendered < totals.total;

  const canSubmit =
    cart.length > 0 &&
    !isSubmitting &&
    (paymentMethod !== "cash" ||
      (tendered !== null && tendered >= totals.total));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Complete sale</DialogTitle>
          <DialogDescription>
            Confirm the cart and choose a payment method to record the
            transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Items</span>
              <span className="tabular-nums">{totals.itemCount}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">
                {formatMoney(totals.subtotal)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {formatMoney(totals.total)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Payment method</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="grid grid-cols-2 gap-2"
            >
              <Label
                htmlFor="pm-cash"
                className="flex cursor-pointer items-center gap-2 rounded-md border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value={"cash"} id="pm-cash" />
                <Wallet className="h-4 w-4" />
                <span>Cash</span>
              </Label>
              <Label
                htmlFor="pm-card"
                className="flex cursor-pointer items-center gap-2 rounded-md border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value={"card"} id="pm-card" />
                <CreditCard className="h-4 w-4" />
                <span>Card</span>
              </Label>
            </RadioGroup>
          </div>

          {paymentMethod === "cash" ? (
            <div className="space-y-2">
              <Label htmlFor="tendered">Amount tendered</Label>
              <Input
                id="tendered"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder={formatMoney(totals.total).replace(/[^\d.,]/g, "")}
                value={tenderedRaw}
                onChange={(e) => setTenderedRaw(e.target.value)}
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Change due</span>
                <span
                  className={
                    insufficientCash
                      ? "font-semibold text-destructive tabular-nums"
                      : "tabular-nums"
                  }
                >
                  {change !== null ? formatMoney(change) : "—"}
                </span>
              </div>
              {insufficientCash ? (
                <p className="text-xs text-destructive">
                  Tendered amount is less than the total.
                </p>
              ) : null}
            </div>
          ) : null}

          {errorMessage ? (
            <>
              <Separator />
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            </>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm({ paymentMethod })}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                Charge {formatMoney(totals.total)} · {paymentMethodLabel(paymentMethod)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
