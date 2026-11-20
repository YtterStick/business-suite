"use client";

import * as React from "react";
import { ChevronDown, PanelLeftClose } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOC_GROUPS, docHref, getDocArticle } from "@/components/docs/docs-data";
import { cn } from "@/lib/utils";

export function DocsNavList({
  onNavigate,
  onCollapseDesktop,
}: {
  onNavigate?: () => void;
  onCollapseDesktop?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  return (
    <nav aria-label="Documentation" className="space-y-5">
      {DOC_GROUPS.map((group, idx) => {
        const isCollapsed = collapsed[group.title] ?? false;
        return (
          <div key={group.title}>
            <div className="flex items-center justify-between gap-1 px-2 py-1">
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [group.title]: !isCollapsed }))}
                aria-expanded={!isCollapsed}
                className="flex flex-1 items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                <span>{group.title}</span>
                <ChevronDown
                  className={cn("size-3.5 transition-transform", isCollapsed && "-rotate-90")}
                />
              </button>
              {idx === 0 && onCollapseDesktop && (
                <button
                  type="button"
                  onClick={onCollapseDesktop}
                  aria-label="Collapse navigation"
                  title="Collapse navigation"
                  className="ml-1 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <PanelLeftClose className="size-3.5" />
                </button>
              )}
            </div>
            {!isCollapsed && (
              <ul className="mt-1 ml-2 space-y-0.5 border-l pl-2">
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

/** Desktop sidebar aligned directly under DocsTopBar without extra whitespace header. */
export function DocsSidebar() {
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    try {
      setHidden(window.localStorage.getItem("tq_docs_sidebar") === "hidden");
    } catch {
      // ignore
    }
    const handleSync = (event: Event) => {
      const nextHidden = (event as CustomEvent<{ hidden: boolean }>).detail?.hidden;
      if (typeof nextHidden === "boolean") {
        setHidden(nextHidden);
      }
    };
    window.addEventListener("tq-docs-sidebar-toggle", handleSync);
    return () => window.removeEventListener("tq-docs-sidebar-toggle", handleSync);
  }, []);

  const collapseSidebar = () => {
    setHidden(true);
    try {
      window.localStorage.setItem("tq_docs_sidebar", "hidden");
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent("tq-docs-sidebar-toggle", { detail: { hidden: true } }));
  };

  return (
    <aside
      className={cn(
        "sticky top-28 hidden h-[calc(100vh-7rem)] shrink-0 overflow-hidden transition-[width] duration-200 lg:block",
        hidden ? "w-0 border-r-0" : "w-64 border-r",
      )}
      aria-hidden={hidden}
    >
      {!hidden && (
        <div className="h-full overflow-y-auto px-3 py-6">
          <DocsNavList onCollapseDesktop={collapseSidebar} />
        </div>
      )}
    </aside>
  );
}
