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
  Alert,
  BackHandler,
  ToastAndroid,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CurrentUser } from "@smileguard/shared-types";
import { supabase } from "@smileguard/supabase-client";

// CRITICAL: For iOS, handle the auth session completion
WebBrowser.maybeCompleteAuthSession();

export interface AuthModalProps {
  visible: boolean;
  onClose?: () => void;
  onSuccess: (user: CurrentUser) => void;
  showCloseButton?: boolean;
}

export default function AuthModal({
  visible,
  onClose,
  onSuccess,
  showCloseButton = false,
}: AuthModalProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [doctorAccessCode, setDoctorAccessCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const lastBackPressRef = React.useRef<number>(0);

  const handleBackPress = React.useCallback(() => {
    const now = Date.now();
    if (now - lastBackPressRef.current < 2000) {
      BackHandler.exitApp();
      return true;
    }
    lastBackPressRef.current = now;
    if (Platform.OS === "android") {
      ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
    } else {
      Alert.alert("Exit App", "Are you sure you want to exit SmileGuard?", [
        { text: "Cancel", style: "cancel" },
        { text: "Exit", onPress: () => BackHandler.exitApp() },
      ]);
    }
    return true;
  }, []);

  // Intercept Android hardware back button
  React.useEffect(() => {
    if (!visible) return;

    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );

    return () => backSubscription.remove();
  }, [visible, handleBackPress]);

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
        onClose?.();
      }
    });

    return () => subscription.unsubscribe();
  }, [onClose]);

  /**
   * Helper to verify doctor access code via Edge Function, database, or fallback
   */
  const verifyDoctorAccessCode = async (code: string): Promise<{ valid: boolean; role: "doctor" | "assistant" | "admin" }> => {
    const { data, error } = await supabase.rpc("verify_access_code", {
      p_code: code.trim().toUpperCase(),
      p_platform: Platform.OS,
    });

    if (error) {
      console.error("[AuthModal] Access code check failed:", error.message);
      throw new Error("We couldn't check your access code. Please check your connection and try again.");
    }

    const tier = data?.tier;
    return {
      valid: Boolean(data?.valid),
      role: tier === "admin" ? "admin" : tier === "assistant" ? "assistant" : "doctor",
    };
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
      const { valid: isValid, role } = await verifyDoctorAccessCode(trimmedCode);
      if (!isValid) {
        setLoading(false);
        setCodeError("Invalid Clinic Access Code. Please contact your clinic administrator.");
        Alert.alert(
          "Invalid Access Code",
          "The Access Code you entered is not valid. Please contact your clinic administrator."
        );
        return;
      }

      // Store valid access code and role in AsyncStorage for profile setup / dashboard routing
      await AsyncStorage.setItem("@pending_doctor_access_code", trimmedCode);
      await AsyncStorage.setItem("@pending_user_role", role);

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
          onClose?.();
        } else if (params.access_token && params.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token
          });

          if (sessionError) throw sessionError;

          console.log("[GoogleOAuth] Session set successfully");
          // Close the modal - let the file-based routing handle directing to setup-profile or dashboard
          onClose?.();
        } else {
          // If no parameters in result.url, check if session already exists
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            onClose?.();
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
    <Modal visible={visible} animationType="slide" onRequestClose={handleBackPress}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >
        <SafeAreaView style={styles.modalFull}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            <View style={styles.stepContent}>
              {showCloseButton && (
                <View style={styles.topBar}>
                  <TouchableOpacity onPress={onClose || handleBackPress} style={styles.closeBtn} accessibilityLabel="Close modal">
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
              {step === 1 && (
                <View style={{ alignItems: "center", width: "100%" }}>
                  <Text style={styles.appName}>SmileGuard</Text>
                  <Text style={[styles.h2, { marginTop: 16, marginBottom: 8 }]}>Doctor & Assistant Portal</Text>

                  <Text style={[styles.subtitle, { marginBottom: 20 }]}>
                    Enter your clinic access code, then sign in with Google to access your dashboard.
                  </Text>

                  <View style={styles.codeContainer}>
                    <Text style={styles.inputLabel}>Clinic Access Code</Text>
                    <TextInput
                      style={[styles.input, codeError ? styles.inputError : null]}
                      placeholder="e.g. SMILE-ACCESS-CODES"
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
                        An authorized clinic access code is required to sign in.
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

