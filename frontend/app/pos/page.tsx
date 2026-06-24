"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function PosPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">POS</h1>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Point of Sale</CardTitle>
          <CardDescription>
            Cart and checkout land in a follow-up issue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Placeholder shell — wired to App Router, shadcn, and TanStack
            Query. Awaiting OCT-6 (auth API) for real flows.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
