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
  title = "Tactiq",
}: {
  className?: string;
  animated?: boolean;
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
      className={cn("size-8 shrink-0", animated && "tq-animated", className)}
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
  showWordmark = true,
}: {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  animated?: boolean;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <TactiqMark animated={animated} className={markClassName} />
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
