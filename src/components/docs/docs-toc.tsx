"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

/** "On this page" table of contents with scroll-spy highlighting. */
export function DocsToc({ items }: { items: Array<{ id: string; title: string }> }) {
  const [activeId, setActiveId] = React.useState<string | null>(items[0]?.id ?? null);

  React.useEffect(() => {
    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        const firstVisible = items.find((item) => visible.get(item.id));
        if (firstVisible) setActiveId(firstVisible.id);
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));

    // At the very bottom, highlight the last section.
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        setActiveId(items[items.length - 1]!.id);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">On this page</p>
      <ul className="space-y-1 border-l">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={() => setActiveId(item.id)}
                className={cn(
                  "-ml-px block border-l-2 py-1 pl-3 text-sm transition-colors",
                  active
                    ? "border-indigo-500 font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {item.title}
              </a>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="inline-flex items-center gap-1.5 pt-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowUp className="size-3" />
        Back to top
      </button>
    </div>
  );
}
