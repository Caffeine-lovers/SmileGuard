import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseClient(authHeader?: string | null) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceRoleKey && supabaseUrl) {
    return createClient(supabaseUrl, serviceRoleKey);
  }
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey && supabaseUrl) {
    return createClient(supabaseUrl, anonKey, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const supabase = getSupabaseClient(authHeader);
    if (!supabase) {
      console.error('[Confirm Checkout] Supabase client misconfigured');
      return NextResponse.json({ error: 'Database service configuration error' }, { status: 500 });
    }

    const body = await request.json();
    let { 
      appointmentId, 
      patientId, 
      paymentMethod = 'online', 
      paymentRef,
      amount 
    } = body;

    // 1. Verify payment with PayMongo API
    let verifiedPaymentId = paymentRef || null;
    let verifiedAmount = amount ? Number(amount) : null;
    let verifiedMethod = paymentMethod;

    const secretKey = process.env.PAYMONGO_SECRET_KEY;
    if (secretKey) {
      try {
        const auth = Buffer.from(secretKey + ':').toString('base64');

        if (paymentRef) {
          // Direct lookup by payment reference ID (pay_... or cs_...)
          const isPaymentId = String(paymentRef).startsWith('pay_');
          const url = isPaymentId
            ? `https://api.paymongo.com/v1/payments/${paymentRef}`
            : `https://api.paymongo.com/v1/checkout_sessions/${paymentRef}`;

          const pmRes = await fetch(url, {
            headers: { Authorization: `Basic ${auth}` },
          });

          if (pmRes.ok) {
            const pmData = await pmRes.json();
            const item = pmData.data;
            const attrs = item?.attributes;

            if (isPaymentId) {
              verifiedPaymentId = item.id;
              verifiedAmount = (attrs?.amount || 0) / 100;
              verifiedMethod = attrs?.source?.type || 'gcash';

              const meta = attrs?.metadata || {};
              if (meta.appointment_id && !appointmentId) appointmentId = meta.appointment_id;
              if (meta.patient_id && !patientId) patientId = meta.patient_id;
            } else {
              const paymentItem = attrs?.payments?.[0];
              if (paymentItem) {
                verifiedPaymentId = paymentItem.id;
                verifiedAmount = (paymentItem.attributes?.amount || 0) / 100;
                verifiedMethod = paymentItem.attributes?.source?.type || 'card';
              }
              const meta = attrs?.metadata || {};
              if (meta.appointment_id && !appointmentId) appointmentId = meta.appointment_id;
              if (meta.patient_id && !patientId) patientId = meta.patient_id;
            }
          }
        } else if (appointmentId || patientId) {
          // Automatic resolution: Look up recent PayMongo payments matching appointmentId
          const pmListRes = await fetch('https://api.paymongo.com/v1/payments?limit=30', {
            headers: { Authorization: `Basic ${auth}` },
          });

          if (pmListRes.ok) {
            const pmListData = await pmListRes.json();
            const payments: any[] = pmListData.data || [];

            // Find matching paid transaction
            const matched = payments.find((p) => {
              const meta = p.attributes?.metadata;
              const isPaid = p.attributes?.status === 'paid';
              if (!isPaid) return false;
              if (appointmentId && meta?.appointment_id === appointmentId) return true;
              return false;
            }) || payments.find((p) => {
              const meta = p.attributes?.metadata;
              const isPaid = p.attributes?.status === 'paid';
              if (!isPaid) return false;
              if (patientId && meta?.patient_id === patientId) return true;
              return false;
            });

            if (matched) {
              verifiedPaymentId = matched.id;
              verifiedAmount = (matched.attributes?.amount || 0) / 100;
              verifiedMethod = matched.attributes?.source?.type || 'gcash';
              const meta = matched.attributes?.metadata || {};
              if (meta.appointment_id && !appointmentId) appointmentId = meta.appointment_id;
              if (meta.patient_id && !patientId) patientId = meta.patient_id;
            }
          }
        }
      } catch (pmErr) {
        console.warn('[Confirm Checkout] Failed to fetch PayMongo payment details:', pmErr);
      }
    }

    // Default reference ID if not fetched from PayMongo
    if (!verifiedPaymentId && paymentRef) {
      verifiedPaymentId = paymentRef;
    }

    if (!appointmentId) {
      return NextResponse.json({ error: 'Missing appointmentId and could not resolve from paymentRef' }, { status: 400 });
    }

    const effectiveAmount = verifiedAmount ?? 300;
    let updatedBilling: any = null;

    // 2. First attempt to call the SECURITY DEFINER RPC confirm_billing_payment
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('confirm_billing_payment', {
      p_appointment_id: appointmentId,
      p_patient_id: patientId || null,
      p_amount: effectiveAmount,
      p_reference_id: verifiedPaymentId,
      p_payment_method: verifiedMethod,
    });

    if (!rpcErr && rpcRows && (Array.isArray(rpcRows) ? rpcRows.length > 0 : true)) {
      updatedBilling = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
    } else {
      if (rpcErr) {
        console.warn('[Confirm Checkout] RPC error (falling back to direct query):', rpcErr.message);
      }

      // 3. Fallback direct database update/insert
      const { data: existingRows } = await supabase
        .from('billings')
        .select('*')
        .eq('appointment_id', appointmentId);

      const rows = existingRows || [];
      if (rows.length > 0) {
        const targetRow = rows.find((r) => r.payment_status !== 'paid') || rows[0];
        const { data: updated, error: updateErr } = await supabase
          .from('billings')
          .update({
            payment_status: 'paid',
            payment_method: verifiedMethod,
            gateway_transaction_id: verifiedPaymentId,
            final_amount: effectiveAmount,
            payment_date: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetRow.id)
          .select()
          .maybeSingle();

        if (!updateErr && updated) {
          updatedBilling = updated;
        }
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('billings')
          .insert({
            patient_id: patientId,
            appointment_id: appointmentId,
            amount: effectiveAmount,
            discount_type: 'none',
            discount_amount: 0,
            final_amount: effectiveAmount,
            payment_status: 'paid',
            payment_method: verifiedMethod,
            gateway_transaction_id: verifiedPaymentId,
            payment_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();

        if (!insertErr && inserted) {
          updatedBilling = inserted;
        }
      }
    }

    return NextResponse.json({
      success: true,
      billing: updatedBilling,
      referenceId: verifiedPaymentId,
      amount: effectiveAmount,
      paymentMethod: verifiedMethod,
      appointmentId,
      patientId,
    });
  } catch (error) {
    console.error('[Confirm Checkout] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
