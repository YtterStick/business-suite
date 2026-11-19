import { toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/rbac";
import { MilestonesPanel, type PhaseRowDTO } from "@/modules/projects/components/milestones-panel";
import { extractZohoMeta, type PhaseMeta } from "@/modules/projects/zoho-meta";
import { authorize, requireTenant } from "@/server/tenancy";

export default async function MilestonesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { orgSlug } = await params;
  const query = await searchParams;
  const tenant = await requireTenant(orgSlug);
  authorize(tenant, "projects.project.read");

  const [milestones, projects, memberships] = await Promise.all([
    db.milestone.findMany({
      where: { organizationId: tenant.organization.id },
      orderBy: [{ project: { name: "asc" } }, { position: "asc" }],
      include: {
        project: {
          select: {
            id: true,
            name: true,
            startDate: true,
            owner: { select: { id: true, name: true } },
            company: { select: { name: true } },
          },
        },
        tasks: {
          select: { status: true },
        },
      },
    }),
    db.project.findMany({
      where: { organizationId: tenant.organization.id, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.membership.findMany({
      where: { organizationId: tenant.organization.id },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  const byIdName = new Map(milestones.map((m) => [m.id, m.name]));
  const previousInProject = new Map<string, { id: string; name: string }>();

  const rows: PhaseRowDTO[] = milestones.map((m, idx) => {
    const { cleanDescription, meta } = extractZohoMeta<PhaseMeta>(m.description);
    const totalTasks = m.tasks.length;
    const doneTasks = m.tasks.filter((t) => t.status === "DONE").length;
    const prev = previousInProject.get(m.projectId) ?? null;
    previousInProject.set(m.projectId, { id: m.id, name: m.name });

    const resolvedDependsOnId =
      meta.dependsOnId !== undefined ? meta.dependsOnId : prev?.id ?? null;
    const resolvedDependsOnName = resolvedDependsOnId
      ? (byIdName.get(resolvedDependsOnId) ?? null)
      : null;

    const defaultFlag: "Internal" | "External" =
      m.project.company && m.position > 0 ? "External" : "Internal";

    return {
      id: m.id,
      phaseKey: `PH-${idx + 1}`,
      projectId: m.projectId,
      projectName: m.project.name,
      name: m.name,
      description: cleanDescription || null,
      status: m.status,
      startDate:
        meta.startDate ??
        (m.project.startDate ? toIsoDate(m.project.startDate) : toIsoDate(m.createdAt)),
      dueDate: m.dueDate ? toIsoDate(m.dueDate) : null,
      position: m.position,
      flag: meta.flag ?? defaultFlag,
      ownerId: meta.ownerId ?? m.project.owner?.id ?? null,
      ownerName: meta.ownerName ?? m.project.owner?.name ?? "Unassigned",
      dependsOnId: resolvedDependsOnId,
      dependsOnName: resolvedDependsOnName,
      totalTasks,
      doneTasks,
      signoffStatus: m.signoffStatus,
    };
  });

  return (
    <MilestonesPanel
      orgSlug={orgSlug}
      todayIso={toIsoDate(new Date())}
      milestones={rows}
      projects={projects}
      members={memberships.map((m) => m.user)}
      canWrite={can(tenant.role, "projects.project.write")}
      openCreateInitially={query.new === "1"}
    />
  );
}
