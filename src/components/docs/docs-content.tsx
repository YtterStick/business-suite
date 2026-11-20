import * as React from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Info, Lightbulb, Link2, Sparkles } from "lucide-react";
import Link from "next/link";

import { CopyButton } from "@/components/docs/copy-button";
import {
  docHref,
  getDocGroupTitle,
  getOrderedDocArticles,
  type CalloutVariant,
  type DocArticle,
  type DocBlock,
} from "@/components/docs/docs-data";
import { DocsToc } from "@/components/docs/docs-toc";
import { cn } from "@/lib/utils";

/** Renders `code`, **bold**, and [label](/href) inline markup. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
              {part.slice(1, -1)}
            </code>
          );
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (link) {
          return (
            <Link
              key={i}
              href={link[2]!}
              className="font-medium text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
            >
              {link[1]}
            </Link>
          );
        }
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

const CALLOUTS: Record<CalloutVariant, { label: string; icon: typeof Info; cls: string; iconCls: string }> = {
  tip: {
    label: "Tip",
    icon: Lightbulb,
    cls: "border-emerald-500/30 bg-emerald-500/5",
    iconCls: "text-emerald-600 dark:text-emerald-400",
  },
  note: {
    label: "Note",
    icon: Info,
    cls: "border-sky-500/30 bg-sky-500/5",
    iconCls: "text-sky-600 dark:text-sky-400",
  },
  "best-practice": {
    label: "Best practice",
    icon: Sparkles,
    cls: "border-violet-500/30 bg-violet-500/5",
    iconCls: "text-violet-600 dark:text-violet-400",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    cls: "border-amber-500/40 bg-amber-500/5",
    iconCls: "text-amber-600 dark:text-amber-400",
  },
};

const APP_TONE: Record<string, string> = {
  CRM: "bg-sky-500/10 text-sky-700 ring-sky-500/25 dark:text-sky-300",
  Finance: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  Projects: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
};

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className="leading-7 text-muted-foreground">
          <Inline text={block.text} />
        </p>
      );
    case "list":
      return (
        <ul className="space-y-2 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 leading-7 text-muted-foreground">
              <span className="mt-[0.7rem] size-1.5 shrink-0 rounded-full bg-indigo-500/70" />
              <span>
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="relative space-y-5 border-l pl-6">
          {block.items.map((step, i) => (
            <li key={i} className="relative">
              <span className="absolute top-0 -left-[37px] flex size-6 items-center justify-center rounded-full border bg-background text-xs font-semibold">
                {i + 1}
              </span>
              <p className="font-semibold">{step.title}</p>
              <p className="mt-1 leading-7 text-muted-foreground">
                <Inline text={step.text} />
              </p>
            </li>
          ))}
        </ol>
      );
    case "callout": {
      const meta = CALLOUTS[block.variant];
      const Icon = meta.icon;
      return (
        <div className={cn("flex gap-3 rounded-xl border p-4 transition-colors", meta.cls)} role="note">
          <Icon className={cn("mt-0.5 size-4 shrink-0", meta.iconCls)} />
          <div className="min-w-0 text-sm leading-6">
            <p className={cn("font-semibold", meta.iconCls)}>{block.title ?? meta.label}</p>
            <p className="mt-0.5 text-foreground/80">
              <Inline text={block.text} />
            </p>
          </div>
        </div>
      );
    }
    case "code":
      return (
        <figure className="overflow-hidden rounded-xl border bg-zinc-950">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-1.5">
            <figcaption className="text-xs text-zinc-400">{block.caption ?? block.language ?? "Code"}</figcaption>
            <CopyButton value={block.code} />
          </div>
          <pre className="overflow-x-auto p-4 text-[13px] leading-6 text-zinc-100">
            <code>{block.code}</code>
          </pre>
        </figure>
      );
    case "shortcuts":
      return (
        <div className="overflow-hidden rounded-xl border">
          {block.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-4 border-b px-4 py-2.5 text-sm last:border-0">
              <span className="text-muted-foreground">{item.action}</span>
              <span className="flex gap-1">
                {item.keys.map((k) => (
                  <kbd key={k} className="min-w-6 rounded border bg-muted px-1.5 py-0.5 text-center font-mono text-xs">
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      );
    case "flow":
      return (
        <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {block.items.map((item, i) => (
            <li key={i} className="relative rounded-xl border bg-card p-4 dark:bg-white/[0.02]">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", APP_TONE[item.app])}>
                {i + 1}. {item.app}
              </span>
              <p className="mt-3 text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {block.head.map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-t">
                  {row.map((cell, j) => (
                    <td key={j} className={cn("px-4 py-2.5 align-top", j === 0 ? "font-medium" : "text-muted-foreground")}>
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/** Center content pane + right "On this page" rail for one article. */
export function DocsContent({ article, intro }: { article: DocArticle; intro?: React.ReactNode }) {
  const ordered = getOrderedDocArticles();
  const index = ordered.findIndex((a) => a.slug === article.slug);
  const prev = index > 0 ? ordered[index - 1] : undefined;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined;
  const group = getDocGroupTitle(article.slug);

  return (
    <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_14rem]">
      <article className="min-w-0 max-w-3xl">
        {intro}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/docs" className="hover:text-foreground">
            Docs
          </Link>
          {group && (
            <>
              <span>/</span>
              <span>{group}</span>
            </>
          )}
        </nav>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{article.title}</h1>
        <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{article.description}</p>

        <div className="mt-10 space-y-14">
          {article.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-32">
              <h2 className="group flex items-center gap-2 text-xl font-semibold tracking-tight">
                {section.title}
                <a
                  href={`#${section.id}`}
                  aria-label={`Link to ${section.title}`}
                  className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Link2 className="size-4" />
                </a>
              </h2>
              <div className="mt-4 space-y-5">
                {section.blocks.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 grid gap-3 border-t pt-8 sm:grid-cols-2">
          {prev ? (
            <Link
              href={docHref(prev.slug)}
              className="group rounded-xl border p-4 transition-colors hover:border-foreground/20 hover:bg-muted/40"
            >
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
                Previous
              </span>
              <span className="mt-1 block text-sm font-semibold">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={docHref(next.slug)}
              className="group rounded-xl border p-4 text-right transition-colors hover:border-foreground/20 hover:bg-muted/40"
            >
              <span className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                Next
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="mt-1 block text-sm font-semibold">{next.title}</span>
            </Link>
          )}
        </div>
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-36">
          <DocsToc items={article.sections.map((s) => ({ id: s.id, title: s.title }))} />
        </div>
      </aside>
    </div>
  );
}
