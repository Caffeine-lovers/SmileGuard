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

        if (searchParams.error) {
          console.error("❌ OAuth error:", searchParams.error);
          router.replace("/");
          return;
        }

        // If code param is present (PKCE flow), exchange it for a session
        if (searchParams.code) {
          console.log("[OAuthRedirect] Exchanging code for session...");
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(searchParams.code);
          if (exchangeError) {
            console.error("❌ Error exchanging code for session:", exchangeError);
          }
        }

        // Give Supabase a moment to process/store session
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check if user is now authenticated (retry up to 3 times to allow session storage to settle)
        let session = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user) {
            session = data.session;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        console.log("[OAuthRedirect] Session after auth:", session ? "Found" : "Null");

        if (session?.user) {
          console.log("✅ OAuth successful, user:", session.user.email);
          // Check if doctor profile exists to direct to correct screen
          const { data: doc } = await supabase
            .from("doctors")
            .select("id")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (doc) {
            console.log("[OAuthRedirect] Doctor profile found, routing to /(doctor)/dashboard");
            router.replace("/(doctor)/dashboard");
          } else {
            console.log("[OAuthRedirect] No doctor profile found, routing to /setup-profile");
            router.replace("/setup-profile");
          }
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
