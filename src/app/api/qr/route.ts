import { NextResponse } from "next/server";
import { z } from "zod";
import { qrToPngBuffer, qrToSvg } from "@/lib/qr";
import { appUrl } from "@/lib/urls";
import { prisma } from "@/lib/db";

const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);

const querySchema = z.object({
  slug: z.string().min(1).max(32),
  format: z.enum(["png", "svg"]).default("png"),
  dark: hex.default("#000000"),
  light: hex.default("#FFFFFF"),
  size: z.coerce.number().int().min(128).max(2048).default(1024),
  margin: z.coerce.number().int().min(0).max(8).default(2),
});

/**
 * Renders the QR code for a page.
 *
 * Colours are constrained to hex literals by the schema — they end up inside
 * generated SVG markup, so anything looser would be an injection point. The
 * slug is resolved against the database rather than echoed, so this cannot be
 * turned into a generic QR generator for arbitrary URLs.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const { slug, format, dark, light, size, margin } = parsed.data;

  const page = await prisma.page.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { slug: true, displayName: true },
  });

  if (!page) {
    return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  }

  const target = appUrl(`/${page.slug}`);
  const filename = `sesame-${page.slug}.${format}`;

  // Immutable for a day: the payload only changes if the slug changes, and a
  // renamed page gets a different URL anyway.
  const cacheHeaders = {
    "Cache-Control": "public, max-age=86400, s-maxage=86400",
    "Content-Disposition": `attachment; filename="${filename}"`,
  };

  if (format === "svg") {
    const svg = await qrToSvg(target, { dark, light, margin });
    return new NextResponse(svg, {
      headers: { "Content-Type": "image/svg+xml; charset=utf-8", ...cacheHeaders },
    });
  }

  const png = await qrToPngBuffer(target, { dark, light, size, margin });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", ...cacheHeaders },
  });
}
