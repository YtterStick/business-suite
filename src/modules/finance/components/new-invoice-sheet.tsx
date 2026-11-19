"use client";

import * as React from "react";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { addDays, toIsoDate } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { createInvoiceAction, updateInvoiceAction } from "@/modules/finance/invoices.actions";
import type {
  InvoiceRecordDTO,
  InvoicesWorkspaceDTO,
} from "@/modules/finance/invoices.types";

interface DraftLineRow {
  localId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  taxRate: string;
}

const PAYMENT_TERM_PRESETS = [
  { label: "Due on Receipt", days: 0 },
  { label: "Net 15", days: 15 },
  { label: "Net 30", days: 30 },
  { label: "Net 45", days: 45 },
  { label: "Net 60", days: 60 },
  { label: "Custom", days: -1 },
];

function computeLinePreview(row: DraftLineRow) {
  const qty = Math.max(0, Number(row.quantity) || 0);
  const rate = Math.max(0, Number(row.unitPrice) || 0);
  const disc = Math.min(100, Math.max(0, Number(row.discountRate) || 0));
  const tax = Math.min(100, Math.max(0, Number(row.taxRate) || 0));
  const sub = qty * rate * (1 - disc / 100);
  const taxAmt = (sub * tax) / 100;
  return { sub, taxAmt, total: sub + taxAmt };
}

