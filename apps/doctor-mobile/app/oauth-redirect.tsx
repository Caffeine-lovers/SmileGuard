import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { View, Text, ActivityIndicator } from "react-native";
import { supabase } from "@smileguard/supabase-client";

/**
 * OAuth Redirect Handler for React Native
 * 
 * Tokens are in the URL HASH (#), not query params (?)
 * exp://10.76.126.32:8081/--/oauth-redirect#access_token=eyJ...&refresh_token=abc...
 * 
 * React Native's useLocalSearchParams() only captures query params, not hash.
 * We must manually parse the hash fragment and call setSession().
 */
export default function OAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        // Get the full URL including hash fragment
        const url = await Linking.getInitialURL();
        console.log("[OAuthRedirect] Full URL received:", url);

        if (!url) {
          throw new Error("No URL found in OAuth redirect");
        }

        // Extract the hash fragment (everything after #)
        const hashIndex = url.indexOf("#");
        if (hashIndex === -1) {
          console.error("[OAuthRedirect] No hash fragment in URL, tokens are in query params or missing");
          console.log("[OAuthRedirect] URL structure:", url);
          throw new Error("No hash fragment found in redirect URL");
        }

        const hashPart = url.substring(hashIndex + 1);
        console.log("[OAuthRedirect] Hash fragment:", hashPart.substring(0, 50) + "...");

        // Parse the hash fragment as URLSearchParams
        const params = Object.fromEntries(new URLSearchParams(hashPart));
        console.log("[OAuthRedirect] Extracted param keys:", Object.keys(params));

        const { access_token, refresh_token } = params;

        if (!access_token) {
          console.error("[OAuthRedirect] No access_token in hash fragment");
          console.log("[OAuthRedirect] All params:", JSON.stringify(params, null, 2));
          throw new Error("Missing access_token in redirect URL");
        }

        if (!refresh_token) {
          console.warn("[OAuthRedirect] No refresh_token in hash fragment, continuing with access_token only");
        }

        // Manually set the session with tokens extracted from hash
        console.log("[OAuthRedirect] Calling supabase.auth.setSession() with extracted tokens...");
        const { data, error } = await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token || undefined,
        });

        if (error) {
          console.error("[OAuthRedirect] Supabase setSession error:", JSON.stringify(error, null, 2));
          throw error;
        }

        console.log("[OAuthRedirect] ✅ Session set successfully");
        console.log("[OAuthRedirect] User email:", data.session?.user?.email);
        console.log("[OAuthRedirect] User ID:", data.session?.user?.id);
        console.log("[OAuthRedirect] Token expires at:", data.session?.expires_at);

        // The RootLayout's onAuthStateChange listener will fire with SIGNED_IN event
        // and automatically route to dashboard
        console.log("[OAuthRedirect] Handing off to RootLayout routing logic...");

      } catch (error) {
        console.error("[OAuthRedirect] ❌ OAuth redirect failed:", error instanceof Error ? error.message : String(error));
        console.error("[OAuthRedirect] Full error:", error);
        
        // Redirect back to login on error
        setTimeout(() => {
          console.log("[OAuthRedirect] Redirecting to login due to error");
          router.replace("/");
        }, 2000);
      }
    };

    handleRedirect();
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
      <ActivityIndicator size="large" color="#0066cc" />
      <Text style={{ marginTop: 16, color: "#666", fontSize: 14 }}>
        Completing sign-in...
      </Text>
    </View>
  );
}
