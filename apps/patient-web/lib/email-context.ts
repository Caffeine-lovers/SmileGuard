import { supabase } from '@smileguard/supabase-client';

export interface EmailContextResult {
  exists: boolean;
  has_profile: boolean;
  is_registered: boolean;
  has_medical_intake: boolean;
  role: string;
  name: string;
}

const DEFAULT_RESULT: EmailContextResult = {
  exists: false,
  has_profile: false,
  is_registered: false,
  has_medical_intake: false,
  role: 'none',
  name: '',
};

const STAFF_ROLES = ['doctor', 'assistant', 'admin'];

/** Thrown when we could not find out whether an email is in use. Never treat this as "free". */
export class EmailCheckError extends Error {
  constructor() {
    super("We couldn't check this email right now. Please check your connection and try again.");
    this.name = 'EmailCheckError';
  }
}

/** The email belongs to a clinic staff account (doctor, assistant or admin). */
export function isStaffEmail(context: EmailContextResult): boolean {
  return STAFF_ROLES.includes((context.role || '').toLowerCase());
}

/**
 * The email can't be used to register: it belongs to staff or to a patient who finished
 * registering. Someone who verified their email but never finished signup may continue.
 */
export function isEmailInUse(context: EmailContextResult): boolean {
  return isStaffEmail(context) || (context.is_registered && context.has_medical_intake);
}

/** Readable message for a failed auth email (rate limits and network errors). */
export function friendlyEmailError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : '';
  if (/rate limit|security purposes|too many/i.test(message)) {
    return 'Too many emails were requested. Please wait a minute and try again.';
  }
  if (/failed to fetch|network|load failed|timed? ?out/i.test(message)) {
    return "We couldn't reach the server. Please check your connection and try again.";
  }
  return message || fallback;
}

function toResult(data: any): EmailContextResult {
  return {
    exists: Boolean(data.exists),
    has_profile: Boolean(data.has_profile),
    is_registered: Boolean(data.is_registered),
    has_medical_intake: Boolean(data.has_medical_intake),
    role: data.role || 'none',
    name: data.name || '',
  };
}

/**
 * Looks up whether an email belongs to a registered account.
 * Throws EmailCheckError if the lookup fails, so a failed check can never let an email through.
 * (Reading the profiles table directly is not a valid fallback: row-level security hides other
 * people's rows, so it would report every email as free.)
 */
export async function checkEmailContext(email: string): Promise<EmailContextResult> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return DEFAULT_RESULT;
  }

  // 1. Secure RPC
  try {
    const { data, error } = await supabase.rpc('check_email_context', {
      p_email: normalizedEmail,
    });
    if (!error && data && typeof data === 'object') {
      return toResult(data);
    }
    if (error) console.warn('[checkEmailContext] RPC error:', error.message);
  } catch (rpcErr) {
    console.warn('[checkEmailContext] RPC failed, trying API:', rpcErr);
  }

  // 2. Same check through our server, for networks that can't reach Supabase directly
  try {
    const res = await fetch('/api/auth/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    if (res.ok) {
      return toResult(await res.json());
    }
  } catch (apiErr) {
    console.warn('[checkEmailContext] API check failed:', apiErr);
  }

  throw new EmailCheckError();
}
