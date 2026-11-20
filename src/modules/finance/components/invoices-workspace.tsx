"use client";

import * as React from "react";
import type { InvoiceStatus } from "@prisma/client";
import {
  AlertCircle,
  Ban,
  CalendarClock,
  CreditCard,
  Download,
  Eye,
  FileEdit,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  addToTotals,
  formatCurrency,
  formatCurrencyTotals,
  formatDate,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  InvoiceDetailDialog,
  openInvoicePdfPrintView,
} from "@/modules/finance/components/invoice-detail-dialog";
import { NewInvoiceSheet } from "@/modules/finance/components/new-invoice-sheet";
import { sendInvoicesAction, voidInvoicesAction } from "@/modules/finance/invoices.actions";
import type {
  InvoiceRecordDTO,
  InvoicesWorkspaceDTO,
} from "@/modules/finance/invoices.types";

type StatusTab = "ALL" | InvoiceStatus;

const STATUS_TABS: Array<{ id: StatusTab; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "DRAFT", label: "Draft" },
  { id: "SENT", label: "Sent" },
  { id: "PARTIALLY_PAID", label: "Partially Paid" },
  { id: "PAID", label: "Paid" },
  { id: "OVERDUE", label: "Overdue" },
  { id: "VOID", label: "Void" },
];

