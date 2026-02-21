import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Replace these with your actual Supabase project credentials
// Found at: https://supabase.com/dashboard → Project Settings → API
const SUPABASE_URL = "https://yffvnvusiazjnwmdylji.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZnZudnVzaWF6am53bWR5bGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTczMDIsImV4cCI6MjA4NjM5MzMwMn0.bZikKnvwvLt3OIpUnCCh2ATHy0Sp7NMGfgfs3ySGiKU";

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
