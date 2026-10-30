import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceRoleKey && supabaseUrl) {
    return createClient(supabaseUrl, serviceRoleKey);
  }
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey && supabaseUrl) {
    return createClient(supabaseUrl, anonKey);
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database service configuration error' }, { status: 500 });
    }

    const body = await request.json();
    const { appointmentId, newDate, newTime, reason, requestedBy = 'patient' } = body;

    if (!appointmentId || !newDate || !newTime) {
      return NextResponse.json(
        { error: 'Missing required fields: appointmentId, newDate, newTime' },
        { status: 400 }
      );
    }

    // 1. Fetch current appointment details
    const { data: currentApt, error: fetchErr } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', appointmentId)
      .single();

    if (fetchErr || !currentApt) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    // Patient reschedule MUST revert to 'pending' as it needs doctor re-approval
    // Doctor reschedule maintains 'scheduled'
    const isPatient = requestedBy === 'patient';
    const newStatus = isPatient ? 'pending' : 'scheduled';
    const updatedNotes = reason
      ? (currentApt.notes ? `${currentApt.notes} | Reschedule note: ${reason}` : `Reschedule note: ${reason}`)
      : currentApt.notes;

    // 2. Update appointment
    const { data: updatedApt, error: updateErr } = await supabase
      .from('appointments')
      .update({
        appointment_date: newDate,
        appointment_time: newTime,
        status: newStatus,
        rescheduled_by: requestedBy,
        rescheduled_at: new Date().toISOString(),
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .select()
      .single();

    if (updateErr) {
      console.error('[Reschedule API] Update error:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 3. Ensure Notifications are inserted for both parties
    const serviceName = currentApt.service || 'Dental Procedure';
    const patientId = currentApt.patient_id;
    const dentistId = currentApt.dentist_id;

    let patientName = 'Patient';
    if (patientId) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('name, full_name')
        .eq('id', patientId)
        .maybeSingle();
      patientName = prof?.name || prof?.full_name || 'Patient';
    }

    try {
      if (isPatient) {
        // Notification to Doctor
        if (dentistId) {
          await supabase.from('notifications').insert({
            user_id: dentistId,
            title: 'Appointment Reschedule Request',
            message: `${patientName} requested to reschedule ${serviceName} to ${newDate} at ${newTime}. Approval required.`,
            type: 'appointment_rescheduled',
            metadata: {
              appointment_id: appointmentId,
              old_date: currentApt.appointment_date,
              new_date: newDate,
              old_time: currentApt.appointment_time,
              new_time: newTime,
              by: 'patient',
            },
          });
        }

        // Notification to Patient
        if (patientId) {
          await supabase.from('notifications').insert({
            user_id: patientId,
            title: 'Reschedule Submitted (Pending Approval)',
            message: `Your request to reschedule ${serviceName} to ${newDate} at ${newTime} was submitted and is pending approval from Dr. Kyler.`,
            type: 'appointment_rescheduled',
            metadata: {
              appointment_id: appointmentId,
              new_date: newDate,
              new_time: newTime,
              by: 'patient',
            },
          });
        }
      } else {
        // Doctor rescheduled -> Notify Patient
        if (patientId) {
          await supabase.from('notifications').insert({
            user_id: patientId,
            title: 'Appointment Rescheduled by Doctor',
            message: `Dr. Kyler has rescheduled your ${serviceName} appointment to ${newDate} at ${newTime}.`,
            type: 'appointment_rescheduled',
            metadata: {
              appointment_id: appointmentId,
              old_date: currentApt.appointment_date,
              new_date: newDate,
              old_time: currentApt.appointment_time,
              new_time: newTime,
              by: 'doctor',
            },
          });
        }
      }
    } catch (notifErr) {
      console.warn('[Reschedule API] Notification insert skipped or caught:', notifErr);
    }

    return NextResponse.json({
      success: true,
      appointment: updatedApt,
      message: isPatient
        ? 'Reschedule request submitted! Status is now pending approval from Dr. Kyler.'
        : 'Appointment rescheduled successfully.',
    });
  } catch (error) {
    console.error('[Reschedule API] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

