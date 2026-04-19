import React, { useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import { supabase } from "@smileguard/supabase-client";

/**
 * Deep Link Handler for OAuth Callback
 * 
 * This route handles the OAuth redirect from Google/other providers.
 * Expo and Supabase redirect back here after the user authenticates.
 * 
 * URL format: smileguard://redirect?code=...&state=...
 * 
 * The deep link handler receives the authorization code, 
 * Supabase's session handler extracts it, and we check for the session.
 */
export default function OAuthRedirect() {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ code?: string; error?: string }>();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        console.log("[OAuthRedirect] Handler called");
        console.log("[OAuthRedirect] Search params:", searchParams);
        
        // Give Supabase a moment to process the OAuth response
        // The session hook in _layout will automatically detect the new session
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check if user is now authenticated
        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log("[OAuthRedirect] Session after auth:", session ? "Found" : "Null");
        console.log("[OAuthRedirect] Session user email:", session?.user?.email);
        console.log("[OAuthRedirect] Session user ID:", session?.user?.id);

        if (session?.user) {
          console.log("✅ OAuth successful, user:", session.user.email);
          console.log("[OAuthRedirect] User metadata:", session.user.user_metadata);
          
          // Let the root layout handle the redirection
          // We just need to give the system a second to process the auth state
          console.log("[OAuthRedirect] Handing off to _layout...");
          // We won't replace routes here, to avoid conflicting with _layout routing
        } else if (searchParams.error) {
          // OAuth error occurred
          console.error("❌ OAuth error:", searchParams.error);
          router.replace("/");
        } else {
          // No session yet, redirect back to login
          console.log("⚠️ No session after redirect");
          router.replace("/");
        }
      } catch (error) {
        console.error("❌ Error handling OAuth callback:", error);
        router.replace("/");
      }
    };

    handleOAuthCallback();
  }, [router, searchParams]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 16, color: "#999" }}>
        Completing sign-in...
      </Text>
    </View>
  );
}
