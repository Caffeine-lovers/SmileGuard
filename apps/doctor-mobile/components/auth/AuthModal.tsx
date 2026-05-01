import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useRouter } from "expo-router";
import { CurrentUser } from "@smileguard/shared-types";
import { supabase } from "@smileguard/supabase-client";
import { makeRedirectUri } from 'expo-auth-session';


// CRITICAL: For iOS, handle the auth session completion
export interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (user: CurrentUser) => void;
}

export default function AuthModal({
  visible,
  onClose,
  onSuccess,
}: AuthModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Reset state when modal re-opens
  React.useEffect(() => {
    if (visible) {
      setStep(1); 
    } else {
      Keyboard.dismiss();
    }
  }, [visible]);

  // Listen for OAuth auth state changes (SIGNED_IN after deep link redirect)
  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AuthModal] Auth state changed:", event);
      if (event === "SIGNED_IN" && session?.user) {
        console.log("[AuthModal] SIGNED_IN detected for", session.user.email);
        setLoading(false);
        // Important: Close modal automatically when sign-in completes via deep link
        onClose();
      }
    });

    return () => subscription.unsubscribe();
  }, [onClose]);
  const extractAuthParams = (url: string) => {
    const params = new URLSearchParams();
    const queryIndex = url.indexOf("?");
    const hashIndex = url.indexOf("#");

    if (queryIndex >= 0) {
      const query = url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined);
      const queryParams = new URLSearchParams(query);
      queryParams.forEach((value, key) => params.set(key, value));
    }

    if (hashIndex >= 0) {
      const hash = url.slice(hashIndex + 1);
      const hashParams = new URLSearchParams(hash);
      hashParams.forEach((value, key) => params.set(key, value));
    }

    return {
      code: params.get("code"),
      accessToken: params.get("access_token"),
      refreshToken: params.get("refresh_token"),
    };
  };

  const completeOAuthFromUrl = async (url: string) => {
    const { code, accessToken, refreshToken } = extractAuthParams(url);

    console.log("[GoogleOAuth] Callback params:", {
      hasCode: !!code,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
    });

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return;
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(url);
      if (error) throw error;
      return;
    }

    throw new Error("OAuth callback did not include a code or tokens.");
  };

  const routeAfterAuth = async (userId: string) => {
    const { data, error } = await supabase
      .from("doctors")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (error?.code === "PGRST116" || !data) {
      console.log("[GoogleOAuth] No doctor profile; routing to setup");
      router.replace("/setup-profile");
      return;
    }

    console.log("[GoogleOAuth] Doctor profile found; routing to dashboard");
    router.replace("/(doctor)/dashboard");
  };
  /**
   * Handle Google OAuth Sign-in
   */
  const handleGoogleOAuth = async () => {
    try {
      setLoading(true);
      console.log("[GoogleOAuth] Starting Google OAuth...");

    const redirectUri = makeRedirectUri({
      scheme: 'smileguard',
      path: 'oauth-redirect',
    });
    console.log("[GoogleOAuth] Redirect URI:", redirectUri);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true, // required when using openAuthSessionAsync
        queryParams: {
          prompt: "consent",
        },
      },
    });

    if (error) throw error;
    if (!data.url) throw new Error("No OAuth URL returned");

    console.log("[GoogleOAuth] Opening browser...");
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    console.log("[GoogleOAuth] Browser result:", result.type);

    if (result.type === 'success' && result.url) {
      await completeOAuthFromUrl(result.url);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      console.log("[GoogleOAuth] Session present after callback:", !!session?.user);

      if (!session?.user) {
        throw new Error("OAuth callback completed, but no session was established.");
      }

      onSuccess({
        id: session.user.id,
        email: session.user.email ?? "",
        name: session.user.user_metadata?.name,
        role: session.user.user_metadata?.role,
      });

      await routeAfterAuth(session.user.id);
      onClose(); // close immediately, RootLayout routing handles the rest
    } else if (result.type === 'cancel' || result.type === 'dismiss') {
      throw new Error("Sign-in was cancelled.");
    }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Google sign-in failed.";
    console.error("[GoogleOAuth] Error:", errorMessage);
    Alert.alert("Sign-in Error", errorMessage);
  } finally {
    setLoading(false);
  }
};

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SafeAreaView style={styles.modalFull}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            <View style={styles.stepContent}>
              {step === 1 && (
                <View style={{ alignItems: "center" }}>
                  <Text style={styles.appName}>SmileGuard</Text>
                  <Text style={[styles.h2, { marginTop: 24, marginBottom: 8 }]}>Welcome!</Text>
                  
                  <Text style={[styles.subtitle, { marginBottom: 24 }]}>
                    Continue with Google to manage your patients.
                  </Text>

                  <TouchableOpacity
                    style={[styles.btn, styles.googleBtn]}
                    onPress={handleGoogleOAuth}
                    disabled={loading}
                  >
                    <Text style={styles.googleIcon}>G</Text>
                    <Text style={styles.googleBtnText}>
                      {loading ? "Signing in..." : "Continue with Google"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalFull: { flex: 1, padding: 30 },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
  stepContent: {
    marginTop: 20,
    borderColor: "#2bf1ff7d",
    borderWidth: 1,
    borderRadius: 45,
    padding: 24,
    backgroundColor: "#fff",
  },
  appName: { fontSize: 28, fontWeight: "700", color: "#0b7fab" },
  h2: { fontSize: 24, fontWeight: "800", color: "#0f172a", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  btn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 10, alignItems: "center", width: "100%" },
  googleBtn: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1d5db", flexDirection: "row", justifyContent: "center" },
  googleIcon: { fontSize: 18, fontWeight: "700", color: "#374151", marginRight: 8 },
  googleBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 20, color: "#6b7280" },
});

