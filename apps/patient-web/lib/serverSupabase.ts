// Server-only: import this from API routes, never from client components.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client for trusted server routes (bypasses RLS).
 * Returns null when SUPABASE_SERVICE_ROLE_KEY is not configured.
 */
export function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Anon client that acts as the calling user (RLS applies). */
export function getUserClient(authHeader: string | null): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
  });
}

/**
 * Resolve the signed-in user from the `Authorization: Bearer <jwt>` header.
 * Never trust a patientId sent in a request body — use this instead.
 */
export async function getAuthedUserId(authHeader: string | null): Promise<string | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const client = getUserClient(authHeader);
  if (!client) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}
