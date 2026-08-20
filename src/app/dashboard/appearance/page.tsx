import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEditablePage } from "@/server/pages";
import { ThemePicker } from "@/components/dashboard/ThemePicker";

export const metadata = { title: "Apparence" };

export default async function AppearancePage() {
  const session = await auth();
  const page = await getEditablePage(session!.user.id);
  if (!page) redirect("/login");

  return (
    <>
      <h1 className="mb-6 text-lg font-semibold">Apparence</h1>
      <ThemePicker
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
