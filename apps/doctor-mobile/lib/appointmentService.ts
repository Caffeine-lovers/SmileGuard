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

    return { success: true, message: 'Appointment cancelled successfully.' };
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
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  created_at?: string;
  updated_at?: string;
  patient_name?: string; // Patient name from profiles table
  patient_avatar?: string; // Patient avatar URL from profiles table
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

    if (!appointmentsData) {
      return [];
    }

    if (appointmentsData.length === 0) {
      return [];
    }

    // Step 2: Get unique patient IDs
    const patientIds = [...new Set((appointmentsData as any[]).map((apt: any) => apt.patient_id))];

    // Step 3: Fetch profiles for all patients
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', patientIds);

    if (profilesError) {
      // Continue anyway with available data
    }

    // Step 3b: Fetch medical intake data for all patients
    const { data: medicalIntakeData, error: medicalIntakeError } = await supabase
      .from('medical_intake')
      .select('*')
      .in('patient_id', patientIds);

    if (medicalIntakeError) {
      // Continue anyway with available data
    }

    // Step 4: Create a map of patient ID -> profile
    const profileMap = new Map();
    (profilesData || []).forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    // Step 4b: Create a map of patient ID -> medical intake
    const medicalIntakeMap = new Map();
    (medicalIntakeData || []).forEach(intake => {
      medicalIntakeMap.set(intake.patient_id, intake);
    });

    // Step 5: Transform appointments with patient names and avatars
    const transformedData = appointmentsData.map((apt: any) => {
      const profile = profileMap.get(apt.patient_id);
      const medicalIntake = medicalIntakeMap.get(apt.patient_id);
      const patientName = profile?.full_name || profile?.name || profile?.user_name || apt.patient_id;
      const patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;

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

    if (dentistId && dentistId !== 'null') {
      query = query.eq('dentist_id', dentistId);
    } else {
      // If no dentistId provided, return empty (don't show null appointments)
      return [];
    }

    if (startDate) {
      query = query.gte('appointment_date', startDate);
    }
    if (endDate) {
      query = query.lte('appointment_date', endDate);
    }

    const { data: appointmentsData, error: appointmentsError } = await query
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });

    if (appointmentsError) {
      return [];
    }

    if (!appointmentsData || appointmentsData.length === 0) {
      return [];
    }

    // Get unique patient IDs and fetch profiles
    const patientIds = [...new Set(appointmentsData.map(apt => apt.patient_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', patientIds);

    const profileMap = new Map();
    (profilesData || []).forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    // Transform and return
    return appointmentsData.map((apt: any) => {
      const profile = profileMap.get(apt.patient_id);
      const patientName = profile?.full_name || profile?.name || profile?.user_name || apt.patient_id;
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

    if (!appointmentsData) {
      return [];
    }

    if (appointmentsData.length === 0) {
      return [];
    }

    // Step 2: Get unique patient IDs
    const patientIds = [...new Set(appointmentsData.map((apt: any) => apt.patient_id))];

    // Step 3: Fetch profiles for all patients
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', patientIds);

    if (profilesError) {
      // Continue anyway with available data
    }

    // Step 4: Create a map of patient ID -> profile
    const profileMap = new Map();
    (profilesData || []).forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    // Step 5: Transform appointments with patient names and avatars
    const transformedData = appointmentsData.map((apt: any) => {
      const profile = profileMap.get(apt.patient_id);
      const patientName = profile?.full_name || profile?.name || profile?.user_name || apt.patient_id;
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

    const { data: appointmentsData, error } = await query
      .order('appointment_time', { ascending: true });

    if (error) {
      return [];
    }

    if (!appointmentsData || appointmentsData.length === 0) {
      return [];
    }

    // Fetch profiles
    const patientIds = [...new Set(appointmentsData.map((apt: any) => apt.patient_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .in('id', patientIds);

    const profileMap = new Map();
    (profilesData || []).forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    return appointmentsData.map((apt: any) => {
      const profile = profileMap.get(apt.patient_id);
      return {
        ...apt,
        patient_name: profile?.full_name || profile?.name || profile?.user_name || apt.patient_id,
        patient_avatar: profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null,
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
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show',
  doctorId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Use RPC function to bypass RLS policies (same as AppointmentsTab)
    const { data, error } = await supabase.rpc('update_appointment_status', {
      p_appointment_id: appointmentId,
      p_new_status: status
    });

    if (error) {
      console.error('❌ RPC Error updating appointment status:', error);
      return { success: false, message: `Failed to update: ${error.message}` };
    }

    console.log('✅ Appointment status updated via RPC:', { appointmentId, status });
    return { success: true, message: 'Appointment status updated successfully' };
  } catch (err) {
    console.error('❌ Exception updating appointment status:', err);
    return { success: false, message: `Exception: ${err}` };
  }
}