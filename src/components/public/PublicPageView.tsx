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

          {/*
            The font stylesheet is loaded without blocking the first paint.

            A plain `<link rel="stylesheet">` to a third party is render
            blocking: while that request is in flight the visitor sees nothing.
            On a good connection that is 50ms and invisible; on a bad one, or
            during a Google Fonts incident, it is a blank page — and this page
            is somebody's whole presence in a bio link. `media="print"` makes
            the browser fetch the stylesheet without waiting for it, and the
            script below applies it the moment it lands.

            Nothing is lost by doing this: the URL already carries
            `display=swap`, so text was always going to paint in the fallback
            face first and swap when the webfont arrived. The only change is
            that it now paints at once instead of after the round trip.

            There is deliberately no `<noscript>` fallback. React 19 hoists
            `<link rel="stylesheet">` into the document head wherever it is
            written — including out of a `<noscript>` — so the fallback copy
            came back as a second, render-blocking link and undid the whole
            thing. A visitor with scripting disabled reads the page in the
            fallback stack, which is the same thing every visitor sees for the
            first moments anyway.
          */}
          <link rel="stylesheet" href={fontHref} media="print" data-sesame-font="" />
          <script
            dangerouslySetInnerHTML={{
              __html: FONT_ACTIVATION_SCRIPT,
            }}
          />
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

/*
  Flips the font stylesheet from `print` to `all` once it has loaded, which is
  the point at which applying it no longer costs a render block. Inline and
  tiny so it runs during parse without a request of its own; `l.sheet` covers
  the case where the stylesheet was already in the HTTP cache and finished
  before this ran, so no load event is coming.
*/
const FONT_ACTIVATION_SCRIPT = `document.querySelectorAll('link[data-sesame-font]').forEach(function(l){if(l.sheet){l.media='all'}else{l.addEventListener('load',function(){l.media='all'},{once:true})}})`;

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
