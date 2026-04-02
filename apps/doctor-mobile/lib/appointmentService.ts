import { supabase } from './supabase';

export let TOTAL_SLOTS_PER_DAY = 14; // matches TIME_SLOTS.length in BookAppointment

export function setTotalSlotsPerDay(total: number): void {
  TOTAL_SLOTS_PER_DAY = total;
}

// ─────────────────────────────────────────
// 1. GET BOOKED SLOTS FOR A SINGLE DATE
// ─────────────────────────────────────────
export async function getBookedSlots(date: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('appointment_time')
    .eq('appointment_date', date)          // DATE = 'YYYY-MM-DD' direct match
    .neq('status', 'cancelled');

  if (error) {
    console.error('Error fetching booked slots:', error);
    return [];
  }

  return data.map((a) => a.appointment_time);
}

// ─────────────────────────────────────────
// 2. BOOK A SLOT
// ─────────────────────────────────────────
export async function bookSlot(
  patientId: string,
  dentistId: string,
  service: string,
  appointmentDate: string,
  appointmentTime: string
): Promise<{ success: boolean; message: string }> {
  const { data: existing, error: checkError } = await supabase
    .from('appointments')
    .select('id')
    .eq('appointment_date', appointmentDate)
    .eq('appointment_time', appointmentTime)
    .neq('status', 'cancelled');

  if (checkError) return { success: false, message: 'Error checking availability.' };
  if (existing && existing.length > 0) return { success: false, message: 'Sorry, this slot was just taken!' };

  const { error: insertError } = await supabase
    .from('appointments')
    .insert({
      patient_id: patientId,
      dentist_id: dentistId || null,
      service,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      status: 'scheduled',
    });

  if (insertError) {
    if (insertError.code === '23505') return { success: false, message: 'Slot was just taken by someone else!' };
    console.error('Booking error:', insertError);
    return { success: false, message: 'Booking failed. Please try again.' };
  }

  return { success: true, message: 'Appointment booked successfully!' };
}

// ─────────────────────────────────────────
// 3. CHECK IF DAY IS FULLY BOOKED
// ─────────────────────────────────────────
export async function checkDayFull(date: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id')
    .eq('appointment_date', date)
    .neq('status', 'cancelled');

  if (error) {
    console.error('Error checking day:', error);
    return false;
  }

  return (data?.length ?? 0) >= TOTAL_SLOTS_PER_DAY;
}

// ─────────────────────────────────────────
// 4. CANCEL AN APPOINTMENT
// ─────────────────────────────────────────
export async function cancelAppointment(
  appointmentId: string
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointmentId);

  if (error) {
    console.error('Cancellation error:', error);
    return { success: false, message: 'Cancellation failed. Please try again.' };
  }

  return { success: true, message: 'Appointment cancelled successfully.' };
}

// ─────────────────────────────────────────
// 5. GET ALL BLOCKED SLOTS (date + time pairs)
//    NOTE: No profiles join — avoids silent failures
//    if the FK relationship isn't registered in Supabase.
// ─────────────────────────────────────────
export interface BlockedSlot {
  date: string;
  time: string;
  patientId: string;
  service?: string;
}

export async function getAllBlockedSlots(): Promise<BlockedSlot[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('appointment_date, appointment_time, patient_id, service')
    .neq('status', 'cancelled')
    .order('appointment_date', { ascending: true });

  if (error) {
    console.error('Error fetching blocked slots:', error);
    return [];
  }

  return data.map((a: any) => ({
    date: a.appointment_date,       // 'YYYY-MM-DD'
    time: a.appointment_time,       // 'HH:MM'
    patientId: a.patient_id,
    service: a.service,
  }));
}

