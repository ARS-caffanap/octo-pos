"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TOKEN_COOKIE } from "@/lib/api";

// PONYTAIL: this is a stub. The real auth flow lands with OCT-6
// (backend). For now we just need a working cookie so the middleware
// can let users past the gate.
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState("");
  const next = params.get("next") ?? "/dashboard";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (token.split(".").length !== 3) return;
    // 7 days; the backend's exp claim is the source of truth.
    document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Lax`;
    router.push(next);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in to OctoPOS</CardTitle>
        <CardDescription>
          Paste a JWT (real login lands with OCT-6).
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-2">
          <Label htmlFor="token">JWT</Label>
          <Input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="eyJhbGciOi..."
            required
          />
        </CardContent>
        <CardFooter className="pt-2">
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </CardFooter>
      </form>
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
