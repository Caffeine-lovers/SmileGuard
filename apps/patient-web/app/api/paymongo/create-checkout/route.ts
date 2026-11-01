import { NextRequest, NextResponse } from 'next/server';
import { isPayMongoConfigured, getPayMongoAuthHeader, PAYMONGO_API_BASE } from '@/lib/paymongo';
import { getAuthedUserId, getServiceClient, getUserClient } from '@/lib/serverSupabase';
import { computeCheckoutTotal, resolveBaseAmount, type ClinicService } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function POST(request: NextRequest) {
  try {
    if (!isPayMongoConfigured) {
      return NextResponse.json(
        { error: 'PayMongo payments are not configured on this server yet.', unconfigured: true },
        { status: 503 }
      );
    }

    const authHeader = request.headers.get('authorization');
    const patientId = await getAuthedUserId(authHeader);
    if (!patientId) {
      return NextResponse.json({ error: 'Please sign in again before paying.' }, { status: 401 });
    }

    const supabase = getServiceClient() || getUserClient(authHeader);
    if (!supabase) {
      return NextResponse.json({ error: 'Database service configuration error' }, { status: 500 });
    }

    const body = await request.json();
    const { appointmentId, discountType } = body as { appointmentId?: string; discountType?: string };
    if (!appointmentId) {
      return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 });
    }

    // The appointment must belong to the signed-in patient
    const { data: appointment } = await supabase
      .from('appointments')
      .select('id, service, dentist_id, status')
      .eq('id', appointmentId)
      .eq('patient_id', patientId)
      .maybeSingle();

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found for this account.' }, { status: 404 });
    }

    // Clinic name + price list for this appointment's doctor
    let clinicName = "Kyler's Clinic";
    let clinicServices: ClinicService[] = [];
    let clinicQuery = supabase.from('clinic_setup').select('clinic_name, services');
    clinicQuery = appointment.dentist_id ? clinicQuery.eq('user_id', appointment.dentist_id) : clinicQuery.limit(1);
    const { data: clinicData } = await clinicQuery.maybeSingle();
    if (clinicData) {
      if (clinicData.clinic_name) clinicName = clinicData.clinic_name;
      if (Array.isArray(clinicData.services)) clinicServices = clinicData.services;
      else if (typeof clinicData.services === 'string') {
        try {
          clinicServices = JSON.parse(clinicData.services);
        } catch {}
      }
    }

    // The billing row is the source of truth for what is owed (same as the billing page shows)
    const { data: billingRows } = await supabase
      .from('billings')
      .select('id, amount, final_amount, payment_status, created_at')
      .eq('appointment_id', appointmentId)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    const billings = billingRows || [];
    if (billings.some((b) => b.payment_status === 'paid')) {
      return NextResponse.json({ error: 'This appointment has already been paid.' }, { status: 409 });
    }
    const billing = billings.find((b) => b.payment_status !== 'cancelled') || null;

    const serviceName = appointment.service || 'Dental Procedure';
    const baseAmount = resolveBaseAmount(billing, serviceName, clinicServices);

    // Statutory discount only when the doctor approved the patient's PWD/Senior ID
    let pwdStatus: string | null = null;
    if (discountType === 'pwd' || discountType === 'senior') {
      const { data: profile } = await supabase.from('profiles').select('pwd_status').eq('id', patientId).maybeSingle();
      pwdStatus = profile?.pwd_status ?? null;
      if (pwdStatus !== 'approved') {
        console.warn(`[PayMongo] Patient ${patientId} not approved for ${discountType}. Charging standard rate.`);
      }
    }
    const total = computeCheckoutTotal(baseAmount, discountType, pwdStatus);
    const amountInCentavos = Math.round(total.finalAmount * 100);

    // PayMongo line items can't be negative, so surface the statutory discount in the label
    const discountLabel =
      total.discountAmount > 0
        ? ` (${total.discountType === 'senior' ? 'Senior Citizen' : 'PWD'} 20% off ${peso(total.baseAmount)})`
        : '';

    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      (forwardedHost && !forwardedHost.includes('localhost') ? `${forwardedProto}://${forwardedHost}` : null) ||
      'http://localhost:3000';

    const paymongoResponse = await fetch(`${PAYMONGO_API_BASE}/checkout_sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: getPayMongoAuthHeader() },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                name: `${serviceName} • ${clinicName}${discountLabel}`,
                amount: amountInCentavos,
                currency: 'PHP',
                quantity: 1,
              },
            ],
            payment_method_types: ['card', 'gcash', 'grab_pay', 'paymaya'],
            success_url: `${appUrl}/billing?status=success&apt=${appointmentId}`,
            cancel_url: `${appUrl}/billing/cancelled`,
            metadata: {
              appointment_id: appointmentId,
              patient_id: patientId,
              clinic_name: clinicName,
              service: serviceName,
              billing_id: billing?.id || '',
              discount_type: total.discountType,
              discount_amount: String(total.discountAmount),
              base_amount: String(total.baseAmount),
            },
            description:
              total.discountAmount > 0
                ? `SmileGuard - ${serviceName} (${clinicName}) • ${peso(total.baseAmount)} less ${peso(total.discountAmount)} statutory discount = ${peso(total.finalAmount)}`
                : `SmileGuard - ${serviceName} (${clinicName})`,
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

    return NextResponse.json({
      checkoutUrl: paymongoData.data.attributes.checkout_url,
      checkoutId: paymongoData.data.id,
      baseAmount: total.baseAmount,
      amount: total.finalAmount,
      discountAmount: total.discountAmount,
      discountType: total.discountType,
      clinicName,
    });
  } catch (error) {
    console.error('Error creating PayMongo checkout:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
