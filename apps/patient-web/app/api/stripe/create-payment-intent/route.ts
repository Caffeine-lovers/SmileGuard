import { NextResponse } from 'next/server';
import { supabase } from '@smileguard/supabase-client';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      patientId,
      appointmentId,
      amount,
      finalAmount,
      discountType = 'none',
      discountAmount = 0,
      currency = 'php',
    } = body;

    if (!patientId || typeof finalAmount !== 'number' || finalAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment parameters: patientId and positive finalAmount are required' },
        { status: 400 }
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    // Check if Stripe API Key is set in environment
    if (!stripeSecretKey || stripeSecretKey.includes('your_stripe_secret_key')) {
      // Create a pending billing record in Supabase (Simulated / Dev mode)
      const mockPaymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const mockClientSecret = `${mockPaymentIntentId}_secret_mock`;

      const { data: billing, error: dbError } = await supabase
        .from('billings')
        .insert({
          patient_id: patientId,
          appointment_id: appointmentId || null,
          amount,
          discount_type: discountType,
          discount_amount: discountAmount,
          final_amount: finalAmount,
          payment_status: 'pending',
          payment_method: 'card',
          stripe_payment_intent_id: mockPaymentIntentId,
          stripe_client_secret: mockClientSecret,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (dbError) {
        console.error('Error inserting pending billing record:', dbError);
      }

      return NextResponse.json({
        success: true,
        isDevMode: true,
        clientSecret: mockClientSecret,
        paymentIntentId: mockPaymentIntentId,
        billingId: billing?.id || `mock_billing_${Date.now()}`,
        message: 'Stripe API key not configured. Generated mock payment intent for development.',
      });
    }

    // Live / Sandbox Stripe API Request via REST API to avoid hard npm dependency
    const stripeParams = new URLSearchParams();
    stripeParams.append('amount', Math.round(finalAmount * 100).toString()); // Amount in cents/centavos
    stripeParams.append('currency', currency.toLowerCase());
    stripeParams.append('payment_method_types[]', 'card');
    stripeParams.append('metadata[patient_id]', patientId);
    if (appointmentId) stripeParams.append('metadata[appointment_id]', appointmentId);

    const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: stripeParams.toString(),
    });

    const stripeData = await stripeRes.json();

    if (!stripeRes.ok) {
      return NextResponse.json(
        { error: stripeData.error?.message || 'Failed to create Stripe PaymentIntent' },
        { status: 500 }
      );
    }

    // Insert pending billing into Supabase database
    const { data: billing, error: dbError } = await supabase
      .from('billings')
      .insert({
        patient_id: patientId,
        appointment_id: appointmentId || null,
        amount,
        discount_type: discountType,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        payment_status: 'pending',
        payment_method: 'card',
        stripe_payment_intent_id: stripeData.id,
        stripe_client_secret: stripeData.client_secret,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (dbError) {
      console.error('Database error storing billing:', dbError);
    }

    return NextResponse.json({
      success: true,
      clientSecret: stripeData.client_secret,
      paymentIntentId: stripeData.id,
      billingId: billing?.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    console.error('Error creating payment intent:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
