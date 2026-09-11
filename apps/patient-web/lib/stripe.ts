import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

export const isStripeConfigured = Boolean(
  secretKey && secretKey.length > 5 && (secretKey.startsWith('sk_') || secretKey.startsWith('rk_'))
);

export const stripe = secretKey
  ? new Stripe(secretKey, {
      typescript: true,
    })
  : (null as unknown as Stripe);

export function getStripeServer(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. STRIPE_SECRET_KEY is missing from environment variables.');
  }
  return stripe;
}
