"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  PRODUCT_STATUS,
  createProductSchema,
  updateProductSchema,
  type CreateProductFormValues,
  type UpdateProductFormValues,
} from "@/lib/products";

type SubmitState = {
  status: "idle" | "submitting" | "error";
  message?: string;
};

type BaseProps = {
  submitting?: boolean;
  serverError?: string | null;
  // Render the form fields into an outer Dialog body. We avoid a hard
  // dependency on the dialog component by just exposing a `footer` slot
  // and a `form` wrapper the parent controls.
  submitLabel: string;
  onCancel: () => void;
};

type CreateProps = BaseProps & {
  mode: "create";
  defaultValues?: Partial<CreateProductFormValues>;
  onSubmit: (values: CreateProductFormValues) => Promise<void> | void;
};

type UpdateProps = BaseProps & {
  mode: "update";
  defaultValues?: Partial<UpdateProductFormValues>;
  onSubmit: (values: UpdateProductFormValues) => Promise<void> | void;
};

export type ProductFormProps = CreateProps | UpdateProps;

const CREATE_DEFAULTS: CreateProductFormValues = {
  name: "",
  sku: "",
  price: 0,
  stock_quantity: 0,
  low_stock_threshold: 0,
  category: "",
  status: PRODUCT_STATUS.ACTIVE,
};

const UPDATE_DEFAULTS: UpdateProductFormValues = {
  name: "",
  sku: "",
  price: 0,
  stock_quantity: 0,
  low_stock_threshold: 0,
  category: "",
  status: PRODUCT_STATUS.ACTIVE,
};

// The create/update schemas have different shapes (required vs optional).
// We render the same fields and just swap the resolver, default values,
// and the submit handler's inferred value type.
export function ProductForm(props: ProductFormProps) {
  const isCreate = props.mode === "create";

  const form = useForm<CreateProductFormValues | UpdateProductFormValues>({
    resolver: zodResolver(
      isCreate ? createProductSchema : updateProductSchema,
    ) as never,
    defaultValues: {
      ...(isCreate ? CREATE_DEFAULTS : UPDATE_DEFAULTS),
      ...(props.defaultValues ?? {}),
    },
    mode: "onSubmit",
  });

  const [state, setState] = React.useState<SubmitState>({ status: "idle" });

  async function handleSubmit(
    values: CreateProductFormValues | UpdateProductFormValues,
  ) {
    setState({ status: "submitting" });
    try {
      if (isCreate) {
        await props.onSubmit(values as CreateProductFormValues);
      } else {
        await props.onSubmit(values as UpdateProductFormValues);
      }
      // Success: parent typically closes the dialog / navigates. We do not
      // call setState here because the component may unmount before React
      // flushes; rely on the parent's "done" signal instead.
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Submission failed";
      setState({ status: "error", message });
    }
  }

  const busy = props.submitting || state.status === "submitting";
  const errorMessage = state.message ?? props.serverError ?? null;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        noValidate
        className="space-y-4"
      >
        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>Could not save product</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Espresso beans 1kg" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU</FormLabel>
                <FormControl>
                  <Input placeholder="ESP-1KG" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Category <span className="text-muted-foreground">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="Beverages" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={(field.value as number | string | undefined) ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="stock_quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock quantity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={(field.value as number | string | undefined) ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="low_stock_threshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Low stock threshold</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    placeholder="5"
                    value={(field.value as number | string | undefined) ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormDescription>
                  Badge shows &quot;Low stock&quot; when stock falls at or below this.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select
                  value={(field.value as string | undefined) ?? PRODUCT_STATUS.ACTIVE}
                  onValueChange={field.onChange}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={PRODUCT_STATUS.ACTIVE}>Active</SelectItem>
                    <SelectItem value={PRODUCT_STATUS.INACTIVE}>Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={props.onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Saving…" : props.submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
