export type SuiteModuleId = "crm" | "finance" | "projects";

export type ModuleNavIcon =
  | "kanban"
  | "users"
  | "building"
  | "receipt"
  | "file-text"
  | "folder-kanban"
  | "check-square"
  | "flag"
  | "bug"
  | "clock"
  | "message-square"
  | "home"
  | "bar-chart"
  | "check-circle"
  | "calendar-clock"
  | "package"
  | "credit-card"
  | "wallet";

export interface ModuleNavItem {
  id: string;
  label: string;
  path: string;
  icon: ModuleNavIcon;
  section?: "main" | "overview";
  quickAddPath?: string;
  badge?: string;
}

export interface SuiteModuleConfig {
  id: SuiteModuleId;
  name: string;
  shortName: string;
  description: string;
  accentClass: string;
  defaultPath: string;
  items: ModuleNavItem[];
}

export const SUITE_MODULES: SuiteModuleConfig[] = [
  {
    id: "crm",
    name: "CRM",
    shortName: "CRM",
    description: "Contacts, companies & deal pipeline",
    accentClass: "bg-blue-600 text-white",
    defaultPath: "/crm/deals",
    items: [
      { id: "deals", label: "Deal Pipeline", path: "/crm/deals", icon: "kanban", section: "main" },
      { id: "contacts", label: "Contacts", path: "/crm/contacts", icon: "users", section: "main" },
      { id: "companies", label: "Companies", path: "/crm/companies", icon: "building", section: "main" },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    shortName: "Finance",
    description: "Dashboard, items, quotes, invoices, payments & expenses",
    accentClass: "bg-emerald-600 text-white",
    defaultPath: "/finance/dashboard",
    items: [
      { id: "dashboard", label: "Dashboard", path: "/finance/dashboard", icon: "bar-chart", section: "main" },
      { id: "items", label: "Items", path: "/finance/items", icon: "package", section: "main" },
      { id: "quotes", label: "Quotes", path: "/finance/quotes", icon: "file-text", section: "main" },
      { id: "invoices", label: "Invoices", path: "/finance/invoices", icon: "receipt", section: "main" },
      { id: "payments", label: "Payments Received", path: "/finance/payments", icon: "credit-card", section: "main" },
      { id: "expenses", label: "Expenses", path: "/finance/expenses", icon: "wallet", section: "main" },
    ],
  },
  {
    id: "projects",
    name: "Projects",
    shortName: "Projects",
    description: "Home, reports, projects, approvals & timesheets",
    accentClass: "bg-violet-600 text-white",
    defaultPath: "/projects",
    items: [
      { id: "home", label: "Home", path: "/home", icon: "home", section: "main" },
      { id: "reports", label: "Reports", path: "/projects/reports", icon: "bar-chart", section: "main" },
      {
        id: "projects",
        label: "Projects",
        path: "/projects",
        icon: "folder-kanban",
        section: "main",
        quickAddPath: "/projects?new=1",
      },
      {
        id: "users",
        label: "Users",
        path: "/projects/users",
        icon: "users",
        section: "main",
        quickAddPath: "/projects/users?invite=1",
      },
      {
        id: "collaboration",
        label: "Collaboration",
        path: "/projects/collaboration",
        icon: "message-square",
        section: "main",
      },
      {
        id: "approvals",
        label: "My Approvals",
        path: "/projects/approvals",
        icon: "check-circle",
        section: "main",
      },
      {
        id: "tasks",
        label: "Tasks",
        path: "/projects/tasks",
        icon: "check-square",
        section: "overview",
        quickAddPath: "/projects/tasks?new=1",
      },
      {
        id: "issues",
        label: "Issues",
        path: "/projects/issues",
        icon: "bug",
        section: "overview",
        quickAddPath: "/projects/issues?new=1",
      },
      {
        id: "milestones",
        label: "Phases",
        path: "/projects/milestones",
        icon: "flag",
        section: "overview",
        quickAddPath: "/projects/milestones?new=1",
      },
      {
        id: "time-logs",
        label: "Time Logs",
        path: "/projects/time-logs",
        icon: "clock",
        section: "overview",
        quickAddPath: "/projects/time-logs?new=1",
      },
      {
        id: "timesheets",
        label: "Timesheets",
        path: "/projects/timesheets",
        icon: "calendar-clock",
        section: "overview",
      },
    ],
  },
];

export function getModuleHref(orgSlug: string, path: string): string {
  return `/${orgSlug}${path}`;
}

export function resolveActiveModule(pathname: string, orgSlug: string): SuiteModuleConfig {
  const prefix = `/${orgSlug}`;
  const relativePath = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;

  if (relativePath.startsWith("/finance")) {
    return SUITE_MODULES[1]!;
  }
  if (relativePath.startsWith("/projects") || relativePath.startsWith("/home")) {
    return SUITE_MODULES[2]!;
  }
  return SUITE_MODULES[0]!;
}
