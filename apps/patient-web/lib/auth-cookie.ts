/**
 * Standard cookie caching helper for Patient Web session
 * Provides fast, synchronous identity hydration on page loads to prevent auth verification loops.
 */

export interface CachedPatientUser {
  id: string;
  email: string;
  name: string;
  role: 'patient';
  hasMedicalIntake: boolean;
  cachedAt: number;
}

const COOKIE_NAME = 'sg_patient_user';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function setPatientUserCookie(user: {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
  hasMedicalIntake?: boolean;
}): void {
  if (typeof document === 'undefined') return;

  const payload: CachedPatientUser = {
    id: user.id,
    email: user.email || '',
    name: user.name || 'Patient',
    role: 'patient',
    hasMedicalIntake: Boolean(user.hasMedicalIntake),
    cachedAt: Date.now(),
  };

  try {
    const serialized = encodeURIComponent(JSON.stringify(payload));
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    document.cookie = `${COOKIE_NAME}=${serialized}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${isSecure ? '; Secure' : ''}`;
  } catch (err) {
    console.warn('[auth-cookie] Failed to set cookie:', err);
  }
}

export function getPatientUserCookie(): CachedPatientUser | null {
  if (typeof document === 'undefined') return null;

  try {
    const cookies = document.cookie.split('; ');
    const userCookie = cookies.find((row) => row.startsWith(`${COOKIE_NAME}=`));
    if (!userCookie) return null;

    const value = decodeURIComponent(userCookie.split('=')[1]);
    const parsed = JSON.parse(value) as CachedPatientUser;

    // Validate that it's a patient and not expired (7 days)
    if (parsed && parsed.id && parsed.role === 'patient') {
      const isExpired = Date.now() - parsed.cachedAt > MAX_AGE_SECONDS * 1000;
      if (!isExpired) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[auth-cookie] Error reading cookie:', err);
  }

  return null;
}

export function clearPatientUserCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

