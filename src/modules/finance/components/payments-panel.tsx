"use client";

import * as React from "react";
import type { PaymentMethod } from "@prisma/client";
import { CreditCard, Loader2, Plus, Search } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { addToTotals, formatCurrency, formatCurrencyTotals, formatDate } from "@/lib/format";
import type { PaymentsReceivedDTO } from "@/modules/finance/finance-suite.service";
import { recordPaymentAction } from "@/modules/finance/invoices.actions";

export function PaymentsPanel({
  orgSlug,
  todayIso,
  data,
  canWrite,
}: {
  orgSlug: string;
  todayIso: string;
  data: PaymentsReceivedDTO;
  canWrite: boolean;
}) {
  const [search, setSearch] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [invoiceId, setInvoiceId] = React.useState(data.unpaidInvoices[0]?.id ?? "");
  const [amount, setAmount] = React.useState(
    data.unpaidInvoices[0] ? String(data.unpaidInvoices[0].balanceDue) : "",
  );
  const [method, setMethod] = React.useState<PaymentMethod>("BANK_TRANSFER");
  const [reference, setReference] = React.useState("");
  const [paidAt, setPaidAt] = React.useState(todayIso);
  const [isPending, startTransition] = React.useTransition();

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.payments;
    return data.payments.filter(
      (p) =>
        p.invoiceNumber.toLowerCase().includes(q) ||
        p.companyName.toLowerCase().includes(q) ||
        (p.reference?.toLowerCase().includes(q) ?? false),
    );
  }, [data.payments, search]);

  const totalsByCurrency: Record<string, number> = {};
  for (const p of filtered) {
    addToTotals(totalsByCurrency, p.currency, p.amount);
  }

  const handleInvoiceChange = (id: string) => {
    setInvoiceId(id);
    const inv = data.unpaidInvoices.find((i) => i.id === id);
    if (inv) setAmount(String(inv.balanceDue));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await recordPaymentAction({
        orgSlug,
        invoiceId,
        amount: Number(amount),
        method,
        reference: reference || null,
        paidAt,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setReference("");
      setOpen(false);
      toast.success("Payment recorded");
    });
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Payments Received</h1>
          <p className="text-sm text-muted-foreground">
            Customer payment ledger linked directly to invoices and settlement methods.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 text-xs">
            Total Collected: {formatCurrencyTotals(totalsByCurrency, data.defaultCurrency)}
          </Badge>
          {canWrite && data.unpaidInvoices.length > 0 && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="size-4 text-emerald-600" />
              Payment History ({filtered.length})
            </CardTitle>
            <CardDescription>Click an invoice # to open its receipt and ledger entry.</CardDescription>
          </div>

          <div className="relative w-60">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice #, client, ref..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment Date</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference #</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No customer payments recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((pay) => (
                  <TableRow key={pay.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(pay.paidAtIso, { withYear: true })}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/${orgSlug}/finance/invoices?highlight=${pay.invoiceId}`}
                        className="font-mono text-sm font-semibold text-primary hover:underline"
                      >
                        {pay.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{pay.companyName}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{pay.method.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {pay.reference ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-emerald-600">
                      +{formatCurrency(pay.amount, pay.currency)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Customer Payment</DialogTitle>
            <DialogDescription>Apply a payment to an open or overdue invoice.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pmt-inv">Invoice</Label>
              <select
                id="pmt-inv"
                value={invoiceId}
                onChange={(e) => handleInvoiceChange(e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {data.unpaidInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} — {inv.companyName} (Bal:{" "}
                    {formatCurrency(inv.balanceDue, inv.currency)})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pmt-amt">Amount Received</Label>
                <Input
                  id="pmt-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pmt-date">Payment Date</Label>
                <Input
                  id="pmt-date"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pmt-method">Method</Label>
                <select
                  id="pmt-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Card</option>
                  <option value="CASH">Cash</option>
                  <option value="CHECK">Check</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pmt-ref">Reference #</Label>
                <Input
                  id="pmt-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="OR / TXN ID"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Save Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
