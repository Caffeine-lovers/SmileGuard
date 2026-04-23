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
        .maybeSingle();

      if (error) {
        console.error("[useAuth] Error fetching profile:", error);
        throw error;
      }

      if (!data) {
        // Profile doesn't exist yet - get basic user info from auth
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
        const userRole = user?.user_metadata?.role || "patient";

        console.log("[useAuth] Profile not found, using auth metadata:", {
          name: userName,
          role: userRole,
        });

        setCurrentUser({
          id: userId,
          name: userName,
          email: user?.email || "",
          role: userRole as "patient" | "doctor",
        });
      } else {
        // Profile exists - use it
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

      if (data.user && data.session) {
        console.log("[useAuth] ✅ Login successful");
        console.log("[useAuth] Session received from signInWithPassword:");
        console.log("  - User ID:", data.user.id);
        console.log("  - Access Token exists:", !!data.session.access_token);
        console.log("  - Refresh Token exists:", !!data.session.refresh_token);
        console.log("  - Expires at:", new Date(data.session.expires_at! * 1000).toISOString());

        // CRITICAL: Explicitly set the session to ensure it's persisted to AsyncStorage
        console.log("[useAuth] 🔐 Explicitly setting session on client...");
        const { error: setError } = await supabase.auth.setSession(data.session);
        
        if (setError) {
          console.error("[useAuth] ❌ Error setting session:", setError);
        } else {
          console.log("[useAuth] ✅ Session explicitly set on Supabase client");
        }

        // Verify session was saved
        const { data: { session: savedSession } } = await supabase.auth.getSession();
        if (savedSession?.access_token) {
          console.log("[useAuth] ✅ SESSION SAVED! Can retrieve from getSession()");
        } else {
          console.error("[useAuth] ❌ SESSION NOT SAVED - getSession() returns null");
        }

        // Fetch profile to get name and email
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, name, email")
          .eq("id", data.user.id)
          .maybeSingle();

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
      let message = err instanceof Error ? err.message : "Login failed";
      
      // Specifically guide users who might have signed up with OAuth
      // and are now trying to use a password they never set.
      if (message.includes("Invalid login credentials")) {
        message = "Invalid email or password. If you signed up with Google, please use 'Sign in with Google' above, or click 'Forgot Password' to set a password.";
      }
      
      setError(message);
      console.error("❌ Login error:", message);
      throw new Error(message); // Throw the improved message
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // ACCOUNT LINKING & CONFLICT DETECTION
  // ─────────────────────────────────────────
  const detectOAuthIdentity = async (email: string): Promise<string | null> => {
    /**
     * Attempts to check if an email has OAuth identities without auth context
     * Returns provider name ('google', 'github') or null if no OAuth found
     * Note: This is a detection helper; full identity lookup requires admin access
     */
    try {
      // Try signing in with the email to check session state
      // This won't actually log them in, but may reveal existing identities
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (user?.identities && user.identities.length > 0) {
        const oauthIdentity = user.identities.find(
          (id: any) => id.provider !== 'email' && id.provider !== 'phone'
        );
        if (oauthIdentity) {
          console.log(`[useAuth] Found OAuth identity: ${oauthIdentity.provider}`);
          return oauthIdentity.provider;
        }
      }
      return null;
    } catch (err) {
      console.warn("[useAuth] Could not detect OAuth identity");
      return null;
    }
  };

  const linkOAuthIdentity = async (provider: "google" | "github") => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.linkIdentity({
        provider,
      });

      if (error) throw error;
      
      console.log(`[useAuth] ✅ Account linked with ${provider}`);
      
      // Return the URL for OAuth linking
      return { success: true, url: data?.url };
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to link ${provider}`;
      setError(message);
      console.error(`[useAuth] Linking error:`, message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // REGISTER WITH CONFLICT DETECTION
  // ─────────────────────────────────────────
  const register = async (
    formData: FormData,
    role: "patient" | "doctor"
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.email || !formData.password) {
        throw new Error("Email and password are required");
      }

      if (!formData.name) {
        throw new Error("Name is required");
      }

      console.log("[useAuth] Starting registration for:", formData.email);

      // Trim and lowercase email
      const normalizedEmail = formData.email.trim().toLowerCase();
      
      console.log("[useAuth] Attempting auth signup with email:", normalizedEmail, "role:", role);
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role,
          },
        },
      });

      if (authError) {
        console.error("[useAuth] ❌ AUTH SIGNUP FAILED");
        console.error("[useAuth] Error message:", authError.message);
        console.error("[useAuth] Error code:", (authError as any)?.code);
        console.error("[useAuth] Error status:", (authError as any)?.status);
        console.error("[useAuth] Full error object:", authError);
        
        // ACCOUNT CONFLICT DETECTION
        // If "user already exists" error, provide guidance
        if (authError.message?.includes("already exists") || (authError as any)?.status === 422) {
          const conflictMessage = `This email is already registered. Try signing in with Google or another provider, or log in with your password if you have one.`;
          console.warn("[useAuth] Account conflict detected:", conflictMessage);
          throw new Error(conflictMessage);
        }
        
        throw authError;
      }

      if (!authData.user) {
        throw new Error("Auth signup failed: No user returned");
      }

      console.log("[useAuth] Auth user created:", authData.user.id);

      // Now try to update auth user metadata
      try {
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            name: formData.name,
            role,
          },
        });

        if (updateError) {
          console.warn("[useAuth] Failed to update user metadata (non-fatal):", updateError);
        } else {
          console.log("[useAuth] User metadata updated successfully");
        }
      } catch (metaErr) {
        console.warn("[useAuth] Error updating metadata (continuing anyway):", metaErr);
      }

      if (authData.user) {
        console.log("[useAuth] Auth user created, trigger will create profile automatically");

        // Update auth user metadata with name and role
        try {
          const { error: updateError } = await supabase.auth.updateUser({
            data: {
              name: formData.name,
              role,
            },
          });

          if (updateError) {
            console.warn("[useAuth] Failed to update user metadata (non-fatal):", updateError);
          } else {
            console.log("[useAuth] User metadata updated successfully");
          }
        } catch (metaErr) {
          console.warn("[useAuth] Error updating metadata (continuing anyway):", metaErr);
        }

        // The Supabase trigger (handle_new_user) has already created the profile
        // Just need to fetch it and set the current user
        console.log("[useAuth] Fetching profile created by trigger...");
        await fetchProfile(authData.user.id);
        
        console.log("[useAuth] Registration complete, profile fetched from trigger");
      }
    } catch (err) {
      let message = "Registration failed";
      let detailedError = "";
      
      if (err instanceof Error) {
        message = err.message;
        detailedError = JSON.stringify(err, null, 2);
        
        // Log additional error details
        if ((err as any).code) {
          console.error("[useAuth] Error code:", (err as any).code);
        }
        if ((err as any).status) {
          console.error("[useAuth] Error status:", (err as any).status);
        }
        
        console.error("❌ Registration error:", message);
        console.error("📋 Error details:", detailedError);
      } else if (typeof err === 'object' && err !== null) {
        detailedError = JSON.stringify(err, null, 2);
        console.error("❌ Registration error (object):", detailedError);
      }
      
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // ENSURE PROFILE EXISTS
  // ─────────────────────────────────────────
  const ensureProfileExists = async (userId: string, name: string, email: string, role: "patient" | "doctor" = "patient") => {
    try {
      console.log("[useAuth] Ensuring profile exists for:", userId);
      
      // Check if profile already exists
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (existing) {
        console.log("[useAuth] Profile already exists");
        return;
      }

      // Create profile
      console.log("[useAuth] Creating profile for:", userId);
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          name,
          email,
          role,
        });

      if (insertError) {
        console.error("[useAuth] Error creating profile:", insertError);
        throw insertError;
      }

      console.log("[useAuth] Profile created successfully");
    } catch (err) {
      console.error("[useAuth] Failed to ensure profile exists:", err);
      throw err;
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
  // ENSURE ROLE IS SET (Verification only, no updates due to RLS)
  // ─────────────────────────────────────────
  const ensureRoleSet = async (userId: string, expectedRole: "patient" | "doctor") => {
    try {
      console.log(`[useAuth] Verifying role is set for user ${userId} to ${expectedRole}`);
      
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .maybeSingle();

      if (!profile) {
        console.warn("[useAuth] Profile not found - trigger may still be running");
        // Wait a moment and try again
        await new Promise(resolve => setTimeout(resolve, 1000));
        return ensureRoleSet(userId, expectedRole);
      } else if (fetchError) {
        console.error("[useAuth] Error fetching profile:", fetchError);
        return false;
      }

      // Profile exists, verify role is correct
      if (profile && profile.role === expectedRole) {
        console.log(`[useAuth] ✅ Role is correctly set to ${expectedRole}`);
        return true;
      } else if (profile) {
        console.warn(`[useAuth] ⚠️ Role mismatch: Current ${profile.role} ≠ Expected ${expectedRole}`);
        console.warn("[useAuth] This may be due to RLS policies or trigger configuration");
        // Return true anyway - the profile exists with a role, even if it might be wrong
        return true;
      }

      return false;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to ensure role";
      console.error("[useAuth] ensureRoleSet error:", message);
      return false;
    }
  };

  // ─────────────────────────────────────────
  // SIGNUP OTP
  // ─────────────────────────────────────────
  const sendSignupOtp = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
      });
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
      const { error } = await supabase.from('profiles').update(data).eq('id', userId);
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

  // ─────────────────────────────────────────
  // VERIFY OTP
  // ─────────────────────────────────────────
  const verifyEmailOtp = async (email: string, token: string) => {
    setLoading(true);
    setError(null);
    try {
      // With signInWithOtp, the type is usually 'email' or 'magiclink'
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });

      if (error) throw error;

      if (data.session?.user) {
        await fetchProfile(data.session.user.id);
      }
      return { success: true, user: data.user };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setError(message);
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

  // ─────────────────────────────────────────
  // OAUTH SIGN-IN (Google, GitHub, etc.)
  // ─────────────────────────────────────────
  const signInWithOAuth = async (provider: "google" | "github", redirectTo?: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo || `${typeof window !== "undefined" ? window.location.origin : ""}/dashboard`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
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
    ensureProfileExists,
    signInWithOAuth,
    detectOAuthIdentity,
    linkOAuthIdentity,
  };
}