export function NewInvoiceSheet({
  open,
  onOpenChange,
  orgSlug,
  workspace,
  editingInvoice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  workspace: InvoicesWorkspaceDTO;
  editingInvoice: InvoiceRecordDTO | null;
}) {
  const [companyId, setCompanyId] = React.useState("");
  const [contactId, setContactId] = React.useState("");
  const [dealId, setDealId] = React.useState("");
  const [issueDate, setIssueDate] = React.useState(workspace.todayIso);
  const [termDays, setTermDays] = React.useState(
    workspace.organization.defaultPaymentTermsDays,
  );
  const [dueDate, setDueDate] = React.useState(() =>
    toIsoDate(
      addDays(
        new Date(`${workspace.todayIso}T00:00:00.000Z`),
        workspace.organization.defaultPaymentTermsDays,
      ),
    ),
  );
  const [currency, setCurrency] = React.useState(workspace.organization.defaultCurrency || "PHP");
  const [notes, setNotes] = React.useState("");
  const [terms, setTerms] = React.useState(
    `Net ${workspace.organization.defaultPaymentTermsDays} days.`,
  );
  const [lineRows, setLineRows] = React.useState<DraftLineRow[]>([
    {
      localId: "line-1",
      description: "",
      quantity: "1",
      unitPrice: "0",
      discountRate: "0",
      taxRate: "0",
    },
  ]);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setError(null);

    if (editingInvoice) {
      setCompanyId(editingInvoice.company?.id ?? "");
      setContactId(editingInvoice.contact?.id ?? "");
      setDealId(editingInvoice.deal?.id ?? "");
      setIssueDate(editingInvoice.issueDate);
      setDueDate(editingInvoice.dueDate);
      setTermDays(-1);
      setCurrency(editingInvoice.currency);
      setNotes(editingInvoice.notes ?? "");
      setTerms(editingInvoice.terms ?? "");
      setLineRows(
        editingInvoice.lineItems.map((line, idx) => ({
          localId: `edit-${idx}-${line.id}`,
          description: line.description,
          quantity: String(line.quantity),
          unitPrice: String(line.unitPrice),
          discountRate: String(line.discountRate),
          taxRate: String(line.taxRate),
        })),
      );
      return;
    }

    const defDays = workspace.organization.defaultPaymentTermsDays;
    setCompanyId("");
    setContactId("");
    setDealId("");
    setIssueDate(workspace.todayIso);
    setTermDays(defDays);
    setDueDate(
      toIsoDate(addDays(new Date(`${workspace.todayIso}T00:00:00.000Z`), defDays)),
    );
    setCurrency(workspace.organization.defaultCurrency || "PHP");
    setNotes("");
    setTerms(`Net ${defDays} days.`);
    setLineRows([
      {
        localId: `line-${Date.now()}`,
        description: "",
        quantity: "1",
        unitPrice: "0",
        discountRate: "0",
        taxRate: "0",
      },
    ]);
  }, [open, editingInvoice, workspace]);

  const handleTermChange = (days: number) => {
    setTermDays(days);
    if (days >= 0 && issueDate) {
      setDueDate(toIsoDate(addDays(new Date(`${issueDate}T00:00:00.000Z`), days)));
      setTerms(days === 0 ? "Due on receipt." : `Net ${days} days.`);
    }
  };

  const handleIssueDateChange = (nextIssue: string) => {
    setIssueDate(nextIssue);
    if (termDays >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(nextIssue)) {
      setDueDate(toIsoDate(addDays(new Date(`${nextIssue}T00:00:00.000Z`), termDays)));
    }
  };

  const handleDealSelect = (selectedDealId: string) => {
    setDealId(selectedDealId);
    const deal = workspace.deals.find((d) => d.id === selectedDealId);
    if (!deal) return;
    if (deal.companyId) setCompanyId(deal.companyId);
    if (deal.contactId) setContactId(deal.contactId);
    setCurrency(deal.currency);
    if (lineRows.length === 1 && !lineRows[0]?.description.trim()) {
      setLineRows([
        {
          localId: lineRows[0]!.localId,
          description: `${deal.title} — Services`,
          quantity: "1",
          unitPrice: String(deal.amount),
          discountRate: "0",
          taxRate: "0",
        },
      ]);
    }
  };

  const filteredContacts = React.useMemo(() => {
    if (!companyId) return workspace.contacts;
    const matches = workspace.contacts.filter((c) => c.companyId === companyId);
    return matches.length > 0 ? matches : workspace.contacts;
  }, [companyId, workspace.contacts]);

  const addLineRow = () => {
    setLineRows((prev) => [
      ...prev,
      {
        localId: `line-${Date.now()}-${prev.length}`,
        description: "",
        quantity: "1",
        unitPrice: "0",
        discountRate: "0",
        taxRate: "0",
      },
    ]);
  };

  const updateLineRow = (localId: string, patch: Partial<DraftLineRow>) => {
    setLineRows((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  };

  const removeLineRow = (localId: string) => {
    setLineRows((prev) => (prev.length > 1 ? prev.filter((r) => r.localId !== localId) : prev));
  };

  const totals = lineRows.reduce(
    (acc, row) => {
      const p = computeLinePreview(row);
      return {
        subtotal: acc.subtotal + p.sub,
        taxTotal: acc.taxTotal + p.taxAmt,
        total: acc.total + p.total,
      };
    },
    { subtotal: 0, taxTotal: 0, total: 0 },
  );

  const submitInvoice = (sendImmediately: boolean) => {
    setError(null);
    startTransition(async () => {
      const payload = {
        orgSlug,
        invoiceId: editingInvoice?.id,
        companyId: companyId || null,
        contactId: contactId || null,
        dealId: dealId || null,
        issueDate,
        dueDate,
        currency,
        notes: notes || null,
        terms: terms || null,
        sendImmediately,
        lineItems: lineRows.map((r) => ({
          description: r.description,
          quantity: Number(r.quantity),
          unitPrice: Number(r.unitPrice),
          discountRate: Number(r.discountRate || 0),
          taxRate: Number(r.taxRate || 0),
        })),
      };

      if (editingInvoice) {
        const res = await updateInvoiceAction(payload);
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
        toast.success(
          sendImmediately
            ? `Updated & sent ${editingInvoice.number}`
            : `Updated draft ${editingInvoice.number}`,
        );
      } else {
        const res = await createInvoiceAction(payload);
        if (!res.ok) {
          setError(res.error.message);
          return;
        }
        toast.success(
          sendImmediately
            ? `Created & sent invoice ${res.data.number}`
            : `Saved draft invoice ${res.data.number}`,
        );
      }
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="border-b pb-4">
          <SheetTitle>
            {editingInvoice ? `Edit Draft ${editingInvoice.number}` : "New Invoice"}
          </SheetTitle>
          <SheetDescription>
            Create a customer invoice linked to CRM accounts/deals with tax and line discounts.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 py-5">
          {/* Customer / Account + Contact + Deal */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="inv-company">Customer / Account</Label>
              <select
                id="inv-company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Select company</option>
                {workspace.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-contact">Contact</Label>
              <select
                id="inv-contact"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">Select contact</option>
                {filteredContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-deal">Linked CRM Deal</Label>
              <select
                id="inv-deal"
                value={dealId}
                onChange={(e) => handleDealSelect(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">No linked deal</option>
                {workspace.deals.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates, Payment Terms, Currency */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-issue-date">Invoice Date</Label>
              <Input
                id="inv-issue-date"
                type="date"
                value={issueDate}
                onChange={(e) => handleIssueDateChange(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-terms-preset">Payment Terms</Label>
              <select
                id="inv-terms-preset"
                value={termDays}
                onChange={(e) => handleTermChange(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {PAYMENT_TERM_PRESETS.map((p) => (
                  <option key={p.label} value={p.days}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-due-date">Due Date</Label>
              <Input
                id="inv-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setTermDays(-1);
                }}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-currency">Currency</Label>
              <select
                id="inv-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="PHP">PHP (₱)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          {/* Dynamic Line Items Table */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Line Items</Label>
              <div className="flex items-center gap-2">
                {workspace.catalogItems.length > 0 && (
                  <select
                    aria-label="Quick add catalog item"
                    value=""
                    onChange={(e) => {
                      const chosen = workspace.catalogItems.find((i) => i.id === e.target.value);
                      if (!chosen) return;
                      setLineRows((prev) => {
                        const emptyFirst =
                          prev.length === 1 &&
                          !prev[0]?.description.trim() &&
                          Number(prev[0]?.unitPrice) === 0;
                        const newRow: DraftLineRow = {
                          localId: `item-${Date.now()}-${prev.length}`,
                          description: chosen.description
                            ? `${chosen.name} — ${chosen.description}`
                            : chosen.name,
                          quantity: "1",
                          unitPrice: String(chosen.unitPrice),
                          discountRate: "0",
                          taxRate: String(chosen.taxRate),
                        };
                        return emptyFirst ? [newRow] : [...prev, newRow];
                      });
                    }}
                    className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">+ Add from Items Catalog...</option>
                    {workspace.catalogItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        [{item.sku}] {item.name} ({formatCurrency(item.unitPrice, item.currency)})
                      </option>
                    ))}
                  </select>
                )}
                <Button type="button" size="xs" variant="outline" onClick={addLineRow}>
                  <Plus className="size-3.5" />
                  Add Line Item
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-2.5 py-2 text-left font-medium">Item / Description</th>
                    <th className="w-20 px-2 py-2 text-right font-medium">Qty</th>
                    <th className="w-28 px-2 py-2 text-right font-medium">Rate</th>
                    <th className="w-20 px-2 py-2 text-right font-medium">Disc %</th>
                    <th className="w-20 px-2 py-2 text-right font-medium">Tax %</th>
                    <th className="w-28 px-2.5 py-2 text-right font-medium">Amount</th>
                    <th className="w-9 px-1 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lineRows.map((row) => {
                    const preview = computeLinePreview(row);
                    return (
                      <tr key={row.localId}>
                        <td className="p-1.5">
                          <Input
                            value={row.description}
                            onChange={(e) =>
                              updateLineRow(row.localId, { description: e.target.value })
                            }
                            placeholder="Service or product item..."
                            className="h-8 text-xs"
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={row.quantity}
                            onChange={(e) =>
                              updateLineRow(row.localId, { quantity: e.target.value })
                            }
                            className="h-8 text-right text-xs tabular-nums"
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.unitPrice}
                            onChange={(e) =>
                              updateLineRow(row.localId, { unitPrice: e.target.value })
                            }
                            className="h-8 text-right text-xs tabular-nums"
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={row.discountRate}
                            onChange={(e) =>
                              updateLineRow(row.localId, { discountRate: e.target.value })
                            }
                            className="h-8 text-right text-xs tabular-nums"
                          />
                        </td>
                        <td className="p-1.5">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={row.taxRate}
                            onChange={(e) =>
                              updateLineRow(row.localId, { taxRate: e.target.value })
                            }
                            className="h-8 text-right text-xs tabular-nums"
                          />
                        </td>
                        <td className="px-2.5 py-1.5 text-right font-semibold tabular-nums">
                          {formatCurrency(preview.total, currency)}
                        </td>
                        <td className="p-1 text-center">
                          {lineRows.length > 1 && (
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              onClick={() => removeLineRow(row.localId)}
                            >
                              <Trash2 className="size-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="flex justify-end pt-2">
              <div className="w-full max-w-xs space-y-1.5 rounded-lg border bg-muted/20 p-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(totals.subtotal, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax Total</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(totals.taxTotal, currency)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1.5 text-sm font-bold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(totals.total, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-notes">Customer Notes</Label>
              <textarea
                id="inv-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Thank you for your business..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-terms">Terms &amp; Conditions</Label>
              <textarea
                id="inv-terms"
                rows={3}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Payment instructions and terms..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </div>

        <SheetFooter className="flex-row flex-wrap justify-between gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => submitInvoice(false)}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Save as Draft
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => submitInvoice(true)}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Save &amp; Send
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
