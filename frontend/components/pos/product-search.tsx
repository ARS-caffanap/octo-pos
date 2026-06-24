"use client";

// Product search combobox used by the POS screen. Opens a popover containing
// a shadcn Command palette that lists the active product catalog and lets the
// cashier add a product (or a +1 increment for an existing cart line) to the
// cart by clicking a result.
//
// Design notes:
//  * We fetch the full active product list on mount via React Query. Carts
//    are short-lived; for a single-tenant catalogue of a few hundred rows,
//    a single page is plenty and avoids the pagination UX cost in a
//    combobox. If the catalog ever explodes we can add a server search
//    endpoint later.
//  * Client-side filter (name / SKU / category) is plenty for thousands of
//    rows on the main thread and avoids an extra roundtrip per keystroke.
//  * Out-of-stock items are shown but disabled so the cashier sees the
//    product exists; inactive products are filtered out.
//  * Already-in-cart items show their current line quantity in the result
//    so the cashier can see "what's already on the sale" at a glance.

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatPrice,
  isOutOfStock,
  PRODUCT_STATUS,
  fetchProducts,
  productKeys,
  type Product,
} from "@/lib/products";
import type { CartLine } from "@/lib/pos";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ProductSearchProps = {
  cart: CartLine[];
  onAdd: (product: Product) => void;
  /** Disabled when checkout is in flight. */
  disabled?: boolean;
};

export function ProductSearch({ cart, onAdd, disabled = false }: ProductSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Fetch a generous page of active products. The POS is one tenant's
  // catalog; the page size here only bounds the dropdown, not the table view.
  const { data, isLoading } = useQuery({
    queryKey: productKeys.list({ limit: 500, offset: 0, status: "active" }),
    queryFn: () =>
      fetchProducts({ limit: 500, offset: 0, status: PRODUCT_STATUS.ACTIVE }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const products = useMemo(() => data?.data ?? [], [data]);

  const cartQtyById = useMemo(() => {
    const map = new Map<number, number>();
    for (const line of cart) {
      map.set(line.product.id, (map.get(line.product.id) ?? 0) + line.quantity);
    }
    return map;
  }, [cart]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, query]);

  return (
    <div className="space-y-2">
      <label
        htmlFor="pos-product-search"
        className="text-sm font-medium leading-none"
      >
        Add product
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="pos-product-search"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <Search className="h-4 w-4" />
              Search products by name, SKU, or category…
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search products…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {isLoading ? (
                <CommandEmpty>Loading products…</CommandEmpty>
              ) : filtered.length === 0 ? (
                <CommandEmpty>No products match your search.</CommandEmpty>
              ) : (
                <CommandGroup heading="Products">
                  {filtered.slice(0, 50).map((product) => {
                    const inCart = cartQtyById.get(product.id) ?? 0;
                    const oos = isOutOfStock(product);
                    return (
                      <CommandItem
                        key={product.id}
                        value={`${product.id}-${product.name}-${product.sku}`}
                        disabled={oos}
                        onSelect={() => {
                          onAdd(product);
                          // Keep the popover open so the cashier can add
                          // several items in a row without re-clicking.
                          // The cashier closes the popover with Esc / click
                          // outside when they're done.
                        }}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              {product.name}
                            </span>
                            {oos ? (
                              <span className="text-[10px] uppercase tracking-wide text-destructive">
                                Out of stock
                              </span>
                            ) : null}
                          </div>
                          <span className="truncate text-xs text-muted-foreground">
                            {product.sku}
                            {product.category ? ` · ${product.category}` : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 whitespace-nowrap text-sm">
                          <span className="tabular-nums text-muted-foreground">
                            {formatPrice(product.price)}
                          </span>
                          {inCart > 0 ? (
                            <span
                              className={cn(
                                "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold",
                                "bg-primary/10 text-primary",
                              )}
                              aria-label={`${inCart} already in cart`}
                            >
                              ×{inCart}
                            </span>
                          ) : null}
                          <Check
                            className={cn(
                              "h-4 w-4 text-primary",
                              inCart > 0 ? "opacity-100" : "opacity-0",
                            )}
                          />
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </CommandList>
            {filtered.length > 50 ? (
              <>
                <Separator />
                <div className="px-2 py-1.5 text-[11px] text-muted-foreground">
                  Showing 50 of {filtered.length} matches — refine your search
                  to narrow the list.
                </div>
              </>
            ) : null}
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs text-muted-foreground">
        Click a product to add it to the cart. Press <kbd className="rounded border px-1">Esc</kbd> to
        close.
      </p>
    </div>
  );
}
