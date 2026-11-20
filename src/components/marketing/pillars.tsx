import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { SUITE_APPS } from "@/components/marketing/apps";
import { SectionHeading } from "@/components/marketing/section-heading";
import { cn } from "@/lib/utils";

export function Pillars() {
  return (
    <section id="features" className="scroll-mt-20 border-t py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Three connected apps"
          title="Everything from first call to final invoice"
          description="Each app is powerful on its own. Together, they share one data model — so nothing gets re-typed, lost, or out of sync."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {SUITE_APPS.map((app) => {
            const Icon = app.icon;
            return (
              <article
                key={app.id}
                id={app.id}
                className="group relative flex scroll-mt-24 flex-col rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lg dark:bg-white/[0.02]"
              >
                <span className={cn("flex size-11 items-center justify-center rounded-xl ring-1", app.accent)}>
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{app.name}</h3>
                <p className="mt-1 text-sm font-medium text-foreground/80">{app.tagline}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{app.description}</p>
                <ul className="mt-6 space-y-2.5">
                  {app.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className={cn("mt-0.5 size-4 shrink-0", app.iconColor)} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={app.docsHref}
                  className="mt-auto inline-flex items-center gap-1.5 pt-8 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
                >
                  Read the {app.name} guide
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
