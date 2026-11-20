"use client";

import * as React from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOC_GROUPS, docHref, getDocArticle } from "@/components/docs/docs-data";
import { cn } from "@/lib/utils";

export function DocsNavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  return (
    <nav aria-label="Documentation" className="space-y-5">
      {DOC_GROUPS.map((group) => {
        const isCollapsed = collapsed[group.title] ?? false;
        return (
          <div key={group.title}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [group.title]: !isCollapsed }))}
              aria-expanded={!isCollapsed}
              className="flex w-full items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              {group.title}
              <ChevronDown className={cn("size-3.5 transition-transform", isCollapsed && "-rotate-90")} />
            </button>
            {!isCollapsed && (
              <ul className="mt-1 space-y-0.5 border-l pl-2 ml-2">
                {group.slugs.map((slug) => {
                  const article = getDocArticle(slug);
                  if (!article) return null;
                  const href = docHref(slug);
                  const active = pathname === href;
                  return (
                    <li key={slug}>
                      <Link
                        href={href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative block rounded-md px-2.5 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-indigo-500/10 font-medium text-indigo-700 dark:text-indigo-300"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {active && (
                          <span className="absolute top-1.5 bottom-1.5 -left-[9px] w-0.5 rounded-full bg-indigo-500" />
                        )}
                        {article.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Desktop sidebar with a collapse toggle that remembers its state. */
export function DocsSidebar() {
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    try {
      setHidden(window.localStorage.getItem("tq_docs_sidebar") === "hidden");
    } catch {
      // ignore
    }
  }, []);

  const toggle = () => {
    setHidden((h) => {
      try {
        window.localStorage.setItem("tq_docs_sidebar", h ? "shown" : "hidden");
      } catch {
        // ignore
      }
      return !h;
    });
  };

  return (
    <aside
      className={cn(
        "sticky top-28 hidden h-[calc(100vh-7rem)] shrink-0 border-r transition-[width] duration-200 lg:block",
        hidden ? "w-12" : "w-64",
      )}
    >
      <div className="flex h-full flex-col">
        <div className={cn("flex items-center pt-4", hidden ? "justify-center" : "justify-end px-3")}>
          <button
            type="button"
            onClick={toggle}
            aria-label={hidden ? "Expand navigation" : "Collapse navigation"}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {hidden ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
        </div>
        {!hidden && (
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-8">
            <DocsNavList />
          </div>
        )}
      </div>
    </aside>
  );
}
