import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEditablePage } from "@/server/pages";
import { getDomain } from "@/server/domains";
import { TXT_RECORD_NAME } from "@/lib/domains";
import { DomainForm } from "@/components/dashboard/DomainForm";
import { can } from "@/lib/plans";
import { PageHeader, PageBody } from "@/components/ui/Panel";

export const metadata = { title: "Domaine personnalisé" };

export default async function DomainPage() {
  const session = await auth();
  const [page, user] = await Promise.all([
    getEditablePage(session!.user.id),
    prisma.user.findUnique({ where: { id: session!.user.id }, select: { plan: true } }),
  ]);

  if (!page) redirect("/login");

  const plan = user?.plan ?? "FREE";
  const domain = await getDomain(page.id);

  return (
    <PageBody>
      <PageHeader
        title="Domaine personnalisé"
        description={
          <>
            Servez votre page depuis votre propre nom de domaine, par exemple{" "}
            <code>liens.mon-site.fr</code>.
          </>
        }
      />

      {can(plan, "canUseCustomDomain") ? (
        <DomainForm
          txtRecordName={TXT_RECORD_NAME}
          domain={
            domain
              ? {
                  hostname: domain.hostname,
                  token: domain.verificationToken,
                  verified: domain.verifiedAt !== null,
                }
              : null
          }
        />
      ) : (
        <p className="rounded-xl bg-ink-880 p-4 text-sm text-ink-300 ring-1 ring-inset ring-white/7">
          Le domaine personnalisé fait partie du plan Pro.{" "}
          <Link
            href="/dashboard/billing"
            className="text-accent-400 underline-offset-4 hover:underline"
          >
            Voir les plans
          </Link>
        </p>
      )}
    </PageBody>
  );
}
