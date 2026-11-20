import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DocsContent } from "@/components/docs/docs-content";
import { DOC_ARTICLES, DOCS_HOME_SLUG, getDocArticle } from "@/components/docs/docs-data";

export function generateStaticParams() {
  return DOC_ARTICLES.filter((a) => a.slug !== DOCS_HOME_SLUG).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getDocArticle(slug);
  if (!article) return { title: "Not found — Tactiq Docs" };
  return { title: `${article.title} — Tactiq Docs`, description: article.description };
}

export default async function DocArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === DOCS_HOME_SLUG) redirect("/docs");
  const article = getDocArticle(slug);
  if (!article) notFound();
  return <DocsContent article={article} />;
}
