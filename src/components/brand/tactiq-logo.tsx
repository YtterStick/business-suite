"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tactiq brand mark — a "T" whose stem resolves into a checkmark
 * (tactics → done). Pure SVG, so the background is always transparent.
 */
export function TactiqMark({
  className,
  animated = false,
  loop = false,
  title = "Tactiq",
}: {
  className?: string;
  animated?: boolean;
  loop?: boolean;
  title?: string;
}) {
  const rawId = React.useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const barId = `tq-bar-${uid}`;
  const stemId = `tq-stem-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={title}
      className={cn(
        "size-8 shrink-0",
        animated && !loop && "tq-animated",
        loop && "tq-loop",
        className,
      )}
    >
      <defs>
        <linearGradient id={barId} x1="9" y1="9" x2="55" y2="21" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id={stemId} x1="32" y1="28" x2="54" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect
        className="tq-mark-bar"
        x="9"
        y="9"
        width="46"
        height="12"
        rx="6"
        fill={`url(#${barId})`}
      />
      <path
        className="tq-mark-stem"
        d="M32 28V42L39.5 49.5L54 33"
        pathLength={100}
        stroke={`url(#${stemId})`}
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TactiqLogo({
  className,
  markClassName,
  wordmarkClassName,
  animated = false,
  loop = false,
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  animated?: boolean;
  loop?: boolean;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <TactiqMark animated={animated} loop={loop} className={markClassName} />
      {showWordmark && (
        <span
          className={cn(
            "text-xl font-semibold tracking-tight",
            animated && "tq-wordmark-in",
            wordmarkClassName,
          )}
        >
          Tact
          <span className="bg-gradient-to-r from-indigo-500 to-cyan-400 bg-clip-text text-transparent">
            iq
          </span>
        </span>
      )}
    </span>
  );
}

/** Compact inline orbital Tactiq spinner for buttons and headers. */
export function TactiqSpinner({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("relative inline-flex size-4 shrink-0 items-center justify-center", className)}>
      <span
        aria-hidden="true"
        className="tq-orbit absolute inset-0 rounded-full border-2 border-indigo-500/25 border-t-indigo-500 border-r-cyan-400"
      />
      <TactiqMark loop className={cn("size-2.5", markClassName)} title="Loading" />
    </span>
  );
}

/** Branded Tactiq loading state for sign-in transitions, route loading, and workspace setup. */
export function TactiqLoader({
  label = "Loading Tactiq...",
  sublabel,
  overlay = false,
  fullScreen = false,
  compact = false,
  className,
}: {
  label?: string;
  sublabel?: string;
  overlay?: boolean;
  fullScreen?: boolean;
  compact?: boolean;
  className?: string;
}) {
  if (compact) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center justify-between gap-3 rounded-xl border border-indigo-500/20 bg-card/80 px-3.5 py-2.5 shadow-2xs dark:bg-zinc-900/75",
          className,
        )}
      >
        <div className="flex items-center gap-2.5">
          <TactiqSpinner className="size-5" markClassName="size-3" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold tracking-tight">{label}</p>
            {sublabel && <p className="truncate text-[11px] text-muted-foreground">{sublabel}</p>}
          </div>
        </div>
        <div className="relative h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-indigo-500/15">
          <div className="tq-progress-bar h-full w-10 rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" />
        </div>
      </div>
    );
  }

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        overlay &&
          "w-full max-w-sm rounded-2xl border border-border/80 bg-card/95 px-8 py-8 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950/95",
      )}
    >
      <div className="relative flex size-24 items-center justify-center">
        <div
          aria-hidden="true"
          className="tq-aura absolute inset-0 rounded-full bg-gradient-to-tr from-violet-500/35 via-indigo-500/25 to-cyan-400/35 blur-xl"
        />
        <div
          aria-hidden="true"
          className="tq-orbit absolute inset-1.5 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg_210deg,#8b5cf6_260deg,#6366f1_315deg,#22d3ee_360deg)] p-[2.5px]"
          style={{
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
        <div className="relative flex size-16 items-center justify-center rounded-2xl border border-border/70 bg-card shadow-md dark:border-zinc-800 dark:bg-zinc-900">
          <TactiqMark loop className="size-11" />
        </div>
      </div>

      <div className="mt-5">
        <TactiqLogo animated markClassName="hidden" wordmarkClassName="text-xl" />
      </div>

      <p className="mt-2 text-sm font-medium tracking-tight text-foreground">{label}</p>
      {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}

      <div className="mt-5 h-1.5 w-44 overflow-hidden rounded-full bg-muted dark:bg-zinc-800">
        <div className="tq-progress-bar h-full w-16 rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" />
      </div>
    </div>
  );

  if (overlay) {
    return (
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-background/75 p-4 backdrop-blur-md animate-in fade-in-0 duration-200",
          className,
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center p-6",
        fullScreen ? "min-h-dvh w-full bg-background" : "min-h-[50vh] w-full",
        className,
      )}
    >
      {content}
    </div>
  );
}
