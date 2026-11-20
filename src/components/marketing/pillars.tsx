"use client";

import * as React from "react";
import { ArrowRight, BookOpen, Check, Eye } from "lucide-react";
import Link from "next/link";

import {
  getSuiteApp,
  isSuiteAppId,
  SUITE_APPS,
  type SuiteAppId,
} from "@/components/marketing/apps";
import { HeroPreviewTabs } from "@/components/marketing/hero-preview-tabs";
import { SectionHeading } from "@/components/marketing/section-heading";
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

export function Pillars({ viewer }: { viewer: MarketingViewer | null }) {
  const [selectedApp, setSelectedApp] = React.useState<SuiteAppId>("projects");
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewModuleName, setPreviewModuleName] = React.useState<string | null>(null);

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

  const chooseApp = (appId: SuiteAppId, scrollToSpotlight = false) => {
    setSelectedApp(appId);
    window.history.replaceState(null, "", `/#${appId}`);
    window.dispatchEvent(new CustomEvent("tq-select-app", { detail: appId }));
    if (scrollToSpotlight) {
      document.getElementById("app-spotlight")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const openInlinePreview = (moduleTitle: string | null = null) => {
    setPreviewModuleName(moduleTitle);
    setPreviewOpen(true);
  };

  const active = getSuiteApp(selectedApp);
  const ActiveIcon = active.icon;
  const openHref = viewer?.workspaceSlug
    ? `/${viewer.workspaceSlug}${active.defaultAppPath}`
    : "/signup";

  return (
    <section id="features" className="scroll-mt-20 border-t py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Three connected apps"
          title="Everything from first call to final invoice"
          description="Select any app below to explore its modules. Together they share one data model — so nothing gets re-typed, lost, or out of sync."
        />

        {/* Quick mobile switcher pill bar */}
        <div
          className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-1.5 rounded-xl border bg-muted/40 p-1 lg:hidden"
          role="tablist"
          aria-label="Quick switch application overview"
        >
          {SUITE_APPS.map((app) => {
            const Icon = app.icon;
            const isSelected = app.id === selectedApp;
            return (
              <button
                key={app.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => chooseApp(app.id, true)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all",
                  isSelected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-3.5", isSelected && app.iconColor)} />
                {app.name}
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid gap-5 lg:mt-14 lg:grid-cols-3">
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
          className="mt-8 scroll-mt-24 overflow-hidden rounded-2xl border bg-card p-5 sm:p-8 dark:bg-white/[0.02]"
        >
          <div className="flex flex-col gap-5 border-b pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3.5 sm:gap-4">
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 sm:size-12",
                  active.accent,
                )}
              >
                <ActiveIcon className="size-5 sm:size-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight sm:text-xl">
                    {active.name} Modules
                  </h3>
                  <Badge variant="outline" className="text-[11px]">
                    {active.tagline}
                  </Badge>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{active.description}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => openInlinePreview(null)}
              >
                <Eye className="size-3.5" />
                Preview UI
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={active.docsHref}>
                  <BookOpen className="size-3.5" />
                  Read {active.name} Guide
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href={openHref}>
                  {viewer?.workspaceSlug ? `Open ${active.name}` : "Get Started Free"}
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3.5 sm:grid-cols-2 sm:gap-4">
            {active.modules.map((mod) => (
              <button
                key={mod.name}
                type="button"
                onClick={() => openInlinePreview(mod.name)}
                className="group flex items-start justify-between gap-3 rounded-xl border bg-background/60 p-4 text-left transition-colors hover:border-foreground/20 hover:bg-accent/40"
              >
                <div>
                  <p className="text-sm font-semibold group-hover:text-primary">{mod.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{mod.description}</p>
                </div>
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                  <Eye className="size-3" />
                  Preview
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inline Interactive UI Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ActiveIcon className={cn("size-4", active.iconColor)} />
              {previewModuleName ? `${active.name} — ${previewModuleName}` : `${active.name} Workspace Preview`}
            </DialogTitle>
            <DialogDescription>
              Interactive preview of Tactiq {active.name}. Switch tabs below to inspect CRM, Finance, and Projects together.
            </DialogDescription>
          </DialogHeader>
          <HeroPreviewTabs viewer={viewer} initialTab={selectedApp} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
