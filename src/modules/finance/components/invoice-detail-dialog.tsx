"use client";

import * as React from "react";
import type { PaymentMethod } from "@prisma/client";
import {
  Ban,
  CreditCard,
  Download,
  Loader2,
  Pencil,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  recordPaymentAction,
  sendInvoicesAction,
  voidInvoicesAction,
} from "@/modules/finance/invoices.actions";
import type { InvoiceRecordDTO } from "@/modules/finance/invoices.types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function openInvoicePdfPrintView(invoice: InvoiceRecordDTO, orgName: string) {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!popup) {
    toast.error("Please allow pop-ups to export/print the invoice PDF.");
    return;
  }

  const rowsHtml = invoice.lineItems
    .map(
      (line) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e4e4e7;">${escapeHtml(line.description)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e4e4e7;text-align:right;">${line.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e4e4e7;text-align:right;">${escapeHtml(formatCurrency(line.unitPrice, invoice.currency))}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e4e4e7;text-align:right;">${line.discountRate}%</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e4e4e7;text-align:right;">${line.taxRate}%</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e4e4e7;text-align:right;font-weight:600;">${escapeHtml(formatCurrency(line.lineTotal, invoice.currency))}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(invoice.number)} — ${escapeHtml(orgName)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #18181b; margin: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #18181b; padding-bottom: 20px; }
    .title { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
    .meta { margin-top: 24px; display: flex; justify-content: space-between; gap: 24px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 28px; font-size: 13px; }
    th { background: #f4f4f5; text-align: left; padding: 10px 8px; border-bottom: 1px solid #d4d4d8; }
    .totals { margin-top: 24px; margin-left: auto; width: 280px; font-size: 13px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
    .totals-final { font-size: 16px; font-weight: 700; border-top: 2px solid #18181b; padding-top: 8px; margin-top: 6px; }
    .notes { margin-top: 32px; font-size: 12px; color: #52525b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div style="font-size:18px;font-weight:700;">${escapeHtml(orgName)}</div>
      <div style="font-size:12px;color:#71717a;">Business Suite Finance</div>
    </div>
    <div style="text-align:right;">
      <div class="title">INVOICE</div>
      <div style="font-family:monospace;font-size:15px;font-weight:700;">${escapeHtml(invoice.number)}</div>
      <div style="font-size:12px;color:#52525b;">Status: ${escapeHtml(invoice.effectiveStatus)}</div>
    </div>
  </div>
  <div class="meta">
    <div>
      <div style="font-size:11px;text-transform:uppercase;color:#71717a;">Bill To</div>
      <div style="font-weight:700;margin-top:4px;">${escapeHtml(invoice.company?.name ?? invoice.contact?.fullName ?? "Customer")}</div>
      ${invoice.contact ? `<div>${escapeHtml(invoice.contact.fullName)}</div>` : ""}
      ${invoice.contact?.email ? `<div>${escapeHtml(invoice.contact.email)}</div>` : ""}
      ${invoice.deal ? `<div style="color:#52525b;margin-top:4px;">Deal: ${escapeHtml(invoice.deal.title)}</div>` : ""}
    </div>
    <div style="text-align:right;">
      <div><strong>Invoice Date:</strong> ${escapeHtml(formatDate(invoice.issueDate, { withYear: true }))}</div>
      <div><strong>Due Date:</strong> ${escapeHtml(formatDate(invoice.dueDate, { withYear: true }))}</div>
      <div><strong>Currency:</strong> ${escapeHtml(invoice.currency)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Item &amp; Description</th>
        <th style="text-align:right;">Qty</th>
        <th style="text-align:right;">Rate</th>
        <th style="text-align:right;">Disc %</th>
        <th style="text-align:right;">Tax %</th>
        <th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="totals">
    <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(invoice.subtotal, invoice.currency))}</span></div>
    <div class="totals-row"><span>Tax Total</span><span>${escapeHtml(formatCurrency(invoice.taxTotal, invoice.currency))}</span></div>
    <div class="totals-row"><span>Total</span><span>${escapeHtml(formatCurrency(invoice.total, invoice.currency))}</span></div>
    <div class="totals-row"><span>Amount Paid</span><span>-${escapeHtml(formatCurrency(invoice.amountPaid, invoice.currency))}</span></div>
    <div class="totals-row totals-final"><span>Balance Due</span><span>${escapeHtml(formatCurrency(invoice.balanceDue, invoice.currency))}</span></div>
  </div>
  ${invoice.notes || invoice.terms ? `<div class="notes">${invoice.notes ? `<p><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</p>` : ""}${invoice.terms ? `<p><strong>Terms:</strong> ${escapeHtml(invoice.terms)}</p>` : ""}</div>` : ""}
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

export function InvoiceDetailDialog({
  open,
  onOpenChange,
  orgSlug,
  orgName,
  todayIso,
  invoice,
  canWrite,
  canVoid,
  onEditDraft,
  initialPaymentOpen = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  orgName: string;
  todayIso: string;
  invoice: InvoiceRecordDTO | null;
  canWrite: boolean;
  canVoid: boolean;
  onEditDraft: (inv: InvoiceRecordDTO) => void;
  initialPaymentOpen?: boolean;
}) {
  const [paymentOpen, setPaymentOpen] = React.useState(initialPaymentOpen);
  const [payAmount, setPayAmount] = React.useState("");
  const [payMethod, setPayMethod] = React.useState<PaymentMethod>("BANK_TRANSFER");
  const [payRef, setPayRef] = React.useState("");
  const [payDate, setPayDate] = React.useState(todayIso);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open && invoice) {
      setPaymentOpen(initialPaymentOpen);
      setPayAmount(String(invoice.balanceDue || invoice.total));
      setPayRef("");
      setPayDate(todayIso);
    }
  }, [open, invoice, initialPaymentOpen, todayIso]);

  if (!invoice) return null;

  const canSend = canWrite && invoice.status === "DRAFT";
  const canPay =
    canWrite && invoice.status !== "VOID" && invoice.status !== "PAID" && invoice.balanceDue > 0;
  const canEdit = canWrite && invoice.status === "DRAFT";
  const canVoidInv =
    canVoid && invoice.status !== "VOID" && invoice.status !== "PAID";

  const handleMarkSent = () => {
    startTransition(async () => {
      const res = await sendInvoicesAction({ orgSlug, invoiceIds: [invoice.id] });
      if (!res.ok) toast.error(res.error.message);
      else toast.success(`Invoice ${invoice.number} marked as Sent`);
    });
  };

  const handleVoid = () => {
    startTransition(async () => {
      const res = await voidInvoicesAction({ orgSlug, invoiceIds: [invoice.id] });
      if (!res.ok) toast.error(res.error.message);
      else toast.success(`Invoice ${invoice.number} voided`);
    });
  };

  const handleRecordPayment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await recordPaymentAction({
        orgSlug,
        invoiceId: invoice.id,
        amount: Number(payAmount),
        method: payMethod,
        reference: payRef || null,
        paidAt: payDate,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setPaymentOpen(false);
      toast.success(
        res.data.status === "PAID"
          ? `Payment recorded — ${invoice.number} is now Paid`
          : `Partial payment recorded for ${invoice.number}`,
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div>
              <DialogTitle className="flex items-center gap-2 font-mono">
                {invoice.number}
                <Badge
                  variant={
                    invoice.effectiveStatus === "PAID"
                      ? "default"
                      : invoice.effectiveStatus === "OVERDUE" || invoice.effectiveStatus === "VOID"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {invoice.effectiveStatus}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                {invoice.company?.name ?? invoice.contact?.fullName ?? "Customer"} · Due{" "}
                {formatDate(invoice.dueDate, { withYear: true })}
              </DialogDescription>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {canEdit && (
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onEditDraft(invoice);
                  }}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              )}
              {canSend && (
                <Button type="button" size="xs" disabled={isPending} onClick={handleMarkSent}>
                  <Send className="size-3.5" />
                  Mark as Sent
                </Button>
              )}
              {canPay && (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() => setPaymentOpen((prev) => !prev)}
                >
                  <CreditCard className="size-3.5" />
                  Record Payment
                </Button>
              )}
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => openInvoicePdfPrintView(invoice, orgName)}
              >
                <Download className="size-3.5" />
                PDF
              </Button>
              {canVoidInv && (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={isPending}
                  onClick={handleVoid}
                >
                  <Ban className="size-3.5" />
                  Void
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Inline Record Payment Form */}
        {paymentOpen && canPay && (
          <form
            onSubmit={handleRecordPayment}
            className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] p-3.5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Record Payment</p>
              <span className="text-xs text-muted-foreground">
                Balance due: {formatCurrency(invoice.balanceDue, invoice.currency)}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="pay-amt" className="text-xs">
                  Amount ({invoice.currency})
                </Label>
                <Input
                  id="pay-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={invoice.balanceDue}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-method" className="text-xs">
                  Method
                </Label>
                <select
                  id="pay-method"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Card</option>
                  <option value="CASH">Cash</option>
                  <option value="CHECK">Check</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-date" className="text-xs">
                  Payment Date
                </Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pay-ref" className="text-xs">
                  Reference #
                </Label>
                <Input
                  id="pay-ref"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="TXN / Check #"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="xs"
                variant="ghost"
                onClick={() => setPaymentOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="xs" disabled={isPending}>
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                Save Payment
              </Button>
            </div>
          </form>
        )}

        {/* PDF-Style Document Preview */}
        <div className="rounded-xl border bg-background p-6 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
            <div>
              <p className="text-base font-bold">{orgName}</p>
              <p className="text-xs text-muted-foreground">Business Suite Finance</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold tracking-tight">INVOICE</p>
              <p className="font-mono text-sm font-semibold">{invoice.number}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 text-xs sm:grid-cols-2">
            <div className="space-y-1">
              <p className="font-semibold uppercase tracking-wider text-muted-foreground">
                Bill To
              </p>
              <p className="text-sm font-semibold">
                {invoice.company?.name ?? invoice.contact?.fullName ?? "Customer"}
              </p>
              {invoice.contact && <p>{invoice.contact.fullName}</p>}
              {invoice.contact?.email && (
                <p className="text-muted-foreground">{invoice.contact.email}</p>
              )}
              {invoice.deal && (
                <p className="text-muted-foreground">Linked Deal: {invoice.deal.title}</p>
              )}
            </div>

            <div className="space-y-1 sm:text-right">
              <p>
                <span className="text-muted-foreground">Invoice Date: </span>
                <span className="font-medium">
                  {formatDate(invoice.issueDate, { withYear: true })}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Due Date: </span>
                <span className="font-medium">
                  {formatDate(invoice.dueDate, { withYear: true })}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Balance Due: </span>
                <span className="font-bold">
                  {formatCurrency(invoice.balanceDue, invoice.currency)}
                </span>
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div className="mt-6 overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Item &amp; Description</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Rate</th>
                  <th className="px-3 py-2 text-right font-medium">Disc %</th>
                  <th className="px-3 py-2 text-right font-medium">Tax %</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoice.lineItems.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2.5 font-medium">{line.description}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{line.quantity}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatCurrency(line.unitPrice, invoice.currency)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{line.discountRate}%</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{line.taxRate}%</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                      {formatCurrency(line.lineTotal, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">
                  {formatCurrency(invoice.subtotal, invoice.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="tabular-nums">
                  {formatCurrency(invoice.taxTotal, invoice.currency)}
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Invoice Total</span>
                <span className="tabular-nums">
                  {formatCurrency(invoice.total, invoice.currency)}
                </span>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>Amount Paid</span>
                <span className="tabular-nums">
                  -{formatCurrency(invoice.amountPaid, invoice.currency)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-sm font-bold">
                <span>Balance Due</span>
                <span className="tabular-nums">
                  {formatCurrency(invoice.balanceDue, invoice.currency)}
                </span>
              </div>
            </div>
          </div>

          {(invoice.notes || invoice.terms) && (
            <div className="mt-5 space-y-1 border-t pt-4 text-xs text-muted-foreground">
              {invoice.notes && (
                <p>
                  <strong className="text-foreground">Notes:</strong> {invoice.notes}
                </p>
              )}
              {invoice.terms && (
                <p>
                  <strong className="text-foreground">Terms:</strong> {invoice.terms}
                </p>
              )}
            </div>
          )}

          {invoice.payments.length > 0 && (
            <div className="mt-5 border-t pt-4">
              <p className="mb-2 text-xs font-semibold">Payment History</p>
              <div className="space-y-1.5 text-xs">
                {invoice.payments.map((pay) => (
                  <div
                    key={pay.id}
                    className="flex items-center justify-between rounded bg-muted/30 px-2.5 py-1.5"
                  >
                    <span>
                      {pay.method.replace("_", " ")}
                      {pay.reference ? ` (${pay.reference})` : ""} ·{" "}
                      {formatDate(pay.paidAt.slice(0, 10), { withYear: true })}
                    </span>
                    <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                      +{formatCurrency(pay.amount, invoice.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
