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
        // Give Supabase a moment to process the OAuth response
        // The session hook in _layout will automatically detect the new session
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check if user is now authenticated
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          console.log("✅ OAuth successful, user:", session.user.email);
          
          // Check if user has completed doctor profile
          const { data: doctorProfile, error: profileError } = await supabase
            .from("doctors")
            .select("id")
            .eq("user_id", session.user.id)
            .single();

          if (profileError?.code === "PGRST116") {
            // No doctor profile found - this is a NEW registration
            // Route to profile completion page to collect doctor info
            console.log("📋 New user - routing to profile completion");
            router.replace("/complete-profile");
          } else if (profileError) {
            // Other database error
            console.error("❌ Error checking profile:", profileError);
            router.replace("/");
          } else if (doctorProfile) {
            // Doctor profile exists - route to dashboard
            console.log("✅ Existing user - routing to dashboard");
            router.replace("/(doctor)/dashboard");
          } else {
            // Shouldn't happen, but fallback to dashboard
            router.replace("/(doctor)/dashboard");
          }
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
