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
  const searchParams = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();

  useEffect(() => {
    let isMounted = true;

    const handleOAuthCallback = async () => {
      try {
        console.log("[OAuthRedirect] Handler called with searchParams:", searchParams);

        if (searchParams.error || searchParams.error_description) {
          const errorMsg = searchParams.error_description || searchParams.error;
          console.error("❌ OAuth error in redirect:", errorMsg);
          if (isMounted) router.replace("/");
          return;
        }

        // If code is present in searchParams, exchange it for a session
        if (searchParams.code) {
          console.log("[OAuthRedirect] Exchanging PKCE code for session...");
          const { data, error } = await supabase.auth.exchangeCodeForSession(searchParams.code);
          if (error) {
            console.error("[OAuthRedirect] Error exchanging code:", error.message);
          } else {
            console.log("✅ [OAuthRedirect] Session established for:", data.user?.email);
          }
        }

        // Give the auth state listener in _layout time to detect the session
        await new Promise((resolve) => setTimeout(resolve, 800));

        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log("[OAuthRedirect] Session after auth check:", session ? "Found" : "Null");

        if (session?.user) {
          console.log("✅ [OAuthRedirect] Auth successful, handing off routing to root _layout");
        } else if (isMounted) {
          console.log("⚠️ [OAuthRedirect] No session found after wait, redirecting to /");
          router.replace("/");
        }
      } catch (error) {
        console.error("❌ Error handling OAuth callback:", error);
        if (isMounted) router.replace("/");
      }
    };

    handleOAuthCallback();

    return () => {
      isMounted = false;
    };
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
