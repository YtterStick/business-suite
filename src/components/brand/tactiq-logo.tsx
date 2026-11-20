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

/** Compact inline moving Tactiq spinner for buttons. */
export function TactiqSpinner({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return <TactiqMark loop className={cn("size-4", className, markClassName)} title="Loading" />;
}

/** Minimal transparent moving Tactiq logo centered cleanly with no background box or text. */
export function TactiqLoader({
  label = "Loading Tactiq...",
  sublabel: _sublabel,
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
  void _sublabel;
  const mark = (
    <div role="status" aria-live="polite" className="flex items-center justify-center">
      <TactiqMark
        loop
        className={cn(compact ? "size-12" : "size-16 sm:size-20")}
        title={label}
      />
      <span className="sr-only">{label}</span>
    </div>
  );

  if (overlay) {
    return (
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-background/75 backdrop-blur-sm animate-in fade-in-0 duration-200",
          className,
        )}
      >
        {mark}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center",
        fullScreen ? "min-h-dvh w-full bg-background" : "min-h-[65vh] w-full",
        className,
      )}
    >
      {mark}
    </div>
  );
}
