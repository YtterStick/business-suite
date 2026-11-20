"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface TocHeading {
  id: string;
  title: string;
  level?: 2 | 3;
}

/**
 * Dynamic "On this page" table of contents. Scans headings inside
 * `[data-docs-article]` on mount & navigation (falling back to SSR `items`) and
 * tracks the active section using IntersectionObserver scroll-spy.
 */
export function DocsToc({ items }: { items: TocHeading[] }) {
  const pathname = usePathname();
  const [headings, setHeadings] = React.useState<TocHeading[]>(items);
  const [activeId, setActiveId] = React.useState<string | null>(items[0]?.id ?? null);

  React.useEffect(() => {
    const container = document.querySelector("[data-docs-article]");
    const domNodes = container
      ? Array.from(container.querySelectorAll<HTMLElement>("h2[id], h3[id]"))
      : [];

    const extracted: TocHeading[] =
      domNodes.length > 0
        ? domNodes.map((node) => ({
            id: node.id,
            title: (node.dataset.tocTitle || node.textContent || "").trim(),
            level: node.tagName === "H3" ? 3 : 2,
          }))
        : items;

    setHeadings(extracted);
    setActiveId(extracted[0]?.id ?? null);

    const targets = extracted
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (targets.length === 0) return;

    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        const firstVisible = extracted.find((item) => visible.get(item.id));
        if (firstVisible) setActiveId(firstVisible.id);
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0 },
    );
    targets.forEach((el) => observer.observe(el));

    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        setActiveId(extracted[extracted.length - 1]!.id);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [items, pathname]);

  if (headings.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <ul className="space-y-1 border-l">
        {headings.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={() => setActiveId(item.id)}
                className={cn(
                  "-ml-px block border-l-2 py-1 transition-colors",
                  item.level === 3 ? "pl-5 text-xs" : "pl-3 text-sm",
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
