import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isPayMongoConfigured, getPayMongoAuthHeader, PAYMONGO_API_BASE } from '@/lib/paymongo';

// Use service-role client (no user auth context during API route)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Service prices — authoritative server-side source of truth
// This prevents the FIN-01 client-side price tampering vulnerability
const SERVICE_PRICES: Record<string, number> = {
  Cleaning: 1500,
  Whitening: 5000,
  Fillings: 2000,
  'Root Canal': 8000,
  Extraction: 1500,
  'Braces Consultation': 35000,
  'Implants Consultation': 45000,
  'X-Ray': 500,
  'Check-up': 300,
};

export async function POST(request: NextRequest) {
  try {
    if (!isPayMongoConfigured) {
      return NextResponse.json(
        {
          error: 'PayMongo payments are not configured on this server yet. Please use Cash or Bank Transfer.',
          unconfigured: true,
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { appointmentId, patientId, discountType, billingId } = body;

    // Validate required fields
    if (!appointmentId || !patientId) {
      return NextResponse.json(
        { error: 'Missing appointmentId or patientId' },
        { status: 400 }
      );
    }

    // ✅ FIX FIN-01: Server-side amount calculation from database
    // Never trust client-submitted amounts
    const { data: appointment, error: aptError } = await supabaseAdmin
      .from('appointments')
      .select('service, status')
      .eq('id', appointmentId)
      .eq('patient_id', patientId)
      .single();

    if (aptError || !appointment) {
      return NextResponse.json(
        { error: 'Appointment not found or does not belong to this patient' },
        { status: 404 }
      );
    }

    const baseAmount = SERVICE_PRICES[appointment.service] || 0;
    if (baseAmount <= 0) {
      return NextResponse.json(
        { error: `No price configured for service: ${appointment.service}` },
        { status: 400 }
      );
    }

    // Apply statutory discount server-side
    let finalAmount = baseAmount;
    let discountAmount = 0;
    if (discountType === 'pwd' || discountType === 'senior') {
      discountAmount = baseAmount * 0.2; // 20% statutory discount (RA 9994 / RA 10754)
      finalAmount = baseAmount - discountAmount;
    }

    const amountInCentavos = Math.round(finalAmount * 100);

    // Create PayMongo Checkout Session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const paymongoResponse = await fetch(`${PAYMONGO_API_BASE}/checkout_sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getPayMongoAuthHeader(),
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                name: `Dental Procedure: ${appointment.service}`,
                amount: amountInCentavos,
                currency: 'PHP',
                quantity: 1,
              },
            ],
            payment_method_types: ['card', 'gcash', 'grab_pay', 'paymaya'],
            success_url: `${appUrl}/billing?status=success&apt=${appointmentId}`,
            cancel_url: `${appUrl}/billing?status=cancelled`,
            metadata: {
              appointment_id: appointmentId,
              patient_id: patientId,
              billing_id: billingId || '',
              discount_type: discountType || 'none',
              discount_amount: String(discountAmount),
              base_amount: String(baseAmount),
            },
            description: `SmileGuard - ${appointment.service} (Ivy King Dental Clinic)`,
          },
        },
      }),
    });

    const paymongoData = await paymongoResponse.json();

    if (!paymongoResponse.ok) {
      console.error('[PayMongo] Checkout session creation failed:', paymongoData);
      const errorMsg = paymongoData?.errors?.[0]?.detail || 'Failed to create checkout session';
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    const checkoutUrl = paymongoData.data.attributes.checkout_url;
    const checkoutId = paymongoData.data.id;

    return NextResponse.json({
      checkoutUrl,
      checkoutId,
      amount: finalAmount,
      discountAmount,
    });
  } catch (error) {
    console.error('Error creating PayMongo checkout:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
