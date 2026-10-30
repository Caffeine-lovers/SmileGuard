import React, { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import { supabase } from "@smileguard/supabase-client";

/**
 * Deep Link Handler for OAuth Callback
 *
 * This route handles the OAuth redirect from Google/other providers.
 * It ONLY exchanges the authorization code for a session — all navigation
 * is handled by _layout.tsx's onAuthStateChange listener, which fires
 * automatically once the session is established.
 *
 * Keeping navigation out of this component avoids the cold-start race
 * condition where router.replace() fires before Expo Router's navigator
 * is internally ready on a fresh APK launch via deep link.
 *
 * URL format: smileguard://redirect?code=...&state=...
 */
export default function OAuthRedirect() {
  const searchParams = useLocalSearchParams<{ code?: string; error?: string }>();
  const [status, setStatus] = useState("Completing sign-in...");

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        console.log("[OAuthRedirect] Handler called");
        console.log("[OAuthRedirect] Search params:", searchParams);

        if (searchParams.error) {
          console.error("❌ OAuth error:", searchParams.error);
          setStatus("Sign-in failed. Please try again.");
          // _layout.tsx will redirect to / once it sees no session
          return;
        }

        // Exchange authorization code for a session (PKCE flow)
        if (searchParams.code) {
          console.log("[OAuthRedirect] Exchanging code for session...");
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(searchParams.code);
          if (exchangeError) {
            console.error("❌ Error exchanging code for session:", exchangeError);
            setStatus("Sign-in failed. Please try again.");
            return;
          }
        }

        // ✅ Session is now set — onAuthStateChange in _layout.tsx fires,
        // sets the user, and the routing useEffect handles navigation.
        // No router.replace() needed here.
        console.log("[OAuthRedirect] Code exchanged. Waiting for _layout.tsx to navigate...");
        setStatus("Signing you in...");
      } catch (error) {
        console.error("❌ Error handling OAuth callback:", error);
        setStatus("Sign-in failed. Please try again.");
      }
    };

    handleOAuthCallback();
  }, [searchParams]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 16, color: "#999" }}>
        {status}
      </Text>
    </View>
  );
}
