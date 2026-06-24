"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Package, PackageX, Boxes } from "lucide-react";
import "react-day-picker/style.css";

import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatDateTime, startOfDay, endOfDay, toIso } from "@/lib/date";
import {
  type InventoryMovement,
  type MovementType,
  type Product,
  type ProductsResponse,
  type MovementsResponse,
} from "@/lib/inventory";

// --- data fetchers ----------------------------------------------------------

async function fetchProducts(): Promise<Product[]> {
  // The backend may return { data: [...] } or a bare array. The api() helper
  // throws on non-2xx, so anything reaching here is JSON.
  const res = await api<ProductsResponse | Product[]>("/api/products");
  if (Array.isArray(res)) return res;
  return res.data ?? [];
}

async function fetchMovements(params: {
  from?: string;
  to?: string;
  type?: string;
}): Promise<InventoryMovement[]> {
  const qs = new URLSearchParams();
  qs.set("limit", "50");
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.type && params.type !== "all") qs.set("type", params.type);

  const res = await api<MovementsResponse | InventoryMovement[]>(
    `/api/inventory/movements?${qs.toString()}`
  );
  if (Array.isArray(res)) return res;
  return res.data ?? [];
}

// --- derivations ------------------------------------------------------------

function summarize(products: Product[]) {
  let low = 0;
  let out = 0;
  for (const p of products) {
    if (p.stock_quantity <= 0) {
      out += 1;
      low += 1;
    } else if (p.stock_quantity <= p.low_stock_threshold) {
      low += 1;
    }
  }
  return { total: products.length, low, out };
}

// --- summary card -----------------------------------------------------------

type SummaryCardProps = {
  title: string;
  value: number | string;
  description?: string;
  icon: React.ReactNode;
  tone?: "default" | "warning" | "destructive";
};

