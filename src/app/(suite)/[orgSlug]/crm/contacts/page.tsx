import { Building2, Mail, Phone, Users } from "lucide-react";

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

interface ContactsPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function ContactsPage({ params, searchParams }: ContactsPageProps) {
  const { orgSlug } = await params;
  const { q } = await searchParams;
  const tenant = await requireTenant(orgSlug);
  authorize(tenant, "crm.contact.read");

  const search = q?.trim() ?? "";

  const contacts = await db.contact.findMany({
    where: {
      organizationId: tenant.organization.id,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      company: { select: { id: true, name: true } },
      _count: { select: { deals: true, invoices: true } },
    },
  });

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">CRM Contacts</h1>
          <p className="text-sm text-muted-foreground">
            Contacts automatically advance to Customer when a linked deal closes won.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Users className="size-3.5" />
          {contacts.length} Contacts
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Directory</CardTitle>
          <CardDescription>
            {search
              ? `Filtered by "${search}" inside ${tenant.organization.name}.`
              : `All contacts scoped to ${tenant.organization.name}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Lifecycle</TableHead>
                <TableHead>Contact Details</TableHead>
                <TableHead className="text-right">Deals / Invoices</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No contacts found in this organization.
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <div className="font-medium">
                        {contact.firstName} {contact.lastName}
                      </div>
                      {contact.jobTitle && (
                        <div className="text-xs text-muted-foreground">{contact.jobTitle}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.company ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <Building2 className="size-3.5 text-muted-foreground" />
                          {contact.company.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          contact.lifecycleStage === "CUSTOMER" ? "default" : "secondary"
                        }
                      >
                        {contact.lifecycleStage}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        {contact.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="size-3" />
                            <span>{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="size-3" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                      {contact._count.deals} deals · {contact._count.invoices} invoices
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
