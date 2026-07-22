import { NextResponse } from 'next/server';
import { supabase } from '@smileguard/supabase-client';

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    const _signature = request.headers.get('stripe-signature');
    const _webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Process event types
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const paymentIntentId = paymentIntent.id;

        // Update corresponding billing status in Supabase
        const { error } = await supabase
          .from('billings')
          .update({
            payment_status: 'paid',
            payment_date: new Date().toISOString(),
          })
          .eq('stripe_payment_intent_id', paymentIntentId);

        if (error) {
          console.error('[Stripe Webhook] Error updating billing status to paid:', error);
          return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
        }

        console.log(`[Stripe Webhook] PaymentIntent ${paymentIntentId} marked as paid`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const paymentIntentId = paymentIntent.id;

        const { error } = await supabase
          .from('billings')
          .update({
            payment_status: 'pending',
          })
          .eq('stripe_payment_intent_id', paymentIntentId);

        if (error) {
          console.error('[Stripe Webhook] Error updating failed payment status:', error);
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handler error';
    console.error('[Stripe Webhook Error]:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
