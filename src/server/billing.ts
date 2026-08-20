import "server-only";
import { prisma } from "@/lib/db";
import { getStripe, PRO_PRICE_ID } from "@/lib/stripe";
import { appUrl } from "@/lib/urls";
import type { SubscriptionStatus } from "@/generated/prisma/enums";

/** Stripe statuses that entitle a user to Pro. */
const ENTITLING: SubscriptionStatus[] = ["ACTIVE", "TRIALING"];

/**
 * Maps Stripe's status vocabulary onto ours.
 *
 * Anything unrecognised maps to INCOMPLETE rather than throwing: Stripe adds
 * statuses over time, and an unknown one must not wedge the webhook.
 */
export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    default:
      return "INCOMPLETE";
  }
}

export function entitlesToPro(status: SubscriptionStatus): boolean {
  return ENTITLING.includes(status);
}

/**
 * Creates a Checkout session for the Pro plan.
 *
 * The user's Stripe customer is created once and reused, so a user who
 * subscribes, cancels and resubscribes keeps one billing history.
 */
export async function createCheckoutSession(userId: string) {
  const stripe = getStripe();
  if (!stripe || !PRO_PRICE_ID()) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, subscription: { select: { stripeCustomerId: true } } },
  });
  if (!user) return null;

  let customerId = user.subscription?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: PRO_PRICE_ID(), quantity: 1 }],
    success_url: appUrl("/dashboard/billing?status=success"),
    cancel_url: appUrl("/dashboard/billing?status=cancelled"),
    // Echoed back on the webhook so we can find the user without a lookup
    // that depends on the customer record still existing.
    subscription_data: { metadata: { userId: user.id } },
    metadata: { userId: user.id },
  });

  return session.url;
}

/** A link into Stripe's hosted portal, where the user manages or cancels. */
export async function createPortalSession(userId: string) {
  const stripe = getStripe();
  if (!stripe) return null;

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  });
  if (!subscription) return null;

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: appUrl("/dashboard/billing"),
  });

  return session.url;
}

/**
 * Applies a subscription state change.
 *
 * Idempotent by construction — an upsert keyed on the user plus a derived plan
 * value — because Stripe retries webhooks and may deliver them out of order.
 */
export async function applySubscriptionState(params: {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}) {
  const plan = entitlesToPro(params.status) ? "PRO" : "FREE";

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId: params.userId },
      create: {
        userId: params.userId,
        stripeCustomerId: params.stripeCustomerId,
        stripeSubscriptionId: params.stripeSubscriptionId,
        status: params.status,
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      },
      update: {
        stripeCustomerId: params.stripeCustomerId,
        stripeSubscriptionId: params.stripeSubscriptionId,
        status: params.status,
        currentPeriodEnd: params.currentPeriodEnd,
        cancelAtPeriodEnd: params.cancelAtPeriodEnd,
      },
    }),
    // `User.plan` is what the rest of the app reads, so it is updated in the
    // same transaction as the subscription that justifies it.
    prisma.user.update({ where: { id: params.userId }, data: { plan } }),
  ]);
}

export async function getSubscription(userId: string) {
  return prisma.subscription.findUnique({ where: { userId } });
}
