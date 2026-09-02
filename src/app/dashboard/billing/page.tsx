import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSubscription } from "@/server/billing";
import { isBillingConfigured } from "@/lib/stripe";
import { PLAN_LIMITS } from "@/lib/plans";
import { PageHeader, PageBody, Panel, Badge } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { openPortalAction, startCheckoutAction } from "@/actions/billing";

export const metadata = { title: "Abonnement" };

const STATUS_MESSAGE: Record<string, string> = {
  success: "Merci ! Votre abonnement est actif.",
  cancelled: "Paiement annulé — vous êtes toujours sur le plan Gratuit.",
  unavailable: "La facturation n'est pas configurée sur cette instance.",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { plan: true },
  });
  const subscription = await getSubscription(session!.user.id);
  const configured = isBillingConfigured();
  const isPro = user?.plan === "PRO";

  return (
    <PageBody>
      <PageHeader
        title="Abonnement"
        description="Deux plans. Vous pouvez changer ou arrêter à tout moment."
      />

      {status && STATUS_MESSAGE[status] ? (
        <p
          role="status"
          className="mb-5 rounded-lg bg-accent-500/[0.07] px-4 py-3 text-sm text-ink-100 ring-1 ring-inset ring-accent-400/25"
        >
          {STATUS_MESSAGE[status]}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <PlanCard
          name="Gratuit"
          price="0 €"
          current={!isPro}
          features={[
            "Page publique et liens illimités",
            "Thèmes préconçus et QR code",
            `${PLAN_LIMITS.FREE.aiGenerationsPerMonth} générations IA par mois`,
            `Analytics sur ${PLAN_LIMITS.FREE.analyticsRetentionDays} jours`,
            "Mention « Propulsé par Sesame »",
          ]}
        />

        <PlanCard
          name="Pro"
          price="7 €/mois"
          current={isPro}
          highlighted
          features={[
            "Sans branding Sesame",
            "Domaine personnalisé",
            "Générations IA illimitées",
            `Analytics sur ${PLAN_LIMITS.PRO.analyticsRetentionDays} jours + export CSV`,
            "Badge vérifié et avatar animé",
          ]}
          action={
            isPro ? (
              <form action={openPortalAction}>
                <SubmitButton disabled={!configured}>Gérer mon abonnement</SubmitButton>
              </form>
            ) : (
              <form action={startCheckoutAction}>
                <SubmitButton disabled={!configured}>Passer à Pro</SubmitButton>
              </form>
            )
          }
        />
      </div>

      {!configured ? (
        <p className="mt-6 text-sm text-ink-400">
          Pour activer la facturation, renseignez <code>STRIPE_SECRET_KEY</code>,{" "}
          <code>STRIPE_PRICE_ID</code> et <code>STRIPE_WEBHOOK_SECRET</code> — voir{" "}
          <code>.env.example</code>.
        </p>
      ) : null}

      {subscription?.currentPeriodEnd ? (
        <p className="mt-6 text-sm text-ink-400">
          {subscription.cancelAtPeriodEnd
            ? `Votre abonnement prend fin le ${formatDate(subscription.currentPeriodEnd)}.`
            : `Prochain renouvellement le ${formatDate(subscription.currentPeriodEnd)}.`}
        </p>
      ) : null}
    </PageBody>
  );
}

function PlanCard({
  name,
  price,
  features,
  current,
  highlighted = false,
  action,
}: {
  name: string;
  price: string;
  features: string[];
  current: boolean;
  highlighted?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <Panel
      as="section"
      className={`flex flex-col p-5 ${highlighted ? "ring-accent-400/30" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-md font-semibold text-ink-50">{name}</h2>
        {current ? <Badge>Plan actuel</Badge> : null}
      </div>

      <p className="mt-1.5 text-3xl font-semibold tracking-tight text-ink-50">{price}</p>

      <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-base text-ink-200">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span aria-hidden className="mt-0.5 text-accent-400">
              ✓
            </span>
            <span className="min-w-0">{f}</span>
          </li>
        ))}
      </ul>

      {action ? <div className="mt-6">{action}</div> : null}
    </Panel>
  );
}

function SubmitButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <Button type="submit" variant="primary" disabled={disabled} className="w-full">
      {children}
    </Button>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
}
