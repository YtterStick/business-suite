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
    <section id="workflow" className="scroll-mt-20 border-t bg-muted/30 py-20 sm:py-28 dark:bg-white/[0.015]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it connects"
          title="One deal. Zero hand-off spreadsheets."
          description="Watch a single client engagement flow across all three apps without anyone re-entering data."
        />

        <ol
          className="relative mt-14 grid gap-4 md:grid-cols-4"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Connector line */}
          <div aria-hidden className="absolute top-7 right-[12.5%] left-[12.5%] hidden h-px bg-border md:block">
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
                  onClick={() => setActive(i)}
                  onFocus={() => setPaused(true)}
                  className="group flex w-full flex-col items-center text-center outline-none"
                >
                  <span
                    className={cn(
                      "relative z-10 flex size-14 items-center justify-center rounded-2xl bg-background ring-1 transition-all duration-500",
                      isActive || isDone ? step.tone : "text-muted-foreground ring-border",
                      isActive && "scale-110 shadow-lg",
                    )}
                  >
                    <Icon className="size-6" />
                  </span>
                  <span className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Step {i + 1} · {step.app}
                  </span>
                  <span className="mt-1.5 text-base font-semibold">{step.title}</span>
                  <span className="mt-1.5 max-w-60 text-sm text-muted-foreground">{step.text}</span>
                  <span
                    className={cn(
                      "mt-3 rounded-full border px-3 py-1 text-[11px] transition-all duration-500",
                      isActive ? "border-foreground/15 bg-background opacity-100" : "opacity-0 md:opacity-0",
                    )}
                  >
                    {step.detail}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
