import { ArrowRight, BookOpen, Check } from "lucide-react";
import Link from "next/link";

import { HeroPreviewTabs } from "@/components/marketing/hero-preview-tabs";
import { Button } from "@/components/ui/button";
import type { MarketingViewer } from "@/server/marketing";

export function Hero({
  viewer,
  primaryHref,
  primaryLabel,
}: {
  viewer: MarketingViewer | null;
  primaryHref: string;
  primaryLabel: string;
}) {
  return (
    <section className="relative overflow-hidden">
      {/* Background grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,#000_60%,transparent_100%)] opacity-60"
      />

      <div className="mx-auto max-w-7xl px-4 pt-10 pb-14 sm:px-6 sm:pt-20 sm:pb-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Link
            href="/docs"
            className="tq-rise inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
          >
            <span className="flex gap-1">
              <span className="size-1.5 rounded-full bg-sky-500" />
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span className="size-1.5 rounded-full bg-violet-500" />
            </span>
            CRM · Finance · Projects — in one workspace
            <ArrowRight className="size-3" />
          </Link>

          <h1 className="tq-rise mt-5 text-3xl font-semibold tracking-tight text-balance sm:mt-6 sm:text-5xl lg:text-6xl">
            Run your entire business on{" "}
            <span className="bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400 bg-clip-text text-transparent">
              one unified operating system.
            </span>
          </h1>

          <p className="tq-rise mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground sm:mt-6 sm:text-lg">
            Tactiq brings your customer relationships, invoicing, and project delivery into a single
            connected workspace—eliminating app-switching and data silos.
          </p>

          <div className="tq-rise mt-7 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/docs">
                <BookOpen className="size-4" />
                Explore Documentation
              </Link>
            </Button>
          </div>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {[
              "Unified CRM, Finance & Projects",
              "Role-based workspaces & approvals",
              "Unlimited workspaces per account",
            ].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="size-3.5 shrink-0 text-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div id="workspace-preview" className="mx-auto mt-10 max-w-5xl scroll-mt-24 sm:mt-14">
          <HeroPreviewTabs viewer={viewer} />
        </div>
      </div>
    </section>
  );
}
