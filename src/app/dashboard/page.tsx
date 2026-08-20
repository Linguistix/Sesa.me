import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEditablePage } from "@/server/pages";
import { LinkList } from "@/components/dashboard/LinkList";
import { LinkForm } from "@/components/dashboard/LinkForm";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { PhonePreview } from "@/components/dashboard/PhonePreview";
import { PageRenderer } from "@/components/public/PageRenderer";
import { appUrl } from "@/lib/urls";
import { isStorageConfigured } from "@/lib/storage";

export const metadata = { title: "Éditeur" };

export default async function EditorPage() {
  const session = await auth();
  const page = await getEditablePage(session!.user.id);
  if (!page) redirect("/login");

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-8">
        <section aria-labelledby="profile-heading">
          <h1 id="profile-heading" className="mb-4 text-lg font-semibold">
            Votre page
          </h1>
          <ProfileForm
            storageEnabled={isStorageConfigured()}
            page={{
              slug: page.slug,
              displayName: page.displayName,
              bio: page.bio,
              avatarUrl: page.avatarUrl,
            }}
          />
        </section>

        <section aria-labelledby="links-heading">
          <h2 id="links-heading" className="mb-1 text-lg font-semibold">
            Blocs
          </h2>
          <p className="mb-4 text-sm text-neutral-500">
            Glissez-déposez pour réordonner, ou utilisez la poignée au clavier.
          </p>

          <LinkList
            storageEnabled={isStorageConfigured()}
            links={page.links.map((l) => ({
              id: l.id,
              type: l.type,
              title: l.title,
              url: l.url,
              emoji: l.emoji,
              body: l.body,
              images: l.images,
              isActive: l.isActive,
              hasPassword: l.passwordHash !== null,
            }))}
          />

          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="mb-3 text-sm font-medium text-neutral-200">Ajouter un bloc</h3>
            <LinkForm mode="create" storageEnabled={isStorageConfigured()} />
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-20 lg:h-fit">
        <h2 className="mb-3 text-sm font-medium text-neutral-400">Aperçu</h2>
        <PhonePreview href={appUrl(`/${page.slug}`)}>
          <PageRenderer
            preview
            page={{
              slug: page.slug,
              displayName: page.displayName,
              bio: page.bio,
              avatarUrl: page.avatarUrl,
              theme: page.theme,
              showBranding: true,
              locale: "fr",
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
                  images: l.images,
                  isLocked: l.passwordHash !== null,
                })),
            }}
          />
        </PhonePreview>
      </aside>
    </div>
  );
}
