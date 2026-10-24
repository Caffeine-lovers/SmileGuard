/**
 * Shared Supabase Client export for Doctor Mobile.
 * Re-exports the singleton client from @smileguard/supabase-client
 * to ensure all services share the exact same authenticated session.
 */
import { supabase } from "@smileguard/supabase-client";

export { supabase };
export default supabase;