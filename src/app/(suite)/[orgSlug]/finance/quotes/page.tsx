import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatCurrency, formatDate } from "@/lib/format";
import { authorize, requireTenant } from "@/server/tenancy";

interface QuotesPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ highlight?: string }>;
}

export default async function QuotesPage({ params, searchParams }: QuotesPageProps) {
  const { orgSlug } = await params;
  const { highlight } = await searchParams;
  const tenant = await requireTenant(orgSlug);
  authorize(tenant, "finance.invoice.read");

  const quotes = await db.quote.findMany({
    where: { organizationId: tenant.organization.id },
    orderBy: [{ createdAt: "desc" }],
    include: {
      company: { select: { name: true } },
      deal: { select: { title: true } },
      _count: { select: { lineItems: true } },
    },
  });

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Finance Quotes</h1>
          <p className="text-sm text-muted-foreground">
            Accepted quotes automatically seed draft invoice line items when a deal closes won.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <FileText className="size-3.5" />
          {quotes.length} Quotes
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quotes &amp; Proposals</CardTitle>
          <CardDescription>
            Commercial proposals scoped to {tenant.organization.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Account / Deal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No quotes created yet.
                  </TableCell>
                </TableRow>
              ) : (
                quotes.map((quote) => (
                  <TableRow
                    key={quote.id}
                    className={highlight === quote.id ? "bg-emerald-500/10" : undefined}
                  >
                    <TableCell>
                      <div className="font-mono text-sm font-semibold">{quote.number}</div>
                      <div className="text-xs text-muted-foreground">
                        {quote._count.lineItems} line item(s)
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{quote.company?.name ?? "Unassigned"}</div>
                      {quote.deal && (
                        <div className="text-xs text-muted-foreground">Deal: {quote.deal.title}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={quote.status === "ACCEPTED" ? "default" : "secondary"}>
                        {quote.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(toIsoDate(quote.issueDate), { withYear: true })}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(Number(quote.total), quote.currency)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
