import { FolderKanban, Handshake, Wallet, type LucideIcon } from "lucide-react";

export type SuiteAppId = "crm" | "finance" | "projects";

export interface SuiteAppModule {
  name: string;
  description: string;
  path: string;
}

export interface SuiteApp {
  id: SuiteAppId;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for the app's accent chip. */
  accent: string;
  /** Tailwind classes for selected state border/ring. */
  ringColor: string;
  /** Tailwind text color for icons. */
  iconColor: string;
  /** Default workspace path inside `/<orgSlug>`. */
  defaultAppPath: string;
  features: string[];
  modules: SuiteAppModule[];
  docsHref: string;
}

export const SUITE_APPS: SuiteApp[] = [
  {
    id: "crm",
    name: "CRM",
    tagline: "Win more of the right deals",
    description: "Capture every lead, see every relationship, and move deals forward with a visual pipeline.",
    icon: Handshake,
    accent: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400",
    ringColor: "border-sky-500/50 ring-2 ring-sky-500/20 shadow-lg shadow-sky-500/5",
    iconColor: "text-sky-500",
    defaultAppPath: "/crm/deals",
    features: [
      "Lead capture & qualification",
      "Visual deal pipelines with weighted forecasts",
      "Company & contact management",
      "Automated follow-ups and hand-offs",
    ],
    modules: [
      {
        name: "Deals Pipeline",
        description: "Drag cards across stages with weighted revenue totals per column.",
        path: "/crm/deals",
      },
      {
        name: "Companies",
        description: "Keep every client organization linked to its deals, invoices, and projects.",
        path: "/crm/companies",
      },
      {
        name: "Contacts",
        description: "Centralized directory of stakeholders, decision-makers, and client emails.",
        path: "/crm/contacts",
      },
      {
        name: "Won-Deal Handoff",
        description: "Automatically spin up a funded delivery project & draft invoice when a deal closes.",
        path: "/crm/deals",
      },
    ],
    docsHref: "/docs/crm",
  },
  {
    id: "finance",
    name: "Finance",
    tagline: "Get paid faster",
    description: "Turn won deals and approved hours into invoices, and keep every peso accounted for.",
    icon: Wallet,
    accent: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
    ringColor: "border-emerald-500/50 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/5",
    iconColor: "text-emerald-500",
    defaultAppPath: "/finance/dashboard",
    features: [
      "Client billing & estimates",
      "Recurring and milestone invoices",
      "Expense tracking & rebilling",
      "Budget roll-ups and cash-flow dashboard",
    ],
    modules: [
      {
        name: "Finance Dashboard",
        description: "Live overview of receivables, recent collections, and overdue balances.",
        path: "/finance/dashboard",
      },
      {
        name: "Quotes & Invoices",
        description: "Draft quotes from catalog items and convert them into sequential client invoices.",
        path: "/finance/invoices",
      },
      {
        name: "Payments Ledger",
        description: "Record partial or full client payments with automatic invoice status updates.",
        path: "/finance/payments",
      },
      {
        name: "Expenses & Catalog Items",
        description: "Track project expenses and convert rebillable costs straight into an invoice.",
        path: "/finance/expenses",
      },
    ],
    docsHref: "/docs/finance",
  },
  {
    id: "projects",
    name: "Projects",
    tagline: "Deliver on time, on budget",
    description: "Plan, assign, and track delivery with the views your team already knows — plus built-in time tracking.",
    icon: FolderKanban,
    accent: "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400",
    ringColor: "border-violet-500/50 ring-2 ring-violet-500/20 shadow-lg shadow-violet-500/5",
    iconColor: "text-violet-500",
    defaultAppPath: "/projects",
    features: [
      "Delivery workspaces with phases & milestones",
      "Gantt timelines and Kanban boards",
      "Task dependencies and issue tracking",
      "Time logs, timesheets & approvals",
    ],
    modules: [
      {
        name: "Projects, Kanban & Gantt",
        description: "Manage projects across structured phases, milestones, dependencies, and timelines.",
        path: "/projects",
      },
      {
        name: "Tasks & Issue Tracking",
        description: "Assign deliverables, track bugs separately, and monitor status across teams.",
        path: "/projects/tasks",
      },
      {
        name: "Time Logs & Approvals",
        description: "Capture billable hours and route weekly timesheets through manager sign-off.",
        path: "/projects/time-logs",
      },
      {
        name: "Collaboration & Chat",
        description: "Project-scoped chat channels, shared delivery calendar, and team activity feeds.",
        path: "/projects/collaboration",
      },
    ],
    docsHref: "/docs/projects",
  },
];

export function isSuiteAppId(value: string | null | undefined): value is SuiteAppId {
  return value === "crm" || value === "finance" || value === "projects";
}

export function getSuiteApp(id: SuiteAppId): SuiteApp {
  return SUITE_APPS.find((app) => app.id === id) ?? SUITE_APPS[2]!;
}
