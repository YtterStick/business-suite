import "server-only";

import { createHash, randomBytes } from "node:crypto";
import {
  MembershipRole,
  PortalProfile,
  Prisma,
  TaskPriority,
  TaskStatus,
  UserType,
} from "@prisma/client";

import { addDays, toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { recordAudit } from "@/server/audit";
import { authorize, type TenantContext } from "@/server/tenancy";

function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export interface TeamMemberDTO {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: MembershipRole;
  userType: UserType;
  portalProfile: PortalProfile;
  isActive: boolean;
  isOnline: boolean;
  lastActiveAt: string | null;
  jobTitle: string | null;
  weeklyCapacityHours: number;
  hourlyCostRate: number;
  teamNames: string[];
  projectsAssignedCount: number;
  assignedProjects: Array<{ id: string; name: string }>;
  assignedTasksCount: number;
  completedTasksCount: number;
  openTasks: Array<{
    id: string;
    title: string;
    projectId: string;
    projectName: string;
    status: string;
    priority: string;
    dueDate: string | null;
  }>;
  loggedHours: number;
  joinedAt: string;
}

export interface PendingInvitationDTO {
  id: string;
  email: string;
  role: MembershipRole;
  userType: UserType;
  portalProfile: PortalProfile;
  expiresAt: string;
  invitedByName: string | null;
}

export interface CustomerAccountDTO {
  id: string;
  name: string;
  industry: string | null;
  domain: string | null;
  contactCount: number;
  projectCount: number;
  invoiceCount: number;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
}

export interface OrgTeamGroupDTO {
  id: string;
  name: string;
  description: string | null;
  members: Array<{
    membershipId: string;
    userId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: MembershipRole;
  }>;
}

export interface OrganizationTeamDTO {
  defaultCurrency: string;
  members: TeamMemberDTO[];
  invitations: PendingInvitationDTO[];
  customers: CustomerAccountDTO[];
  teams: OrgTeamGroupDTO[];
  projects: Array<{ id: string; name: string }>;
}

export async function listOrganizationTeam(ctx: TenantContext): Promise<OrganizationTeamDTO> {
  authorize(ctx, "org.members.read");
  const organizationId = ctx.organization.id;
  const now = new Date();

  const [memberships, invitations, companies, teams, tasks, timeLogs, projects] =
    await Promise.all([
      db.membership.findMany({
        where: { organizationId },
        orderBy: [{ isActive: "desc" }, { role: "asc" }, { createdAt: "asc" }],
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
              sessions: {
                where: { expiresAt: { gt: now } },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { createdAt: true },
              },
            },
          },
          teamMembers: { include: { team: { select: { name: true } } } },
        },
      }),
      db.invitation.findMany({
        where: {
          organizationId,
          acceptedAt: null,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: "desc" },
        include: {
          invitedBy: { select: { name: true } },
        },
      }),
      db.company.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
        include: {
          contacts: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { firstName: true, lastName: true, email: true },
          },
          _count: { select: { contacts: true, projects: true, invoices: true } },
        },
      }),
      db.team.findMany({
        where: { organizationId },
        orderBy: { name: "asc" },
        include: {
          members: {
            include: {
              membership: {
                select: {
                  id: true,
                  role: true,
                  user: { select: { id: true, name: true, email: true, avatarUrl: true } },
                },
              },
            },
          },
        },
      }),
      db.task.findMany({
        where: { organizationId },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          title: true,
          priority: true,
          dueDate: true,
          assigneeId: true,
          status: true,
          projectId: true,
        },
      }),
      db.timeLog.findMany({
        where: { organizationId },
        select: { userId: true, hours: true },
      }),
      db.project.findMany({
        where: { organizationId, isArchived: false },
        orderBy: { name: "asc" },
        select: { id: true, name: true, ownerId: true },
      }),
    ]);

  const projectNameById = new Map(projects.map((p) => [p.id, p.name]));

  return {
    defaultCurrency: ctx.organization.defaultCurrency,
    members: memberships.map((m) => {
      const userTasks = tasks.filter((t) => t.assigneeId === m.user.id);
      const completedTasksCount = userTasks.filter((t) => t.status === TaskStatus.DONE).length;
      const openTasks = userTasks
        .filter((t) => t.status !== TaskStatus.DONE)
        .slice(0, 12)
        .map((t) => ({
          id: t.id,
          title: t.title,
          projectId: t.projectId,
          projectName: projectNameById.get(t.projectId) ?? "Project",
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate ? toIsoDate(t.dueDate) : null,
        }));
      const loggedHours = timeLogs
        .filter((l) => l.userId === m.user.id)
        .reduce((sum, l) => sum + Number(l.hours), 0);

      const assignedProjectIds = new Set<string>();
      for (const p of projects) {
        if (p.ownerId === m.user.id) assignedProjectIds.add(p.id);
      }
      for (const t of userTasks) {
        assignedProjectIds.add(t.projectId);
      }

      const assignedProjects = Array.from(assignedProjectIds)
        .map((id) => ({ id, name: projectNameById.get(id) ?? "Project" }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const latestSession = m.user.sessions[0];
      const isOnline = Boolean(latestSession) || m.user.id === ctx.user.id;
      const lastActiveAt =
        latestSession?.createdAt.toISOString() ?? m.updatedAt.toISOString();

      const effectiveProfile =
        m.role === MembershipRole.OWNER && m.portalProfile === PortalProfile.STANDARD
          ? PortalProfile.PORTAL_OWNER
          : m.portalProfile;

      return {
        membershipId: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        userType: m.userType,
        portalProfile: effectiveProfile,
        isActive: m.isActive,
        isOnline,
        lastActiveAt,
        jobTitle: m.jobTitle,
        weeklyCapacityHours: m.weeklyCapacityHours,
        hourlyCostRate: Number(m.hourlyCostRate),
        teamNames: m.teamMembers.map((tm) => tm.team.name),
        projectsAssignedCount: assignedProjects.length,
        assignedProjects,
        assignedTasksCount: userTasks.length,
        completedTasksCount,
        openTasks,
        loggedHours,
        joinedAt: m.createdAt.toISOString(),
      };
    }),
    invitations: invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      userType: inv.userType,
      portalProfile: inv.portalProfile,
      expiresAt: inv.expiresAt.toISOString(),
      invitedByName: inv.invitedBy?.name ?? null,
    })),
    customers: companies.map((c) => {
      const contact = c.contacts[0];
      return {
        id: c.id,
        name: c.name,
        industry: c.industry,
        domain: c.domain,
        contactCount: c._count.contacts,
        projectCount: c._count.projects,
        invoiceCount: c._count.invoices,
        primaryContactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : null,
        primaryContactEmail: contact?.email ?? null,
      };
    }),
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      description: team.description,
      members: team.members.map((tm) => ({
        membershipId: tm.membership.id,
        userId: tm.membership.user.id,
        name: tm.membership.user.name,
        email: tm.membership.user.email,
        avatarUrl: tm.membership.user.avatarUrl,
        role: tm.membership.role,
      })),
    })),
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
  };
}

