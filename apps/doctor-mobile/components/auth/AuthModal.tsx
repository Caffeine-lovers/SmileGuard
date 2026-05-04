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

// CRITICAL: For iOS, handle the auth session completion
WebBrowser.maybeCompleteAuthSession();

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
  const ENABLE_DIRECT_OAUTH_REDIRECT_TEST = false;
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const buttonLabel = ENABLE_DIRECT_OAUTH_REDIRECT_TEST
    ? "Open OAuth Redirect Test"
    : loading
      ? "Signing in..."
      : "Continue with Google";

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

  /**
   * Handle Google OAuth Sign-in
   */
  const handleGoogleOAuth = async () => {
    try {
      setLoading(true);
      console.log("[GoogleOAuth] Starting Google OAuth...");

      if (ENABLE_DIRECT_OAUTH_REDIRECT_TEST) {
        console.log("[AuthModal] Navigating directly to /oauth-redirect for route test");
        onClose();
        router.push("/oauth-redirect");
        return;
      }

      const redirectUri = Linking.createURL("oauth-redirect");
      console.log("[AuthModal] Redirect URI:", redirectUri);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "consent",
          },
        },
      });

      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

      if (result.type === "success") {
        const extractParams = (urlString: string) => {
          const queryString = urlString.includes("#") ? urlString.split("#")[1] : urlString.includes("?") ? urlString.split("?")[1] : "";
          if (!queryString) return {} as Record<string, string>;
          return queryString.split("&").reduce((acc, current) => {
            const [key, value] = current.split("=");
            if (key && value) acc[key] = decodeURIComponent(value);
            return acc;
          }, {} as Record<string, string>);
        };

        const params = extractParams(result.url);

        if (params.error_description) {
          throw new Error(params.error_description);
        }

        if (params.access_token && params.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token
          });
          
          if (sessionError) throw sessionError;

          console.log("[GoogleOAuth] Session set successfully");
          // Close the modal - let the file-based routing handle directing to setup-profile or dashboard
          onClose();
        } else {
          throw new Error("No tokens returned from Google");
        }
      } else {
        setLoading(false);
      }
    } catch (err) {
      let errorMessage = "Google sign-in failed.";
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      Alert.alert("Sign-in Error", errorMessage);
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
                    <Text style={styles.googleBtnText}>{buttonLabel}</Text>
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

