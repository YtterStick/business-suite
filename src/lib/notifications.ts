export type NotificationKind =
  | "mention"
  | "assignment"
  | "approval"
  | "overdue"
  | "task"
  | "automation";

export type NotificationCategory =
  | "all"
  | "mentions"
  | "assignments"
  | "approvals"
  | "overdue";

export interface TopBarNotificationItem {
  id: string;
  kind: NotificationKind;
  actorName: string;
  actorAvatarUrl?: string | null;
  title: string;
  description: string;
  entityKey?: string | null;
  projectName?: string | null;
  createdAt: string;
  href: string;
  badgeLabel: string;
}

export interface NotificationPreferences {
  mentions: boolean;
  assignments: boolean;
  approvals: boolean;
  overdue: boolean;
  emailDigest: boolean;
  inAppSound: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  mentions: true,
  assignments: true,
  approvals: true,
  overdue: true,
  emailDigest: true,
  inAppSound: false,
};

export function mapNotificationCategory(kind: NotificationKind): Exclude<NotificationCategory, "all"> {
  switch (kind) {
    case "mention":
      return "mentions";
    case "approval":
      return "approvals";
    case "overdue":
      return "overdue";
    case "assignment":
    case "task":
    case "automation":
      return "assignments";
  }
}

export function emitWorkspaceNotification(
  item: Omit<TopBarNotificationItem, "id" | "createdAt"> & { id?: string; createdAt?: string },
) {
  if (typeof window === "undefined") return;
  const payload: TopBarNotificationItem = {
    ...item,
    id: item.id ?? `live-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: item.createdAt ?? new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent<TopBarNotificationItem>("bs-notify", { detail: payload }));
}
