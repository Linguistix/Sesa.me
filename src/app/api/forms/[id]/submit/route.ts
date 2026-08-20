import { NextResponse } from "next/server";
import { submitForm } from "@/server/forms";
import { formLimiter } from "@/lib/rate-limit";
import { clientIp } from "@/lib/analytics/visitor";

/**
 * Public form submission.
 *
 * Tighter rate limiting than analytics: this endpoint writes rows a human will
 * later read, so a spam flood costs the page owner attention, not just disk.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const { ok } = await formLimiter.check(`${id}:${clientIp(request.headers) ?? "unknown"}`);
  if (!ok) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans une minute." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const result = await submitForm(id, body as Record<string, unknown>);

  if (!result.ok) {
    return NextResponse.json(result, { status: "fieldErrors" in result ? 422 : 404 });
  }

  return NextResponse.json(result);
}
