"use client";

// Cart line table for the POS screen. Pure presentation — the page owns
// the cart array and the mutators; this component is responsible for
// rendering rows, handling +/- buttons, and surfacing stock warnings so
// the cashier can see at a glance why a line is capped.
//
// Stock semantics:
//  * If the cashier tries to push quantity past `stock_quantity`, we
//    show a small "stock X" pill and disable the + button at the cap.
//  * We do NOT silently clamp user-typed numbers in the input — the
//    input commits on blur so the cashier sees what they typed and we
//    re-validate. The + button is the safe path.

import { Minus, Plus, Trash2 } from "lucide-react";

import {
  formatPrice,
  isLowStock,
  type Product,
} from "@/lib/products";
import { formatMoney, MIN_QUANTITY, type CartLine } from "@/lib/pos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CartTableProps = {
  cart: CartLine[];
  onUpdateQuantity: (productId: Product["id"], quantity: number) => void;
  onRemove: (productId: Product["id"]) => void;
  /** Disable every interactive control (e.g. while submitting). */
  disabled?: boolean;
};

export function CartTable({
  cart,
  onUpdateQuantity,
  onRemove,
  disabled = false,
}: CartTableProps) {
  if (cart.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
        Cart is empty. Use the search above to add products.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[44%]">Item</TableHead>
            <TableHead className="w-[24%] text-center">Quantity</TableHead>
            <TableHead className="text-right">Unit</TableHead>
            <TableHead className="text-right">Line total</TableHead>
            <TableHead className="w-[40px]">
              <span className="sr-only">Remove</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cart.map((line) => {
            const stock = line.product.stock_quantity;
            const atMin = line.quantity <= MIN_QUANTITY;
            const atMax = line.quantity >= stock;
            const lineTotal = line.product.price * line.quantity;
            const low = isLowStock(line.product);
            return (
              <TableRow key={line.product.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium leading-tight">
                      {line.product.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {line.product.sku}
                      {low && stock > 0 ? (
                        <Badge
                          variant="outline"
                          className="ml-2 border-amber-500/40 text-[10px] uppercase tracking-wide text-amber-700"
                        >
                          Low stock
                        </Badge>
                      ) : null}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={disabled || atMin}
                      onClick={() =>
                        onUpdateQuantity(
                          line.product.id,
                          line.quantity - 1,
                        )
                      }
                      aria-label={`Decrease ${line.product.name} quantity`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={MIN_QUANTITY}
                      max={stock}
                      value={line.quantity}
                      disabled={disabled}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") return; // keep edit in progress
                        const next = Number.parseInt(raw, 10);
                        if (Number.isNaN(next)) return;
                        onUpdateQuantity(line.product.id, next);
                      }}
                      onBlur={(e) => {
                        const raw = e.target.value;
                        const parsed = Number.parseInt(raw, 10);
                        if (Number.isNaN(parsed) || parsed < MIN_QUANTITY) {
                          onUpdateQuantity(line.product.id, MIN_QUANTITY);
                          return;
                        }
                        if (parsed > stock) {
                          onUpdateQuantity(line.product.id, stock);
                        }
                      }}
                      className="h-7 w-14 text-center tabular-nums"
                      aria-label={`${line.product.name} quantity`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      disabled={disabled || atMax}
                      onClick={() =>
                        onUpdateQuantity(
                          line.product.id,
                          line.quantity + 1,
                        )
                      }
                      aria-label={`Increase ${line.product.name} quantity`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="mt-1 text-center text-[10px] text-muted-foreground">
                    {atMax && stock > 0
                      ? `Max ${stock} in stock`
                      : stock === 0
                        ? "Out of stock"
                        : `${stock} in stock`}
                  </p>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatPrice(line.product.price)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(lineTotal)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={disabled}
                    onClick={() => onRemove(line.product.id)}
                    aria-label={`Remove ${line.product.name} from cart`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
