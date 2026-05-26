import { supabase } from '@smileguard/supabase-client';
import type { Appointment } from './database';

export interface AppointmentRule {
  id: string;
  grace_period_enabled: boolean;
  grace_period_hours: number;
  cancellation_window_hours: number;
  cancellation_fee_amount: number;
  reschedule_allowed: boolean;
  reschedule_window_hours: number;
  [key: string]: any;
}

export const fetchAppointmentRules = async (): Promise<AppointmentRule | null> => {
  try {
    const { data, error } = await supabase
      .from('appointment_rules')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || null;
  } catch (error) {
    console.error('Error fetching appointment rules:', error);
    return null;
  }
};

export const calculateCancellationFee = (
  appointment: Appointment,
  appointmentRules: AppointmentRule
): { fee: number; isWithinGracePeriod: boolean; isWithinCancellationWindow: boolean } => {
  const now = new Date();

  // Calculate grace period based on when appointment was created (booked)
  if (appointmentRules.grace_period_enabled && appointment.created_at) {
    const createdAt = new Date(appointment.created_at);
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation <= appointmentRules.grace_period_hours) {
      return { fee: 0, isWithinGracePeriod: true, isWithinCancellationWindow: true };
    }
  }

  // Calculate cancellation window based on appointment date
  const apptDate = new Date(appointment.appointment_date);
  const hoursUntilAppointment = (apptDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  // If still within cancellation window, charge fee
  if (hoursUntilAppointment >= -appointmentRules.cancellation_window_hours) {
    return { 
      fee: appointmentRules.cancellation_fee_amount || 0, 
      isWithinGracePeriod: false, 
      isWithinCancellationWindow: true 
    };
  }

  // Past cancellation window
  return { fee: 0, isWithinGracePeriod: false, isWithinCancellationWindow: false };
};


