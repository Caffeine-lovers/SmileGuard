import { toMinutes } from './scheduling';
import { supabase } from '@smileguard/supabase-client';
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
  status: 'pending' | 'PENDING' | 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined';
  notes?: string;
  doctor_note?: string;
  rescheduled_by?: string | null;
  rescheduled_at?: string | null;
  created_at?: string;
  updated_at?: string;
  patient_name?: string; // Patient name from profiles table
  patient_avatar?: string | null;
  imageUrl?: string | number;
  profiles?: any;
  patient_profile?: any;
}

// ─────────────────────────────────────────
export async function getDoctorAppointments(
  dentistId: string | null,
  startDate?: string,
  endDate?: string
): Promise<DoctorAppointment[]> {
  try {
    // IMPORTANT: Use RPC function to bypass RLS policy that filters out cancelled appointments
    const { data: rpcAppointmentsData, error: rpcError } = await supabase.rpc('get_appointments_range', {
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_dentist_id: dentistId || null
    });

    if (rpcError) {
      // Fallback: Try direct query anyway
      return fallbackGetDoctorAppointments(dentistId, startDate, endDate);
    }

    let appointmentsData: any[] = rpcAppointmentsData ? [...rpcAppointmentsData] : [];

    // Supplement pending appointments (since RPC get_appointments_range excludes pending)
    try {
      let pendingQuery = supabase
        .from('appointments')
        .select('*')
        .or('status.ilike.pending,status.eq.pending,status.eq.PENDING');
      if (dentistId) {
        pendingQuery = pendingQuery.or(`dentist_id.eq.${dentistId},dentist_id.is.null`);
      }
      if (startDate) {
        pendingQuery = pendingQuery.gte('appointment_date', startDate);
      }
      if (endDate) {
        pendingQuery = pendingQuery.lte('appointment_date', endDate);
      }
      const { data: directPending } = await pendingQuery;
      if (directPending && directPending.length > 0) {
        const existingIds = new Set(appointmentsData.map((a: any) => a.id));
        for (const row of directPending) {
          if (!existingIds.has(row.id)) {
            appointmentsData.push(row);
            existingIds.add(row.id);
          }
        }
      }
    } catch (err) {
      // Safe fallback
    }

    if (!appointmentsData || appointmentsData.length === 0) {
      return [];
    }

    // Step 2: Separate patients and dummy accounts
    const patientIds = [...new Set((appointmentsData as any[]).filter((apt: any) => apt.patient_id).map((apt: any) => apt.patient_id))];

    console.log('🔍 [getDoctorAppointments] Debug Info:');
    console.log('  Total appointments:', appointmentsData.length);
    console.log('  Patient IDs to fetch:', patientIds);
    appointmentsData.forEach((apt: any, i: number) => {
      console.log(`    [${i}] patient_id: ${apt.patient_id}`);
    });

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

    console.log('  📊 Maps created:');
    console.log(`    - profileMap size: ${profileMap.size}`);

    const medicalIntakeMap = new Map();
    medicalIntakeData.forEach(intake => {
      medicalIntakeMap.set(intake.patient_id, intake);
    });

    // Fetch dummy patients
    let dummyPatientsData: any[] = [];
    try {
      const { data: dData } = await supabase.from('dummy_patients').select('*');
      if (dData) dummyPatientsData = dData;
    } catch {}

    const dummyPatientMap = new Map();
    dummyPatientsData.forEach(d => {
      dummyPatientMap.set(d.id, d);
    });

    // Step 5: Don't filter by current user's dentist_id - the RPC already filters to show
    // all appointments with dentist_id IS NOT NULL
    const filteredAppointments = appointmentsData as any[];

    // Step 6: Transform appointments with patient names and avatars
    const transformedData = filteredAppointments.map((apt: any) => {
      let patientName = 'Unknown Patient';
      let patientAvatar = null;
      let profile = null;

      if (apt.dummy_patient_id && dummyPatientMap.has(apt.dummy_patient_id)) {
        const dummy = dummyPatientMap.get(apt.dummy_patient_id);
        patientName = dummy.name;
        profile = {
          id: dummy.id,
          name: dummy.name,
          email: dummy.email || '',
          phone_number: dummy.phone || '',
          dummy: true,
        };
      } else if (apt.patient_id && profileMap.has(apt.patient_id)) {
        profile = profileMap.get(apt.patient_id);
        patientName = profile?.full_name || profile?.name || profile?.user_name || apt.patient_id;
        patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;
      } else if (apt.patient_id && dummyPatientMap.has(apt.patient_id)) {
        const dummy = dummyPatientMap.get(apt.patient_id);
        patientName = dummy.name;
        profile = {
          id: dummy.id,
          name: dummy.name,
          email: dummy.email || '',
          phone_number: dummy.phone || '',
          dummy: true,
        };
      }

      let medicalIntake = medicalIntakeMap.get(apt.patient_id);
      if (!medicalIntake && (apt.dummy_patient_id || apt.patient_id)) {
        const dummy = dummyPatientMap.get(apt.dummy_patient_id || apt.patient_id);
        if (dummy) {
          medicalIntake = {
            allergies: dummy.allergies || 'None',
            phone: dummy.phone || '',
            dateOfBirth: dummy.date_of_birth || '',
            gender: dummy.gender || '',
          };
        }
      }

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

    // Show only assigned appointments
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

    if (appointmentsError) {
      return [];
    }

    let allAppointments = appointmentsData ? [...appointmentsData] : [];

    // Supplement pending appointments (including those without dentist_id)
    try {
      let pendingQuery = supabase
        .from('appointments')
        .select('*')
        .or('status.ilike.pending,status.eq.pending,status.eq.PENDING');
      if (startDate) {
        pendingQuery = pendingQuery.gte('appointment_date', startDate);
      }
      if (endDate) {
        pendingQuery = pendingQuery.lte('appointment_date', endDate);
      }
      const { data: directPending } = await pendingQuery;
      if (directPending && directPending.length > 0) {
        const existingIds = new Set(allAppointments.map((a: any) => a.id));
        for (const row of directPending) {
          if (!existingIds.has(row.id)) {
            allAppointments.push(row);
            existingIds.add(row.id);
          }
        }
      }
    } catch (err) {
      // Safe fallback
    }

    if (!allAppointments || allAppointments.length === 0) {
      return [];
    }

    // Separate patients
    const patientIds = [...new Set(allAppointments.filter((apt: any) => apt.patient_id).map((apt: any) => apt.patient_id))];

    console.log('❗ [fallbackGetDoctorAppointments] RPC failed, using fallback:');
    console.log('  Total appointments:', allAppointments.length);
    console.log('  Patient IDs:', patientIds);

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

    const profileMap = new Map();
    profilesData.forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    const medicalIntakeMap = new Map();
    medicalIntakeData.forEach(intake => {
      medicalIntakeMap.set(intake.patient_id, intake);
    });

    let dummyPatientsData: any[] = [];
    try {
      const { data: dData } = await supabase.from('dummy_patients').select('*');
      if (dData) dummyPatientsData = dData;
    } catch {}

    const dummyPatientMap = new Map();
    dummyPatientsData.forEach(d => {
      dummyPatientMap.set(d.id, d);
    });

    // Transform and return
    return allAppointments.map((apt: any) => {
      let patientName = 'Unknown Patient';
      let patientAvatar = null;
      let profile = null;

      if (apt.dummy_patient_id && dummyPatientMap.has(apt.dummy_patient_id)) {
        const dummy = dummyPatientMap.get(apt.dummy_patient_id);
        patientName = dummy.name;
        profile = {
          id: dummy.id,
          name: dummy.name,
          email: dummy.email || '',
          phone_number: dummy.phone || '',
          dummy: true,
        };
      } else if (apt.patient_id && profileMap.has(apt.patient_id)) {
        profile = profileMap.get(apt.patient_id);
        patientName = profile?.full_name || profile?.name || profile?.user_name || apt.patient_id;
        patientAvatar = profile?.avatar_url || profile?.avatar || profile?.profile_picture || profile?.image_url || null;
      } else if (apt.patient_id && dummyPatientMap.has(apt.patient_id)) {
        const dummy = dummyPatientMap.get(apt.patient_id);
        patientName = dummy.name;
        profile = {
          id: dummy.id,
          name: dummy.name,
          email: dummy.email || '',
          phone_number: dummy.phone || '',
          dummy: true,
        };
      }

      let medicalIntake = medicalIntakeMap.get(apt.patient_id);
      if (!medicalIntake && (apt.dummy_patient_id || apt.patient_id)) {
        const dummy = dummyPatientMap.get(apt.dummy_patient_id || apt.patient_id);
        if (dummy) {
          medicalIntake = {
            allergies: dummy.allergies || 'None',
            phone: dummy.phone || '',
            dateOfBirth: dummy.date_of_birth || '',
            gender: dummy.gender || '',
          };
        }
      }

      return {
        ...apt,
        patient_name: patientName,
        patient_avatar: patientAvatar,
        profiles: profile || null,
        patient_profile: medicalIntake || null,
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
    const { data: rpcAppointmentsData, error: rpcError } = await supabase.rpc('get_appointments_by_date', {
      p_date: date,
      p_dentist_id: dentistId || null
    });

    if (rpcError) {
      // Fallback: Try direct query anyway
      return fallbackGetAppointmentsByDate(dentistId, date);
    }

    let appointmentsData: any[] = rpcAppointmentsData ? [...rpcAppointmentsData] : [];

    // Supplement pending appointments for this date (since RPC get_appointments_by_date excludes pending)
    try {
      let pendingQuery = supabase
        .from('appointments')
        .select('*')
        .eq('appointment_date', date)
        .or('status.ilike.pending,status.eq.pending,status.eq.PENDING');
      if (dentistId) {
        pendingQuery = pendingQuery.or(`dentist_id.eq.${dentistId},dentist_id.is.null`);
      }
      const { data: directPending } = await pendingQuery;
      if (directPending && directPending.length > 0) {
        const existingIds = new Set(appointmentsData.map((a: any) => a.id));
        for (const row of directPending) {
          if (!existingIds.has(row.id)) {
            appointmentsData.push(row);
            existingIds.add(row.id);
          }
        }
      }
    } catch (err) {
      // Safe fallback
    }

    if (!appointmentsData || appointmentsData.length === 0) {
      return [];
    }

    // Separate patients
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

    const profileMap = new Map();
    profilesData.forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    const medicalIntakeMap = new Map();
    medicalIntakeData.forEach(intake => {
      medicalIntakeMap.set(intake.patient_id, intake);
    });

    // Step 5: Show all appointments for this date (don't filter by dentist_id)
    const filteredAppointments = appointmentsData as any[];

    // Step 6: Transform appointments with patient names and avatars
    const transformedData = filteredAppointments.map((apt: any) => {
      let patientName = 'Unknown Patient';
      let patientAvatar = null;
      let profile = null;

      if (apt.patient_id) {
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

    // Show only assigned appointments
    query = query.not('dentist_id', 'is', null);

    const { data: appointmentsData, error } = await query
      .order('appointment_time', { ascending: true });

    if (error) {
      return [];
    }

    let allAppointments = appointmentsData ? [...appointmentsData] : [];

    // Supplement pending appointments for this date
    try {
      let pendingQuery = supabase
        .from('appointments')
        .select('*')
        .eq('appointment_date', date)
        .or('status.ilike.pending,status.eq.pending,status.eq.PENDING');
      const { data: directPending } = await pendingQuery;
      if (directPending && directPending.length > 0) {
        const existingIds = new Set(allAppointments.map((a: any) => a.id));
        for (const row of directPending) {
          if (!existingIds.has(row.id)) {
            allAppointments.push(row);
            existingIds.add(row.id);
          }
        }
      }
    } catch (err) {
      // Safe fallback
    }

    if (!allAppointments || allAppointments.length === 0) {
      return [];
    }

    // Separate patients
    const patientIds = [...new Set(allAppointments.filter((apt: any) => apt.patient_id).map((apt: any) => apt.patient_id))];

    // Fetch profiles for real patients
    let profilesData: any[] = [];
    if (patientIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('id', patientIds);
      profilesData = data || [];
    }

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

    const profileMap = new Map();
    profilesData.forEach(profile => {
      profileMap.set(profile.id, profile);
    });

    const medicalIntakeMap = new Map();
    medicalIntakeData.forEach(intake => {
      medicalIntakeMap.set(intake.patient_id, intake);
    });

    return allAppointments.map((apt: any) => {
      let patientName = 'Unknown Patient';
      let patientAvatar = null;
      let profile = null;

      if (apt.patient_id) {
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
  } catch (err: any) {
    return [];
  }
}

// ─────────────────────────────────────────
// UPDATE APPOINTMENT STATUS (for doctor dashboard)
// ─────────────────────────────────────────
export async function updateDoctorAppointmentStatus(
  appointmentId: string,
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined',
  doctorId: string,
  additionalUpdates?: { dentist_id?: string; doctor_note?: string }
): Promise<{ success: boolean; message: string }> {
  try {
    // Resolve which doctor ID to assign to the appointment
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const currentUserId = additionalUpdates?.dentist_id !== undefined
      ? additionalUpdates.dentist_id
      : (authUser?.id || doctorId);

    console.log('🔄 [updateDoctorAppointmentStatus] Calling RPC:', {
      appointmentId,
      status,
      dentist_id: currentUserId,
      doctor_note: additionalUpdates?.doctor_note,
    });

    // Use SECURITY DEFINER RPC — bypasses RLS so it can update unassigned rows
    let data: any = null;
    let error: any = null;

    // Try RPC with p_doctor_note parameter first (migration 039)
    const rpcResultWithNote = await supabase.rpc('update_appointment_status_with_dentist', {
      p_appointment_id: appointmentId,
      p_new_status: status,
      p_dentist_id: currentUserId,
      p_doctor_note: additionalUpdates?.doctor_note || null,
    });

    if (rpcResultWithNote.error && rpcResultWithNote.error.message?.includes('p_doctor_note')) {
      // Fallback to 3-parameter RPC if migration 039 is not yet run
      const fallbackResult = await supabase.rpc('update_appointment_status_with_dentist', {
        p_appointment_id: appointmentId,
        p_new_status: status,
        p_dentist_id: currentUserId,
      });
      data = fallbackResult.data;
      error = fallbackResult.error;

      // Also try direct update to set doctor_note if column exists
      if (!error && additionalUpdates?.doctor_note) {
        try {
          await supabase
            .from('appointments')
            .update({ doctor_note: additionalUpdates.doctor_note })
            .eq('id', appointmentId);
        } catch {
          // ignore if column not present yet
        }
      }
    } else {
      data = rpcResultWithNote.data;
      error = rpcResultWithNote.error;
    }

    console.log('📥 [updateDoctorAppointmentStatus] RPC raw response:', { data, error });

    if (error) {
      console.error('❌ [updateDoctorAppointmentStatus] RPC error:', error);
      return { success: false, message: error.message || 'RPC call failed' };
    }

    // The RPC returns TABLE — data is an array
    const result = Array.isArray(data) && data.length > 0 ? data[0] : data;

    console.log('📊 [updateDoctorAppointmentStatus] Parsed result:', result);

    if (!result || result.success === false) {
      console.error('❌ [updateDoctorAppointmentStatus] RPC returned failure:', result?.message);
      return { success: false, message: result?.message || 'Update failed — no rows modified' };
    }

    console.log('✅ [updateDoctorAppointmentStatus] Success:', result.message);
    return { success: true, message: result.message || 'Appointment updated successfully' };
  } catch (err) {
    console.error('❌ [updateDoctorAppointmentStatus] Exception:', err);
    return { success: false, message: `Exception: ${err}` };
  }
}



/**
 * Reschedule an appointment by updating its appointment_date, appointment_time, notes, and reschedule metadata.
 * Can be performed by an assistant or a doctor.
 */
export async function rescheduleAppointment(
  appointmentId: string,
  newDate: string,
  newTime?: string,
  notes?: string,
  rescheduledBy: 'assistant' | 'doctor' | string = 'assistant'
): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🔄 [rescheduleAppointment] Rescheduling:', {
      appointmentId,
      newDate,
      newTime,
      rescheduledBy,
      notes,
    });

    // 1. Try secure RPC first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('reschedule_appointment', {
        p_appointment_id: appointmentId,
        p_new_date: newDate,
        p_new_time: newTime || null,
        p_rescheduled_by: rescheduledBy,
        p_notes: notes || null,
      });

      if (!rpcError) {
        const result = Array.isArray(rpcData) && rpcData.length > 0 ? rpcData[0] : rpcData;
        if (result?.success) {
          return { success: true, message: result.message || 'Appointment rescheduled successfully.' };
        }
      } else {
        console.warn('⚠️ [rescheduleAppointment] RPC warning, falling back to direct update:', rpcError.message);
      }
    } catch (rpcEx) {
      console.warn('⚠️ [rescheduleAppointment] RPC exception, falling back to direct update:', rpcEx);
    }

    // 2. Direct fallback update
    const updatePayload: Record<string, any> = {
      appointment_date: newDate,
      rescheduled_by: rescheduledBy,
      rescheduled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'scheduled',
    };

    if (newTime && newTime.trim()) {
      updatePayload.appointment_time = newTime.trim();
    }

    if (notes !== undefined && notes !== null) {
      updatePayload.notes = notes.trim();
    }

    const { error: directError } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointmentId);

    if (directError) {
      console.error('❌ [rescheduleAppointment] Direct update error:', directError);
      return { success: false, message: directError.message || 'Failed to reschedule appointment.' };
    }

    return { success: true, message: 'Appointment rescheduled successfully.' };
  } catch (err) {
    console.error('❌ [rescheduleAppointment] Exception:', err);
    return { success: false, message: err instanceof Error ? err.message : 'Failed to reschedule appointment.' };
  }
}

// ─────────────────────────────────────────
// GET APPOINTMENT REQUESTS (PENDING APPROVAL)
// ─────────────────────────────────────────
/**
 * Confirm an appointment reschedule request.
 * Sets status to 'scheduled' and changes rescheduled_by to 'assistant' (or 'doctor').
 */
export async function confirmAppointmentReschedule(
  appointmentId: string,
  confirmedBy: 'assistant' | 'doctor' | string = 'assistant',
  dentistId?: string | null
): Promise<{ success: boolean; message: string }> {
  try {
    console.log('🔄 [confirmAppointmentReschedule] Confirming for:', { appointmentId, confirmedBy });

    // 1. Try dedicated confirm_appointment_reschedule RPC
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('confirm_appointment_reschedule', {
        p_appointment_id: appointmentId,
        p_confirmed_by: confirmedBy,
      });

      if (!rpcError) {
        const result = Array.isArray(rpcData) && rpcData.length > 0 ? rpcData[0] : rpcData;
        if (result?.success) {
          console.log('✅ [confirmAppointmentReschedule] RPC confirmed successfully');
        }
      }
    } catch (e) {
      console.warn('⚠️ [confirmAppointmentReschedule] RPC confirm_appointment_reschedule warning:', e);
    }

    // 2. Try reschedule_appointment RPC
    try {
      const { data: aptData } = await supabase
        .from('appointments')
        .select('appointment_date, appointment_time, notes')
        .eq('id', appointmentId)
        .maybeSingle();

      if (aptData) {
        await supabase.rpc('reschedule_appointment', {
          p_appointment_id: appointmentId,
          p_new_date: aptData.appointment_date,
          p_new_time: aptData.appointment_time || null,
          p_rescheduled_by: confirmedBy,
          p_notes: aptData.notes || null,
        });
      }
    } catch (e) {
      console.warn('⚠️ [confirmAppointmentReschedule] reschedule_appointment RPC warning:', e);
    }

    // 3. Fallback direct update to guarantee rescheduled_by is 'assistant'
    const { error: directError } = await supabase
      .from('appointments')
      .update({
        status: 'scheduled',
        rescheduled_by: confirmedBy,
        rescheduled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (directError) {
      console.warn('⚠️ [confirmAppointmentReschedule] Direct update notice:', directError.message);
    }

    // 4. Update status via updateDoctorAppointmentStatus to trigger doctor assignment & alerts
    const { data: { user: authUser } } = await supabase.auth.getUser();
    await updateDoctorAppointmentStatus(
      appointmentId,
      'scheduled',
      authUser?.id || '',
      {
        dentist_id: dentistId || undefined,
        doctor_note: `Reschedule confirmed by clinic ${confirmedBy}`,
      }
    );

    return { success: true, message: 'Reschedule confirmed successfully.' };
  } catch (err: any) {
    console.error('❌ [confirmAppointmentReschedule] Exception:', err);
    return { success: false, message: err?.message || 'Failed to confirm reschedule' };
  }
}

export async function getAppointmentRequests(): Promise<DoctorAppointment[]> {
  try {
    // Requests = status 'pending' (migration 032) plus legacy rows with no dentist assigned.
    // Prefer the SECURITY DEFINER RPC; fall back to a direct query if it isn't deployed.
    let appointmentsData: any[] | null = null;
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_appointment_requests');

    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      appointmentsData = rpcData as any[];
    }

    // Direct query fallback or supplement if RPC returned nothing (or legacy RPC in DB)
    if (!appointmentsData || appointmentsData.length === 0) {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .or('status.ilike.pending,status.eq.pending,status.eq.PENDING,dentist_id.is.null')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (error) {
        console.error('❌ Error fetching appointment requests via fallback:', error);
        appointmentsData = rpcData ? (rpcData as any[]) : [];
      } else if (data) {
        appointmentsData = data.filter((apt: any) => {
          const s = (apt.status || '').toLowerCase();
          return s === 'pending' || (!apt.dentist_id && !['cancelled', 'declined', 'completed', 'no-show'].includes(s));
        });
      }
    } else {
      // Also supplement any assigned 'pending' appointments that legacy RPC might have missed
      try {
        const { data: directPending } = await supabase
          .from('appointments')
          .select('*')
          .or('status.ilike.pending,status.eq.pending,status.eq.PENDING');

        if (directPending && directPending.length > 0) {
          const existingIds = new Set((appointmentsData || []).map((a: any) => a.id));
          for (const row of directPending) {
            const s = (row.status || '').toLowerCase();
            if (s === 'pending' && !existingIds.has(row.id)) {
              appointmentsData.push(row);
              existingIds.add(row.id);
            }
          }
        }
      } catch (err) {
        // Safe fallback
      }
    }

    // Clean out any cancelled, declined, or completed appointments
    if (appointmentsData && appointmentsData.length > 0) {
      appointmentsData = appointmentsData.filter((apt: any) => {
        const s = (apt.status || '').toLowerCase();
        return !['cancelled', 'declined', 'completed', 'no-show'].includes(s);
      });
    }

    if (!appointmentsData || appointmentsData.length === 0) {
      return [];
    }

    // Separate patients
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
      const { data, error } = await supabase
        .from('medical_intake')
        .select('*')
        .in('patient_id', patientIds);
      if (error) {
        console.error('❌ Error fetching medical intake for requests:', error);
      } else {
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
      let patientName = 'Unknown Patient';
      let patientAvatar = null;
      let profile = null;

      if (apt.patient_id) {
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
    console.error('❌ Exception fetching appointment requests:', err);
    return [];
  }
}

// ─────────────────────────────────────────
// GET APPOINTMENT BY ID (WITH PATIENT & MEDICAL INTAKE)
// ─────────────────────────────────────────
export async function getAppointmentById(
  appointmentId: string
): Promise<DoctorAppointment | null> {
  try {
    const { data: apt, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .maybeSingle();

    if (error || !apt) {
      console.warn('[getAppointmentById] Could not fetch appointment:', appointmentId, error);
      return null;
    }

    let profile: any = null;
    if (apt.patient_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', apt.patient_id)
        .maybeSingle();
      profile = prof;
    }

    let medicalIntake: any = null;
    if (apt.patient_id) {
      const { data: intake } = await supabase
        .from('medical_intake')
        .select('*')
        .eq('patient_id', apt.patient_id)
        .maybeSingle();
      medicalIntake = intake;
    }

    const patientName =
      profile?.full_name ||
      profile?.name ||
      profile?.user_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
      'Patient';

    const patientAvatar =
      profile?.avatar_url ||
      profile?.avatar ||
      profile?.profile_picture ||
      profile?.image_url ||
      null;

    return {
      ...apt,
      patient_name: patientName,
      patient_avatar: patientAvatar,
      profiles: profile || null,
      patient_profile: medicalIntake || null,
    };
  } catch (err) {
    console.error('[getAppointmentById] Exception fetching appointment:', err);
    return null;
  }
}


// ─────────────────────────────────────────
// CREATE DIRECT APPOINTMENT (Assistant / Clinic Booking)
// ─────────────────────────────────────────
export interface CreateDirectAppointmentInput {
  patient_id: string;
  is_dummy?: boolean;
  dentist_id?: string | null;
  service: string;
  appointment_date: string;
  appointment_time: string;
  notes?: string;
  status?: 'scheduled' | 'pending';
}

export async function createDirectAppointment(
  input: CreateDirectAppointmentInput
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    if (input.appointment_date < todayStr) {
      return { success: false, error: 'Cannot schedule appointment for a past date.' };
    }
    if (input.appointment_date === todayStr && input.appointment_time) {
      const slotMin = toMinutes(input.appointment_time);
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      if (!isNaN(slotMin) && slotMin <= currentMin) {
        return { success: false, error: 'Cannot schedule appointment for a past time slot. Please choose a future time.' };
      }
    }

    const payload: any = {
      dentist_id: input.dentist_id || null,
      service: input.service || 'General',
      appointment_date: input.appointment_date,
      appointment_time: input.appointment_time,
      status: input.status || 'scheduled',
      notes: input.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (input.is_dummy) {
      payload.dummy_patient_id = input.patient_id;
      payload.patient_id = null;
    } else {
      payload.patient_id = input.patient_id;
    }

    let { data, error } = await supabase
      .from('appointments')
      .insert(payload)
      .select()
      .single();

    if (error && (error.message?.includes('dummy_patient_id') || error.message?.includes('null value in column'))) {
      delete payload.dummy_patient_id;
      payload.patient_id = input.patient_id;
      const retry = await supabase.from('appointments').insert(payload).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('[createDirectAppointment] Error:', error);
      return { success: false, error: error.message };
    }

    // Safety fallback: ensure a billing row exists for the scheduled dummy appointment
    if (data?.id && input.is_dummy) {
      try {
        const { data: existingBill } = await supabase
          .from('billings')
          .select('id')
          .eq('appointment_id', data.id)
          .maybeSingle();

        if (!existingBill) {
          // If trigger didn't run or is not yet applied, create billing row
          await supabase.rpc('create_dummy_billing', {
            p_patient_id: input.patient_id,
            p_appointment_id: data.id,
            p_amount: 1500,
            p_discount_type: 'none',
            p_discount_amount: 0,
            p_final_amount: 1500,
            p_payment_status: 'not_paid',
          });
        }
      } catch (billSyncErr) {
        console.warn('[createDirectAppointment] Billing safeguard sync error (non-fatal):', billSyncErr);
      }
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('[createDirectAppointment] Exception:', err);
    return { success: false, error: err.message || 'Failed to schedule appointment' };
  }
}
