#!/usr/bin/env node
/**
 * Seed Appointments Script
 * Adds test appointments for a doctor account
 * 
 * USAGE:
 * npx ts-node scripts/seed-appointments.ts <DOCTOR_ID> <PATIENT_ID>
 * 
 * Get your IDs from:
 * - Doctor ID: Check the profiles table in Supabase
 * - Patient ID: Check the profiles table where role='patient'
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Get arguments
const doctorId = process.argv[2];
const patientId = process.argv[3];

if (!doctorId || !patientId) {
  console.error('Usage: npx ts-node scripts/seed-appointments.ts <DOCTOR_ID> <PATIENT_ID>');
  process.exit(1);
}

// Test appointment data - spread across different dates and times
const testAppointments = [
  {
    patient_id: patientId,
    dentist_id: doctorId,
    service: 'Whitening',
    appointment_date: '2026-04-09',
    appointment_time: '10:00',
    status: 'scheduled' as const,
  },
  {
    patient_id: patientId,
    dentist_id: doctorId,
    service: 'Aligners',
    appointment_date: '2026-04-10',
    appointment_time: '13:00',
    status: 'scheduled' as const,
  },
  {
    patient_id: patientId,
    dentist_id: doctorId,
    service: 'Root Canals',
    appointment_date: '2026-04-11',
    appointment_time: '15:00',
    status: 'completed' as const,
  },
  {
    patient_id: patientId,
    dentist_id: doctorId,
    service: 'Cleaning',
    appointment_date: '2026-04-12',
    appointment_time: '09:00',
    status: 'scheduled' as const,
  },
  {
    patient_id: patientId,
    dentist_id: doctorId,
    service: 'Filling',
    appointment_date: '2026-04-13',
    appointment_time: '11:00',
    status: 'scheduled' as const,
  },
  {
    patient_id: patientId,
    dentist_id: doctorId,
    service: 'Extraction',
    appointment_date: '2026-04-14',
    appointment_time: '14:00',
    status: 'cancelled' as const,
  },
];

async function seedAppointments() {
  try {
    console.log(`🌱 Seeding ${testAppointments.length} appointments...`);
    
    const { data, error } = await supabase
      .from('appointments')
      .insert(testAppointments)
      .select();

    if (error) {
      console.error('❌ Error seeding appointments:', error);
      process.exit(1);
    }

    console.log(`✅ Successfully seeded ${data?.length || 0} appointments!`);
    console.log('📋 Appointments added:');
    data?.forEach(apt => {
      console.log(`  - ${apt.service} on ${apt.appointment_date} at ${apt.appointment_time} (${apt.status})`);
    });
  } catch (err) {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
  }
}

seedAppointments();
