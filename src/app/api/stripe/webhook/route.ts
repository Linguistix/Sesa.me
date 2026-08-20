import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { applySubscriptionState, mapStripeStatus } from "@/server/billing";
import { prisma } from "@/lib/db";

/**
 * Stripe subscription webhook.
 *
 * The signature check is the authorisation boundary: without it, anyone who
 * learns this URL could grant themselves Pro by posting a JSON body. The raw
 * request body is required to verify it, which is why this reads `text()` and
 * never `json()` — any reserialisation changes the bytes and breaks the HMAC.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !secret) {
    return NextResponse.json({ error: "Billing not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch (error) {
    console.error("[stripe] signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    await handleEvent(stripe, event);
  } catch (error) {
    // A 500 tells Stripe to retry, which is what we want for a transient
    // database failure. Handlers are idempotent, so a replay is safe.
    console.error(`[stripe] handler failed for ${event.type}`, error);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(stripe: Stripe, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription" || !session.subscription) return;

      // The session carries only ids; fetch the subscription for its real
      // status rather than assuming "active" — a card can still fail here.
      const subscription = await stripe.subscriptions.retrieve(
        typeof session.subscription === "string" ? session.subscription : session.subscription.id,
      );
      await syncSubscription(subscription);
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object);
      return;
    }

    default:
      // Everything else is acknowledged and ignored; Stripe sends far more
      // event types than this app cares about.
      return;
  }
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = await resolveUserId(subscription);
  if (!userId) {
    console.warn(`[stripe] no user for subscription ${subscription.id}`);
    return;
  }

  await applySubscriptionState({
    userId,
    stripeCustomerId:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    // A deletion event can still report "active"; the event type is the
    // authority on whether the subscription is over.
    status:
      subscription.status === "canceled" || subscription.ended_at
        ? "CANCELED"
        : mapStripeStatus(subscription.status),
    currentPeriodEnd: periodEnd(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
  });
}

/**
 * Finds the local user for a Stripe subscription.
 *
 * Prefers the metadata we set at checkout, and falls back to the stored
 * customer id so subscriptions created directly in the Stripe dashboard (or
 * before metadata existed) still resolve.
 */
async function resolveUserId(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.userId;
  if (fromMetadata) {
    const user = await prisma.user.findUnique({
      where: { id: fromMetadata },
      select: { id: true },
    });
    if (user) return user.id;
  }

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const existing = await prisma.subscription.findUnique({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });

  return existing?.userId ?? null;
}

/**
 * Reads the period end, which Stripe moved from the subscription onto its
 * items. Checks both so the handler works across API versions.
 */
function periodEnd(subscription: Stripe.Subscription): Date | null {
  const withLegacy = subscription as Stripe.Subscription & { current_period_end?: number };
  const seconds = withLegacy.current_period_end ?? subscription.items?.data?.[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000) : null;
}
