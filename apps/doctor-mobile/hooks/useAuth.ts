import { useState, useEffect } from "react";
import { CurrentUser, FormData } from "../types/index";
import { supabase } from "@smileguard/supabase-client";
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
          // Skip fetching if currentUser already set for this userId (likely from register())
          if (currentUser?.id === session.user.id) {
            console.log("[useAuth] ℹ️  currentUser already set for", session.user.id, "- skipping fetch");
            return;
          }
          await fetchProfile(session.user.id);
        } else {
          setCurrentUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    console.log("[useAuth] 📱 Fetching profile for user:", userId);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, email, role")
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          console.warn("[useAuth] ⚠️ Profile not found (PGRST116), attempting to create...");
          const { data: { user } } = await supabase.auth.getUser();

          if (!user || user.id !== userId) {
            console.error("[useAuth] ❌ User validation failed");
            setError("User not found.");
            setLoading(false);
            return;
          }

          const userName = user.user_metadata?.name || user.email?.split("@")[0] || "User";
          const userRole = user.user_metadata?.role || "doctor";
          const userEmail = user.email || "";

          console.log("[useAuth] Creating profile with metadata:", { userName, userRole, userEmail });

          const { data: createdProfile, error: createError } = await supabase
            .from("profiles")
            .upsert([{
              id: userId,
              name: userName,
              email: userEmail,
              role: userRole,
              service: user.user_metadata?.service || "General",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }], { onConflict: "id" })
            .select()
            .single();

          if (createError) {
            console.error("[useAuth] ❌ Error creating profile:", createError.message, createError.code);
            // Still set user even if creation fails
            setCurrentUser({
              id:    userId,
              name:  userName,
              email: userEmail,
              role:  userRole as "patient" | "doctor",
            });
          } else {
            console.log("[useAuth] ✅ Profile created successfully:", createdProfile);
            setCurrentUser({
              id:    userId,
              name:  createdProfile?.name  || userName,
              email: createdProfile?.email || userEmail,
              role:  (createdProfile?.role as "patient" | "doctor") || userRole,
            });
          }
        } else {
          console.error("[useAuth] ❌ Profile query error (not PGRST116):", error.code, error.message);
          throw error;
        }
      } else {
        console.log("[useAuth] ✅ Profile fetched successfully:", { id: userId, name: data.name, role: data.role });
        setCurrentUser({
          id:    userId,
          name:  data.name,
          email: data.email,
          role:  data.role,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load profile.";
      console.error("[useAuth] ❌ Error in fetchProfile:", err);
      setError(msg);
      // Still set a minimal user object to prevent the app from being stuck
      setCurrentUser({
        id: userId,
        name: "Doctor",
        email: "",
        role: "doctor",
      });
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
    console.log(" Starting login for:", email, "as", role);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw new Error(error.message);

    console.log(" Auth successful, user ID:", data.user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("name, email, role")
      .eq("id", data.user.id)
      .single();

    if (profileError && profileError.code === "PGRST116") {
      console.warn("️ Profile not found, creating from metadata...");

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
    console.log("[useAuth] Starting registration for:", formData.email);
    
    const normalizedEmail = formData.email.trim().toLowerCase();
    
    console.log("[useAuth] Attempting auth signup with email:", normalizedEmail, "role:", role);
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
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

    console.log("[useAuth] ✅ Auth user created:", data.user.id, "Role:", role);

    // Immediately create the profile so it exists for the app
    console.log("[useAuth] Creating profile for user:", data.user.id);
    const { error: profileCreateError } = await supabase
      .from("profiles")
      .upsert([{
        id: data.user.id,
        name: formData.name,
        email: normalizedEmail,
        role,
        service: formData.service || "General",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }], { onConflict: "id" });

    if (profileCreateError) {
      console.warn("[useAuth] ⚠️ Failed to create profile (non-fatal):", profileCreateError.message);
      // Don't fail the entire registration if profile creation fails
      // The fetchProfile() function will create it if needed
    } else {
      console.log("[useAuth] ✅ Profile created successfully");
    }

    return {
      id:    data.user.id,                      // ← UUID always set
      name:  formData.name,
      email: normalizedEmail,
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