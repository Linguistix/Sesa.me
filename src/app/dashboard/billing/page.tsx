import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSubscription } from "@/server/billing";
import { isBillingConfigured } from "@/lib/stripe";
import { PLAN_LIMITS } from "@/lib/plans";
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
    <>
      <h1 className="mb-6 text-lg font-semibold">Abonnement</h1>

      {status && STATUS_MESSAGE[status] ? (
        <p
          role="status"
          className="mb-6 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-200"
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
        <p className="mt-6 text-sm text-neutral-500">
          Pour activer la facturation, renseignez <code>STRIPE_SECRET_KEY</code>,{" "}
          <code>STRIPE_PRICE_ID</code> et <code>STRIPE_WEBHOOK_SECRET</code> — voir{" "}
          <code>.env.example</code>.
        </p>
      ) : null}

      {subscription?.currentPeriodEnd ? (
        <p className="mt-6 text-sm text-neutral-500">
          {subscription.cancelAtPeriodEnd
            ? `Votre abonnement prend fin le ${formatDate(subscription.currentPeriodEnd)}.`
            : `Prochain renouvellement le ${formatDate(subscription.currentPeriodEnd)}.`}
        </p>
      ) : null}
    </>
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
    <section
      className={[
        "flex flex-col rounded-xl border p-5",
        highlighted ? "border-indigo-500/40 bg-indigo-500/[0.06]" : "border-white/10 bg-white/[0.02]",
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{name}</h2>
        {current ? (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-300">
            Plan actuel
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-2xl font-semibold tracking-tight">{price}</p>

      <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-neutral-300">
        {features.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden className="text-indigo-400">
              ✓
            </span>
            {f}
          </li>
        ))}
      </ul>

      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

function SubmitButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
}
