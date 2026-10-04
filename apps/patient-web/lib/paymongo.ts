/**
 * PayMongo Payment Gateway Configuration
 * BSP-Licensed Philippine Payment Facilitator
 * Supports: Card, GCash, Maya, GrabPay, QR Ph
 */

const secretKey = process.env.PAYMONGO_SECRET_KEY;
const publicKey = process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY;

export const isPayMongoConfigured = Boolean(
  secretKey && secretKey.length > 5 && (secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_'))
);

/**
 * Base64-encoded Basic Auth header for PayMongo API calls.
 * PayMongo uses HTTP Basic Auth with the secret key as the username
 * and an empty password.
 */
export function getPayMongoAuthHeader(): string {
  if (!secretKey) {
    throw new Error('PayMongo is not configured. PAYMONGO_SECRET_KEY is missing from environment variables.');
  }
  return `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;
}

export const PAYMONGO_API_BASE = 'https://api.paymongo.com/v1';

export { publicKey as paymongoPublicKey };
