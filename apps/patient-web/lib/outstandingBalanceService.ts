import type { Billing, Appointment } from '@/lib/database';
import { getBalance, getBillings } from '@/lib/paymentService';
import { getPatientAppointments } from '@/lib/appointmentService';

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

export async function calculateOutstandingBalance(userId: string): Promise<number> {
  console.log("[calculateOutstandingBalance] Starting calculation for user:", userId);
  try {
    const [balance, billings, appts] = await Promise.all([
      getBalance(userId),
      getBillings(userId),
      getPatientAppointments(userId),
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

    const unpaidApptsSum = unpaid.reduce((sum, a) => sum + (SERVICE_PRICES[a.service] || 0), 0);
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
    const [balance, billings, appts] = await Promise.all([
      getBalance(userId),
      getBillings(userId),
      getPatientAppointments(userId),
    ]);

    console.log("[fetchBillingDataForDashboard] Raw data fetched:", {
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

    const unpaidApptsSum = unpaid.reduce((sum, a) => sum + (SERVICE_PRICES[a.service] || 0), 0);

    const result = {
      outstandingBalance: balance + unpaidApptsSum,
      unpaidAppointments: unpaid,
      billingHistory: billings,
    };

    console.log("[fetchBillingDataForDashboard] Result prepared:", {
      outstandingBalance: result.outstandingBalance,
      unpaidAppointmentsCount: unpaid.length,
      billingHistoryCount: billings.length
    });

    return result;
  } catch (err) {
    console.error("[fetchBillingDataForDashboard] Error:", err);
    throw err;
  }
}

export { SERVICE_PRICES };
