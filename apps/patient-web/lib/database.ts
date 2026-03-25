// Type definitions for database operations
export interface Appointment {
  id?: string;
  patient_id: string;
  dentist_id: string | null;
  service: string;
  appointment_date: string;
  appointment_time: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

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
  discount_type?: 'none' | 'pwd' | 'senior' | 'insurance';
  discount_amount?: number;
  final_amount: number;
  payment_status: 'pending' | 'paid' | 'overdue';
  payment_method?: 'cash' | 'card' | 'gcash' | 'bank-transfer';
  payment_date?: string;
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
    case 'insurance':
      discountAmount = amount * 0.3; // 30% discount (example)
      break;
    default:
      discountAmount = 0;
  }

  return {
    discountAmount,
    finalAmount: amount - discountAmount,
  };
};
