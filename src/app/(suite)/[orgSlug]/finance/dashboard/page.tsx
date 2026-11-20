import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  FileText,
  HelpCircle,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatCurrencyTotals, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getFinanceDashboard } from "@/modules/finance/finance-suite.service";
import { requireTenant } from "@/server/tenancy";

export default async function FinanceDashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  const data = await getFinanceDashboard(tenant);

  const maxFlow = Math.max(1, ...data.cashFlow.flatMap((m) => [m.inflow, m.outflow]));

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Finance Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Cash flow, receivables vs. payables, and recent billing activity for{" "}
            {tenant.organization.name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/${orgSlug}/finance/expenses`}>
              <Wallet className="size-4" />
              Expenses
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/${orgSlug}/finance/invoices?new=1`}>
              <Receipt className="size-4" />
              New Invoice
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                Total Receivables
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="What is Total Receivables?"
                      className="text-muted-foreground/70 hover:text-foreground"
                    >
                      <HelpCircle className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-60">
                    Unpaid money owed to you by clients across Sent, Partially Paid, and Overdue invoices.
                  </TooltipContent>
                </Tooltip>
              </span>
              <ArrowDownLeft className="size-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrencyTotals(data.receivablesByCurrency, data.defaultCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-rose-600">
            Overdue:{" "}
            {formatCurrencyTotals(data.overdueReceivablesByCurrency, data.defaultCurrency)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                Total Payables
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="What is Total Payables?"
                      className="text-muted-foreground/70 hover:text-foreground"
                    >
                      <HelpCircle className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-60">
                    Outgoing project expenses and approved team reimbursement claims waiting to be settled.
                  </TooltipContent>
                </Tooltip>
              </span>
              <ArrowUpRight className="size-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrencyTotals(data.payablesByCurrency, data.defaultCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Unpaid expenses &amp; pending claims
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Payments Collected</span>
              <CreditCard className="size-4 text-blue-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums text-emerald-600">
              {formatCurrencyTotals(data.collectedByCurrency, data.defaultCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Total settled customer payments
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Recorded Expenses</span>
              <Wallet className="size-4 text-rose-600" />
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {formatCurrencyTotals(data.expensesTotalByCurrency, data.defaultCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Billable &amp; operating expenses
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Chart + Recent Billing Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-emerald-600" />
              6-Month Cash Flow
            </CardTitle>
            <CardDescription>Payments received (inflow) vs. expenses (outflow)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-4 pt-2">
              {data.cashFlow.map((month) => {
                const inPct = Math.round((month.inflow / maxFlow) * 100);
                const outPct = Math.round((month.outflow / maxFlow) * 100);
                return (
                  <div key={month.monthKey} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-40 w-full items-end justify-center gap-1.5">
                      <div
                        title={`Inflow: ${formatCurrency(month.inflow, data.defaultCurrency)}`}
                        className="w-4 rounded-t bg-emerald-500"
                        style={{ height: `${Math.max(4, inPct)}%` }}
                      />
                      <div
                        title={`Outflow: ${formatCurrency(month.outflow, data.defaultCurrency)}`}
                        className="w-4 rounded-t bg-rose-500/80"
                        style={{ height: `${Math.max(4, outPct)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{month.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-6 border-t pt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-emerald-500" />
                Cash Inflow (Payments)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-xs bg-rose-500/80" />
                Cash Outflow (Expenses)
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Billing Activity</CardTitle>
              <CardDescription>Latest invoices, payments, and expenses</CardDescription>
            </div>
            <Link
              href={`/${orgSlug}/finance/invoices`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Open Ledger →
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.recentActivity.length === 0 ? (
              <div className="space-y-3 py-2">
                <p className="text-xs text-muted-foreground">
                  No billing activity yet. Start your ledger with one of these actions:
                </p>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <Link
                    href={`/${orgSlug}/finance/quotes`}
                    className="group rounded-xl border bg-muted/20 p-3.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <FileText className="size-4 text-blue-600" />
                    <p className="mt-2.5 text-sm font-semibold">Create a Quote</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Draft a client estimate ready to convert.
                    </p>
                  </Link>
                  <Link
                    href={`/${orgSlug}/finance/invoices?new=1`}
                    className="group rounded-xl border bg-muted/20 p-3.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <Receipt className="size-4 text-emerald-600" />
                    <p className="mt-2.5 text-sm font-semibold">Send an Invoice</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Bill a client or link a CRM deal.
                    </p>
                  </Link>
                  <Link
                    href={`/${orgSlug}/finance/expenses`}
                    className="group rounded-xl border bg-muted/20 p-3.5 transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <Wallet className="size-4 text-amber-600" />
                    <p className="mt-2.5 text-sm font-semibold">Log an Expense</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Record billable or team costs.
                    </p>
                  </Link>
                </div>
              </div>
            ) : (
              data.recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{item.title}</span>
                      <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                        {item.badge}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.subtitle} · {formatDate(item.dateIso, { withYear: true })}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-semibold tabular-nums",
                      item.kind === "payment"
                        ? "text-emerald-600"
                        : item.kind === "expense"
                          ? "text-rose-600"
                          : "text-foreground",
                    )}
                  >
                    {item.kind === "payment" ? "+" : item.kind === "expense" ? "-" : ""}
                    {formatCurrency(item.amount, item.currency)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
