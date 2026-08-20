import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ingest } from "@/server/analytics";
import { analyticsLimiter } from "@/lib/rate-limit";
import {
  clientCountry,
  clientIp,
  deviceFromUserAgent,
  sourceFromReferrer,
  visitorHash,
} from "@/lib/analytics/visitor";
import { displayHost } from "@/lib/urls";

const bodySchema = z.object({
  pageId: z.string().min(1).max(64),
  type: z.enum(["PAGE_VIEW", "LINK_CLICK"]),
  linkId: z.string().min(1).max(64).nullish(),
  /** Sent by the browser because the beacon has no Referer of its own. */
  referrer: z.string().max(2048).nullish(),
});

/**
 * Analytics ingestion.
 *
 * Public pages are served from the ISR cache, so a cache hit never runs server
 * code — a view can only be counted from the browser. This endpoint is
 * therefore public by necessity, which shapes its defences: identifiers are
 * verified against the database, the client's numbers are never trusted, and
 * requests are rate-limited per IP.
 *
 * It always answers 204. A tracker that fails must not surface an error to a
 * visitor who only wanted to read the page.
 */
export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  // The limiter already namespaces its keys; pass only what varies.
  const { ok } = await analyticsLimiter.check(ip ?? "unknown");
  if (!ok) return new NextResponse(null, { status: 204 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });

  const { pageId, type, linkId, referrer } = parsed.data;

  // Verify the ids belong together before writing: without this the endpoint
  // would let anyone attribute clicks to any page.
  const page = await prisma.page.findUnique({ where: { id: pageId }, select: { id: true } });
  if (!page) return new NextResponse(null, { status: 204 });

  if (linkId) {
    const link = await prisma.link.findFirst({
      where: { id: linkId, pageId },
      select: { id: true },
    });
    if (!link) return new NextResponse(null, { status: 204 });
  }

  const userAgent = request.headers.get("user-agent");

  await ingest({
    pageId,
    linkId: linkId ?? null,
    type,
    source: sourceFromReferrer(referrer ?? null, displayHost()),
    country: clientCountry(request.headers),
    device: deviceFromUserAgent(userAgent),
    visitorHash: visitorHash({ ip, userAgent, pageId }),
  });

  return new NextResponse(null, { status: 204 });
}
