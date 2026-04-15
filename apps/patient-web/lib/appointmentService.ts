import { supabase } from '@smileguard/supabase-client';

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

export async function getAllBlockedSlots(): Promise<BlockedSlot[]> {
  console.log('🔍 [getAllBlockedSlots] Starting to fetch blocked slots...');
  
  // TEST: Try to fetch with very permissive query first
  console.log('🧪 [TEST] Attempting to query clinic_blockout_dates...');
  const { data: testData, error: testError, status } = await supabase
    .from('clinic_blockout_dates')
    .select('*');
  
  console.log('🧪 [TEST RESULT]', {
    error: testError,
    status,
    count: testData?.length || 0,
    data: testData
  });

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

  // Convert blockout dates to blocked slots (block all time slots for those days)
  const blockoutSlots: BlockedSlot[] = [];
  const blockedDateSet = new Set<string>();
  
  if (blockoutDates && blockoutDates.length > 0) {
    const TIME_SLOTS = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    ];
    
    for (const blockout of blockoutDates) {
      blockedDateSet.add(blockout.blockout_date);
      console.log(`🚫 [BLOCKOUT] Blocking ALL TIME SLOTS for: ${blockout.blockout_date}`);
      
      for (const timeSlot of TIME_SLOTS) {
        blockoutSlots.push({
          date: blockout.blockout_date,
          time: timeSlot,
          patientId: 'system-blockout', // System-generated blockout
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
