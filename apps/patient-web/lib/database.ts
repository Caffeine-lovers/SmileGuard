// Type definitions for database operations
export interface Appointment {
  id?: string;
  patient_id: string;
  dentist_id: string | null;
  service: string;
  appointment_date: string;
  appointment_time: string;
  status: 'pending' | 'PENDING' | 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined'; // 'pending' = awaiting clinic approval
  notes?: string;
  created_at?: string;
  updated_at?: string;
  clinic_name?: string;
  price?: number;
}

/** Billing state of a single appointment, derived from the appointments table + billings */
export type AppointmentBillingStatus = 'PAID' | 'NOT PAID' | 'CANCELLED';

export interface AppointmentBillingRow extends Appointment {
  billing_status: AppointmentBillingStatus;
  /** Amount due (NOT PAID) or amount settled (PAID) for this appointment */
  amount_due: number;
  /** The billing record linked to this appointment, if any */
  billing?: Billing;
}

/** Appointment is still awaiting clinic approval (incl. legacy rows with no dentist assigned) */
export const isPendingAppointment = (apt: Pick<Appointment, 'status' | 'dentist_id'>): boolean => {
  const norm = (apt.status || '').toLowerCase().trim();
  // A finished procedure is never "awaiting approval", whatever spelling the clinic app used
  const isFinished = /^(complete|completed|done|finished)$/.test(norm);
  return (
    norm === 'pending' ||
    (!apt.dentist_id && !isFinished && !['cancelled', 'declined', 'no-show', 'no_show', 'noshow'].includes(norm))
  );
};

export const isCancelledAppointment = (apt: Pick<Appointment, 'status'>): boolean => {
  const norm = (apt.status || '').toLowerCase();
  return norm === 'cancelled' || norm === 'declined';
};

export interface Patient {
  id?: string;
  user_id?: string;
  name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  medical_conditions?: string;
  allergies?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Treatment {
  id?: string;
  patient_id: string;
  dentist_id: string;
  procedure_name: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Billing {
  id?: string;
  patient_id: string;
  appointment_id?: string;
  amount: number;
  discount_type?: 'none' | 'pwd' | 'senior' | 'custom';
  discount_amount?: number;
  /** Bill total after discount (patient share + HMO share) */
  final_amount: number;
  payment_status: 'not_paid' | 'paid' | 'overdue' | 'cancelled';
  /** How the patient's own share was paid; 'hmo' when the HMO covered everything */
  payment_method?: 'cash' | 'card' | 'gcash' | 'bank-transfer' | 'grab_pay' | 'paymaya' | 'hmo';
  payment_date?: string;
  gateway_transaction_id?: string;
  /** Reference number recorded by the clinic assistant */
  payment_reference?: string | null;
  payer_type?: 'self' | 'hmo';
  hmo_provider?: string | null;
  hmo_member_id?: string | null;
  hmo_approval_code?: string | null;
  /** Portion of final_amount covered by the HMO */
  hmo_covered_amount?: number;
  created_at?: string;
  updated_at?: string;
}

// Single source of truth for the 20% statutory discount (RA 9994 / RA 10754)
export { calculateDiscount } from '@smileguard/shared-types';
