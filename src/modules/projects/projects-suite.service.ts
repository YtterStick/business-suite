import "server-only";

import {
  ApprovalStatus,
  IssueStatus,
  MilestoneStatus,
  Prisma,
  ProjectStatus,
  TaskStatus,
  TimesheetStatus,
} from "@prisma/client";

import { addDays, startOfUtcDay, toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { recordAudit } from "@/server/audit";
import { authorize, type TenantContext } from "@/server/tenancy";

/** Returns the Monday (UTC) of the week containing `date`. */
export function getMondayUtc(date: Date): Date {
  const dayStart = startOfUtcDay(date);
  const dow = dayStart.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return addDays(dayStart, diffToMonday);
}

// ═════════════════════════════════ Home ═════════════════════════════════════

export interface ProjectsHomeDTO {
  todayIso: string;
  weekStartIso: string;
  defaultCurrency: string;
  overdueTasks: Array<{
    id: string;
    title: string;
    projectId: string;
    projectName: string;
    dueDate: string;
    priority: string;
  }>;
  todaysWorkItems: Array<{
    id: string;
    title: string;
    projectId: string;
    projectName: string;
    dueDate: string | null;
    status: TaskStatus;
    priority: string;
  }>;
  upcomingTasks: Array<{
    id: string;
    title: string;
    projectId: string;
    projectName: string;
    dueDate: string | null;
    status: TaskStatus;
  }>;
  openIssues: Array<{
    id: string;
    title: string;
    projectId: string;
    projectName: string;
    severity: string;
    status: IssueStatus;
  }>;
  milestonesDueSoon: Array<{
    id: string;
    name: string;
    projectId: string;
    projectName: string;
    dueDate: string | null;
    status: MilestoneStatus;
    taskCount: number;
    doneCount: number;
  }>;
  budgetProjects: Array<{
    id: string;
    name: string;
    currency: string;
    budget: number;
    actualSpend: number;
  }>;
  weeklyDailyHours: Array<{
    day: string;
    dayIso: string;
    billable: number;
    nonBillable: number;
  }>;
  weeklyHours: number;
  weeklyBillableHours: number;
  projectHealth: {
    total: number;
    active: number;
    planning: number;
    completed: number;
    onHold: number;
    overdueProjects: number;
    overallTaskCompletionPct: number;
  };
  myProjects: Array<{
    id: string;
    name: string;
    status: ProjectStatus;
    completionPct: number;
    dueDate: string | null;
  }>;
}

export async function getProjectsHome(ctx: TenantContext): Promise<ProjectsHomeDTO> {
  authorize(ctx, "projects.project.read");
  const organizationId = ctx.organization.id;
  const userId = ctx.user.id;
  const now = new Date();
  const today = startOfUtcDay(now);
  const todayIso = toIsoDate(today);
  const weekStart = getMondayUtc(now);
  const weekEnd = addDays(weekStart, 6);

  const [myTasks, myIssues, weekLogs, projects, milestones, approvedClaims] = await Promise.all([
    db.task.findMany({
      where: {
        organizationId,
        status: { not: TaskStatus.DONE },
        OR: [{ assigneeId: userId }, { project: { ownerId: userId } }],
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 40,
      include: { project: { select: { id: true, name: true } } },
    }),
    db.issue.findMany({
      where: {
        organizationId,
        status: { in: [IssueStatus.OPEN, IssueStatus.IN_PROGRESS] },
        OR: [{ assigneeId: userId }, { reporterId: userId }],
      },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 20,
      include: { project: { select: { id: true, name: true } } },
    }),
    db.timeLog.findMany({
      where: {
        organizationId,
        loggedDate: { gte: weekStart, lte: weekEnd },
      },
      select: { userId: true, projectId: true, hours: true, billable: true, loggedDate: true },
    }),
    db.project.findMany({
      where: { organizationId, isArchived: false },
      include: {
        tasks: { select: { status: true } },
        timeLogs: { select: { hours: true, billable: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.milestone.findMany({
      where: {
        organizationId,
        status: { not: MilestoneStatus.COMPLETED },
      },
      orderBy: [{ dueDate: "asc" }, { position: "asc" }],
      take: 8,
      include: {
        project: { select: { id: true, name: true } },
        tasks: { select: { status: true } },
      },
    }),
    db.expenseClaim.findMany({
      where: { organizationId, status: ApprovalStatus.APPROVED },
      select: { projectId: true, amount: true },
    }),
  ]);

  const overdueTasks = myTasks
    .filter((t) => t.dueDate !== null && toIsoDate(t.dueDate) < todayIso)
    .map((t) => ({
      id: t.id,
      title: t.title,
      projectId: t.project.id,
      projectName: t.project.name,
      dueDate: toIsoDate(t.dueDate!),
      priority: t.priority,
    }));

  const todaysWorkItems = myTasks
    .filter(
      (t) =>
        t.status === TaskStatus.IN_PROGRESS ||
        (t.dueDate !== null && toIsoDate(t.dueDate) === todayIso),
    )
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      title: t.title,
      projectId: t.project.id,
      projectName: t.project.name,
      dueDate: t.dueDate ? toIsoDate(t.dueDate) : null,
      status: t.status,
      priority: t.priority,
    }));

  const upcomingTasks = myTasks
    .filter((t) => t.dueDate === null || toIsoDate(t.dueDate) >= todayIso)
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      title: t.title,
      projectId: t.project.id,
      projectName: t.project.name,
      dueDate: t.dueDate ? toIsoDate(t.dueDate) : null,
      status: t.status,
    }));

  const userWeekLogs = weekLogs.filter((l) => l.userId === userId);
  const weeklyHours = userWeekLogs.reduce((sum, l) => sum + Number(l.hours), 0);
  const weeklyBillableHours = userWeekLogs
    .filter((l) => l.billable)
    .reduce((sum, l) => sum + Number(l.hours), 0);

  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyDailyHours = DAY_NAMES.map((day, idx) => {
    const dayIso = toIsoDate(addDays(weekStart, idx));
    const logsForDay = weekLogs.filter((l) => toIsoDate(l.loggedDate) === dayIso);
    return {
      day,
      dayIso,
      billable: logsForDay.filter((l) => l.billable).reduce((s, l) => s + Number(l.hours), 0),
      nonBillable: logsForDay.filter((l) => !l.billable).reduce((s, l) => s + Number(l.hours), 0),
    };
  });

  const budgetProjects = projects
    .filter((p) => p.budget !== null)
    .slice(0, 5)
    .map((p) => {
      const rate = p.currency === "PHP" ? 1500 : 50;
      const labor = p.timeLogs
        .filter((l) => l.billable)
        .reduce((s, l) => s + Number(l.hours) * rate, 0);
      const claims = approvedClaims
        .filter((c) => c.projectId === p.id)
        .reduce((s, c) => s + Number(c.amount), 0);
      return {
        id: p.id,
        name: p.name,
        currency: p.currency,
        budget: Number(p.budget ?? 0),
        actualSpend: labor + claims,
      };
    });

  let totalTasks = 0;
  let doneTasks = 0;
  let overdueProjects = 0;

  for (const p of projects) {
    totalTasks += p.tasks.length;
    doneTasks += p.tasks.filter((t) => t.status === TaskStatus.DONE).length;
    if (
      p.dueDate &&
      toIsoDate(p.dueDate) < todayIso &&
      p.status !== ProjectStatus.COMPLETED &&
      p.status !== ProjectStatus.CANCELLED
    ) {
      overdueProjects += 1;
    }
  }

  return {
    todayIso,
    weekStartIso: toIsoDate(weekStart),
    defaultCurrency: ctx.organization.defaultCurrency,
    overdueTasks,
    todaysWorkItems,
    upcomingTasks,
    openIssues: myIssues.map((i) => ({
      id: i.id,
      title: i.title,
      projectId: i.project.id,
      projectName: i.project.name,
      severity: i.severity,
      status: i.status,
    })),
    milestonesDueSoon: milestones.map((m) => ({
      id: m.id,
      name: m.name,
      projectId: m.project.id,
      projectName: m.project.name,
      dueDate: m.dueDate ? toIsoDate(m.dueDate) : null,
      status: m.status,
      taskCount: m.tasks.length,
      doneCount: m.tasks.filter((t) => t.status === TaskStatus.DONE).length,
    })),
    budgetProjects,
    weeklyDailyHours,
    weeklyHours,
    weeklyBillableHours,
    projectHealth: {
      total: projects.length,
      active: projects.filter((p) => p.status === ProjectStatus.ACTIVE).length,
      planning: projects.filter((p) => p.status === ProjectStatus.PLANNING).length,
      completed: projects.filter((p) => p.status === ProjectStatus.COMPLETED).length,
      onHold: projects.filter((p) => p.status === ProjectStatus.ON_HOLD).length,
      overdueProjects,
      overallTaskCompletionPct: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    },
    myProjects: projects.slice(0, 6).map((p) => {
      const done = p.tasks.filter((t) => t.status === TaskStatus.DONE).length;
      const pct = p.tasks.length > 0 ? Math.round((done / p.tasks.length) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        completionPct: pct,
        dueDate: p.dueDate ? toIsoDate(p.dueDate) : null,
      };
    }),
  };
}

// ════════════════════════════════ Reports ═══════════════════════════════════

export interface ProjectsReportsDTO {
  burndown: Array<{
    label: string;
    idealRemaining: number;
    actualRemaining: number;
  }>;
  resourceUtilization: Array<{
    userId: string;
    name: string;
    assignedTasks: number;
    completedTasks: number;
    loggedHours: number;
    billableHours: number;
    utilizationPct: number;
  }>;
  plannedVsActual: Array<{
    projectId: string;
    projectName: string;
    plannedHours: number;
    actualHours: number;
    varianceHours: number;
  }>;
  budgetVariance: Array<{
    projectId: string;
    projectName: string;
    currency: string;
    budget: number;
    approvedExpenses: number;
    loggedLaborValue: number;
    variance: number;
  }>;
  taskStatusDistribution: Array<{
    status: string;
    count: number;
    color: string;
  }>;
  overdueTrends: Array<{
    label: string;
    overdueCount: number;
    onTrackCount: number;
  }>;
}

export async function getProjectsReports(ctx: TenantContext): Promise<ProjectsReportsDTO> {
  authorize(ctx, "projects.project.read");
  const organizationId = ctx.organization.id;

  const [projects, tasks, timeLogs, memberships, expenses] = await Promise.all([
    db.project.findMany({
      where: { organizationId, isArchived: false },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, budget: true, currency: true },
    }),
    db.task.findMany({
      where: { organizationId },
      select: {
        id: true,
        projectId: true,
        assigneeId: true,
        status: true,
        dueDate: true,
        completedAt: true,
      },
    }),
    db.timeLog.findMany({
      where: { organizationId },
      select: { projectId: true, userId: true, hours: true, billable: true },
    }),
    db.membership.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, name: true } } },
    }),
    db.expenseClaim.findMany({
      where: { organizationId, status: ApprovalStatus.APPROVED },
      select: { projectId: true, amount: true },
    }),
  ]);

  // 1. Task Burn-down over 7-day rolling window
  const totalTaskCount = tasks.length;
  const now = new Date();
  const burndown = Array.from({ length: 7 }, (_, idx) => {
    const day = startOfUtcDay(addDays(now, idx - 6));
    const dayEndMs = addDays(day, 1).getTime();
    const completedByDay = tasks.filter(
      (t) => t.status === TaskStatus.DONE && (!t.completedAt || t.completedAt.getTime() < dayEndMs),
    ).length;
    const idealRemaining = Math.max(
      0,
      Math.round(totalTaskCount - (totalTaskCount * idx) / 6),
    );
    return {
      label: toIsoDate(day).slice(5),
      idealRemaining,
      actualRemaining: Math.max(0, totalTaskCount - completedByDay),
    };
  });

  // 2. Resource Utilization (based on 40h weekly capacity benchmark)
  const resourceUtilization = memberships.map((m) => {
    const userTasks = tasks.filter((t) => t.assigneeId === m.user.id);
    const completedTasks = userTasks.filter((t) => t.status === TaskStatus.DONE).length;
    const userLogs = timeLogs.filter((l) => l.userId === m.user.id);
    const loggedHours = userLogs.reduce((s, l) => s + Number(l.hours), 0);
    const billableHours = userLogs.filter((l) => l.billable).reduce((s, l) => s + Number(l.hours), 0);

    return {
      userId: m.user.id,
      name: m.user.name,
      assignedTasks: userTasks.length,
      completedTasks,
      loggedHours,
      billableHours,
      utilizationPct: Math.min(100, Math.round((loggedHours / 40) * 100)),
    };
  });

  // 3. Planned vs Actual Hours (4h planned estimate per project task baseline)
  const plannedVsActual = projects.map((p) => {
    const projTasks = tasks.filter((t) => t.projectId === p.id);
    const plannedHours = projTasks.length * 4;
    const actualHours = timeLogs
      .filter((l) => l.projectId === p.id)
      .reduce((s, l) => s + Number(l.hours), 0);
    return {
      projectId: p.id,
      projectName: p.name,
      plannedHours,
      actualHours,
      varianceHours: plannedHours - actualHours,
    };
  });

  // 4. Budget Variance (PHP/USD blended labor benchmark 1,500/hr or 50/hr by currency)
  const budgetVariance = projects.map((p) => {
    const budget = p.budget !== null ? Number(p.budget) : 0;
    const approvedExpenses = expenses
      .filter((e) => e.projectId === p.id)
      .reduce((s, e) => s + Number(e.amount), 0);
    const hourlyRate = p.currency === "PHP" ? 1500 : 50;
    const billableHrs = timeLogs
      .filter((l) => l.projectId === p.id && l.billable)
      .reduce((s, l) => s + Number(l.hours), 0);
    const loggedLaborValue = billableHrs * hourlyRate;
    const actualSpend = approvedExpenses + loggedLaborValue;
    return {
      projectId: p.id,
      projectName: p.name,
      currency: p.currency,
      budget,
      approvedExpenses,
      loggedLaborValue,
      variance: budget - actualSpend,
    };
  });

  const todayIso = toIsoDate(startOfUtcDay(now));

  // 5. Task Status Distribution
  const delayedCount = tasks.filter(
    (t) => t.status !== TaskStatus.DONE && t.dueDate !== null && toIsoDate(t.dueDate) < todayIso,
  ).length;
  const taskStatusDistribution = [
    { status: "Delayed / Overdue", count: delayedCount, color: "bg-rose-500" },
    {
      status: "Open / To Do",
      count: tasks.filter(
        (t) =>
          t.status === TaskStatus.TODO && (!t.dueDate || toIsoDate(t.dueDate) >= todayIso),
      ).length,
      color: "bg-emerald-500",
    },
    {
      status: "In Progress",
      count: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
      color: "bg-blue-500",
    },
    {
      status: "In Review",
      count: tasks.filter((t) => t.status === TaskStatus.IN_REVIEW).length,
      color: "bg-amber-500",
    },
    {
      status: "Closed / Done",
      count: tasks.filter((t) => t.status === TaskStatus.DONE).length,
      color: "bg-teal-500",
    },
  ];

  // 6. Overdue Trends (7-day rolling view)
  const overdueTrends = Array.from({ length: 7 }, (_, idx) => {
    const day = startOfUtcDay(addDays(now, idx - 6));
    const dayIso = toIsoDate(day);
    const overdueCount = tasks.filter(
      (t) =>
        t.status !== TaskStatus.DONE &&
        t.dueDate !== null &&
        toIsoDate(t.dueDate) < dayIso,
    ).length;
    const onTrackCount = tasks.filter(
      (t) => t.status === TaskStatus.DONE || !t.dueDate || toIsoDate(t.dueDate) >= dayIso,
    ).length;
    return {
      label: dayIso.slice(5),
      overdueCount,
      onTrackCount,
    };
  });

  return {
    burndown,
    resourceUtilization,
    plannedVsActual,
    budgetVariance,
    taskStatusDistribution,
    overdueTrends,
  };
}

