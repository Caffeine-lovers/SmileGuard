import { supabase } from './supabase';
export async function cancelAppointment(
  appointmentId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Use RPC function to bypass RLS (same as update_appointment_status)
    const { data, error } = await supabase.rpc('update_appointment_status', {
      p_appointment_id: appointmentId,
      p_new_status: 'cancelled'
    });

    if (error) {
      return { success: false, message: 'Cancellation failed. Please try again.' };
    }

    // RPC returns TABLE type, so data is an array
    const result = Array.isArray(data) && data.length > 0 ? data[0] : data;
    
    if (result?.success) {
      return { success: true, message: 'Appointment cancelled successfully.' };
    } else {
      return { success: false, message: 'Cancellation failed. Please try again.' };
    }
  } catch (err) {
    return { success: false, message: 'Cancellation failed. Please try again.' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCTOR DASHBOARD SPECIFIC TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface DoctorAppointment {
  id: string;
  patient_id: string;
  dentist_id: string | null;
  service: string;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined';
  notes?: string;
  created_at?: string;
  updated_at?: string;
  patient_name?: string;
  patient_avatar?: string;
}

// ─────────────────────────────────────────
export async function getDoctorAppointments(
  dentistId: string | null,
  startDate?: string,
  endDate?: string
): Promise<DoctorAppointment[]> {
  try {
    // IMPORTANT: Use RPC function to bypass RLS policy that filters out cancelled appointments
    const { data: appointmentsData, error: rpcError } = await supabase.rpc('get_appointments_range', {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_dentist_id: dentistId || null
    });

    if (rpcError) {
      // Fallback: Try direct query anyway
      return fallbackGetDoctorAppointments(dentistId, startDate, endDate);
    }

    if (!appointmentsData || appointmentsData.length === 0) {
      return [];
    }

    const patientIds = [...new Set((appointmentsData as any[]).filter((apt: any) => apt.patient_id).map((apt: any) => apt.patient_id))];

    // Fetch profiles for patients
    let profilesData: any[] = [];
    if (patientIds.length > 0) {
      const { data, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', patientIds);
      if (!profilesError) {
        profilesData = data || [];
      }
    }

    // Fetch medical intake data for all patients
    let medicalIntakeData: any[] = [];
    if (patientIds.length > 0) {
      const { data, error: medicalIntakeError } = await supabase
        .from('medical_intake')
        .select('*')
        .in('patient_id', patientIds);
      if (!medicalIntakeError) {
        medicalIntakeData = data || [];
      }
    }

    // Create maps
    const profileMap = new Map();
    profilesData.forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    const medicalIntakeMap = new Map();
    medicalIntakeData.forEach(intake => {
      medicalIntakeMap.set(intake.patient_id, intake);
    });

    // Transform appointments with patient names and avatars
    const transformedData = appointmentsData.map((apt: any) => {
      const profile = profileMap.get(apt.patient_id);
      const patientName = profile?.full_name || profile?.name || profile?.user_name || 'Patient';
      const patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;
      const medicalIntake = medicalIntakeMap.get(apt.patient_id);

      return {
        ...apt,
        patient_name: patientName,
        patient_avatar: patientAvatar,
        profiles: profile || null,
        patient_profile: medicalIntake || null,
      };
    });

    return transformedData || [];
  } catch (err: any) {
    return [];
  }
}

// ─────────────────────────────────────────
// FALLBACK: Direct query if RPC fails
// ─────────────────────────────────────────
async function fallbackGetDoctorAppointments(
  dentistId: string | null,
  startDate?: string,
  endDate?: string
): Promise<DoctorAppointment[]> {
  try {
    let query = supabase
      .from('appointments')
      .select('*');

    // Show only assigned appointments (dentist_id IS NOT NULL)
    query = query.not('dentist_id', 'is', null);

    if (startDate) {
      query = query.gte('appointment_date', startDate);
    }
    if (endDate) {
      query = query.lte('appointment_date', endDate);
    }

    const { data: appointmentsData, error: appointmentsError } = await query
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });

    if (appointmentsError || !appointmentsData || appointmentsData.length === 0) {
      return [];
    }

    const patientIds = [...new Set(appointmentsData.filter((apt: any) => apt.patient_id).map((apt: any) => apt.patient_id))];

    // Fetch profiles for real patients
    let profilesData: any[] = [];
    if (patientIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('id', patientIds);
      profilesData = data || [];
    }

    const profileMap = new Map();
    profilesData.forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    // Transform and return
    return appointmentsData.map((apt: any) => {
      const profile = profileMap.get(apt.patient_id);
      const patientName = profile?.full_name || profile?.name || profile?.user_name || 'Patient';
      const patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;

      return {
        ...apt,
        patient_name: patientName,
        patient_avatar: patientAvatar,
      };
    });
  } catch (err: any) {
    return [];
  }
}

// ─────────────────────────────────────────
// GET APPOINTMENTS FOR A SPECIFIC DATE
// ─────────────────────────────────────────
export async function getDoctorAppointmentsByDate(
  dentistId: string | null,
  date: string
): Promise<DoctorAppointment[]> {
  try {
    // IMPORTANT: Use RPC function to bypass RLS policy that filters out cancelled appointments
    const { data: appointmentsData, error: rpcError } = await supabase.rpc('get_appointments_by_date', {
      p_date: date,
      p_dentist_id: dentistId || null
    });

    if (rpcError) {
      // Fallback: Try direct query anyway
      return fallbackGetAppointmentsByDate(dentistId, date);
    }

    if (!appointmentsData || appointmentsData.length === 0) {
      return [];
    }

    const patientIds = [...new Set(appointmentsData.filter((apt: any) => apt.patient_id).map((apt: any) => apt.patient_id))];

    // Step 3: Fetch profiles for real patients
    let profilesData: any[] = [];
    if (patientIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('id', patientIds);
      profilesData = data || [];
    }

    // Step 4: Create maps
    const profileMap = new Map();
    profilesData.forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    // Step 6: Transform appointments with patient names and avatars
    const transformedData = appointmentsData.map((apt: any) => {
      const profile = profileMap.get(apt.patient_id);
      const patientName = profile?.full_name || profile?.name || profile?.user_name || 'Patient';
      const patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;

      return {
        ...apt,
        patient_name: patientName,
        patient_avatar: patientAvatar,
      };
    });

    return transformedData || [];
  } catch (err: any) {
    return fallbackGetAppointmentsByDate(dentistId, date);
  }
}

// ─────────────────────────────────────────
// FALLBACK: Direct query (if RPC fails)
// ─────────────────────────────────────────
async function fallbackGetAppointmentsByDate(
  dentistId: string | null,
  date: string
): Promise<DoctorAppointment[]> {
  try {
    let query = supabase
      .from('appointments')
      .select('*')
      .eq('appointment_date', date);

    // Show only assigned appointments (dentist_id IS NOT NULL)
    query = query.not('dentist_id', 'is', null);

    const { data: appointmentsData, error } = await query
      .order('appointment_time', { ascending: true });

    if (error || !appointmentsData || appointmentsData.length === 0) {
      return [];
    }

    const patientIds = [...new Set(appointmentsData.filter((apt: any) => apt.patient_id).map((apt: any) => apt.patient_id))];

    // Fetch profiles for real patients
    let profilesData: any[] = [];
    if (patientIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('id', patientIds);
      profilesData = data || [];
    }

    const profileMap = new Map();
    profilesData.forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    return appointmentsData.map((apt: any) => {
      const profile = profileMap.get(apt.patient_id);
      const patientName = profile?.full_name || profile?.name || profile?.user_name || 'Patient';
      const patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;

      return {
        ...apt,
        patient_name: patientName,
        patient_avatar: patientAvatar,
      };
    });
  } catch (err: any) {
    return [];
  }
}

// ─────────────────────────────────────────
// UPDATE APPOINTMENT STATUS (for doctor dashboard)
// ─────────────────────────────────────────
export async function updateDoctorAppointmentStatus(
  appointmentId: string,
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined',
  doctorId: string,
  additionalUpdates?: { dentist_id?: string }
): Promise<{ success: boolean; message: string }> {
  try {
    // Get current auth user to get dentist_id
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const currentUserId = authUser?.id || doctorId;

    // Use RPC function to update both status and dentist_id
    const { data, error } = await supabase.rpc('update_appointment_status_with_dentist', {
      p_appointment_id: appointmentId,
      p_new_status: status,
      p_dentist_id: currentUserId
    });

    if (error) {
      console.error('❌ Error updating appointment status with dentist_id:', error);
      return { success: false, message: `Failed to update: ${error.message}` };
    }

    // RPC returns TABLE type, so data is an array
    const result = Array.isArray(data) && data.length > 0 ? data[0] : data;
    
    if (!result || !result.success) {
      console.error('❌ RPC returned failure:', result);
      return { success: false, message: result?.message || 'Failed to update appointment' };
    }

    console.log('✅ Appointment status and dentist_id updated via RPC:', { appointmentId, status, dentist_id: currentUserId });
    return { success: true, message: 'Appointment updated successfully' };
  } catch (err) {
    console.error('❌ Exception updating appointment status:', err);
    return { success: false, message: `Exception: ${err}` };
  }
}

// ─────────────────────────────────────────
// GET APPOINTMENT REQUESTS (NO DENTIST ASSIGNED)
// ─────────────────────────────────────────
export async function getAppointmentRequests(): Promise<DoctorAppointment[]> {
  try {
    // Fetch all appointments where dentist_id IS NULL
    const { data: appointmentsData, error } = await supabase
      .from('appointments')
      .select('*')
      .is('dentist_id', null)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true });

    if (error || !appointmentsData || appointmentsData.length === 0) {
      return [];
    }

    // Fetch profiles for all patients
    const patientIds = [...new Set(appointmentsData.filter((apt: any) => apt.patient_id).map((apt: any) => apt.patient_id))];

    // Fetch profiles for real patients
    let profilesData: any[] = [];
    if (patientIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('id', patientIds);
      profilesData = data || [];
    }

    // Fetch medical intake data for all patients
    let medicalIntakeData: any[] = [];
    if (patientIds.length > 0) {
      const { data, error: medicalIntakeError } = await supabase
        .from('medical_intake')
        .select('*')
        .in('patient_id', patientIds);
      if (!medicalIntakeError) {
        medicalIntakeData = data || [];
      }
    }

    // Create maps
    const profileMap = new Map();
    profilesData.forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    const medicalIntakeMap = new Map();
    medicalIntakeData.forEach(intake => {
      medicalIntakeMap.set(intake.patient_id, intake);
    });

    // Transform appointments with patient names and avatars
    const transformedData = appointmentsData.map((apt: any) => {
      const profile = profileMap.get(apt.patient_id);
      const patientName = profile?.full_name || profile?.name || profile?.user_name || 'Patient';
      const patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;
      const medicalIntake = medicalIntakeMap.get(apt.patient_id);

      return {
        ...apt,
        patient_name: patientName,
        patient_avatar: patientAvatar,
        profiles: profile || null,
        patient_profile: medicalIntake || null,
      };
    });

    return transformedData || [];
  } catch (err: any) {
    console.error('❌ Exception fetching appointment requests:', err);
    return [];
  }
}