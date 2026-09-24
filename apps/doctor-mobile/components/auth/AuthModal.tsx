import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CurrentUser } from "@smileguard/shared-types";
import { supabase } from "@smileguard/supabase-client";

// CRITICAL: For iOS, handle the auth session completion
WebBrowser.maybeCompleteAuthSession();

// Known valid fallback codes for testing / development
const VALID_DOCTOR_CODES = [
  "SMILE-DOC-2026",
  "SMILEGUARD-STAFF",
  "DOC-2024-SG",
  "DOC-ALPHA-01",
  "DOC-BETA-02",
  "DOC-DEV-001",
  "DOC-DEV-002",
  "DOC-DEV-003",
  "CLINIC-ADMIN-01",
];

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
  const [doctorAccessCode, setDoctorAccessCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  // Reset state when modal re-opens
  React.useEffect(() => {
    if (visible) {
      setStep(1);
      setCodeError(null);
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
   * Helper to verify doctor access code via Edge Function, database, or fallback
   */
  const verifyDoctorAccessCode = async (code: string): Promise<boolean> => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || trimmed.length < 4) return false;

    // 1. Try Supabase Edge Function
    try {
      const { data, error } = await supabase.functions.invoke("verify-doctor-code", {
        body: { code: trimmed },
      });
      if (!error && data?.valid) return true;
    } catch (e) {
      // fallback
    }

    // 2. Try Supabase doctor_access_codes table directly
    try {
      const { data, error } = await supabase
        .from("doctor_access_codes")
        .select("id")
        .eq("code", trimmed)
        .eq("is_active", true)
        .maybeSingle();

      if (!error && data) return true;
    } catch (e) {
      // fallback
    }

    // 3. Fallback known doctor codes
    return VALID_DOCTOR_CODES.includes(trimmed);
  };

  /**
   * Handle Google OAuth Sign-in
   */
  const handleGoogleOAuth = async () => {
    const trimmedCode = doctorAccessCode.trim().toUpperCase();
    if (!trimmedCode) {
      setCodeError("Please enter your Doctor Access Code.");
      return;
    }

    if (trimmedCode.length < 4) {
      setCodeError("Access code must be at least 4 characters.");
      return;
    }

    try {
      setLoading(true);
      setCodeError(null);

      // Verify code before proceeding to Google OAuth
      const isValid = await verifyDoctorAccessCode(trimmedCode);
      if (!isValid) {
        setLoading(false);
        setCodeError("Invalid Doctor Access Code. Please contact your clinic administrator.");
        Alert.alert(
          "Invalid Access Code",
          "The Doctor Access Code you entered is not valid. Please contact your clinic administrator."
        );
        return;
      }

      // Store valid access code in AsyncStorage for profile setup
      await AsyncStorage.setItem("@pending_doctor_access_code", trimmedCode);

      console.log("[GoogleOAuth] Starting Google OAuth...");

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

        if (params.code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
          if (exchangeError) throw exchangeError;
          console.log("[GoogleOAuth] Code exchanged successfully");
          onClose();
        } else if (params.access_token && params.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token
          });
          
          if (sessionError) throw sessionError;

          console.log("[GoogleOAuth] Session set successfully");
          // Close the modal - let the file-based routing handle directing to setup-profile or dashboard
          onClose();
        } else {
          // If no parameters in result.url, check if session already exists
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            onClose();
          } else {
            throw new Error("No tokens or auth code returned from Google");
          }
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
              <View style={styles.topBar}>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close modal">
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              {step === 1 && (
                <View style={{ alignItems: "center", width: "100%" }}>
                  <Text style={styles.appName}>SmileGuard</Text>
                  <Text style={[styles.h2, { marginTop: 16, marginBottom: 8 }]}>Doctor Portal</Text>
                  
                  <Text style={[styles.subtitle, { marginBottom: 20 }]}>
                    Enter your clinic access code, then sign in with Google to access your dashboard.
                  </Text>

                  <View style={styles.codeContainer}>
                    <Text style={styles.inputLabel}>Clinic Access Code</Text>
                    <TextInput
                      style={[styles.input, codeError ? styles.inputError : null]}
                      placeholder="e.g. DOC-2024-SG"
                      placeholderTextColor="#94A3B8"
                      value={doctorAccessCode}
                      onChangeText={(text) => {
                        setDoctorAccessCode(text);
                        if (codeError) setCodeError(null);
                      }}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!loading}
                    />
                    {codeError ? (
                      <Text style={styles.errorText}>{codeError}</Text>
                    ) : (
                      <Text style={styles.helperText}>
                        Authorized clinic code required for doctor access.
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.btn, styles.googleBtn, { marginTop: 8 }]}
                    onPress={handleGoogleOAuth}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#10B981" />
                    ) : (
                      <>
                        <Text style={styles.googleIcon}>G</Text>
                        <Text style={styles.googleBtnText}>Continue with Google</Text>
                      </>
                    )}
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
  modalFull: { flex: 1, padding: 24, backgroundColor: "#F8FAFC" },
  scrollContent: { flexGrow: 1, justifyContent: "center" },
  topBar: {
    width: "100%",
    alignItems: "flex-end",
    marginBottom: -10,
  },
  stepContent: {
    borderColor: "#CBD5E1",
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 24,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  appName: { fontSize: 28, fontWeight: "800", color: "#10B981", letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: "800", color: "#0F172A", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 20 },
  codeContainer: {
    width: "100%",
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    height: 48,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: "#F8FAFC",
    color: "#0F172A",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  inputError: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 6,
    fontWeight: "500",
  },
  helperText: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 6,
  },
  btn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 6, alignItems: "center", width: "100%" },
  googleBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    flexDirection: "row",
    justifyContent: "center",
  },
  googleIcon: { fontSize: 18, fontWeight: "700", color: "#374151", marginRight: 10 },
  googleBtnText: { color: "#1E293B", fontWeight: "700", fontSize: 15 },
  closeBtn: {
    padding: 8,
    borderRadius: 6,
  },
  closeBtnText: { fontSize: 18, color: "#64748B", fontWeight: "600" },
});

