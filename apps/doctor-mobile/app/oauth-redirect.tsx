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
        
        // Wait a bit for Supabase to process the session update
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check if user is authenticated
        const {
          data: { session },
        } = await supabase.auth.getSession();

        console.log("[OAuthRedirect] Session check:", session ? "✅ Found" : "❌ Null");

        if (session?.user) {
          console.log("✅ User authenticated:", session.user.email);
          console.log("[OAuthRedirect] User ID:", session.user.id);
          
          // Get user's role
          const userRole = session.user.user_metadata?.role;
          console.log("[OAuthRedirect] User role from metadata:", userRole);
          
          // Check if doctor profile exists
          console.log("[OAuthRedirect] Checking for doctor profile...");
          const { data: doctorProfile, error: profileError } = await supabase
            .from("doctors")
            .select("id")
            .eq("user_id", session.user.id)
            .single();

          console.log("[OAuthRedirect] Profile query - error code:", profileError?.code);

          if (profileError?.code === "PGRST116") {
            // No profile found - new user, route to profile completion
            console.log("📋 New user detected - routing to profile setup");
            router.replace("/complete-profile");
          } else if (profileError) {
            // Database error
            console.error("❌ Profile query error:", profileError);
            router.replace("/");
          } else if (doctorProfile) {
            // Profile exists - route to dashboard
            console.log("✅ Existing user - routing to dashboard");
            router.replace("/(doctor)/dashboard");
          } else {
            console.log("⚠️ Unexpected state, routing to dashboard");
            router.replace("/(doctor)/dashboard");
          }
        } else if (searchParams.error) {
          console.error("❌ OAuth error from params:", searchParams.error);
          router.replace("/");
        } else {
          console.log("⚠️ No session found, redirecting to login");
          router.replace("/");
        }
      } catch (error) {
        console.error("❌ OAuth callback error:", error);
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
