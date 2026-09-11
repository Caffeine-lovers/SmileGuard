import { NextRequest, NextResponse } from 'next/server';
import { stripe, isStripeConfigured } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured || !stripe) {
      return NextResponse.json(
        {
          error: 'Stripe card payments are not configured on this server yet. Please use Cash, GCash, or Bank Transfer.',
          unconfigured: true,
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { amount, billingId, appointmentId, patientId } = body;

    // Validate required fields
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid or missing amount' },
        { status: 400 }
      );
    }

    if (!appointmentId || !patientId) {
      return NextResponse.json(
        { error: 'Missing appointmentId or patientId' },
        { status: 400 }
      );
    }

    // Stripe expects amount in smallest currency unit (centavos for PHP)
    const amountInCentavos = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCentavos,
      currency: 'php',
      payment_method_types: ['card'],
      metadata: {
        billingId: billingId || '',
        appointmentId,
        patientId,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
