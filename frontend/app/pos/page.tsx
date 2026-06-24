"use client";

// Main POS transaction screen (OCT-13).
//
// Layout: two-column on md+. Left column owns product search + cart table;
// right column is the sticky summary card with totals, checkout, and
// clear-cart actions. Below md the right column sits under the cart.
//
// State lives entirely in this page:
//  * `cart` — list of cart lines (CartLine[]) held in a useState. The cart
//    is intentionally ephemeral: it lives only for the duration of the
//    browser session. Persisting it across reloads is out of scope for
//    the MVP; the cashier can clear and restart the sale quickly.
//  * The mutation is fired via React Query; on success we clear the cart
//    and show a sonner toast; on error we keep the cart intact so the
//    cashier can retry.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";

import { type Product } from "@/lib/products";
import {
  addToCart,
  clearCart,
  computeCartTotals,
  createTransaction,
  MAX_QUANTITY,
  removeFromCart,
  setLineQuantity,
  type CartLine,
  type PaymentMethod,
  type Transaction,
} from "@/lib/pos";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CartTable } from "@/components/pos/cart-table";
import { CartTotalsCard } from "@/components/pos/cart-totals";
import { CheckoutDialog } from "@/components/pos/checkout-dialog";
import { ClearCartDialog } from "@/components/pos/clear-cart-dialog";
import { ProductSearch } from "@/components/pos/product-search";

export default function PosPage() {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  const totals = useMemo(() => computeCartTotals(cart), [cart]);

  const checkoutMutation = useMutation<Transaction, Error, PaymentMethod>({
    mutationFn: async (paymentMethod) => {
      const payload = {
        payment_method: paymentMethod,
        items: cart.map((line) => ({
          product_id: line.product.id,
          quantity: line.quantity,
          unit_price: line.product.price,
        })),
      };
      return createTransaction(payload);
    },
    onSuccess: (txn) => {
      // Keep the cart snapshot before clearing so we can show a useful toast.
      const itemCount = totals.itemCount;
      const total = totals.total;
      setCart(clearCart());
      setCheckoutOpen(false);
      // Invalidate the products query so a re-fetch on the next sale sees
      // fresh stock. The backend decrements stock atomically with the
      // transaction (OCT-9), so any cached data is now stale.
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Sale recorded", {
        description:
          itemCount > 0
            ? `${itemCount} item${itemCount === 1 ? "" : "s"} · total ${total.toFixed(2)}`
            : `Transaction #${txn.id} created.`,
      });
    },
    onError: (err) => {
      toast.error("Checkout failed", { description: err.message });
    },
  });

  const handleAdd = (product: Product) => {
    setCart((current) => addToCart(current, product, 1));
  };

  const handleUpdateQuantity = (productId: Product["id"], quantity: number) => {
    setCart((current) => {
      // Defensive clamp: if someone passes a value above MAX_QUANTITY
      // (e.g. through a bulk-edit input), pull it back into the allowed
      // range so the request body never includes an out-of-spec number.
      if (quantity > MAX_QUANTITY) {
        const line = current.find((l) => l.product.id === productId);
        const stockCap = line ? line.product.stock_quantity : MAX_QUANTITY;
        return setLineQuantity(current, productId, Math.min(stockCap, MAX_QUANTITY));
      }
      return setLineQuantity(current, productId, quantity);
    });
  };

  const handleRemove = (productId: Product["id"]) => {
    setCart((current) => removeFromCart(current, productId));
  };

  const handleClearConfirm = () => {
    setCart(clearCart());
    setClearOpen(false);
    toast.message("Cart cleared");
  };

  const handleCheckoutConfirm = ({
    paymentMethod,
  }: {
    paymentMethod: PaymentMethod;
  }) => {
    checkoutMutation.mutate(paymentMethod);
  };

  const isSubmitting = checkoutMutation.isPending;
  const canCheckout = cart.length > 0 && !isSubmitting;
  const errorMessage = checkoutMutation.error?.message ?? null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Point of Sale</h1>
          <p className="text-sm text-muted-foreground">
            Add products to the cart, then check out to record the sale.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" />
                Add to cart
              </CardTitle>
              <CardDescription>
                Search the product catalog. Out-of-stock items are shown but
                cannot be added.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProductSearch
                cart={cart}
                onAdd={handleAdd}
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cart</CardTitle>
              <CardDescription>
                {cart.length === 0
                  ? "No items yet."
                  : `${cart.length} line${cart.length === 1 ? "" : "s"} · ${totals.itemCount} unit${totals.itemCount === 1 ? "" : "s"}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CartTable
                cart={cart}
                onUpdateQuantity={handleUpdateQuantity}
                onRemove={handleRemove}
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>
        </div>

        <div className="md:sticky md:top-6 md:self-start">
          <CartTotalsCard
            totals={totals}
            canCheckout={canCheckout}
            isSubmitting={isSubmitting}
            onCheckout={() => setCheckoutOpen(true)}
            onClear={() => setClearOpen(true)}
          />
        </div>
      </div>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={(open) => {
          // Don't allow the user to dismiss the dialog mid-submit; the
          // mutation will close it on success.
          if (!isSubmitting) setCheckoutOpen(open);
        }}
        cart={cart}
        totals={totals}
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
        onConfirm={handleCheckoutConfirm}
      />

      <ClearCartDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        itemCount={cart.length}
        onConfirm={handleClearConfirm}
      />
    </main>
  );
}
