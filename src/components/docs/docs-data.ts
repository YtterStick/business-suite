/**
 * Tactiq documentation content.
 *
 * Articles are plain data so new guides can be added without touching layout
 * code: add an entry to DOC_ARTICLES and reference its slug in DOC_GROUPS.
 * Inline text supports `code`, **bold**, and [links](/path).
 */

export type CalloutVariant = "tip" | "note" | "best-practice" | "warning";

export type DocBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "steps"; items: Array<{ title: string; text: string }> }
  | { type: "callout"; variant: CalloutVariant; title?: string; text: string }
  | { type: "code"; code: string; language?: string; caption?: string }
  | { type: "shortcuts"; items: Array<{ keys: string[]; action: string }> }
  | { type: "flow"; items: Array<{ app: "CRM" | "Finance" | "Projects"; title: string; text: string }> }
  | { type: "table"; head: string[]; rows: string[][] };

export interface DocSection {
  id: string;
  title: string;
  blocks: DocBlock[];
}

export interface DocArticle {
  slug: string;
  title: string;
  description: string;
  sections: DocSection[];
}

export interface DocGroup {
  title: string;
  slugs: string[];
}

export const DOCS_HOME_SLUG = "what-is-tactiq";

export function docHref(slug: string, sectionId?: string): string {
  const base = slug === DOCS_HOME_SLUG ? "/docs" : `/docs/${slug}`;
  return sectionId ? `${base}#${sectionId}` : base;
}

export const DOC_GROUPS: DocGroup[] = [
  {
    title: "Getting Started",
    slugs: ["what-is-tactiq", "quickstart", "workspace-setup"],
  },
  {
    title: "Core Modules",
    slugs: ["crm", "finance", "projects"],
  },
  {
    title: "Platform Features",
    slugs: ["integrations", "automations", "keyboard-shortcuts", "security"],
  },
];

