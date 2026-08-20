import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEditablePage } from "@/server/pages";
import { themeQuota } from "@/server/ai";
import { isAiConfigured } from "@/lib/ai/client";
import { ThemePicker } from "@/components/dashboard/ThemePicker";

export const metadata = { title: "Apparence" };

export default async function AppearancePage() {
  const session = await auth();
  const page = await getEditablePage(session!.user.id);
  if (!page) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { plan: true },
  });
  const plan = user?.plan ?? "FREE";
  const quota = await themeQuota(session!.user.id, plan);

  return (
    <>
      <h1 className="mb-6 text-lg font-semibold">Apparence</h1>
      <ThemePicker
        ai={{
          configured: isAiConfigured(),
          remaining: Number.isFinite(quota.remaining) ? quota.remaining : 0,
          isPro: plan === "PRO",
        }}
        initialTheme={page.theme}
        previewPage={{
          slug: page.slug,
          displayName: page.displayName,
          bio: page.bio,
          avatarUrl: page.avatarUrl,
          showBranding: true,
          links: page.links
            .filter((l) => l.isActive)
            .map((l) => ({
              id: l.id,
              type: l.type,
              title: l.title,
              url: l.url,
              emoji: l.emoji,
              iconUrl: l.iconUrl,
              body: l.body,
              isLocked: l.passwordHash !== null,
            })),
        }}
      />
    </>
  );
}
