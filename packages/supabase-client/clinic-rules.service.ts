/**
 * Clinic Rules Service
 * 
 * Handles all database operations for clinic rules.
 * Works with the clinic_rules table in Supabase.
 */

import { supabase } from '@repo/supabase-client';
import type {
  ClinicRules,
  CreateClinicRulesInput,
  UpdateClinicRulesInput,
} from '@repo/shared-types';

/**
 * Get clinic rules for a specific doctor
 */
export async function getClinicRulesByDoctorId(
  doctorId: string
): Promise<ClinicRules | null> {
  try {
    const { data, error } = await supabase
      .from('clinic_rules')
      .select('*')
      .eq('doctor_id', doctorId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found - this is expected for new doctors
        return null;
      }
      throw error;
    }

    return data as ClinicRules;
  } catch (error) {
    console.error('Error fetching clinic rules:', error);
    throw error;
  }
}

/**
 * Create clinic rules for a doctor
 */
export async function createClinicRules(
  input: CreateClinicRulesInput
): Promise<ClinicRules> {
  try {
    const { data, error } = await supabase
      .from('clinic_rules')
      .insert([input])
      .select()
      .single();

    if (error) throw error;

    return data as ClinicRules;
  } catch (error) {
    console.error('Error creating clinic rules:', error);
    throw error;
  }
}

/**
 * Update clinic rules for a doctor
 */
export async function updateClinicRules(
  doctorId: string,
  input: UpdateClinicRulesInput
): Promise<ClinicRules> {
  try {
    const { data, error } = await supabase
      .from('clinic_rules')
      .update(input)
      .eq('doctor_id', doctorId)
      .select()
      .single();

    if (error) throw error;

    return data as ClinicRules;
  } catch (error) {
    console.error('Error updating clinic rules:', error);
    throw error;
  }
}

/**
 * Delete clinic rules for a doctor
 */
export async function deleteClinicRules(
  doctorId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('clinic_rules')
      .delete()
      .eq('doctor_id', doctorId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting clinic rules:', error);
    throw error;
  }
}

/**
 * Get or create clinic rules (create with defaults if doesn't exist)
 */
export async function getOrCreateClinicRules(
  doctorId: string,
  defaultValues?: Partial<CreateClinicRulesInput>
): Promise<ClinicRules> {
  try {
    let rules = await getClinicRulesByDoctorId(doctorId);

    if (!rules) {
      // Create with defaults
      const { DEFAULT_CLINIC_RULES } = await import('@repo/shared-types');
      const input: CreateClinicRulesInput = {
        doctor_id: doctorId,
        ...DEFAULT_CLINIC_RULES,
        ...defaultValues,
      };
      rules = await createClinicRules(input);
    }

    return rules;
  } catch (error) {
    console.error('Error getting or creating clinic rules:', error);
    throw error;
  }
}

/**
 * Validate clinic rules before saving
 */
export function validateClinicRules(input: Partial<CreateClinicRulesInput>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (input.min_advance_booking_hours !== undefined) {
    if (input.min_advance_booking_hours < 0) {
      errors.push('Minimum advance booking hours cannot be negative');
    }
  }

  if (input.max_advance_booking_days !== undefined) {
    if (input.max_advance_booking_days <= 0) {
      errors.push('Maximum advance booking days must be greater than 0');
    }
  }

  if (input.min_appointment_duration_mins !== undefined) {
    if (input.min_appointment_duration_mins <= 0) {
      errors.push('Minimum appointment duration must be greater than 0');
    }
  }

  if (input.max_daily_appointments !== undefined) {
    if (input.max_daily_appointments <= 0) {
      errors.push('Maximum daily appointments must be greater than 0');
    }
  }

  if (input.cancellation_fee_percentage !== undefined) {
    if (input.cancellation_fee_percentage < 0 || input.cancellation_fee_percentage > 100) {
      errors.push('Cancellation fee percentage must be between 0 and 100');
    }
  }

  if (input.no_show_penalty_percentage !== undefined) {
    if (input.no_show_penalty_percentage < 0 || input.no_show_penalty_percentage > 100) {
      errors.push('No-show penalty percentage must be between 0 and 100');
    }
  }

  if (input.lunch_start_time && input.lunch_end_time) {
    if (input.lunch_start_time >= input.lunch_end_time) {
      errors.push('Lunch end time must be after lunch start time');
    }
  }

  if (input.reminder_before_hours !== undefined) {
    if (input.reminder_before_hours <= 0) {
      errors.push('Reminder hours must be greater than 0');
    }
  }

  if (input.max_patients_per_slot !== undefined) {
    if (input.max_patients_per_slot <= 0) {
      errors.push('Max patients per slot must be greater than 0');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
