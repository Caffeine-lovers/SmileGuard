import { supabase } from './supabase.ts';

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