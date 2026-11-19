import { Building2, Globe } from "lucide-react";

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
import { db } from "@/lib/db";
import { authorize, requireTenant } from "@/server/tenancy";

interface CompaniesPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function CompaniesPage({ params, searchParams }: CompaniesPageProps) {
  const { orgSlug } = await params;
  const { q } = await searchParams;
  const tenant = await requireTenant(orgSlug);
  authorize(tenant, "crm.contact.read");

  const search = q?.trim() ?? "";

  const companies = await db.company.findMany({
    where: {
      organizationId: tenant.organization.id,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { domain: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { contacts: true, deals: true, invoices: true, projects: true },
      },
    },
  });

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">CRM Companies</h1>
          <p className="text-sm text-muted-foreground">
            Account records shared across Deals, Invoices, and Client Projects.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Building2 className="size-3.5" />
          {companies.length} Companies
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accounts</CardTitle>
          <CardDescription>
            {search
              ? `Filtered by "${search}" inside ${tenant.organization.name}.`
              : `All accounts inside ${tenant.organization.name}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Linked Records</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No companies found in this organization.
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div className="font-medium">{company.name}</div>
                      {company.domain && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Globe className="size-3" />
                          <span>{company.domain}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {company.industry ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[company.city, company.country].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {company._count.contacts} contacts · {company._count.deals} deals ·{" "}
                      {company._count.invoices} invoices · {company._count.projects} projects
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
