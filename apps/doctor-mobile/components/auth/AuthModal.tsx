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

  /**
   * Handle Google OAuth Sign-in
   */
  const handleGoogleOAuth = async () => {
    try {
      setLoading(true);
      console.log("[GoogleOAuth] Starting Google OAuth...");

      const redirectUri = Linking.createURL("oauth-redirect");

      console.log("[GoogleOAuth] redirectUri being sent to Supabase:", redirectUri);
      
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

      // Open browser for authentication
      console.log("[GoogleOAuth] Opening browser for OAuth...");
      
      // On Android, WebBrowser.openAuthSessionAsync() may not return when using custom schemes
      // Use Promise.race() with a timeout so we don't wait forever
      const browserPromise = WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      const timeoutPromise = new Promise<{ type: string }>((resolve) => 
        setTimeout(() => resolve({ type: "timeout" }), 12000)
      );
      
      const result = await Promise.race([browserPromise, timeoutPromise]);
      console.log("[GoogleOAuth] Browser result:", result.type);

      if ('url' in result) {
        console.log("[GoogleOAuth] Redirect URL received:", result.url);
      } else {
        console.warn("[GoogleOAuth] No URL in result — session may not complete on Android");
      }

      // Wait a moment for Supabase to process the session
      console.log("[GoogleOAuth] Waiting for session to be established...");
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if user is now authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("[GoogleOAuth] Session error:", sessionError.message);
        throw sessionError;
      }

      if (session?.user) {
        console.log("[GoogleOAuth] ✅ Session found for user:", session.user.email);
        setLoading(false);
        // The auth state change listener will detect SIGNED_IN and close the modal
      } else {
        console.log("[GoogleOAuth] ⚠️ No session found after browser closed");
        setLoading(false);
        throw new Error("Authentication did not complete. Please try again.");
      }
    } catch (err) {
      let errorMessage = "Google sign-in failed.";
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      console.error("[GoogleOAuth] Error:", errorMessage);
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

