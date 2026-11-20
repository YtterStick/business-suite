"use client";

import * as React from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Layers,
  Menu,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { TactiqLogo } from "@/components/brand/tactiq-logo";
import { SUITE_APPS, type SuiteAppId } from "@/components/marketing/apps";
import { ThemeToggle } from "@/components/marketing/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { MarketingViewer } from "@/server/marketing";

const PRODUCT_ITEMS = [
  {
    id: "features",
    label: "Features",
    description: "Explore CRM, Finance, and Projects on a single data model.",
    icon: Layers,
  },
  {
    id: "workflow",
    label: "How It Connects",
    description: "Follow an engagement from won deal to project delivery and billing.",
    icon: Workflow,
  },
  {
    id: "capabilities",
    label: "Capabilities",
    description: "Global ⌘K search, role-based access, automations, and reporting.",
    icon: ShieldCheck,
  },
] as const;

export function PublicNavbar({ viewer }: { viewer: MarketingViewer | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isDocs = pathname.startsWith("/docs");
  const linkClass = (active: boolean) =>
    cn(
      "rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:text-foreground",
      active ? "text-foreground" : "text-muted-foreground",
    );

  const scrollToSection = React.useCallback(
    (sectionId: string) => {
      setMobileOpen(false);
      if (pathname === "/") {
        window.history.replaceState(null, "", `/#${sectionId}`);
        window.setTimeout(() => {
          document
            .getElementById(sectionId)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 40);
      } else {
        router.push(`/#${sectionId}`);
      }
    },
    [pathname, router],
  );

  const selectApp = React.useCallback(
    (appId: SuiteAppId) => {
      setMobileOpen(false);
      window.dispatchEvent(new CustomEvent("tq-select-app", { detail: appId }));
      if (pathname === "/") {
        window.history.replaceState(null, "", `/#${appId}`);
        window.setTimeout(() => {
          const target =
            document.getElementById("app-spotlight") ?? document.getElementById(appId);
          target?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 40);
      } else {
        router.push(`/#${appId}`);
      }
    },
    [pathname, router],
  );

  return (
    <header
      className={cn(
        "sticky top-0 z-50 h-16 border-b bg-background/85 backdrop-blur-xl transition-shadow supports-[backdrop-filter]:bg-background/75 dark:bg-[#0D0E12]/85",
        scrolled ? "border-border shadow-sm" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Left: brand */}
        <Link href="/" aria-label="Tactiq home" className="tq-hover-animate shrink-0">
          <TactiqLogo markClassName="size-7" wordmarkClassName="text-lg" />
        </Link>

        {/* Center: clean 5-item desktop navigation */}
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(linkClass(false), "inline-flex items-center gap-1 outline-none")}
            >
              Product
              <ChevronDown className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={10}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-80 p-2"
            >
              {PRODUCT_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem
                    key={item.id}
                    onSelect={() => scrollToSection(item.id)}
                    className="cursor-pointer items-start gap-3 rounded-md p-2.5"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-indigo-500">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="block text-xs leading-snug text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(linkClass(false), "inline-flex items-center gap-1 outline-none")}
            >
              Apps
              <ChevronDown className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              sideOffset={10}
              onCloseAutoFocus={(e) => e.preventDefault()}
              className="w-80 p-2"
            >
              {SUITE_APPS.map((app) => {
                const Icon = app.icon;
                return (
                  <DropdownMenuItem
                    key={app.id}
                    onSelect={() => selectApp(app.id)}
                    className="cursor-pointer items-start gap-3 rounded-md p-2.5"
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg ring-1",
                        app.accent,
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                        {app.name}
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                      </span>
                      <span className="block text-xs leading-snug text-muted-foreground">
                        {app.description}
                      </span>
                    </span>
                  </DropdownMenuItem>
                );
              })}
              {viewer?.workspaceSlug && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Open in {viewer.workspaceName ?? "workspace"}
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {SUITE_APPS.map((app) => (
                        <DropdownMenuItem key={app.id} asChild className="justify-center p-0">
                          <Link
                            href={`/${viewer.workspaceSlug}${app.defaultAppPath}`}
                            className="flex items-center justify-center rounded-md border bg-muted/40 px-2 py-1 text-xs font-medium hover:bg-accent"
                          >
                            {app.name}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => scrollToSection("use-cases")}
            className={linkClass(false)}
          >
            Use Cases
          </button>
          <Link href="/docs" className={linkClass(isDocs)}>
            Documentation
          </Link>
          <button
            type="button"
            onClick={() => scrollToSection("faq")}
            className={linkClass(false)}
          >
            FAQ
          </button>
        </nav>

        {/* Right: theme + auth CTAs + mobile drawer trigger */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle />

          {/* Mobile compact primary CTA */}
          {viewer ? (
            <Button asChild size="xs" className="h-8 px-2.5 sm:hidden">
              <Link href={viewer.workspaceHref}>
                Workspace
                <ArrowRight className="size-3" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="xs" className="h-8 px-2.5 sm:hidden">
              <Link href="/signup">Sign Up Free</Link>
            </Button>
          )}

          {/* Desktop / Tablet CTAs */}
          {viewer ? (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href={viewer.workspaceHref}>
                Open Workspace
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/signup">Sign Up Free</Link>
              </Button>
            </>
          )}

          {/* Mobile drawer */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                className="md:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" showCloseButton={false} className="flex w-[86vw] max-w-sm flex-col p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
                <Link href="/" onClick={() => setMobileOpen(false)}>
                  <TactiqLogo markClassName="size-7" wordmarkClassName="text-lg" />
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Apps
                </p>
                <div className="mt-2 space-y-1.5">
                  {SUITE_APPS.map((app) => {
                    const Icon = app.icon;
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => selectApp(app.id)}
                        className="flex w-full items-start gap-3 rounded-xl border bg-card/50 p-3 text-left transition-colors hover:bg-accent"
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg ring-1",
                            app.accent,
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between text-sm font-semibold">
                            {app.name}
                            <ArrowRight className="size-3.5 text-muted-foreground" />
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {app.tagline}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="my-4 h-px bg-border" />

                <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Product &amp; Guides
                </p>
                <nav className="mt-1.5 flex flex-col gap-0.5" aria-label="Mobile">
                  {([
                    ["Features", "features"],
                    ["How It Connects", "workflow"],
                    ["Use Cases", "use-cases"],
                    ["Capabilities", "capabilities"],
                    ["FAQ", "faq"],
                  ] as const).map(([label, sectionId]) => (
                    <button
                      key={sectionId}
                      type="button"
                      onClick={() => scrollToSection(sectionId)}
                      className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent"
                    >
                      <span>{label}</span>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                    </button>
                  ))}
                  <Link
                    href="/docs"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
                  >
                    <span className="inline-flex items-center gap-2">
                      <BookOpen className="size-4 text-indigo-500" />
                      Documentation
                    </span>
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                  </Link>
                </nav>
              </div>

              <div className="shrink-0 border-t bg-muted/20 p-4">
                {viewer ? (
                  <Button asChild className="w-full">
                    <Link href={viewer.workspaceHref} onClick={() => setMobileOpen(false)}>
                      Open {viewer.workspaceName ?? "Workspace"}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline">
                      <Link href="/login" onClick={() => setMobileOpen(false)}>
                        Log In
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link href="/signup" onClick={() => setMobileOpen(false)}>
                        Sign Up Free
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export { PublicNavbar as Navbar };
