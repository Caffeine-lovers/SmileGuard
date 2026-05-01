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
import { makeRedirectUri } from 'expo-auth-session';
import Constants from "expo-constants";

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
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(result.url);
      if (exchangeError) throw exchangeError;
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

