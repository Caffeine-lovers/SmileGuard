/**
 * Clinic Rules Type Definitions
 * 
 * These types correspond to the clinic_rules table in Supabase.
 * Used throughout the doctor-mobile app for managing clinic operations.
 */

export interface ClinicRules {
  id: string;
  doctor_id: string;
  
  // Appointment Rules
  min_advance_booking_hours: number;
  max_advance_booking_days: number;
  min_appointment_duration_mins: number;
  max_daily_appointments: number;
  
  // Cancellation & Rescheduling Policies
  cancellation_policy_text: string | null;
  cancellation_fee_percentage: number;
  min_hours_to_cancel: number;
  min_hours_to_reschedule: number;
  
  // No-Show Policy
  allow_no_show_penalty: boolean;
  no_show_penalty_percentage: number;
  
  // Break & Buffer Rules
  break_between_appointments_mins: number;
  buffer_before_lunch_mins: number;
  lunch_start_time: string | null;
  lunch_end_time: string | null;
  
  // Notification Rules
  send_appointment_reminders: boolean;
  reminder_before_hours: number;
  
  // Patient Rules
  max_patients_per_slot: number;
  allow_walk_ins: boolean;
  require_new_patient_form: boolean;
  
  // Service-Level Rules
  auto_approve_appointments: boolean;
  require_payment_upfront: boolean;
  accepted_payment_methods: string[] | null;
  
  // Operational Details
  clinic_notes: string | null;
  policies_url: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Input type for creating or updating clinic rules
 * (excludes auto-generated fields)
 */
export interface CreateClinicRulesInput {
  doctor_id: string;
  min_advance_booking_hours?: number;
  max_advance_booking_days?: number;
  min_appointment_duration_mins?: number;
  max_daily_appointments?: number;
  cancellation_policy_text?: string;
  cancellation_fee_percentage?: number;
  min_hours_to_cancel?: number;
  min_hours_to_reschedule?: number;
  allow_no_show_penalty?: boolean;
  no_show_penalty_percentage?: number;
  break_between_appointments_mins?: number;
  buffer_before_lunch_mins?: number;
  lunch_start_time?: string;
  lunch_end_time?: string;
  send_appointment_reminders?: boolean;
  reminder_before_hours?: number;
  max_patients_per_slot?: number;
  allow_walk_ins?: boolean;
  require_new_patient_form?: boolean;
  auto_approve_appointments?: boolean;
  require_payment_upfront?: boolean;
  accepted_payment_methods?: string[];
  clinic_notes?: string;
  policies_url?: string;
}

/**
 * Update type for clinic rules
 * All fields are optional
 */
export type UpdateClinicRulesInput = Partial<CreateClinicRulesInput>;

/**
 * Default clinic rules configuration
 * Use when creating a new clinic rules record
 */
export const DEFAULT_CLINIC_RULES: Omit<CreateClinicRulesInput, 'doctor_id'> = {
  min_advance_booking_hours: 24,
  max_advance_booking_days: 90,
  min_appointment_duration_mins: 30,
  max_daily_appointments: 20,
  cancellation_fee_percentage: 0,
  min_hours_to_cancel: 24,
  min_hours_to_reschedule: 24,
  allow_no_show_penalty: true,
  no_show_penalty_percentage: 50,
  break_between_appointments_mins: 15,
  buffer_before_lunch_mins: 30,
  send_appointment_reminders: true,
  reminder_before_hours: 24,
  max_patients_per_slot: 1,
  allow_walk_ins: false,
  require_new_patient_form: true,
  auto_approve_appointments: false,
  require_payment_upfront: false,
  accepted_payment_methods: ['card', 'cash', 'insurance'],
};
