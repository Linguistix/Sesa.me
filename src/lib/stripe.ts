import Stripe from "stripe";

/**
 * Stripe is optional at build and dev time.
 *
 * A contributor without keys should still be able to run the app and the test
 * suite; billing simply reports itself as unavailable. Returning null rather
 * than throwing at import time is what makes that possible — a module-level
 * `new Stripe(process.env.STRIPE_SECRET_KEY!)` would break every page.
 */
let cached: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  cached = key ? new Stripe(key) : null;
  return cached;
}

export function isBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

export const PRO_PRICE_ID = () => process.env.STRIPE_PRICE_ID ?? "";
