"use client";

import * as React from "react";
import { FileText, Hash, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DOC_GROUPS, docHref, getDocArticle } from "@/components/docs/docs-data";
import { DocsNavList } from "@/components/docs/docs-sidebar";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Sticky docs sub-header: mobile nav trigger, breadcrumb, and search. */
export function DocsTopBar() {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [sidebarHidden, setSidebarHidden] = React.useState(false);

  React.useEffect(() => {
    try {
      setSidebarHidden(window.localStorage.getItem("tq_docs_sidebar") === "hidden");
    } catch {
      // ignore
    }
    const handleSync = (event: Event) => {
      const nextHidden = (event as CustomEvent<{ hidden: boolean }>).detail?.hidden;
      if (typeof nextHidden === "boolean") {
        setSidebarHidden(nextHidden);
      }
    };
    window.addEventListener("tq-docs-sidebar-toggle", handleSync);
    return () => window.removeEventListener("tq-docs-sidebar-toggle", handleSync);
  }, []);

  const toggleDesktopSidebar = () => {
    const next = !sidebarHidden;
    setSidebarHidden(next);
    try {
      window.localStorage.setItem("tq_docs_sidebar", next ? "hidden" : "shown");
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent("tq-docs-sidebar-toggle", { detail: { hidden: next } }));
  };

  return (
    <div className="sticky top-16 z-40 h-12 border-b bg-background/85 backdrop-blur-xl dark:bg-[#0D0E12]/85">
      <div className="mx-auto flex h-full max-w-[90rem] items-center gap-2.5 px-4 sm:px-6 lg:px-8">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
              aria-label="Open documentation navigation"
            >
              <Menu className="size-4" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto p-4">
            <SheetTitle className="mb-4 text-sm font-semibold">Documentation</SheetTitle>
            <DocsNavList onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <button
          type="button"
          onClick={toggleDesktopSidebar}
          aria-label={sidebarHidden ? "Show documentation sidebar" : "Hide documentation sidebar"}
          title={sidebarHidden ? "Show navigation" : "Hide navigation"}
          className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex"
        >
          {sidebarHidden ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
        <Link href="/docs" className="text-sm font-semibold">
          Docs
        </Link>
        <span className="hidden text-xs text-muted-foreground sm:inline">Tactiq Help Center</span>
        <div className="ml-auto w-full max-w-xs">
          <DocsSearch />
        </div>
      </div>
    </div>
  );
}

export function DocsSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((o) => !o);
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full items-center gap-2 rounded-md border bg-muted/40 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search docs…</span>
        <kbd className="hidden rounded border bg-background px-1.5 font-mono text-[10px] sm:inline">⌘K</kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search documentation"
        description="Find guides and sections across the Tactiq documentation."
      >
        <CommandInput placeholder="Search guides, e.g. timesheets, invoices, roles…" />
        <CommandList>
          <CommandEmpty>No matching articles.</CommandEmpty>
          {DOC_GROUPS.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.slugs.map((slug) => {
                const article = getDocArticle(slug);
                if (!article) return null;
                return (
                  <React.Fragment key={slug}>
                    <CommandItem
                      value={`${article.title} ${article.description}`}
                      onSelect={() => go(docHref(slug))}
                    >
                      <FileText className="text-muted-foreground" />
                      <span className="font-medium">{article.title}</span>
                    </CommandItem>
                    {article.sections.map((section) => (
                      <CommandItem
                        key={section.id}
                        value={`${article.title} ${section.title}`}
                        onSelect={() => go(docHref(slug, section.id))}
                        className="pl-8"
                      >
                        <Hash className="text-muted-foreground" />
                        <span>{section.title}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">{article.title}</span>
                      </CommandItem>
                    ))}
                  </React.Fragment>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
