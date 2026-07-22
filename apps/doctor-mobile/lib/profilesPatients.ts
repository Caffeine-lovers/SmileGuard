import { supabase } from '@smileguard/supabase-client';
import { CurrentUser, MedicalIntake } from '../types/index';

// ─────────────────────────────────────────
// 0. FETCH PATIENT PROFILE PICTURE FROM STORAGE
// ─────────────────────────────────────────
/**
 * Fetches the most recent profile picture for a patient from Supabase storage
 * Path structure: patient-pictures/profile/{patientId}/image.jpg
 * Returns the public URL of the most recent image
 */
export async function getPatientProfilePictureUrl(
  patientId: string
): Promise<string | null> {
  try {
    console.log(`🖼️ Fetching profile picture for patient: ${patientId}`);
    
    // List all files in the patient's profile picture folder
    const { data: files, error: listError } = await supabase.storage
      .from('avatars')
      .list(`${patientId}`, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }, // Most recent first
      });

    if (listError) {
      console.log(`⚠️ Error listing profile pictures for patient ${patientId}:`, listError);
      return null;
    }

    if (!files || files.length === 0) {
      console.log(`ℹ️ No profile pictures found for patient ${patientId}`);
      return null;
    }

    // Find the first image file with an extension (most recent due to sorting)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const mostRecentFile = files.find(file => 
      imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
    );
    
    if (!mostRecentFile) {
      console.log(`ℹ️ No image files found in profile pictures for patient ${patientId}`);
      console.log(`📁 Files found:`, files.map(f => f.name));
      return null;
    }

    // Get the public URL for the file
    const { data: publicUrl } = supabase.storage
      .from('avatars')
      .getPublicUrl(`${patientId}/${mostRecentFile.name}`);

    if (!publicUrl?.publicUrl) {
      console.log(`⚠️ Failed to generate public URL for patient ${patientId}`);
      return null;
    }

    // Add cache-busting timestamp to force fresh image load instead of serving cached version
    const urlWithCacheBuster = `${publicUrl.publicUrl}?t=${new Date().getTime()}`;
    
    console.log(`✅ Profile picture URL generated for patient ${patientId}:`, urlWithCacheBuster);
    return urlWithCacheBuster;
  } catch (error) {
    console.error(`❌ Exception fetching profile picture for patient ${patientId}:`, error);
    return null;
  }
}

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
    .select('*')
    .eq('patient_id', patientId);

  if (error) {
    return null;
  }

  // If no records found, return null
  if (!data || data.length === 0) {
    return null;
  }

  // Use the first record
  const record = data[0];

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
    notes: record.notes || '',
  };
}

// ─────────────────────────────────────────
// 2A. FETCH PATIENT MEDICAL INFO
// ─────────────────────────────────────────
export async function getPatientMedicalInfo(
  patientId: string
): Promise<MedicalIntake | null> {
  try {
    console.log('✅ Fetching medical info from medical_intake');
    return await getPatientMedicalIntake(patientId);
  } catch (error) {
    console.error('❌ Error fetching patient medical info:', error);
    return null;
  }
}

// ─────────────────────────────────────────
// 2B. FETCH PATIENT APPOINTMENTS
// ─────────────────────────────────────────
export async function getPatientAppointments(
  patientId: string
): Promise<
  Array<{
    id: string;
    patient_id: string;
    service: string;
    appointment_date: string;
    appointment_time?: string;
    status: string;
    notes?: string;
    created_at: string;
    dentist_id?: string;
  }>
> {
  try {
    console.log(`🔍 Fetching appointments for patient: ${patientId}`);
    
    const { data, error } = await supabase
      .from('appointments')
      .select('id, patient_id, service, appointment_date, status, notes, created_at, dentist_id', { count: 'exact' })
      .eq('patient_id', patientId)
      .order('appointment_date', { ascending: false });

    if (error) {
      console.error(`❌ Error fetching appointments for patient ${patientId}:`, error);
      return [];
    }

    if (!data) {
      console.log(`ℹ️ No appointments data returned for patient ${patientId}`);
      return [];
    }

    const statusBreakdown = {
      scheduled: data.filter(a => a.status === 'scheduled').length,
      completed: data.filter(a => a.status === 'completed').length,
      cancelled: data.filter(a => a.status === 'cancelled').length,
      'no-show': data.filter(a => a.status === 'no-show').length,
    };
    console.log(`✅ Fetched ${data.length} appointments for patient ${patientId}. Breakdown:`, statusBreakdown);

    return data || [];
  } catch (error) {
    console.error(`❌ Exception fetching patient appointments for ${patientId}:`, error);
    return [];
  }
}

// ─────────────────────────────────────────
// 2C. UPDATE APPOINTMENT STATUS
// ─────────────────────────────────────────
export async function updateAppointmentStatus(
  appointmentId: string,
  status: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', appointmentId);

  if (error) {
    return { success: false, message: 'Failed to update appointment' };
  }

  return { success: true, message: 'Appointment status updated' };
}

// ─────────────────────────────────────────
// 2D. UPDATE PATIENT MEDICAL INFO
// ─────────────────────────────────────────
export async function updatePatientMedicalInfo(
  patientId: string,
  medicalData: Partial<MedicalIntake>
): Promise<{ success: boolean; message: string }> {
  return await updatePatientMedicalIntake(patientId, medicalData);
}

