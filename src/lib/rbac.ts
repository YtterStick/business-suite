import type { MembershipRole } from "@prisma/client";

/**
 * Role-based access control. Roles are hierarchical (OWNER ⊃ ADMIN ⊃ MEMBER);
 * each permission declares the minimum role that holds it.
 * This module is isomorphic: the server enforces it, the client uses it to
 * hide controls the user cannot use.
 */
export const ROLE_RANK: Record<MembershipRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

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
  "projects.project.write": "MEMBER",
  "projects.project.delete": "ADMIN",
  // Organization
  "org.members.manage": "ADMIN",
  "org.settings.manage": "ADMIN",
  "org.billing.manage": "OWNER",
  "org.delete": "OWNER",
} as const satisfies Record<string, MembershipRole>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: MembershipRole, permission: Permission): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[PERMISSIONS[permission]];
}

export const ROLE_LABEL: Record<MembershipRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};
