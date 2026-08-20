import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEditablePage } from "@/server/pages";
import { DeleteAccountForm } from "@/components/dashboard/DeleteAccountForm";

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
    <div className="max-w-2xl">
      <h1 className="mb-6 text-lg font-semibold">Paramètres</h1>

      <section aria-labelledby="account-heading" className="mb-10">
        <h2 id="account-heading" className="mb-3 text-sm font-medium text-neutral-400">
          Compte
        </h2>
        <dl className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm">
          <div className="flex justify-between py-1.5">
            <dt className="text-neutral-500">E-mail</dt>
            <dd className="text-neutral-200">{user.email}</dd>
          </div>
          <div className="flex justify-between py-1.5">
            <dt className="text-neutral-500">Plan</dt>
            <dd className="text-neutral-200">{user.plan === "PRO" ? "Pro" : "Gratuit"}</dd>
          </div>
          <div className="flex justify-between py-1.5">
            <dt className="text-neutral-500">Inscrit le</dt>
            <dd className="text-neutral-200">
              {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(user.createdAt)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="data-heading" className="mb-10">
        <h2 id="data-heading" className="mb-1 text-sm font-medium text-neutral-400">
          Vos données
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          Téléchargez tout ce que nous conservons à votre sujet : compte, pages, liens et totaux
          de statistiques. Les statistiques sont exportées sous forme agrégée — elles décrivent
          vos visiteurs, pas vous.
        </p>
        <a
          href="/api/account/export"
          download
          className="inline-block rounded-lg border border-white/15 px-4 py-2 text-sm text-neutral-200 transition hover:bg-white/5"
        >
          Exporter mes données (JSON)
        </a>
      </section>

      <section aria-labelledby="danger-heading">
        <h2 id="danger-heading" className="mb-1 text-sm font-medium text-red-400">
          Supprimer le compte
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          Cette action est irréversible. Votre page, vos liens et vos statistiques seront
          définitivement supprimés, et le lien <code>/{page.slug}</code> sera libéré.
        </p>
        <DeleteAccountForm expected={page.slug} />
      </section>
    </div>
  );
}
