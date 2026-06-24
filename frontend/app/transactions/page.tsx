"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Receipt, Calendar as CalendarIcon, ArrowUpDown } from "lucide-react";
import "react-day-picker/style.css";

import { api } from "@/lib/api";
import { formatDateTime, startOfDay, endOfDay, toIso } from "@/lib/date";
import {
  type Transaction,
  type TransactionFilters,
  type TransactionsResponse,
} from "@/lib/transactions";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetFooter,
} from "@/components/ui/sheet";
import { Pagination } from "@/components/ui/pagination";

// --- data fetchers ----------------------------------------------------------

const DEFAULT_PAGE_SIZE = 10;

type TransactionsPage = {
  rows: Transaction[];
  total: number;
  page: number;
  pageSize: number;
};

async function fetchTransactions(
  filters: TransactionFilters,
): Promise<TransactionsPage> {
  const qs = new URLSearchParams();
  qs.set("page", String(filters.page ?? 1));
  qs.set("page_size", String(filters.page_size ?? DEFAULT_PAGE_SIZE));
  if (filters.from) qs.set("from", filters.from);
  if (filters.to) qs.set("to", filters.to);
  if (filters.payment_method && filters.payment_method !== "all") {
    qs.set("payment_method", filters.payment_method);
  }
  if (filters.q && filters.q.trim()) qs.set("q", filters.q.trim());

  const res = await api<TransactionsResponse | Transaction[]>(
    `/api/transactions?${qs.toString()}`,
  );

  // Accept { data, total, page, page_size } or a bare array
  if (Array.isArray(res)) {
    return {
      rows: res,
      total: res.length,
      page: filters.page ?? 1,
      pageSize: filters.page_size ?? DEFAULT_PAGE_SIZE,
    };
  }
  return {
    rows: res.data ?? [],
    total: res.total ?? (res.data?.length ?? 0),
    page: res.page ?? (filters.page ?? 1),
    pageSize: res.page_size ?? (filters.page_size ?? DEFAULT_PAGE_SIZE),
  };
}

async function fetchTransaction(id: string): Promise<Transaction> {
  return api<Transaction>(`/api/transactions/${id}`);
}

// --- formatters -------------------------------------------------------------

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
};

function formatCurrency(n: number | undefined | null): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function paymentLabel(method: string): string {
  return PAYMENT_LABEL[method] ?? method;
}

function paymentVariant(method: string): "default" | "secondary" | "outline" {
  if (method === "cash") return "default";
  if (method === "card") return "secondary";
  return "outline";
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "secondary";
  if (status === "voided" || status === "refunded") return "destructive";
  return "outline";
}

// --- date trigger (reused from inventory) -----------------------------------

