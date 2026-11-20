"use client";

import * as React from "react";
import { CalendarClock, FileCheck2, FolderPlus, Trophy, type LucideIcon } from "lucide-react";

import { SectionHeading } from "@/components/marketing/section-heading";
import { cn } from "@/lib/utils";

interface FlowStep {
  app: "CRM" | "Projects" | "Finance";
  title: string;
  text: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
}

const STEPS: FlowStep[] = [
  {
    app: "CRM",
    title: "Close a deal",
    text: "Drag the deal to Closed Won in your pipeline.",
    detail: "Deal value, client, and owner are captured once.",
    icon: Trophy,
    tone: "text-sky-500 bg-sky-500/10 ring-sky-500/25",
  },
  {
    app: "Projects",
    title: "Project & budget auto-created",
    text: "A delivery project is generated with the deal value as its budget.",
    detail: "Idempotent automation — never a duplicate.",
    icon: FolderPlus,
    tone: "text-violet-500 bg-violet-500/10 ring-violet-500/25",
  },
  {
    app: "Projects",
    title: "Track timesheets & milestones",
    text: "The team works tasks, hits milestones, and logs approved hours.",
    detail: "Budget burn updates as time is approved.",
    icon: CalendarClock,
    tone: "text-indigo-500 bg-indigo-500/10 ring-indigo-500/25",
  },
  {
    app: "Finance",
    title: "Send the final invoice",
    text: "The linked invoice is reviewed, sent, and marked paid.",
    detail: "Back-linked to the project and original deal.",
    icon: FileCheck2,
    tone: "text-emerald-500 bg-emerald-500/10 ring-emerald-500/25",
  },
];

export function Workflow() {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % STEPS.length), 2600);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <section
      id="workflow"
      className="scroll-mt-20 border-t bg-muted/30 py-16 sm:py-24 dark:bg-white/[0.015]"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it connects"
          title="One deal. Zero hand-off spreadsheets."
          description="Watch a single client engagement flow across all three apps without anyone re-entering data."
        />

        <ol
          className="relative mt-10 flex flex-col gap-3 md:mt-14 md:grid md:grid-cols-4 md:gap-4"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Desktop horizontal connector line */}
          <div
            aria-hidden
            className="absolute top-7 right-[12.5%] left-[12.5%] hidden h-px bg-border md:block"
          >
            <div
              className="h-full bg-gradient-to-r from-sky-500 via-violet-500 to-emerald-500 transition-all duration-700"
              style={{ width: `${(active / (STEPS.length - 1)) * 100}%` }}
            />
          </div>

          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === active;
            const isDone = i < active;
            return (
              <li key={step.title}>
                <button
                  type="button"
                  onClick={() => {
                    setPaused(true);
                    setActive(i);
                  }}
                  onFocus={() => setPaused(true)}
                  className={cn(
                    "group flex w-full items-start gap-3.5 rounded-xl border bg-card p-4 text-left transition-all outline-none md:flex-col md:items-center md:border-0 md:bg-transparent md:p-0 md:text-center",
                    isActive && "border-foreground/20 shadow-sm md:shadow-none",
                  )}
                >
                  <span
                    className={cn(
                      "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-xl bg-background ring-1 transition-all duration-500 md:size-14 md:rounded-2xl",
                      isActive || isDone ? step.tone : "text-muted-foreground ring-border",
                      isActive && "md:scale-110 md:shadow-lg",
                    )}
                  >
                    <Icon className="size-5 md:size-6" />
                  </span>
                  <div className="min-w-0 flex-1 md:flex md:flex-col md:items-center">
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground md:mt-4">
                      Step {i + 1} · {step.app}
                    </span>
                    <span className="mt-1 block text-base font-semibold">{step.title}</span>
                    <span className="mt-1 block text-sm text-muted-foreground md:max-w-60">
                      {step.text}
                    </span>
                    <span
                      className={cn(
                        "mt-2.5 inline-block rounded-full border px-3 py-1 text-[11px] transition-all duration-500",
                        isActive
                          ? "border-foreground/15 bg-background opacity-100"
                          : "border-border/70 bg-muted/40 text-muted-foreground opacity-90 md:opacity-0",
                      )}
                    >
                      {step.detail}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
