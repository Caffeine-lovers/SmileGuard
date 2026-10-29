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
  const norm = (apt.status || '').toLowerCase();
  return (
    norm === 'pending' ||
    (!apt.dentist_id && !['cancelled', 'declined', 'completed', 'no-show'].includes(norm))
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
  discount_type?: 'none' | 'pwd' | 'senior';
  discount_amount?: number;
  final_amount: number;
  payment_status: 'pending' | 'paid' | 'overdue';
  payment_method?: 'cash' | 'card' | 'gcash' | 'bank-transfer' | 'grab_pay' | 'paymaya';
  payment_date?: string;
  gateway_transaction_id?: string;
  created_at?: string;
  updated_at?: string;
}

export const calculateDiscount = (
  amount: number,
  discountType: Billing['discount_type']
): { discountAmount: number; finalAmount: number } => {
  let discountAmount = 0;

  switch (discountType) {
    case 'pwd':
    case 'senior':
      discountAmount = amount * 0.2; // 20% discount
      break;
    default:
      discountAmount = 0;
  }

  return {
    discountAmount,
    finalAmount: amount - discountAmount,
  };
};
