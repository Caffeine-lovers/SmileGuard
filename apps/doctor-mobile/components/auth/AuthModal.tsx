import React, { useState, useMemo, Suspense, lazy, useCallback, useEffect } from "react";
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import PasswordStrengthMeter from "../ui/password-strength-meter";
import DoctorProfileSetup from "./DoctorProfileSetup";
import ClinicSetup from "../settings/ClinicSetup";
import {
  FormData,
  CurrentUser,
  MedicalIntake,
  PasswordCheck,
  EMPTY_MEDICAL_INTAKE,
} from "@smileguard/shared-types";
import { supabase } from "@smileguard/supabase-client";
import { getDoctorProfile } from "../../lib/doctorService";

// CRITICAL: For iOS, handle the auth session completion
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
// 1  → Credentials / Google OAuth (email/password login OR Google sign-up)
// 2  → Doctor Profile Setup  (bio information — register only, then dashboard)
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

  const [step, setStep] = useState(1); // Start directly at login (skip step 0)
  const [mode, setMode] = useState<"register" | "login">("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rateLimitUntil, setRateLimitUntil] = useState<Date | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    service: "General",
    name: "",
    email: "",
    password: "",
    medicalIntake: { ...EMPTY_MEDICAL_INTAKE },
    doctorAccessCode: "",
  });

  // Reset state when modal re-opens
  React.useEffect(() => {
    if (visible) {
      setStep(1); // Start directly at login form
      setMode("login");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setRememberMe(false);
      setVerificationCode("");
      setEmailSent(false);
      setConfirmPassword("");
      setRateLimitUntil(null);
      setRateLimitSeconds(0);
      setRegistrationComplete(false);
      setFormData({
        service: "General",
        name: "",
        email: "",
        password: "",
        medicalIntake: { ...EMPTY_MEDICAL_INTAKE },
        doctorAccessCode: "",
      });
    } else {
      // Dismiss keyboard when modal closes to prevent shaking on Android
      Keyboard.dismiss();
    }
  }, [visible]);

  // Listen for magic link from email
  React.useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log("[AuthModal] Deep link received:", url);
      if (url.includes('access_token') || url.includes('type=signup')) {
        handleMagicLinkCallback(url);
      }
    });

    return () => subscription.remove();
  }, []);

  // Check for magic link on mount
  React.useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log("[AuthModal] Initial URL:", url);
        if (url.includes('access_token') || url.includes('type=signup')) {
          handleMagicLinkCallback(url);
        }
      }
    });
  }, []);

  // Handle rate limit countdown timer
  React.useEffect(() => {
    if (!rateLimitUntil) {
      setRateLimitSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const secondsRemaining = Math.max(0, Math.floor((rateLimitUntil.getTime() - now.getTime()) / 1000));
      
      if (secondsRemaining <= 0) {
        setRateLimitUntil(null);
        setRateLimitSeconds(0);
        clearInterval(interval);
      } else {
        setRateLimitSeconds(secondsRemaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitUntil]);

  // Helper to format remaining time
  const formatRemainingTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  console.log("[AuthModal] Current step:", step, "Modal visible:", visible, "Current mode:", mode);

  // Send verification code to email with password validation
  const sendVerificationCode = async () => {
    if (!formData.email) {
      Alert.alert("Error", "Please enter an email");
      return;
    }

    if (!isValidEmail(formData.email)) {
      Alert.alert("Error", "Please enter a valid email");
      return;
    }

    // Only allow gmail for simplicity
    if (!formData.email.endsWith("@gmail.com")) {
      Alert.alert("Error", "Please use a Gmail account (@gmail.com)");
      return;
    }

    // Validate passwords
    if (!formData.password) {
      Alert.alert("Error", "Please enter a password");
      return;
    }

    if (!confirmPassword) {
      Alert.alert("Error", "Please confirm your password");
      return;
    }

    if (formData.password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      console.log("[AuthModal] Attempting to sign up with email...");
      
      // Try to sign up directly - this will fail if email already exists
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      console.log("[AuthModal] SignUp response:", { data, error });

      if (error) {
        const errorMsg = error.message.toLowerCase();
        
        // Check if email already exists
        if (errorMsg.includes("already registered") || errorMsg.includes("email already exists") || errorMsg.includes("user already exists")) {
          Alert.alert("Email Already Registered", "This email is already registered. Please use the Login tab instead.");
          setLoading(false);
          return;
        }
        
        // Check for rate limiting
        if (errorMsg.includes("rate limit") || errorMsg.includes("too many requests")) {
          // Set rate limit to 15 minutes from now
          const futureTime = new Date(Date.now() + 15 * 60 * 1000);
          setRateLimitUntil(futureTime);
          setRateLimitSeconds(900); // 15 minutes in seconds
          
          Alert.alert(
            "Too Many Attempts", 
            `Too many verification attempts for this email. Please try again in ${formatRemainingTime(900)}, or use a different email address.`
          );
          setLoading(false);
          return;
        }
        
        // Other errors
        throw error;
      }

      // Success - show verification code input
      console.log("[AuthModal] Sign up successful, showing verification code input");
      setEmailSent(true);
      setLoading(false);
      Alert.alert("Check Your Email", "An 8-digit verification code has been sent to your Gmail. Enter it below to continue.");
    } catch (err) {
      console.error("[AuthModal] Error:", err);
      setLoading(false);
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to send verification code");
    }
  };

  // Verify the 8-digit code and proceed to sign up
  const verifyAndProceed = async () => {
    if (!verificationCode) {
      Alert.alert("Error", "Please enter the 8-digit code");
      return;
    }

    if (verificationCode.length !== 8) {
      Alert.alert("Error", "Code must be 8 digits");
      return;
    }

    setLoading(true);
    try {
      console.log("[AuthModal] Verifying code...");
      
      // Verify with OTP
      const { error } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: verificationCode,
        type: 'signup'
      });

      if (error) throw error;

      console.log("[AuthModal] Email verified!");
      
      // Wait for session
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Ensure doctor role
        try {
          await ensureRoleSet(user.id, "doctor");
        } catch(e) {
          console.warn("Role warning:", e);
        }
        
        // Move to doctor profile setup
        setStep(2);
      } else {
        throw new Error("Failed to verify email");
      }
    } catch (err) {
      console.error("[AuthModal] Verification error:", err);
      Alert.alert("Error", err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

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

  // Validation helpers for Step 1
  const isEmailValid = formData.email.trim().length > 0 && isValidEmail(formData.email);
  const isPasswordValid = formData.password.length >= 8;
  const isConfirmPasswordValid = confirmPassword === formData.password && confirmPassword.length > 0;
  const loginEmailValid = formData.email.trim().length > 0 && isValidEmail(formData.email);
  const loginPasswordValid = formData.password.trim().length > 0;

  const getFieldBorderColor = (isValid: boolean): string => {
    return isValid ? '#4caf50' : '#ff9800';
  };

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
      console.log(" Starting doctor registration...");
      await register(formData, "doctor");
      console.log(" Registration completed, verifying role...");
      
      // Get the current user and ensure role is set to doctor
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log(" Doctor Registration: Ensuring role is set to doctor for user:", user.id);
        await ensureRoleSet(user.id, "doctor");
        console.log(" Role verification complete");
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
      
      console.error(" Registration failed:", errorMessage);
      Alert.alert("Registration Error", errorMessage);
      setLoading(false);
    }
  };

  /**
   * Handle Google OAuth Sign-in/Sign-up (deprecated - using email verification now)
   */
  const handleGoogleOAuth = async () => {
    // This function is no longer used - email verification is used instead
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
                {/* ════════════ Step 0: Portal Entry Choice (DOCTOR ONLY) ════════════ */}
                {step === 0 && (
                  <View style={{ alignItems: "center" }}>
                    <Text style={styles.h2}>
                       Doctor Access
                    </Text>
                    <Text style={[styles.p, { marginBottom: 40 }]}>
                      Please select an option to continue to your dashboard.
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.btn,
                        styles.primaryBtn,
                        { marginBottom: 30, width: "80%" },
                      ]}
                      onPress={() => handleSwitchMode("login")}
                    >
                      <Text style={styles.btnText}>
                        I have an account (Login)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.btn,
                        styles.secondaryBtn,
                        { width: "80%" },
                      ]}
                      onPress={() => handleSwitchMode("register")}
                    >
                      <Text style={styles.secondaryBtnText}>
                        New to SmileGuard? (Register)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* ════════════ Step 1: Credentials (Email/Password) ════════════ */}
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
                          style={[
                            styles.btn,
                            styles.primaryBtn,
                            {
                              marginTop: 20,
                              opacity: loginEmailValid && loginPasswordValid ? 1 : 0.5,
                            },
                          ]}
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
                          disabled={loading || !loginEmailValid || !loginPasswordValid}
                        >
                          {loading ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.btnText}>Login</Text>
                          )}
                        </TouchableOpacity>

                        {/* Switch to Register */}
                        <View style={styles.switchAuthContainer}>
                          <Text style={styles.switchAuthText}>Don't have an account? </Text>
                          <TouchableOpacity onPress={() => handleSwitchMode("register")}>
                            <Text style={styles.switchAuthLink}>Sign Up</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      /* === REGISTRATION FORM === */
                      <>
                        {!emailSent ? (
                          <>
                            <Text style={[styles.subtitle, { marginBottom: 24 }]}>
                              Enter your Gmail to create your account
                            </Text>

                            {/* Email Field */}
                            <Text style={styles.fieldLabel}>Email (Gmail)</Text>
                            <TextInput
                              style={[
                                styles.input,
                                { borderColor: getFieldBorderColor(isEmailValid) },
                              ]}
                              placeholder="your.email@gmail.com"
                              autoCapitalize="none"
                              keyboardType="email-address"
                              value={formData.email}
                              onChangeText={(t) => setField("email", t)}
                              placeholderTextColor="#9ca3af"
                            />

                            {/* Password Field */}
                            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Password</Text>
                            <View style={[
                              styles.passwordInputContainer,
                              { borderColor: getFieldBorderColor(isPasswordValid) },
                            ]}>
                              <TextInput
                                style={styles.passwordInput}
                                placeholder="Enter password (8+ characters)"
                                secureTextEntry={!showPassword}
                                value={formData.password}
                                onChangeText={(t) => setField("password", t)}
                                placeholderTextColor="#9ca3af"
                              />
                              <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowPassword(!showPassword)}
                              >
                                <Image
                                  source={require("../../assets/images/icon/view.png")}
                                  style={styles.passwordToggleIcon}
                                />
                              </TouchableOpacity>
                            </View>

                            {/* Password Strength Meter */}
                            {formData.password && (
                              <PasswordStrengthMeter strengthPercent={strengthPercent} />
                            )}

                            {/* Confirm Password Field */}
                            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Confirm Password</Text>
                            <View style={[
                              styles.passwordInputContainer,
                              { borderColor: getFieldBorderColor(isConfirmPasswordValid) },
                            ]}>
                              <TextInput
                                style={styles.passwordInput}
                                placeholder="Confirm password"
                                secureTextEntry={!showConfirmPassword}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholderTextColor="#9ca3af"
                              />
                              <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                              >
                                <Image
                                  source={require("../../assets/images/icon/view.png")}
                                  style={styles.passwordToggleIcon}
                                />
                              </TouchableOpacity>
                            </View>

                            {/* Password Match Status */}
                            {confirmPassword && (
                              <Text style={{
                                marginTop: 8,
                                marginBottom: 16,
                                fontSize: 12,
                                color: formData.password === confirmPassword ? "#10b981" : "#ef4444",
                                fontWeight: "500"
                              }}>
                                {formData.password === confirmPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                              </Text>
                            )}

                            {/* Send Code Button */}
                            <TouchableOpacity
                              style={[
                                styles.btn,
                                styles.primaryBtn,
                                {
                                  marginTop: 20,
                                  opacity: (rateLimitSeconds > 0 || !isEmailValid || !isPasswordValid || !isConfirmPasswordValid) ? 0.5 : 1,
                                },
                              ]}
                              onPress={sendVerificationCode}
                              disabled={loading || rateLimitSeconds > 0 || !isEmailValid || !isPasswordValid || !isConfirmPasswordValid}
                            >
                              {loading ? (
                                <ActivityIndicator color="#fff" />
                              ) : rateLimitSeconds > 0 ? (
                                <Text style={styles.btnText}>Try again in {formatRemainingTime(rateLimitSeconds)}</Text>
                              ) : (
                                <Text style={styles.btnText}>Send Verification Code</Text>
                              )}
                            </TouchableOpacity>

                            {/* Switch to Login */}
                            <View style={styles.switchAuthContainer}>
                              <Text style={styles.switchAuthText}>Already have an account? </Text>
                              <TouchableOpacity onPress={() => handleSwitchMode("login")}>
                                <Text style={styles.switchAuthLink}>Login</Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        ) : (
                          <>
                            <Text style={[styles.h2, { marginTop: 24, marginBottom: 8 }]}>
                              Verify Your Email
                            </Text>
                            
                            <Text style={[styles.subtitle, { marginBottom: 24 }]}>
                              Enter the 8-digit code sent to{"\n"}
                              <Text style={{ fontWeight: "700", color: "#0b7fab" }}>
                                {formData.email}
                              </Text>
                            </Text>

                            {/* Verification Code Field */}
                            <Text style={styles.fieldLabel}>Verification Code (8 digits)</Text>
                            <TextInput
                              style={styles.input}
                              placeholder="00000000"
                              keyboardType="number-pad"
                              maxLength={8}
                              value={verificationCode}
                              onChangeText={setVerificationCode}
                              placeholderTextColor="#9ca3af"
                            />

                            {/* Verify Button */}
                            <TouchableOpacity
                              style={[
                                styles.btn,
                                styles.primaryBtn,
                                {
                                  marginTop: 20,
                                  opacity: verificationCode.length === 8 ? 1 : 0.5,
                                },
                              ]}
                              onPress={verifyAndProceed}
                              disabled={loading || verificationCode.length !== 8}
                            >
                              {loading ? (
                                <ActivityIndicator color="#fff" />
                              ) : (
                                <Text style={styles.btnText}>Verify & Continue</Text>
                              )}
                            </TouchableOpacity>

                            {/* Back Button */}
                            <TouchableOpacity
                              style={[styles.btn, styles.secondaryBtn, { marginTop: 10 }]}
                              onPress={() => {
                                setEmailSent(false);
                                setVerificationCode("");
                              }}
                            >
                              <Text style={styles.secondaryBtnText}>← Use Different Email</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </>
                    )}
                  </View>
                )}

                {/* ════════════ Step 2: Doctor Profile Setup (Bio Information) ════════════ */}
                {step === 2 && (
                  <DoctorProfileSetup
                    onSuccess={(userData) => {
                      console.log("Doctor profile setup completed, moving to clinic setup");
                      // Move to clinic setup
                      setStep(3);
                    }}
                    onCancel={() => {
                      console.log("User cancelled doctor registration");
                      setStep(1); // Go back to login/register screen
                    }}
                  />
                )}

                {/* ════════════ Step 3: Clinic Setup ════════════ */}
                {step === 3 && (
                  <ClinicSetup
                    onClose={() => {
                      console.log("Clinic setup completed, proceeding to dashboard");
                      setRegistrationComplete(true);
                      onSuccess({});
                    }}
                    onSave={(clinicData) => {
                      console.log("Clinic setup saved", clinicData);
                      setRegistrationComplete(true);
                      onSuccess({});
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
                    <Text style={{ fontSize: 40, marginBottom: 10 }}></Text>
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
  secondaryBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  googleBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: "700",
    color: "#374151",
    marginRight: 8,
  },
  googleBtnText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 15,
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
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingRight: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingRight: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 15,
    color: "#0f172a",
  },
  eyeIcon: {
    padding: 8,
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
    marginTop: 15,
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
