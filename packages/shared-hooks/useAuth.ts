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
   * Set to false in patient-web where the signup confirm page owns profile creation.
   * Defaults to true for native app compatibility.
   */
  autoCreateProfile?: boolean;
}

export function useAuth(options: UseAuthOptions = {}) {
  const { autoCreateProfile = true } = options;

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
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[useAuth] Error getting initial session:", err);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        console.log("[useAuth] Auth state changed:", {
          event: _event,
          hasSession: !!session,
          userId: session?.user?.id,
          timestamp: new Date().toISOString(),
        });

        if (_event === "SIGNED_OUT") {
          setCurrentUser(null);
          setLoading(false);
        } else if (session?.user) {
          if (currentUser?.id === session.user.id) {
            console.log("[useAuth] currentUser already set for", session.user.id, "- skipping fetch");
            return;
          }
          await fetchProfile(session.user.id);
        } else {
          setCurrentUser(null);
          setLoading(false);
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
        .maybeSingle();

      if (error) {
        if (error.code === "PGRST116") {
          // Profile doesn't exist yet
          if (!autoCreateProfile) {
            // Web: confirm page owns profile creation — just hydrate from session metadata
            console.log("[useAuth] Profile not found, autoCreateProfile=false — reading from session metadata only");
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
            const userRole = (user?.user_metadata?.role as "patient" | "doctor") || "patient";
            const userEmail = user?.email || "";

            setCurrentUser({ id: userId, name: userName, email: userEmail, role: userRole });
            setLoading(false);
            return;
          }

          // Native: auto-create profile as before
          console.warn("[useAuth] Profile not found (PGRST116), creating...");
          const { data: { session } } = await supabase.auth.getSession();
          const user = session?.user;
          const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
          const userRole = user?.user_metadata?.role || "patient";
          const userEmail = user?.email || "";

          const { data: createdProfile, error: createError } = await supabase
            .from("profiles")
            .upsert([{
              id: userId,
              name: userName,
              email: userEmail,
              role: userRole,
              service: user?.user_metadata?.service || "General",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }], { onConflict: "id" })
            .select()
            .single();

          if (createError) {
            console.error("[useAuth] Error creating profile:", createError.message);
            setCurrentUser({ id: userId, name: userName, email: userEmail, role: userRole as "patient" | "doctor" });
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
          console.error("[useAuth] Profile query error:", error.code, error.message);
          throw error;
        }
      } else {
        console.log("[useAuth] Profile fetched:", { id: userId, name: data.name, role: data.role });
        setCurrentUser({ id: userId, name: data.name, email: data.email, role: data.role });
      }
    } catch (err) {
      console.error("[useAuth] Error in fetchProfile:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch profile");
      setCurrentUser({ id: userId, name: "User", email: "", role: "patient" });
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user && data.session) {
        const { error: setSessionError } = await supabase.auth.setSession(data.session);
        if (setSessionError) console.error("[useAuth] Error setting session:", setSessionError);

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, name, email")
          .eq("id", data.user.id)
          .maybeSingle();

        const userRole = profile?.role || data.user.user_metadata?.role;
        if (userRole !== expectedRole) {
          await supabase.auth.signOut();
          throw new Error(`Access denied. Please log in as a ${expectedRole}.`);
        }

        await fetchProfile(data.user.id);

        return {
          id: data.user.id,
          name: profile?.name || data.user.user_metadata?.name || "User",
          email: profile?.email || data.user.email || "",
          role: userRole as "patient" | "doctor",
        };
      }

      throw new Error("Login failed: No user data returned");
    } catch (err) {
      let message = err instanceof Error ? err.message : "Login failed";
      if (message.includes("Invalid login credentials")) {
        message = "Invalid email or password. If you signed up with Google, please use 'Sign in with Google', or click 'Forgot Password' to set a password.";
      }
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // REGISTER
  // ─────────────────────────────────────────
  const register = async (formData: FormData, role: "patient" | "doctor") => {
    setLoading(true);
    setError(null);
    try {
      if (!formData.email || !formData.password) throw new Error("Email and password are required");
      if (!formData.name) throw new Error("Name is required");

      const normalizedEmail = formData.email.trim().toLowerCase();
      console.log("[useAuth] Starting registration for:", normalizedEmail);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: formData.password,
        options: {
          data: { name: formData.name, role },
        },
      });

      if (authError) {
        if (authError.message?.includes("already exists") || (authError as any)?.status === 422) {
          throw new Error("This email is already registered. Try signing in with Google or log in with your password.");
        }
        throw authError;
      }

      if (!authData.user) throw new Error("Auth signup failed: No user returned");

      console.log("[useAuth] Auth user created:", authData.user.id);

      // Create profile immediately after signup
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert([{
          id: authData.user.id,
          name: formData.name,
          email: normalizedEmail,
          role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }], { onConflict: "id" });

      if (profileError) {
        console.warn("[useAuth] Failed to create profile (non-fatal):", profileError.message);
      } else {
        console.log("[useAuth] Profile created successfully");
      }

      setCurrentUser({ id: authData.user.id, name: formData.name, email: normalizedEmail, role });
      setLoading(false);
      console.log("[useAuth] Registration complete");

      return { id: authData.user.id, name: formData.name, email: normalizedEmail, role };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
      console.error("[useAuth] Registration error:", message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // OAUTH SIGN-IN
  // ─────────────────────────────────────────
  const signInWithOAuth = async (provider: "google" | "github", redirectTo?: string) => {
    setLoading(true);
    setError(null);
    try {
      // redirectTo MUST be provided by the caller — no hardcoded default.
      // patient-web signup: pass /auth/callback?next=/signup/confirm
      // patient-web login:  pass /auth/callback?next=/dashboard
      // native:             pass the deep link scheme
      if (!redirectTo) {
        throw new Error("redirectTo is required for signInWithOAuth — pass the appropriate callback URL for your platform.");
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });

      if (error) throw error;
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : `${provider} sign-in failed`;
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // REMAINING METHODS (unchanged)
  // ─────────────────────────────────────────
  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setCurrentUser(null);
    } catch (err) {
      console.error("[useAuth] Logout error:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const ensureRoleSet = async (userId: string, expectedRole: "patient" | "doctor") => {
    try {
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .maybeSingle();

      if (fetchError?.code === "PGRST116") {
        console.warn("[useAuth] Profile not found in ensureRoleSet, retrying...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        return ensureRoleSet(userId, expectedRole);
      } else if (fetchError) {
        console.error("[useAuth] ensureRoleSet fetch error:", fetchError);
        return false;
      }

      if (profile?.role === expectedRole) {
        console.log(`[useAuth] Role correctly set to ${expectedRole}`);
        return true;
      }

      console.warn(`[useAuth] Role mismatch: ${profile?.role} vs expected ${expectedRole}`);
      return true; // Profile exists, proceed
    } catch (err) {
      console.error("[useAuth] ensureRoleSet error:", err);
      return false;
    }
  };

  const sendSignupOtp = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase() });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send verification code";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateUserPassword = async (password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateProfileData = async (userId: string, data: any) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.from("profiles").update(data).eq("id", userId);
      if (error) throw error;
      await fetchProfile(userId);
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });
      if (error) throw error;
      if (data.session?.user) await fetchProfile(data.session.user.id);
      return { success: true, user: data.user };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/reset-password`,
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

  const detectOAuthIdentity = async (_email: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.identities) {
        const oauthIdentity = user.identities.find(
          (id: any) => id.provider !== "email" && id.provider !== "phone"
        );
        if (oauthIdentity) return oauthIdentity.provider;
      }
      return null;
    } catch {
      return null;
    }
  };

  const linkOAuthIdentity = async (provider: "google" | "github") => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.linkIdentity({ provider });
      if (error) throw error;
      return { success: true, url: data?.url };
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to link ${provider}`;
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
    sendSignupOtp,
    verifyEmailOtp,
    updateUserPassword,
    updateProfileData,
    ensureRoleSet,
    signInWithOAuth,
    detectOAuthIdentity,
    linkOAuthIdentity,
  };
}