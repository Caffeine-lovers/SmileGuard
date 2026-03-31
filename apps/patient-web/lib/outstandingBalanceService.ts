import type { Billing, Appointment } from '@/lib/database';
import { getBalance, getBillings } from '@/lib/paymentService';
import { getPatientAppointments } from '@/lib/appointmentService';

const SERVICE_PRICES: Record<string, number> = {
  Cleaning: 1500,
  Whitening: 5000,
  Fillings: 2000,
  'Root Canal': 8000,
  Extraction: 1500,
  Braces: 35000,
  Implants: 45000,
  'X-Ray': 500,
  'Check-up': 300,
};

export async function calculateOutstandingBalance(userId: string): Promise<number> {
  const [balance, billings, appts] = await Promise.all([
    getBalance(userId),
    getBillings(userId),
    getPatientAppointments(userId),
  ]);

  const paidApptIds = new Set(
    billings
      .filter((b) => b.payment_status === 'paid' && b.appointment_id)
      .map((b) => b.appointment_id)
  );
  const unpaid = appts.filter((a) => a.status !== 'cancelled' && !paidApptIds.has(a.id));

  const unpaidApptsSum = unpaid.reduce((sum, a) => sum + (SERVICE_PRICES[a.service] || 0), 0);
  return balance + unpaidApptsSum;
}

export async function fetchBillingDataForDashboard(
  userId: string
): Promise<{
  outstandingBalance: number;
  unpaidAppointments: Appointment[];
  billingHistory: Billing[];
}> {
  const [balance, billings, appts] = await Promise.all([
    getBalance(userId),
    getBillings(userId),
    getPatientAppointments(userId),
  ]);

  const paidApptIds = new Set(
    billings
      .filter((b) => b.payment_status === 'paid' && b.appointment_id)
      .map((b) => b.appointment_id)
  );
  const unpaid = appts.filter((a) => a.status !== 'cancelled' && !paidApptIds.has(a.id));

  const unpaidApptsSum = unpaid.reduce((sum, a) => sum + (SERVICE_PRICES[a.service] || 0), 0);

  return {
    outstandingBalance: balance + unpaidApptsSum,
    unpaidAppointments: unpaid,
    billingHistory: billings,
  };
}

export { SERVICE_PRICES };
