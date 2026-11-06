import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { supabase } from "@smileguard/supabase-client";

/**
 * Deep Link Handler for OAuth Callback
 *
 * This route handles the OAuth redirect from Google/other providers.
 * It exchanges the authorization code for a session. Navigation is primarily
 * handled by _layout.tsx's onAuthStateChange listener, with a safety fallback
 * timer here to ensure the user is never left stuck on "Signing you in...".
 *
 * URL format: smileguard://redirect?code=...&state=...
 */
export default function OAuthRedirect() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ code?: string; error?: string }>();
  const [status, setStatus] = useState("Completing sign-in...");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let fallbackTimer: NodeJS.Timeout | null = null;
    let errorTimer: NodeJS.Timeout | null = null;

    const handleOAuthCallback = async () => {
      try {
        console.log("[OAuthRedirect] Handler called");
        console.log("[OAuthRedirect] Search params:", searchParams);

        if (searchParams.error) {
          console.error("❌ OAuth error:", searchParams.error);
          setStatus("Sign-in failed. Please try again.");
          setHasError(true);
          errorTimer = setTimeout(() => router.replace("/"), 2500);
          return;
        }

        // Exchange authorization code for a session (PKCE flow)
        if (searchParams.code) {
          console.log("[OAuthRedirect] Exchanging code for session...");
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(searchParams.code);
          if (exchangeError) {
            console.error("❌ Error exchanging code for session:", exchangeError);
            setStatus("Sign-in failed. Please try again.");
            setHasError(true);
            errorTimer = setTimeout(() => router.replace("/"), 2500);
            return;
          }
        }

        console.log("[OAuthRedirect] Code exchanged. Waiting for _layout.tsx to navigate...");
        setStatus("Signing you in...");

        // Safety fallback: if _layout.tsx hasn't navigated after 2s, check session and route directly
        fallbackTimer = setTimeout(async () => {
          try {
            console.log("[OAuthRedirect] Fallback routing check triggered");
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              const { data: doc } = await supabase
                .from("doctors")
                .select("id")
                .eq("user_id", session.user.id)
                .maybeSingle();

              if (doc) {
                console.log("[OAuthRedirect] Fallback routing to dashboard");
                router.replace("/(doctor)/dashboard");
              } else {
                console.log("[OAuthRedirect] Fallback routing to setup-profile");
                router.replace("/setup-profile");
              }
            } else {
              console.log("[OAuthRedirect] Fallback: no session found, routing to /");
              router.replace("/");
            }
          } catch (err) {
            console.error("[OAuthRedirect] Fallback navigation error:", err);
            router.replace("/");
          }
        }, 2000);
      } catch (error) {
        console.error("❌ Error handling OAuth callback:", error);
        setStatus("Sign-in failed. Please try again.");
        setHasError(true);
        errorTimer = setTimeout(() => router.replace("/"), 2500);
      }
    };

    handleOAuthCallback();

    return () => {
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
