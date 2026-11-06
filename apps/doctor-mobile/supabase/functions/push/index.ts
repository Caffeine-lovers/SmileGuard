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

// Helper to format date as "February 14, 2026" (matches AppointmentsTab formatDateDisplay)
function formatAppointmentDate(dateStr?: string): string {
  if (!dateStr) return 'scheduled date'
  try {
    if (dateStr.includes('-')) {
      const parts = dateStr.split('T')[0].split('-')
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10)
        const month = parseInt(parts[1], 10) - 1
        const day = parseInt(parts[2], 10)
        const dateObj = new Date(year, month, day)
        return dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      }
    }
    const dateObj = new Date(dateStr)
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    }
  } catch {
    // fallback
  }
  return dateStr
}

// Helper to format time as "10:00 AM" or "1:30 PM" (matches AppointmentsTab formatAppointmentTime)
function formatAppointmentTime(timeStr?: string): string {
  if (!timeStr) return ''
  const trimmed = timeStr.trim()
  if (/am|pm/i.test(trimmed)) {
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)$/i)
    if (match) {
      const hour = parseInt(match[1], 10)
      const min = match[2]
      const period = match[3].toUpperCase()
      return `${hour}:${min} ${period}`
    }
    return trimmed
  }
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (match24) {
    let hour = parseInt(match24[1], 10)
    const min = match24[2]
    const period = hour >= 12 ? 'PM' : 'AM'
    hour = hour % 12
    if (hour === 0) hour = 12
    return `${hour}:${min} ${period}`
  }
  return trimmed
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts'
const RECEIPT_CHECK_DELAY_MS = 60_000

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

interface ExpoMessage {
  to: string
  [key: string]: unknown
}

interface ExpoTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

async function clearDeadToken(token: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ expo_push_token: null })
    .eq('expo_push_token', token)
  if (error) {
    console.error(`[PushFunction] Failed to clear dead token ${token}:`, error.message)
  } else {
    console.log(`[PushFunction] Cleared dead token ${token}`)
  }
}

async function postToExpo(messages: ExpoMessage[], headers: Record<string, string>) {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  })
  const result = await response.json()
  console.log('[PushFunction] Expo API response:', JSON.stringify(result))
  return result
}

// Expo rejects a whole request if its tokens belong to more than one project,
// so split on the grouping it returns and resend each project separately.
async function sendToExpo(messages: ExpoMessage[], headers: Record<string, string>) {
  const result = await postToExpo(messages, headers)
  const mixedProjects = result.errors?.find(
    (e: { code?: string }) => e.code === 'PUSH_TOO_MANY_EXPERIENCE_IDS'
  )

  const batches: { messages: ExpoMessage[]; tickets: ExpoTicket[] }[] = []
  const requestErrors: unknown[] = []

  if (mixedProjects?.details) {
    console.warn('[PushFunction] Tokens span multiple EAS projects:', Object.keys(mixedProjects.details))
    for (const tokens of Object.values(mixedProjects.details) as string[][]) {
      const group = messages.filter((m) => tokens.includes(m.to))
      const groupResult = await postToExpo(group, headers)
      if (groupResult.errors) requestErrors.push(...groupResult.errors)
      batches.push({ messages: group, tickets: groupResult.data ?? [] })
    }
  } else {
    if (result.errors) requestErrors.push(...result.errors)
    batches.push({ messages, tickets: result.data ?? [] })
  }

  const receiptTokens = new Map<string, string>()
  let accepted = 0
  let rejected = 0

  for (const batch of batches) {
    for (const [index, ticket] of batch.tickets.entries()) {
      const token = batch.messages[index].to
      if (ticket.status === 'ok') {
        accepted++
        if (ticket.id) receiptTokens.set(ticket.id, token)
        continue
      }
      rejected++
      console.error(`[PushFunction] Expo rejected ${token}: ${ticket.details?.error} - ${ticket.message}`)
      if (ticket.details?.error === 'DeviceNotRegistered') await clearDeadToken(token)
    }
  }

  return { accepted, rejected, requestErrors, receiptTokens }
}

// FCM failures such as InvalidCredentials only appear on receipts, not on the send response.
async function logReceiptErrors(receiptTokens: Map<string, string>, headers: Record<string, string>) {
  await new Promise((resolve) => setTimeout(resolve, RECEIPT_CHECK_DELAY_MS))

  const response = await fetch(EXPO_RECEIPTS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids: Array.from(receiptTokens.keys()) }),
  })
  const { data, errors } = await response.json()
  if (errors) console.error('[PushFunction] Receipt lookup failed:', JSON.stringify(errors))

  for (const [id, receipt] of Object.entries((data ?? {}) as Record<string, ExpoTicket>)) {
    if (receipt.status === 'ok') continue
    const token = receiptTokens.get(id)!
    console.error(`[PushFunction] Delivery failed for ${token}: ${receipt.details?.error} - ${receipt.message}`)
    if (receipt.details?.error === 'DeviceNotRegistered') await clearDeadToken(token)
  }
  console.log(`[PushFunction] Receipts checked: ${Object.keys(data ?? {}).length} of ${receiptTokens.size} ready`)
}

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

      // Fetch all registered doctors so every doctor is notified
      const { data: allDoctors } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'doctor')

      targetUserIds = (allDoctors || []).map((d) => d.id)
      if (record.dentist_id && !targetUserIds.includes(record.dentist_id)) {
        targetUserIds.push(record.dentist_id)
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

      const formattedDate = formatAppointmentDate(record.appointment_date)
      const formattedTime = formatAppointmentTime(record.appointment_time)
      const timeSuffix = formattedTime ? ` at ${formattedTime}` : ''

      if (payload.type === 'INSERT') {
        title = 'New Appointment Request'
        body = `${patientName} booked ${record.service || 'an appointment'} on ${formattedDate}${timeSuffix}.`
      } else if (payload.type === 'UPDATE') {
        const oldStatus = payload.old_record?.status
        const newStatus = record.status

        if (oldStatus !== newStatus) {
          if (newStatus === 'cancelled') {
            title = 'Appointment Cancelled'
            body = `${patientName} cancelled the appointment for ${record.service || 'service'} on ${formattedDate}.`
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
          body = `Appointment for ${patientName} moved to ${formattedDate}${timeSuffix}.`
        } else {
          title = 'Appointment Updated'
          body = `Details for ${record.service || 'appointment'} with ${patientName} have been updated.`
        }
      } else if (payload.type === 'DELETE') {
        title = 'Appointment Cancelled'
        body = `An appointment on ${formatAppointmentDate(payload.old_record?.appointment_date)} was cancelled.`
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

    const { accepted, rejected, requestErrors, receiptTokens } = await sendToExpo(messages, headers)

    if (receiptTokens.size > 0) {
      EdgeRuntime.waitUntil(
        logReceiptErrors(receiptTokens, headers).catch((err) =>
          console.error('[PushFunction] Receipt check failed:', err)
        )
      )
    }

    return new Response(JSON.stringify({ success: accepted > 0, accepted, rejected, errors: requestErrors }), {
      status: accepted > 0 ? 200 : 502,
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