// ═════════════════════════════ Timesheets ═══════════════════════════════════

export interface TimesheetGridDTO {
  weekStartIso: string;
  weekDays: string[];
  timesheet: {
    id: string | null;
    status: TimesheetStatus;
    totalHours: number;
    notes: string | null;
    reviewNotes: string | null;
  };
  rows: Array<{
    rowKey: string;
    projectId: string;
    projectName: string;
    taskId: string | null;
    taskTitle: string | null;
    hoursByDay: Record<string, number>;
  }>;
  projects: Array<{ id: string; name: string }>;
  tasks: Array<{ id: string; projectId: string; title: string }>;
  recentTimesheets: Array<{
    id: string;
    weekStartIso: string;
    status: TimesheetStatus;
    totalHours: number;
    submittedAt: string | null;
  }>;
}

export async function getWeeklyTimesheet(
  ctx: TenantContext,
  requestedWeekIso?: string,
): Promise<TimesheetGridDTO> {
  authorize(ctx, "projects.project.read");
  const organizationId = ctx.organization.id;
  const userId = ctx.user.id;

  const anchorDate =
    requestedWeekIso && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeekIso)
      ? new Date(`${requestedWeekIso}T00:00:00.000Z`)
      : new Date();
  const weekStart = getMondayUtc(anchorDate);
  const weekStartIso = toIsoDate(weekStart);
  const weekDays = Array.from({ length: 7 }, (_, i) => toIsoDate(addDays(weekStart, i)));
  const weekEnd = addDays(weekStart, 6);

  const [timesheet, logs, projects, tasks, recentTimesheets] = await Promise.all([
    db.timesheet.findUnique({
      where: {
        organizationId_userId_weekStartDate: {
          organizationId,
          userId,
          weekStartDate: weekStart,
        },
      },
      select: { id: true, status: true, totalHours: true, notes: true, reviewNotes: true },
    }),
    db.timeLog.findMany({
      where: {
        organizationId,
        userId,
        loggedDate: { gte: weekStart, lte: weekEnd },
      },
      include: {
        project: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { loggedDate: "asc" },
    }),
    db.project.findMany({
      where: { organizationId, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.task.findMany({
      where: { organizationId },
      orderBy: { title: "asc" },
      select: { id: true, projectId: true, title: true },
    }),
    db.timesheet.findMany({
      where: { organizationId, userId },
      orderBy: { weekStartDate: "desc" },
      take: 6,
      select: { id: true, weekStartDate: true, status: true, totalHours: true, submittedAt: true },
    }),
  ]);

  const rowMap = new Map<
    string,
    {
      rowKey: string;
      projectId: string;
      projectName: string;
      taskId: string | null;
      taskTitle: string | null;
      hoursByDay: Record<string, number>;
    }
  >();

  for (const log of logs) {
    const key = `${log.projectId}:${log.taskId ?? "general"}`;
    const dayIso = toIsoDate(log.loggedDate);
    let row = rowMap.get(key);
    if (!row) {
      row = {
        rowKey: key,
        projectId: log.project.id,
        projectName: log.project.name,
        taskId: log.task?.id ?? null,
        taskTitle: log.task?.title ?? null,
        hoursByDay: {},
      };
      rowMap.set(key, row);
    }
    row.hoursByDay[dayIso] = (row.hoursByDay[dayIso] ?? 0) + Number(log.hours);
  }

  // Ensure at least one editable row if user has projects and no logs yet
  if (rowMap.size === 0 && projects[0]) {
    const firstProj = projects[0];
    const firstTask = tasks.find((t) => t.projectId === firstProj.id) ?? null;
    rowMap.set(`${firstProj.id}:${firstTask?.id ?? "general"}`, {
      rowKey: `${firstProj.id}:${firstTask?.id ?? "general"}`,
      projectId: firstProj.id,
      projectName: firstProj.name,
      taskId: firstTask?.id ?? null,
      taskTitle: firstTask?.title ?? null,
      hoursByDay: {},
    });
  }

  return {
    weekStartIso,
    weekDays,
    timesheet: timesheet
      ? {
          id: timesheet.id,
          status: timesheet.status,
          totalHours: Number(timesheet.totalHours),
          notes: timesheet.notes,
          reviewNotes: timesheet.reviewNotes,
        }
      : {
          id: null,
          status: TimesheetStatus.DRAFT,
          totalHours: logs.reduce((s, l) => s + Number(l.hours), 0),
          notes: null,
          reviewNotes: null,
        },
    rows: Array.from(rowMap.values()),
    projects,
    tasks,
    recentTimesheets: recentTimesheets.map((ts) => ({
      id: ts.id,
      weekStartIso: toIsoDate(ts.weekStartDate),
      status: ts.status,
      totalHours: Number(ts.totalHours),
      submittedAt: ts.submittedAt ? ts.submittedAt.toISOString() : null,
    })),
  };
}

export async function saveWeeklyTimesheet(
  ctx: TenantContext,
  input: {
    weekStartIso: string;
    submitForApproval: boolean;
    notes?: string | null;
    entries: Array<{
      projectId: string;
      taskId?: string | null;
      dayIso: string;
      hours: number;
    }>;
  },
): Promise<{ id: string; status: TimesheetStatus; totalHours: number }> {
  authorize(ctx, "projects.project.write");
  const organizationId = ctx.organization.id;
  const userId = ctx.user.id;
  const weekStart = getMondayUtc(new Date(`${input.weekStartIso}T00:00:00.000Z`));
  const weekEnd = addDays(weekStart, 6);

  const nonZeroEntries = input.entries.filter((e) => e.hours > 0);
  const totalHours = nonZeroEntries.reduce((sum, e) => sum + e.hours, 0);

  if (input.submitForApproval && totalHours <= 0) {
    throw new ValidationError("Enter at least 0.25 hours before submitting a timesheet.");
  }

  return db.$transaction(async (tx) => {
    const existing = await tx.timesheet.findUnique({
      where: {
        organizationId_userId_weekStartDate: {
          organizationId,
          userId,
          weekStartDate: weekStart,
        },
      },
      select: { id: true, status: true },
    });

    if (existing?.status === TimesheetStatus.APPROVED) {
      throw new ValidationError("Approved timesheets are locked and cannot be edited.");
    }

    const nextStatus = input.submitForApproval
      ? TimesheetStatus.SUBMITTED
      : TimesheetStatus.DRAFT;

    const timesheet = await tx.timesheet.upsert({
      where: {
        organizationId_userId_weekStartDate: {
          organizationId,
          userId,
          weekStartDate: weekStart,
        },
      },
      create: {
        organizationId,
        userId,
        weekStartDate: weekStart,
        status: nextStatus,
        totalHours: new Prisma.Decimal(totalHours).toDecimalPlaces(2),
        notes: input.notes?.trim() || null,
        submittedAt: input.submitForApproval ? new Date() : null,
      },
      update: {
        status: nextStatus,
        totalHours: new Prisma.Decimal(totalHours).toDecimalPlaces(2),
        notes: input.notes?.trim() || null,
        submittedAt: input.submitForApproval ? new Date() : undefined,
      },
      select: { id: true, status: true, totalHours: true },
    });

    // Replace this week's logs for the user cleanly
    await tx.timeLog.deleteMany({
      where: {
        organizationId,
        userId,
        loggedDate: { gte: weekStart, lte: weekEnd },
      },
    });

    if (nonZeroEntries.length > 0) {
      await tx.timeLog.createMany({
        data: nonZeroEntries.map((entry) => ({
          organizationId,
          projectId: entry.projectId,
          taskId: entry.taskId || null,
          timesheetId: timesheet.id,
          userId,
          hours: new Prisma.Decimal(entry.hours).toDecimalPlaces(2),
          billable: true,
          loggedDate: startOfUtcDay(new Date(`${entry.dayIso}T00:00:00.000Z`)),
          notes: "Logged via weekly timesheet",
        })),
      });
    }

    await recordAudit(tx, {
      organizationId,
      actorId: userId,
      entityType: "Timesheet",
      entityId: timesheet.id,
      action: input.submitForApproval ? "timesheet.submitted" : "timesheet.saved",
      metadata: { weekStartIso: toIsoDate(weekStart), totalHours },
    });

    return {
      id: timesheet.id,
      status: timesheet.status,
      totalHours: Number(timesheet.totalHours),
    };
  });
}

// ════════════════════════════ My Approvals ══════════════════════════════════

export interface ApprovalsQueueDTO {
  currentUserId: string;
  timesheets: Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    weekStartIso: string;
    totalHours: number;
    status: TimesheetStatus;
    submittedAt: string | null;
    notes: string | null;
    reviewNotes: string | null;
    reviewedByName: string | null;
    reviewedAt: string | null;
    projectIds: string[];
    projectNames: string[];
    dailyEntries: Array<{
      id: string;
      dateIso: string;
      projectId: string;
      projectName: string;
      taskTitle: string | null;
      hours: number;
      billable: boolean;
      notes: string | null;
    }>;
  }>;
  expenses: Array<{
    id: string;
    title: string;
    category: string;
    projectId: string;
    projectName: string;
    submitterId: string | null;
    submitterName: string;
    amount: number;
    currency: string;
    expenseDate: string;
    status: ApprovalStatus;
    notes: string | null;
    reviewNotes: string | null;
    reviewedByName: string | null;
    reviewedAt: string | null;
  }>;
  milestoneSignoffs: Array<{
    id: string;
    name: string;
    description: string | null;
    projectId: string;
    projectName: string;
    dueDate: string | null;
    milestoneStatus: MilestoneStatus;
    signoffStatus: ApprovalStatus;
    signoffNotes: string | null;
    requestedById: string | null;
    requestedAt: string | null;
    reviewedAt: string | null;
    tasks: Array<{
      id: string;
      title: string;
      status: TaskStatus;
      priority: string;
      dueDate: string | null;
    }>;
  }>;
  commentsByKey: Record<
    string,
    Array<{
      id: string;
      authorName: string;
      body: string;
      createdAt: string;
    }>
  >;
  projects: Array<{ id: string; name: string }>;
  milestones: Array<{ id: string; name: string; projectName: string }>;
}

export async function getApprovalsQueue(ctx: TenantContext): Promise<ApprovalsQueueDTO> {
  authorize(ctx, "projects.project.read");
  const organizationId = ctx.organization.id;

  const [timesheets, expenses, milestones, projects, pendingMilestones, approvalComments] =
    await Promise.all([
      db.timesheet.findMany({
        where: {
          organizationId,
          status: { in: [TimesheetStatus.SUBMITTED, TimesheetStatus.APPROVED, TimesheetStatus.REJECTED] },
        },
        orderBy: [{ status: "asc" }, { submittedAt: "desc" }],
        include: {
          user: { select: { name: true, email: true } },
          reviewedBy: { select: { name: true } },
          timeLogs: {
            orderBy: [{ loggedDate: "asc" }, { createdAt: "asc" }],
            include: {
              project: { select: { id: true, name: true } },
              task: { select: { title: true } },
            },
          },
        },
      }),
      db.expenseClaim.findMany({
        where: { organizationId },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: {
          project: { select: { id: true, name: true } },
          submitter: { select: { name: true } },
          reviewedBy: { select: { name: true } },
        },
      }),
      db.milestone.findMany({
        where: { organizationId, signoffStatus: { not: null } },
        orderBy: [{ signoffStatus: "asc" }, { updatedAt: "desc" }],
        include: {
          project: { select: { id: true, name: true } },
          tasks: {
            orderBy: { position: "asc" },
            select: { id: true, title: true, status: true, priority: true, dueDate: true },
          },
        },
      }),
      db.project.findMany({
        where: { organizationId, isArchived: false },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db.milestone.findMany({
        where: { organizationId, signoffStatus: null },
        orderBy: [{ dueDate: "asc" }],
        include: { project: { select: { name: true } } },
        take: 50,
      }),
      db.comment.findMany({
        where: { organizationId, entityType: "Approval" },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      }),
    ]);

  const commentsByKey: ApprovalsQueueDTO["commentsByKey"] = {};
  for (const c of approvalComments) {
    const bucket = commentsByKey[c.entityId] ?? [];
    bucket.push({
      id: c.id,
      authorName: c.author?.name ?? "Team Member",
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    });
    commentsByKey[c.entityId] = bucket;
  }

  return {
    currentUserId: ctx.user.id,
    timesheets: timesheets.map((t) => {
      const pMap = new Map<string, string>();
      for (const l of t.timeLogs) {
        pMap.set(l.project.id, l.project.name);
      }
      return {
        id: t.id,
        userId: t.userId,
        userName: t.user.name,
        userEmail: t.user.email,
        weekStartIso: toIsoDate(t.weekStartDate),
        totalHours: Number(t.totalHours),
        status: t.status,
        submittedAt: t.submittedAt ? t.submittedAt.toISOString() : null,
        notes: t.notes,
        reviewNotes: t.reviewNotes,
        reviewedByName: t.reviewedBy?.name ?? null,
        reviewedAt: t.reviewedAt ? t.reviewedAt.toISOString() : null,
        projectIds: Array.from(pMap.keys()),
        projectNames: Array.from(pMap.values()),
        dailyEntries: t.timeLogs.map((l) => ({
          id: l.id,
          dateIso: toIsoDate(l.loggedDate),
          projectId: l.project.id,
          projectName: l.project.name,
          taskTitle: l.task?.title ?? null,
          hours: Number(l.hours),
          billable: l.billable,
          notes: l.notes,
        })),
      };
    }),
    expenses: expenses.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      projectId: e.projectId,
      projectName: e.project.name,
      submitterId: e.submitterId,
      submitterName: e.submitter?.name ?? "Team Member",
      amount: Number(e.amount),
      currency: e.currency,
      expenseDate: toIsoDate(e.expenseDate),
      status: e.status,
      notes: e.notes,
      reviewNotes: e.reviewNotes,
      reviewedByName: e.reviewedBy?.name ?? null,
      reviewedAt: e.reviewedAt ? e.reviewedAt.toISOString() : null,
    })),
    milestoneSignoffs: milestones.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      projectId: m.project.id,
      projectName: m.project.name,
      dueDate: m.dueDate ? toIsoDate(m.dueDate) : null,
      milestoneStatus: m.status,
      signoffStatus: m.signoffStatus!,
      signoffNotes: m.signoffNotes,
      requestedById: m.signoffRequestedById,
      requestedAt: m.signoffRequestedAt ? m.signoffRequestedAt.toISOString() : null,
      reviewedAt: m.signoffReviewedAt ? m.signoffReviewedAt.toISOString() : null,
      tasks: m.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? toIsoDate(task.dueDate) : null,
      })),
    })),
    commentsByKey,
    projects,
    milestones: pendingMilestones.map((m) => ({
      id: m.id,
      name: m.name,
      projectName: m.project.name,
    })),
  };
}

