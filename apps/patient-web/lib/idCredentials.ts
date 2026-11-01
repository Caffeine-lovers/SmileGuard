import { supabase } from '@smileguard/supabase-client';

/** Private bucket for PWD / Senior Citizen IDs (migration 038). */
export const ID_BUCKET = 'ID Credentials';
export const ID_MAX_BYTES = 5 * 1024 * 1024;
export const ID_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function validateIdFile(file: { type: string; size: number }): string | null {
  if (!ID_ALLOWED_TYPES.includes(file.type)) return 'Please upload a JPG, PNG or WEBP photo of your ID.';
  if (file.size > ID_MAX_BYTES) return 'ID photos must be 5 MB or smaller.';
  if (file.size === 0) return 'That file is empty.';
  return null;
}

/** Uploads the ID into the patient's private folder and returns the object path. */
export async function uploadIdCredential(patientId: string, file: File, type: 'pwd' | 'senior'): Promise<string> {
  const problem = validateIdFile(file);
  if (problem) throw new Error(problem);

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${patientId}/${type}_id_${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(ID_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Could not upload your ID: ${error.message}`);
  return path;
}

/**
 * Short-lived link to view an ID. Prefers the private path; falls back to the
 * legacy public URL for IDs not yet moved by scripts/migrate-id-credentials.
 */
export async function getIdCredentialUrl(profile: { pwd_id_path?: string | null; pwd_id_url?: string | null }): Promise<string | null> {
  if (profile.pwd_id_path) {
    const { data, error } = await supabase.storage.from(ID_BUCKET).createSignedUrl(profile.pwd_id_path, 60 * 5);
    if (error) throw new Error(error.message);
    return data?.signedUrl ?? null;
  }
  return profile.pwd_id_url || null;
}
