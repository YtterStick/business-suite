import { Check } from "lucide-react";
import Link from "next/link";

import { SectionHeading } from "@/components/marketing/section-heading";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    period: "during early access",
    description: "Everything you need to run sales, billing, and delivery in one place.",
    cta: "Get Started for Free",
    href: "/signup",
    highlighted: true,
    features: [
      "CRM, Finance & Projects apps",
      "Unlimited workspaces per account",
      "Invite your team & clients",
      "Role-based access & approvals",
      "Global ⌘K search",
      "Deal-to-project automations",
    ],
  },
  {
    name: "Business",
    price: "Custom",
    period: "for larger teams",
    description: "For organizations that need onboarding help, custom workflows, and priority support.",
    cta: "Talk to us",
    href: "/signup",
    highlighted: false,
    features: [
      "Everything in Starter",
      "Guided workspace onboarding",
      "Custom blueprints & automations",
      "Priority support",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 border-t bg-muted/30 py-20 sm:py-28 dark:bg-white/[0.015]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Pricing"
          title="Start free. Grow when you're ready."
          description="No credit card, no per-app pricing. Every workspace gets all three apps."
        />
        <div className="mx-auto mt-14 grid max-w-4xl gap-5 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-card p-7 dark:bg-white/[0.02]",
                plan.highlighted && "border-indigo-500/40 shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/30",
              )}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-7 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-0.5 text-[11px] font-semibold text-white">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.period}</span>
              </p>
              <ul className="mt-6 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-8" variant={plan.highlighted ? "default" : "outline"}>
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