export async function createExpenseClaim(
  ctx: TenantContext,
  input: {
    projectId: string;
    title: string;
    category: string;
    amount: number;
    currency: string;
    expenseDate: string;
    notes?: string | null;
  },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const organizationId = ctx.organization.id;

  const project = await db.project.findUnique({
    where: { id_organizationId: { id: input.projectId, organizationId } },
    select: { id: true },
  });
  if (!project) throw new ValidationError("Selected project not found.");

  await db.expenseClaim.create({
    data: {
      organizationId,
      projectId: project.id,
      submitterId: ctx.user.id,
      title: input.title.trim(),
      category: input.category,
      amount: new Prisma.Decimal(input.amount).toDecimalPlaces(2),
      currency: input.currency.toUpperCase(),
      expenseDate: startOfUtcDay(new Date(`${input.expenseDate}T00:00:00.000Z`)),
      status: ApprovalStatus.PENDING,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function requestMilestoneSignoff(
  ctx: TenantContext,
  input: { milestoneId: string; notes?: string | null },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const updated = await db.milestone.updateMany({
    where: { id: input.milestoneId, organizationId: ctx.organization.id },
    data: {
      signoffStatus: ApprovalStatus.PENDING,
      signoffRequestedById: ctx.user.id,
      signoffRequestedAt: new Date(),
      signoffNotes: input.notes?.trim() || null,
    },
  });
  if (updated.count === 0) throw new NotFoundError("Phase / milestone not found.");
}

export async function reviewApprovalItem(
  ctx: TenantContext,
  input: {
    kind: "timesheet" | "expense" | "milestone";
    id: string;
    decision: "APPROVED" | "REJECTED";
    reviewNotes?: string | null;
  },
): Promise<void> {
  authorize(ctx, "org.members.manage");
  const organizationId = ctx.organization.id;
  const note = input.reviewNotes?.trim() || null;

  await db.$transaction(async (tx) => {
    if (input.kind === "timesheet") {
      const status =
        input.decision === "APPROVED" ? TimesheetStatus.APPROVED : TimesheetStatus.REJECTED;
      await tx.timesheet.updateMany({
        where: { id: input.id, organizationId },
        data: {
          status,
          reviewedById: ctx.user.id,
          reviewedAt: new Date(),
          reviewNotes: note,
        },
      });
    } else if (input.kind === "expense") {
      const status =
        input.decision === "APPROVED" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
      await tx.expenseClaim.updateMany({
        where: { id: input.id, organizationId },
        data: {
          status,
          reviewedById: ctx.user.id,
          reviewedAt: new Date(),
          reviewNotes: note,
        },
      });
    } else {
      const signoffStatus =
        input.decision === "APPROVED" ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
      await tx.milestone.updateMany({
        where: { id: input.id, organizationId },
        data: {
          signoffStatus,
          status: input.decision === "APPROVED" ? MilestoneStatus.COMPLETED : MilestoneStatus.IN_PROGRESS,
          signoffReviewedById: ctx.user.id,
          signoffReviewedAt: new Date(),
          signoffNotes: note || undefined,
        },
      });
    }

    await tx.comment.create({
      data: {
        organizationId,
        authorId: ctx.user.id,
        entityType: "Approval",
        entityId: `${input.kind}:${input.id}`,
        body: note ? `${input.decision}: ${note}` : `Marked as ${input.decision}`,
      },
    });
  });
}

export async function bulkReviewApprovalItems(
  ctx: TenantContext,
  input: {
    kind: "timesheet" | "expense" | "milestone";
    ids: string[];
    decision: "APPROVED" | "REJECTED";
    reviewNotes?: string | null;
  },
): Promise<{ count: number }> {
  authorize(ctx, "org.members.manage");
  if (input.ids.length === 0) {
    throw new ValidationError("Select at least one item.");
  }
  if (input.decision === "REJECTED" && !input.reviewNotes?.trim()) {
    throw new ValidationError("Rejection reason is required when rejecting items.");
  }
  for (const id of input.ids) {
    await reviewApprovalItem(ctx, {
      kind: input.kind,
      id,
      decision: input.decision,
      reviewNotes: input.reviewNotes,
    });
  }
  return { count: input.ids.length };
}

export async function postApprovalComment(
  ctx: TenantContext,
  input: { kind: "timesheet" | "expense" | "milestone"; id: string; body: string },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  const clean = input.body.trim();
  if (!clean) throw new ValidationError("Comment cannot be empty.");
  await db.comment.create({
    data: {
      organizationId: ctx.organization.id,
      authorId: ctx.user.id,
      entityType: "Approval",
      entityId: `${input.kind}:${input.id}`,
      body: clean,
    },
  });
}
