import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Use service-role client for webhook (no user auth context)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    console.error('Webhook signature error:', message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { billingId, appointmentId, patientId } = paymentIntent.metadata;

        console.log('[Stripe Webhook] Payment succeeded:', paymentIntent.id, { billingId, appointmentId });

        if (billingId) {
          // Update existing billing record
          const { error } = await supabaseAdmin
            .from('billings')
            .update({
              payment_status: 'paid',
              payment_method: 'card',
              payment_date: new Date().toISOString(),
              stripe_payment_intent_id: paymentIntent.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', billingId);

          if (error) {
            console.error('[Stripe Webhook] Error updating billing:', error);
          }
        } else if (appointmentId && patientId) {
          // Create new billing record if one wasn't pre-created
          const amountInPesos = paymentIntent.amount / 100;
          const { error } = await supabaseAdmin
            .from('billings')
            .insert({
              patient_id: patientId,
              appointment_id: appointmentId,
              amount: amountInPesos,
              discount_type: 'none',
              discount_amount: 0,
              final_amount: amountInPesos,
              payment_status: 'paid',
              payment_method: 'card',
              payment_date: new Date().toISOString(),
              stripe_payment_intent_id: paymentIntent.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (error) {
            console.error('[Stripe Webhook] Error creating billing:', error);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const { billingId } = paymentIntent.metadata;

        console.log('[Stripe Webhook] Payment failed:', paymentIntent.id);

        if (billingId) {
          await supabaseAdmin
            .from('billings')
            .update({
              payment_status: 'pending',
              updated_at: new Date().toISOString(),
            })
            .eq('id', billingId);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error('[Stripe Webhook] Processing error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
