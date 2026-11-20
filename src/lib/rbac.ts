import type { MembershipRole, PortalProfile, UserType } from "@prisma/client";

/**
 * Role-based & portal-profile access control matching Zoho Projects:
 * Roles are hierarchical (OWNER > ADMIN > MEMBER); Client users
 * (`portalProfile === "CLIENT"` or `userType === "CLIENT"`) are restricted
 * to shared project viewing, issue reporting, and comments.
 */
export const ROLE_RANK: Record<MembershipRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export interface AccessContext {
  role: MembershipRole;
  portalProfile?: PortalProfile;
  userType?: UserType;
}

const PERMISSIONS = {
  // CRM
  "crm.contact.read": "MEMBER",
  "crm.contact.write": "MEMBER",
  "crm.contact.delete": "ADMIN",
  "crm.deal.read": "MEMBER",
  "crm.deal.write": "MEMBER",
  "crm.deal.delete": "ADMIN",
  "crm.pipeline.manage": "ADMIN",
  // Finance
  "finance.invoice.read": "MEMBER",
  "finance.invoice.write": "MEMBER",
  "finance.invoice.void": "ADMIN",
  // Projects
  "projects.project.read": "MEMBER",
  "projects.project.manage": "ADMIN",
  "projects.project.delete": "ADMIN",
  "projects.project.write": "MEMBER",
  "projects.issue.write": "MEMBER",
  "projects.comment.write": "MEMBER",
  "projects.reports.read": "MEMBER",
  "projects.time.read": "MEMBER",
  "projects.approvals.read": "MEMBER",
  "projects.approvals.manage": "ADMIN",
  // Organization
  "org.members.read": "MEMBER",
  "org.members.manage": "ADMIN",
  "org.settings.manage": "OWNER",
  "org.billing.manage": "OWNER",
  "org.delete": "OWNER",
} as const satisfies Record<string, MembershipRole>;

export type Permission = keyof typeof PERMISSIONS;

export const CLIENT_ALLOWED_PERMISSIONS = new Set<Permission>([
  "projects.project.read",
  "projects.issue.write",
  "projects.comment.write",
]);

export function isClientUser(ctx: { portalProfile?: PortalProfile; userType?: UserType }): boolean {
  return ctx.portalProfile === "CLIENT" || ctx.userType === "CLIENT";
}

export function can(roleOrCtx: MembershipRole | AccessContext, permission: Permission): boolean {
  if (typeof roleOrCtx === "string") {
    return ROLE_RANK[roleOrCtx] >= ROLE_RANK[PERMISSIONS[permission]];
  }
  if (isClientUser(roleOrCtx)) {
    return CLIENT_ALLOWED_PERMISSIONS.has(permission);
  }
  return ROLE_RANK[roleOrCtx.role] >= ROLE_RANK[PERMISSIONS[permission]];
}

export function getZohoRoleLabel(ctx: AccessContext): string {
  if (isClientUser(ctx)) return "Client";
  switch (ctx.role) {
    case "OWNER":
      return "Administrator";
    case "ADMIN":
      return "Manager";
    case "MEMBER":
      return "Employee";
  }
}

export const ROLE_LABEL: Record<MembershipRole, string> = {
  OWNER: "Administrator",
  ADMIN: "Manager",
  MEMBER: "Employee",
};
