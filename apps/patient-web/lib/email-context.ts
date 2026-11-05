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

/**
 * Validates the email context against the database to confirm whether
 * the email already belongs to a registered patient and whether they have
 * completed medical intake.
 */
export async function checkEmailContext(email: string): Promise<EmailContextResult> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return DEFAULT_RESULT;
  }

  // 1. First attempt: call secure RPC
  try {
    const { data, error } = await supabase.rpc('check_email_context', {
      p_email: normalizedEmail,
    });

    if (!error && data && typeof data === 'object') {
      return {
        exists: Boolean(data.exists),
        has_profile: Boolean(data.has_profile),
        is_registered: Boolean(data.is_registered),
        has_medical_intake: Boolean(data.has_medical_intake),
        role: data.role || 'none',
        name: data.name || '',
      };
    }
  } catch (rpcErr) {
    console.warn('[checkEmailContext] RPC failed, trying fallback API:', rpcErr);
  }

  // 2. Second attempt: call Next.js API endpoint
  try {
    const res = await fetch('/api/auth/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
    });

    if (res.ok) {
      const json = await res.json();
      return {
        exists: Boolean(json.exists),
        has_profile: Boolean(json.has_profile),
        is_registered: Boolean(json.is_registered),
        has_medical_intake: Boolean(json.has_medical_intake),
        role: json.role || 'none',
        name: json.name || '',
      };
    }
  } catch (apiErr) {
    console.warn('[checkEmailContext] Fallback API failed:', apiErr);
  }

  // 3. Third attempt: direct table read fallback
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, role')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (profile?.id) {
      const { data: intake } = await supabase
        .from('medical_intake')
        .select('id, date_of_birth, gender, phone')
        .eq('patient_id', profile.id)
        .maybeSingle();

      const hasIntake = Boolean(
        intake &&
        ((intake.date_of_birth && intake.date_of_birth.trim() !== '') ||
         (intake.gender && intake.gender.trim() !== '') ||
         (intake.phone && intake.phone.trim() !== ''))
      );

      return {
        exists: true,
        has_profile: true,
        is_registered: profile.role === 'patient',
        has_medical_intake: hasIntake,
        role: profile.role || 'patient',
        name: profile.name || '',
      };
    }
  } catch {
    // Safe fallback
  }

  return DEFAULT_RESULT;
}

