"use client";

import * as React from "react";
import {
  Building2,
  FileText,
  FolderKanban,
  Handshake,
  Loader2,
  Receipt,
  Search,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { getModuleHref, SUITE_MODULES } from "@/config/modules";
import type { GlobalSearchGroupDTO, GlobalSearchItemDTO } from "@/modules/search/search.service";

interface GlobalSearchCommandProps {
  orgSlug: string;
}

function renderEntityIcon(entityType: GlobalSearchItemDTO["entityType"]) {
  switch (entityType) {
    case "deal":
      return <Handshake className="size-4 text-blue-600" />;
    case "contact":
      return <UserRound className="size-4 text-sky-600" />;
    case "company":
      return <Building2 className="size-4 text-indigo-600" />;
    case "invoice":
      return <Receipt className="size-4 text-emerald-600" />;
    case "quote":
      return <FileText className="size-4 text-teal-600" />;
    case "project":
      return <FolderKanban className="size-4 text-violet-600" />;
    case "task":
      return <FileText className="size-4 text-sky-600" />;
  }
}

export function GlobalSearchCommand({ orgSlug }: GlobalSearchCommandProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [groups, setGroups] = React.useState<GlobalSearchGroupDTO[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/orgs/${encodeURIComponent(orgSlug)}/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const data = (await res.json()) as { groups?: GlobalSearchGroupDTO[] };
          setGroups(data.groups ?? []);
        }
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setGroups([]);
        }
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query, orgSlug]);

  const navigateTo = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full max-w-[210px] items-center justify-between gap-2 rounded-lg border bg-muted/40 px-2.5 text-xs text-muted-foreground transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:max-w-[270px] xl:max-w-xs"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Search className="size-3.5 shrink-0" />
          <span className="truncate">Search deals, projects, invoices...</span>
        </span>
        <kbd className="hidden shrink-0 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Global Suite Search"
        description="Search records across CRM, Finance, and Projects."
      >
        <CommandInput
          placeholder="Type a deal, contact, company, invoice #, or project..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Searching across CRM, Finance &amp; Projects...</span>
            </div>
          )}

          {!loading && query.trim().length > 0 && groups.length === 0 && (
            <CommandEmpty>No matching records in this organization.</CommandEmpty>
          )}

          {!loading &&
            groups.map((group) => (
              <CommandGroup key={group.module} heading={group.label}>
                {group.items.map((item) => (
                  <CommandItem
                    key={`${item.entityType}-${item.id}`}
                    value={`${group.label} ${item.title} ${item.subtitle}`}
                    onSelect={() => navigateTo(item.href)}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {renderEntityIcon(item.entityType)}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                      </div>
                    </div>
                    {item.badge && (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {item.badge}
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

          {groups.length > 0 && <CommandSeparator />}

          <CommandGroup heading="Jump to App">
            {SUITE_MODULES.map((mod) => (
              <CommandItem
                key={mod.id}
                value={`open ${mod.name} ${mod.description}`}
                onSelect={() => navigateTo(getModuleHref(orgSlug, mod.defaultPath))}
                className="flex items-center justify-between"
              >
                <span className="font-medium">{mod.name}</span>
                <span className="text-xs text-muted-foreground">{mod.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
