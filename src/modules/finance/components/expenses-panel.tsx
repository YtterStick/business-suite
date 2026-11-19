"use client";

import * as React from "react";
import { Loader2, Plus, Receipt, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { formatCurrency, formatDate } from "@/lib/format";
import {
  convertExpensesToInvoiceAction,
  createFinanceExpenseAction,
} from "@/modules/finance/finance-suite.actions";
import type { ExpensesWorkspaceDTO } from "@/modules/finance/finance-suite.service";

export function ExpensesPanel({
  orgSlug,
  data,
  canWrite,
}: {
  orgSlug: string;
  data: ExpensesWorkspaceDTO;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [billableFilter, setBillableFilter] = React.useState<"ALL" | "BILLABLE" | "NON_BILLABLE">(
    "ALL",
  );
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [open, setOpen] = React.useState(false);

  // Create expense form state
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState("Software & Cloud");
  const [vendor, setVendor] = React.useState("");
  const [amount, setAmount] = React.useState("2500");
  const [currency, setCurrency] = React.useState(data.defaultCurrency || "PHP");
  const [billable, setBillable] = React.useState(true);
  const [expenseDate, setExpenseDate] = React.useState(data.todayIso);
  const [projectId, setProjectId] = React.useState("");
  const [companyId, setCompanyId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.expenses.filter((e) => {
      if (billableFilter === "BILLABLE" && !e.billable) return false;
      if (billableFilter === "NON_BILLABLE" && e.billable) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.vendor?.toLowerCase().includes(q) ?? false) ||
        (e.project?.name.toLowerCase().includes(q) ?? false) ||
        (e.company?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [data.expenses, billableFilter, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleProjectChange = (projId: string) => {
    setProjectId(projId);
    const proj = data.projects.find((p) => p.id === projId);
    if (proj?.companyId && !companyId) {
      setCompanyId(proj.companyId);
    }
  };

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      const res = await createFinanceExpenseAction({
        orgSlug,
        title,
        category,
        vendor: vendor || null,
        amount: Number(amount),
        currency,
        billable,
        expenseDate,
        projectId: projectId || null,
        companyId: companyId || null,
        notes: notes || null,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setTitle("");
      setVendor("");
      setNotes("");
      setOpen(false);
      toast.success("Expense recorded");
    });
  };

  const handleConvertToInvoice = (ids: string[]) => {
    startTransition(async () => {
      const res = await convertExpensesToInvoiceAction({ orgSlug, expenseIds: ids });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setSelectedIds([]);
      toast.success(`Created Draft Invoice ${res.data.invoiceNumber}`, {
        action: {
          label: "View Invoice",
          onClick: () =>
            router.push(`/${orgSlug}/finance/invoices?highlight=${res.data.invoiceId}`),
        },
      });
    });
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Track operating &amp; project expenses and convert unbilled items into client invoices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canWrite && selectedIds.length > 0 && (
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => handleConvertToInvoice(selectedIds)}
            >
              <Receipt className="size-4" />
              Convert {selectedIds.length} to Draft Invoice
            </Button>
          )}
          {canWrite && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" />
              New Expense
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4 text-rose-600" />
              Expense Ledger ({filtered.length})
            </CardTitle>
            <CardDescription>
              Select unbilled billable expenses to generate a Draft Invoice automatically.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={billableFilter}
              onChange={(e) =>
                setBillableFilter(e.target.value as "ALL" | "BILLABLE" | "NON_BILLABLE")
              }
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="ALL">All Expenses</option>
              <option value="BILLABLE">Billable Only</option>
              <option value="NON_BILLABLE">Non-Billable Only</option>
            </select>
            <div className="relative w-56">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search expense, project..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Date</TableHead>
                <TableHead>Expense</TableHead>
                <TableHead>Project / Account</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No expenses recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((exp) => {
                  const canConvert = exp.billable && exp.status === "UNBILLED";
                  return (
                    <TableRow key={exp.id}>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          disabled={!canConvert}
                          checked={selectedIds.includes(exp.id)}
                          onChange={() => toggleSelect(exp.id)}
                          className="size-4 cursor-pointer rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {formatDate(exp.expenseDate, { withYear: true })}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{exp.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {exp.category}
                          {exp.vendor ? ` · ${exp.vendor}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{exp.project?.name ?? "—"}</div>
                        {exp.company && (
                          <div className="text-xs text-muted-foreground">{exp.company.name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={exp.billable ? "outline" : "secondary"}>
                          {exp.billable ? "Billable" : "Non-billable"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            exp.status === "INVOICED" || exp.status === "PAID"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {exp.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(exp.amount, exp.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {exp.invoice ? (
                          <Link
                            href={`/${orgSlug}/finance/invoices?highlight=${exp.invoice.id}`}
                            className="font-mono text-xs font-semibold text-primary hover:underline"
                          >
                            {exp.invoice.number}
                          </Link>
                        ) : canWrite && canConvert ? (
                          <Button
                            type="button"
                            size="xs"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => handleConvertToInvoice([exp.id])}
                          >
                            Convert to Invoice
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Expense</DialogTitle>
            <DialogDescription>
              Log a billable client expense or internal operating cost.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fin-exp-title">Expense title</Label>
              <Input
                id="fin-exp-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Dedicated cloud database hosting"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fin-exp-cat">Category</Label>
                <select
                  id="fin-exp-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="Software & Cloud">Software &amp; Cloud</option>
                  <option value="Contractor">Contractor</option>
                  <option value="Travel & Meals">Travel &amp; Meals</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin-exp-vendor">Vendor</Label>
                <Input
                  id="fin-exp-vendor"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="AWS, Neon, Airline..."
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fin-exp-amt">Amount</Label>
                <Input
                  id="fin-exp-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin-exp-cur">Currency</Label>
                <select
                  id="fin-exp-cur"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="PHP">PHP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin-exp-date">Date</Label>
                <Input
                  id="fin-exp-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fin-exp-proj">Link to Project</Label>
                <select
                  id="fin-exp-proj"
                  value={projectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">No project</option>
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin-exp-comp">Client / Account</Label>
                <select
                  id="fin-exp-comp"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">Internal / No client</option>
                  {data.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="size-4 rounded border-input accent-primary"
              />
              <span>Billable to client (can be converted into an Invoice)</span>
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Save Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