// ─────────────────────────────────────────
// 6. CHECK IF SPECIFIC DATE+TIME IS TAKEN
// ─────────────────────────────────────────
export function isSlotTaken(
  blockedSlots: BlockedSlot[],
  date: string,
  time: string
): boolean {
  return blockedSlots.some((slot) => slot.date === date && slot.time === time);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCTOR DASHBOARD SPECIFIC FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface DoctorAppointment {
  id: string;
  patient_id: string;
  dentist_id: string | null;
  service: string;
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string;
  status: 'scheduled' | 'arrived' | 'finished' | 'cancelled' | 'no-show';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PatientInfo {
  id: string;
  name: string;
  email: string;
  role?: string;
  service?: string;
  created_at?: string;
  updated_at?: string;
}

// ─────────────────────────────────────────
// GET ALL APPOINTMENTS FOR DOCTOR
// ─────────────────────────────────────────
export async function getDoctorAppointments(
  dentistId: string,
  startDate?: string,
  endDate?: string
): Promise<DoctorAppointment[]> {
  try {
    let query = supabase
      .from('appointments')
      .select('*')
      .or(`dentist_id.eq.${dentistId},dentist_id.is.null`)
      .neq('status', 'cancelled');

    if (startDate) {
      query = query.gte('appointment_date', startDate);
    }
    if (endDate) {
      query = query.lte('appointment_date', endDate);
    }

    const { data, error } = await query
      .order('appointment_date', { ascending: false })
      .order('appointment_time', { ascending: false });

    if (error) {
      console.error('Error fetching doctor appointments:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception fetching doctor appointments:', err);
    return [];
  }
}

// ─────────────────────────────────────────
// GET APPOINTMENTS FOR A SPECIFIC DATE
// ─────────────────────────────────────────
export async function getDoctorAppointmentsByDate(
  dentistId: string,
  date: string
): Promise<DoctorAppointment[]> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .or(`dentist_id.eq.${dentistId},dentist_id.is.null`)
      .eq('appointment_date', date)
      .neq('status', 'cancelled')
      .order('appointment_time', { ascending: true });

    if (error) {
      console.error('Error fetching appointments by date:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Exception fetching appointments by date:', err);
    return [];
  }
}

// ─────────────────────────────────────────
// GET PATIENT INFORMATION (from profiles table)
// ─────────────────────────────────────────
export async function getPatientInfo(patientId: string): Promise<PatientInfo | null> {
  try {
    console.log(`🔍 Fetching profile for patient_id: ${patientId}`);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', patientId);

    if (error) {
      console.error(`❌ Supabase error fetching patient ${patientId}:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return null;
    }

    // Handle case where profile doesn't exist
    if (!data || data.length === 0) {
      console.warn(`⚠️ No profile found for patient_id: ${patientId}`);
      console.warn(`📊 Query returned 0 rows - profile may not exist or RLS policy may be blocking access`);
      return null;
    }

    console.log(`✅ Profile found for ${patientId}:`, data[0]);
    return data[0] as PatientInfo;
  } catch (err) {
    console.error('❌ Exception fetching patient info:', err);
    return null;
  }
}

// ─────────────────────────────────────────
// UPDATE APPOINTMENT STATUS (for doctor dashboard)
// ─────────────────────────────────────────
export async function updateDoctorAppointmentStatus(
  appointmentId: string,
  status: 'scheduled' | 'arrived' | 'finished' | 'cancelled' | 'no-show'
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('appointments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', appointmentId);

    if (error) {
      console.error('Error updating appointment status:', error);
      return { success: false, message: 'Failed to update appointment status' };
    }

    return { success: true, message: 'Appointment status updated successfully' };
  } catch (err) {
    console.error('Exception updating appointment status:', err);
    return { success: false, message: 'Exception updating appointment status' };
  }
}

// ─────────────────────────────────────────
// GET TODAY'S APPOINTMENTS
// ─────────────────────────────────────────
export async function getTodayAppointments(dentistId: string): Promise<DoctorAppointment[]> {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD
  return getDoctorAppointmentsByDate(dentistId, dateStr);
}

// ─────────────────────────────────────────
// GET ENRICHED APPOINTMENTS (with patient details)
// ─────────────────────────────────────────
export async function getDoctorAppointmentsEnriched(
  dentistId: string,
  startDate?: string,
  endDate?: string
): Promise<
  Array<{
    id: string;
    name: string;
    email: string;
    service: string;
    appointment_date: string;
    appointment_time: string;
    status: string;
    role?: string;
    notes?: string;
  }>
> {
  try {
    const appointments = await getDoctorAppointments(dentistId, startDate, endDate);

    // Fetch patient details for each appointment
    const enrichedAppointments = await Promise.all(
      appointments.map(async (apt) => {
        const patient = await getPatientInfo(apt.patient_id);

        return {
          id: apt.id,
          name: patient?.name || 'Unknown Patient',
          email: patient?.email || '',
          service: apt.service,
          appointment_date: apt.appointment_date,
          appointment_time: apt.appointment_time,
          status: apt.status,
          role: patient?.role,
          notes: apt.notes,
        };
      })
    );

    return enrichedAppointments;
  } catch (err) {
    console.error('Exception fetching enriched appointments:', err);
    return [];
  }
}

// ─────────────────────────────────────────
// GET DOCTOR STATISTICS
// ─────────────────────────────────────────
export async function getDoctorStats(dentistId: string): Promise<{
  totalPatients: number;
  totalAppointments: number;
  upcomingAppointments: number;
  completedAppointments: number;
}> {
  try {
    const today = new Date().toLocaleDateString('en-CA');

    // Get all non-cancelled appointments
    const { data: allApts, error: allError } = await supabase
      .from('appointments')
      .select('id, status, appointment_date')
      .or(`dentist_id.eq.${dentistId},dentist_id.is.null`)
      .neq('status', 'cancelled');

    if (allError) throw allError;

    // Get unique patients
    const { data: patients, error: patientsError } = await supabase
      .from('appointments')
      .select('patient_id')
      .or(`dentist_id.eq.${dentistId},dentist_id.is.null`)
      .neq('status', 'cancelled');

    if (patientsError) throw patientsError;

    const uniquePatients = new Set(patients?.map((p) => p.patient_id) || []);
    const upcoming = allApts?.filter((a) => a.appointment_date >= today).length || 0;
    const completed = allApts?.filter((a) => a.status === 'finished').length || 0;

    return {
      totalPatients: uniquePatients.size,
      totalAppointments: allApts?.length || 0,
      upcomingAppointments: upcoming,
      completedAppointments: completed,
    };
  } catch (err) {
    console.error('Exception fetching doctor stats:', err);
    return {
      totalPatients: 0,
      totalAppointments: 0,
      upcomingAppointments: 0,
      completedAppointments: 0,
    };
  }
}