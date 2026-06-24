"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductForm } from "@/components/products/product-form";
import {
  createProduct,
  productKeys,
  type CreateProductFormValues,
} from "@/lib/products";

export default function NewProductPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (input: CreateProductFormValues) => createProduct(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      router.push("/products");
    },
    onError: (err: Error) => {
      setServerError(err.message);
    },
  });

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
          <CardTitle>New product</CardTitle>
          <CardDescription>
            Add a new SKU to the catalog. Required fields are marked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {serverError && !createMutation.isPending && (
            <div className="mb-4">
              <Alert variant="destructive">
                <AlertTitle>Could not create product</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            </div>
          )}
          <ProductForm
            mode="create"
            submitLabel="Create product"
            submitting={createMutation.isPending}
            serverError={null}
            onCancel={() => router.push("/products")}
            onSubmit={async (values) => {
              await createMutation.mutateAsync(values);
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
