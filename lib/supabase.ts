import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Default credentials (fallback for development - will be replaced by extra config)
const DEFAULT_SUPABASE_URL = "https://yffvnvusiazjnwmdylji.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZnZudnVzaWF6am53bWR5bGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTczMDIsImV4cCI6MjA4NjM5MzMwMn0.bZikKnvwvLt3OIpUnCCh2ATHy0Sp7NMGfgfs3ySGiKU";

// Get Supabase credentials - try app.json extra first, then fall back to defaults
const getSupabaseUrl = (): string => {
  try {
    // Try to get from app.json extra first (Expo managed workflow)
    const extraUrl = Constants.expoConfig?.extra?.supabaseUrl;
    if (extraUrl) return extraUrl;
  } catch (e) {
    // Constants.expoConfig might not be available in some contexts
    console.warn("Could not access Constants.expoConfig, using default URL");
  }
  
  return DEFAULT_SUPABASE_URL;
};

const getSupabaseAnonKey = (): string => {
  try {
    // Try to get from app.json extra first (Expo managed workflow)
    const extraKey = Constants.expoConfig?.extra?.supabaseAnonKey;
    if (extraKey) return extraKey;
  } catch (e) {
    // Constants.expoConfig might not be available in some contexts
    console.warn("Could not access Constants.expoConfig, using default key");
  }
  
  return DEFAULT_SUPABASE_ANON_KEY;
};

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();

// Log configuration status
console.log("Supabase URL configured:", !!SUPABASE_URL);
console.log("Supabase Key configured:", !!SUPABASE_ANON_KEY);

// Web uses localStorage, native uses AsyncStorage
// This prevents "window is not defined" errors during server-side rendering
const webStorage = {
  getItem: (key: string) => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
  },
};

const storage = Platform.OS === "web" ? webStorage : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
