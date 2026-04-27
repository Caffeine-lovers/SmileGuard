/**
 * useAuth Hook - Shared authentication hook for patient-web and doctor-mobile
 */

import { useState, useEffect } from "react";
import { CurrentUser, FormData } from "@smileguard/shared-types";
import { supabase } from "@smileguard/supabase-client";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

interface UseAuthOptions {
  /**
   * Whether to auto-create a profile row when none is found (PGRST116).
   */
  autoCreateProfile?: boolean;
}

type AuthUser = CurrentUser & {
  hasMedicalIntake?: boolean;
};

export function useAuth(options: UseAuthOptions = {}) {
  const { autoCreateProfile = true } = options;

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[useAuth] Initializing auth hook...");
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[useAuth] Error getting initial session:", err);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        console.log("[useAuth] Auth state change:", _event);
        if (_event === "SIGNED_OUT") {
          setCurrentUser(null);
          setLoading(false);
        } else if (session?.user) {
          if (currentUser?.id === session.user.id) return;
          await fetchProfile(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      /**
       * CRITICAL CHECK: 
       * In the .select() below, 'medical_intake!left(patient_id)' assumes 
       * your foreign key column is named 'patient_id'. 
       * If it's just 'id' or 'user_id', change the name inside the parentheses.
       */
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select(`
          name, 
          email, 
          role,
          medical_intake!left (patient_id)
        `)
        .eq("id", userId)
        .maybeSingle();

      if (fetchError) {
        console.error("[useAuth] Profile Fetch DB Error:", fetchError);
        throw fetchError;
      }

      if (data) {
        // If data.medical_intake comes back as null or [], hasIntake is false.
        const intakeArray = data.medical_intake as any[];
        const hasIntake = intakeArray && intakeArray.length > 0;

        console.log("[useAuth] Medical Intake Debug:", {
          userId,
          foundProfile: true,
          rawIntakeData: data.medical_intake,
          hasIntake,
          policyHint: "If rawIntakeData is [] but data exists in DB, check RLS SELECT policy on medical_intake table."
        });

        setCurrentUser({ 
          id: userId, 
          name: data.name, 
          email: data.email, 
          role: data.role as "patient" | "doctor",
          hasMedicalIntake: hasIntake 
        });
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
      setLoading(false);
    }
  };

  const handleAutoCreate = async (userId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    
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
    
    setCurrentUser({
      id: userId,
      name: created?.name || "User",
      email: created?.email || "",
      role: (created?.role || "patient") as "patient" | "doctor",
      hasMedicalIntake: false
    });
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

  const login = async (email: string, password: string, role: "patient" | "doctor") => {
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