// ─────────────────────────────────────────
// 2E. UPDATE PATIENT MEDICAL INTAKE
export async function updatePatientMedicalIntake(
  patientId: string,
  medicalData: Partial<MedicalIntake>
): Promise<{ success: boolean; message: string }> {
  try {
    // Convert camelCase to snake_case for database
    const dbData: any = {};
    
    if (medicalData.dateOfBirth !== undefined) dbData.date_of_birth = medicalData.dateOfBirth;
    if (medicalData.gender !== undefined) dbData.gender = medicalData.gender;
    if (medicalData.phone !== undefined) dbData.phone = medicalData.phone;
    if (medicalData.address !== undefined) dbData.address = medicalData.address;
    if (medicalData.emergencyContactName !== undefined) dbData.emergency_contact_name = medicalData.emergencyContactName;
    if (medicalData.emergencyContactPhone !== undefined) dbData.emergency_contact_phone = medicalData.emergencyContactPhone;
    if (medicalData.allergies !== undefined) dbData.allergies = medicalData.allergies;
    if (medicalData.currentMedications !== undefined) dbData.current_medications = medicalData.currentMedications;
    if (medicalData.medicalConditions !== undefined) dbData.medical_conditions = medicalData.medicalConditions;
    if (medicalData.pastSurgeries !== undefined) dbData.past_surgeries = medicalData.pastSurgeries;
    if (medicalData.smokingStatus !== undefined) dbData.smoking_status = medicalData.smokingStatus;
    if (medicalData.pregnancyStatus !== undefined) dbData.pregnancy_status = medicalData.pregnancyStatus;
    if (medicalData.notes !== undefined) dbData.notes = medicalData.notes;

    // First, check if medical_intake record exists for this patient
    const { data: existingData, error: checkError } = await supabase
      .from('medical_intake')
      .select('id')
      .eq('patient_id', patientId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is expected
      return { success: false, message: 'Error checking medical intake record' };
    }

    if (existingData) {
      // Update existing medical intake
      const { error: updateError } = await supabase
        .from('medical_intake')
        .update(dbData)
        .eq('patient_id', patientId);

      if (updateError) {
        console.error('Error updating medical intake:', updateError);
        return { success: false, message: 'Failed to update medical intake' };
      }
    } else {
      // Create new medical intake record
      const { error: insertError } = await supabase
        .from('medical_intake')
        .insert([{ patient_id: patientId, ...dbData }]);

      if (insertError) {
        console.error('Error creating medical intake:', insertError);
        return { success: false, message: 'Failed to create medical intake' };
      }
    }

    return { success: true, message: 'Medical intake updated successfully' };
  } catch (error) {
    console.error('Exception updating medical intake:', error);
    return { success: false, message: 'Exception updating medical intake' };
  }
}

// ─────────────────────────────────────────
// 2E. AUTO-UPDATE PAST APPOINTMENTS
// ─────────────────────────────────────────
export async function updatePastAppointmentsToNoShow(
  appointments: any[]
): Promise<void> {
  const now = new Date();
  
  for (const appt of appointments) {
    const apptDate = new Date(appt.appointment_date);
    
    // If appointment is in the past and status is not already no-show, completed, or cancelled
    // IMPORTANT: Don't override cancelled appointments - preserve their status
    if (apptDate < now && appt.status !== 'no-show' && appt.status !== 'completed' && appt.status !== 'cancelled') {
      await updateAppointmentStatus(appt.id, 'no-show');
    }
  }
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
    role?: string;
  }>
> {
  // Fetch medical intake data
  const { data: medicalData, error: medicalError } = await supabase
    .from('medical_intake')
    .select('id, patient_id, created_at, phone, gender, allergies, medical_conditions')
    .limit(100);

  if (medicalError) {
    return [];
  }

  if (!medicalData || medicalData.length === 0) {
    // Try fallback: fetch from profiles instead and get all patient info
    return getAllPatientsFromProfiles();
  }

  // Get unique patient IDs
  const patientIds = [...new Set(medicalData.map((m: any) => m.patient_id))];

  // Fetch corresponding profiles (only patients with role='patient')
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email, service, role')
    .in('id', patientIds)
    .eq('role', 'patient');

  if (profileError) {
    // Continue with partial data
  }

  // Map profiles into a lookup object
  const profileMap = (profileData || []).reduce((acc: any, profile: any) => {
    acc[profile.id] = profile;
    return acc;
  }, {});

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
      role: profile.role || '',
    };
  });

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
    role?: string;
  }>
> {
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, email, service, created_at, role')
    .eq('role', 'patient');

  if (profilesError || !profilesData) {
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
    role: profile.role || '',
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
// 6. SEARCH PATIENTS BY NAME OR EMAIL
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

// ─────────────────────────────────────────
// 9. FETCH PATIENT BILLING INFORMATION
// ─────────────────────────────────────────
export interface PatientBillingInfo {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  overdueAmount: number;
  billingCount: number;
}

export async function getPatientBillingInfo(patientId: string): Promise<PatientBillingInfo | null> {
  try {
    const { data, error } = await supabase
      .from('billings')
      .select('amount, final_amount, payment_status')
      .eq('patient_id', patientId);

    if (error) {
      console.error('Error fetching patient billing info:', error);
      return null;
    }

    if (!data || data.length === 0) {
      // Return zero values if no billing records found
      return {
        totalAmount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        overdueAmount: 0,
        billingCount: 0,
      };
    }

    let totalAmount = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    let overdueAmount = 0;

    data.forEach((billing: any) => {
      const amount = billing.final_amount || billing.amount || 0;
      totalAmount += amount;

      if (billing.payment_status === 'paid') {
        paidAmount += amount;
      } else if (billing.payment_status === 'pending') {
        pendingAmount += amount;
      } else if (billing.payment_status === 'overdue') {
        overdueAmount += amount;
      }
    });

    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
      billingCount: data.length,
    };
  } catch (error) {
    console.error('Exception fetching patient billing info:', error);
    return null;
  }
}
