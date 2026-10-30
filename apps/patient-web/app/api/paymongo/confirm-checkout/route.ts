import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceRoleKey && supabaseUrl) {
    return createClient(supabaseUrl, serviceRoleKey);
  }
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey && supabaseUrl) {
    return createClient(supabaseUrl, anonKey);
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('[Confirm Checkout] Supabase admin client misconfigured');
      return NextResponse.json({ error: 'Database service configuration error' }, { status: 500 });
    }

    const body = await request.json();
    const { appointmentId, patientId, paymentMethod = 'card' } = body;

    if (!appointmentId) {
      return NextResponse.json({ error: 'Missing appointmentId' }, { status: 400 });
    }

    // 1. Check for existing billing row for this appointment
    const { data: existingRows, error: fetchErr } = await supabaseAdmin
      .from('billings')
      .select('*')
      .eq('appointment_id', appointmentId);

    if (fetchErr) {
      console.warn('[Confirm Checkout] Error querying billings table:', fetchErr.message);
    }

    const rows = existingRows || [];
    let updatedBilling: any = null;

    if (rows.length > 0) {
      // Find the active/pending/not_paid row or latest
      const targetRow = rows.find((r) => r.payment_status !== 'paid') || rows[0];

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('billings')
        .update({
          payment_status: 'paid',
          payment_method: paymentMethod,
          payment_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetRow.id)
        .select()
        .single();

      if (updateErr) {
        console.error('[Confirm Checkout] Failed to update billing status:', updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
      updatedBilling = updated;
    } else {
      // 2. No billing row existed yet (e.g. appointment before trigger was active)
      // Look up appointment details
      const { data: apt } = await supabaseAdmin
        .from('appointments')
        .select('service, patient_id')
        .eq('id', appointmentId)
        .maybeSingle();

      const effectivePatientId = patientId || apt?.patient_id;
      const serviceName = apt?.service || 'Dental Procedure';

      // Fallback service price
      const servicePrices: Record<string, number> = {
        whitening: 5000,
        filling: 2000,
        fillings: 2000,
        'root canal': 8000,
        extraction: 1500,
        cleaning: 1500,
        aligners: 25000,
        braces: 35000,
        implants: 45000,
        'x-ray': 500,
        'check-up': 300,
      };
      const norm = serviceName.trim().toLowerCase();
      let price = 1500;
      for (const [k, p] of Object.entries(servicePrices)) {
        if (norm.includes(k)) {
          price = p;
          break;
        }
      }

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('billings')
        .insert({
          patient_id: effectivePatientId,
          appointment_id: appointmentId,
          amount: price,
          discount_type: 'none',
          discount_amount: 0,
          final_amount: price,
          payment_status: 'paid',
          payment_method: paymentMethod,
          payment_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertErr) {
        console.error('[Confirm Checkout] Failed to insert paid billing record:', insertErr);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
      updatedBilling = inserted;
    }

    // 3. Insert notification for patient
    if (updatedBilling?.patient_id) {
      try {
        await supabaseAdmin.from('notifications').insert({
          user_id: updatedBilling.patient_id,
          title: 'Payment Confirmed',
          message: `Payment of ₱${Number(updatedBilling.final_amount ?? updatedBilling.amount ?? 0).toFixed(2)} received. Your appointment is confirmed paid.`,
          type: 'billing_paid',
          metadata: {
            appointment_id: appointmentId,
            billing_id: updatedBilling.id,
            amount: updatedBilling.final_amount,
          },
        });
      } catch (e) {
        // notification table might be in progress of deployment
        console.warn('[Confirm Checkout] Notification insert skipped:', e);
      }
    }

    return NextResponse.json({
      success: true,
      billing: updatedBilling,
      amount: updatedBilling?.final_amount ?? updatedBilling?.amount ?? 0,
    });
  } catch (error) {
    console.error('[Confirm Checkout] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
