"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  deleteProduct,
  fetchProduct,
  isLowStock,
  isOutOfStock,
  productKeys,
  updateProduct,
  type UpdateProductFormValues,
} from "@/lib/products";

type Params = { params: { id: string } };

export default function EditProductPage({ params }: Params) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // The path param is a string; the API expects a numeric id. Bail early
  // on non-numeric input rather than throwing inside the query function.
  const idNum = React.useMemo(() => {
    const n = Number(params.id);
    return Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
  }, [params.id]);

  const productQuery = useQuery({
    queryKey: idNum ? productKeys.detail(idNum) : ["products", "invalid-id"],
    queryFn: () => fetchProduct(idNum as number),
    enabled: idNum !== null,
  });

  const [serverError, setServerError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const updateMutation = useMutation({
    mutationFn: (input: UpdateProductFormValues) =>
      updateProduct(idNum as number, input),
    onSuccess: () => {
      toast.success("Product updated");
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      if (idNum !== null) {
        queryClient.invalidateQueries({ queryKey: productKeys.detail(idNum) });
      }
      router.push("/products");
    },
    onError: (err: Error) => {
      setServerError(err.message);
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(idNum as number),
    onSuccess: () => {
      toast.success("Product deleted");
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      router.push("/products");
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setConfirmDelete(false);
    },
  });

  // --- render ---------------------------------------------------------------

  if (idNum === null) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <Button asChild variant="ghost" size="sm">
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Invalid product id</AlertTitle>
          <AlertDescription>
            The URL contains &quot;{params.id}&quot; which is not a valid
            product id.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  if (productQuery.isLoading) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <Button asChild variant="ghost" size="sm">
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertTitle>Could not load product</AlertTitle>
          <AlertDescription>
            {productQuery.error
              ? (productQuery.error as Error).message
              : "Product not found."}
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const product = productQuery.data;
  const low = isLowStock(product);
  const out = isOutOfStock(product);
  const inactive = product.status === PRODUCT_STATUS.INACTIVE;

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                {product.name}
                <span className="font-mono text-xs text-muted-foreground">
                  #{product.id}
                </span>
              </CardTitle>
              <CardDescription>
                Edit product details. Save to apply changes.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1">
              {out && <Badge variant="destructive">Out of stock</Badge>}
              {!out && low && <Badge variant="destructive">Low stock</Badge>}
              {inactive ? (
                <Badge variant="outline">Inactive</Badge>
              ) : (
                <Badge variant="secondary">Active</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete product
            </Button>
          </div>
          <ProductForm
            mode="update"
            submitLabel="Save changes"
            submitting={updateMutation.isPending}
            serverError={serverError}
            onCancel={() => router.push("/products")}
            defaultValues={{
              name: product.name,
              sku: product.sku,
              price: product.price,
              stock_quantity: product.stock_quantity,
              low_stock_threshold: product.low_stock_threshold,
              category: product.category ?? "",
              status: (product.status as typeof PRODUCT_STATUS.ACTIVE | typeof PRODUCT_STATUS.INACTIVE) ?? PRODUCT_STATUS.ACTIVE,
            }}
            onSubmit={async (values) => {
              await updateMutation.mutateAsync(values);
            }}
          />
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmDelete}
        onOpenChange={(o) => {
          if (!deleteMutation.isPending) setConfirmDelete(o);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks &quot;{product.name}&quot; as inactive. You can
              still find it later with the Inactive filter.
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
                deleteMutation.mutate();
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
