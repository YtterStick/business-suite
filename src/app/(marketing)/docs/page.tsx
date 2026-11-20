import type { Metadata } from "next";
import { ArrowRight, BookOpen, Boxes, Rocket } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocsContent } from "@/components/docs/docs-content";
import { DOC_GROUPS, DOCS_HOME_SLUG, docHref, getDocArticle } from "@/components/docs/docs-data";

export const metadata: Metadata = {
  title: "Documentation — Tactiq",
  description: "Guides for getting started with Tactiq CRM, Finance, and Projects.",
};

const GROUP_ICONS = [Rocket, Boxes, BookOpen];

export default function DocsHomePage() {
  const article = getDocArticle(DOCS_HOME_SLUG);
  if (!article) notFound();

  const intro = (
    <div className="mb-12">
      <div className="rounded-2xl border bg-gradient-to-br from-indigo-500/10 via-transparent to-cyan-400/10 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
          Tactiq Documentation
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight">Learn Tactiq, step by step.</p>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Everything you need to set up your workspace, run each app, and connect them together.
        </p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {DOC_GROUPS.map((group, i) => {
          const Icon = GROUP_ICONS[i] ?? BookOpen;
          const first = group.slugs[0]!;
          return (
            <Link
              key={group.title}
              href={docHref(first === DOCS_HOME_SLUG ? (group.slugs[1] ?? first) : first)}
              className="group rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm"
            >
              <Icon className="size-4 text-indigo-500" />
              <p className="mt-3 text-sm font-semibold">{group.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{group.slugs.length} guides</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                Start reading
                <ArrowRight className="size-3" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return <DocsContent article={article} intro={intro} />;
}
