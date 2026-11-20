import { FolderKanban, Handshake, Wallet, type LucideIcon } from "lucide-react";

export type SuiteAppId = "crm" | "finance" | "projects";

export interface SuiteApp {
  id: SuiteAppId;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for the app's accent chip. */
  accent: string;
  /** Tailwind text color for icons. */
  iconColor: string;
  features: string[];
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
    iconColor: "text-sky-500",
    features: [
      "Lead capture & qualification",
      "Visual deal pipelines with weighted forecasts",
      "Company & contact management",
      "Automated follow-ups and hand-offs",
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
    iconColor: "text-emerald-500",
    features: [
      "Client billing & estimates",
      "Recurring and milestone invoices",
      "Expense tracking & rebilling",
      "Budget roll-ups and cash-flow dashboard",
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
    iconColor: "text-violet-500",
    features: [
      "Delivery workspaces with phases & milestones",
      "Gantt timelines and Kanban boards",
      "Task dependencies and issue tracking",
      "Time logs, timesheets & approvals",
    ],
    docsHref: "/docs/projects",
  },
];
