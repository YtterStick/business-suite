import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import {
  CollaborationPanel,
  type CollaborationAuditActivity,
} from "@/modules/projects/components/collaboration-panel";
import { listCollaborationFeed } from "@/modules/projects/projects.service";
import { requireTenant } from "@/server/tenancy";

export default async function CollaborationPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await requireTenant(orgSlug);
  const orgId = tenant.organization.id;

  const [{ comments, projects }, memberships, auditLogs] = await Promise.all([
    listCollaborationFeed(tenant),
    db.membership.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { user: { name: "asc" } },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    db.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: { in: ["Project", "Task", "Issue", "Milestone"] },
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  const memberNameById = new Map(memberships.map((m) => [m.user.id, m.user.name]));
  const auditActivities: CollaborationAuditActivity[] = auditLogs.map((log) => {
    const meta =
      log.metadata && typeof log.metadata === "object"
        ? (log.metadata as Record<string, unknown>)
        : null;
    const title = typeof meta?.title === "string" ? meta.title : typeof meta?.name === "string" ? meta.name : log.entityType;
    return {
      id: log.id,
      actorName: (log.actorId && memberNameById.get(log.actorId)) || "System",
      action: log.action,
      summary: `${log.action.replace(".", " ")} · ${title}`,
      createdAt: log.createdAt.toISOString(),
    };
  });

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Collaboration</h1>
        <p className="text-sm text-muted-foreground">
          Activity Feed, Wiki Pages, Project Forums, and Document Explorer across{" "}
          {tenant.organization.name}.
        </p>
      </div>

      <CollaborationPanel
        orgSlug={orgSlug}
        comments={comments}
        projects={projects}
        members={memberships.map((m) => m.user)}
        auditActivities={auditActivities}
        showZohoTabs
        canWrite={can(tenant.role, "projects.project.write")}
      />
    </div>
  );
}
