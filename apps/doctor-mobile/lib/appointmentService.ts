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
  dummy_account_id?: string; // For test/dummy accounts
  dentist_id: string | null;
  service: string;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  created_at?: string;
  updated_at?: string;
  patient_name?: string; // Patient name from profiles table or dummy_accounts table
  patient_avatar?: string; // Patient avatar URL from profiles table or dummy_accounts table
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

    // Step 2: Separate patients and dummy accounts
    const patientIds = [...new Set((appointmentsData as any[]).filter((apt: any) => apt.patient_id).map((apt: any) => apt.patient_id))];
    const dummyAccountIds = [...new Set((appointmentsData as any[]).filter((apt: any) => apt.dummy_account_id).map((apt: any) => apt.dummy_account_id))];

    // Step 3: Fetch profiles for real patients
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

    // Step 3b: Fetch dummy accounts
    let dummyAccountsData: any[] = [];
    if (dummyAccountIds.length > 0) {
      const { data, error: dummyError } = await supabase
        .from('dummy_accounts')
        .select('*')
        .in('id', dummyAccountIds);
      if (!dummyError) {
        dummyAccountsData = data || [];
      }
    }

    // Step 3c: Fetch medical intake data for all patients
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

    // Step 4: Create maps
    const profileMap = new Map();
    profilesData.forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    const dummyAccountMap = new Map();
    dummyAccountsData.forEach(dummy => {
      dummyAccountMap.set(dummy.id, dummy);
    });

    const medicalIntakeMap = new Map();
    medicalIntakeData.forEach(intake => {
      medicalIntakeMap.set(intake.patient_id, intake);
    });

    // Step 5: Transform appointments with patient names and avatars
    const transformedData = appointmentsData.map((apt: any) => {
      let patientName = 'Unknown Patient';
      let patientAvatar = null;
      let profile = null;

      if (apt.dummy_account_id) {
        // Fetch from dummy_accounts
        const dummyAccount = dummyAccountMap.get(apt.dummy_account_id);
        patientName = dummyAccount?.patient_name || apt.dummy_account_id;
        patientAvatar = dummyAccount?.avatar_url || null;
      } else if (apt.patient_id) {
        // Fetch from profiles
        profile = profileMap.get(apt.patient_id);
        patientName = profile?.full_name || profile?.name || profile?.user_name || apt.patient_id;
        patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;
      }

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

    // Separate patients and dummy accounts
    const patientIds = [...new Set(appointmentsData.filter((apt: any) => apt.patient_id).map((apt: any) => apt.patient_id))];
    const dummyAccountIds = [...new Set(appointmentsData.filter((apt: any) => apt.dummy_account_id).map((apt: any) => apt.dummy_account_id))];

    // Fetch profiles for real patients
    let profilesData: any[] = [];
    if (patientIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('id', patientIds);
      profilesData = data || [];
    }

    // Fetch dummy accounts
    let dummyAccountsData: any[] = [];
    if (dummyAccountIds.length > 0) {
      const { data, error } = await supabase
        .from('dummy_accounts')
        .select('*')
        .in('id', dummyAccountIds);
      if (error) {
        console.error('❌ [fallbackGetDoctorAppointments] Error fetching dummy accounts:', error);
      } else {
        dummyAccountsData = data || [];
      }
    }

    const profileMap = new Map();
    profilesData.forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    const dummyAccountMap = new Map();
    dummyAccountsData.forEach(dummy => {
      dummyAccountMap.set(dummy.id, dummy);
    });

    // Transform and return
    return appointmentsData.map((apt: any) => {
      let patientName = 'Unknown Patient';
      let patientAvatar = null;

      if (apt.dummy_account_id) {
        const dummyAccount = dummyAccountMap.get(apt.dummy_account_id);
        patientName = dummyAccount?.patient_name || apt.dummy_account_id;
        patientAvatar = dummyAccount?.avatar_url || null;
      } else if (apt.patient_id) {
        const profile = profileMap.get(apt.patient_id);
        patientName = profile?.full_name || profile?.name || profile?.user_name || apt.patient_id;
        patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;
      }

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

    // Step 2: Separate patients and dummy accounts
    const patientIds = [...new Set(appointmentsData.filter((apt: any) => apt.patient_id).map((apt: any) => apt.patient_id))];
    const dummyAccountIds = [...new Set(appointmentsData.filter((apt: any) => apt.dummy_account_id).map((apt: any) => apt.dummy_account_id))];

    // Step 3: Fetch profiles for real patients
    let profilesData: any[] = [];
    if (patientIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('id', patientIds);
      profilesData = data || [];
    }

    // Step 3b: Fetch dummy accounts
    let dummyAccountsData: any[] = [];
    if (dummyAccountIds.length > 0) {
      const { data, error } = await supabase
        .from('dummy_accounts')
        .select('*')
        .in('id', dummyAccountIds);
      if (error) {
        console.error('❌ [getDoctorAppointmentsByDate] Error fetching dummy accounts:', error);
      } else {
        dummyAccountsData = data || [];
      }
    }

    // Step 4: Create maps
    const profileMap = new Map();
    profilesData.forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    const dummyAccountMap = new Map();
    dummyAccountsData.forEach(dummy => {
      dummyAccountMap.set(dummy.id, dummy);
    });

    // Step 5: Transform appointments with patient names and avatars
    const transformedData = appointmentsData.map((apt: any) => {
      let patientName = 'Unknown Patient';
      let patientAvatar = null;

      if (apt.dummy_account_id) {
        const dummyAccount = dummyAccountMap.get(apt.dummy_account_id);
        patientName = dummyAccount?.patient_name || apt.dummy_account_id;
        patientAvatar = dummyAccount?.avatar_url || null;
      } else if (apt.patient_id) {
        const profile = profileMap.get(apt.patient_id);
        patientName = profile?.full_name || profile?.name || profile?.user_name || apt.patient_id;
        patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;
      }

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

    // Separate patients and dummy accounts
    const patientIds = [...new Set(appointmentsData.filter((apt: any) => apt.patient_id).map((apt: any) => apt.patient_id))];
    const dummyAccountIds = [...new Set(appointmentsData.filter((apt: any) => apt.dummy_account_id).map((apt: any) => apt.dummy_account_id))];

    // Fetch profiles for real patients
    let profilesData: any[] = [];
    if (patientIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('id', patientIds);
      profilesData = data || [];
    }

    // Fetch dummy accounts
    let dummyAccountsData: any[] = [];
    if (dummyAccountIds.length > 0) {
      const { data, error } = await supabase
        .from('dummy_accounts')
        .select('*')
        .in('id', dummyAccountIds);
      if (error) {
        console.error('❌ [fallbackGetAppointmentsByDate] Error fetching dummy accounts:', error);
      } else {
        dummyAccountsData = data || [];
      }
    }

    const profileMap = new Map();
    profilesData.forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    const dummyAccountMap = new Map();
    dummyAccountsData.forEach(dummy => {
      dummyAccountMap.set(dummy.id, dummy);
    });

    return appointmentsData.map((apt: any) => {
      let patientName = 'Unknown Patient';
      let patientAvatar = null;

      if (apt.dummy_account_id) {
        const dummyAccount = dummyAccountMap.get(apt.dummy_account_id);
        patientName = dummyAccount?.patient_name || apt.dummy_account_id;
        patientAvatar = dummyAccount?.avatar_url || null;
      } else if (apt.patient_id) {
        const profile = profileMap.get(apt.patient_id);
        patientName = profile?.full_name || profile?.name || profile?.user_name || apt.patient_id;
        patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;
      }

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