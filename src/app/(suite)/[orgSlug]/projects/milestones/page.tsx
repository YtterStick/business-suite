import { toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { MilestonesPanel } from "@/modules/projects/components/milestones-panel";
import { authorize, requireTenant } from "@/server/tenancy";

export default async function MilestonesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { orgSlug } = await params;
  const { new: newParam } = await searchParams;
  const tenant = await requireTenant(orgSlug);
  authorize(tenant, "projects.project.read");

  const [milestones, projects] = await Promise.all([
    db.milestone.findMany({
      where: { organizationId: tenant.organization.id },
      orderBy: [{ dueDate: "asc" }, { position: "asc" }],
      include: {
        project: { select: { name: true } },
        _count: { select: { tasks: true } },
      },
    }),
    db.project.findMany({
      where: { organizationId: tenant.organization.id, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <MilestonesPanel
      orgSlug={orgSlug}
      orgName={tenant.organization.name}
      milestones={milestones.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        projectName: m.project.name,
        status: m.status,
        taskCount: m._count.tasks,
        dueDateIso: m.dueDate ? toIsoDate(m.dueDate) : null,
      }))}
      projects={projects}
      canWrite={can(tenant.role, "projects.project.write")}
      openCreateInitially={newParam === "1"}
    />
  );
}
