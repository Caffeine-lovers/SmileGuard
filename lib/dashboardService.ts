/**
 * Dashboard Service
 * Fetches dashboard data from Supabase tables
 */

import { supabase } from './supabase';
import { Appointment } from '@smileguard/shared-types';

// Export type for enhanced appointments with patient details
export interface AppointmentWithPatient extends Appointment {
  patient_name?: string;
  patient_email?: string;
  patient_phone?: string;
}

// ─────────────────────────────────────────
// APPOINTMENTS
// ─────────────────────────────────────────

/**
 * Fetch appointments for a specific doctor
 * Maps to Supabase 'appointments' table
 */
export async function fetchDoctorAppointments(doctorId: string): Promise<{
  success: boolean;
  data: Appointment[];
  message: string;
}> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        dentist_id,
        service,
        appointment_date,
        appointment_time,
        status,
        notes,
        created_at,
        updated_at
      `)
      .eq('dentist_id', doctorId)
      .order('appointment_date', { ascending: false });

    if (error) {
      console.error('❌ Error fetching appointments:', error);
      return { success: false, data: [], message: error.message };
    }

    // Transform to match the dashboard format
    const appointments: Appointment[] = (data || []).map((apt: any) => ({
      id: apt.id,
      patient_id: apt.patient_id,
      dentist_id: apt.dentist_id,
      service: apt.service,
      appointment_date: apt.appointment_date,
      appointment_time: apt.appointment_time,
      status: apt.status,
      notes: apt.notes,
      created_at: apt.created_at,
      updated_at: apt.updated_at,
    }));

    console.log(`✅ Fetched ${appointments.length} appointments for doctor ${doctorId}`);
    return { success: true, data: appointments, message: 'Appointments fetched successfully' };
  } catch (err) {
    console.error('❌ Exception fetching appointments:', err);
    return { success: false, data: [], message: 'Failed to fetch appointments' };
  }
}

/**
 * Fetch all appointments for a doctor with patient details
 * Joins appointments with patient profiles
 */
export async function fetchDoctorAppointmentsWithPatients(doctorId: string): Promise<{
  success: boolean;
  data: any[];
  message: string;
}> {
  try {
    // Fetch appointments
    const { data: appointments, error: aptError } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        dentist_id,
        service,
        appointment_date,
        appointment_time,
        status,
        notes,
        created_at,
        updated_at
      `)
      .eq('dentist_id', doctorId)
      .order('appointment_date', { ascending: false });

    if (aptError) {
      console.error('❌ Error fetching appointments:', aptError);
      return { success: false, data: [], message: aptError.message };
    }

    if (!appointments || appointments.length === 0) {
      console.log('ℹ️ No appointments found');
      return { success: true, data: [], message: 'No appointments found' };
    }

    // Get unique patient IDs
    const patientIds = [...new Set(appointments.map(a => a.patient_id))];

    // Fetch patient profiles
    const { data: patients, error: patError } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .in('id', patientIds);

    if (patError) {
      console.error('❌ Error fetching patient profiles:', patError);
      // Continue with patient data as null if fetch fails
    }

    // Create a map of patients by ID for quick lookup
    const patientMap = (patients || []).reduce((acc: any, patient: any) => {
      acc[patient.id] = patient;
      return acc;
    }, {});

    // Combine appointment data with patient information
    const enrichedAppointments = appointments.map((apt: any) => ({
      ...apt,
      patient_name: patientMap[apt.patient_id]?.name || 'Patient',
      patient_email: patientMap[apt.patient_id]?.email || '',
      patient_phone: patientMap[apt.patient_id]?.phone || '',
    }));

    console.log(`✅ Fetched ${enrichedAppointments.length} appointments with patient details`);
    return { success: true, data: enrichedAppointments, message: 'Appointments with patients fetched successfully' };
  } catch (err) {
    console.error('❌ Exception fetching appointments with patients:', err);
    return { success: false, data: [], message: 'Failed to fetch appointments' };
  }
}

/**
 * Fetch today's appointments for a doctor
 * Maps to Supabase 'appointments' table with DATE filter
 */
