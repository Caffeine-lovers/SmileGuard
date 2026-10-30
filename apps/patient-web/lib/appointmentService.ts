import { supabase } from '@smileguard/supabase-client';
import { formatDoctorDisplayName, getDoctorTitleName, Doctor } from '@smileguard/shared-types';

export let TOTAL_SLOTS_PER_DAY = 4; // matches TIME_SLOTS.length in BookAppointment (10 AM - 2 PM with 1-hour intervals)

export function setTotalSlotsPerDay(total: number): void {
  TOTAL_SLOTS_PER_DAY = total;
}

export function withTimeout<T>(promise: PromiseLike<T> | Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ─────────────────────────────────────────
// CLINIC SETUP & HOURS UTILITIES
// ─────────────────────────────────────────

export interface ClinicSchedule {
  sunday: { isOpen: boolean; opening_time: string; closing_time: string };
  monday: { isOpen: boolean; opening_time: string; closing_time: string };
  tuesday: { isOpen: boolean; opening_time: string; closing_time: string };
  wednesday: { isOpen: boolean; opening_time: string; closing_time: string };
  thursday: { isOpen: boolean; opening_time: string; closing_time: string };
  friday: { isOpen: boolean; opening_time: string; closing_time: string };
  saturday: { isOpen: boolean; opening_time: string; closing_time: string };
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Parse 12-hour format time (e.g., "10:00 AM") to 24-hour format
function parse12HourTime(timeString: string): { hour: number; minute: number } {
  console.log(`🔄 Parsing time string: "${timeString}"`);
  
  const match = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  
  if (!match) {
    console.error(`❌ Invalid time format: "${timeString}". Expected format: "HH:MM AM/PM"`);
    return { hour: 9, minute: 0 }; // Fallback
  }
  
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hour !== 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }
  
  console.log(`✅ Converted "${timeString}" to ${hour}:${String(minute).padStart(2, '0')} (24-hour format)`);
  
  return { hour, minute };
}

export const DEFAULT_CLINIC_NAME = "Kyler's Clinic";
export const DEFAULT_DOCTOR_ID = "7c9b5331-3f19-4560-8256-44c7742e11ad";

export interface ClinicDetails {
  id: string;
  user_id: string;
  clinic_name: string;
  address?: string;
  services?: { id: string; name: string; price?: number }[];
  schedule: ClinicSchedule;
}

const FALLBACK_KYLER_CLINIC: ClinicDetails = {
  id: "6572586e-f38b-4d1e-894c-52f038228282",
  user_id: DEFAULT_DOCTOR_ID,
  clinic_name: DEFAULT_CLINIC_NAME,
  address: "Malabon",
  services: [
    { id: "default_service_1", name: "Cleaning", price: 1500 },
    { id: "default_service_2", name: "Whitening", price: 5000 },
    { id: "default_service_3", name: "Fillings", price: 2000 },
    { id: "default_service_4", name: "Root Canal", price: 8000 },
    { id: "default_service_5", name: "Extraction", price: 1500 },
    { id: "default_service_6", name: "Braces Consultation", price: 35000 },
    { id: "default_service_7", name: "Implants Consultation", price: 45000 },
    { id: "default_service_8", name: "X-Ray", price: 500 },
    { id: "default_service_9", name: "Checkup", price: 300 },
    { id: "1792844640600", name: "Scan", price: 1500 },
  ],
  schedule: {
    friday: { isOpen: true, opening_time: "10:00 AM", closing_time: "3:00 PM" },
    monday: { isOpen: false, opening_time: "10:00 AM", closing_time: "3:00 PM" },
    sunday: { isOpen: false, opening_time: "10:00 AM", closing_time: "5:00 PM" },
    tuesday: { isOpen: true, opening_time: "10:00 AM", closing_time: "3:00 PM" },
    saturday: { isOpen: true, opening_time: "10:00 AM", closing_time: "3:00 PM" },
    thursday: { isOpen: true, opening_time: "10:00 AM", closing_time: "3:00 PM" },
    wednesday: { isOpen: true, opening_time: "10:00 AM", closing_time: "3:00 PM" },
  },
};

// Get full clinic setup — defaults to Kyler's Clinic
export async function getFullClinicSetup(): Promise<ClinicDetails | null> {
  try {
    const clinics = await getAllClinicsSetup();
    if (clinics.length > 0) {
      // Prioritize Kyler's Clinic
      const kyler = clinics.find((c) => c.clinic_name.toLowerCase().includes('kyler'));
      return kyler || clinics[0];
    }
    return FALLBACK_KYLER_CLINIC;
  } catch (error) {
    console.error('❌ Error getting full clinic setup:', error);
    return FALLBACK_KYLER_CLINIC;
  }
}

// Get all clinics registered in clinic_setup, ordered with Kyler's Clinic first
export async function getAllClinicsSetup(): Promise<ClinicDetails[]> {
  try {
    const { data, error } = await supabase
      .from('clinic_setup')
      .select('id, user_id, clinic_name, address, services, schedule');

    if (error || !data || data.length === 0) {
      return [FALLBACK_KYLER_CLINIC];
    }

    const list: ClinicDetails[] = data.map((row: any) => {
      let servicesList: any[] = [];
      if (Array.isArray(row.services)) {
        servicesList = row.services;
      } else if (typeof row.services === 'string') {
        try {
          servicesList = JSON.parse(row.services);
        } catch {}
      }

      return {
        id: row.id,
        user_id: row.user_id,
        clinic_name: row.clinic_name || DEFAULT_CLINIC_NAME,
        address: row.address,
        services: servicesList,
        schedule: row.schedule || FALLBACK_KYLER_CLINIC.schedule,
      };
    });

    // Sort Kyler's Clinic first by default
    list.sort((a, b) => {
      const aKyler = a.clinic_name.toLowerCase().includes('kyler') ? -1 : 1;
      const bKyler = b.clinic_name.toLowerCase().includes('kyler') ? -1 : 1;
      return aKyler - bKyler;
    });

    return list;
  } catch (error) {
    console.error('❌ Error getting all clinics:', error);
    return [FALLBACK_KYLER_CLINIC];
  }
}

// Get clinic setup with schedule information
export async function getClinicSetup(): Promise<ClinicSchedule | null> {
  try {
    // Fetch the first available clinic setup (shared clinic)
    // Patients don't have their own clinic setup, so we fetch any available one
    const { data, error } = await supabase
      .from('clinic_setup')
      .select('schedule')
      .limit(1);

    if (error) {
      console.error('❌ Error fetching clinic setup:', error.message);
      return null;
    }

    if (!data || data.length === 0 || !data[0]?.schedule) {
      console.warn('⚠️ No clinic schedule found');
      return null;
    }

    console.log('✅ Loaded clinic schedule:', JSON.stringify(data[0].schedule, null, 2));
    return data[0].schedule;
  } catch (error) {
    console.error('❌ Error getting clinic setup:', error);
    return null;
  }
}

// Generate available time slots based on clinic hours
// Returns array of time strings like ['09:00', '09:30', '10:00', ...]
export function generateTimeSlots(clinicSchedule: ClinicSchedule | null, year: number, month: number, day: number): string[] {
  if (!clinicSchedule) {
    console.warn('⚠️ No clinic schedule provided, returning empty slots');
    return [];
  }

  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  const dayName = DAY_NAMES[dayOfWeek];
  
  const daySchedule = clinicSchedule[dayName as keyof ClinicSchedule];
  
  if (!daySchedule || !daySchedule.isOpen) {
    console.log(`🚫 ${dayName} is closed (isOpen = false)`);
    return [];
  }

  const openingTime = parse12HourTime(daySchedule.opening_time);
  const closingTime = parse12HourTime(daySchedule.closing_time);
  
  const slots: string[] = [];
  let currentHour = openingTime.hour;
  let currentMinute = openingTime.minute;
  
  // Generate slots in 1-hour intervals until one hour before closing
  while (currentHour < closingTime.hour || (currentHour === closingTime.hour && currentMinute < closingTime.minute - 60)) {
    slots.push(`${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`);
    
    currentHour += 1;
  }

  console.log(`📊 Generated ${slots.length} time slots for ${dayName} (${daySchedule.opening_time} - ${daySchedule.closing_time}):`, slots);
  return slots;
}

// ─────────────────────────────────────────
// 1. GET BOOKED SLOTS FOR A SINGLE DATE
// ─────────────────────────────────────────
export async function getBookedSlots(date: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('appointment_time')
    .eq('appointment_date', date)
    .not('status', 'in', '(cancelled,declined)');

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
): Promise<{ success: boolean; message: string; appointmentId?: string }> {
  console.log('bookSlot called:', { patientId, dentistId, service, appointmentDate, appointmentTime });
  
  // Validation: No same-day booking allowed (must be at least 1 day in advance)
  const todayStr = new Date().toISOString().slice(0, 10);
  if (appointmentDate <= todayStr) {
    return {
      success: false,
      message: 'Same-day booking is not permitted. Please schedule your appointment at least 1 day in advance.',
    };
  }

  const { data: existing, error: checkError } = await supabase
    .from('appointments')
    .select('id')
    .eq('appointment_date', appointmentDate)
    .eq('appointment_time', appointmentTime)
    .not('status', 'in', '(cancelled,declined)');

  if (checkError) {
    console.error('Check availability error:', checkError);
    return { success: false, message: `Error checking availability: ${checkError.message}` };
  }
  if (existing && existing.length > 0) return { success: false, message: 'Sorry, this slot was just taken!' };

  let insertedData: any = null;
  let insertError: any = null;

  const insertRes = await supabase
    .from('appointments')
    .insert({
      patient_id: patientId,
      dentist_id: dentistId || null,
      service,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      status: 'pending', // awaits clinic approval; doctor app sets 'scheduled' on accept
    })
    .select('id');

  insertedData = insertRes.data;
  insertError = insertRes.error;

  // Resilient fallback if DB check constraint does not yet allow 'pending' (migration 032 not yet applied)
  if (insertError && (insertError.message?.toLowerCase().includes('check') || insertError.code === '23514')) {
    console.warn('⚠️ appointments_status_check in DB does not yet allow "pending". Retrying with legacy unapproved format (dentist_id=null)...');
    const fallbackRes = await supabase
      .from('appointments')
      .insert({
        patient_id: patientId,
        dentist_id: null, // Marks as unassigned request
        service,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        status: 'scheduled',
      })
      .select('id');

    insertedData = fallbackRes.data;
    insertError = fallbackRes.error;
  }

  if (insertError) {
    console.error('Insert Error Detail:', insertError);
    if (insertError.code === '23505') return { success: false, message: 'Slot was just taken by someone else!' };
    console.error('Booking error:', insertError);
    return { success: false, message: 'Booking failed. Please try again.' };
  }

  const appointmentId = insertedData?.[0]?.id;
  return { success: true, message: 'Appointment booked successfully!', appointmentId };
}

// ─────────────────────────────────────────
// 3. CHECK IF DAY IS FULLY BOOKED
// ─────────────────────────────────────────
export async function checkDayFull(date: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id')
    .eq('appointment_date', date)
    .not('status', 'in', '(cancelled,declined)');

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
// ─────────────────────────────────────────
export interface BlockedSlot {
  date: string;
  time: string;
  patientId: string;
  service?: string;
}

export interface BlockoutDate {
  blockout_date: string;
  is_blocked: boolean;
  blockout_start_time?: string;
  blockout_end_time?: string;
}

export async function getBlockoutDates(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('clinic_blockout_dates')
      .select('blockout_date, is_blocked')
      .eq('is_blocked', true);

    if (error) {
      console.error('❌ Error fetching blockout dates:', error);
      return [];
    }

    const dates = (data || []).map((d: any) => d.blockout_date);
    console.log(`✅ [getBlockoutDates] Loaded ${dates.length} blockout dates:`, dates);
    return dates;
  } catch (err) {
    console.error('❌ Exception in getBlockoutDates:', err);
    return [];
  }
}

export async function getAllBlockedSlots(clinicSchedule?: ClinicSchedule | null): Promise<BlockedSlot[]> {
  console.log('🔍 [getAllBlockedSlots] Starting to fetch blocked slots...');

  // ❌ PRIORITY 1: Fetch blockout dates FIRST (highest priority - overrides everything)
  const { data: blockoutDates, error: blockoutError } = await supabase
    .from('clinic_blockout_dates')
    .select('blockout_date, is_blocked')
    .eq('is_blocked', true);

  if (blockoutError) {
    console.error('❌ Error fetching blockout dates:', blockoutError);
  } else {
    console.log(`✅ [BLOCKOUT DATES] Found ${blockoutDates?.length || 0} specific blockout dates:`, blockoutDates);
  }

  // Convert blockout dates to blocked slots
  const blockoutSlots: BlockedSlot[] = [];
  const blockedDateSet = new Set<string>();
  
  if (blockoutDates && blockoutDates.length > 0) {
    // Fallback time slots if clinic schedule is not available
    const DEFAULT_TIME_SLOTS = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    ];
    
    for (const blockout of blockoutDates) {
      blockedDateSet.add(blockout.blockout_date);
      console.log(`🚫 [BLOCKOUT] Blocking ALL TIME SLOTS for: ${blockout.blockout_date}`);
      
      // Always register an ALL_DAY entry so BookAppointment immediately marks the entire date as blocked
      blockoutSlots.push({
        date: blockout.blockout_date,
        time: 'ALL_DAY',
        patientId: 'system-blockout',
        service: 'blocked',
      });

      const year = parseInt(blockout.blockout_date.split('-')[0]);
      const month = parseInt(blockout.blockout_date.split('-')[1]);
      const day = parseInt(blockout.blockout_date.split('-')[2]);
      
      // Use generated slots if clinic schedule exists, otherwise use fallback
      const availableSlots = clinicSchedule 
        ? generateTimeSlots(clinicSchedule, year, month, day) 
        : DEFAULT_TIME_SLOTS;
      
      console.log(`   Generated ${availableSlots.length} slots for ${blockout.blockout_date}`);
      
      for (const timeSlot of availableSlots) {
        blockoutSlots.push({
          date: blockout.blockout_date,
          time: timeSlot,
          patientId: 'system-blockout',
          service: 'blocked',
        });
      }
    }
  }

  // ✅ PRIORITY 2: Fetch booked appointments (only for dates NOT in blockout)
  const { data: appointments, error: appointmentError } = await supabase
    .from('appointments')
    .select('appointment_date, appointment_time, patient_id, service')
    .not('status', 'in', '(cancelled,declined)')
    .order('appointment_date', { ascending: true });

  if (appointmentError) {
    console.error('❌ Error fetching booked slots:', appointmentError);
  } else {
    console.log(`✅ [BOOKED APPOINTMENTS] Found ${appointments?.length || 0} booked appointments`);
  }

  // Only add booked appointments for dates that are NOT already blocked
  const bookedSlots = (appointments || [])
    .filter(a => !blockedDateSet.has(a.appointment_date)) // Skip blocked dates
    .map((a: any) => ({
      date: a.appointment_date,
      time: a.appointment_time,
      patientId: a.patient_id,
      service: a.service,
    }));

  // Combine: blockout dates (high priority) + booked appointments
  const combined = [...blockoutSlots, ...bookedSlots];
  console.log(`📋 [RESULT] Total blocked slots: ${combined.length} (${blockoutSlots.length} blockout + ${bookedSlots.length} booked)`);
  
  return combined;
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

// ─────────────────────────────────────────
// 7. GET APPOINTMENTS FOR PATIENT
// ─────────────────────────────────────────
export async function getPatientAppointments(
  patientId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .eq('patient_id', patientId)
    .order('appointment_date', { ascending: false });

  if (error) {
    console.error('Error fetching patient appointments:', error);
    return [];
  }

  return data || [];
}

// ─────────────────────────────────────────
// 8. GET DOCTOR DETAILS & NAME BY DENTIST ID
// ─────────────────────────────────────────
export interface DoctorDetails {
  name: string | null;
  profilePictureUrl: string | null;
}

export async function getDoctorDetails(dentistId: string): Promise<DoctorDetails> {
  try {
    if (!dentistId) return { name: null, profilePictureUrl: null };

    // Fetch doctor record from doctors table using the dentist_id (which is user_id)
    const { data, error } = await supabase
      .from('doctors')
      .select('first_name, middle_name, last_name, gender, profile_picture_url')
      .eq('user_id', dentistId)
      .single();

    let name: string | null = null;
    const profilePictureUrl: string | null = data?.profile_picture_url?.trim() || null;

    if (error) {
      console.error('Error fetching doctor record from doctors table:', error);
      // Fallback: try fetching from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', dentistId)
        .single();
      name = profile?.name ? getDoctorTitleName({ name: profile.name }) : null;
      return { name, profilePictureUrl };
    }

    if (data) {
      name = formatDoctorDisplayName(data, { includePrefix: true });
      if (name) return { name, profilePictureUrl };
    }

    // Fallback if doctor record exists but names were blank
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', dentistId)
      .single();
    name = profile?.name ? getDoctorTitleName({ name: profile.name, gender: data?.gender }) : null;

    return { name, profilePictureUrl };
  } catch (error) {
    console.error('Error getting doctor details:', error);
    return { name: null, profilePictureUrl: null };
  }
}

export async function getDoctorName(dentistId: string): Promise<string | null> {
  const details = await getDoctorDetails(dentistId);
  return details.name;
}

export async function getDoctorProfilePicture(dentistId: string): Promise<string | null> {
  const details = await getDoctorDetails(dentistId);
  return details.profilePictureUrl;
}

export async function getDoctorProfile(dentistId: string): Promise<Doctor | null> {
  try {
    if (!dentistId) return null;

    const { data } = await supabase
      .from('doctors')
      .select('*')
      .eq('user_id', dentistId)
      .maybeSingle();

    if (data) return data as Doctor;

    // Fallback: check if dentistId is the doctor primary key id
    const { data: byId } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', dentistId)
      .maybeSingle();

    if (byId) return byId as Doctor;

    // Fallback: check profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', dentistId)
      .maybeSingle();

    if (profile?.name) {
      return {
        user_id: dentistId,
        first_name: profile.name,
        specialization: 'General Dentistry',
        license_number: 'N/A',
      } as Doctor;
    }

    return null;
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    return null;
  }
}

