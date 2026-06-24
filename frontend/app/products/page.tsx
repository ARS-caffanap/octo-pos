"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowUpDown,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductForm } from "@/components/products/product-form";
import {
  PRODUCT_STATUS,
  createProduct,
  deleteProduct,
  fetchProducts,
  formatPrice,
  isLowStock,
  isOutOfStock,
  productKeys,
  totalPages,
  type CreateProductFormValues,
  type Product,
} from "@/lib/products";

const PAGE_SIZE = 10;

// Build a compact pagination range that always shows first/last and
// the current ±1 pages. Pure helper so the table stays readable.
function buildPageRange(current: number, last: number): Array<number | "…"> {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const out: Array<number | "…"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(last - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < last - 1) out.push("…");
  out.push(last);
  return out;
}

// Debounced search input. The list re-queries on every page change but
// search is client-side (the backend has no `q` param yet) so we just
// trim+lowercase and filter in-memory.
function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function ProductsListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [sortKey, setSortKey] = React.useState<"name" | "sku" | "price" | "stock_quantity">("name");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  const debouncedSearch = useDebouncedValue(search, 250);

  // Reset to page 1 when any filter / sort input changes — the user
  // expects to see the new result set, not an empty page beyond total.
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter, statusFilter, sortKey, sortDir]);

  const offset = (page - 1) * PAGE_SIZE;

  const productsQuery = useQuery({
    queryKey: productKeys.list({
      limit: PAGE_SIZE,
      offset,
      category: categoryFilter,
      status: statusFilter,
    }),
    queryFn: () =>
      fetchProducts({
        limit: PAGE_SIZE,
        offset,
        category: categoryFilter,
        status: statusFilter,
      }),
    placeholderData: keepPreviousData,
  });

  const rows = React.useMemo(
    () => productsQuery.data?.data ?? [],
    [productsQuery.data],
  );
  const total = productsQuery.data?.total ?? 0;
  const last = totalPages(total, PAGE_SIZE);

  // Client-side search across name + SKU. The backend has no `q` parameter
  // (only category/status/low_stock) so we filter the current page here.
  // The spec also implies search should be visible on the table, which a
  // server-side round-trip per keystroke would slow down.
  const visible = React.useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    const filtered = term
      ? rows.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.sku.toLowerCase().includes(term),
        )
      : rows;
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av ?? "").toLowerCase();
      const bs = String(bv ?? "").toLowerCase();
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return sorted;
  }, [rows, debouncedSearch, sortKey, sortDir]);

  // The set of categories the filter dropdown can show. We pull them
  // from the currently-loaded page; for a more complete list this would
  // come from a /api/categories endpoint (out of scope for OCT-12).
  const knownCategories = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of rows) if (p.category) set.add(p.category);
    return Array.from(set).sort();
  }, [rows]);

  // --- mutations -----------------------------------------------------------

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (input: CreateProductFormValues) => createProduct(input),
    onSuccess: () => {
      toast.success("Product created");
      setCreateOpen(false);
      setCreateError(null);
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
    onError: (err: Error) => {
      setCreateError(err.message);
      toast.error(err.message);
    },
  });

  const [deletingId, setDeletingId] = React.useState<number | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: (_data, id) => {
      toast.success("Product deleted");
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      void id;
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  // --- handlers -------------------------------------------------------------

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
  }

  const filtersActive =
    debouncedSearch.trim() !== "" ||
    categoryFilter !== "all" ||
    statusFilter !== "all";

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage your catalog. {total} {total === 1 ? "product" : "products"} total.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New product
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
                aria-label="Search products"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger aria-label="Filter by category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {knownCategories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value={PRODUCT_STATUS.ACTIVE}>Active</SelectItem>
                <SelectItem value={PRODUCT_STATUS.INACTIVE}>Inactive</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-end">
              {filtersActive && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {productsQuery.isError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load products</AlertTitle>
          <AlertDescription>
            {(productsQuery.error as Error).message}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortHeader
                    label="Name"
                    active={sortKey === "name"}
                    dir={sortDir}
                    onClick={() => toggleSort("name")}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label="SKU"
                    active={sortKey === "sku"}
                    dir={sortDir}
                    onClick={() => toggleSort("sku")}
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader
                    label="Price"
                    active={sortKey === "price"}
                    dir={sortDir}
                    onClick={() => toggleSort("price")}
                    align="right"
                  />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader
                    label="Stock"
                    active={sortKey === "stock_quantity"}
                    dir={sortDir}
                    onClick={() => toggleSort("stock_quantity")}
                    align="right"
                  />
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-0 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsQuery.isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-6 w-6" />
                      {filtersActive
                        ? "No products match your filters."
                        : "No products yet. Click \u201cNew product\u201d to get started."}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    onEdit={() => router.push(`/products/${p.id}`)}
                    onDelete={() => setDeletingId(p.id)}
                    deleting={
                      deleteMutation.isPending && deletingId === p.id
                    }
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {total > 0 && (
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page} of {last} · showing {visible.length} of {total}
          </span>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page > 1) setPage(page - 1);
                  }}
                  aria-disabled={page <= 1}
                  className={
                    page <= 1
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
              {buildPageRange(page, last).map((token, i) =>
                token === "…" ? (
                  <PaginationItem key={`e-${i}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={token}>
                    <PaginationLink
                      href="#"
                      isActive={token === page}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(token);
                      }}
                      className="cursor-pointer"
                    >
                      {token}
                    </PaginationLink>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    if (page < last) setPage(page + 1);
                  }}
                  aria-disabled={page >= last}
                  className={
                    page >= last
                      ? "pointer-events-none opacity-50"
                      : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) setCreateError(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New product</DialogTitle>
            <DialogDescription>
              Add a new SKU to the catalog. Required fields are marked.
            </DialogDescription>
          </DialogHeader>
          <ProductForm
            mode="create"
            submitLabel="Create product"
            submitting={createMutation.isPending}
            serverError={createError}
            onCancel={() => setCreateOpen(false)}
            onSubmit={async (values) => {
              await createMutation.mutateAsync(values);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => {
          if (!o) setDeletingId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the product as inactive. You can still find it
              later with the Inactive filter; ask an admin to restore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deletingId !== null) {
                  deleteMutation.mutate(deletingId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

// --- row --------------------------------------------------------------------

function ProductRow({
  product,
  onDelete,
  deleting,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const low = isLowStock(product);
  const out = isOutOfStock(product);
  const inactive = product.status === PRODUCT_STATUS.INACTIVE;

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link
          href={`/products/${product.id}`}
          className="hover:underline"
        >
          {product.name}
        </Link>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {product.sku}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatPrice(product.price)}
      </TableCell>
      <TableCell className="text-right font-mono">
        {product.stock_quantity}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {product.category || "—"}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {out && <Badge variant="destructive">Out of stock</Badge>}
          {!out && low && <Badge variant="destructive">Low stock</Badge>}
          {inactive ? (
            <Badge variant="outline">Inactive</Badge>
          ) : (
            <Badge variant="secondary">Active</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            aria-label={`Edit ${product.name}`}
          >
            <Link href={`/products/${product.id}`}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={deleting}
            aria-label={`Delete ${product.name}`}
            className="text-destructive hover:text-destructive"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// --- sort header ------------------------------------------------------------

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onClick}
        className={
          "inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground " +
          (align === "right" ? "flex-row-reverse" : "")
        }
      >
        {label}
        <ArrowUpDown
          className={
            "h-3 w-3 " + (active ? "text-foreground" : "opacity-50")
          }
        />
        {active && (
          <span className="text-[10px] font-mono">
            {dir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </button>
    </span>
  );
}
