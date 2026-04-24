import { supabase } from '@smileguard/supabase-client';

export let TOTAL_SLOTS_PER_DAY = 4; // matches TIME_SLOTS.length in BookAppointment (10 AM - 2 PM with 1-hour intervals)

export function setTotalSlotsPerDay(total: number): void {
  TOTAL_SLOTS_PER_DAY = total;
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
  console.log('bookSlot called:', { patientId, dentistId, service, appointmentDate, appointmentTime });
  
  const { data: existing, error: checkError } = await supabase
    .from('appointments')
    .select('id')
    .eq('appointment_date', appointmentDate)
    .eq('appointment_time', appointmentTime)
    .neq('status', 'cancelled');

  if (checkError) {
    console.error('Check availability error:', checkError);
    return { success: false, message: `Error checking availability: ${checkError.message}` };
  }
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
    console.error('Insert Error Detail:', insertError);
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
    .neq('status', 'cancelled')
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
// 8. GET DOCTOR NAME BY DENTIST ID
// ─────────────────────────────────────────
export async function getDoctorName(dentistId: string): Promise<string | null> {
  try {
    // Fetch doctor name from doctors table using the dentist_id (which is user_id)
    const { data, error } = await supabase
      .from('doctors')
      .select('doctor_name')
      .eq('user_id', dentistId)
      .single();

    if (error) {
      console.error('Error fetching doctor name from doctors table:', error);
      return null;
    }

    return data?.doctor_name || null;
  } catch (error) {
    console.error('Error getting doctor name:', error);
    return null;
  }
}
