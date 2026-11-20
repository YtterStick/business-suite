"use client";

import * as React from "react";
import { ArrowRight, BookOpen, Check, Plus, Search } from "lucide-react";
import Link from "next/link";

import { TactiqMark } from "@/components/brand/tactiq-logo";
import {
  getSuiteApp,
  isSuiteAppId,
  SUITE_APPS,
  type SuiteAppId,
} from "@/components/marketing/apps";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MarketingViewer } from "@/server/marketing";

const AUTO_CYCLE_MS = 6500;
const SWITCH_SKELETON_MS = 380;

/**
 * Interactive browser mockup for the Hero section showcasing Tactiq's
 * unified CRM, Finance, and Projects workspaces across desktop and mobile.
 */
export function HeroPreviewTabs({
  viewer = null,
  initialTab = "projects",
}: {
  viewer?: MarketingViewer | null;
  initialTab?: SuiteAppId;
}) {
  const [active, setActive] = React.useState<SuiteAppId>(initialTab);
  const [loading, setLoading] = React.useState(false);
  const [interacted, setInteracted] = React.useState(initialTab !== "projects");

  React.useEffect(() => {
    setActive(initialTab);
  }, [initialTab]);

  const switchTo = React.useCallback((next: SuiteAppId) => {
    setLoading(true);
    setActive(next);
    window.setTimeout(() => setLoading(false), SWITCH_SKELETON_MS);
  }, []);

  React.useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (isSuiteAppId(hash)) {
        setInteracted(true);
        setActive(hash);
      }
    };
    const handleEvent = (event: Event) => {
      const next = (event as CustomEvent<SuiteAppId>).detail;
      if (isSuiteAppId(next)) {
        setInteracted(true);
        switchTo(next);
      }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("tq-select-app", handleEvent);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("tq-select-app", handleEvent);
    };
  }, [switchTo]);

  React.useEffect(() => {
    if (interacted) return;
    const id = window.setInterval(() => {
      setActive((current) => {
        const idx = SUITE_APPS.findIndex((a) => a.id === current);
        const next = SUITE_APPS[(idx + 1) % SUITE_APPS.length]!.id;
        setLoading(true);
        window.setTimeout(() => setLoading(false), SWITCH_SKELETON_MS);
        return next;
      });
    }, AUTO_CYCLE_MS);
    return () => window.clearInterval(id);
  }, [interacted]);

  const select = (id: SuiteAppId) => {
    setInteracted(true);
    if (id !== active) switchTo(id);
  };

  const activeApp = getSuiteApp(active);
  const liveHref = viewer?.workspaceSlug
    ? `/${viewer.workspaceSlug}${activeApp.defaultAppPath}`
    : "/signup";

  return (
    <div className="relative">
      {/* Glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-8 -bottom-12 -z-10 rounded-[2.5rem] bg-gradient-to-tr from-indigo-500/15 via-violet-500/10 to-cyan-400/15 blur-3xl sm:-inset-x-10"
      />

      <div className="overflow-hidden rounded-2xl border bg-card text-left shadow-2xl shadow-indigo-950/10 ring-1 ring-black/5 dark:bg-[#121318] dark:ring-white/5">
        {/* Browser chrome */}
        <div className="flex items-center gap-2.5 border-b bg-muted/40 px-3 py-2.5 sm:px-4 dark:bg-white/[0.02]">
          <div className="flex shrink-0 gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-rose-400/80" />
            <span className="size-2.5 rounded-full bg-amber-400/80" />
            <span className="size-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <div className="mx-auto flex min-w-0 flex-1 items-center gap-2 rounded-md border bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground sm:max-w-sm">
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate font-mono text-[10px] sm:text-[11px]">
              tactiq / your-workspace / {activeApp.id}
            </span>
          </div>
          <div className="hidden w-12 shrink-0 sm:block" />
        </div>

        <div className="min-h-[380px]">
          {/* Single unified app switcher + main preview body */}
          <div className="min-w-0">
            {/* Switcher tab bar */}
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5 sm:px-4">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <TactiqMark className="hidden size-6 shrink-0 sm:block" />
                <div
                  className="grid w-full grid-cols-3 gap-1 rounded-lg bg-muted/60 p-0.5 sm:flex sm:w-auto"
                  role="tablist"
                  aria-label="Preview application tab"
                >
                  {SUITE_APPS.map((app) => {
                    const Icon = app.icon;
                    const isActive = app.id === active;
                    return (
                      <button
                        key={app.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => select(app.id)}
                        className={cn(
                          "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all sm:py-1",
                          isActive
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className={cn("size-3.5", isActive && app.iconColor)} />
                        {app.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] text-muted-foreground md:flex">
                <Search className="size-3" />
                Search everything
                <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
              </div>
            </div>

            <div className="p-3 sm:p-4">
              {loading ? (
                <ShowcaseSkeleton />
              ) : (
                <div key={active} className="tq-rise">
                  {active === "crm" && <CrmPreview />}
                  {active === "finance" && <FinancePreview />}
                  {active === "projects" && <ProjectsPreview />}
                </div>
              )}
            </div>

            {/* Footer action bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2.5 text-xs sm:px-4">
              <span className="text-muted-foreground">
                <strong className="font-medium text-foreground">{activeApp.name}:</strong>{" "}
                {activeApp.tagline}
              </span>
              <div className="flex items-center gap-3">
                <Link
                  href={activeApp.docsHref}
                  className="inline-flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <BookOpen className="size-3.5" />
                  {activeApp.name} docs
                </Link>
                <Link
                  href={liveHref}
                  className="inline-flex items-center gap-1 font-medium text-indigo-600 transition-colors hover:text-indigo-500 dark:text-indigo-400"
                >
                  {viewer?.workspaceSlug ? `Open ${activeApp.name}` : `Try ${activeApp.name}`}
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShowcaseSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading preview">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-6 w-1/3" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    </div>
  );
}

const CRM_STAGES = [
  {
    name: "Qualification",
    color: "bg-sky-500",
    total: "₱420k",
    deals: [
      ["Website Redesign", "₱180k", "Northstar Studio"],
      ["IT Support Retainer", "₱240k", "Harbor Freight"],
    ],
  },
  {
    name: "Proposal",
    color: "bg-violet-500",
    total: "₱650k",
    deals: [["Mobile App Build", "₱650k", "Summit Logistics"]],
  },
  {
    name: "Negotiation",
    color: "bg-amber-500",
    total: "₱310k",
    deals: [
      ["Brand Refresh", "₱120k", "Solana Retail"],
      ["Data Migration", "₱190k", "Pacific Health"],
    ],
  },
  {
    name: "Won",
    color: "bg-emerald-500",
    total: "₱900k",
    deals: [["ERP Rollout", "₱900k", "Manila ColdChain"]],
  },
] as const;

function CrmPreview() {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/25 px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold">Sales Pipeline</span>
          <span className="text-muted-foreground">6 active deals · ₱2.28M total</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-400">
          Auto-syncs won deals → Projects
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {CRM_STAGES.map((stage) => (
          <div key={stage.name} className="rounded-lg border bg-muted/30 p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <span className={cn("size-2 rounded-full", stage.color)} />
                {stage.name}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">{stage.total}</span>
            </div>
            <div className="space-y-2">
              {stage.deals.map(([name, value, company]) => (
                <div key={name} className="rounded-md border bg-background p-2.5 shadow-xs">
                  <p className="truncate text-xs font-medium">{name}</p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{company}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold tabular-nums">{value}</span>
                    <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold">
                      {company.slice(0, 1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const BASE_INVOICES = [
  {
    no: "INV-0042",
    project: "ERP Rollout",
    amount: "₱450,000",
    status: "Paid",
    cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    no: "INV-0043",
    project: "Website Redesign",
    amount: "₱90,000",
    status: "Sent",
    cls: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    no: "INV-0044",
    project: "IT Support Retainer",
    amount: "₱40,000",
    status: "Overdue",
    cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  {
    no: "INV-0045",
    project: "Brand Refresh",
    amount: "₱60,000",
    status: "Draft",
    cls: "bg-muted text-muted-foreground",
  },
] as const;

function FinancePreview() {
  const [draftAdded, setDraftAdded] = React.useState(false);

  const rows = draftAdded
    ? [
        {
          no: "INV-0046",
          project: "Mobile App Deposit",
          amount: "₱120,000",
          status: "Draft",
          cls: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
        },
        ...BASE_INVOICES,
      ]
    : BASE_INVOICES;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {[
          ["Outstanding Invoices", draftAdded ? "₱310,000" : "₱190,000", "text-foreground"],
          ["Paid This Month", "₱450,000", "text-emerald-600 dark:text-emerald-400"],
          ["Net Cash Flow", "+₱382,000", "text-sky-600 dark:text-sky-400"],
        ].map(([label, value, cls]) => (
          <div key={label} className="rounded-lg border bg-background/60 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className={cn("mt-1 text-lg font-semibold tabular-nums", cls)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
          <span className="text-xs font-semibold">Recent Invoices</span>
          <Button
            type="button"
            size="xs"
            variant={draftAdded ? "secondary" : "outline"}
            onClick={() => setDraftAdded((v) => !v)}
            className="h-7 gap-1 text-[11px]"
          >
            {draftAdded ? (
              <>
                <Check className="size-3 text-emerald-500" />
                Draft INV-0046 Created
              </>
            ) : (
              <>
                <Plus className="size-3" />
                Create Invoice
              </>
            )}
          </Button>
        </div>

        {/* Desktop table header */}
        <div className="hidden grid-cols-[1fr_1.4fr_1fr_auto] gap-3 border-b bg-muted/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
          <span>Invoice</span>
          <span>Project</span>
          <span className="text-right">Amount</span>
          <span className="w-16 text-right">Status</span>
        </div>

        {rows.map((inv) => (
          <div key={inv.no} className="border-b px-3 py-2.5 text-xs last:border-0 sm:py-2">
            {/* Mobile stacked row */}
            <div className="flex items-center justify-between gap-2 sm:hidden">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold">{inv.no}</p>
                <p className="truncate text-muted-foreground">{inv.project}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums">{inv.amount}</p>
                <span
                  className={cn(
                    "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                    inv.cls,
                  )}
                >
                  {inv.status}
                </span>
              </div>
            </div>

            {/* Desktop table row */}
            <div className="hidden grid-cols-[1fr_1.4fr_1fr_auto] items-center gap-3 sm:grid">
              <span className="font-mono text-[11px]">{inv.no}</span>
              <span className="truncate">{inv.project}</span>
              <span className="text-right font-medium tabular-nums">{inv.amount}</span>
              <span
                className={cn(
                  "w-16 rounded-full px-2 py-0.5 text-center text-[10px] font-medium",
                  inv.cls,
                )}
              >
                {inv.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const GANTT = [
  { name: "Discovery", start: 0, span: 2, color: "bg-sky-500" },
  { name: "UX & Design", start: 1, span: 3, color: "bg-violet-500" },
  { name: "Development", start: 3, span: 5, color: "bg-indigo-500" },
  { name: "QA & UAT", start: 7, span: 2, color: "bg-amber-500" },
  { name: "Launch", start: 9, span: 1, color: "bg-emerald-500" },
];

function ProjectsPreview() {
  const weeks = 10;
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Website Redesign</p>
          <p className="text-[11px] text-muted-foreground">5 phases · 42 tasks · 186h logged</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="uppercase tracking-wider">Milestones</span>
              <span className="font-semibold text-foreground">68%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted sm:w-24">
              <div className="h-full w-[68%] rounded-full bg-emerald-500" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="uppercase tracking-wider">Budget used</span>
              <span className="font-semibold text-foreground">62%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted sm:w-24">
              <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Horizontally scrollable Gantt timeline so mobile preserves readable proportions */}
      <div className="overflow-x-auto rounded-lg border">
        <div className="min-w-[460px]">
          <div
            className="grid border-b text-[10px] text-muted-foreground"
            style={{ gridTemplateColumns: `6.5rem repeat(${weeks}, minmax(0,1fr))` }}
          >
            <span className="px-2 py-1.5 font-semibold uppercase tracking-wider">Phase</span>
            {Array.from({ length: weeks }).map((_, i) => (
              <span key={i} className="border-l px-1 py-1.5 text-center">
                W{i + 1}
              </span>
            ))}
          </div>
          {GANTT.map((row) => (
            <div
              key={row.name}
              className="grid items-center border-b last:border-0"
              style={{ gridTemplateColumns: `6.5rem repeat(${weeks}, minmax(0,1fr))` }}
            >
              <span className="truncate px-2 py-2 text-xs">{row.name}</span>
              <div
                className="relative col-span-full col-start-2 h-8"
                style={{ gridColumn: `2 / span ${weeks}` }}
              >
                <div
                  className={cn(
                    "absolute top-1/2 h-4 -translate-y-1/2 rounded-md opacity-90 shadow-sm",
                    row.color,
                  )}
                  style={{
                    left: `${(row.start / weeks) * 100}%`,
                    width: `${(row.span / weeks) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["To Do", 12, "bg-zinc-400"],
          ["In Progress", 9, "bg-blue-500"],
          ["In Review", 4, "bg-amber-500"],
          ["Done", 17, "bg-emerald-500"],
        ].map(([label, count, dot]) => (
          <div key={label as string} className="rounded-md border px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", dot as string)} />
              {label}
            </p>
            <p className="text-sm font-semibold tabular-nums">{count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
