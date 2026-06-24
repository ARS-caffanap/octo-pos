"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";

type Health = { status: string };

export default function DashboardPage() {
  // PONYTAIL: one query to prove the wiring works end-to-end.
  const { data, isLoading, error } = useQuery<Health>({
    queryKey: ["health"],
    queryFn: () => api<Health>("/health"),
    retry: false,
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <Button asChild>
          <Link href="/pos">Open POS</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Backend health</CardTitle>
          <CardDescription>
            Sanity check that the API and auth wiring work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && (
            <p className="text-sm text-destructive">
              {(error as Error).message}
            </p>
          )}
          {data && (
            <p className="text-sm">
              Status: <span className="font-mono">{data.status}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
