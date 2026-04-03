import { supabase } from '../lib/supabase';
import { CurrentUser, MedicalIntake } from '../types/index';

// ─────────────────────────────────────────
// 1. FETCH PATIENT PROFILE
// ─────────────────────────────────────────
export async function getPatientProfile(
  patientId: string
): Promise<{
  id: string;
  name: string;
  email: string;
  role: string;
  service: string;
  created_at: string;
  updated_at: string;
} | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, service, created_at, updated_at')
    .eq('id', patientId)
    .single();

  if (error) {
    console.error('Error fetching patient profile:', error);
    return null;
  }

  return data;
}

// ─────────────────────────────────────────
// 2. FETCH PATIENT MEDICAL INTAKE
// ─────────────────────────────────────────
export async function getPatientMedicalIntake(
  patientId: string
): Promise<MedicalIntake | null> {
  const { data, error } = await supabase
    .from('medical_intake')
    .select(
      'date_of_birth, gender, phone, address, emergency_contact_name, emergency_contact_phone, allergies, current_medications, medical_conditions, past_surgeries, smoking_status, pregnancy_status'
    )
    .eq('patient_id', patientId)
    .single();

  if (error) {
    console.error('Error fetching medical intake:', error);
    return null;
  }

  // Map database fields to camelCase for the app
  return {
    dateOfBirth: data.date_of_birth || '',
    gender: data.gender || '',
    phone: data.phone || '',
    address: data.address || '',
    emergencyContactName: data.emergency_contact_name || '',
    emergencyContactPhone: data.emergency_contact_phone || '',
    allergies: data.allergies || 'None',
    currentMedications: data.current_medications || 'None',
    medicalConditions: data.medical_conditions || 'None',
    pastSurgeries: data.past_surgeries || 'None',
    smokingStatus: data.smoking_status || '',
    pregnancyStatus: data.pregnancy_status || '',
  };
}

// ─────────────────────────────────────────
// 3. FETCH COMPLETE PATIENT DATA
// ─────────────────────────────────────────
export async function getCompletePatientData(patientId: string): Promise<{
  profile: {
    id: string;
    name: string;
    email: string;
    role: string;
    service: string;
    created_at: string;
    updated_at: string;
  } | null;
  medicalIntake: MedicalIntake | null;
} | null> {
  const profile = await getPatientProfile(patientId);
  const medicalIntake = await getPatientMedicalIntake(patientId);

  if (!profile) {
    return null;
  }

  return {
    profile,
    medicalIntake,
  };
}

// ─────────────────────────────────────────
// 4. FETCH ALL PATIENTS (for doctor view)
// ─────────────────────────────────────────
export async function getAllPatients(): Promise<
  Array<{
    id: string;
    name: string;
    email: string;
    service: string;
    created_at: string;
  }>
> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, service, created_at')
    .eq('role', 'patient')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all patients:', error);
    return [];
  }

  return data || [];
}

// ─────────────────────────────────────────
// 5. UPDATE PATIENT PROFILE
// ─────────────────────────────────────────
export async function updatePatientProfile(
  patientId: string,
  updates: {
    name?: string;
    email?: string;
    service?: string;
  }
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', patientId);

  if (error) {
    console.error('Error updating patient profile:', error);
    return { success: false, message: 'Failed to update profile' };
  }

  return { success: true, message: 'Profile updated successfully' };
}

// ─────────────────────────────────────────
// 6. UPDATE PATIENT MEDICAL INTAKE
// ─────────────────────────────────────────
export async function updatePatientMedicalIntake(
  patientId: string,
  intake: MedicalIntake
): Promise<{ success: boolean; message: string }> {
  // Map camelCase to snake_case for database
  const dbIntake = {
    patient_id: patientId,
    date_of_birth: intake.dateOfBirth,
    gender: intake.gender,
    phone: intake.phone,
    address: intake.address,
    emergency_contact_name: intake.emergencyContactName,
    emergency_contact_phone: intake.emergencyContactPhone,
    allergies: intake.allergies,
    current_medications: intake.currentMedications,
    medical_conditions: intake.medicalConditions,
    past_surgeries: intake.pastSurgeries,
    smoking_status: intake.smokingStatus,
    pregnancy_status: intake.pregnancyStatus,
    updated_at: new Date().toISOString(),
  };

  // Try to update first
  const { error: updateError, data: updateData } = await supabase
    .from('medical_intake')
    .update(dbIntake)
    .eq('patient_id', patientId)
    .select();

  // If no rows were updated, insert new record
  if (!updateError && updateData && updateData.length === 0) {
    const { error: insertError } = await supabase
      .from('medical_intake')
      .insert([dbIntake]);

    if (insertError) {
      console.error('Error creating medical intake:', insertError);
      return { success: false, message: 'Failed to save medical intake' };
    }
  } else if (updateError) {
    console.error('Error updating medical intake:', updateError);
    return { success: false, message: 'Failed to update medical intake' };
  }

  return { success: true, message: 'Medical intake updated successfully' };
}

// ─────────────────────────────────────────
// 7. SEARCH PATIENTS BY NAME OR EMAIL
// ─────────────────────────────────────────
export async function searchPatients(
  query: string
): Promise<
  Array<{
    id: string;
    name: string;
    email: string;
    service: string;
  }>
> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, service')
    .eq('role', 'patient')
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10);

  if (error) {
    console.error('Error searching patients:', error);
    return [];
  }

  return data || [];
}

// ─────────────────────────────────────────
// 8. GET PATIENT COUNT
// ─────────────────────────────────────────
export async function getPatientCount(): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact' })
    .eq('role', 'patient');

  if (error) {
    console.error('Error fetching patient count:', error);
    return 0;
  }

  return count || 0;
}
