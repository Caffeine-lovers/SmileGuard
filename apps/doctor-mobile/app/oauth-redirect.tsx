import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, BackHandler, Platform } from "react-native";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@smileguard/supabase-client";

/**
 * Deep Link Handler for OAuth Callback
 *
 * This route handles the OAuth redirect from Google/other providers.
 * It exchanges the authorization code for a session or extracts access/refresh tokens.
 * Once authenticated, it resolves the user role and routes directly to the correct dashboard.
 *
 * URL formats:
 * - smileguard://oauth-redirect?code=...
 * - smileguard://oauth-redirect#access_token=...&refresh_token=...
 * - smileguard://redirect?code=...
 */
export default function OAuthRedirect() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ code?: string; error?: string }>();
  const [status, setStatus] = useState("Completing sign-in...");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Intercept back button to return to root login cleanly
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      router.replace("/");
      return true;
    });

    return () => backSub.remove();
  }, [router]);

  useEffect(() => {
    let fallbackTimer: NodeJS.Timeout | null = null;
    let errorTimer: NodeJS.Timeout | null = null;
    let isCancelled = false;

    const resolveAndRoute = async (userId: string) => {
      if (isCancelled) return;
      try {
        console.log("[OAuthRedirect] Resolving role and destination for user:", userId);
        const [savedCodeRaw, savedRole, { data: profile }] = await Promise.all([
          AsyncStorage.getItem("@pending_doctor_access_code"),
          AsyncStorage.getItem("@pending_user_role"),
          supabase.from("profiles").select("role").eq("id", userId).maybeSingle(),
        ]);
        const savedCode = (savedCodeRaw || "").trim().toUpperCase();
        const effectiveRole = savedRole || profile?.role;

        // Helper to record access code use and clean up temporary storage
        const finalizeAuth = async () => {
          if (savedCode) {
            try {
              await supabase.rpc("record_code_sign_in", {
                p_code: savedCode,
                p_platform: Platform.OS,
              });
            } catch (e) {
              console.warn("[OAuthRedirect] Sign-in record error:", e);
            }
          }
          await AsyncStorage.multiRemove([
            "@pending_doctor_access_code",
            "@pending_user_role",
          ]).catch(() => {});
        };

        if (effectiveRole === "admin" || profile?.role === "admin") {
          console.log("[OAuthRedirect] Admin detected -> /(admin)/dashboard");
          await finalizeAuth();
          router.replace("/(admin)/dashboard");
          return;
        }

        if (effectiveRole === "assistant") {
          const { data: ast } = await supabase
            .from("assistants")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

          if (ast) {
            console.log("[OAuthRedirect] Assistant profile confirmed -> /(doctor)/dashboard");
            await finalizeAuth();
            router.replace("/(doctor)/dashboard");
          } else {
            console.log("[OAuthRedirect] Assistant profile missing -> /setup-profile");
            router.replace("/setup-profile");
          }
          return;
        }

        // Doctor check
        const { data: doc } = await supabase
          .from("doctors")
          .select("id")
          .or(`user_id.eq.${userId},id.eq.${userId}`)
          .maybeSingle();

        if (doc) {
          console.log("[OAuthRedirect] Doctor profile confirmed -> /(doctor)/dashboard");
          await finalizeAuth();
          router.replace("/(doctor)/dashboard");
          return;
        }

        // Fallback: check if registered as assistant
        const { data: isAst } = await supabase
          .from("assistants")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (isAst) {
          console.log("[OAuthRedirect] Assistant record found -> /(doctor)/dashboard");
          await finalizeAuth();
          router.replace("/(doctor)/dashboard");
          return;
        }

        console.log("[OAuthRedirect] Profile not yet created -> /setup-profile");
        router.replace("/setup-profile");
      } catch (navErr) {
        console.error("[OAuthRedirect] Navigation resolution error:", navErr);
        router.replace("/setup-profile");
      }
    };

    const handleOAuthCallback = async () => {
      try {
        console.log("[OAuthRedirect] Handler called with search params:", searchParams);

        if (searchParams.error) {
          console.error("❌ OAuth error:", searchParams.error);
          setStatus("Sign-in failed. Please try again.");
          setHasError(true);
          errorTimer = setTimeout(() => router.replace("/"), 2500);
          return;
        }

        // 1. Check if tokens were delivered in URL hash (#access_token=...&refresh_token=...)
        const initialUrl = await Linking.getInitialURL().catch(() => null);
        if (initialUrl && initialUrl.includes("#")) {
          const hashPart = initialUrl.substring(initialUrl.indexOf("#") + 1);
          const hashParams = hashPart.split("&").reduce((acc, pair) => {
            const [k, v] = pair.split("=");
            if (k && v) acc[k] = decodeURIComponent(v);
            return acc;
          }, {} as Record<string, string>);

          if (hashParams.access_token && hashParams.refresh_token) {
            console.log("[OAuthRedirect] Restoring session from deep link hash tokens...");
            await supabase.auth.setSession({
              access_token: hashParams.access_token,
              refresh_token: hashParams.refresh_token,
            }).catch((err) => console.warn("[OAuthRedirect] setSession from hash error:", err));
          }
        }

        // 2. Exchange authorization code for a session (PKCE flow)
        if (searchParams.code) {
          console.log("[OAuthRedirect] Exchanging code for session...");
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(searchParams.code);
          if (exchangeError) {
            console.warn("⚠️ [OAuthRedirect] Code exchange note:", exchangeError.message);
            // Verify if active session exists anyway (e.g. exchanged concurrently by AuthModal)
            const { data: { session: existingSession } } = await supabase.auth.getSession();
            if (!existingSession?.user) {
              console.error("❌ OAuth error and no active session:", exchangeError);
              setStatus("Sign-in failed. Please try again.");
              setHasError(true);
              errorTimer = setTimeout(() => router.replace("/"), 2500);
              return;
            }
          }
        }

        setStatus("Signing you in...");

        // 3. Immediately check session and route without artificial delay
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await resolveAndRoute(session.user.id);
          return;
        }

        // Short fallback timer in case session resolution takes a moment
        fallbackTimer = setTimeout(async () => {
          if (isCancelled) return;
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession?.user) {
            await resolveAndRoute(retrySession.user.id);
          } else {
            console.warn("[OAuthRedirect] No active session after fallback check, routing to /");
            router.replace("/");
          }
        }, 1200);
      } catch (error) {
        console.error("❌ Error handling OAuth callback:", error);
        // Before showing error, verify if session is active
        const { data: { session: checkSession } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
        if (checkSession?.user) {
          await resolveAndRoute(checkSession.user.id);
        } else {
          setStatus("Sign-in failed. Please try again.");
          setHasError(true);
          errorTimer = setTimeout(() => router.replace("/"), 2500);
        }
      }
    };

    handleOAuthCallback();

    return () => {
      isCancelled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (errorTimer) clearTimeout(errorTimer);
    };
  }, [searchParams, router]);

  return (
    <View style={styles.container}>
      {!hasError && <ActivityIndicator size="large" color="#10B981" />}
      <Text style={styles.statusText}>
        {status}
      </Text>
      {hasError && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.replace("/")}
          activeOpacity={0.8}
        >
          <Text style={styles.retryButtonText}>Return to Login</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 24,
  },
  statusText: {
    marginTop: 16,
    color: "#64748B",
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: "#10B981",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
});
