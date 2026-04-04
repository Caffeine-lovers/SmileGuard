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
  console.log('=== MEDICAL INTAKE FETCH DEBUG ===');
  console.log('PatientID to query:', patientId, 'Type:', typeof patientId);
  
  // DEBUG: Get current logged-in user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('Current user:', { 
    uid: user?.id,
    email: user?.email,
    error: userError
  });
  
  // DEBUG: Check current user's role in profiles
  if (user?.id) {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('id', user.id)
      .single();
    
    console.log('Current user profile:', userProfile);
  }
  
  // Step 1: Get ALL records (no filter) to see what exists
  const { data: allRecords, error: allError } = await supabase
    .from('medical_intake')
    .select('id, patient_id')
    .limit(10);
  
  console.log('Step 1 - All records in table (no filter):', {
    count: allRecords?.length,
    error: allError,
    records: allRecords?.map(r => ({ id: r.id, patient_id: r.patient_id, matchesQuery: r.patient_id === patientId }))
  });
  
  // Step 2: Try filtered query
  const { data: filtered, error: filterError } = await supabase
    .from('medical_intake')
    .select('id, patient_id, gender, phone')
    .eq('patient_id', patientId);
  
  console.log('Step 2 - Filtered query (.eq("patient_id", patientId)):', {
    count: filtered?.length,
    error: filterError,
    records: filtered
  });
  
  // Step 3: Try fetching ALL columns for this patient
  const { data, error } = await supabase
    .from('medical_intake')
    .select('*')
    .eq('patient_id', patientId);

  console.log('Step 3 - Full record fetch:', { 
    count: data?.length, 
    error,
    firstRecord: data?.[0]
  });
  console.log('=== END DEBUG ===');
  
  if (error) {
    console.error('Error fetching medical intake:', error);
    return null;
  }

  // If no records found, return null
  if (!data || data.length === 0) {
    console.warn('No medical intake records found for patient:', patientId);
    return null;
  }

  // Use the first record
  const record = data[0];
  console.log('Medical intake record found:', record);

  // Map database fields to camelCase for the app
  return {
    dateOfBirth: record.date_of_birth || '',
    gender: record.gender || '',
    phone: record.phone || '',
    address: record.address || '',
    emergencyContactName: record.emergency_contact_name || '',
    emergencyContactPhone: record.emergency_contact_phone || '',
    allergies: record.allergies || '',
    currentMedications: record.current_medications || '',
    medicalConditions: record.medical_conditions || '',
    pastSurgeries: record.past_surgeries || '',
    smokingStatus: record.smoking_status || '',
    pregnancyStatus: record.pregnancy_status || '',
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
    patient_id: string;
    name?: string;
    email?: string;
    service?: string;
    created_at: string;
    phone?: string;
    gender?: string;
    allergies?: string;
    medical_conditions?: string;
  }>
> {
  // First, try to fetch ALL columns from medical_intake to test access
  const { data: allData, error: allError } = await supabase
    .from('medical_intake')
    .select('*');

  console.log('All columns fetch result:', { count: allData?.length, allError });

  // Then fetch specific columns
  const { data: medicalData, error: medicalError } = await supabase
    .from('medical_intake')
    .select('id, patient_id, created_at, phone, gender, allergies, medical_conditions')
    .limit(100);

  console.log('Medical data fetch result:', { medicalData, medicalError });

  if (medicalError) {
    console.error('Error fetching medical intake:', medicalError);
    return [];
  }

  if (!medicalData || medicalData.length === 0) {
    console.warn('No medical intake records found');
    // Try fallback: fetch from profiles instead and get all patient info
    return getAllPatientsFromProfiles();
  }

  console.log('Found medical records:', medicalData.length);

  // Get unique patient IDs
  const patientIds = [...new Set(medicalData.map((m: any) => m.patient_id))];
  console.log('Patient IDs to fetch:', patientIds);

  // Fetch corresponding profiles
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email, service')
    .in('id', patientIds);

  console.log('Profile data fetch result:', { profileData, profileError });

  if (profileError) {
    console.error('Error fetching profiles:', profileError);
  }

  // Map profiles into a lookup object
  const profileMap = (profileData || []).reduce((acc: any, profile: any) => {
    acc[profile.id] = profile;
    return acc;
  }, {});

  console.log('Profile map:', profileMap);

  // Combine medical_intake with profiles
  const result = medicalData.map((item: any) => {
    const profile = profileMap[item.patient_id] || {};
    return {
      id: item.patient_id,  // ← Use patient_id as the ID, not medical_intake's ID
      patient_id: item.patient_id,
      name: profile.name || 'Unknown Patient',
      email: profile.email || '',
      service: profile.service || 'General',
      created_at: item.created_at,
      phone: item.phone || '',
      gender: item.gender || '',
      allergies: item.allergies || '',
      medical_conditions: item.medical_conditions || '',
    };
  });

  console.log('Final result:', result);
  return result;
}

// Fallback: Get patients from profiles table
async function getAllPatientsFromProfiles(): Promise<
  Array<{
    id: string;
    patient_id: string;
    name?: string;
    email?: string;
    service?: string;
    created_at: string;
    phone?: string;
    gender?: string;
    allergies?: string;
    medical_conditions?: string;
  }>
> {
  console.log('Using fallback: fetching from profiles table');
  
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, email, service, created_at')
    .eq('role', 'patient');

  console.log('Profiles fetch result:', { count: profilesData?.length, profilesError });

  if (profilesError || !profilesData) {
    console.error('Error fetching profiles fallback:', profilesError);
    return [];
  }

  // Map profiles to the same format
  return profilesData.map((profile: any) => ({
    id: profile.id,
    patient_id: profile.id,
    name: profile.name || 'Unknown Patient',
    email: profile.email || '',
    service: profile.service || 'General',
    created_at: profile.created_at,
    phone: '',
    gender: '',
    allergies: '',
    medical_conditions: '',
  }));
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
