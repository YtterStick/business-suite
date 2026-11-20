import "server-only";

import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { can } from "@/lib/rbac";
import { getClientAccessibleProjectIds } from "@/modules/projects/projects.service";
import type { TenantContext } from "@/server/tenancy";

export type SearchModuleKind = "crm" | "finance" | "projects";

export interface GlobalSearchItemDTO {
  id: string;
  module: SearchModuleKind;
  entityType: "deal" | "contact" | "company" | "invoice" | "quote" | "project" | "task";
  title: string;
  subtitle: string;
  badge?: string;
  href: string;
}

export interface GlobalSearchGroupDTO {
  module: SearchModuleKind;
  label: string;
  items: GlobalSearchItemDTO[];
}

export async function globalSearch(
  ctx: TenantContext,
  rawQuery: string,
): Promise<GlobalSearchGroupDTO[]> {
  const query = rawQuery.trim();
  if (query.length === 0) return [];

  const orgId = ctx.organization.id;
  const orgSlug = ctx.organization.slug;
  const clientIds = await getClientAccessibleProjectIds(ctx);

  const [deals, contacts, companies, invoices, quotes, projects, tasks] = await Promise.all([
    can(ctx, "crm.deal.read")
      ? db.deal.findMany({
          where: {
            organizationId: orgId,
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { company: { name: { contains: query, mode: "insensitive" } } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true,
            title: true,
            amount: true,
            currency: true,
            stage: { select: { name: true } },
            company: { select: { name: true } },
          },
        })
      : Promise.resolve([]),

    can(ctx, "crm.contact.read")
      ? db.contact.findMany({
          where: {
            organizationId: orgId,
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            lifecycleStage: true,
            company: { select: { name: true } },
          },
        })
      : Promise.resolve([]),

    can(ctx, "crm.contact.read")
      ? db.company.findMany({
          where: {
            organizationId: orgId,
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { domain: { contains: query, mode: "insensitive" } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 4,
          select: { id: true, name: true, industry: true, domain: true },
        })
      : Promise.resolve([]),

    can(ctx, "finance.invoice.read")
      ? db.invoice.findMany({
          where: {
            organizationId: orgId,
            OR: [
              { number: { contains: query, mode: "insensitive" } },
              { company: { name: { contains: query, mode: "insensitive" } } },
              { deal: { title: { contains: query, mode: "insensitive" } } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            currency: true,
            company: { select: { name: true } },
          },
        })
      : Promise.resolve([]),

    can(ctx, "finance.invoice.read")
      ? db.quote.findMany({
          where: {
            organizationId: orgId,
            OR: [
              { number: { contains: query, mode: "insensitive" } },
              { company: { name: { contains: query, mode: "insensitive" } } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 4,
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            currency: true,
            company: { select: { name: true } },
          },
        })
      : Promise.resolve([]),

    can(ctx, "projects.project.read")
      ? db.project.findMany({
          where: {
            organizationId: orgId,
            ...(clientIds ? { id: { in: Array.from(clientIds) } } : {}),
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { company: { name: { contains: query, mode: "insensitive" } } },
            ],
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true,
            name: true,
            status: true,
            company: { select: { name: true } },
          },
        })
      : Promise.resolve([]),

    can(ctx, "projects.project.read")
      ? db.task.findMany({
          where: {
            organizationId: orgId,
            ...(clientIds ? { projectId: { in: Array.from(clientIds) } } : {}),
            title: { contains: query, mode: "insensitive" },
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
          select: {
            id: true,
            title: true,
            status: true,
            isArchived: true,
            project: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const crmItems: GlobalSearchItemDTO[] = [
    ...deals.map((d) => ({
      id: d.id,
      module: "crm" as const,
      entityType: "deal" as const,
      title: d.title,
      subtitle: [d.company?.name, formatCurrency(Number(d.amount), d.currency)].filter(Boolean).join(" · "),
      badge: d.stage.name,
      href: `/${orgSlug}/crm/deals?deal=${d.id}`,
    })),
    ...contacts.map((c) => ({
      id: c.id,
      module: "crm" as const,
      entityType: "contact" as const,
      title: `${c.firstName} ${c.lastName}`.trim(),
      subtitle: [c.company?.name, c.email].filter(Boolean).join(" · ") || "Contact",
      badge: c.lifecycleStage,
      href: `/${orgSlug}/crm/contacts?q=${encodeURIComponent(c.email ?? c.lastName)}`,
    })),
    ...companies.map((co) => ({
      id: co.id,
      module: "crm" as const,
      entityType: "company" as const,
      title: co.name,
      subtitle: [co.industry, co.domain].filter(Boolean).join(" · ") || "Company",
      href: `/${orgSlug}/crm/companies?q=${encodeURIComponent(co.name)}`,
    })),
  ];

  const financeItems: GlobalSearchItemDTO[] = [
    ...invoices.map((inv) => ({
      id: inv.id,
      module: "finance" as const,
      entityType: "invoice" as const,
      title: inv.number,
      subtitle: [inv.company?.name, formatCurrency(Number(inv.total), inv.currency)]
        .filter(Boolean)
        .join(" · "),
      badge: inv.status,
      href: `/${orgSlug}/finance/invoices?highlight=${inv.id}`,
    })),
    ...quotes.map((q) => ({
      id: q.id,
      module: "finance" as const,
      entityType: "quote" as const,
      title: q.number,
      subtitle: [q.company?.name, formatCurrency(Number(q.total), q.currency)]
        .filter(Boolean)
        .join(" · "),
      badge: q.status,
      href: `/${orgSlug}/finance/quotes?highlight=${q.id}`,
    })),
  ];

  const projectItems: GlobalSearchItemDTO[] = [
    ...projects.map((proj) => ({
      id: proj.id,
      module: "projects" as const,
      entityType: "project" as const,
      title: proj.name,
      subtitle: proj.company?.name ?? "Client Project",
      badge: proj.status,
      href: `/${orgSlug}/projects?highlight=${proj.id}`,
    })),
    ...tasks.map((t) => ({
      id: t.id,
      module: "projects" as const,
      entityType: "task" as const,
      title: t.title,
      subtitle: t.isArchived ? `${t.project.name} · Archived` : t.project.name,
      badge: t.isArchived ? "ARCHIVED" : t.status,
      href: `/${orgSlug}/projects/tasks?taskId=${t.id}`,
    })),
  ];

  const groups: GlobalSearchGroupDTO[] = [];
  if (crmItems.length > 0) {
    groups.push({ module: "crm", label: "CRM", items: crmItems });
  }
  if (financeItems.length > 0) {
    groups.push({ module: "finance", label: "Finance", items: financeItems });
  }
  if (projectItems.length > 0) {
    groups.push({ module: "projects", label: "Projects", items: projectItems });
  }

  return groups;
}
