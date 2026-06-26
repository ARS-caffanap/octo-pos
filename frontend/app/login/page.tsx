"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LoginError, login } from "@/lib/auth";

// Validation runs client-side before submit. The backend re-validates;
// this just gives the user fast feedback and prevents a round-trip on
// obvious mistakes.
const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    // Clear any previous form-level error before retrying so the alert
    // doesn't linger across attempts.
    form.clearErrors("root");
    setSubmitting(true);
    try {
      await login(values.email, values.password);
      const next = params.get("next") ?? "/dashboard";
      router.push(next);
      router.refresh();
    } catch (err) {
      // Map any thrown error to a user-facing message. A `fetch` rejection
      // (CORS, offline, DNS, abort) gives us a TypeError with a generic
      // "Failed to fetch" or "Load failed" string — useless to show, so
      // we fall back to a connection-quality message instead.
      let message: string;
      if (err instanceof LoginError) {
        message = err.message;
      } else if (
        err instanceof TypeError &&
        /fetch/i.test(err.message ?? "")
      ) {
        message = "Couldn't reach the server. Check your connection and try again.";
      } else if (err instanceof Error) {
        message = err.message || "Unable to sign in. Please try again.";
      } else {
        message = "Unable to sign in. Please try again.";
      }
      // Anchor the error to the form so it stays visible after the
      // button re-enables (toasts auto-dismiss and are easy to miss at
      // top-right while the user is focused on the form). Also fire a
      // toast for immediate peripheral feedback.
      form.setError("root", { type: "server", message });
      toast.error(message);
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in to OctoPOS</CardTitle>
        <CardDescription>
          Enter your work email and password to continue.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
            {form.formState.errors.root?.message ? (
              <Alert variant="destructive" data-testid="login-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {form.formState.errors.root.message}
                </AlertDescription>
              </Alert>
            ) : null}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="pt-2">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
