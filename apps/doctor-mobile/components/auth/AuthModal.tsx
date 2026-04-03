import React, { useState, useMemo, Suspense, lazy } from "react";
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
} from "react-native";
import { useAuth } from "@smileguard/shared-hooks";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert } from 'react-native';
import PasswordStrengthMeter from "../ui/password-strength-meter";
import {
  FormData,
  CurrentUser,
  MedicalIntake,
  PasswordCheck,
  EMPTY_MEDICAL_INTAKE,
} from "@smileguard/shared-types";
import { supabase } from "@smileguard/supabase-client";

// ── Input sanitisation ───────────────────────────────────────────
// Strip anything that looks like SQL / script injection.
// This is a *client-side* first line of defence; real protection
// happens via Supabase parameterised queries + RLS on the backend.
const sanitize = (input: string): string =>
  input
    .replace(/[<>]/g, "") // strip angle brackets (XSS)
    .replace(/(['";\\])/g, "") // strip SQL-sensitive chars
    .replace(/--/g, "") // strip SQL comment sequences
    .trim();

export interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (user: CurrentUser) => void;
}

// ══════════════════════════════════════════════════════════════════
// STEP MAP (DOCTOR ONLY)
// 0  → Portal entry choice  (login / register)
// 1  → Credentials           (doctor login/register)
// 2  → Success screen        (register only, then enter dashboard)
// 6  → Forgot password
// 7  → Reset email sent
// ══════════════════════════════════════════════════════════════════

export default function AuthModal({
  visible,
  onClose,
  onSuccess,
}: AuthModalProps) {
  // Use the auth hook directly to access login/register functions
  const { login, register } = useAuth();

  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"register" | "login">("login");
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    service: "",
    name: "",
    email: "",
    password: "",
    medicalIntake: { ...EMPTY_MEDICAL_INTAKE },
    doctorAccessCode: "",
  });

  // Reset state when modal re-opens
  React.useEffect(() => {
    if (visible) {
      setStep(0); // Show choice screen first
      setMode("login");
      setFormData({
        service: "",
        name: "",
        email: "",
        password: "",
        medicalIntake: { ...EMPTY_MEDICAL_INTAKE },
        doctorAccessCode: "",
      });
    }
  }, [visible]);

  // ── Helpers ──────────────────────────────────────────────────────

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isValidPhone = (phone: string) => /^[\d\s\-+().]{7,20}$/.test(phone);

  // Password strength rules
  const passwordChecks: PasswordCheck[] = useMemo(() => {
    const p = formData.password;
    return [
      { label: "At least 8 characters", met: p.length >= 8 },
      { label: "One uppercase letter (A-Z)", met: /[A-Z]/.test(p) },
      { label: "One lowercase letter (a-z)", met: /[a-z]/.test(p) },
      { label: "One number (0-9)", met: /\d/.test(p) },
      { label: "One special character (!@#$…)", met: /[^A-Za-z0-9]/.test(p) },
    ];
  }, [formData.password]);

  const passwordStrong = passwordChecks.every((c) => c.met);

  const strengthPercent = useMemo(() => {
    const met = passwordChecks.filter((c) => c.met).length;
    return Math.round((met / passwordChecks.length) * 100);
  }, [passwordChecks]);

  // Shorthand to update medical intake fields
  const setIntake = (patch: Partial<MedicalIntake>) =>
    setFormData((f) => ({
      ...f,
      medicalIntake: { ...f.medicalIntake, ...patch },
    }));

  // Shorthand to update top-level fields (with sanitisation)
  const setField = (key: keyof FormData, value: string) => {
    // Don't sanitise the password – it may legitimately contain special chars
    setFormData((f) => ({
      ...f,
      [key]: key === "password" ? value : sanitize(value),
    }));
  };

  // ── Navigation ───────────────────────────────────────────────────

  const handleChoice = (selectedMode: "register" | "login") => {
    setMode(selectedMode);
    setStep(1); // Move to credentials screen
  };

  const handleNext = () => {
    setStep((s) => s + 1);
  };

  // ── Finalize ─────────────────────────────────────────────────────

  const handleFinalize = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert("Missing Info", "Please complete all required fields.");
      return;
    }

    if (!isValidEmail(formData.email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (mode === "register" && !passwordStrong) {
      Alert.alert(
        "Weak Password",
        "Your password must meet all the strength requirements listed below the field.",
      );
      return;
    }

    if (mode === "register" && !formData.name) {
      Alert.alert("Missing Info", "Please enter your full name.");
      return;
    }

    setLoading(true);
  };

  const performLogin = async () => {
    try {
      const userData: CurrentUser = await login(formData.email, formData.password, "doctor");
      onSuccess(userData);
      console.log("Login successful for user:", userData);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      Alert.alert("Login Error", message); // 👈 shows whatever useAuth threw
      setLoading(false); 
    }
  };

  const performRegister = async () => {
    try {
      await register(formData, "doctor");
      setStep(2); // success screen, then enter dashboard
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed. Please try again.";
      Alert.alert("Registration Error", message);
      setLoading(false);
    }
  };

  const enterDashboardAfterSuccess = () => {
    onSuccess({
      name: formData.name,
      email: formData.email,
      role: "doctor",
    });
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <SafeAreaView style={styles.modalFull}>
          <View style={styles.bordercard}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.stepContent}>
                {/* ════════════ Step 0: Portal Entry Choice (DOCTOR ONLY) ════════════ */}
                {step === 0 && (
                  <View style={{ alignItems: "center" }}>
                    <Text style={styles.h2}>
                      🩺 Doctor Access
                    </Text>
                    <Text style={[styles.p, { marginBottom: 40 }]}>
                      Please select an option to continue to your dashboard.
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.btn,
                        styles.choiceBtn,
                        styles.modalbtn,
                        { marginBottom: 30, width: "80%" },
                      ]}
                      onPress={() => handleChoice("login")}
                    >
                      <Text style={styles.choiceBtnText}>
                        I have an account (Login)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.btn,
                        styles.outlineChoiceBtn,
                        { width: "80%" },
                      ]}
                      onPress={() => handleChoice("register")}
                    >
                      <Text style={styles.outlineChoiceText}>
                        New to SmileGuard? (Register)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ════════════ Step 1: Credentials ════════════ */}
                {step === 1 && (
                  <View>
                    <Text style={styles.h2}>
                      {mode === "login" ? "Welcome Back" : "Create Account"}
                    </Text>
                    {/* Name (register only) */}
                    {mode === "register" && (
                      <TextInput
                        style={styles.input}
                        placeholder="Full Name"
                        value={formData.name}
                        onChangeText={(t) => setField("name", t)}
                      />
                    )}
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={formData.email}
                      onChangeText={(t) => setField("email", t)}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      secureTextEntry
                      value={formData.password}
                      onChangeText={(t) => setField("password", t)}
                    />

                    {/* Password strength meter */}
                    {mode === "register" && (
                    <>
                      {formData.password.length > 0 && (
                      <View style={styles.strengthSection}>
                        <PasswordStrengthMeter
                          strengthPercent={strengthPercent}
                        />
                        {/* Checklist */}
                        {passwordChecks.map((c) => (
                          <Text
                            key={c.label}
                            style={{
                              color: c.met ? "#22c55e" : "#9ca3af",
                              fontSize: 13,
                              marginTop: 2,
                            }}
                          >
                            {c.met ? "✓" : "○"} {c.label}
                          </Text>
                        ))}
                      </View>
                      )}
                    </>
                    )}
                    
                    {mode === "login" && (
                      <TouchableOpacity
                        style={{ alignSelf: "flex-end", marginTop: -8, marginBottom: 12 }}
                        onPress={() => setStep(6)}
                      >
                        <Text style={{ color: "#0b7fab", fontSize: 13 }}>Forgot password?</Text>
                      </TouchableOpacity>
                    )}

                    {/* =======Login button======== */}
                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn, { marginTop: 12 }]}
      
                      onPress={async () => {
                        try {
                          setLoading(true);
                          await handleFinalize();
                          
                          if (mode === "login") {
                            await performLogin();
                          } else {
                            await performRegister();
                          }
                        } catch (err) {
                          const message = err instanceof Error ? err.message : "Authentication failed. Please try again.";
                          Alert.alert(mode === "login" ? "Login Error" : "Registration Error", message);
                          console.error("Auth error:", err);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.btnText}>
                          {mode === "login" ? "Enter Portal": "Complete Registration"}
                          
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* ════════════ Step 2: Success (Register Only) ════════════ */}
                {step === 2 && (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 40, marginBottom: 10 }}>🎉</Text>
                    <Text style={styles.h2}>All Set!</Text>
                    <Text style={styles.p}>Your doctor portal is ready.</Text>
                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn]}
                      onPress={enterDashboardAfterSuccess}
                    >
                      <Text style={styles.btnText}>Enter Dashboard</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {/* ════════════ Step 6: Forgot Password ════════════ */}
                {step === 6 && (
                  <View>
                    <Text style={styles.h2}>🔐 Reset Password</Text>
                    <Text style={[styles.p, { fontSize: 14 }]}>
                      Enter your email and we'll send you a reset link.
                    </Text>

                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={formData.email}
                      onChangeText={(t) => setField("email", t)}
                    />

                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn, { marginTop: 4 }]}
                      disabled={loading}
                      onPress={async () => {
                        if (!formData.email || !isValidEmail(formData.email)) {
                          Alert.alert("Invalid Email", "Please enter a valid email address.");
                          return;
                        }
                        setLoading(true);
                        try {
                          const { error } = await supabase.auth.resetPasswordForEmail(
                            formData.email,
                            { redirectTo: "http://localhost:8081/reset-password" }
                          );
                          if (error) throw error;
                          setStep(7);
                        } catch (err) {
                          const message = err instanceof Error ? err.message : "Something went wrong.";
                          Alert.alert("Error", message);
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.btnText}>Send Reset Link</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.btn, styles.secondaryBtn, { marginTop: 10 }]}
                      onPress={() => setStep(4)}
                    >
                      <Text style={styles.secondaryBtnText}>← Back to Login</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ════════════ Step 7: Reset Email Sent ════════════ */}
                {step === 7 && (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 40, marginBottom: 10 }}>📬</Text>
                    <Text style={styles.h2}>Check your inbox</Text>
                    <Text style={[styles.p, { fontSize: 14 }]}>
                      A password reset link was sent to{"\n"}
                      <Text style={{ fontWeight: "700", color: "#0b7fab" }}>
                        {formData.email}
                      </Text>
                    </Text>
                    <Text style={[styles.subtext, { marginBottom: 24 }]}>
                      The link expires in 1 hour. Check your spam folder if you don't see it.
                    </Text>
                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn]}
                      onPress={() => setStep(4)}
                    >
                      <Text style={styles.btnText}>Back to Login</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {/* Close button */}
              {step !== 2 && (
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={async () => {
                    await onClose();
                    await setLoading(false);
                  }}
                  accessibilityLabel="Close authentication modal"
                  accessibilityRole="button"
                >
                  
                  <Text style={styles.closeBtnText}>Exit</Text>
                </TouchableOpacity>
              )}
              
            </ScrollView>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ══════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  modalFull: {
    flex: 1,
    padding: 30,
  },
  bordercard: {
    flex: 1,
    maxWidth: 540,
    alignSelf: "center",
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  stepContent: {
    marginTop: 20,
    borderColor: "#2bf1ff7d",
    borderWidth: 1,
    borderRadius: 45,
    padding: 24,
  },
  h2: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  stepIndicator: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 18,
  },
  p: {
    fontSize: 18,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 30,
  },
  subtext: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    color: "#374151",
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 10,
    color: "#0b7fab",
  },
  helperText: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 12,
    marginTop: -4,
  },
  warningText: {
    fontSize: 13,
    color: "#ef4444",
    textAlign: "center",
    marginTop: 8,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
  },
  modalbtn: {
    marginTop: 50,
  },
  primaryBtn: {
    backgroundColor: "#0b7fab",
    width: "100%",
  },
  secondaryBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  secondaryBtnText: {
    color: "#374151",
    fontWeight: "600",
  },
  choiceBtn: {
    backgroundColor: "#0b7fab",
    width: "100%",
    marginBottom: 12,
  },
  choiceBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  outlineChoiceBtn: {
    borderWidth: 2,
    borderColor: "#0b7fab",
    width: "100%",
  },
  outlineChoiceText: {
    color: "#0b7fab",
    fontWeight: "700",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#f3f4f6",
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#0b7fab",
    marginRight: 12,
  },
  radioActive: {
    backgroundColor: "#0b7fab",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  chipActive: {
    backgroundColor: "#0b7fab",
    borderColor: "#0b7fab",
  },
  chipText: {
    fontSize: 13,
    color: "#374151",
  },
  chipTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  navRow: {
    flexDirection: "row",
    marginTop: 16,
  },
  strengthSection: {
    marginBottom: 12,
  },
  closeBtn: {
    alignItems: "center",
    padding: 20,
  },
  closeBtnText: {
    fontSize: 15,
    color: "#ef4444",
    fontWeight: "bold",
    borderColor: "#ef4444",
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    overflow: "hidden",
  },
});
