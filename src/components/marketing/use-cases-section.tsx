import { Briefcase, Code2, Compass, Palette } from "lucide-react";

import { SectionHeading } from "@/components/marketing/section-heading";
import { cn } from "@/lib/utils";

const USE_CASES = [
  {
    title: "Digital & Creative Agencies",
    description:
      "Turn pitched proposals into client projects, track retainer hours, and bill milestones without spreadsheets.",
    icon: Palette,
    accent: "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400",
    tags: ["Proposals → Projects", "Retainers"],
  },
  {
    title: "IT & Software Consultancies",
    description:
      "Manage sprints, issue tracking, developer timesheets, and recurring maintenance invoices in one place.",
    icon: Code2,
    accent: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400",
    tags: ["Sprints & Issues", "Timesheets"],
  },
  {
    title: "Engineering & Service Firms",
    description:
      "Track multi-phase deliverables, subcontractor expenses, and progress billing with full audit trails.",
    icon: Compass,
    accent: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
    tags: ["Phases & Gantt", "Progress Billing"],
  },
  {
    title: "Growing SMEs & Freelance Teams",
    description:
      "Replace disconnected chat, task, and invoicing tools with one unified workspace.",
    icon: Briefcase,
    accent: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
    tags: ["Zero Silos", "All-in-One"],
  },
] as const;

export function UseCasesSection() {
  return (
    <section id="use-cases" className="scroll-mt-20 border-t py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Built for"
          title="Designed for teams that sell, deliver, and bill"
          description="Whether you run client retainers, software engagements, or multi-phase field work, Tactiq adapts to your delivery model."
        />

        <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="flex flex-col rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md dark:bg-white/[0.02]"
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl ring-1",
                    item.accent,
                  )}
                >
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-1.5 border-t pt-4">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
