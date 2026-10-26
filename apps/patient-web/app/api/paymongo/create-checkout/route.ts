import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isPayMongoConfigured, getPayMongoAuthHeader, PAYMONGO_API_BASE } from '@/lib/paymongo';

export const dynamic = 'force-dynamic';

function getSupabaseClient(authHeader?: string | null) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  // If service role key is available, use it (bypasses RLS)
  if (serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey);
  }

  // Otherwise, use anon key with the caller's auth header so RLS evaluates the user's session
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) return null;

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

// Fallback service prices — authoritative baseline
const DEFAULT_SERVICE_PRICES: Record<string, number> = {
  Cleaning: 1500,
  Whitening: 5000,
  Fillings: 2000,
  Filling: 2000,
  'Root Canal': 8000,
  'Root Canals': 8000,
  Extraction: 1500,
  Aligners: 25000,
  'Braces Consultation': 35000,
  Braces: 35000,
  'Implants Consultation': 45000,
  Implants: 45000,
  'X-Ray': 500,
  'Check-up': 300,
  Checkup: 300,
  Consultation: 500,
  'Initial Consultation': 500,
  General: 500,
  'General Checkup': 500,
};

function getServicePriceForClinic(
  serviceName?: string | null,
  clinicServices?: { id?: string; name?: string; price?: number }[]
): number {
  if (!serviceName) return 1500;
  if (clinicServices && Array.isArray(clinicServices) && clinicServices.length > 0) {
    const norm = serviceName.trim().toLowerCase();
    const exact = clinicServices.find((s) => s.name?.trim().toLowerCase() === norm);
    if (exact && typeof exact.price === 'number' && exact.price > 0) {
      return exact.price;
    }
    const partial = clinicServices.find(
      (s) =>
        s.name &&
        (s.name.trim().toLowerCase().includes(norm) || norm.includes(s.name.trim().toLowerCase()))
    );
    if (partial && typeof partial.price === 'number' && partial.price > 0) {
      return partial.price;
    }
  }

  const normalized = serviceName.trim().toLowerCase();
  for (const [key, price] of Object.entries(DEFAULT_SERVICE_PRICES)) {
    if (key.toLowerCase() === normalized) return price;
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return price;
    }
  }
  return 1500;
}

export async function POST(request: NextRequest) {
  try {
    if (!isPayMongoConfigured) {
      return NextResponse.json(
        {
          error: 'PayMongo payments are not configured on this server yet.',
          unconfigured: true,
        },
        { status: 503 }
      );
    }

    const authHeader = request.headers.get('authorization');
    const supabase = getSupabaseClient(authHeader);

    const body = await request.json();
    const { appointmentId, patientId, discountType, billingId, service: bodyService } = body;

    // Validate required fields
    if (!appointmentId || !patientId) {
      return NextResponse.json(
        { error: 'Missing appointmentId or patientId' },
        { status: 400 }
      );
    }

    // Attempt to lookup appointment and clinic from database
    let serviceName: string | null = null;
    let clinicName = 'SmileGuard Dental Clinic';
    let clinicServices: any[] = [];

    if (supabase) {
      const { data: appointment } = await supabase
        .from('appointments')
        .select('service, dentist_id, status')
        .eq('id', appointmentId)
        .eq('patient_id', patientId)
        .maybeSingle();

      if (appointment?.service) {
        serviceName = appointment.service;
      }

      // Fetch the clinic setup for this appointment's doctor/clinic
      let clinicQuery = supabase
        .from('clinic_setup')
        .select('clinic_name, services');

      if (appointment?.dentist_id) {
        clinicQuery = clinicQuery.eq('user_id', appointment.dentist_id);
      } else {
        clinicQuery = clinicQuery.limit(1);
      }

      const { data: clinicData } = await clinicQuery.maybeSingle();
      if (clinicData) {
        if (clinicData.clinic_name) clinicName = clinicData.clinic_name;
        if (Array.isArray(clinicData.services)) {
          clinicServices = clinicData.services;
        } else if (typeof clinicData.services === 'string') {
          try {
            clinicServices = JSON.parse(clinicData.services);
          } catch {}
        }
      }
    }

    // Fall back to client-provided service name if DB lookup was blocked by RLS
    if (!serviceName && bodyService && typeof bodyService === 'string') {
      serviceName = bodyService.trim();
    }

    if (!serviceName) {
      serviceName = 'Dental Procedure';
    }

    const baseAmount = getServicePriceForClinic(serviceName, clinicServices);

    // Apply statutory discount server-side
    let finalAmount = baseAmount;
    let discountAmount = 0;
    if (discountType === 'pwd' || discountType === 'senior') {
      discountAmount = baseAmount * 0.2; // 20% statutory discount (RA 9994 / RA 10754)
      finalAmount = baseAmount - discountAmount;
    }

    const amountInCentavos = Math.round(finalAmount * 100);

    // Create PayMongo Checkout Session
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: getPayMongoAuthHeader(),
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              {
                name: `${serviceName} • ${clinicName}`,
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
              billing_id: billingId || '',
              discount_type: discountType || 'none',
              discount_amount: String(discountAmount),
              base_amount: String(baseAmount),
            },
            description: `SmileGuard - ${serviceName} (${clinicName})`,
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
      clinicName,
    });
  } catch (error) {
    console.error('Error creating PayMongo checkout:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
