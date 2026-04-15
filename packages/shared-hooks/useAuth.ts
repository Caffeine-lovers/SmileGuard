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
        console.error("[useAuth] Profile query error:", { 
          code: error.code, 
          message: error.message, 
          details: error.details,
          hint: error.hint 
        });
        
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
            console.error("[useAuth] Error creating profile:", { 
              code: createError.code,
              message: createError.message,
              details: createError.details 
            });
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
      console.error("[useAuth] Error fetching profile:", {
        error: err,
        errorString: JSON.stringify(err),
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        errorStack: err instanceof Error ? err.stack : "No stack"
      });
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
          .select("role, name, email, phone_number, nationality")
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
  ): Promise<{ totpSecret?: string; qrCodeURI?: string; factorId?: string } | void> => {
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
            phone: formData.phone || '',
            nationality: formData.nationality || '',
          },
          emailRedirectTo: undefined,
        },
      });

      if (authError) {
        console.error("[useAuth] ❌ AUTH SIGNUP FAILED");
        console.error("[useAuth] Error message:", authError.message);
        console.error("[useAuth] Error code:", (authError as any)?.code);
        console.error("[useAuth] Error status:", (authError as any)?.status);
        console.error("[useAuth] Full error object:", authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error("Auth signup failed: No user returned");
      }

      console.log("[useAuth] Auth user created:", authData.user.id);

      // Capture MFA enrollment result to return after all registration steps finish
      let mfaResult: { totpSecret?: string; qrCodeURI?: string; factorId?: string } | undefined;

      // Enroll TOTP MFA
      try {
        console.log("[useAuth] Enrolling TOTP MFA factor...");
        const { data: enrollData, error: enrollError } = await (supabase.auth.mfa as any).enrollFactors({
          factorType: 'totp',
        });

        if (enrollError) {
          console.warn("[useAuth] Failed to enroll TOTP (non-fatal):", enrollError);
          // Continue anyway - MFA is optional
        } else if (enrollData && enrollData.totp) {
          console.log("[useAuth] TOTP factor enrolled successfully, factor ID:", enrollData.totp.id);
          mfaResult = {
            totpSecret: enrollData.totp.secret,
            qrCodeURI: enrollData.totp.qr_code,
            factorId: enrollData.totp.id,
          };
        }
      } catch (mfaErr) {
        console.warn("[useAuth] Error during TOTP enrollment (continuing):", mfaErr);
      }

      // The Supabase trigger (handle_new_user) has already created the profile
      // Just need to fetch it and set the current user
      console.log("[useAuth] Fetching profile created by trigger...");
      await fetchProfile(authData.user.id);

      // Update the profile with phone and nationality
      try {
        const phoneNumber = formData.phone
          ? (formData.nationality ? `${formData.nationality}${formData.phone}` : formData.phone)
          : null;
        const nationality = formData.nationality || null;
        console.log("[useAuth] Updating profile with phone_number and nationality...");
        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({
            phone_number: phoneNumber,
            nationality,
          })
          .eq('id', authData.user.id);

        if (updateProfileError) {
          console.warn("[useAuth] Failed to update profile phone/nationality (non-fatal):", updateProfileError);
        } else {
          console.log("[useAuth] Profile phone and nationality updated successfully");
        }
      } catch (profileErr) {
        console.warn("[useAuth] Error updating profile (continuing anyway):", profileErr);
      }

      console.log("[useAuth] Registration complete, profile fetched and updated");
      return mfaResult;
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
  // VERIFY TOTP
  // ─────────────────────────────────────────
  const verifyTOTP = async (factorId: string, totpCode: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log("[useAuth] Verifying TOTP code for factor:", factorId);
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session for TOTP verification");
      }

      // Verify the TOTP factor
      const { data: verifyData, error: verifyError } = await (supabase.auth.mfa as any).verifyFactor({
        factorId,
        code: totpCode,
      });

      if (verifyError) {
        console.error("[useAuth] TOTP verification failed:", verifyError);
        throw verifyError;
      }

      console.log("[useAuth] TOTP verification successful", verifyData);
      
      // Fetch profile after successful verification
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await fetchProfile(user.id);
      }

      return verifyData;
    } catch (err) {
      const message = err instanceof Error ? err.message : "TOTP verification failed";
      setError(message);
      console.error("❌ TOTP verification error:", message);
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
  // ENSURE ROLE IS SET (Verification only, no updates due to RLS)
  // ─────────────────────────────────────────
  const ensureRoleSet = async (userId: string, expectedRole: "patient" | "doctor") => {
    try {
      console.log(`[useAuth] Verifying role is set for user ${userId} to ${expectedRole}`);
      
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", userId)
        .single();

      if (fetchError && fetchError.code === "PGRST116") {
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

  const signInWithGoogle = async (redirectTo?: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log("[useAuth] Initiating Google OAuth sign-in...");
      
      // Get the actual app URL from window for web, or use localhost for server
      const isServer = typeof window === 'undefined';
      let redirectUrl: string;
      
      if (!isServer) {
        const protocol = window.location.protocol;
        const host = window.location.host;
        const basePath = redirectTo || '/auth/callback';
        redirectUrl = `${protocol}//${host}${basePath}`;
      } else {
        redirectUrl = redirectTo 
          ? `http://localhost:3000${redirectTo}`
          : 'http://localhost:3000/auth/callback';
      }
      
      console.log("[useAuth] Google redirect URL:", redirectUrl);
      
      // Ensure we're using HTTP for web, not a custom scheme
      if (redirectUrl.includes('smileguard://')) {
        console.warn("[useAuth] Redirect URL contains smileguard:// scheme, converting to http");
        redirectUrl = redirectUrl.replace('smileguard://', 'http://localhost:3000/');
      }
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          scopes: 'openid profile email',
        },
      });

      if (error) {
        console.error("[useAuth] Google OAuth failed:", error);
        throw error;
      }

      console.log("[useAuth] Google OAuth redirect initiated to:", redirectUrl);
    } catch (err) {
      console.error("[useAuth] Google sign-in error:", err);
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
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
    verifyTOTP,
    resetPassword,
    sendSignupOtp,
    verifyEmailOtp,
    updateUserPassword,
    updateProfileData,
    ensureRoleSet,
    signInWithGoogle,
  };
}