export async function createInvitation(
  ctx: TenantContext,
  input: {
    email: string;
    role: MembershipRole;
    userType: UserType;
    portalProfile: PortalProfile;
    assignedProjectId?: string | null;
  },
): Promise<{ invitationId: string; invitePath: string; email: string; role: MembershipRole }> {
  authorize(ctx, "org.members.manage");

  const email = input.email.trim().toLowerCase();
  const isClientInvite =
    input.userType === UserType.CLIENT || input.portalProfile === PortalProfile.CLIENT;
  const effectiveRole = isClientInvite ? MembershipRole.MEMBER : input.role;
  const effectiveUserType = isClientInvite ? UserType.CLIENT : UserType.PORTAL;
  const effectiveProfile = isClientInvite ? PortalProfile.CLIENT : input.portalProfile;

  if (effectiveRole === MembershipRole.OWNER || effectiveProfile === PortalProfile.PORTAL_OWNER) {
    if (ctx.role !== MembershipRole.OWNER) {
      throw new ForbiddenError("Only an Administrator can invite an Administrator or Portal Owner.");
    }
    if (
      effectiveProfile === PortalProfile.PORTAL_OWNER &&
      effectiveRole !== MembershipRole.OWNER
    ) {
      throw new ValidationError("Portal Owner profile requires the Administrator role.");
    }
  }

  const existingMember = await db.membership.findFirst({
    where: { organizationId: ctx.organization.id, user: { email } },
    select: { id: true },
  });
  if (existingMember) {
    throw new ConflictError(`${email} is already a member of ${ctx.organization.name}.`);
  }

  const rawToken = randomBytes(24).toString("base64url");
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = addDays(new Date(), 7);

  const invitation = await db.$transaction(async (tx) => {
    const inv = await tx.invitation.upsert({
      where: {
        organizationId_email: { organizationId: ctx.organization.id, email },
      },
      create: {
        organizationId: ctx.organization.id,
        email,
        role: effectiveRole,
        userType: effectiveUserType,
        portalProfile: effectiveProfile,
        assignedProjectId: input.assignedProjectId || null,
        tokenHash,
        invitedById: ctx.user.id,
        expiresAt,
      },
      update: {
        role: effectiveRole,
        userType: effectiveUserType,
        portalProfile: effectiveProfile,
        assignedProjectId: input.assignedProjectId || null,
        tokenHash,
        invitedById: ctx.user.id,
        expiresAt,
        acceptedAt: null,
      },
      select: { id: true, email: true, role: true },
    });

    await recordAudit(tx, {
      organizationId: ctx.organization.id,
      actorId: ctx.user.id,
      entityType: "Invitation",
      entityId: inv.id,
      action: "org.member_invited",
      metadata: {
        email: inv.email,
        role: inv.role,
        userType: effectiveUserType,
        portalProfile: effectiveProfile,
        assignedProjectId: input.assignedProjectId ?? null,
      },
    });

    return inv;
  });

  return {
    invitationId: invitation.id,
    invitePath: `/invite/${rawToken}`,
    email: invitation.email,
    role: invitation.role,
  };
}

