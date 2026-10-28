/**
 * Re-export the shared Supabase client so the whole app uses ONE client instance.
 *
 * Previously this file created a second client with its own (AsyncStorage) session.
 * Login happens through `@smileguard/supabase-client`, so this second client never
 * received the session and every query through it ran as `anon` — RLS then returned
 * 0 rows (appointments, patients, billings, notifications...).
 */
import "react-native-url-polyfill/auto.js";

export { supabase } from "@smileguard/supabase-client";