export function InvoicesWorkspace({
  orgSlug,
  workspace,
  canWrite,
  canVoid,
  openCreateInitially = false,
  highlightInvoiceId,
}: {
  orgSlug: string;
  workspace: InvoicesWorkspaceDTO;
  canWrite: boolean;
  canVoid: boolean;
  openCreateInitially?: boolean;
  highlightInvoiceId?: string;
}) {
  const [statusTab, setStatusTab] = React.useState<StatusTab>("ALL");
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = React.useState(openCreateInitially);
  const [editingInvoice, setEditingInvoice] = React.useState<InvoiceRecordDTO | null>(null);
  const [detailInvoiceId, setDetailInvoiceId] = React.useState<string | null>(
    highlightInvoiceId ?? null,
  );
  const [detailPaymentOpen, setDetailPaymentOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const defaultCurrency = workspace.organization.defaultCurrency;

  // Receivables KPIs
  const kpis = React.useMemo(() => {
    const outstanding: Record<string, number> = {};
    const drafts: Record<string, number> = {};
    const dueWithin30: Record<string, number> = {};
    const overdue: Record<string, number> = {};

    for (const inv of workspace.invoices) {
      if (inv.effectiveStatus === "DRAFT") {
        addToTotals(drafts, inv.currency, inv.total);
      } else if (
        inv.effectiveStatus !== "VOID" &&
        inv.effectiveStatus !== "PAID" &&
        inv.balanceDue > 0
      ) {
        addToTotals(outstanding, inv.currency, inv.balanceDue);
        if (inv.effectiveStatus === "OVERDUE") {
          addToTotals(overdue, inv.currency, inv.balanceDue);
        } else if (
          inv.dueDate >= workspace.todayIso &&
          inv.dueDate <= workspace.dueSoonIso
        ) {
          addToTotals(dueWithin30, inv.currency, inv.balanceDue);
        }
      }
    }

    return { outstanding, drafts, dueWithin30, overdue };
  }, [workspace.invoices, workspace.todayIso, workspace.dueSoonIso]);

  const tabCounts = React.useMemo(() => {
    const counts: Record<StatusTab, number> = {
      ALL: workspace.invoices.length,
      DRAFT: 0,
      SENT: 0,
      PARTIALLY_PAID: 0,
      PAID: 0,
      OVERDUE: 0,
      VOID: 0,
    };
    for (const inv of workspace.invoices) {
      counts[inv.effectiveStatus] += 1;
    }
    return counts;
  }, [workspace.invoices]);

  const filteredInvoices = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return workspace.invoices.filter((inv) => {
      if (statusTab !== "ALL" && inv.effectiveStatus !== statusTab) return false;
      if (!q) return true;
      return (
        inv.number.toLowerCase().includes(q) ||
        (inv.company?.name.toLowerCase().includes(q) ?? false) ||
        (inv.contact?.fullName.toLowerCase().includes(q) ?? false) ||
        (inv.deal?.title.toLowerCase().includes(q) ?? false)
      );
    });
  }, [workspace.invoices, statusTab, search]);

  const allVisibleSelected =
    filteredInvoices.length > 0 &&
    filteredInvoices.every((inv) => selectedIds.includes(inv.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredInvoices.map((inv) => inv.id));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleBulkSend = (ids: string[]) => {
    startTransition(async () => {
      const res = await sendInvoicesAction({ orgSlug, invoiceIds: ids });
      if (!res.ok) toast.error(res.error.message);
      else {
        setSelectedIds([]);
        toast.success(`Marked ${res.data.count} draft invoice(s) as Sent`);
      }
    });
  };

  const handleBulkVoid = (ids: string[]) => {
    startTransition(async () => {
      const res = await voidInvoicesAction({ orgSlug, invoiceIds: ids });
      if (!res.ok) toast.error(res.error.message);
      else {
        setSelectedIds([]);
        toast.success(`Voided ${res.data.count} invoice(s)`);
      }
    });
  };

  const detailInvoice = React.useMemo(
    () => workspace.invoices.find((i) => i.id === detailInvoiceId) ?? null,
    [workspace.invoices, detailInvoiceId],
  );

  const openNewInvoice = () => {
    setEditingInvoice(null);
    setSheetOpen(true);
  };

  const openEditDraft = (inv: InvoiceRecordDTO) => {
    setEditingInvoice(inv);
    setSheetOpen(true);
  };

  const openDetail = (inv: InvoiceRecordDTO, withPayment = false) => {
    setDetailPaymentOpen(withPayment);
    setDetailInvoiceId(inv.id);
  };

  return (
    <div className="space-y-5 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Manage customer invoices, payments, and Closed Won CRM auto-drafts.
          </p>
        </div>

        {canWrite && (
          <Button onClick={openNewInvoice}>
            <Plus className="size-4" />
            New Invoice
          </Button>
        )}
      </div>

      {/* Receivables Summary KPI Ribbon */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Total Outstanding</span>
              <Wallet className="size-4 text-blue-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrencyTotals(kpis.outstanding, defaultCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Unpaid Sent, Partially Paid &amp; Overdue
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Drafts Total</span>
              <FileEdit className="size-4 text-slate-500" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrencyTotals(kpis.drafts, defaultCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {tabCounts.DRAFT} draft invoice(s) awaiting send
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Due Within 30 Days</span>
              <CalendarClock className="size-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrencyTotals(kpis.dueWithin30, defaultCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Current receivables due in next 30d
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Overdue Amount</span>
              <AlertCircle className="size-4 text-rose-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums text-rose-600">
              {formatCurrencyTotals(kpis.overdue, defaultCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {tabCounts.OVERDUE} past-due invoice(s)
          </CardContent>
        </Card>
      </div>

      {/* Ledger Toolbar + Table */}
      <Card>
        <CardHeader className="space-y-4 border-b pb-4">
          {/* Status Filter Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist">
              {STATUS_TABS.map((tab) => {
                const isActive = statusTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setStatusTab(tab.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "rounded px-1 text-[10px] tabular-nums",
                        isActive ? "bg-primary-foreground/20" : "bg-muted",
                      )}
                    >
                      {tabCounts[tab.id]}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative w-64">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice #, client, deal..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          {/* Bulk Selection Action Bar */}
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
              <span className="font-medium">
                {selectedIds.length} invoice(s) selected
              </span>
              <div className="flex items-center gap-2">
                {canWrite && (
                  <Button
                    type="button"
                    size="xs"
                    disabled={isPending}
                    onClick={() => handleBulkSend(selectedIds)}
                  >
                    <Send className="size-3.5" />
                    Send Drafts
                  </Button>
                )}
                {canVoid && (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="text-destructive"
                    disabled={isPending}
                    onClick={() => handleBulkVoid(selectedIds)}
                  >
                    <Ban className="size-3.5" />
                    Void Selected
                  </Button>
                )}
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => setSelectedIds([])}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">
                  <input
                    type="checkbox"
                    aria-label="Select all visible invoices"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    className="size-4 cursor-pointer rounded border-input accent-primary"
                  />
                </TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>Client / Deal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance Due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="p-4">
                    <EmptyState
                      icon={Wallet}
                      title={
                        workspace.invoices.length === 0
                          ? "No invoices yet"
                          : "No invoices match this filter"
                      }
                      description="Create an invoice directly in Finance or close a CRM deal as Won to auto-generate one."
                      compact
                      action={
                        canWrite
                          ? {
                              label: "New Invoice",
                              icon: <Plus className="size-3.5" />,
                              onClick: () => setSheetOpen(true),
                            }
                          : undefined
                      }
                      secondaryAction={
                        statusTab !== "ALL" || search.trim()
                          ? {
                              label: "Clear filters",
                              onClick: () => {
                                setStatusTab("ALL");
                                setSearch("");
                              },
                            }
                          : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((inv) => {
                  const isSelected = selectedIds.includes(inv.id);
                  const isOverdue = inv.effectiveStatus === "OVERDUE";

                  return (
                    <TableRow
                      key={inv.id}
                      onClick={() => openDetail(inv)}
                      className={cn(
                        "cursor-pointer",
                        highlightInvoiceId === inv.id && "bg-emerald-500/10",
                      )}
                    >
                      <TableCell
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${inv.number}`}
                          checked={isSelected}
                          onChange={() => toggleSelectRow(inv.id)}
                          className="size-4 cursor-pointer rounded border-input accent-primary"
                        />
                      </TableCell>

                      <TableCell>
                        <div className="font-mono text-sm font-semibold text-primary">
                          {inv.number}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {inv.lineItems.length} item(s)
                        </div>
                      </TableCell>

                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {formatDate(inv.issueDate, { withYear: true })}
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">
                          {inv.company?.name ?? inv.contact?.fullName ?? "Unassigned"}
                        </div>
                        {inv.deal && (
                          <Link
                            href={`/${orgSlug}/crm/deals`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                          >
                            Deal: {inv.deal.title}
                          </Link>
                        )}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={
                            inv.effectiveStatus === "PAID"
                              ? "default"
                              : inv.effectiveStatus === "OVERDUE" ||
                                  inv.effectiveStatus === "VOID"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {inv.effectiveStatus.replace("_", " ")}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {inv.source === "AUTOMATION" ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-emerald-500/30 text-[10px] text-emerald-700 dark:text-emerald-300"
                          >
                            <Sparkles className="size-3" />
                            Automation
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{inv.source}</span>
                        )}
                      </TableCell>

                      <TableCell
                        className={cn(
                          "text-sm whitespace-nowrap",
                          isOverdue ? "font-semibold text-rose-600" : "text-muted-foreground",
                        )}
                      >
                        {formatDate(inv.dueDate, { withYear: true })}
                      </TableCell>

                      <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                        {formatCurrency(inv.total, inv.currency)}
                      </TableCell>

                      <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
                        {formatCurrency(inv.balanceDue, inv.currency)}
                      </TableCell>

                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              aria-label={`Actions for ${inv.number}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onSelect={() => openDetail(inv)}>
                              <Eye className="size-3.5" />
                              View / Preview
                            </DropdownMenuItem>
                            {canWrite && inv.status === "DRAFT" && (
                              <DropdownMenuItem onSelect={() => openEditDraft(inv)}>
                                <Pencil className="size-3.5" />
                                Edit Draft
                              </DropdownMenuItem>
                            )}
                            {canWrite && inv.status === "DRAFT" && (
                              <DropdownMenuItem onSelect={() => handleBulkSend([inv.id])}>
                                <Send className="size-3.5" />
                                Send Invoice
                              </DropdownMenuItem>
                            )}
                            {canWrite &&
                              inv.status !== "VOID" &&
                              inv.status !== "PAID" &&
                              inv.balanceDue > 0 && (
                                <DropdownMenuItem onSelect={() => openDetail(inv, true)}>
                                  <CreditCard className="size-3.5" />
                                  Record Payment
                                </DropdownMenuItem>
                              )}
                            <DropdownMenuItem
                              onSelect={() =>
                                openInvoicePdfPrintView(inv, workspace.organization.name)
                              }
                            >
                              <Download className="size-3.5" />
                              Download PDF
                            </DropdownMenuItem>
                            {canVoid && inv.status !== "VOID" && inv.status !== "PAID" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => handleBulkVoid([inv.id])}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Ban className="size-3.5" />
                                  Void Invoice
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewInvoiceSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        orgSlug={orgSlug}
        workspace={workspace}
        editingInvoice={editingInvoice}
      />

      <InvoiceDetailDialog
        open={detailInvoice !== null}
        onOpenChange={(open) => {
          if (!open) setDetailInvoiceId(null);
        }}
        orgSlug={orgSlug}
        orgName={workspace.organization.name}
        todayIso={workspace.todayIso}
        invoice={detailInvoice}
        canWrite={canWrite}
        canVoid={canVoid}
        onEditDraft={openEditDraft}
        initialPaymentOpen={detailPaymentOpen}
      />
    </div>
  );
}
