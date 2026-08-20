import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportUserData } from "@/server/gdpr";

/** GDPR article 20 — the user's data, as a downloadable JSON file. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const data = await exportUserData(session.user.id);
  if (!data) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sesame-mes-donnees.json"`,
      "Cache-Control": "no-store",
    },
  });
}
