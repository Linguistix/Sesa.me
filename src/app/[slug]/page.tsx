import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicPage } from "@/server/pages";
import { themeFontHref } from "@/lib/theme/render";
import { PageRenderer } from "@/components/public/PageRenderer";

/**
 * Public pages are statically rendered and revalidated, so a cache hit serves
 * pure HTML from the edge with no database round-trip — the sub-second budget
 * from the brief. Mutations in the dashboard call `revalidatePath` so an edit
 * is visible immediately rather than after the window expires.
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
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPublicPage(slug);

  if (!page) notFound();

  const fontHref = themeFontHref(page.theme);

  return (
    <>
      {fontHref ? (
        <>
          {/* Warm the font connection before the stylesheet parses. */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={fontHref} />
        </>
      ) : null}

      <PageRenderer
        page={{
          slug: page.slug,
          displayName: page.displayName,
          bio: page.bio,
          avatarUrl: page.avatarUrl,
          theme: page.theme,
          links: page.links,
          // Pro accounts pay to remove the footer.
          showBranding: page.plan !== "PRO",
        }}
      />
    </>
  );
}
