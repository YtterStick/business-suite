import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { TactiqLogo, TactiqMark } from "@/components/brand/tactiq-logo";
import { Button } from "@/components/ui/button";
import type { MarketingViewer } from "@/server/marketing";

export function CtaBanner({ viewer }: { viewer: MarketingViewer | null }) {
  return (
    <section className="border-t py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border bg-zinc-950 px-6 py-14 text-center text-white sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600/40 via-indigo-600/40 to-cyan-500/30 blur-3xl"
          />
          <TactiqMark className="relative mx-auto size-12" />
          <h2 className="relative mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Bring your whole business into one workspace.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-zinc-400">
            Set up in minutes. Invite your team when you&apos;re ready.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {viewer ? (
              <Button asChild size="lg" className="bg-white text-zinc-950 hover:bg-zinc-200">
                <Link href={viewer.workspaceHref}>
                  Open {viewer.workspaceName ?? "Workspace"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="bg-white text-zinc-950 hover:bg-zinc-200">
                  <Link href="/signup">
                    Sign Up Free
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="text-zinc-300 hover:bg-white/10 hover:text-white"
                >
                  <Link href="/login">Log In</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "CRM", href: "/#crm" },
      { label: "Finance", href: "/#finance" },
      { label: "Projects", href: "/#projects" },
      { label: "How It Connects", href: "/#workflow" },
      { label: "Capabilities", href: "/#capabilities" },
    ],
  },
  {
    title: "Documentation",
    links: [
      { label: "What is Tactiq?", href: "/docs" },
      { label: "Quickstart Guide", href: "/docs/quickstart" },
      { label: "CRM Guide", href: "/docs/crm" },
      { label: "Finance & Billing", href: "/docs/finance" },
      { label: "Projects", href: "/docs/projects" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Workspace Setup", href: "/docs/workspace-setup" },
      { label: "Integrations", href: "/docs/integrations" },
      { label: "Automations", href: "/docs/automations" },
      { label: "Keyboard Shortcuts", href: "/docs/keyboard-shortcuts" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Security & Data", href: "/docs/security" },
      { label: "Privacy", href: "/docs/security#privacy" },
      { label: "Acceptable Use", href: "/docs/security#terms-of-use" },
    ],
  },
];

export function Footer({ viewer = null }: { viewer?: MarketingViewer | null }) {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <TactiqLogo markClassName="size-7" wordmarkClassName="text-lg" />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              CRM, Finance, and Projects in one connected workspace.
            </p>
            <div className="mt-5 flex gap-2">
              {viewer ? (
                <Button asChild size="sm">
                  <Link href={viewer.workspaceHref}>
                    Open Workspace
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="sm">
                    <Link href="/signup">Sign Up</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/login">Log In</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Tactiq. All rights reserved.</p>
          <p>Made for teams that sell, deliver, and bill.</p>
        </div>
      </div>
    </footer>
  );
}
