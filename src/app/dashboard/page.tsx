import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEditablePage } from "@/server/pages";
import { availableSyncProviders } from "@/server/sync";
import { isStorageConfigured } from "@/lib/storage";
import { LinkList } from "@/components/dashboard/LinkList";
import { LinkForm } from "@/components/dashboard/LinkForm";
import { ProfileForm } from "@/components/dashboard/ProfileForm";
import { PhonePreview } from "@/components/dashboard/PhonePreview";
import { PageRenderer } from "@/components/public/PageRenderer";
import { Panel, SectionHeader } from "@/components/ui/Panel";
import { appUrl } from "@/lib/urls";

export const metadata = { title: "Éditeur" };

const SYNC_LABELS: Record<string, string> = {
  SPOTIFY_LATEST_RELEASE: "Spotify — dernière sortie",
  YOUTUBE_LATEST_VIDEO: "YouTube — dernière vidéo",
};

export default async function EditorPage() {
  const session = await auth();
  const page = await getEditablePage(session!.user.id);
  if (!page) redirect("/login");

  const syncProviders = (await availableSyncProviders(session!.user.id)).map((value) => ({
    value,
    label: SYNC_LABELS[value] ?? value,
  }));

  const storageEnabled = isStorageConfigured();

  return (
    /*
      Two columns, and the preview is sticky. A creator edits a block and looks
      right to see the effect — if the preview scrolls away, that loop breaks
      and they end up opening the public page in another tab to check their
      work, which is the thing a live preview exists to prevent.
    */
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_auto] xl:gap-12">
      <div className="flex min-w-0 flex-col gap-10">
        <section aria-labelledby="profile-heading">
          <SectionHeader
            level="h1"
            id="profile-heading"
            title="Votre page"
            description="Le nom, la bio et l'adresse que verront vos visiteurs."
          />
          <Panel inset>
            <ProfileForm
              storageEnabled={storageEnabled}
              page={{
                slug: page.slug,
                displayName: page.displayName,
                bio: page.bio,
                avatarUrl: page.avatarUrl,
              }}
            />
          </Panel>
        </section>

        <section aria-labelledby="links-heading">
          <SectionHeader
            id="links-heading"
            title="Blocs"
            description="Glissez-déposez pour réordonner, ou utilisez la poignée au clavier."
          />

          <LinkList
            storageEnabled={storageEnabled}
            syncProviders={syncProviders}
            links={page.links.map((l) => ({
              id: l.id,
              type: l.type,
              title: l.title,
              url: l.url,
              emoji: l.emoji,
              body: l.body,
              images: l.images,
              isActive: l.isActive,
              syncProvider: l.syncProvider,
              syncError: l.syncError,
              hasPassword: l.passwordHash !== null,
            }))}
          />

          <Panel className="mt-4 p-4">
            <h3 className="mb-3 text-sm font-semibold text-ink-100">Ajouter un bloc</h3>
            <LinkForm mode="create" storageEnabled={storageEnabled} syncProviders={syncProviders} />
          </Panel>
        </section>
      </div>

      <aside className="hidden lg:sticky lg:top-32 lg:block">
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
                  form: null,
                })),
            }}
          />
        </PhonePreview>
      </aside>
    </div>
  );
}
