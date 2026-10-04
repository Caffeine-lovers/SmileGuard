import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ✅ FIX: Hard-fail if service role key is missing — no anon key fallback
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceRoleKey) {
  console.error('[PayMongo Webhook] CRITICAL: SUPABASE_SERVICE_ROLE_KEY is not set. Webhook will not be able to update billing records.');
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  serviceRoleKey || ''
);

/**
 * Verify PayMongo webhook signature using HMAC-SHA256.
 * PayMongo signs the raw request body with your webhook secret key.
 */
function verifyPayMongoSignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  // PayMongo signature header format: t=<timestamp>,te=<test_signature>,li=<live_signature>
  // We need to extract the relevant signature and verify against timestamp + body
  try {
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const testSigPart = parts.find(p => p.startsWith('te='));
    const liveSigPart = parts.find(p => p.startsWith('li='));

    if (!timestampPart) return false;
    const timestamp = timestampPart.replace('t=', '');
    
    // Use test signature in test mode, live signature in live mode
    const signatureValue = liveSigPart?.replace('li=', '') || testSigPart?.replace('te=', '');
    if (!signatureValue) return false;

    // PayMongo computes HMAC-SHA256 of: timestamp + '.' + rawBody
    const payload = `${timestamp}.${rawBody}`;
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');

    return digest === signatureValue;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!serviceRoleKey) {
    console.error('[PayMongo Webhook] SUPABASE_SERVICE_ROLE_KEY is not configured. Cannot process payment updates.');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get('paymongo-signature');

  if (!signatureHeader) {
    return NextResponse.json({ error: 'Missing paymongo-signature header' }, { status: 400 });
  }

  // Verify webhook signature
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[PayMongo Webhook] PAYMONGO_WEBHOOK_SECRET is not configured.');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const isValid = verifyPayMongoSignature(rawBody, signatureHeader, webhookSecret);
  if (!isValid) {
    console.error('[PayMongo Webhook] Invalid signature — rejecting request.');
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 403 });
  }

  try {
    const event = JSON.parse(rawBody);
    const eventType = event.data?.attributes?.type;

    console.log(`[PayMongo Webhook] Received event: ${eventType}`);

    switch (eventType) {
      case 'checkout_session.payment.paid': {
        const checkoutData = event.data?.attributes?.data;
        const metadata = checkoutData?.attributes?.metadata || {};
        const { appointment_id, patient_id, billing_id, discount_type, discount_amount, base_amount } = metadata;

        const paymentMethodUsed = checkoutData?.attributes?.payment_method_used || 'card';
        const paymentIntentId = checkoutData?.attributes?.payment_intent?.id || checkoutData?.id || '';
        const paidAmount = (checkoutData?.attributes?.payment_intent?.attributes?.amount || 0) / 100;

        console.log('[PayMongo Webhook] Payment succeeded:', {
          appointmentId: appointment_id,
          patientId: patient_id,
          billingId: billing_id,
          method: paymentMethodUsed,
          amount: paidAmount,
        });

        if (billing_id) {
          // Update existing billing record
          const { error } = await supabaseAdmin
            .from('billings')
            .update({
              payment_status: 'paid',
              payment_method: paymentMethodUsed,
              payment_date: new Date().toISOString(),
              gateway_transaction_id: paymentIntentId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', billing_id);

          if (error) {
            console.error('[PayMongo Webhook] Error updating billing:', error);
          }
        } else if (appointment_id && patient_id) {
          // Check if billing record already exists for this appointment
          const { data: existingBilling } = await supabaseAdmin
            .from('billings')
            .select('id')
            .eq('appointment_id', appointment_id)
            .eq('patient_id', patient_id)
            .maybeSingle();

          if (existingBilling) {
            // Update existing record
            const { error } = await supabaseAdmin
              .from('billings')
              .update({
                payment_status: 'paid',
                payment_method: paymentMethodUsed,
                payment_date: new Date().toISOString(),
                gateway_transaction_id: paymentIntentId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingBilling.id);

            if (error) {
              console.error('[PayMongo Webhook] Error updating existing billing:', error);
            }
          } else {
            // Create new billing record
            const parsedBaseAmount = parseFloat(base_amount) || paidAmount;
            const parsedDiscountAmount = parseFloat(discount_amount) || 0;

            const { error } = await supabaseAdmin
              .from('billings')
              .insert({
                patient_id,
                appointment_id,
                amount: parsedBaseAmount,
                discount_type: discount_type || 'none',
                discount_amount: parsedDiscountAmount,
                final_amount: paidAmount,
                payment_status: 'paid',
                payment_method: paymentMethodUsed,
                payment_date: new Date().toISOString(),
                gateway_transaction_id: paymentIntentId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

            if (error) {
              console.error('[PayMongo Webhook] Error creating billing:', error);
            }
          }
        }
        break;
      }

      case 'payment.failed': {
        const failedData = event.data?.attributes?.data;
        const metadata = failedData?.attributes?.metadata || {};
        const { billing_id } = metadata;

        console.log('[PayMongo Webhook] Payment failed:', failedData?.id);

        if (billing_id) {
          await supabaseAdmin
            .from('billings')
            .update({
              payment_status: 'pending',
              updated_at: new Date().toISOString(),
            })
            .eq('id', billing_id);
        }
        break;
      }

      default:
        console.log(`[PayMongo Webhook] Unhandled event type: ${eventType}`);
    }
  } catch (error) {
    console.error('[PayMongo Webhook] Processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  // Always return 200 quickly to acknowledge receipt
  return NextResponse.json({ received: true });
}