export async function createBatchInvitations(
  ctx: TenantContext,
  input: {
    items: Array<{
      email: string;
      role: MembershipRole;
      userType: UserType;
      portalProfile: PortalProfile;
      assignedProjectId?: string | null;
    }>;
  },
): Promise<{
  created: Array<{ email: string; invitePath: string; role: MembershipRole }>;
  skipped: Array<{ email: string; reason: string }>;
}> {
  const created: Array<{ email: string; invitePath: string; role: MembershipRole }> = [];
  const skipped: Array<{ email: string; reason: string }> = [];

  for (const item of input.items) {
    try {
      const res = await createInvitation(ctx, item);
      created.push({ email: res.email, invitePath: res.invitePath, role: res.role });
    } catch (error) {
      skipped.push({
        email: item.email,
        reason: error instanceof Error ? error.message : "Could not invite.",
      });
    }
  }

  return { created, skipped };
}

export async function updateMemberRole(
  ctx: TenantContext,
  input: {
    membershipId: string;
    role?: MembershipRole;
    portalProfile?: PortalProfile;
    jobTitle?: string | null;
    hourlyCostRate?: number;
    weeklyCapacityHours?: number;
  },
): Promise<void> {
  authorize(ctx, "org.members.manage");

  const target = await db.membership.findFirst({
    where: { id: input.membershipId, organizationId: ctx.organization.id },
    select: { id: true, userId: true, role: true, portalProfile: true, userType: true },
  });
  if (!target) {
    throw new NotFoundError("Member not found.");
  }

  if (target.role === MembershipRole.OWNER && ctx.role !== MembershipRole.OWNER) {
    throw new ForbiddenError("Only an Administrator can modify an Administrator account.");
  }

  if (
    (input.role === MembershipRole.OWNER || input.portalProfile === PortalProfile.PORTAL_OWNER) &&
    ctx.role !== MembershipRole.OWNER
  ) {
    throw new ForbiddenError("Only an Administrator can assign Administrator or Portal Owner access.");
  }

  let nextRole = input.role ?? target.role;
  let nextProfile = input.portalProfile ?? target.portalProfile;
  let nextUserType = target.userType;

  if (input.portalProfile === PortalProfile.CLIENT) {
    nextUserType = UserType.CLIENT;
    nextRole = MembershipRole.MEMBER;
  } else if (input.portalProfile !== undefined) {
    nextUserType = UserType.PORTAL;
  }

  if (
    input.role &&
    input.role !== MembershipRole.OWNER &&
    nextProfile === PortalProfile.PORTAL_OWNER
  ) {
    nextProfile = PortalProfile.STANDARD;
  }

  if (nextProfile === PortalProfile.PORTAL_OWNER && nextRole !== MembershipRole.OWNER) {
    throw new ValidationError("Portal Owner profile requires the Administrator role.");
  }

  if (
    target.role === MembershipRole.OWNER &&
    (nextRole !== MembershipRole.OWNER || nextProfile === PortalProfile.CLIENT)
  ) {
    const ownerCount = await db.membership.count({
      where: {
        organizationId: ctx.organization.id,
        role: MembershipRole.OWNER,
        isActive: true,
        portalProfile: { not: PortalProfile.CLIENT },
        userType: { not: UserType.CLIENT },
      },
    });
    if (ownerCount <= 1) {
      throw new ValidationError("Organization must retain at least one active Administrator.");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: target.id },
      data: {
        role: nextRole,
        portalProfile: nextProfile,
        userType: nextUserType,
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle?.trim() || null } : {}),
        ...(input.hourlyCostRate !== undefined
          ? { hourlyCostRate: new Prisma.Decimal(input.hourlyCostRate).toDecimalPlaces(2) }
          : {}),
        ...(input.weeklyCapacityHours !== undefined
          ? { weeklyCapacityHours: input.weeklyCapacityHours }
          : {}),
      },
    });

    await recordAudit(tx, {
      organizationId: ctx.organization.id,
      actorId: ctx.user.id,
      entityType: "Membership",
      entityId: target.id,
      action: "org.member_updated",
      metadata: {
        previousRole: target.role,
        nextRole,
        nextProfile,
      },
    });
  });
}

