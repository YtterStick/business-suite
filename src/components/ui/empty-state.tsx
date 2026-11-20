import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
}

/** Reusable, minimalist empty state across tables, boards, and tabs. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  compact?: boolean;
}) {
  const renderAction = (item: EmptyStateAction, defaultVariant: "default" | "outline") => {
    const variant = item.variant ?? defaultVariant;
    if (item.href) {
      return (
        <Button asChild size="sm" variant={variant}>
          <Link href={item.href}>
            {item.icon}
            {item.label}
          </Link>
        </Button>
      );
    }
    return (
      <Button
        type="button"
        size="sm"
        variant={variant}
        disabled={item.disabled}
        onClick={item.onClick}
      >
        {item.icon}
        {item.label}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/15 text-center dark:border-zinc-800 dark:bg-white/[0.015]",
        compact ? "px-4 py-8" : "px-6 py-12",
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-xl border bg-background text-muted-foreground shadow-2xs dark:border-zinc-800">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action && renderAction(action, "default")}
          {secondaryAction && renderAction(secondaryAction, "outline")}
        </div>
      )}
    </div>
  );
}
