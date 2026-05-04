import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import { supabase } from "@smileguard/supabase-client";

/**
 * Deep Link Handler for OAuth Callback
 * 
 * This route handles the OAuth redirect from Google/other providers.
 * The URL comes in as: smileguard://oauth-redirect#access_token=...&refresh_token=...
 * 
 * The root layout (_layout.tsx) will detect this deep link and extract
 * the tokens from the hash fragment, then set the session.
 * 
 * This component just shows a loading state while that happens.
 */
export default function OAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        console.log("[OAuthRedirect] Handler called");
        
        // The root layout will extract tokens from the hash and set the session.
        // Wait for the session to be established by the auth state listener.
        let attempts = 0;
        const maxAttempts = 20; // 20 * 500ms = 10 seconds max wait

        while (attempts < maxAttempts) {
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user) {
            console.log("[OAuthRedirect] ✅ Session established:", session.user.email);
            // The root layout routing logic will handle navigation, so we just wait
            // Let the auth state change listener in root layout trigger the navigation
            return;
          }

          attempts++;
          // Wait before checking again
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // If we get here, session was never established
        console.error("[OAuthRedirect] ❌ Session not established after 10 seconds");
        router.replace("/");
      } catch (error) {
        console.error("[OAuthRedirect] Error:", error);
        router.replace("/");
      }
    };

    handleOAuthCallback();
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 16, color: "#999" }}>
        Completing sign-in...
      </Text>
    </View>
  );
}
