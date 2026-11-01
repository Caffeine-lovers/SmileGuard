import { supabase } from '@smileguard/supabase-client';
import type { Billing, Appointment, AppointmentBillingRow, AppointmentBillingStatus } from '@/lib/database';
import { isCancelledAppointment, isPendingAppointment } from '@/lib/database';
import { getBillings } from '@/lib/paymentService';
import { getPatientAppointments } from '@/lib/appointmentService';
import { SERVICE_PRICES, getServicePrice, getServicePriceForClinic } from '@/lib/pricing';

// Re-exported so existing imports keep working; the implementations live in lib/pricing.ts
export { SERVICE_PRICES, getServicePrice, getServicePriceForClinic };


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
          clinic_name: row.clinic_name || "Kyler's Clinic",
          services: servicesList,
        };
        clinicMap.set(row.user_id, info);
        clinicMap.set(row.id, info);
        // Prioritize Kyler's Clinic as default
        if (info.clinic_name.toLowerCase().includes('kyler') || !defaultClinic) {
          defaultClinic = info;
        }
      }
    }
  } catch (e) {
    console.error('[fetchClinicLookup] Error loading clinic setup:', e);
  }

  if (!defaultClinic) {
    defaultClinic = {
      id: "6572586e-f38b-4d1e-894c-52f038228282",
      user_id: "7c9b5331-3f19-4560-8256-44c7742e11ad",
      clinic_name: "Kyler's Clinic",
      services: [],
    };
  }

  return { clinicMap, defaultClinic };
}



export async function calculateOutstandingBalance(userId: string): Promise<number> {
  console.log("[calculateOutstandingBalance] Starting calculation for user:", userId);
  try {
    const { outstandingBalance } = await fetchBillingDataForDashboard(userId);
    return outstandingBalance;
  } catch (err) {
    console.error("[calculateOutstandingBalance] Error:", err);
    throw err;
  }
}

/**
 * Builds a per-appointment billing ledger that mirrors the appointments table:
 *   - CANCELLED : appointment.status is 'cancelled' or 'declined'
 *   - PAID      : a billing row with payment_status = 'paid' exists for the appointment
 *   - NOT PAID  : everything else (pending, scheduled, completed, no-show)
 *
 * Amounts come from the linked billing row when one exists, otherwise from the
 * clinic's service price list.
 */
export function buildAppointmentBillingLedger(
  appts: Appointment[],
  billings: Billing[],
  clinicMap: Map<string, ClinicInfo>,
  defaultClinic: ClinicInfo | null
): AppointmentBillingRow[] {
  // Index billings by appointment, preferring a 'paid' record when several exist
  const billingByAppt = new Map<string, Billing>();
  for (const b of billings) {
    if (!b.appointment_id) continue;
    const existing = billingByAppt.get(b.appointment_id);
    if (!existing || (existing.payment_status !== 'paid' && b.payment_status === 'paid')) {
      billingByAppt.set(b.appointment_id, b);
    }
  }

  return appts.map((a) => {
    const clinic = (a.dentist_id ? clinicMap.get(a.dentist_id) : null) || defaultClinic;
    const clinicName = clinic?.clinic_name || "Kyler's Clinic";
    const listPrice = getServicePriceForClinic(a.service, clinic?.services);
    const billing = a.id ? billingByAppt.get(a.id) : undefined;
    const isPaid = billing?.payment_status === 'paid';

    let billing_status: AppointmentBillingStatus;
    if (isCancelledAppointment(a)) billing_status = 'CANCELLED';
    else if (isPaid) billing_status = 'PAID';
    else billing_status = 'NOT PAID';

    const amount_due = billing ? Number(billing.final_amount ?? billing.amount ?? listPrice) : listPrice;

    return {
      ...a,
      clinic_name: clinicName,
      price: listPrice,
      billing_status,
      amount_due,
      billing,
    };
  });
}

export async function fetchBillingDataForDashboard(
  userId: string
): Promise<{
  outstandingBalance: number;
  unpaidAppointments: Appointment[];
  billingHistory: Billing[];
  ledger: AppointmentBillingRow[];
}> {
  console.log("[fetchBillingDataForDashboard] Fetching billing data for user:", userId);
  try {
    const [billings, appts, { clinicMap, defaultClinic }] = await Promise.all([
      getBillings(userId),
      getPatientAppointments(userId),
      fetchClinicLookup(),
    ]);

    const ledger = buildAppointmentBillingLedger(appts, billings, clinicMap, defaultClinic);

    // Payable = NOT PAID and already approved by the clinic (pending requests can't be settled yet)
    const payable = ledger.filter((r) => r.billing_status === 'NOT PAID' && !isPendingAppointment(r));

    // Pending billing rows that aren't tied to any appointment (manual clinic charges)
    const orphanPendingSum = billings
      .filter((b) => !b.appointment_id && b.payment_status !== 'paid' && b.payment_status !== 'cancelled')
      .reduce((sum, b) => sum + Number(b.final_amount ?? 0), 0);

    const outstandingBalance = payable.reduce((sum, r) => sum + r.amount_due, 0) + orphanPendingSum;

    const result = {
      outstandingBalance,
      // `price` drives the amount shown/charged in the payment form
      unpaidAppointments: payable.map((r) => ({ ...r, price: r.amount_due })),
      billingHistory: billings,
      ledger,
    };

    console.log("[fetchBillingDataForDashboard] Result prepared:", {
      outstandingBalance,
      payableCount: payable.length,
      ledgerCount: ledger.length,
      billingHistoryCount: billings.length,
    });

    return result;
  } catch (err) {
    console.error("[fetchBillingDataForDashboard] Error:", err);
    throw err;
  }
}

