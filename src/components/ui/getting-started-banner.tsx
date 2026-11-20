"use client";

import * as React from "react";
import { CheckCircle2, Circle, Loader2, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface GettingStartedProgress {
  hasClientOrDeal: boolean;
  hasWonDeal: boolean;
  hasTaskOrInvoice: boolean;
}

/**
 * Dismissible 3-step Getting Started checklist + 1-click Sample Data toggle.
 */
export function GettingStartedBanner({
  orgSlug,
  progress,
  hasSampleData,
  canManage = true,
  isBusy = false,
  onSeedSample,
  onClearSample,
  onVisibilityChange,
  forceShow = false,
}: {
  orgSlug: string;
  progress: GettingStartedProgress;
  hasSampleData: boolean;
  canManage?: boolean;
  isBusy?: boolean;
  onSeedSample?: () => void;
  onClearSample?: () => void;
  onVisibilityChange?: (visible: boolean) => void;
  forceShow?: boolean;
}) {
  const [dismissed, setDismissed] = React.useState(false);

  React.useEffect(() => {
    try {
      setDismissed(
        window.localStorage.getItem(`bs_getting_started_dismissed_${orgSlug}`) === "1",
      );
    } catch {
      // Ignore storage read errors
    }
  }, [orgSlug]);

  const dismiss = () => {
    setDismissed(true);
    onVisibilityChange?.(false);
    try {
      window.localStorage.setItem(`bs_getting_started_dismissed_${orgSlug}`, "1");
    } catch {
      // Ignore
    }
  };

  const steps = [
    {
      title: "1. Create your first Client & Deal in CRM",
      description: "Track opportunities and weighted revenue in your pipeline.",
      href: `/${orgSlug}/crm/deals?new=1`,
      done: progress.hasClientOrDeal,
    },
    {
      title: "2. Drag the Deal to Closed Won",
      description: "Auto-provisions a linked delivery Project and Draft Invoice.",
      href: `/${orgSlug}/crm/deals`,
      done: progress.hasWonDeal,
    },
    {
      title: "3. Log a Task & Review Your Linked Invoice",
      description: "Deliver milestones, log hours, and send the client invoice.",
      href: `/${orgSlug}/finance/invoices`,
      done: progress.hasTaskOrInvoice,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const isVisible = forceShow || (!dismissed && !(completedCount === 3 && !hasSampleData));

  React.useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-gradient-to-r from-indigo-500/[0.07] via-violet-500/[0.04] to-emerald-500/[0.07] p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-semibold">
              Getting Started with Tactiq ({completedCount}/3)
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Follow these three connected steps or load sample records to explore CRM, Projects &amp; Finance together.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage &&
            (hasSampleData ? (
              onClearSample && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={onClearSample}
                  className="gap-1.5 text-xs"
                >
                  {isBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5 text-rose-500" />
                  )}
                  Clear Sample Data
                </Button>
              )
            ) : (
              onSeedSample && (
                <Button
                  type="button"
                  size="sm"
                  disabled={isBusy}
                  onClick={onSeedSample}
                  className="gap-1.5 text-xs"
                >
                  {isBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  Load Sample Workspace
                </Button>
              )
            ))}

          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Dismiss getting started checklist"
            onClick={dismiss}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-2.5 md:grid-cols-3">
        {steps.map((step) => (
          <Link
            key={step.title}
            href={step.href}
            className={cn(
              "group flex items-start gap-2.5 rounded-lg border bg-background/80 p-3 transition-colors hover:border-primary/40 hover:bg-background",
              step.done && "border-emerald-500/30 bg-emerald-500/[0.04]",
            )}
          >
            {step.done ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
            )}
            <div className="min-w-0">
              <p
                className={cn(
                  "text-xs font-semibold",
                  step.done && "text-muted-foreground line-through",
                )}
              >
                {step.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {step.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
