"use client";

import * as React from "react";
import Link from "next/link";

import { ReceiptDisplay } from "@/components/receipt/receipt";
import { Button } from "@/components/ui/button";
import { type Receipt } from "@/lib/receipt";

// Fixture used until the backend's POST /api/transactions is wired up.
// Mirrors the shape documented in OCT-14 so the component is reviewable in
// isolation.
const SAMPLE_RECEIPT: Receipt = {
  transaction_number: "TRX-20260624-0001",
  created_at: "2026-06-24T13:24:00Z",
  store_name: "OctoPOS Demo Store",
  cashier_name: "Fajry",
  items: [
    {
      id: "p-001",
      name: "Es Kopi Susu",
      unit_price: 22000,
      quantity: 2,
    },
    {
      id: "p-002",
      name: "Roti Bakar Coklat",
      unit_price: 15000,
      quantity: 1,
    },
    {
      id: "p-003",
      name: "Pisang Goreng (5 pcs)",
      unit_price: 12000,
      quantity: 1,
      discount: 2000,
    },
  ],
  subtotal: 71000,
  discount: 2000,
  tax: 5175,
  total: 74175,
  amount_paid: 80000,
  change_due: 5825,
  payment_method: "cash",
  note: "Thank you — please come again!",
};

export default function ReceiptDemoPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Receipt</h1>
          <p className="text-sm text-muted-foreground">
            Preview of the transaction receipt component (OCT-14).
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <ReceiptDisplay receipt={SAMPLE_RECEIPT} />
    </main>
  );
}
