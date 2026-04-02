/**
 * useAuth Hook - Shared authentication hook for patient-web and doctor-mobile
 */

import { useState, useEffect } from "react";
import { CurrentUser, FormData } from "@smileguard/shared-types";
import { supabase } from "@smileguard/supabase-client";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("[useAuth] Initializing auth hook...");
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        console.log("[useAuth] Initial session check:", { hasSession: !!session, userId: session?.user?.id });
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          console.log("[useAuth] No active session found");
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[useAuth] Error getting session:", err);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        console.log("[useAuth] Auth state changed:", { event: _event, hasSession: !!session, userId: session?.user?.id });
        if (_event === "SIGNED_OUT") {
          console.warn("[useAuth] Session expired or user signed out");
        }
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          console.log("[useAuth] Session cleared, user set to null");
          setCurrentUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    console.log("[useAuth] Fetching profile for user:", userId);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, email, role")
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          console.warn("[useAuth] Profile not found, creating from user metadata...");
          const { data: { user } } = await supabase.auth.getUser();

          if (!user || user.id !== userId) {
            console.error("[useAuth] User verification failed");
            setError("User not found.");
            setLoading(false);
            return;
          }

          const userName = user.user_metadata?.name || user.email?.split("@")[0] || "User";
          const userRole = user.user_metadata?.role || "patient";

          const { data: createdProfile, error: createError } = await supabase
            .from("profiles")
            .insert({
              id: userId,
              name: userName,
              email: user.email || "",
              role: userRole,
              service: user.user_metadata?.service || "General",
            })
            .select()
            .single();

          if (createError) {
            console.error("[useAuth] Error creating profile:", createError);
            setCurrentUser({
              id: userId,
              name: userName,
              email: user.email || "",
              role: userRole as "patient" | "doctor",
            });
          } else {
            console.log("[useAuth] Profile created successfully:", createdProfile);
            setCurrentUser({
              id: userId,
              name: createdProfile.name,
              email: createdProfile.email,
              role: createdProfile.role,
            });
          }
        } else {
          throw error;
        }
      } else {
        console.log("[useAuth] Profile fetched successfully:", { name: data.name, role: data.role });
        setCurrentUser({
          id: userId,
          name: data.name,
          email: data.email,
          role: data.role,
        });
      }
    } catch (err) {
      console.error("[useAuth] Error fetching profile:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────
  const login = async (email: string, password: string, expectedRole: "patient" | "doctor"): Promise<CurrentUser> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Fetch profile to get name and email
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, name, email")
          .eq("id", data.user.id)
          .single();

        // Determine the user's role - check profile first, then fall back to user_metadata
        const profileRole = profile?.role;
        const metadataRole = data.user.user_metadata?.role;
        const userRole = profileRole || metadataRole;

        // Check if user has the right role
        if (userRole !== expectedRole) {
          await supabase.auth.signOut();
          throw new Error(`Access denied. Please log in as a ${expectedRole}.`);
        }

        await fetchProfile(data.user.id);
        
        // Return the user data
        return {
          id: data.user.id,
          name: profile?.name || data.user.user_metadata?.name || "User",
          email: profile?.email || data.user.email || "",
          role: userRole as "patient" | "doctor",
        };
      }

      throw new Error("Login failed: No user data returned");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      console.error("❌ Login error:", message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────
  const register = async (
    formData: FormData,
    role: "patient" | "doctor"
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role,
            service: formData.service || "General",
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: authData.user.id,
            name: formData.name,
            email: formData.email,
            role,
            service: formData.service || "General",
          });

        if (profileError) {
          console.warn("Profile creation warning:", profileError);
          // Don't throw — profile may auto-create via trigger
        }

        // Create medical_intake for patients
        if (role === "patient" && formData.medicalIntake) {
          const { error: intakeError } = await supabase
            .from("medical_intake")
            .insert({
              patient_id: authData.user.id,
              ...formData.medicalIntake,
            });

          if (intakeError) console.warn("Medical intake creation warning:", intakeError);
        }

        await fetchProfile(authData.user.id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
      console.error("❌ Registration error:", message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────
  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
    } catch (err) {
      console.error("❌ Logout error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // RESET PASSWORD
  // ─────────────────────────────────────────
  const resetPassword = async (email: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/reset-password`,
      });

      if (error) throw error;

      return { success: true, message: "Password reset email sent" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reset failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    currentUser,
    loading,
    error,
    login,
    register,
    logout,
    resetPassword,
  };
}