export async function fetchTodayAppointments(doctorId: string, date: string): Promise<{
  success: boolean;
  data: Appointment[];
  message: string;
}> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        dentist_id,
        service,
        appointment_date,
        appointment_time,
        status,
        notes,
        created_at,
        updated_at
      `)
      .eq('dentist_id', doctorId)
      .eq('appointment_date', date)
      .order('appointment_time', { ascending: true });

    if (error) {
      console.error('❌ Error fetching today appointments:', error);
      return { success: false, data: [], message: error.message };
    }

    const appointments: Appointment[] = (data || []).map((apt: any) => ({
      id: apt.id,
      patient_id: apt.patient_id,
      dentist_id: apt.dentist_id,
      service: apt.service,
      appointment_date: apt.appointment_date,
      appointment_time: apt.appointment_time,
      status: apt.status,
      notes: apt.notes,
      created_at: apt.created_at,
      updated_at: apt.updated_at,
    }));

    console.log(`✅ Fetched ${appointments.length} appointments for today (${date})`);
    return { success: true, data: appointments, message: 'Today appointments fetched successfully' };
  } catch (err) {
    console.error('❌ Exception fetching today appointments:', err);
    return { success: false, data: [], message: 'Failed to fetch today appointments' };
  }
}

// ─────────────────────────────────────────
// APPOINTMENT STATS
// ─────────────────────────────────────────

/**
 * Get appointment statistics for a doctor
 * Counts appointments in each status category
 */
export async function getAppointmentStats(doctorId: string): Promise<{
  success: boolean;
  stats: {
    total: number;
    scheduled: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  message: string;
}> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('status')
      .eq('dentist_id', doctorId);

    if (error) {
      console.error('❌ Error fetching stats:', error);
      return {
        success: false,
        stats: { total: 0, scheduled: 0, completed: 0, cancelled: 0, noShow: 0 },
        message: error.message,
      };
    }

    const appointments = data || [];
    const stats = {
      total: appointments.length,
      scheduled: appointments.filter(a => a.status === 'scheduled').length,
      completed: appointments.filter(a => a.status === 'completed').length,
      cancelled: appointments.filter(a => a.status === 'cancelled').length,
      noShow: appointments.filter(a => a.status === 'no-show').length,
    };

    console.log('✅ Stats:', stats);
    return { success: true, stats, message: 'Stats fetched successfully' };
  } catch (err) {
    console.error('❌ Exception fetching stats:', err);
    return {
      success: false,
      stats: { total: 0, scheduled: 0, completed: 0, cancelled: 0, noShow: 0 },
      message: 'Failed to fetch stats',
    };
  }
}

// ─────────────────────────────────────────
// PATIENTS
// ─────────────────────────────────────────

/**
 * Fetch all patients associated with a doctor
 * Gets unique patients from appointments
 */
export async function fetchDoctorPatients(doctorId: string): Promise<{
  success: boolean;
  data: any[];
  message: string;
}> {
  try {
    // Get unique patient IDs from appointments
    const { data: appointments, error: aptError } = await supabase
      .from('appointments')
      .select('patient_id')
      .eq('dentist_id', doctorId);

    if (aptError) {
      console.error('❌ Error fetching patient IDs:', aptError);
      return { success: false, data: [], message: aptError.message };
    }

    if (!appointments || appointments.length === 0) {
      console.log('ℹ️ No patients found for this doctor');
      return { success: true, data: [], message: 'No patients found' };
    }

    // Get unique patient IDs
    const uniquePatientIds = [...new Set(appointments.map(a => a.patient_id))];

    // Fetch patient profiles
    const { data: patients, error: patError } = await supabase
      .from('profiles')
      .select('id, name, email, role')
      .in('id', uniquePatientIds)
      .eq('role', 'patient');

    if (patError) {
      console.error('❌ Error fetching patient profiles:', patError);
      return { success: false, data: [], message: patError.message };
    }

    console.log(`✅ Fetched ${patients?.length || 0} patients for doctor ${doctorId}`);
    return { success: true, data: patients || [], message: 'Patients fetched successfully' };
  } catch (err) {
    console.error('❌ Exception fetching patients:', err);
    return { success: false, data: [], message: 'Failed to fetch patients' };
  }
}

// ─────────────────────────────────────────
// APPOINTMENT DETAILS
// ─────────────────────────────────────────

/**
 * Fetch appointment with patient details
 * Combines appointments and profiles tables
 */
export async function fetchAppointmentWithPatientDetails(appointmentId: string): Promise<{
  success: boolean;
  data: any;
  message: string;
}> {
  try {
    const { data: appointment, error } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        dentist_id,
        service,
        appointment_date,
        appointment_time,
        status,
        notes,
        created_at,
        updated_at
      `)
      .eq('id', appointmentId)
      .single();

    if (error) {
      console.error('❌ Error fetching appointment:', error);
      return { success: false, data: null, message: error.message };
    }

    // Fetch patient details
    let result = appointment || {};
    if (appointment?.patient_id) {
      const { data: patient } = await supabase
        .from('profiles')
        .select('id, name, email, phone, role')
        .eq('id', appointment.patient_id)
        .single();

      result = { ...appointment, patient };
    }

    console.log('✅ Appointment with details fetched');
    return { success: true, data: result, message: 'Appointment fetched successfully' };
  } catch (err) {
    console.error('❌ Exception fetching appointment details:', err);
    return { success: false, data: null, message: 'Failed to fetch appointment' };
  }
}

// ─────────────────────────────────────────
// AVAILABILITY & SCHEDULING
// ─────────────────────────────────────────

/**
 * Check doctor's available time slots for a given date
 * Returns booked times so available slots can be calculated
 */
export async function getBookedTimeSlots(doctorId: string, date: string): Promise<{
  success: boolean;
  bookedTimes: string[];
  message: string;
}> {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('appointment_time')
      .eq('dentist_id', doctorId)
      .eq('appointment_date', date)
      .in('status', ['scheduled', 'completed']);

    if (error) {
      console.error('❌ Error fetching booked times:', error);
      return { success: false, bookedTimes: [], message: error.message };
    }

    const bookedTimes = (data || []).map(a => a.appointment_time);
    console.log(`✅ Found ${bookedTimes.length} booked slots for ${date}`);
    return { success: true, bookedTimes, message: 'Booked times fetched' };
  } catch (err) {
    console.error('❌ Exception fetching booked times:', err);
    return { success: false, bookedTimes: [], message: 'Failed to fetch booked times' };
  }
}
