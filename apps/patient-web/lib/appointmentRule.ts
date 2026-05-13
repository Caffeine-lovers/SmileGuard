import { supabase } from '@smileguard/supabase-client';

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
