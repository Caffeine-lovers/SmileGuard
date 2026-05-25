import { createClient } from 'npm:@supabase/supabase-js@2'

console.log('Push notification function started')

interface Notification {
  id: string
  doctor_id: string
  title: string
  body: string
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: any
  schema: 'public'
  old_record: any
}

const SUPABASE_SECRET_KEYS = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  SUPABASE_SECRET_KEYS['default']
)

Deno.serve(async (req) => {
  try {
    // Only handle POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const payload: WebhookPayload = await req.json()
    
    // Only handle INSERT events on appointments table
    if (payload.type !== 'INSERT' || payload.table !== 'appointments') {
      return new Response(JSON.stringify({ message: 'Skipped non-appointment insert' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const appointment = payload.record

    console.log('📬 Processing appointment insert:', appointment)

    // Get all doctors (role = 'doctor') with push tokens
    const { data: doctorsToNotify, error: doctorsError } = await supabase
      .from('profiles')
      .select('id, expo_push_token')
      .eq('role', 'doctor')
      .not('expo_push_token', 'is', null)

    if (doctorsError) {
      console.error('❌ Error fetching doctors:', doctorsError.message)
      return new Response(
        JSON.stringify({ error: doctorsError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!doctorsToNotify || doctorsToNotify.length === 0) {
      console.log('No doctors with push tokens found')
      return new Response(
        JSON.stringify({
          message: 'No doctors with push tokens found',
          appointmentId: appointment.id,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Found ${doctorsToNotify.length} doctors to notify`)

    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN')
    if (!expoAccessToken) {
      throw new Error('EXPO_ACCESS_TOKEN not configured')
    }

    // Format appointment details for notification
    let appointmentTime = 'TBD'
    if (appointment.appointment_date) {
      const dateStr = appointment.appointment_date
      const timeStr = appointment.appointment_time || '00:00'
      const dateTimeStr = `${dateStr}T${timeStr}`
      appointmentTime = new Date(dateTimeStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }

    // Get patient name
    let patientName = 'New Patient'
    if (appointment.patient_id) {
      const { data: patientData } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', appointment.patient_id)
        .single()
      
      if (patientData?.name) {
        patientName = patientData.name
      }
    }

    const notificationBody = `${patientName} - ${appointment.service || 'Appointment'} at ${appointmentTime}`

    // Send notifications to all doctors
    const results = []
    for (const doctor of doctorsToNotify) {
      console.log('📤 Sending push to doctor:', doctor.id, 'token:', doctor.expo_push_token)

      const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${expoAccessToken}`,
        },
        body: JSON.stringify({
          to: doctor.expo_push_token,
          sound: 'default',
          title: 'New Appointment Request',
          body: notificationBody,
          data: {
            appointmentId: appointment.id,
            patientId: appointment.patient_id,
            type: 'appointment-created',
          },
        }),
      })

      const expoResult = await expoResponse.json()
      
      if (expoResult.errors) {
        console.error('❌ Expo API error for doctor', doctor.id, ':', expoResult.errors)
        // Check for invalid token error
        if (expoResult.errors[0]?.code === 'INVALID_EXPO_PUSH_TOKEN') {
          // Clear invalid token from database
          await supabase
            .from('profiles')
            .update({ expo_push_token: null })
            .eq('id', doctor.id)
          console.log('Cleared invalid push token for doctor:', doctor.id)
        }
        results.push({ doctorId: doctor.id, status: 'failed', error: expoResult.errors })
      } else {
        console.log('✅ Push notification sent successfully to doctor:', doctor.id, expoResult)
        results.push({ doctorId: doctor.id, status: 'success' })
      }
    }

    return new Response(JSON.stringify({
      message: `Sent notifications to ${results.length} doctor(s)`,
      results,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('❌ Error in push notification function:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