function DateTrigger({
  label,
  date,
  onPick,
}: {
  label: string;
  date: Date | undefined;
  onPick: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-w-[170px] justify-start text-left font-normal"
        >
          <CalendarIcon className="h-4 w-4" />
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

// --- debounced input --------------------------------------------------------

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// --- sortable header --------------------------------------------------------

type SortKey = "created_at" | "total_amount" | "transaction_number";
type SortDir = "asc" | "desc";

function SortableHead({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === column;
  const arrow = active ? (sortDir === "asc" ? "↑" : "↓") : null;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={
          "inline-flex items-center gap-1 hover:text-foreground " +
          (active ? "text-foreground" : "")
        }
      >
        {label}
        {arrow ? (
          <span className="text-foreground">{arrow}</span>
        ) : (
          <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />
        )}
      </button>
    </TableHead>
  );
}

// --- transaction details panel ---------------------------------------------

function TransactionDetails({
  transaction,
  loading,
  error,
}: {
  transaction: Transaction | undefined;
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load transaction</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!transaction) return null;

  const items = transaction.items ?? [];
  const itemsSubtotal = items.reduce(
    (sum, it) => sum + (it.subtotal ?? it.quantity * it.unit_price),
    0,
  );

  return (
    <div className="space-y-6">
      {/* receipt header */}
      <div className="rounded-md border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Transaction
            </p>
            <p className="font-mono text-lg font-semibold">
              {transaction.transaction_number}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant={statusVariant(transaction.status)}>
              {transaction.status}
            </Badge>
            <Badge variant={paymentVariant(transaction.payment_method)}>
              {paymentLabel(transaction.payment_method)}
            </Badge>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">When</p>
            <p>{formatDateTime(transaction.created_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Cashier</p>
            <p>{transaction.created_by ?? transaction.user_id ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* items */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Items</h3>
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No items returned for this transaction.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, idx) => (
                  <TableRow key={it.id ?? `${it.product_id ?? it.name ?? "item"}-${idx}`}>
                    <TableCell className="font-medium">
                      {it.product_name ?? it.name ?? it.product_id ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {it.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(it.unit_price)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(
                        it.subtotal ?? it.quantity * it.unit_price,
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* totals */}
      <div className="space-y-1 rounded-md border bg-muted/30 p-4 text-sm">
        {transaction.subtotal !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-mono">
              {formatCurrency(transaction.subtotal)}
            </span>
          </div>
        )}
        {transaction.tax_amount !== undefined && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-mono">
              {formatCurrency(transaction.tax_amount)}
            </span>
          </div>
        )}
        {transaction.subtotal === undefined && items.length > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Items subtotal</span>
            <span className="font-mono">{formatCurrency(itemsSubtotal)}</span>
          </div>
        )}
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <span>Total</span>
          <span className="font-mono">
            {formatCurrency(transaction.total_amount)}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- main page --------------------------------------------------------------

export default function TransactionsPage() {
  const [from, setFrom] = React.useState<Date | undefined>(undefined);
  const [to, setTo] = React.useState<Date | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = React.useState<string>("all");
  const [searchInput, setSearchInput] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(DEFAULT_PAGE_SIZE);
  const [sortKey, setSortKey] = React.useState<SortKey>("created_at");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  // debounce search input before sending it to the API
  const debouncedQ = useDebouncedValue(searchInput, 350);

  // when filters change, reset to page 1 so users don't land on a page that
  // doesn't exist after the result set shrinks
  const onSort = React.useCallback((k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir(k === "created_at" ? "desc" : "asc");
    }
    setPage(1);
  }, [sortKey]);

  const filters = React.useMemo<TransactionFilters>(
    () => ({
      from: toIso(from ? startOfDay(from) : undefined),
      to: toIso(to ? endOfDay(to) : undefined),
      payment_method: paymentMethod,
      q: debouncedQ,
      page,
      page_size: pageSize,
    }),
    [from, to, paymentMethod, debouncedQ, page, pageSize],
  );

  // bump page back to 1 when any filter (other than page itself) changes
  const filterSignature = JSON.stringify({
    from: filters.from,
    to: filters.to,
    payment_method: filters.payment_method,
    q: filters.q,
  });
  React.useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSignature]);

  const listQuery = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => fetchTransactions(filters),
    placeholderData: (prev) => prev,
  });

  const rows = React.useMemo<Transaction[]>(
    () => listQuery.data?.rows ?? [],
    [listQuery.data],
  );
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // client-side sort as a safety net — if the backend doesn't honor the
  // sort key, the UI still feels consistent
  const sortedRows = React.useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const copy = [...rows];
    copy.sort((a, b) => {
      if (sortKey === "total_amount") return (a.total_amount - b.total_amount) * dir;
      if (sortKey === "transaction_number") {
        return a.transaction_number.localeCompare(b.transaction_number) * dir;
      }
      // created_at
      return (
        (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) *
        dir
      );
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  // selected transaction for the slide-over
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const detailQuery = useQuery({
    queryKey: ["transaction", selectedId],
    queryFn: () => fetchTransaction(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const filtersActive =
    Boolean(from) || Boolean(to) || paymentMethod !== "all" || debouncedQ.length > 0;

  const clearFilters = () => {
    setFrom(undefined);
    setTo(undefined);
    setPaymentMethod("all");
    setSearchInput("");
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Transactions
          </h1>
          <p className="text-sm text-muted-foreground">
            Search and review past sales.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      {/* Filters bar */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transaction number…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8"
              />
              {searchInput && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DateTrigger label="From date" date={from} onPick={setFrom} />
              <DateTrigger label="To date" date={to} onPick={setTo} />
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="min-w-[170px]">
                  <SelectValue placeholder="Payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
              {filtersActive && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {listQuery.isError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load transactions</AlertTitle>
          <AlertDescription>
            {(listQuery.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead
                  label="Transaction #"
                  column="transaction_number"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortableHead
                  label="When"
                  column="created_at"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <SortableHead
                  label="Total"
                  column="total_amount"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  className="text-right"
                />
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {filtersActive
                      ? "No transactions match these filters."
                      : "No transactions yet."}
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedId(t.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(t.id);
                      }
                    }}
                  >
                    <TableCell className="font-mono text-sm font-medium">
                      {t.transaction_number}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(t.created_at)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(t.total_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={paymentVariant(t.payment_method)}>
                        {paymentLabel(t.payment_method)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(t.status)}>
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(t.id);
                        }}
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination + total summary */}
      <div className="flex flex-col items-center gap-2">
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={(p) => {
            setPage(p);
            if (typeof window !== "undefined") {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          {listQuery.isLoading
            ? "Loading…"
            : total === 0
              ? "0 results"
              : `Showing ${(page - 1) * pageSize + 1}–${Math.min(
                  page * pageSize,
                  total,
                )} of ${total}`}
          {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ""}
        </p>
      </div>

      {/* Details slide-over */}
      <Sheet
        open={selectedId !== null}
        onOpenChange={(o) => {
          if (!o) setSelectedId(null);
        }}
      >
        <SheetContent
          side="right"
          title={
            detailQuery.data
              ? `Transaction ${detailQuery.data.transaction_number}`
              : "Transaction details"
          }
          description={
            detailQuery.data
              ? formatDateTime(detailQuery.data.created_at)
              : undefined
          }
        >
          <TransactionDetails
            transaction={detailQuery.data}
            loading={detailQuery.isLoading}
            error={
              detailQuery.isError
                ? (detailQuery.error as Error).message
                : null
            }
          />
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedId(null)}
            >
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </main>
  );
}
