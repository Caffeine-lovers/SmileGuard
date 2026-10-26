import { supabase } from '@smileguard/supabase-client';
import type { Billing, Appointment } from '@/lib/database';
import { getBalance, getBillings } from '@/lib/paymentService';
import { getPatientAppointments } from '@/lib/appointmentService';

const SERVICE_PRICES: Record<string, number> = {
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

export interface ClinicInfo {
  id: string;
  user_id: string;
  clinic_name: string;
  services: { id: string; name: string; price?: number }[];
}

export async function fetchClinicLookup(): Promise<{
  clinicMap: Map<string, ClinicInfo>;
  defaultClinic: ClinicInfo | null;
}> {
  const clinicMap = new Map<string, ClinicInfo>();
  let defaultClinic: ClinicInfo | null = null;
  try {
    const { data, error } = await supabase
      .from('clinic_setup')
      .select('id, user_id, clinic_name, services');

    if (!error && data && data.length > 0) {
      for (const row of data) {
        let servicesList: any[] = [];
        if (Array.isArray(row.services)) {
          servicesList = row.services;
        } else if (typeof row.services === 'string') {
          try {
            servicesList = JSON.parse(row.services);
          } catch {}
        }
        const info: ClinicInfo = {
          id: row.id,
          user_id: row.user_id,
          clinic_name: row.clinic_name || 'SmileGuard Dental Clinic',
          services: servicesList,
        };
        clinicMap.set(row.user_id, info);
        clinicMap.set(row.id, info);
        if (!defaultClinic) defaultClinic = info;
      }
    }
  } catch (e) {
    console.error('[fetchClinicLookup] Error loading clinic setup:', e);
  }
  return { clinicMap, defaultClinic };
}

export function getServicePrice(serviceName?: string | null): number {
  if (!serviceName) return 1500;
  if (SERVICE_PRICES[serviceName] && SERVICE_PRICES[serviceName] > 0) {
    return SERVICE_PRICES[serviceName];
  }
  const normalized = serviceName.trim().toLowerCase();
  for (const [key, price] of Object.entries(SERVICE_PRICES)) {
    if (key.toLowerCase() === normalized) return price;
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return price;
    }
  }
  return 1500;
}

export function getServicePriceForClinic(
  serviceName?: string | null,
  clinicServices?: { id?: string; name?: string; price?: number }[]
): number {
  if (!serviceName) return 1500;
  if (clinicServices && Array.isArray(clinicServices) && clinicServices.length > 0) {
    const norm = serviceName.trim().toLowerCase();
    // 1. Exact match
    const exact = clinicServices.find((s) => s.name?.trim().toLowerCase() === norm);
    if (exact && typeof exact.price === 'number' && exact.price > 0) {
      return exact.price;
    }
    // 2. Partial match
    const partial = clinicServices.find(
      (s) =>
        s.name &&
        (s.name.trim().toLowerCase().includes(norm) || norm.includes(s.name.trim().toLowerCase()))
    );
    if (partial && typeof partial.price === 'number' && partial.price > 0) {
      return partial.price;
    }
  }
  return getServicePrice(serviceName);
}

export async function calculateOutstandingBalance(userId: string): Promise<number> {
  console.log("[calculateOutstandingBalance] Starting calculation for user:", userId);
  try {
    const [balance, billings, appts, { clinicMap, defaultClinic }] = await Promise.all([
      getBalance(userId),
      getBillings(userId),
      getPatientAppointments(userId),
      fetchClinicLookup(),
    ]);

    console.log("[calculateOutstandingBalance] Data fetched:", { 
      baseBalance: balance, 
      billingsCount: billings.length, 
      appointmentsCount: appts.length 
    });

    const paidApptIds = new Set(
      billings
        .filter((b) => b.payment_status === 'paid' && b.appointment_id)
        .map((b) => b.appointment_id)
    );
    const unpaid = appts.filter((a) => 
      a.status !== 'cancelled' && 
      a.status !== 'declined' && 
      !paidApptIds.has(a.id)
    );

    console.log("[calculateOutstandingBalance] Unpaid appointments:", unpaid.length);

    const unpaidApptsSum = unpaid.reduce((sum, a) => {
      const clinic = (a.dentist_id ? clinicMap.get(a.dentist_id) : null) || defaultClinic;
      return sum + getServicePriceForClinic(a.service, clinic?.services);
    }, 0);
    const total = balance + unpaidApptsSum;
    
    console.log("[calculateOutstandingBalance] Calculation complete:", { baseBalance: balance, unpaidServices: unpaidApptsSum, total });
    return total;
  } catch (err) {
    console.error("[calculateOutstandingBalance] Error:", err);
    throw err;
  }
}

export async function fetchBillingDataForDashboard(
  userId: string
): Promise<{
  outstandingBalance: number;
  unpaidAppointments: Appointment[];
  billingHistory: Billing[];
}> {
  console.log("[fetchBillingDataForDashboard] Fetching billing data for user:", userId);
  try {
    const [balance, billings, appts, { clinicMap, defaultClinic }] = await Promise.all([
      getBalance(userId),
      getBillings(userId),
      getPatientAppointments(userId),
      fetchClinicLookup(),
    ]);

    console.log("[fetchBillingDataForDashboard] Raw data fetched:", {
      baseBalance: balance,
      billingsCount: billings.length,
      appointmentsCount: appts.length,
      clinicsLoaded: clinicMap.size
    });

    const paidApptIds = new Set(
      billings
        .filter((b) => b.payment_status === 'paid' && b.appointment_id)
        .map((b) => b.appointment_id)
    );
    const unpaid = appts.filter((a) =>
      a.status !== 'cancelled' &&
      a.status !== 'declined' &&
      !paidApptIds.has(a.id)
    );

    const enrichedUnpaid = unpaid.map((a) => {
      const clinic = (a.dentist_id ? clinicMap.get(a.dentist_id) : null) || defaultClinic;
      const clinicName = clinic?.clinic_name || 'SmileGuard Dental Clinic';
      const resolvedPrice = getServicePriceForClinic(a.service, clinic?.services);
      return {
        ...a,
        clinic_name: clinicName,
        price: resolvedPrice,
      };
    });

    const unpaidApptsSum = enrichedUnpaid.reduce((sum, a) => sum + (a.price ?? 1500), 0);

    const result = {
      outstandingBalance: balance + unpaidApptsSum,
      unpaidAppointments: enrichedUnpaid,
      billingHistory: billings,
    };

    console.log("[fetchBillingDataForDashboard] Result prepared:", {
      outstandingBalance: result.outstandingBalance,
      unpaidAppointmentsCount: enrichedUnpaid.length,
      billingHistoryCount: billings.length
    });

    return result;
  } catch (err) {
    console.error("[fetchBillingDataForDashboard] Error:", err);
    throw err;
  }
}

export { SERVICE_PRICES };
