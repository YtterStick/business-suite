"use client";

import * as React from "react";
import { ArrowRight, BookOpen, ChevronDown, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { TactiqLogo } from "@/components/brand/tactiq-logo";
import { SUITE_APPS } from "@/components/marketing/apps";
import { ThemeToggle } from "@/components/marketing/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { MarketingViewer } from "@/server/marketing";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Documentation", href: "/docs" },
  { label: "Pricing", href: "/#pricing" },
];

export function Navbar({ viewer }: { viewer: MarketingViewer | null }) {
  const pathname = usePathname();
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
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:text-foreground",
      active ? "text-foreground" : "text-muted-foreground",
    );

  return (
    <header
      className={cn(
        "sticky top-0 z-50 h-16 border-b bg-background/80 backdrop-blur-xl transition-shadow supports-[backdrop-filter]:bg-background/70 dark:bg-[#0D0E12]/80",
        scrolled ? "border-border shadow-sm" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left: brand */}
        <Link href="/" aria-label="Tactiq home" className="tq-hover-animate shrink-0">
          <TactiqLogo markClassName="size-7" wordmarkClassName="text-lg" />
        </Link>

        {/* Center: links */}
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          <Link href={NAV_LINKS[0]!.href} className={linkClass(false)}>
            Features
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(linkClass(false), "inline-flex items-center gap-1 outline-none")}>
              Apps
              <ChevronDown className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" sideOffset={10} className="w-80 p-2">
              {SUITE_APPS.map((app) => {
                const Icon = app.icon;
                return (
                  <DropdownMenuItem key={app.id} asChild className="items-start gap-3 rounded-md p-2.5">
                    <Link href={`/#${app.id}`}>
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg ring-1",
                          app.accent,
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{app.name}</span>
                        <span className="block text-xs leading-snug text-muted-foreground">
                          {app.description}
                        </span>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/docs" className={linkClass(isDocs)}>
            Documentation
          </Link>
          <Link href="/#pricing" className={linkClass(false)}>
            Pricing
          </Link>
        </nav>

        {/* Right: CTAs */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
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

          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-16 items-center border-b px-5">
                <TactiqLogo markClassName="size-7" wordmarkClassName="text-lg" />
              </div>
              <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
                <MobileLink href="/#features" onNavigate={() => setMobileOpen(false)}>
                  Features
                </MobileLink>
                <p className="mt-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Apps
                </p>
                {SUITE_APPS.map((app) => {
                  const Icon = app.icon;
                  return (
                    <MobileLink key={app.id} href={`/#${app.id}`} onNavigate={() => setMobileOpen(false)}>
                      <Icon className={cn("size-4", app.iconColor)} />
                      {app.name}
                    </MobileLink>
                  );
                })}
                <div className="my-3 h-px bg-border" />
                <MobileLink href="/docs" onNavigate={() => setMobileOpen(false)}>
                  <BookOpen className="size-4 text-muted-foreground" />
                  Documentation
                </MobileLink>
                <MobileLink href="/#pricing" onNavigate={() => setMobileOpen(false)}>
                  Pricing
                </MobileLink>
                <div className="mt-4 flex flex-col gap-2">
                  {viewer ? (
                    <Button asChild>
                      <Link href={viewer.workspaceHref} onClick={() => setMobileOpen(false)}>
                        Open Workspace
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild>
                        <Link href="/signup" onClick={() => setMobileOpen(false)}>
                          Sign Up Free
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href="/login" onClick={() => setMobileOpen(false)}>
                          Log In
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function MobileLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
    >
      {children}
    </Link>
  );
}
