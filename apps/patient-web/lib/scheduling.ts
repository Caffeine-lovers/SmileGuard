/**
 * Pure, duration-aware scheduling helpers shared by the booking UI and bookSlot().
 * No Supabase / browser imports, so this can run anywhere (including tests).
 *
 * Every appointment occupies [start, start + duration). Duration comes from the
 * services booked (a comma-separated list such as "Cleaning, X-Ray").
 */

export const SERVICE_DURATIONS: Record<string, number> = {
  Cleaning: 30,
  Whitening: 60,
  Fillings: 60,
  Filling: 60,
  'Root Canal': 90,
  Extraction: 30,
  'Braces Consultation': 60,
  Braces: 60,
  'Implants Consultation': 60,
  Implants: 60,
  'X-Ray': 30,
  'Check-up': 30,
  Checkup: 30,
  Consultation: 30,
};

/** Used for appointments whose service name we don't recognize (e.g. created elsewhere). */
export const DEFAULT_APPOINTMENT_MINUTES = 30;

function durationOfOne(name: string): number {
  const n = name.trim().toLowerCase();
  if (!n) return 0;
  for (const [key, mins] of Object.entries(SERVICE_DURATIONS)) {
    if (key.toLowerCase() === n) return mins;
  }
  for (const [key, mins] of Object.entries(SERVICE_DURATIONS)) {
    const k = key.toLowerCase();
    if (n.includes(k) || k.includes(n)) return mins;
  }
  return DEFAULT_APPOINTMENT_MINUTES;
}

/** Total minutes for a booked service string, e.g. "Cleaning, X-Ray" → 45. */
export function getServiceDuration(service?: string | null): number {
  if (!service) return DEFAULT_APPOINTMENT_MINUTES;
  const total = service.split(',').reduce((sum, part) => sum + durationOfOne(part), 0);
  return total > 0 ? total : DEFAULT_APPOINTMENT_MINUTES;
}

/** "09:30", "09:30:00" or "9:30 AM" → minutes since midnight. Returns NaN if unparseable. */
export function toMinutes(time: string): number {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return NaN;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3]?.toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

/** Minutes since midnight → "1:30 PM". */
export function formatMinutes(total: number): string {
  const h24 = Math.floor(total / 60) % 24;
  const min = total % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${period}`;
}

export interface Interval {
  start: number;
  end: number;
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const result: Interval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = result[result.length - 1];
    const curr = sorted[i];
    if (curr.start <= last.end) {
      last.end = Math.max(last.end, curr.end);
    } else {
      result.push(curr);
    }
  }
  return result;
}

/** Busy intervals on a date from booked appointments ({ date, time, service, duration }). */
export function busyIntervalsForDate(
  booked: { date: string; time: string; service?: string | null; duration?: number }[],
  date: string
): Interval[] {
  const intervals = booked
    .filter((b) => b.date === date && b.service !== 'blocked' && b.time !== 'ALL_DAY')
    .map((b) => {
      const start = toMinutes(b.time);
      const dur = b.duration ?? (b.service ? getServiceDuration(b.service) : DEFAULT_APPOINTMENT_MINUTES);
      return { start, end: start + Math.max(dur, DEFAULT_APPOINTMENT_MINUTES) };
    })
    .filter((i) => Number.isFinite(i.start));

  return mergeIntervals(intervals);
}

/** True when [start, start + duration) does not collide with any existing booking in busy */
export function slotFitsWithBookings(start: number, duration: number, busy: Interval[]): boolean {
  if (!Number.isFinite(start)) return false;
  const end = start + Math.max(duration, DEFAULT_APPOINTMENT_MINUTES);
  for (const b of busy) {
    if (start < b.end && b.start < end) {
      return false; // overlaps an existing booking
    }
  }
  return true;
}

/**
 * The latest minute an appointment starting at `start` may run until without overlapping
 * another booking or running past closing. Returns null if `start` itself is inside a booking.
 */
export function freeUntil(start: number, busy: Interval[], closing: number): number | null {
  if (start >= closing) return null;
  let limit = closing;
  for (const b of busy) {
    if (start >= b.start && start < b.end) return null; // starts inside an existing booking
    if (b.start > start && b.start < limit) limit = b.start;
  }
  return limit;
}

/** True when [start, start+duration) fits before closing and overlaps no booking. */
export function fits(start: number, duration: number, busy: Interval[], closing: number): boolean {
  const limit = freeUntil(start, busy, closing);
  return limit !== null && start + Math.max(duration, 0) <= limit;
}

/** Converts 24-hour time e.g. "09:00", "13:30" or existing AM/PM strings into clean normal time "9:00 AM", "1:30 PM". */
export function formatAppointmentTime(timeStr?: string | null): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim();
  if (!trimmed || trimmed === 'ALL_DAY') return trimmed;

  // If already in AM/PM format (e.g. "9:00 AM" or "09:00 am")
  if (/am|pm/i.test(trimmed)) {
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)$/i);
    if (match) {
      const hour = parseInt(match[1], 10);
      const min = match[2];
      const period = match[3].toUpperCase();
      return `${hour}:${min} ${period}`;
    }
    return trimmed;
  }

  // Parse 24-hour military time e.g. "09:00", "13:30", "14:00:00"
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    let hour = parseInt(match24[1], 10);
    const min = match24[2];
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${min} ${period}`;
  }

  return trimmed;
}

/**
 * Formats a duration in minutes into clean hours and minutes, e.g.:
 *  60  -> "1 hr"
 *  120 -> "2 hrs"
 *  30  -> "0.5 hr"
 *  90  -> "1.5 hrs"
 *  45  -> "0.75 hr"
 *  15  -> "0.25 hr"
 */
export function formatDuration(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return '0 mins';

  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? '' : 's'}`;
  }

  const wholeHours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  const hourStr = `${wholeHours} ${wholeHours === 1 ? 'hour' : 'hours'}`;
  if (remainingMins === 0) {
    return hourStr;
  }
  return `${hourStr} ${remainingMins} min${remainingMins === 1 ? '' : 's'}`;
}
