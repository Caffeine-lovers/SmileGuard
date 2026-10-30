/**
 * useAuth Hook - Shared authentication hook for patient-web and doctor-mobile
 */

import { useState, useEffect, useRef } from "react";
import { CurrentUser, FormData } from "@smileguard/shared-types";
import { supabase } from "@smileguard/supabase-client";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

interface UseAuthOptions {
  /**
   * Whether to auto-create a profile row when none is found (PGRST116).
   */
  autoCreateProfile?: boolean;
}

function getCachedUserCookie(): AuthUser | null {
  if (typeof document === 'undefined') return null;
  try {
    const row = document.cookie.split('; ').find(r => r.startsWith('sg_patient_user='));
    if (!row) return null;
    const val = decodeURIComponent(row.split('=')[1]);
    const parsed = JSON.parse(val);
    if (parsed && parsed.id && parsed.role) {
      return parsed;
    }
  } catch (e) {}
  return null;
}

function setCachedUserCookie(user: AuthUser | null) {
  if (typeof document === 'undefined') return;
  try {
    if (!user) {
      document.cookie = 'sg_patient_user=; Path=/; Max-Age=0; SameSite=Lax';
    } else {
      const serialized = encodeURIComponent(JSON.stringify(user));
      const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
      document.cookie = `sg_patient_user=${serialized}; Path=/; Max-Age=604800; SameSite=Lax${isSecure ? '; Secure' : ''}`;
    }
  } catch (e) {}
}

type AuthUser = CurrentUser & {
  hasMedicalIntake?: boolean;
};

// Global in-flight tracking to prevent multiple concurrent profile fetches
const activeFetches = new Set<string>();

export function useAuth(options: UseAuthOptions = {}) {
  const { autoCreateProfile = true } = options;

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserRef = useRef<AuthUser | null>(currentUser);
  currentUserRef.current = currentUser;

  useEffect(() => {
    let isMounted = true;
    console.log("[useAuth] Initializing auth hook...");

    const cached = getCachedUserCookie();
    if (cached) {
      setCurrentUser(cached);
      setLoading(false);
    }

    // Defensive timeout wrapper for initial session fetch
    const fetchSessionWithTimeout = async () => {
      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 3500)
        );

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        if (!isMounted) return;

        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("[useAuth] Error getting initial session:", err);
        if (isMounted) setLoading(false);
      }
    };

    fetchSessionWithTimeout();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        console.log("[useAuth] Auth state change:", _event);
        if (!isMounted) return;

        if (_event === "SIGNED_OUT") {
          setCachedUserCookie(null);
          setCurrentUser(null);
          setLoading(false);
        } else if (session?.user) {
          if (currentUserRef.current?.id === session.user.id && currentUserRef.current?.hasMedicalIntake !== undefined) {
            setLoading(false);
            return;
          }
          // Decouple profile fetching from the synchronous auth state listener
          setTimeout(() => {
            if (isMounted) {
              fetchProfile(session.user.id);
            }
          }, 0);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    if (activeFetches.has(userId)) {
      return;
    }
    activeFetches.add(userId);

    try {
      let dbPromise = supabase
        .from("profiles")
        .select(`
          name, 
          email, 
          role,
          pwd_status,
          pwd_type,
          pwd_id_url,
          medical_intake!left (patient_id)
        `)
        .eq("id", userId)
        .maybeSingle()
        .then(async (res) => {
          if (res.error && res.error.message?.includes("pwd_status")) {
            // Graceful fallback if migration 035 not yet applied to database
            return await supabase
              .from("profiles")
              .select(`
                name, 
                email, 
                role,
                medical_intake!left (patient_id)
              `)
              .eq("id", userId)
              .maybeSingle();
          }
          return res;
        });

      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error("Profile query timed out") }), 4000)
      );

      const { data, error: fetchError } = await Promise.race([dbPromise, timeoutPromise]);

      if (fetchError) {
        console.warn("[useAuth] Profile Fetch DB Error/Timeout:", fetchError.message);
        // If we have a cached user cookie, retain it
        const cached = getCachedUserCookie();
        if (cached && cached.id === userId) {
          setCurrentUser(cached);
        }
        return;
      }

      if (data) {
        const intakeArray = data.medical_intake as any[];
        const hasIntake = intakeArray && intakeArray.length > 0;

        console.log("[useAuth] Medical Intake Debug:", {
          userId,
          foundProfile: true,
          hasIntake,
        });

        const authUserObj: AuthUser = { 
          id: userId, 
          name: data.name, 
          email: data.email, 
          role: data.role as "patient" | "doctor",
          hasMedicalIntake: hasIntake,
          pwd_status: (data as any).pwd_status || 'none',
          pwd_type: (data as any).pwd_type || undefined,
          pwd_id_url: (data as any).pwd_id_url || undefined,
        };
        setCurrentUser(authUserObj);
        setCachedUserCookie(authUserObj);
      } else {
        console.warn("[useAuth] No profile found for UID:", userId);
        if (autoCreateProfile) {
          await handleAutoCreate(userId);
        }
      }
    } catch (err) {
      console.error("[useAuth] fetchProfile caught error:", err);
      setError(err instanceof Error ? err.message : "Profile load failed");
    } finally {
      activeFetches.delete(userId);
      setLoading(false);
    }
  };

  const handleAutoCreate = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: created, error: cErr } = await supabase
        .from("profiles")
        .upsert([{
          id: userId,
          name: user?.user_metadata?.name || "User",
          email: user?.email || "",
          role: user?.user_metadata?.role || "patient",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }], { onConflict: "id" })
        .select()
        .maybeSingle();

      if (cErr) throw cErr;
      
      const newAuthUser: AuthUser = {
        id: userId,
        name: created?.name || "User",
        email: created?.email || "",
        role: (created?.role || "patient") as "patient" | "doctor",
        hasMedicalIntake: false
      };
      setCurrentUser(newAuthUser);
      setCachedUserCookie(newAuthUser);
    } catch (err) {
      console.error("[useAuth] Auto-create profile failed:", err);
    }
  };

  const register = async (formData: FormData, role: "patient" | "doctor") => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: { data: { name: formData.name, role } },
      });

      if (authError) throw authError;

      // Fix for RLS: Set session before inserting profile
      if (authData.session) {
        await supabase.auth.setSession(authData.session);
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert([{
          id: authData.user!.id,
          name: formData.name,
          email: formData.email,
          role,
        }]);

      if (profileError) console.error("[useAuth] Profile Insert Error:", profileError);

      await fetchProfile(authData.user!.id);
      return authData.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string, _role?: "patient" | "doctor") => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) throw authError;

      if (!authData.user) throw new Error("Login failed");

      await fetchProfile(authData.user.id);
      return authData.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setCachedUserCookie(null);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    currentUser,
    loading,
    error,
    register,
    login,
    logout,
    fetchProfile,
  };
}
