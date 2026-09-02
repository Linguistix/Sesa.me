import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEditablePage } from "@/server/pages";
import { DeleteAccountForm } from "@/components/dashboard/DeleteAccountForm";
import { PageHeader, PageBody, Panel, SectionHeader, Badge } from "@/components/ui/Panel";

export const metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const session = await auth();
  const [user, page] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { email: true, plan: true, createdAt: true },
    }),
    getEditablePage(session!.user.id),
  ]);

  if (!user || !page) redirect("/login");

  return (
    <PageBody>
      <PageHeader title="Paramètres" />

      <div className="flex flex-col gap-5">
        <Panel className="p-5" aria-labelledby="account-heading">
          <SectionHeader
            id="account-heading"
            title="Compte"
            action={
              <Badge tone={user.plan === "PRO" ? "accent" : "neutral"}>
                {user.plan === "PRO" ? "Pro" : "Gratuit"}
              </Badge>
            }
          />
          <dl className="text-base">
            <div className="flex justify-between gap-4 border-t border-white/6 py-2 first:border-t-0 first:pt-0">
              <dt className="text-ink-400">E-mail</dt>
              <dd className="truncate text-ink-100">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-white/6 py-2">
              <dt className="text-ink-400">Inscrit le</dt>
              <dd className="text-ink-100">
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(user.createdAt)}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel className="p-5" aria-labelledby="data-heading">
          <SectionHeader
            id="data-heading"
            title="Vos données"
            description="Téléchargez tout ce que nous conservons à votre sujet : compte, pages, liens et totaux de statistiques. Les statistiques sont exportées sous forme agrégée — elles décrivent vos visiteurs, pas vous."
          />
          <a
            href="/api/account/export"
            download
            className="inline-flex h-9 items-center rounded-md px-3.5 text-base text-ink-100 ring-1 ring-inset ring-white/12 transition hover:bg-white/5"
          >
            Exporter mes données (JSON)
          </a>
        </Panel>

        {/*
          The destructive section is set apart by a red hairline rather than a
          red panel: it has to be unmistakable when you reach it, without
          shouting at someone who came here to change their e-mail.
        */}
        <Panel
          className="border-l-2 border-l-critical-500/50 p-5"
          aria-labelledby="danger-heading"
        >
          <SectionHeader
            id="danger-heading"
            title="Supprimer le compte"
            description={
              <>
                Cette action est irréversible. Votre page, vos liens et vos statistiques seront
                définitivement supprimés, et le lien <code>/{page.slug}</code> sera libéré.
              </>
            }
          />
          <DeleteAccountForm expected={page.slug} />
        </Panel>
      </div>
    </PageBody>
  );
}
