import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getPublicPage } from "@/server/pages";
import { themeFontHref } from "@/lib/theme/render";
import { PageRenderer } from "@/components/public/PageRenderer";
import { AnalyticsTracker } from "@/components/public/AnalyticsTracker";
import { negotiateLocale, isLocale, type Locale } from "@/lib/i18n/config";

/**
 * Renders a public page.
 *
 * Shared by the slug route (`/<slug>`) and by the root route when it is being
 * served under a verified custom domain, so both paths render byte-identical
 * markup rather than drifting apart.
 */
export async function PublicPageView({ slug }: { slug: string }) {
  const page = await getPublicPage(slug);
  if (!page) notFound();

  const locale = await resolveLocale(page.ownerLocale);
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
          isVerified: page.isVerified,
          locale,
        }}
      />

      <AnalyticsTracker pageId={page.id} />
    </>
  );
}

/**
 * Prefers the visitor's browser languages, falling back to the page owner's
 * own locale rather than the app default — a French creator's page reads
 * better in French than in English for a visitor whose language we do not
 * speak.
 */
async function resolveLocale(ownerLocale: string): Promise<Locale> {
  const requestHeaders = await headers();
  const accept = requestHeaders.get("accept-language");

  const negotiated = negotiateLocale(accept);
  // negotiateLocale returns the default when nothing matched; in that case
  // defer to the owner's locale if it is one we support.
  if (accept && negotiated !== "fr") return negotiated;
  return isLocale(ownerLocale) ? ownerLocale : negotiated;
}
