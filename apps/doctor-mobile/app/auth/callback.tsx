import React, { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@smileguard/supabase-client";

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string; state?: string }>();

  useEffect(() => {
    const completeOAuth = async () => {
      try {
        const code = typeof params.code === "string" ? params.code : undefined;
        const state = typeof params.state === "string" ? params.state : undefined;
        const error = typeof params.error === "string" ? params.error : undefined;

        if (error) {
          console.error("[AuthCallback] OAuth provider returned an error:", error, params.error_description);
          router.replace("/");
          return;
        }

        if (!code) {
          console.error("[AuthCallback] Missing code in redirect URL");
          router.replace("/");
          return;
        }

        const callbackUrl = new URL("myapp://auth/callback");
        callbackUrl.searchParams.set("code", code);
        if (state) {
          callbackUrl.searchParams.set("state", state);
        }

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(callbackUrl.toString());
        if (exchangeError) {
          throw exchangeError;
        }

        router.replace("/");
      } catch (exchangeErr) {
        console.error("[AuthCallback] Failed to exchange OAuth code:", exchangeErr);
        router.replace("/");
      }
    };

    completeOAuth();
  }, [params, router]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 16, color: "#999" }}>Completing sign-in...</Text>
    </View>
  );
}
