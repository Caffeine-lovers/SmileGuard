import { NextRequest, NextResponse } from 'next/server';
import { getPayMongoAuthHeader, isPayMongoConfigured, PAYMONGO_API_BASE } from '@/lib/paymongo';
import { getAuthedUserId, getServiceClient } from '@/lib/serverSupabase';
import {
  findPaidPaymentForAppointment,
  isPayMongoReference,
  resolvePaymentFromResource,
  validatePaymentForAppointment,
  type ResolvedPayment,
} from '@/lib/paymongoVerification';

export const dynamic = 'force-dynamic';

/**
 * Settles a bill after a PayMongo payment.
 *
 * A bill is only marked paid when ALL of these hold:
 *  - the caller is signed in (patient id comes from their JWT, never the request body)
 *  - PayMongo itself reports the payment as `paid`
 *  - the payment's metadata names this patient and this appointment
 *  - the payment reference hasn't already been used to settle a different bill
 * The amount recorded is the amount PayMongo actually captured.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isPayMongoConfigured) {
      return NextResponse.json({ error: 'PayMongo payments are not configured on this server yet.' }, { status: 503 });
    }

    const authHeader = request.headers.get('authorization');
    const patientId = await getAuthedUserId(authHeader);
    if (!patientId) {
      return NextResponse.json({ error: 'Please sign in again to confirm your payment.' }, { status: 401 });
    }

    // Writing a "paid" status is a privileged operation; patients can't do it through RLS.
    const admin = getServiceClient();
    if (!admin) {
      console.error('[Confirm Checkout] SUPABASE_SERVICE_ROLE_KEY is not configured.');
      return NextResponse.json(
        { error: 'Payment confirmation is temporarily unavailable. Your payment is safe — the clinic will reconcile it.' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const appointmentId: string | undefined = body.appointmentId || undefined;
    const paymentRef: string | undefined = typeof body.paymentRef === 'string' ? body.paymentRef.trim() : undefined;

    if (paymentRef && !isPayMongoReference(paymentRef)) {
      return NextResponse.json(
        { error: 'That does not look like a PayMongo reference. It should start with "pay_" or "cs_".' },
        { status: 400 }
      );
    }
    if (!paymentRef && !appointmentId) {
      return NextResponse.json({ error: 'Provide a PayMongo reference or an appointment.' }, { status: 400 });
    }

    // 1. Ask PayMongo what actually happened
    const headers = { Authorization: getPayMongoAuthHeader() };
    let payment: ResolvedPayment | null = null;

    if (paymentRef) {
      const url = paymentRef.startsWith('pay_')
        ? `${PAYMONGO_API_BASE}/payments/${paymentRef}`
        : `${PAYMONGO_API_BASE}/checkout_sessions/${paymentRef}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        payment = resolvePaymentFromResource((await res.json()).data);
      } else if (res.status !== 404) {
        console.error('[Confirm Checkout] PayMongo lookup failed:', res.status);
        return NextResponse.json({ error: 'Could not reach PayMongo. Please try again shortly.' }, { status: 502 });
      }
    } else if (appointmentId) {
      const res = await fetch(`${PAYMONGO_API_BASE}/payments?limit=100`, { headers });
      if (!res.ok) {
        return NextResponse.json({ error: 'Could not reach PayMongo. Please try again shortly.' }, { status: 502 });
      }
      payment = findPaidPaymentForAppointment((await res.json()).data || [], appointmentId);
    }

    const verdict = validatePaymentForAppointment(payment, { patientId, appointmentId });
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.reason }, { status: verdict.status });
    }
    const verified = verdict.payment;
    const targetAppointmentId = verdict.appointmentId;

    // 2. The appointment must belong to this patient
    const { data: appointment } = await admin
      .from('appointments')
      .select('id')
      .eq('id', targetAppointmentId)
      .eq('patient_id', patientId)
      .maybeSingle();
    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found for this account.' }, { status: 404 });
    }

    // 3. A payment reference can settle exactly one bill
    const { data: reused } = await admin
      .from('billings')
      .select('id, appointment_id')
      .eq('gateway_transaction_id', verified.paymentId)
      .neq('appointment_id', targetAppointmentId)
      .limit(1);
    if (reused && reused.length > 0) {
      return NextResponse.json({ error: 'This payment reference was already used for another bill.' }, { status: 409 });
    }

    // 4. Record the verified payment (idempotent for the same reference)
    const { data: rpcRows, error: rpcErr } = await admin.rpc('confirm_billing_payment', {
      p_appointment_id: targetAppointmentId,
      p_patient_id: patientId,
      p_amount: verified.amount,
      p_reference_id: verified.paymentId,
      p_payment_method: verified.method,
    });
    if (rpcErr) {
      console.error('[Confirm Checkout] confirm_billing_payment failed:', rpcErr.message);
      return NextResponse.json({ error: 'Payment verified, but saving it failed. Please contact the clinic.' }, { status: 500 });
    }
    const billing = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;

    return NextResponse.json({
      success: true,
      billing,
      referenceId: verified.paymentId,
      amount: verified.amount,
      paymentMethod: verified.method,
      appointmentId: targetAppointmentId,
    });
  } catch (error) {
    console.error('[Confirm Checkout] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
