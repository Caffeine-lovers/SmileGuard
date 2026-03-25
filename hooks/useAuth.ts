import { useState, useEffect } from "react";
import { CurrentUser, FormData } from "../types/index.ts";
import { supabase } from "../lib/supabase.ts";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setCurrentUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    console.log("🔍 Fetching profile for user:", userId);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, email, role")
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          console.warn("⚠️ Profile not found, creating from user metadata...");
          const { data: { user } } = await supabase.auth.getUser();

          if (!user || user.id !== userId) {
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
            console.error("❌ Error creating profile:", createError);
            setCurrentUser({
              id:    userId,                    // ← UUID always set
              name:  userName,
              email: user.email || "",
              role:  userRole as "patient" | "doctor",
            });
          } else {
            setCurrentUser({
              id:    userId,
              name:  createdProfile?.name  || userName,
              email: createdProfile?.email || user.email || "",
              role:  (createdProfile?.role as "patient" | "doctor") || userRole,
            });
          }
        } else {
          throw error;
        }
      } else {
        setCurrentUser({
          id:    userId,                        // ← UUID always set
          name:  data.name,
          email: data.email,
          role:  data.role,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load profile.";
      console.error("❌ Error in fetchProfile:", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const login = async (
    email: string,
    password: string,
    role: "patient" | "doctor"
  ): Promise<CurrentUser> => {
    setError(null);
    console.log("🔐 Starting login for:", email, "as", role);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw new Error(error.message);

    console.log("✅ Auth successful, user ID:", data.user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, email, role")
      .eq("id", data.user.id)
      .single();

    if (profileError && profileError.code === "PGRST116") {
      console.warn("⚠️ Profile not found, creating from metadata...");

      const userName = data.user.user_metadata?.name || email.split("@")[0];
      const userRole = data.user.user_metadata?.role || role;

      const { data: insertedProfile, error: createError } = await supabase
        .from("profiles")
        .insert({
          id:      data.user.id,
          name:    userName,
          email:   data.user.email,
          role:    userRole,
          service: data.user.user_metadata?.service || "General",
        })
        .select()
        .single();

      if (createError) throw new Error(`Failed to create profile: ${createError.message}`);

      return {
        id:    data.user.id,                    // ← UUID always set
        name:  insertedProfile?.name  || userName,
        email: insertedProfile?.email || data.user.email || email,
        role:  (insertedProfile?.role as "patient" | "doctor") || userRole,
      };
    }

    if (profileError) throw new Error(`Profile error: ${profileError.message}`);
    if (!profile)     throw new Error("Profile not found. Please contact support.");

    if (profile.role !== role) {
      await supabase.auth.signOut();
      throw new Error(
        `This account is registered as a ${profile.role}, not a ${role}.`
      );
    }

    return {
      id:    data.user.id,                      // ← UUID always set
      name:  profile.name,
      email: profile.email,
      role:  profile.role,
    };
  };

  const register = async (
    formData: FormData,
    role: "patient" | "doctor"
  ): Promise<CurrentUser> => {
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          name:           formData.name,
          role,
          service:        formData.service || "General",
          medical_intake: formData.medicalIntake ?? {},
        },
      },
    });

    if (error)       throw new Error(error.message);
    if (!data.user)  throw new Error("Registration failed. Please try again.");

    console.log("✅ Registration successful. User ID:", data.user.id, "Role:", role);

    return {
      id:    data.user.id,                      // ← UUID always set
      name:  formData.name,
      email: formData.email,
      role,
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