export const DOC_ARTICLES: DocArticle[] = [
  {
    slug: "what-is-tactiq",
    title: "What is Tactiq?",
    description:
      "Tactiq is a unified business workspace that connects your CRM, Finance, and Projects apps on a single shared data model.",
    sections: [
      {
        id: "overview",
        title: "Overview",
        blocks: [
          {
            type: "p",
            text: "Most growing teams run sales in one tool, invoicing in another, and project delivery in a third. Every hand-off between them is a copy-paste job, and nobody has the full picture of a client. **Tactiq replaces that stack with one workspace** where a deal, the project that delivers it, the hours logged against it, and the invoice that bills it are all connected records.",
          },
          {
            type: "list",
            items: [
              "**CRM** — capture leads, manage companies and contacts, and move deals through a visual pipeline.",
              "**Finance** — issue quotes and invoices, record payments, track expenses, and watch cash flow on a live dashboard.",
              "**Projects** — plan delivery with phases, milestones, tasks, Kanban boards and Gantt timelines, then log billable time.",
            ],
          },
          {
            type: "callout",
            variant: "note",
            title: "One login, many workspaces",
            text: "A single Tactiq account can own or belong to several workspaces — for example one per business unit or per agency client. Switch between them from the logo menu in the top-left of the app.",
          },
        ],
      },
      {
        id: "who-is-it-for",
        title: "Who it's for",
        blocks: [
          {
            type: "p",
            text: "Tactiq is built for service businesses that sell, deliver, and bill work: agencies, consultancies, IT and software studios, engineering and construction contractors, and internal teams that charge back to other departments.",
          },
          {
            type: "table",
            head: ["Role", "What they do in Tactiq"],
            rows: [
              ["Founders & administrators", "Configure the workspace, invite people, set roles, and watch cross-app reports."],
              ["Sales & account managers", "Work the CRM pipeline, prepare quotes, and hand closed deals to delivery."],
              ["Project managers", "Plan phases and milestones, assign tasks, approve timesheets, and track budget burn."],
              ["Finance team", "Invoice clients, record payments, manage expenses, and reconcile billable hours."],
              ["Clients", "Optional client-portal access to view the projects and items shared with them."],
            ],
          },
        ],
      },
      {
        id: "architecture",
        title: "Architecture overview",
        blocks: [
          {
            type: "p",
            text: "Everything in Tactiq lives inside a **workspace** (also called an organization or portal). A workspace is a fully isolated tenant: its members, records, files, and audit history are never visible to another workspace.",
          },
          {
            type: "code",
            language: "text",
            caption: "Every workspace gets its own URL namespace",
            code: "https://<your-tactiq-domain>/<workspace-slug>/crm/deals\nhttps://<your-tactiq-domain>/<workspace-slug>/finance/invoices\nhttps://<your-tactiq-domain>/<workspace-slug>/projects/tasks",
          },
          {
            type: "list",
            items: [
              "**Shared data model** — CRM, Finance, and Projects read and write the same database, so a project can reference its source deal and an invoice can reference both.",
              "**Role-based access** — every request is checked against the member's role (Administrator, Manager, Employee, or Client) inside the active workspace.",
              "**Audit trail** — important changes (stage moves, invoices sent, approvals) are recorded with who did what and when.",
              "**Event-driven automation** — cross-app actions such as *deal won → project + invoice* run as idempotent automations, so they never create duplicates.",
            ],
          },
          {
            type: "callout",
            variant: "tip",
            text: "Because every app shares the same records, the global search (`⌘K` / `Ctrl K`) can find a client, deal, project, task, or invoice from anywhere in the app.",
          },
        ],
      },
      {
        id: "next-steps",
        title: "Next steps",
        blocks: [
          {
            type: "list",
            items: [
              "Follow the [Quickstart Guide](/docs/quickstart) to create a workspace and your first project in under ten minutes.",
              "Read [Workspace Setup & Inviting Users](/docs/workspace-setup) before you bring your team in.",
              "Learn how the apps hand work to each other in [Cross-App Integrations](/docs/integrations).",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "quickstart",
    title: "Quickstart Guide",
    description: "Go from a new account to a live deal, project, and invoice in about ten minutes.",
    sections: [
      {
        id: "create-account",
        title: "1. Create your account",
        blocks: [
          {
            type: "steps",
            items: [
              {
                title: "Sign up",
                text: "Go to [Sign Up](/signup) and register with your work email and a password, or continue with Google.",
              },
              {
                title: "Name your workspace",
                text: "Enter your company or team name and choose a default currency. Tactiq creates a workspace URL from the name, e.g. `/your-company/projects`.",
              },
              {
                title: "Land in Projects",
                text: "You're taken straight into the Projects app of your new workspace. The default timezone is `Asia/Manila` (GMT+8) — change it any time in Setup.",
              },
            ],
          },
          {
            type: "callout",
            variant: "note",
            text: "The person who creates a workspace becomes its **Administrator** (portal owner) and can invite everyone else.",
          },
        ],
      },
      {
        id: "first-deal",
        title: "2. Add your first deal",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "Open CRM", text: "Use the app switcher on the left rail and choose **CRM → Deals**." },
              {
                title: "Create a deal",
                text: "Click **New Deal** in the header, enter the deal name, value, company, and expected close date.",
              },
              {
                title: "Move it through the pipeline",
                text: "Drag the card across stages (for example *Qualification → Proposal / Quote → Negotiation*). Each column shows the total and weighted value.",
              },
            ],
          },
        ],
      },
      {
        id: "first-project",
        title: "3. Plan the project",
        blocks: [
          {
            type: "steps",
            items: [
              {
                title: "Create a project",
                text: "In **Projects**, click **Quick Create → Project**, or mark the deal as won and let the deal-to-project automation create it for you.",
              },
              { title: "Add phases & milestones", text: "Break delivery into phases (Discovery, Build, Launch) with dated milestones." },
              { title: "Add tasks", text: "Create tasks, assign owners, set priorities, and link dependencies. Switch between List, Kanban, and Gantt views." },
            ],
          },
          {
            type: "callout",
            variant: "best-practice",
            title: "Keep phases short",
            text: "Phases of two to four weeks make Gantt timelines readable and give clients regular, billable checkpoints.",
          },
        ],
      },
      {
        id: "first-invoice",
        title: "4. Track time & invoice",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "Log time", text: "Team members log hours from a task or from **Projects → Time Logs**, marking each entry billable or non-billable." },
              { title: "Approve timesheets", text: "Managers review and approve weekly timesheets under **Projects → Timesheets / Approvals**." },
              { title: "Send the invoice", text: "In **Finance → Invoices**, create or open the invoice, review the line items, and click **Send**. Record payments as they arrive." },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "workspace-setup",
    title: "Workspace Setup & Inviting Users",
    description: "Configure your workspace details, understand roles, and invite your team and clients.",
    sections: [
      {
        id: "workspace-details",
        title: "Workspace details",
        blocks: [
          {
            type: "p",
            text: "Administrators can open **Setup** (the gear icon in the top bar) to change the workspace name, default currency, timezone, and document prefixes for quotes and invoices.",
          },
          {
            type: "table",
            head: ["Setting", "Default", "Used for"],
            rows: [
              ["Timezone", "Asia/Manila (GMT+8)", "Due dates, chat timestamps, timesheet weeks, reports"],
              ["Currency", "Chosen at creation", "Deal values, quotes, invoices, budgets"],
              ["Invoice / quote prefix", "INV- / QT-", "Sequential document numbering"],
              ["Payment terms", "Net days", "Default invoice due dates"],
            ],
          },
          {
            type: "callout",
            variant: "warning",
            text: "Changing the default currency does not convert existing amounts. Set it before you create quotes and invoices.",
          },
        ],
      },
      {
        id: "roles",
        title: "Roles & permissions",
        blocks: [
          {
            type: "table",
            head: ["Role", "Typical access"],
            rows: [
              ["Administrator", "Everything, including workspace setup, billing settings, and member management."],
              ["Manager", "Manage projects, approve timesheets and expenses, work CRM and Finance records."],
              ["Employee", "Work on assigned projects and tasks, log time, collaborate in chat and feeds."],
              ["Client", "Portal-only access to the projects and items explicitly shared with them."],
            ],
          },
          {
            type: "callout",
            variant: "best-practice",
            text: "Grant the lowest role that lets someone do their job. You can promote a member at any time from **Projects → Users**.",
          },
        ],
      },
      {
        id: "inviting-users",
        title: "Inviting users",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "Open the invite dialog", text: "Click **Quick Create → Users**, or go to **Projects → Users** and choose **Invite**." },
              { title: "Add emails & role", text: "Enter one or more email addresses, pick a role, and optionally assign them to a project." },
              { title: "They accept", text: "Invitees receive a link to join. New users create an account; existing users simply join the workspace." },
            ],
          },
          {
            type: "callout",
            variant: "tip",
            text: "Need a separate space for another business? Use **Create New Workspace** from the logo menu or your profile menu — no new account required.",
          },
        ],
      },
    ],
  },
  {
    slug: "crm",
    title: "CRM Guide",
    description: "Capture leads, organize companies and contacts, and run a visual deal pipeline.",
    sections: [
      {
        id: "companies-contacts",
        title: "Companies & contacts",
        blocks: [
          {
            type: "p",
            text: "**Companies** represent the organizations you sell to; **Contacts** are the people at those companies. Every deal, quote, invoice, and project can be linked back to a company so you always see the full relationship.",
          },
          {
            type: "list",
            items: [
              "Create records from **CRM → Companies** or **CRM → Contacts**.",
              "Link contacts to a company to see their deals and invoices in one place.",
              "Use global search (`⌘K`) to jump to any company or contact instantly.",
            ],
          },
        ],
      },
      {
        id: "deal-pipeline",
        title: "Deal pipeline",
        blocks: [
          {
            type: "p",
            text: "Every workspace starts with a default sales pipeline. Deals are shown as cards on a Kanban board; drag a card to move it to the next stage.",
          },
          {
            type: "table",
            head: ["Field", "Purpose"],
            rows: [
              ["Value", "Expected deal amount in the workspace currency."],
              ["Stage probability", "Used to compute the weighted pipeline value per column."],
              ["Expected close", "Drives forecasting and follow-up reminders."],
              ["Status", "Open, Closed Won, or Closed Lost."],
            ],
          },
          {
            type: "callout",
            variant: "tip",
            text: "Filter the board by owner, company, or keyword using the search field above the pipeline.",
          },
        ],
      },
      {
        id: "closing-deals",
        title: "Closing deals",
        blocks: [
          {
            type: "p",
            text: "When a deal moves to **Closed Won**, Tactiq can automatically create a delivery project (with the deal value as its budget) and a draft invoice in Finance. See [Workflow Automations](/docs/automations).",
          },
          {
            type: "callout",
            variant: "best-practice",
            title: "Follow-ups",
            text: "Keep an expected close date on every open deal and review the pipeline weekly, so no lead goes cold.",
          },
        ],
      },
    ],
  },
  {
    slug: "finance",
    title: "Finance & Billing",
    description: "Quotes, invoices, payments, expenses, catalog items, and the finance dashboard.",
    sections: [
      {
        id: "quotes",
        title: "Quotes & estimates",
        blocks: [
          {
            type: "p",
            text: "Build a quote from catalog items or free-form line items under **Finance → Quotes**. Quotes can be linked to a deal and later converted into an invoice, so pricing is never re-typed.",
          },
        ],
      },
      {
        id: "invoices",
        title: "Invoices",
        blocks: [
          {
            type: "p",
            text: "Invoices move through a clear lifecycle. Numbers are generated sequentially per workspace using your configured prefix.",
          },
          {
            type: "table",
            head: ["Status", "Meaning"],
            rows: [
              ["Draft", "Being prepared; not visible to the client."],
              ["Sent", "Issued to the client and awaiting payment."],
              ["Partially paid", "One or more payments recorded, balance remaining."],
              ["Paid", "Fully settled."],
              ["Overdue", "Past the due date with a balance."],
              ["Void", "Cancelled; kept for the audit trail."],
            ],
          },
          {
            type: "callout",
            variant: "warning",
            text: "Voiding an invoice cannot be undone. Create a new invoice if you need to re-bill.",
          },
        ],
      },
      {
        id: "payments-expenses",
        title: "Payments & expenses",
        blocks: [
          {
            type: "list",
            items: [
              "**Payments** — record full or partial payments against an invoice; balances and statuses update automatically.",
              "**Expenses** — log business costs and mark rebillable ones. Selected expenses can be converted into an invoice in one step.",
              "**Items** — maintain a catalog of products and services with standard rates for faster quoting.",
            ],
          },
        ],
      },
      {
        id: "budgets",
        title: "Budgets & dashboard",
        blocks: [
          {
            type: "p",
            text: "Each project can carry a budget. Logged billable hours and project expenses roll up against it, and the **Finance → Dashboard** shows receivables, collections, and overdue totals across the workspace.",
          },
          {
            type: "callout",
            variant: "tip",
            text: "Review the dashboard weekly and sort invoices by due date to keep cash flow predictable.",
          },
        ],
      },
    ],
  },
  {
    slug: "projects",
    title: "Projects (Tasks, Phases, Gantt, Time Logs)",
    description: "Plan delivery, assign work, visualize timelines, and capture billable time.",
    sections: [
      {
        id: "structure",
        title: "Project structure",
        blocks: [
          {
            type: "flow",
            items: [
              { app: "Projects", title: "Project", text: "The client engagement, with owner, dates, status, and budget." },
              { app: "Projects", title: "Phases & milestones", text: "Major stages and dated checkpoints with optional client sign-off." },
              { app: "Projects", title: "Tasks", text: "Assignable units of work with priority, status, and dependencies." },
              { app: "Projects", title: "Time logs", text: "Hours recorded against tasks, billable or non-billable." },
            ],
          },
        ],
      },
      {
        id: "tasks",
        title: "Tasks & Kanban",
        blocks: [
          {
            type: "p",
            text: "Tasks flow through **To Do → In Progress → In Review → Done**. Use the Kanban board to drag tasks between statuses, or the list view for bulk edits.",
          },
          {
            type: "list",
            items: [
              "Set priority, assignee, due date, and tags.",
              "Link dependencies so a task can't start before its predecessor finishes.",
              "Report problems as **Issues** to keep bugs separate from planned work.",
            ],
          },
        ],
      },
      {
        id: "gantt",
        title: "Gantt timelines",
        blocks: [
          {
            type: "p",
            text: "The Gantt view lays out phases, milestones, and tasks on a calendar so you can spot overlaps and slipping dates. Dependencies are drawn between bars.",
          },
          {
            type: "callout",
            variant: "best-practice",
            text: "Set realistic start and due dates on every task — the Gantt chart is only as accurate as the dates behind it.",
          },
        ],
      },
      {
        id: "time-tracking",
        title: "Time logs & timesheets",
        blocks: [
          {
            type: "steps",
            items: [
              { title: "Log hours", text: "Add a time log from a task or **Projects → Time Logs** with date, duration, and notes." },
              { title: "Submit the week", text: "Hours are grouped into weekly timesheets per person." },
              { title: "Approve", text: "Managers approve or reject timesheets under **Approvals**; approved billable hours are ready to invoice." },
            ],
          },
          {
            type: "callout",
            variant: "tip",
            text: "Log time daily. Small, frequent entries are far more accurate than end-of-week guesses.",
          },
        ],
      },
      {
        id: "collaboration",
        title: "Collaboration",
        blocks: [
          {
            type: "p",
            text: "**Projects → Collaboration** brings together a project feed, a shared calendar, and real-time chat. Pick a project in the chat to keep conversations attached to the work they're about.",
          },
        ],
      },
    ],
  },
  {
    slug: "integrations",
    title: "Cross-App Integrations",
    description: "How CRM, Finance, and Projects hand work to each other without re-entering data.",
    sections: [
      {
        id: "deal-to-cash",
        title: "The deal-to-cash flow",
        blocks: [
          {
            type: "flow",
            items: [
              { app: "CRM", title: "Close the deal", text: "Mark the deal as Closed Won in the pipeline." },
              { app: "Projects", title: "Project & budget created", text: "A delivery project is generated with the deal value as its budget." },
              { app: "Projects", title: "Deliver & track", text: "The team works tasks, hits milestones, and logs approved time." },
              { app: "Finance", title: "Invoice the client", text: "The linked invoice is reviewed, sent, and paid." },
            ],
          },
        ],
      },
      {
        id: "linked-records",
        title: "Linked records",
        blocks: [
          {
            type: "table",
            head: ["From", "To", "What's shared"],
            rows: [
              ["Deal", "Project", "Client, value (as budget), owner"],
              ["Deal / Quote", "Invoice", "Client and line items"],
              ["Time logs", "Invoice", "Approved billable hours"],
              ["Expenses", "Invoice", "Rebillable costs"],
            ],
          },
          {
            type: "callout",
            variant: "note",
            text: "Linked records keep a reference to their source, so you can always navigate from an invoice back to the project and the deal that started it.",
          },
        ],
      },
    ],
  },
  {
    slug: "automations",
    title: "Workflow Automations",
    description: "Let Tactiq do the repetitive hand-offs between apps.",
    sections: [
      {
        id: "built-in",
        title: "Built-in automations",
        blocks: [
          {
            type: "table",
            head: ["Trigger", "Action"],
            rows: [
              ["Deal moved to Closed Won", "Create a delivery project with budget"],
              ["Deal moved to Closed Won", "Create a draft invoice in Finance"],
              ["Expenses selected", "Convert into a single invoice"],
            ],
          },
          {
            type: "callout",
            variant: "note",
            title: "Idempotent by design",
            text: "Each automation uses a unique key (for example `deal-won:<dealId>`), so re-opening and re-closing a deal never creates duplicate projects or invoices.",
          },
        ],
      },
      {
        id: "blueprints",
        title: "Blueprints",
        blocks: [
          {
            type: "p",
            text: "Administrators can review blueprints and automation rules under **Setup → Blueprints & Automation**. Blueprints define the standard phases and tasks a new project starts with.",
          },
          {
            type: "callout",
            variant: "best-practice",
            text: "Create one blueprint per service you sell (e.g. *Website build*, *Monthly retainer*) so every project starts consistently.",
          },
        ],
      },
      {
        id: "notifications",
        title: "Automation notifications",
        blocks: [
          {
            type: "p",
            text: "Every automation run is recorded in the audit log and appears in the notification bell, so the team knows when a project or invoice was created on their behalf.",
          },
        ],
      },
    ],
  },
  {
    slug: "keyboard-shortcuts",
    title: "Keyboard Shortcuts (⌘K)",
    description: "Move through Tactiq without reaching for the mouse.",
    sections: [
      {
        id: "global-search",
        title: "Global suite search",
        blocks: [
          {
            type: "p",
            text: "Press `⌘K` on macOS or `Ctrl K` on Windows and Linux anywhere inside a workspace to open global search. Results span deals, companies, contacts, projects, tasks, and invoices.",
          },
          {
            type: "shortcuts",
            items: [
              { keys: ["⌘", "K"], action: "Open global search (macOS)" },
              { keys: ["Ctrl", "K"], action: "Open global search (Windows / Linux)" },
              { keys: ["↑", "↓"], action: "Move between results" },
              { keys: ["Enter"], action: "Open the selected result" },
              { keys: ["Esc"], action: "Close search or any dialog" },
            ],
          },
        ],
      },
      {
        id: "docs-shortcuts",
        title: "Documentation shortcuts",
        blocks: [
          {
            type: "shortcuts",
            items: [
              { keys: ["/"], action: "Search the documentation" },
              { keys: ["⌘", "K"], action: "Search the documentation" },
            ],
          },
          {
            type: "callout",
            variant: "tip",
            text: "Search matches article titles and section headings, so typing *timesheet* jumps straight to the right paragraph.",
          },
        ],
      },
    ],
  },
  {
    slug: "security",
    title: "Security & Data",
    description: "How Tactiq isolates workspaces, controls access, and handles your data.",
    sections: [
      {
        id: "tenant-isolation",
        title: "Workspace isolation",
        blocks: [
          {
            type: "p",
            text: "Every record in Tactiq belongs to exactly one workspace, and every query is scoped to the active workspace. Members of one workspace can never read another workspace's data, even if they belong to both.",
          },
        ],
      },
      {
        id: "access-control",
        title: "Access control & audit",
        blocks: [
          {
            type: "list",
            items: [
              "Passwords are hashed; Google sign-in is supported for passwordless access.",
              "Every action is authorized against the member's role in the current workspace.",
              "Sensitive changes are written to an audit log with the actor and timestamp.",
            ],
          },
        ],
      },
      {
        id: "privacy",
        title: "Privacy",
        blocks: [
          {
            type: "p",
            text: "Your workspace data belongs to you. Tactiq uses it only to provide the service — it is not sold or shared with advertisers. Administrators can remove members and their access at any time.",
          },
        ],
      },
      {
        id: "terms-of-use",
        title: "Acceptable use",
        blocks: [
          {
            type: "p",
            text: "Use Tactiq for lawful business purposes, keep your credentials private, and only invite people who are authorized to see your workspace data.",
          },
          {
            type: "callout",
            variant: "note",
            text: "Questions about security or data handling? Contact your workspace Administrator or the Tactiq team.",
          },
        ],
      },
    ],
  },
];

export function getDocArticle(slug: string): DocArticle | undefined {
  return DOC_ARTICLES.find((a) => a.slug === slug);
}

export function getDocGroupTitle(slug: string): string | undefined {
  return DOC_GROUPS.find((g) => g.slugs.includes(slug))?.title;
}

/** Articles in sidebar order, for previous / next navigation. */
export function getOrderedDocArticles(): DocArticle[] {
  return DOC_GROUPS.flatMap((g) => g.slugs)
    .map((slug) => getDocArticle(slug))
    .filter((a): a is DocArticle => Boolean(a));
}
