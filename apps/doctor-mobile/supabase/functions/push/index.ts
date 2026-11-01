import { createClient } from 'npm:@supabase/supabase-js@2'

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: 'public'
  record: Record<string, any>
  old_record: Record<string, any> | null
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json()
    console.log(`[PushFunction] Incoming webhook for table: ${payload.table} (${payload.type})`)
    console.log(`[PushFunction] Record data:`, JSON.stringify(payload.record || payload.old_record))

    let targetUserIds: string[] = []
    let title = 'SmileGuard Notification'
    let body = 'You have a new update.'
    let dataPayload: Record<string, any> = { screen: 'dashboard' }

    if (payload.table === 'appointments') {
      const record = payload.record || payload.old_record || {}
      dataPayload = {
        appointmentId: record.id,
        screen: 'dashboard',
        table: 'appointments',
      }

      // Fetch patient display name
      let patientName = 'A patient'
      if (record.patient_id) {
        const { data: patientProfile } = await supabase
          .from('profiles')
          .select('name, first_name, last_name')
          .eq('id', record.patient_id)
          .maybeSingle()

        if (patientProfile) {
          patientName =
            patientProfile.name ||
            [patientProfile.first_name, patientProfile.last_name].filter(Boolean).join(' ') ||
            'A patient'
        }
      }

      if (payload.type === 'INSERT') {
        title = 'New Appointment Request'
        body = `${patientName} booked ${record.service || 'an appointment'} on ${record.appointment_date || 'scheduled date'} at ${record.appointment_time || 'TBD'}.`

        if (record.dentist_id) {
          targetUserIds = [record.dentist_id]
        } else {
          // Unassigned appointment request: alert all doctors
          const { data: doctors } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'doctor')

          targetUserIds = (doctors || []).map((d) => d.id)
        }
      } else if (payload.type === 'UPDATE') {
        const oldStatus = payload.old_record?.status
        const newStatus = record.status

        if (oldStatus !== newStatus) {
          if (newStatus === 'cancelled') {
            title = 'Appointment Cancelled'
            body = `${patientName} cancelled the appointment for ${record.service || 'service'} on ${record.appointment_date || ''}.`
          } else if (newStatus === 'completed') {
            title = 'Appointment Completed'
            body = `Appointment for ${patientName} (${record.service || 'service'}) has been completed.`
          } else {
            title = 'Appointment Status Updated'
            body = `Appointment for ${patientName} is now marked as ${newStatus}.`
          }
        } else if (
          payload.old_record?.appointment_date !== record.appointment_date ||
          payload.old_record?.appointment_time !== record.appointment_time
        ) {
          title = 'Appointment Rescheduled'
          body = `Appointment for ${patientName} moved to ${record.appointment_date} at ${record.appointment_time}.`
        } else {
          title = 'Appointment Updated'
          body = `Details for ${record.service || 'appointment'} with ${patientName} have been updated.`
        }

        if (record.dentist_id) {
          targetUserIds.push(record.dentist_id)
        }
      } else if (payload.type === 'DELETE') {
        title = 'Appointment Cancelled'
        body = `An appointment on ${payload.old_record?.appointment_date || 'scheduled date'} was cancelled.`
        if (payload.old_record?.dentist_id) {
          targetUserIds.push(payload.old_record.dentist_id)
        }
      }
    } else {
      // Generic fallback for any other table or notification row
      const record = payload.record || {}
      const targetId = record.user_id || record.recipient_id || record.doctor_id
      if (targetId) {
        targetUserIds = [targetId]
      }
      title = record.title || 'SmileGuard Alert'
      body = record.body || record.message || 'You have a new notification.'
    }

    // Deduplicate target user IDs
    targetUserIds = Array.from(new Set(targetUserIds.filter(Boolean)))
    console.log(`[PushFunction] Initial target user IDs:`, targetUserIds)

    if (!targetUserIds.length) {
      console.log('[PushFunction] No target user IDs found for notification.')
      return new Response(JSON.stringify({ message: 'No target recipients' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Query profiles for registered expo_push_tokens
    let { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, expo_push_token')
      .in('id', targetUserIds)
      .not('expo_push_token', 'is', null)

    if (profileError) {
      console.error('[PushFunction] Error querying profile tokens:', profileError)
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fallback: If assigned doctor has no push token (or unassigned), notify any active doctor
    if ((!profiles || profiles.length === 0) && payload.type === 'INSERT') {
      console.log('[PushFunction] Target doctor has no active token. Checking all active doctor profiles...')
      const { data: fallbackProfiles } = await supabase
        .from('profiles')
        .select('id, expo_push_token')
        .eq('role', 'doctor')
        .not('expo_push_token', 'is', null)

      if (fallbackProfiles && fallbackProfiles.length > 0) {
        profiles = fallbackProfiles
        console.log(`[PushFunction] Found ${profiles.length} active doctor fallback profile(s).`)
      }
    }

    console.log(`[PushFunction] Active profiles with tokens:`, profiles?.map(p => ({ id: p.id, token: p.expo_push_token })))

    const rawPushTokens = (profiles || [])
      .map((p) => p.expo_push_token)
      .filter((t): t is string => typeof t === 'string' && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[')))

    // Deduplicate push tokens so a single device never receives duplicate notifications
    const pushTokens = Array.from(new Set(rawPushTokens))
    console.log(`[PushFunction] Unique push tokens to notify:`, pushTokens)

    if (!pushTokens.length) {
      console.log('[PushFunction] Target users have no active Expo push tokens.')
      return new Response(JSON.stringify({ message: 'No active Expo push tokens found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Prepare push notification messages
    const messages = pushTokens.map((toToken) => ({
      to: toToken,
      sound: 'default',
      title,
      body,
      data: dataPayload,
      channelId: 'default',
      priority: 'high', // Critical: Forces FCM / APNs to deliver immediately, bypassing Android Doze mode
    }))

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN')
    if (expoAccessToken) {
      headers['Authorization'] = `Bearer ${expoAccessToken}`
    }

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    })

    const expoResult = await expoResponse.json()
    console.log('[PushFunction] Expo API response:', JSON.stringify(expoResult))

    return new Response(JSON.stringify({ success: true, result: expoResult }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[PushFunction] Uncaught error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