function SummaryCard({
  title,
  value,
  description,
  icon,
  tone = "default",
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span
          className={
            tone === "destructive"
              ? "text-destructive"
              : tone === "warning"
                ? "text-amber-600"
                : "text-muted-foreground"
          }
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// --- movement type chip -----------------------------------------------------

const MOVEMENT_LABEL: Record<string, string> = {
  sale: "Sale",
  adjustment: "Adjustment",
  restock: "Restock",
};

function MovementTypeBadge({ type }: { type: MovementType }) {
  const variant =
    type === "sale"
      ? "default"
      : type === "restock"
        ? "secondary"
        : "outline";
  return (
    <Badge variant={variant as "default" | "secondary" | "outline"}>
      {MOVEMENT_LABEL[type] ?? type}
    </Badge>
  );
}

function QuantityCell({ value }: { value: number }) {
  const positive = value > 0;
  const negative = value < 0;
  return (
    <span
      className={
        positive
          ? "font-mono text-emerald-600"
          : negative
            ? "font-mono text-destructive"
            : "font-mono text-muted-foreground"
      }
    >
      {positive ? `+${value}` : value}
    </span>
  );
}

// --- date range trigger -----------------------------------------------------

function DateRangeTrigger({
  label,
  date,
  onPick,
  disabled,
}: {
  label: string;
  date: Date | undefined;
  onPick: (d: Date | undefined) => void;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-w-[170px] justify-start text-left font-normal"
          disabled={disabled}
        >
          {date ? formatDateTime(date.toISOString()).split(",")[0] : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onPick}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// --- main page --------------------------------------------------------------

export default function InventoryDashboardPage() {
  const [from, setFrom] = React.useState<Date | undefined>(undefined);
  const [to, setTo] = React.useState<Date | undefined>(undefined);
  const [type, setType] = React.useState<string>("all");

  // Adjust the "to" date to end-of-day so a calendar-picked day includes
  // everything that happened that day, not just the millisecond at 00:00.
  const fromIso = React.useMemo(() => toIso(from ? startOfDay(from) : undefined), [from]);
  const toIsoVal = React.useMemo(() => toIso(to ? endOfDay(to) : undefined), [to]);

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });

  const movementsQuery = useQuery({
    queryKey: ["movements", fromIso, toIsoVal, type],
    queryFn: () => fetchMovements({ from: fromIso, to: toIsoVal, type }),
  });

  const products = React.useMemo<Product[]>(
    () => productsQuery.data ?? [],
    [productsQuery.data]
  );
  const summary = React.useMemo(() => summarize(products), [products]);
  const lowStockProducts = React.useMemo(
    () =>
      products
        .filter((p) => p.stock_quantity <= p.low_stock_threshold)
        .sort((a, b) => a.stock_quantity - b.stock_quantity),
    [products]
  );

  const filtersActive = Boolean(from) || Boolean(to) || type !== "all";

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Inventory
          </h1>
          <p className="text-sm text-muted-foreground">
            Stock levels and recent activity.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      {/* Summary cards */}
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Total products"
          value={productsQuery.isLoading ? "…" : summary.total}
          description="Active SKUs in the catalog"
          icon={<Boxes className="h-4 w-4" />}
        />
        <SummaryCard
          title="Low stock"
          value={productsQuery.isLoading ? "…" : summary.low}
          description="Stock at or below threshold"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone="warning"
        />
        <SummaryCard
          title="Out of stock"
          value={productsQuery.isLoading ? "…" : summary.out}
          description="Stock at zero"
          icon={<PackageX className="h-4 w-4" />}
          tone="destructive"
        />
      </section>

      {/* Low stock alerts */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight">
            Low stock alerts
          </h2>
          {productsQuery.isLoading ? null : (
            <span className="text-sm text-muted-foreground">
              {lowStockProducts.length} item
              {lowStockProducts.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {productsQuery.isError && (
          <Alert variant="destructive">
            <AlertTitle>Could not load products</AlertTitle>
            <AlertDescription>
              {(productsQuery.error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        {!productsQuery.isLoading && lowStockProducts.length === 0 && (
          <Alert>
            <Package className="h-4 w-4" />
            <AlertTitle>All stocked up</AlertTitle>
            <AlertDescription>
              No products are at or below their low-stock threshold.
            </AlertDescription>
          </Alert>
        )}

        {lowStockProducts.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Threshold</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="w-0" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.map((p) => {
                    const out = p.stock_quantity <= 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {p.sku}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {p.stock_quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {p.low_stock_threshold}
                        </TableCell>
                        <TableCell className="text-right">
                          {out ? (
                            <Badge variant="destructive">Out of stock</Badge>
                          ) : (
                            <Badge variant="outline">Low</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/products/${p.id}`}>
                              View
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Movements */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Recent inventory movements
            </h2>
            <p className="text-sm text-muted-foreground">
              Latest 50 entries. Filter by date range and type.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangeTrigger
              label="From date"
              date={from}
              onPick={setFrom}
            />
            <DateRangeTrigger label="To date" date={to} onPick={setTo} />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="min-w-[150px]">
                <SelectValue placeholder="Movement type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="sale">Sale</SelectItem>
                <SelectItem value="adjustment">Adjustment</SelectItem>
                <SelectItem value="restock">Restock</SelectItem>
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFrom(undefined);
                  setTo(undefined);
                  setType("all");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {movementsQuery.isError && (
          <Alert variant="destructive">
            <AlertTitle>Could not load movements</AlertTitle>
            <AlertDescription>
              {(movementsQuery.error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Created by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementsQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (movementsQuery.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No movements in this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  (movementsQuery.data ?? []).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(m.created_at)}
                      </TableCell>
                      <TableCell>
                        {m.product_id ? (
                          <Link
                            href={`/products/${m.product_id}`}
                            className="font-medium hover:underline"
                          >
                            {m.product_name ?? m.product_id}
                          </Link>
                        ) : (
                          m.product_name ?? "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <MovementTypeBadge type={m.movement_type} />
                      </TableCell>
                      <TableCell className="text-right">
                        <QuantityCell value={m.quantity_change} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {m.created_by ?? m.user_id ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
