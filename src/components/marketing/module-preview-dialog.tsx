"use client";

import * as React from "react";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  FileText,
  FolderKanban,
  GanttChart,
  Kanban,
  List,
  MessageSquare,
  Plus,
  Receipt,
  Send,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { TactiqMark } from "@/components/brand/tactiq-logo";
import { getSuiteApp, SUITE_APPS, type SuiteAppId } from "@/components/marketing/apps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MarketingViewer } from "@/server/marketing";

interface ModulePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: SuiteAppId;
  moduleName: string | null;
  onSelectApp: (id: SuiteAppId) => void;
  onSelectModule: (name: string) => void;
  viewer: MarketingViewer | null;
}

export function ModulePreviewDialog({
  open,
  onOpenChange,
  appId,
  moduleName,
  onSelectApp,
  onSelectModule,
  viewer,
}: ModulePreviewDialogProps) {
  const activeApp = getSuiteApp(appId);
  const ActiveIcon = activeApp.icon;
  const resolvedModule =
    activeApp.modules.find((m) => m.name === moduleName) ?? activeApp.modules[0]!;
  const liveHref = viewer?.workspaceSlug
    ? `/${viewer.workspaceSlug}${resolvedModule.path}`
    : "/signup";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ActiveIcon className={cn("size-4", activeApp.iconColor)} />
            <span>
              {activeApp.name} — {resolvedModule.name}
            </span>
          </DialogTitle>
          <DialogDescription>{resolvedModule.description}</DialogDescription>
        </DialogHeader>

        {/* Browser Frame Wrapper */}
        <div className="overflow-hidden rounded-xl border bg-card text-left shadow-lg dark:bg-[#121318]">
          {/* Browser Chrome + App Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2 sm:px-4 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-rose-400/80" />
                <span className="size-2.5 rounded-full bg-amber-400/80" />
                <span className="size-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <TactiqMark className="ml-1 hidden size-5 sm:block" />
              <div className="flex items-center gap-1 rounded-lg bg-muted/70 p-0.5">
                {SUITE_APPS.map((app) => {
                  const Icon = app.icon;
                  const selected = app.id === activeApp.id;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => {
                        onSelectApp(app.id);
                        onSelectModule(app.modules[0]!.name);
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition",
                        selected
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("size-3", selected && app.iconColor)} />
                      {app.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hidden items-center gap-1.5 rounded-md border bg-background/80 px-2.5 py-1 font-mono text-[11px] text-muted-foreground md:flex">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>tactiq / your-workspace{resolvedModule.path}</span>
            </div>
          </div>

          {/* Sub-Module Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto border-b px-3 py-2 sm:px-4">
            {activeApp.modules.map((mod) => {
              const isSelected = mod.name === resolvedModule.name;
              return (
                <button
                  key={mod.name}
                  type="button"
                  onClick={() => onSelectModule(mod.name)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Eye className="size-3 opacity-75" />
                  {mod.name}
                </button>
              );
            })}
          </div>

          {/* Dedicated Module View Canvas */}
          <div className="min-h-[340px] p-3 sm:p-5">
            <ModulePreviewCanvas appId={activeApp.id} moduleName={resolvedModule.name} />
          </div>

          {/* Modal Frame Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2.5 text-xs sm:px-4">
            <span className="text-muted-foreground">
              <strong className="font-medium text-foreground">{resolvedModule.name}:</strong>{" "}
              Interactive sample preview
            </span>
            <div className="flex items-center gap-3">
              <Link
                href={activeApp.docsHref}
                onClick={() => onOpenChange(false)}
                className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
              >
                <BookOpen className="size-3.5" />
                {activeApp.name} docs
              </Link>
              <Button asChild size="xs">
                <Link href={liveHref} onClick={() => onOpenChange(false)}>
                  {viewer?.workspaceSlug ? `Open ${resolvedModule.name}` : "Get Started Free"}
                  <ArrowRight className="size-3" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModulePreviewCanvas({
  appId,
  moduleName,
}: {
  appId: SuiteAppId;
  moduleName: string;
}) {
  if (appId === "projects") {
    switch (moduleName) {
      case "Tasks & Issue Tracking":
        return <ProjectsTasksAndIssuesPreview />;
      case "Time Logs & Approvals":
        return <ProjectsTimeLogsApprovalsPreview />;
      case "Collaboration & Chat":
        return <ProjectsCollaborationChatPreview />;
      default:
        return <ProjectsKanbanGanttPreview />;
    }
  }

  if (appId === "crm") {
    switch (moduleName) {
      case "Companies":
        return <CrmCompaniesPreview />;
      case "Contacts":
        return <CrmContactsPreview />;
      case "Won-Deal Handoff":
        return <CrmWonHandoffPreview />;
      default:
        return <CrmPipelinePreview />;
    }
  }

  switch (moduleName) {
    case "Quotes & Invoices":
      return <FinanceInvoicesPreview />;
    case "Payments Ledger":
      return <FinancePaymentsPreview />;
    case "Expenses & Catalog Items":
      return <FinanceExpensesCatalogPreview />;
    default:
      return <FinanceDashboardPreview />;
  }
}

/* ─────────────────────────── PROJECTS PREVIEWS ─────────────────────────── */

const GANTT_PHASES = [
  { name: "Discovery", owner: "AR", start: 0, span: 2, progress: "100%", color: "bg-sky-500" },
  { name: "UX & Design", owner: "ER", start: 1, span: 3, progress: "100%", color: "bg-violet-500" },
  { name: "Development", owner: "MT", start: 3, span: 5, progress: "65%", color: "bg-indigo-500" },
  { name: "QA & UAT", owner: "SL", start: 7, span: 2, progress: "20%", color: "bg-amber-500" },
  { name: "Launch", owner: "AR", start: 9, span: 1, progress: "0%", color: "bg-emerald-500" },
];

type KanbanStage = "To Do" | "In Progress" | "In Review" | "Done";

const INITIAL_KANBAN_CARDS: Array<{
  id: string;
  title: string;
  stage: KanbanStage;
  priority: "URGENT" | "HIGH" | "MEDIUM";
  assignee: string;
}> = [
  { id: "WR-101", title: "Wireframe approval sign-off", stage: "Done", priority: "HIGH", assignee: "ER" },
  { id: "WR-102", title: "Build client portal dashboard", stage: "In Progress", priority: "URGENT", assignee: "MT" },
  { id: "WR-103", title: "Invoice PDF export template", stage: "In Review", priority: "HIGH", assignee: "SL" },
  { id: "WR-104", title: "Setup staging webhooks", stage: "To Do", priority: "MEDIUM", assignee: "AR" },
  { id: "WR-105", title: "Mobile responsive table QA", stage: "To Do", priority: "HIGH", assignee: "SL" },
];

const KANBAN_ORDER: KanbanStage[] = ["To Do", "In Progress", "In Review", "Done"];

function ProjectsKanbanGanttPreview() {
  const [view, setView] = React.useState<"gantt" | "kanban" | "list">("gantt");
  const [cards, setCards] = React.useState(INITIAL_KANBAN_CARDS);
  const weeks = 10;

  const advanceCard = (id: string) => {
    setCards((prev) =>
      prev.map((card) => {
        if (card.id !== id) return card;
        const idx = KANBAN_ORDER.indexOf(card.stage);
        return { ...card, stage: KANBAN_ORDER[(idx + 1) % KANBAN_ORDER.length]! };
      }),
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/25 px-3 py-2">
        <div>
          <p className="text-sm font-semibold">Website Redesign &amp; Client Portal</p>
          <p className="text-[11px] text-muted-foreground">
            Northstar Studio · 5 Phases · 68% complete · ₱250,000 budget
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-background p-0.5">
          {[
            { id: "gantt", label: "Gantt & Phases", icon: GanttChart },
            { id: "kanban", label: "Kanban Board", icon: Kanban },
            { id: "list", label: "Project List", icon: List },
          ].map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id as "gantt" | "kanban" | "list")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                  active
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {view === "gantt" && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border">
            <div className="min-w-[540px]">
              <div
                className="grid border-b bg-muted/30 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                style={{ gridTemplateColumns: `9.5rem 3.5rem repeat(${weeks}, minmax(0,1fr))` }}
              >
                <span className="px-3 py-2">Phase</span>
                <span className="border-l px-2 py-2 text-center">Done</span>
                {Array.from({ length: weeks }).map((_, i) => (
                  <span key={i} className="border-l px-1 py-2 text-center">
                    W{i + 1}
                  </span>
                ))}
              </div>
              {GANTT_PHASES.map((row) => (
                <div
                  key={row.name}
                  className="grid items-center border-b last:border-0"
                  style={{ gridTemplateColumns: `9.5rem 3.5rem repeat(${weeks}, minmax(0,1fr))` }}
                >
                  <div className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold">
                      {row.owner}
                    </span>
                    <span className="truncate">{row.name}</span>
                  </div>
                  <span className="border-l px-2 py-2.5 text-center text-[11px] font-medium tabular-nums text-muted-foreground">
                    {row.progress}
                  </span>
                  <div
                    className="relative col-span-full col-start-3 h-9 border-l"
                    style={{ gridColumn: `3 / span ${weeks}` }}
                  >
                    <div
                      className={cn(
                        "absolute top-1/2 flex h-5 -translate-y-1/2 items-center px-2 text-[10px] font-medium text-white rounded-md shadow-xs",
                        row.color,
                      )}
                      style={{
                        left: `${(row.start / weeks) * 100}%`,
                        width: `${(row.span / weeks) * 100}%`,
                      }}
                    >
                      <span className="truncate">{row.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Switch to <strong>Kanban Board</strong> or <strong>Project List</strong> above to inspect the same delivery workspace in different views.
          </p>
        </div>
      )}

      {view === "kanban" && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {KANBAN_ORDER.map((stage) => {
            const stageCards = cards.filter((c) => c.stage === stage);
            return (
              <div key={stage} className="rounded-lg border bg-muted/30 p-2.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold">{stage}</span>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {stageCards.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {stageCards.map((card) => (
                    <div key={card.id} className="rounded-md border bg-background p-2.5 shadow-2xs">
                      <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                        <span className="font-mono font-semibold">{card.id}</span>
                        <Badge variant="outline" className="px-1 py-0 text-[9px]">
                          {card.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs font-medium leading-snug">{card.title}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold">
                          {card.assignee}
                        </span>
                        <button
                          type="button"
                          onClick={() => advanceCard(card.id)}
                          className="text-[10px] font-medium text-primary hover:underline"
                        >
                          Move →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "list" && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Project Name</th>
                <th className="px-3 py-2">%</th>
                <th className="px-3 py-2">Owner</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Tasks</th>
                <th className="px-3 py-2">Start Date</th>
                <th className="px-3 py-2">End Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { name: "Website Redesign & Client Portal", pct: 68, owner: "Andrei D.", status: "Active", tasks: "14/22", start: "Nov 02", end: "Dec 20" },
                { name: "ERP Rollout — Phase 2", pct: 45, owner: "Elena R.", status: "Active", tasks: "9/20", start: "Nov 10", end: "Jan 15" },
                { name: "Q4 Security & Compliance Audit", pct: 100, owner: "Marco T.", status: "Completed", tasks: "12/12", start: "Oct 01", end: "Nov 15" },
              ].map((row) => (
                <tr key={row.name} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5 font-medium">{row.name}</td>
                  <td className="px-3 py-2.5 tabular-nums">{row.pct}%</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.owner}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={row.status === "Completed" ? "secondary" : "default"} className="text-[10px]">
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{row.tasks}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.start}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.end}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProjectsTasksAndIssuesPreview() {
  const [tasks, setTasks] = React.useState([
    { id: "WR-101", title: "Finalize checkout UX wireframes", due: "Nov 22", priority: "HIGH", done: true },
    { id: "WR-102", title: "Implement webhook signature verification", due: "Nov 24", priority: "URGENT", done: false },
    { id: "WR-103", title: "Connect client portal timezone settings", due: "Nov 26", priority: "MEDIUM", done: false },
    { id: "WR-104", title: "Prepare client UAT test script", due: "Nov 28", priority: "LOW", done: false },
  ]);
  const [issues, setIssues] = React.useState([
    { key: "ISS-019", title: "PDF export wraps long invoice currency totals", severity: "CRITICAL", status: "OPEN" as "OPEN" | "IN_PROGRESS" | "RESOLVED" },
    { key: "ISS-020", title: "Safari modal backdrop scroll lock offset", severity: "HIGH", status: "IN_PROGRESS" as "OPEN" | "IN_PROGRESS" | "RESOLVED" },
    { key: "ISS-021", title: "Upload progress bar reset on retry", severity: "MEDIUM", status: "RESOLVED" as "OPEN" | "IN_PROGRESS" | "RESOLVED" },
  ]);

  const cycleIssue = (key: string) => {
    const order: Array<"OPEN" | "IN_PROGRESS" | "RESOLVED"> = ["OPEN", "IN_PROGRESS", "RESOLVED"];
    setIssues((prev) =>
      prev.map((iss) =>
        iss.key === key
          ? { ...iss, status: order[(order.indexOf(iss.status) + 1) % order.length]! }
          : iss,
      ),
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold">Project Tasks ({tasks.filter((t) => t.done).length}/{tasks.length} done)</p>
            <p className="text-[11px] text-muted-foreground">Click any task checkbox to toggle status</p>
          </div>
          <Badge variant="outline" className="text-[10px]">Website Redesign</Badge>
        </div>
        <div className="space-y-2">
          {tasks.map((task) => (
            <label
              key={task.id}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs hover:bg-muted/30"
            >
              <span className="flex min-w-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() =>
                    setTasks((prev) =>
                      prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)),
                    )
                  }
                  className="size-3.5 accent-primary"
                />
                <span className="font-mono text-[10px] text-muted-foreground">{task.id}</span>
                <span className={cn("truncate font-medium", task.done && "text-muted-foreground line-through")}>
                  {task.title}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">{task.due}</span>
                <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">{task.priority}</Badge>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-lg border p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold">Bug &amp; Issue Tracker</p>
            <p className="text-[11px] text-muted-foreground">Click status pill to triage issues</p>
          </div>
          <Badge variant="destructive" className="text-[10px]">
            {issues.filter((i) => i.status !== "RESOLVED").length} active
          </Badge>
        </div>
        <div className="space-y-2">
          {issues.map((iss) => (
            <div key={iss.key} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-semibold text-rose-600">{iss.key}</span>
                  <Badge variant="outline" className="px-1 py-0 text-[9px]">{iss.severity}</Badge>
                </div>
                <p className="mt-0.5 truncate font-medium">{iss.title}</p>
              </div>
              <button
                type="button"
                onClick={() => cycleIssue(iss.key)}
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
                  iss.status === "RESOLVED"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : iss.status === "IN_PROGRESS"
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-rose-500/15 text-rose-600",
                )}
              >
                {iss.status.replace("_", " ")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectsTimeLogsApprovalsPreview() {
  const [approvedIds, setApprovedIds] = React.useState<string[]>([]);
  const pendingItems = [
    { id: "ts-1", kind: "Timesheet", submitter: "Elena Reyes", detail: "38.5h billable · Nov 14–20", amount: "₱57,750" },
    { id: "exp-1", kind: "Expense Claim", submitter: "Marco Tan", detail: "Cloudflare staging domain & SSL", amount: "₱12,500" },
  ];
  const pendingRemaining = pendingItems.filter((i) => !approvedIds.includes(i.id)).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="rounded-lg border bg-background/60 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Hours Logged (Week)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">46.5 hrs</p>
        </div>
        <div className="rounded-lg border bg-background/60 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Billable Amount</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">₱69,750</p>
        </div>
        <div className="rounded-lg border bg-background/60 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Awaiting Sign-Off</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400">{pendingRemaining}</p>
        </div>
      </div>

      <div className="rounded-lg border p-3.5">
        <p className="mb-2.5 text-xs font-semibold">Manager Approvals Queue</p>
        <div className="space-y-2">
          {pendingItems.map((item) => {
            const approved = approvedIds.includes(item.id);
            return (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2.5 text-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{item.kind}</Badge>
                    <span className="font-semibold">{item.submitter}</span>
                  </div>
                  <p className="mt-0.5 text-muted-foreground">{item.detail} · <strong className="text-foreground">{item.amount}</strong></p>
                </div>
                {approved ? (
                  <Badge className="gap-1 bg-emerald-600 text-[10px] text-white">
                    <CheckCircle2 className="size-3" />
                    Approved
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    size="xs"
                    onClick={() => setApprovedIds((prev) => [...prev, item.id])}
                  >
                    Approve
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProjectsCollaborationChatPreview() {
  const [channel, setChannel] = React.useState<"Website Redesign" | "General Workspace">("Website Redesign");
  const [draft, setDraft] = React.useState("");
  const [messages, setMessages] = React.useState([
    { id: "m1", channel: "Website Redesign", sender: "Elena Reyes", time: "14:15 GMT+8", text: "Client approved the header layout — ready for staging deploy!", own: false },
    { id: "m2", channel: "Website Redesign", sender: "You", time: "14:18 GMT+8", text: "Deploying build #42 now and linking the invoice milestone.", own: true },
    { id: "m3", channel: "General Workspace", sender: "Marco Tan", time: "16:05 GMT+8", text: "Friday sprint demo starts at 10:00 AM Manila time.", own: false },
  ]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim();
    if (!clean) return;
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}`, channel, sender: "You", time: "Just now", text: clean, own: true },
    ]);
    setDraft("");
  };

  return (
    <div className="grid overflow-hidden rounded-lg border md:grid-cols-[190px_1fr]">
      <div className="border-b bg-muted/25 p-2.5 md:border-r md:border-b-0">
        <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Project Channels
        </p>
        {(["Website Redesign", "General Workspace"] as const).map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => setChannel(ch)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium",
              channel === ch ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MessageSquare className="size-3.5 text-violet-500" />
            <span className="truncate">{ch}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
          <span className="font-semibold"># {channel}</span>
          <span className="text-[11px] text-muted-foreground">Asia/Manila (GMT+8)</span>
        </div>
        <div className="flex-1 space-y-2.5 p-3">
          {messages
            .filter((m) => m.channel === channel)
            .map((m) => (
              <div key={m.id} className={cn("flex flex-col", m.own ? "items-end" : "items-start")}>
                <span className="mb-0.5 text-[10px] text-muted-foreground">
                  {m.sender} · {m.time}
                </span>
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-1.5 text-xs",
                    m.own ? "bg-indigo-600 text-white" : "border bg-muted/50",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
        </div>
        <form onSubmit={sendMessage} className="flex gap-2 border-t p-2.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message #${channel}...`}
            className="h-8 flex-1 rounded-md border bg-background px-2.5 text-xs outline-none"
          />
          <Button type="submit" size="xs" className="gap-1">
            <Send className="size-3" />
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}

/* ───────────────────────────── CRM PREVIEWS ────────────────────────────── */

const DEAL_STAGES_ORDER = ["Qualification", "Proposal", "Negotiation", "Closed Won"] as const;

function CrmPipelinePreview() {
  const [deals, setDeals] = React.useState([
    { id: "d1", title: "Website Redesign", company: "Northstar Studio", amount: 180000, stage: "Qualification" },
    { id: "d2", title: "Mobile App Build", company: "Summit Logistics", amount: 650000, stage: "Proposal" },
    { id: "d3", title: "Brand Refresh", company: "Solana Retail", amount: 120000, stage: "Negotiation" },
    { id: "d4", title: "ERP Rollout", company: "Manila ColdChain", amount: 900000, stage: "Closed Won" },
  ]);

  const moveNext = (id: string) => {
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const nextIdx = (DEAL_STAGES_ORDER.indexOf(d.stage as (typeof DEAL_STAGES_ORDER)[number]) + 1) % DEAL_STAGES_ORDER.length;
        return { ...d, stage: DEAL_STAGES_ORDER[nextIdx]! };
      }),
    );
  };

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {DEAL_STAGES_ORDER.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage === stage);
        const total = stageDeals.reduce((sum, d) => sum + d.amount, 0);
        return (
          <div key={stage} className="rounded-lg border bg-muted/30 p-2.5">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold">
              <span>{stage}</span>
              <span className="text-[11px] text-muted-foreground">₱{(total / 1000).toFixed(0)}k</span>
            </div>
            <div className="space-y-2">
              {stageDeals.map((d) => (
                <div key={d.id} className="rounded-md border bg-background p-2.5 shadow-2xs">
                  <p className="truncate text-xs font-semibold">{d.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{d.company}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold tabular-nums">₱{d.amount.toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={() => moveNext(d.id)}
                      className="text-[10px] font-medium text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Advance →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CrmCompaniesPreview() {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-xs">
        <thead className="border-b bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Industry</th>
            <th className="px-3 py-2">Open Deals</th>
            <th className="px-3 py-2">Active Projects</th>
            <th className="px-3 py-2 text-right">Billed Value</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {[
            { name: "Manila ColdChain Corp.", industry: "Cold Logistics", deals: 2, projects: 1, billed: "₱900,000" },
            { name: "Northstar Studio", industry: "Creative Agency", deals: 1, projects: 1, billed: "₱250,000" },
            { name: "Summit Logistics Inc.", industry: "Freight & Supply Chain", deals: 1, projects: 0, billed: "₱0" },
          ].map((c) => (
            <tr key={c.name} className="hover:bg-muted/20">
              <td className="flex items-center gap-2 px-3 py-2.5 font-semibold">
                <Building2 className="size-3.5 text-sky-500" />
                {c.name}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{c.industry}</td>
              <td className="px-3 py-2.5">{c.deals}</td>
              <td className="px-3 py-2.5">{c.projects}</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{c.billed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CrmContactsPreview() {
  const [filter, setFilter] = React.useState<"ALL" | "CUSTOMER" | "LEAD">("ALL");
  const contacts = [
    { name: "Elena Reyes", role: "Operations Director", company: "Northstar Studio", email: "elena@northstar.ph", stage: "CUSTOMER" },
    { name: "Marco Tan", role: "VP Engineering", company: "Manila ColdChain", email: "m.tan@coldchain.ph", stage: "CUSTOMER" },
    { name: "Sofia Lim", role: "Head of Procurement", company: "Summit Logistics", email: "sofia@summit.com", stage: "LEAD" },
  ];
  const visible = contacts.filter((c) => filter === "ALL" || c.stage === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        {(["ALL", "CUSTOMER", "LEAD"] as const).map((f) => (
          <Button
            key={f}
            type="button"
            size="xs"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? "All Contacts" : f}
          </Button>
        ))}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {visible.map((c) => (
          <div key={c.email} className="rounded-lg border p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-semibold">
                <Users className="size-3.5 text-sky-500" />
                {c.name}
              </span>
              <Badge variant={c.stage === "CUSTOMER" ? "default" : "secondary"} className="text-[9px]">
                {c.stage}
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{c.role} · {c.company}</p>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">{c.email}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrmWonHandoffPreview() {
  const [won, setWon] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/25 p-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="size-4 text-sky-500" />
            <span className="text-sm font-semibold">Mobile App Build — Summit Logistics</span>
            <Badge variant={won ? "default" : "outline"} className="text-[10px]">
              {won ? "CLOSED WON" : "Negotiation"}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Deal value: ₱650,000</p>
        </div>
        <Button type="button" size="sm" onClick={() => setWon((v) => !v)} className="gap-1.5">
          <Sparkles className="size-3.5" />
          {won ? "Reset Demo" : "Move to Closed Won →"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "CRM Contact Promoted",
            status: won ? "Promoted → CUSTOMER" : "Currently LEAD",
            icon: Users,
          },
          {
            title: "Delivery Project Created",
            status: won ? "Mobile App Build (5 phases seeded)" : "Waiting for Closed Won",
            icon: FolderKanban,
          },
          {
            title: "Draft Invoice Provisioned",
            status: won ? "INV-0046 · ₱650,000 (Draft)" : "Waiting for Closed Won",
            icon: Receipt,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className={cn(
                "rounded-lg border p-3.5 transition-colors",
                won ? "border-emerald-500/40 bg-emerald-500/[0.05]" : "bg-muted/20",
              )}
            >
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Icon className={cn("size-4", won ? "text-emerald-600" : "text-muted-foreground")} />
                {card.title}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{card.status}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── FINANCE PREVIEWS ──────────────────────────── */

function FinanceDashboardPreview() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total Receivables", val: "₱295,000", sub: "2 sent · 1 overdue" },
          { label: "Collected This Month", val: "₱450,000", sub: "Paid via Bank Transfer" },
          { label: "Unbilled Project Expenses", val: "₱20,900", sub: "Ready for invoice rebill" },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border p-3.5">
            <p className="text-[11px] font-medium text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{k.val}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{k.sub}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border p-3.5">
        <p className="mb-2 text-xs font-semibold">Collection Health Breakdown</p>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[68%] bg-emerald-500" title="Paid 68%" />
          <div className="h-full w-[24%] bg-sky-500" title="Sent 24%" />
          <div className="h-full w-[8%] bg-rose-500" title="Overdue 8%" />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500" /> Paid (68%)</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-sky-500" /> Sent (24%)</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-500" /> Overdue (8%)</span>
        </div>
      </div>
    </div>
  );
}

function FinanceInvoicesPreview() {
  const [draftAdded, setDraftAdded] = React.useState(false);
  const invoices = draftAdded
    ? [
        { no: "INV-0046", source: "QT-0019 · Mobile App Build", amount: "₱120,000", status: "Draft" },
        { no: "INV-0045", source: "Northstar Studio Retainer", amount: "₱90,000", status: "Sent" },
        { no: "INV-0044", source: "Manila ColdChain ERP", amount: "₱450,000", status: "Paid" },
      ]
    : [
        { no: "INV-0045", source: "Northstar Studio Retainer", amount: "₱90,000", status: "Sent" },
        { no: "INV-0044", source: "Manila ColdChain ERP", amount: "₱450,000", status: "Paid" },
      ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <FileText className="size-3.5 text-emerald-600" />
          Quotes &amp; Client Invoices
        </span>
        <Button type="button" size="xs" variant={draftAdded ? "secondary" : "outline"} onClick={() => setDraftAdded((v) => !v)}>
          {draftAdded ? <Check className="size-3 text-emerald-500" /> : <Plus className="size-3" />}
          {draftAdded ? "INV-0046 Drafted" : "Convert Quote QT-0019 → Invoice"}
        </Button>
      </div>
      <div className="divide-y rounded-lg border">
        {invoices.map((inv) => (
          <div key={inv.no} className="flex items-center justify-between px-3 py-2.5 text-xs">
            <div>
              <p className="font-mono font-semibold">{inv.no}</p>
              <p className="text-muted-foreground">{inv.source}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold tabular-nums">{inv.amount}</span>
              <Badge variant={inv.status === "Paid" ? "default" : "secondary"} className="text-[10px]">
                {inv.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinancePaymentsPreview() {
  const [settled, setSettled] = React.useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/25 px-3 py-2 text-xs">
        <span>
          <strong>INV-0045</strong> remaining balance:{" "}
          <strong className="tabular-nums">{settled ? "₱0.00 (Paid)" : "₱45,000.00"}</strong>
        </span>
        <Button type="button" size="xs" onClick={() => setSettled((v) => !v)}>
          <CreditCard className="size-3" />
          {settled ? "Reset Balance" : "Record ₱45,000 Payment"}
        </Button>
      </div>
      <div className="divide-y rounded-lg border text-xs">
        {[
          { id: "PAY-1029", inv: "INV-0044", method: "Bank Transfer", date: "Nov 18", amount: "₱450,000" },
          { id: "PAY-1030", inv: "INV-0045", method: "GCash / Maya", date: "Nov 19", amount: "₱45,000" },
          ...(settled ? [{ id: "PAY-1031", inv: "INV-0045", method: "Bank Transfer", date: "Today", amount: "₱45,000" }] : []),
        ].map((p) => (
          <div key={p.id} className="flex items-center justify-between px-3 py-2.5">
            <div>
              <p className="font-mono font-semibold">{p.id} → {p.inv}</p>
              <p className="text-muted-foreground">{p.method} · {p.date}</p>
            </div>
            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{p.amount}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FinanceExpensesCatalogPreview() {
  const [rebilled, setRebilled] = React.useState(false);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border p-3.5 text-xs">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-semibold">
            <Wallet className="size-3.5 text-emerald-600" />
            Project Expenses
          </span>
          <Button type="button" size="xs" variant="outline" onClick={() => setRebilled((v) => !v)}>
            {rebilled ? "Billed to INV-0046" : "Rebill Unbilled → Invoice"}
          </Button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded border px-2.5 py-2">
            <div>
              <p className="font-medium">Cloudflare Staging Domain</p>
              <p className="text-muted-foreground">Website Redesign · ₱12,500</p>
            </div>
            <Badge variant={rebilled ? "default" : "secondary"} className="text-[10px]">
              {rebilled ? "Billed" : "Unbilled"}
            </Badge>
          </div>
          <div className="flex items-center justify-between rounded border px-2.5 py-2">
            <div>
              <p className="font-medium">UI Font &amp; Icon License</p>
              <p className="text-muted-foreground">Website Redesign · ₱8,400</p>
            </div>
            <Badge variant={rebilled ? "default" : "secondary"} className="text-[10px]">
              {rebilled ? "Billed" : "Unbilled"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-3.5 text-xs">
        <div className="mb-2.5 flex items-center gap-1.5 font-semibold">
          <Clock className="size-3.5 text-indigo-500" />
          Service Catalog Items
        </div>
        <div className="space-y-2">
          {[
            { name: "UX & Design Sprint", unit: "Fixed Phase", rate: "₱75,000" },
            { name: "Full-Stack Engineering", unit: "Per Hour", rate: "₱1,500 / hr" },
            { name: "Monthly Maintenance Retainer", unit: "Recurring", rate: "₱40,000 / mo" },
          ].map((item) => (
            <div key={item.name} className="flex items-center justify-between rounded border px-2.5 py-2">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-muted-foreground">{item.unit}</p>
              </div>
              <span className="font-semibold tabular-nums">{item.rate}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
