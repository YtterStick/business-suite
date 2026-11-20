import { toIsoDate } from "@/lib/dates";
import { can } from "@/lib/rbac";
import { TaskKanbanBoard } from "@/modules/projects/components/task-kanban-board";
import { getTasksBoard } from "@/modules/projects/projects.service";
import { requireTenant } from "@/server/tenancy";

interface TasksPageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ projectId?: string; new?: string; taskId?: string }>;
}

export default async function ProjectTasksPage({ params, searchParams }: TasksPageProps) {
  const { orgSlug } = await params;
  const { projectId, new: newParam, taskId } = await searchParams;
  const tenant = await requireTenant(orgSlug);
  const board = await getTasksBoard(tenant);

  return (
    <TaskKanbanBoard
      orgSlug={orgSlug}
      todayIso={toIsoDate(new Date())}
      currentUserId={tenant.user.id}
      initialBoard={board}
      canWrite={can(tenant, "projects.project.write")}
      defaultProjectId={projectId}
      openCreateInitially={newParam === "1"}
      initialTaskId={taskId ?? null}
    />
  );
}