export async function setMembersActiveStatus(
  ctx: TenantContext,
  membershipIds: string[],
  isActive: boolean,
): Promise<number> {
  authorize(ctx, "org.members.manage");
  if (membershipIds.length === 0) return 0;

  if (!isActive && membershipIds.includes(ctx.membershipId)) {
    throw new ValidationError("You cannot deactivate your own active membership.");
  }

  if (!isActive) {
    const ownersInBatch = await db.membership.count({
      where: {
        organizationId: ctx.organization.id,
        id: { in: membershipIds },
        role: MembershipRole.OWNER,
      },
    });
    if (ownersInBatch > 0 && ctx.role !== MembershipRole.OWNER) {
      throw new ForbiddenError("Only an Owner can deactivate an Owner account.");
    }
  }

  const updated = await db.membership.updateMany({
    where: {
      organizationId: ctx.organization.id,
      id: { in: membershipIds },
      ...(isActive ? {} : { role: { not: MembershipRole.OWNER } }),
    },
    data: { isActive },
  });

  return updated.count;
}

export async function removeMemberFromOrg(
  ctx: TenantContext,
  membershipId: string,
): Promise<void> {
  authorize(ctx, "org.members.manage");
  if (membershipId === ctx.membershipId) {
    throw new ValidationError("You cannot remove your own membership.");
  }

  const target = await db.membership.findFirst({
    where: { id: membershipId, organizationId: ctx.organization.id },
    select: { id: true, role: true },
  });
  if (!target) throw new NotFoundError("Member not found.");

  if (target.role === MembershipRole.OWNER) {
    if (ctx.role !== MembershipRole.OWNER) {
      throw new ForbiddenError("Only an Owner can remove another Owner.");
    }
    const ownerCount = await db.membership.count({
      where: { organizationId: ctx.organization.id, role: MembershipRole.OWNER },
    });
    if (ownerCount <= 1) {
      throw new ValidationError("Organization must retain at least one Owner.");
    }
  }

  await db.membership.delete({ where: { id: target.id } });
}

