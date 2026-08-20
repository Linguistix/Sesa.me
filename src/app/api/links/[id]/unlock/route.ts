import { NextResponse } from "next/server";
import { z } from "zod";
import { unlockLink } from "@/server/links";

const bodySchema = z.object({ password: z.string().min(1).max(200) });

/**
 * Exchanges a password for a gated link's destination.
 *
 * The URL is never sent to the browser with the page — only this endpoint can
 * reveal it, and only after bcrypt confirms the password. A wrong password and
 * an unknown id return the same 401 so the endpoint cannot be used to probe
 * which links are gated.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const url = await unlockLink(id, parsed.data.password);
  if (!url) {
    return NextResponse.json({ error: "Mot de passe incorrect." }, { status: 401 });
  }

  return NextResponse.json({ url });
}
