"use client";

import * as React from "react";
import { ArrowRight, ArrowUp, BookOpen, Check, ExternalLink } from "lucide-react";
import Link from "next/link";

import {
  getSuiteApp,
  isSuiteAppId,
  SUITE_APPS,
  type SuiteAppId,
} from "@/components/marketing/apps";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MarketingViewer } from "@/server/marketing";

export function Pillars({ viewer }: { viewer: MarketingViewer | null }) {
  const [selectedApp, setSelectedApp] = React.useState<SuiteAppId>("projects");

  React.useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (isSuiteAppId(hash)) {
        setSelectedApp(hash);
      }
    };
    const handleEvent = (event: Event) => {
      const id = (event as CustomEvent<SuiteAppId>).detail;
      if (isSuiteAppId(id)) {
        setSelectedApp(id);
      }
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("tq-select-app", handleEvent);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("tq-select-app", handleEvent);
    };
  }, []);

  const chooseApp = (appId: SuiteAppId) => {
    setSelectedApp(appId);
    window.history.replaceState(null, "", `/#${appId}`);
    window.dispatchEvent(new CustomEvent("tq-select-app", { detail: appId }));
  };

  const previewInShowcase = () => {
    window.dispatchEvent(new CustomEvent("tq-select-app", { detail: selectedApp }));
    document.getElementById("workspace-preview")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const active = getSuiteApp(selectedApp);
  const ActiveIcon = active.icon;
  const openHref = viewer?.workspaceSlug
    ? `/${viewer.workspaceSlug}${active.defaultAppPath}`
    : "/signup";

  return (
    <section id="features" className="scroll-mt-20 border-t py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Three connected apps"
          title="Everything from first call to final invoice"
          description="Select any app below to explore its modules. Together they share one data model — so nothing gets re-typed, lost, or out of sync."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {SUITE_APPS.map((app) => {
            const Icon = app.icon;
            const isSelected = app.id === selectedApp;
            return (
              <article
                key={app.id}
                id={app.id}
                className={cn(
                  "group relative flex scroll-mt-24 flex-col rounded-2xl border bg-card p-6 transition-all dark:bg-white/[0.02]",
                  isSelected
                    ? app.ringColor
                    : "hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lg",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl ring-1",
                      app.accent,
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  {isSelected && (
                    <Badge variant="secondary" className="text-[11px] font-medium">
                      Selected App
                    </Badge>
                  )}
                </div>

                <h3 className="mt-5 text-xl font-semibold tracking-tight">{app.name}</h3>
                <p className="mt-1 text-sm font-medium text-foreground/80">{app.tagline}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {app.description}
                </p>

                <ul className="mt-6 space-y-2.5">
                  {app.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <Check className={cn("mt-0.5 size-4 shrink-0", app.iconColor)} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-8">
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => chooseApp(app.id)}
                  >
                    {isSelected ? `Exploring ${app.name}` : `Explore ${app.name}`}
                  </Button>
                  <Link
                    href={app.docsHref}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
                  >
                    Docs
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {/* Selected App Deep Dive */}
        <div
          id="app-spotlight"
          className="mt-8 scroll-mt-24 overflow-hidden rounded-2xl border bg-card p-6 sm:p-8 dark:bg-white/[0.02]"
        >
          <div className="flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-xl ring-1",
                  active.accent,
                )}
              >
                <ActiveIcon className="size-6" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold tracking-tight">{active.name} Modules</h3>
                  <Badge variant="outline" className="text-[11px]">
                    {active.tagline}
                  </Badge>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{active.description}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button asChild size="sm">
                <Link href={openHref}>
                  {viewer?.workspaceSlug ? `Open ${active.name}` : `Get Started with ${active.name}`}
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={active.docsHref}>
                  <BookOpen className="size-3.5" />
                  Read {active.name} Guide
                </Link>
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={previewInShowcase}>
                Preview UI
                <ArrowUp className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {active.modules.map((mod) =>
              viewer?.workspaceSlug ? (
                <Link
                  key={mod.name}
                  href={`/${viewer.workspaceSlug}${mod.path}`}
                  className="group flex items-start justify-between gap-3 rounded-xl border bg-background/60 p-4 transition-colors hover:border-foreground/20 hover:bg-accent/40"
                >
                  <div>
                    <p className="text-sm font-semibold group-hover:text-primary">{mod.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{mod.description}</p>
                  </div>
                  <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
                </Link>
              ) : (
                <div
                  key={mod.name}
                  className="rounded-xl border bg-background/60 p-4"
                >
                  <p className="text-sm font-semibold">{mod.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{mod.description}</p>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
