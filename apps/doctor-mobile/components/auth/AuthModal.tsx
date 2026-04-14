import React, { useState, useMemo, Suspense, lazy, useCallback, useRef } from "react";
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
  Image,
  Keyboard,
} from "react-native";
import { useAuth } from "@smileguard/shared-hooks";
import { SafeAreaView } from "react-native-safe-area-context";
import { Alert } from 'react-native';
import PasswordStrengthMeter from "../ui/password-strength-meter";
import DoctorProfileSetup from "./DoctorProfileSetup";
import {
  FormData,
  CurrentUser,
  MedicalIntake,
  PasswordCheck,
  EMPTY_MEDICAL_INTAKE,
} from "@smileguard/shared-types";
import { supabase } from "@smileguard/supabase-client";
import { getDoctorProfile } from "../../lib/doctorService";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

// ── Complete OAuth session (required for Android) ────────────────
WebBrowser.maybeCompleteAuthSession();

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
// 3  → Doctor Profile Setup  (register only, password confirmation + profile details)
// 6  → Forgot password
// 7  → Reset email sent
// ══════════════════════════════════════════════════════════════════

export default function AuthModal({
  visible,
  onClose,
  onSuccess,
}: AuthModalProps) {
  // Use the auth hook directly to access login/register functions
  const { login, register, ensureRoleSet, currentUser } = useAuth();
  const isOAuthFlowRef = useRef(false); // Track if we're in OAuth flow
  const prevVisibleRef = useRef(visible); // Track previous visible state
  const recoveryAttemptRef = useRef(0); // Track recovery attempts to prevent infinite loops

  const [step, setStep] = useState(1); // Start directly at login (skip step 0)
  const stepRef = useRef(step); // Backup step in ref to prevent loss

  // Keep stepRef in sync with step state
  React.useEffect(() => {
    stepRef.current = step;
  }, [step]);
  const [mode, setMode] = useState<"register" | "login">("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    service: "General",
    name: "",
    email: "",
    password: "",
    medicalIntake: { ...EMPTY_MEDICAL_INTAKE },
    doctorAccessCode: "",
  });

  const [googleLoading, setGoogleLoading] = useState(false);
  const [isSettingUpDoctor, setIsSettingUpDoctor] = useState(false); // Survives step resets

  // When OAuth completes and useAuth finishes fetching profile, show Step 3
  React.useEffect(() => {
    if (!isOAuthFlowRef.current || !currentUser) return;
    
    console.log("🔄 OAuth complete, currentUser available:", currentUser.email);
    console.log("📝 Routing to Step 3 (Doctor Profile Setup) with pre-filled Google info");
    
    // Pre-fill with Google account info
    setFormData((f) => ({
      ...f,
      email: currentUser.email,
      name: currentUser.name || "",
    }));
    
    // Go directly to Step 3 - doctor profile setup form
    setStep(3);
    // Removed: isOAuthFlowRef.current = false; - We need this to stay true during Step 3!
  }, [isSettingUpDoctor, currentUser]);

  // Track step changes for debugging
  React.useEffect(() => {
    console.log(`📍 AuthModal step changed to: ${step}`);
    if (step === 3) {
      console.log("🚨 STEP 3 ACTIVATED - DoctorProfileSetup should render now");
    }
  }, [step]);

  // Track visible prop changes for debugging
  React.useEffect(() => {
    console.log(`👁️ AuthModal visible prop changed to: ${visible}`);
  }, [visible]);

  // Additional safeguard: if step is 1 but isSettingUpDoctor is true, fix it immediately
  React.useEffect(() => {
    if (isSettingUpDoctor && step === 1) {
      // Only attempt recovery max 3 times to prevent infinite loops
      if (recoveryAttemptRef.current < 3) {
        console.log(`🚨 RECOVERY #${recoveryAttemptRef.current + 1}: isSettingUpDoctor=true but step=1, fixing immediately`);
        recoveryAttemptRef.current += 1;
        setStep(3);
      }
    } else {
      // Reset counter when we're not in recovery state
      recoveryAttemptRef.current = 0;
    }
  }, [step, isSettingUpDoctor]);

  // Only reset state when user EXPLICITLY closes the modal
  const handleCloseModal = () => {
    console.log("🔒 Modal closed by user - resetting state");
    prevVisibleRef.current = false;
    isOAuthFlowRef.current = false;
    setStep(1);
    setMode("login");
    setFormData({
      service: "General",
      name: "",
      email: "",
      password: "",
      medicalIntake: { ...EMPTY_MEDICAL_INTAKE },
      doctorAccessCode: "",
    });
    setShowPassword(false);
    setRememberMe(false);
    Keyboard.dismiss();
    onClose();
  };

  // Protect step from being reset if OAuth flow is active
  React.useEffect(() => {
    // DO NOT run any resets if setting up doctor - this is paramount
    if (isSettingUpDoctor || isOAuthFlowRef.current) {
      console.log("🔐 OAuth/doctor setup active - SKIPPING all state resets in visible effect");
      return;
    }

    // Also skip if step is high (>= 3) - doctor setup in progress
    if (stepRef.current >= 3) {
      console.log(`🛡️ Doctor setup step ${stepRef.current} active - skipping reset`);
      return;
    }

    console.log("✅ Visible effect running - safe to proceed");
    // At this point we're safe to handle visibility changes
    const visibilityChanged = prevVisibleRef.current !== visible;
    prevVisibleRef.current = visible;

    if (!visible && visibilityChanged) {
      console.log("📭 Modal hidden");
      Keyboard.dismiss();
    }
  }, [visible, isSettingUpDoctor]); // Added isSettingUpDoctor as dependency

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

  const handleSwitchMode = (selectedMode: "register" | "login") => {
    setMode(selectedMode);
    setShowPassword(false);
    setRememberMe(false);
    setFormData({
      service: "General",
      name: "",
      email: "",
      password: "",
      medicalIntake: { ...EMPTY_MEDICAL_INTAKE },
      doctorAccessCode: "",
    });
  };

  // ── Google OAuth Handler ──────────────────────────────────────────

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      console.log("🔐 Starting Google OAuth...");

      // We use the root URL so Expo Router doesn't navigate away and unmount us!
      const redirectUrl = Linking.createURL("");
      console.log("\n");
      console.log("════════════════════════════════════════════════════════════════");
      console.log("⚠️  SUPABASE CONFIGURATION REQUIRED");
      console.log("════════════════════════════════════════════════════════════════");
      console.log("Go to: Supabase Dashboard → Authentication → URL Configuration");
      console.log("");
      console.log("Add this to 'Redirect URLs':");
      console.log(redirectUrl);
      console.log("");
      console.log("════════════════════════════════════════════════════════════════");
      console.log("\n");

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: { prompt: "select_account" },
        },
      });

      if (error) {
        console.error("❌ OAuth error from Supabase:", error);
        throw error;
      }

      if (data?.url) {
        console.log("📱 Opening OAuth browser...");
        
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        console.log("🔄 Browser result type:", result.type);

        if (result.type === "success") {
          console.log("✅ Browser returned with URL:", result.url);

          // Extract tokens from the callback URL
          const url = result.url;
          const hashIndex = url.indexOf("#");
          
          if (hashIndex !== -1) {
            const fragment = url.substring(hashIndex + 1);
            const params = new URLSearchParams(fragment);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");

            console.log("🔑 Tokens found - Access:", !!accessToken, "Refresh:", !!refreshToken);

            if (accessToken && refreshToken) {
              console.log("⏳ Setting session with extracted tokens (fire and forget)...");
              try {
                // Fire and forget - don't await this to avoid blocking the UI
                // The onAuthStateChange listener will pick up the new session in the background
                supabase.auth.setSession({ 
                  access_token: accessToken, 
                  refresh_token: refreshToken 
                }).catch((err) => {
                  console.error("⚠️ Background setSession error (non-blocking):", err);
                });

                // Immediately mark OAuth flow - don't wait for session
                isOAuthFlowRef.current = true;
                setIsSettingUpDoctor(true);
                setGoogleLoading(false);
                console.log("✅ OAuth flow marked, session setting in background...");
              } catch (sessionErr) {
                console.error("❌ Failed during OAuth processing:", sessionErr);
                Alert.alert("Error", "Failed to process Google sign-in. Please try again.");
                setGoogleLoading(false);
              }
            }
          }
        } else if (result.type === "cancel" || result.type === "dismiss") {
          console.log("❌ User cancelled OAuth");
          Alert.alert("Cancelled", "Google sign-in was cancelled.");
        }
      }
    } catch (error) {
      console.error("❌ OAuth error:", error);
      Alert.alert("Sign-In Error", error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
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
      let errorMessage = "Login failed. Please try again.";
      
      if (err instanceof Error) {
        const message = err.message.toLowerCase();
        
        // Handle specific Supabase error messages
        if (message.includes("invalid login credentials")) {
          errorMessage = "Invalid email or password. Please check your credentials and try again.";
        } else if (message.includes("user not found") || message.includes("does not exist")) {
          errorMessage = "No account found with this email. Please check or register.";
        } else if (message.includes("invalid email")) {
          errorMessage = "Please enter a valid email address.";
        } else if (message.includes("password")) {
          errorMessage = "Wrong password. Please try again.";
        } else {
          errorMessage = err.message;
        }
      }
      
      Alert.alert("Login Error", errorMessage);
      setLoading(false); 
    }
  };

  const performRegister = async () => {
    try {
      console.log("📝 Starting doctor registration...");
      await register(formData, "doctor");
      console.log("✅ Registration completed, verifying role...");
      
      // Get the current user and ensure role is set to doctor
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log("🔐 Doctor Registration: Ensuring role is set to doctor for user:", user.id);
        await ensureRoleSet(user.id, "doctor");
        console.log("✅ Role verification complete");
      }
      
      setStep(2); // success screen, then enter dashboard
    } catch (err) {
      let errorMessage = "Registration failed. Please try again.";
      
      if (err instanceof Error) {
        const errorText = err.message.toLowerCase();
        
        // Handle specific error messages
        if (errorText.includes("email")) {
          errorMessage = "This email is already registered or invalid. Please use another email.";
        } else if (errorText.includes("password")) {
          errorMessage = "Password error. Please ensure it meets all requirements.";
        } else if (errorText.includes("database")) {
          errorMessage = "Database error. Please check your information and try again.";
        } else if (errorText.includes("name is required")) {
          errorMessage = "Please enter your full name.";
        } else if (errorText.includes("required")) {
          errorMessage = `Required field missing: ${err.message}`;
        } else {
          errorMessage = err.message;
        }
      }
      
      console.error("❌ Registration failed:", errorMessage);
      Alert.alert("Registration Error", errorMessage);
      setLoading(false);
    }
  };

  const enterDashboardAfterSuccess = () => {
    console.log("📞 enterDashboardAfterSuccess called");
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <SafeAreaView style={styles.modalFull}>
          <View style={styles.bordercard}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.stepContent}>
                {/* ════════════ Step 1: Login/Registration Form ════════════ */}
                {step === 1 && (
                  <View>
                    {/* App Logo/Name */}
                    <View style={styles.logoSection}>
                      <Text style={styles.appName}>SmileGuard</Text>
                    </View>

                    {/* Heading */}
                    <Text style={[styles.h2, { marginTop: 24, marginBottom: 8 }]}>
                      {mode === "login" ? "Welcome Back!" : "Create Account"}
                    </Text>
                    
                    {/* Subheading */}
                    <Text style={[styles.subtitle, { marginBottom: 24 }]}>
                      {mode === "login" 
                        ? "Ready to manage your patients? Log in now!" 
                        : "Join SmileGuard and start your registration"}
                    </Text>

                    {/* === LOGIN FORM === */}
                    {mode === "login" ? (
                      <>
                        {/* Email Field */}
                        <Text style={styles.fieldLabel}>Email</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter your email"
                          autoCapitalize="none"
                          keyboardType="email-address"
                          value={formData.email}
                          onChangeText={(t) => setField("email", t)}
                          placeholderTextColor="#9ca3af"
                        />

                        {/* Password Field */}
                        <Text style={styles.fieldLabel}>Password</Text>
                        <View style={styles.passwordContainer}>
                          <TextInput
                            style={styles.passwordInput}
                            placeholder="Enter your password"
                            secureTextEntry={!showPassword}
                            value={formData.password}
                            onChangeText={(t) => setField("password", t)}
                            placeholderTextColor="#9ca3af"
                          />
                          <TouchableOpacity
                            style={styles.passwordToggle}
                            onPress={() => setShowPassword(!showPassword)}
                            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                            accessibilityRole="button"
                          >
                            <Image
                              source={require("../../assets/images/icon/view.png")}
                              style={styles.passwordToggleIcon}
                            />
                          </TouchableOpacity>
                        </View>

                        {/* Remember me & Forgot Password */}
                        <View style={styles.rememberRow}>
                          <TouchableOpacity
                            style={styles.checkboxContainer}
                            onPress={() => setRememberMe(!rememberMe)}
                            activeOpacity={0.7}
                          >
                            <View
                              style={[
                                styles.customCheckbox,
                                rememberMe && styles.customCheckboxChecked,
                              ]}
                            >
                              {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                            </View>
                            <Text style={styles.rememberText}>Remember me</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setStep(6)}>
                            <Text style={styles.forgotPasswordLink}>Forgot password?</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Login Button */}
                        <TouchableOpacity
                          style={[styles.btn, styles.primaryBtn, { marginTop: 20 }]}
                          onPress={async () => {
                            try {
                              setLoading(true);
                              await handleFinalize();
                              await performLogin();
                            } catch (err) {
                              const message = err instanceof Error ? err.message : "Login failed. Please try again.";
                              Alert.alert("Login Error", message);
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
                            <Text style={styles.btnText}>Login</Text>
                          )}
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.dividerContainer}>
                          <View style={styles.divider} />
                          <Text style={styles.dividerText}>Or</Text>
                          <View style={styles.divider} />
                        </View>

                        {/* Switch to Register */}
                        <View style={styles.switchAuthContainer}>
                          <Text style={styles.switchAuthText}>Don't have an account? </Text>
                          <TouchableOpacity onPress={() => handleSwitchMode("register")}>
                            <Text style={styles.switchAuthLink}>Sign Up</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      /* === REGISTRATION FORM - GOOGLE OAUTH ONLY === */
                      <>
                        <Text style={[styles.subtitle, { marginBottom: 24 }]}>
                          Sign up securely with Google to create your doctor account.
                        </Text>

                        {/* Google Sign-In Button */}
                        <TouchableOpacity
                          style={[styles.btn, styles.googleBtn, { marginTop: 12 }]}
                          onPress={handleGoogleSignIn}
                          disabled={googleLoading}
                        >
                          {googleLoading ? (
                            <ActivityIndicator color="#6b7280" />
                          ) : (
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                              <Image
                                source={require("../../assets/images/icon/google.png")}
                                style={{ width: 20, height: 20, marginRight: 10 }}
                              />
                              <Text style={[styles.btnText, { color: "#374151" }]}>Sign Up with Google</Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        {/* Divider */}
                        <View style={styles.dividerContainer}>
                          <View style={styles.divider} />
                          <Text style={styles.dividerText}>Or</Text>
                          <View style={styles.divider} />
                        </View>

                        {/* Switch to Login */}
                        <View style={styles.switchAuthContainer}>
                          <Text style={styles.switchAuthText}>Already have an account? </Text>
                          <TouchableOpacity onPress={() => handleSwitchMode("login")}>
                            <Text style={styles.switchAuthLink}>Login</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
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

                {/* ════════════ Step 3: Doctor Registration Form ════════════ */}
                {step === 3 && (
                  <DoctorProfileSetup
                    isOAuth={isOAuthFlowRef.current}
                    preFilledEmail={formData.email}
                    preFilledName={formData.name}
                    oauthUserId={currentUser?.id || null}
                    onSuccess={(userData) => {
                      console.log("✅ Doctor registration completed successfully");
                      console.log("📞 DoctorProfileSetup calling onSuccess with:", userData.email);
                      isOAuthFlowRef.current = false; // OAuth flow complete
                      setIsSettingUpDoctor(false);
                      setStep(2); // Move to success screen
                      // Then call the app's onSuccess to enter dashboard
                      onSuccess(userData);
                    }}
                    onCancel={() => {
                      console.log("❌ User cancelled doctor registration");
                      isOAuthFlowRef.current = false; // OAuth flow cancelled
                      setIsSettingUpDoctor(false);
                      setStep(1); // Go back to login/registration choice
                    }}
                  />
                )}
                
                {/* Show DoctorProfileSetup even if step somehow resets but isSettingUpDoctor is true */}
                {isSettingUpDoctor && step !== 3 && (
                  <DoctorProfileSetup
                    isOAuth={isOAuthFlowRef.current}
                    preFilledEmail={formData.email}
                    preFilledName={formData.name}
                    oauthUserId={currentUser?.id || null}
                    onSuccess={(userData) => {
                      console.log("✅ Doctor registration completed successfully (fallback render)");
                      isOAuthFlowRef.current = false;
                      setIsSettingUpDoctor(false);
                      setStep(2);
                      onSuccess(userData);
                    }}
                    onCancel={() => {
                      console.log("❌ User cancelled doctor registration (fallback render)");
                      isOAuthFlowRef.current = false;
                      setIsSettingUpDoctor(false);
                      setStep(1);
                    }}
                  />
                )}
                {/* ════════════ Step 6: Forgot Password ════════════ */}
                {step === 6 && (
                  <View>
                    <Text style={[styles.h2, { marginTop: 24, marginBottom: 8 }]}>🔐 Reset Password</Text>
                    <Text style={[styles.subtitle, { marginBottom: 24 }]}>
                      Enter your email and we'll send you a reset link.
                    </Text>

                    <Text style={styles.fieldLabel}>Email</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={formData.email}
                      onChangeText={(t) => setField("email", t)}
                      placeholderTextColor="#9ca3af"
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
                      onPress={() => setStep(1)}
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
                      onPress={() => setStep(1)}
                    >
                      <Text style={styles.btnText}>Back to Login</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
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
  logoSection: {
    alignItems: "center",
    marginBottom: 8,
  },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0b7fab",
  },
  h2: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    color: "#374151",
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
  primaryBtn: {
    backgroundColor: "#0b7fab",
    width: "100%",
  },
  googleBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
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
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  input: {
    backgroundColor: "#f3f4f6",
    padding: 14,
    borderRadius: 10,
    marginBottom: 14,
    fontSize: 15,
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 15,
    color: "#0f172a",
  },
  passwordToggle: {
    padding: 8,
  },
  passwordToggleText: {
    fontSize: 18,
  },
  passwordToggleIcon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },
  rememberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  customCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#d1d5db",
    backgroundColor: "transparent",
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  customCheckboxChecked: {
    backgroundColor: "#0b7fab",
    borderColor: "#0b7fab",
  },
  checkmark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  rememberText: {
    fontSize: 13,
    color: "#374151",
    marginLeft: 8,
    fontWeight: "500",
  },
  forgotPasswordLink: {
    fontSize: 13,
    color: "#0b7fab",
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#e5e7eb",
  },
  dividerText: {
    fontSize: 13,
    color: "#9ca3af",
    marginHorizontal: 12,
    fontWeight: "500",
  },
  switchAuthContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 8,
  },
  switchAuthText: {
    fontSize: 13,
    color: "#6b7280",
  },
  switchAuthLink: {
    fontSize: 13,
    color: "#0b7fab",
    fontWeight: "700",
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
