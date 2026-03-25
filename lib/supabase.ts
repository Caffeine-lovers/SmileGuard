import "react-native-url-polyfill/auto.js";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorageLib from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// @ts-ignore - AsyncStorage type mismatch across different React Native versions
const AsyncStorage = AsyncStorageLib.default || AsyncStorageLib;

const DEFAULT_SUPABASE_URL     = "https://yffvnvusiazjnwmdylji.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmZnZudnVzaWF6am53bWR5bGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MTczMDIsImV4cCI6MjA4NjM5MzMwMn0.bZikKnvwvLt3OIpUnCCh2ATHy0Sp7NMGfgfs3ySGiKU";

// Cast to unknown then to specific type to avoid expo-constants version type mismatch — safe at runtime
// @ts-ignore - Constants type varies across Expo versions
const expoExtra = Constants.expoConfig?.extra;

const SUPABASE_URL      = expoExtra?.supabaseUrl      ?? DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = expoExtra?.supabaseAnonKey  ?? DEFAULT_SUPABASE_ANON_KEY;

console.log("Supabase URL configured:",  !!SUPABASE_URL);
console.log("Supabase Key configured:", !!SUPABASE_ANON_KEY);

const webStorage = {
  getItem:    (key: string) => (typeof globalThis !== "undefined" && globalThis.localStorage ? globalThis.localStorage.getItem(key) : null),
  setItem:    (key: string, value: string) => { if (typeof globalThis !== "undefined" && globalThis.localStorage) globalThis.localStorage.setItem(key, value); },
  removeItem: (key: string) => { if (typeof globalThis !== "undefined" && globalThis.localStorage) globalThis.localStorage.removeItem(key); },
};

// @ts-ignore - AsyncStorage type mismatch across different React Native versions
const storage = Platform.OS === "web" ? webStorage : AsyncStorage;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // @ts-ignore - storage type mismatch with Supabase Auth
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});