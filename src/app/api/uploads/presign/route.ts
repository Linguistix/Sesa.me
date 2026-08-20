import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { presignUpload } from "@/server/uploads";
import { createLimiter } from "@/lib/rate-limit";

/**
 * Presigned uploads cost storage, so they are limited per user — generously
 * enough for a gallery upload in one go, tightly enough that a loop cannot
 * fill a bucket.
 */
const presignLimiter = createLimiter("presign", { limit: 30, windowMs: 60_000 });

const bodySchema = z.object({
  purpose: z.enum(["avatar", "gallery"]),
  contentType: z.string().min(1).max(100),
  contentLength: z.number().int().positive().max(64 * 1024 * 1024),
});

/**
 * Issues a presigned upload URL.
 *
 * Authentication is the gate: an unauthenticated caller gets nothing, and the
 * object key is derived from the session's user id rather than from anything
 * the request supplies.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { ok: withinLimit } = await presignLimiter.check(userId);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Trop de téléversements. Réessayez dans une minute." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const result = await presignUpload({ userId, ...parsed.data });

  if (!result.ok) {
    // 422 rather than 400: the request was well-formed, the file was not
    // acceptable — and the message says why, so the UI can show it.
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json(result.upload);
}