export async function assignMemberToProject(
  ctx: TenantContext,
  input: { membershipId: string; projectId: string; asOwner: boolean },
): Promise<string> {
  authorize(ctx, "org.members.manage");
  const organizationId = ctx.organization.id;

  const [member, project] = await Promise.all([
    db.membership.findFirst({
      where: { id: input.membershipId, organizationId },
      include: { user: { select: { id: true, name: true } } },
    }),
    db.project.findUnique({
      where: { id_organizationId: { id: input.projectId, organizationId } },
      select: { id: true, name: true },
    }),
  ]);

  if (!member) throw new NotFoundError("Member not found.");
  if (!project) throw new NotFoundError("Project not found.");

  if (input.asOwner) {
    await db.project.update({
      where: { id_organizationId: { id: project.id, organizationId } },
      data: { ownerId: member.user.id },
    });
  } else {
    const tail = await db.task.findFirst({
      where: { organizationId, projectId: project.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    await db.task.create({
      data: {
        organizationId,
        projectId: project.id,
        assigneeId: member.user.id,
        reporterId: ctx.user.id,
        title: `Project onboarding & deliverables — ${member.user.name}`,
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        position: tail ? tail.position + 1024 : 1024,
      },
    });
  }

  return project.name;
}

export async function sendQuickChatNote(
  ctx: TenantContext,
  input: { targetUserName: string; message: string },
): Promise<void> {
  authorize(ctx, "projects.project.write");
  await db.comment.create({
    data: {
      organizationId: ctx.organization.id,
      authorId: ctx.user.id,
      entityType: "Workspace",
      entityId: "workspace",
      body: `@${input.targetUserName} — ${input.message.trim()}`,
    },
  });
}

export async function createTeamGroup(
  ctx: TenantContext,
  input: { name: string; description?: string | null; membershipIds: string[] },
): Promise<void> {
  authorize(ctx, "org.members.manage");
  const organizationId = ctx.organization.id;
  const name = input.name.trim();

  const existing = await db.team.findUnique({
    where: { organizationId_name: { organizationId, name } },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(`Team "${name}" already exists.`);
  }

  await db.$transaction(async (tx) => {
    const team = await tx.team.create({
      data: {
        organizationId,
        name,
        description: input.description?.trim() || null,
      },
      select: { id: true },
    });

    if (input.membershipIds.length > 0) {
      const validMemberships = await tx.membership.findMany({
        where: { organizationId, id: { in: input.membershipIds } },
        select: { id: true },
      });
      await tx.teamMember.createMany({
        data: validMemberships.map((m) => ({
          organizationId,
          teamId: team.id,
          membershipId: m.id,
        })),
        skipDuplicates: true,
      });
    }
  });
}

export async function revokeInvitation(ctx: TenantContext, invitationId: string): Promise<void> {
  authorize(ctx, "org.members.manage");
  const inv = await db.invitation.findFirst({
    where: { id: invitationId, organizationId: ctx.organization.id },
    select: { id: true, role: true },
  });
  if (!inv) return;
  if (inv.role === MembershipRole.OWNER && ctx.role !== MembershipRole.OWNER) {
    throw new ForbiddenError("Only an Administrator can revoke an Administrator invitation.");
  }
  await db.invitation.delete({
    where: { id: inv.id },
  });
}

export async function lookupInvitationByToken(rawToken: string) {
  const invitation = await db.invitation.findUnique({
    where: { tokenHash: hashInviteToken(rawToken) },
    select: {
      id: true,
      email: true,
      role: true,
      userType: true,
      portalProfile: true,
      assignedProjectId: true,
      expiresAt: true,
      acceptedAt: true,
      organization: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { name: true } },
    },
  });

  if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return invitation;
}

export async function acceptInvitationForUser(
  rawToken: string,
  user: { id: string; email: string },
): Promise<{ orgSlug: string }> {
  const invitation = await lookupInvitationByToken(rawToken);
  if (!invitation) {
    throw new NotFoundError("This invitation is invalid or has expired.");
  }

  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new ForbiddenError(
      `This invitation was sent to ${invitation.email}. Please sign in with that email address.`,
    );
  }

  await db.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitation.organization.id,
          userId: user.id,
        },
      },
      create: {
        organizationId: invitation.organization.id,
        userId: user.id,
        role: invitation.role,
        userType: invitation.userType,
        portalProfile: invitation.portalProfile,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    });

    if (invitation.assignedProjectId) {
      const proj = await tx.project.findUnique({
        where: {
          id_organizationId: {
            id: invitation.assignedProjectId,
            organizationId: invitation.organization.id,
          },
        },
        select: { id: true },
      });
      if (proj) {
        await tx.task.create({
          data: {
            organizationId: invitation.organization.id,
            projectId: proj.id,
            assigneeId: user.id,
            title: `Join project kickoff (${invitation.email})`,
            status: TaskStatus.TODO,
            priority: TaskPriority.MEDIUM,
            position: 1024,
          },
        });
      }
    }

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { lastActiveOrgId: invitation.organization.id },
    });

    await recordAudit(tx, {
      organizationId: invitation.organization.id,
      actorId: user.id,
      entityType: "Invitation",
      entityId: invitation.id,
      action: "org.invitation_accepted",
      metadata: { role: invitation.role },
    });
  });

  return { orgSlug: invitation.organization.slug };
}
