import type { Metadata } from "next";
import { getPublicPage } from "@/server/pages";
import { PublicPageView } from "@/components/public/PublicPageView";

/**
 * Public pages are rendered on demand and revalidated, so a warm cache serves
 * HTML with no database round-trip — the sub-second budget from the brief.
 * Mutations in the dashboard call `revalidatePath`, so an edit is visible
 * immediately rather than after the window expires.
 *
 * The route reads `Accept-Language` (via `PublicPageView`), which opts it out
 * of full static caching. That trade is deliberate: serving a Spanish visitor
 * a French page to save a few milliseconds is the wrong side of what the
 * performance budget is for.
 */
export const revalidate = 300;
export const dynamicParams = true;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublicPage(slug);

  if (!page) return { title: "Page introuvable" };

  const title = page.displayName;
  const description = page.bio ?? `Retrouvez tous les liens de ${page.displayName}.`;

  return {
    title,
    description,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      title,
      description,
      type: "profile",
      url: `/${page.slug}`,
      images: page.avatarUrl ? [{ url: page.avatarUrl }] : undefined,
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicPage({ params }: Props) {
  const { slug } = await params;
  return <PublicPageView slug={slug} />;
}
