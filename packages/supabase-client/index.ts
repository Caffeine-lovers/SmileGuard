/**
 * Shared Supabase Client for SmileGuard
 * Used by both patient-web and doctor-mobile
 */

import { createClient } from "@supabase/supabase-js";

// Get config from environment variables
// Each app (patient-web, doctor-mobile) will have its own .env.local
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL ||
                     process.env.NEXT_PUBLIC_SUPABASE_URL ||
                     process.env.EXPO_PUBLIC_SUPABASE_URL ||
                     "https://yffvnvusiazjnwmdylji.supabase.co";

const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY ||
                          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                          process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
                          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZnZudnVzaWF6am53bWR5bGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTczMDIsImV4cCI6MjA4NjM5MzMwMn0.bZikKnvwvLt3OIpUnCCh2ATHy0Sp7NMGfgfs3ySGiKU";

console.log("🔗 Supabase initialized with URL:", SUPABASE_URL.slice(0, 30) + "...");

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: typeof window !== "undefined",
  },
});

export { SupabaseClient } from "@supabase/supabase-js";
