import { useState, useEffect } from "react";
import { CurrentUser, FormData } from "../types";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen for auth state changes (auto-restores session on app restart)
  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(() => {
      // Handle network error or storage corruption - prevent app freeze
      setLoading(false);
    });

    // Subscribe to future auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setCurrentUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Fetch the user's profile from the profiles table
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, email, role")
        .eq("id", userId)
        .single();

      if (error) throw error;

      setCurrentUser({
        name: data.name,
        email: data.email,
        role: data.role,
      });
    } catch (err) {
      // User-facing error handling instead of silent console.error
      const errorMessage = err instanceof Error ? err.message : "Failed to load profile. Please try again.";
      setError(errorMessage);
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const login = async (
    email: string,
    password: string,
    role: "patient" | "doctor"
  ): Promise<CurrentUser> => {
    // Clear any previous errors
    setError(null);
    
    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    // Fetch the user's profile to verify their role
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, email, role")
      .eq("id", data.user.id)
      .single();

    if (profileError) {
      throw new Error("Profile not found. Please contact support.");
    }

    if (profile.role !== role) {
      // Sign them out since role doesn't match
      await supabase.auth.signOut();
      throw new Error(`This account is not registered as a ${role}.`);
    }

    return {
      name: profile.name,
      email: profile.email,
      role: profile.role,
    };
  };

  const register = async (
    formData: FormData,
    role: "patient" | "doctor"
  ): Promise<CurrentUser> => {
    // Create the auth account in Supabase
    // Pass name, role, service, and medical intake as metadata — the database
    // trigger will automatically create the profile row from this data
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          name: formData.name,
          role: role,
          service: formData.service || "General",
          // Medical intake (patient only — will be empty obj for doctors)
          medical_intake: formData.medicalIntake ?? {},
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error("Registration failed. Please try again.");
    }

    return {
      name: formData.name,
      email: formData.email,
      role: role,
    };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setError(null);
  };

  return {
    currentUser,
    setCurrentUser,
    loading,
    error,
    setError,
    login,
    register,
    logout,
  };
}
