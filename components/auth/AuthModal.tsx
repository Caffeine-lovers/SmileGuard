import React, { useState, useMemo } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Alert from "@blazejkustra/react-native-alert";
import {
  FormData,
  CurrentUser,
  MedicalIntake,
  PasswordCheck,
  EMPTY_MEDICAL_INTAKE,
} from "../../types";

// ── Security constants ────────────────────────────────────────────
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

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
  role: "patient" | "doctor";
  onClose: () => void;
  onSuccess: (user: CurrentUser) => void;
  onLogin: (
    email: string,
    password: string,
    role: "patient" | "doctor"
  ) => Promise<CurrentUser>;
  onRegister: (
    formData: FormData,
    role: "patient" | "doctor"
  ) => Promise<CurrentUser>;
}

// ══════════════════════════════════════════════════════════════════
// STEP MAP
// 0  → Portal entry choice  (login / register)
// 1  → Service intake        (patient register only)
// 2  → Biography intake      (patient register only)
// 3  → Medical history       (patient register only)
// 4  → Credentials           (everyone)
// 5  → Success screen        (register only)
// ══════════════════════════════════════════════════════════════════

export default function AuthModal({
  visible,
  role,
  onClose,
  onSuccess,
  onLogin,
  onRegister,
}: AuthModalProps) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [loading, setLoading] = useState(false);

  // Brute-force protection state
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

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
      setStep(0);
      setMode("register");
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

  const isValidPhone = (phone: string) =>
    /^[\d\s\-+().]{7,20}$/.test(phone);

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

  const strengthColor =
    strengthPercent <= 40 ? "#ef4444" : strengthPercent <= 70 ? "#f59e0b" : "#22c55e";

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
    if (selectedMode === "login") {
      // Both roles → credentials
      setStep(4);
    } else if (role === "doctor") {
      // Doctor register → credentials (no intake)
      setStep(4);
    } else {
      // Patient register → service intake
      setStep(1);
    }
  };

  const handleNext = () => {
    // Validate current step before advancing
    if (step === 1 && !formData.service) {
      Alert.alert("Service Required", "Please select a dental service before continuing.");
      return;
    }

    if (step === 2) {
      const { dateOfBirth, gender, phone, emergencyContactName, emergencyContactPhone } =
        formData.medicalIntake;
      if (!dateOfBirth || !gender || !phone) {
        Alert.alert("Missing Info", "Please fill out Date of Birth, Gender, and Phone.");
        return;
      }
      if (!isValidPhone(phone)) {
        Alert.alert("Invalid Phone", "Please enter a valid phone number.");
        return;
      }
      if (!emergencyContactName || !emergencyContactPhone) {
        Alert.alert("Emergency Contact", "An emergency contact is required for patient safety.");
        return;
      }
    }

    // Step 3 (medical history) — we allow "None" answers, so no strict validation
    setStep((s) => s + 1);
  };

  // ── Finalize ─────────────────────────────────────────────────────

  const handleFinalize = async () => {
    // Check lockout
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const mins = Math.ceil((lockoutUntil - Date.now()) / 60000);
      Alert.alert(
        "Account Locked",
        `Too many failed attempts. Please try again in ${mins} minute(s).`
      );
      return;
    }

    if (!formData.email || !formData.password) {
      Alert.alert("Missing Info", "Please complete all required fields.");
      return;
    }

    if (!isValidEmail(formData.email)) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (!passwordStrong) {
      Alert.alert(
        "Weak Password",
        "Your password must meet all the strength requirements listed below the field."
      );
      return;
    }

    if (mode === "register" && !formData.name) {
      Alert.alert("Missing Info", "Please enter your full name.");
      return;
    }

    // ── Doctor access code gate ────────────────────────────────────
    if (role === "doctor") {
      if (!formData.doctorAccessCode) {
        Alert.alert(
          "Access Code Required",
          "Doctors must provide a valid clinic access code to continue."
        );
        return;
      }
      // In production this should be verified server-side via a
      // Supabase Edge Function so the code never lives in the client.
      // For now we do a simple client check as a placeholder.
      // TODO: Replace with server-side verification endpoint
      const VALID_DOCTOR_CODES = ["SMILE-DOC-2026", "SMILEGUARD-STAFF"];
      if (!VALID_DOCTOR_CODES.includes(formData.doctorAccessCode.toUpperCase())) {
        Alert.alert(
          "Invalid Access Code",
          "The clinic access code you entered is not valid. Please contact your administrator."
        );
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "login") {
        await performLogin();
        // Reset attempts on successful login
        setLoginAttempts(0);
        setLockoutUntil(null);
      } else {
        await performRegister();
      }
    } catch (error: any) {
      if (mode === "login") {
        const next = loginAttempts + 1;
        setLoginAttempts(next);
        if (next >= MAX_LOGIN_ATTEMPTS) {
          setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
          Alert.alert(
            "Too Many Attempts",
            "Your account has been temporarily locked for 5 minutes."
          );
          return;
        }
        Alert.alert(
          "Login Failed",
          `${error.message} (${MAX_LOGIN_ATTEMPTS - next} attempt(s) remaining)`
        );
      } else {
        Alert.alert("Error", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const performLogin = async () => {
    const userData = await onLogin(formData.email, formData.password, role);
    onSuccess(userData);
  };

  const performRegister = async () => {
    await onRegister(formData, role);
    setStep(5); // success screen
  };

  const enterDashboardAfterSuccess = () => {
    onSuccess({
      name: formData.name,
      email: formData.email,
      role,
    });
  };

  // ── Render ───────────────────────────────────────────────────────

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.modalFull}>
        <View style={styles.bordercard}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.stepContent}>
              {/* ════════════ Step 0: Portal Entry Choice ════════════ */}
              {step === 0 && (
                <View style={{ alignItems: "center" }}>
                  <Text style={styles.h2}>
                    {role === "doctor" ? "🩺 Doctor" : "😊 Patient"} Access
                  </Text>
                  <Text style={[styles.p, { marginBottom: 40 }]}>
                    Please select an option to continue to your dashboard.
                  </Text>

                  <TouchableOpacity
                    style={[styles.btn, styles.choiceBtn, styles.modalbtn, { marginBottom: 30, width: "80%" }]}
                    onPress={() => handleChoice("login")}
                  >
                    <Text style={styles.choiceBtnText}>I have an account (Login)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, styles.outlineChoiceBtn, { width: "80%" }]}
                    onPress={() => handleChoice("register")}
                  >
                    <Text style={styles.outlineChoiceText}>New to SmileGuard? (Register)</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ════════════ Step 1: Service Intake (Patient Register) ════════════ */}
              {step === 1 && (
                <View>
                  <Text style={styles.h2}>Service Intake</Text>
                  <Text style={styles.stepIndicator}>Step 1 of 4</Text>
                  {["Cleaning", "AI-Diagnostic Scan", "Root Canal"].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={styles.radioRow}
                      onPress={() => setField("service", s)}
                    >
                      <View style={[styles.radio, formData.service === s && styles.radioActive]} />
                      <Text>{s}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={handleNext}>
                    <Text style={styles.btnText}>Next: Your Information →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ════════════ Step 2: Biography Intake (Patient Register) ════════════ */}
              {step === 2 && (
                <View>
                  <Text style={styles.h2}>📋 Personal Information</Text>
                  <Text style={styles.stepIndicator}>Step 2 of 4</Text>

                  <Text style={styles.label}>Date of Birth *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="MM/DD/YYYY"
                    value={formData.medicalIntake.dateOfBirth}
                    onChangeText={(t) => setIntake({ dateOfBirth: sanitize(t) })}
                    keyboardType={Platform.OS === "web" ? "default" : "numeric"}
                  />

                  <Text style={styles.label}>Gender *</Text>
                  <View style={styles.chipRow}>
                    {["Male", "Female", "Non-binary", "Prefer not to say"].map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.chip,
                          formData.medicalIntake.gender === g && styles.chipActive,
                        ]}
                        onPress={() => setIntake({ gender: g })}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            formData.medicalIntake.gender === g && styles.chipTextActive,
                          ]}
                        >
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>Phone Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="(555) 123-4567"
                    value={formData.medicalIntake.phone}
                    onChangeText={(t) => setIntake({ phone: sanitize(t) })}
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.label}>Home Address</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123 Main St, City, State ZIP"
                    value={formData.medicalIntake.address}
                    onChangeText={(t) => setIntake({ address: sanitize(t) })}
                  />

                  <Text style={styles.sectionHeader}>Emergency Contact *</Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Contact Name"
                    value={formData.medicalIntake.emergencyContactName}
                    onChangeText={(t) => setIntake({ emergencyContactName: sanitize(t) })}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Contact Phone"
                    value={formData.medicalIntake.emergencyContactPhone}
                    onChangeText={(t) => setIntake({ emergencyContactPhone: sanitize(t) })}
                    keyboardType="phone-pad"
                  />

                  <View style={styles.navRow}>
                    <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={() => setStep(1)}>
                      <Text style={styles.secondaryBtnText}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.primaryBtn, { flex: 1, marginLeft: 10 }]} onPress={handleNext}>
                      <Text style={styles.btnText}>Next: Medical History →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ════════════ Step 3: Medical History (Patient Register) ════════════ */}
              {step === 3 && (
                <View>
                  <Text style={styles.h2}>🏥 Medical History</Text>
                  <Text style={styles.stepIndicator}>Step 3 of 4</Text>
                  <Text style={styles.subtext}>
                    Leave blank or type "None" if not applicable.
                  </Text>

                  <Text style={styles.label}>Known Allergies</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder="e.g. Penicillin, Latex, Lidocaine…"
                    value={formData.medicalIntake.allergies}
                    onChangeText={(t) => setIntake({ allergies: sanitize(t) })}
                    multiline
                  />

                  <Text style={styles.label}>Current Medications</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder="e.g. Lisinopril 10 mg, Metformin 500 mg…"
                    value={formData.medicalIntake.currentMedications}
                    onChangeText={(t) => setIntake({ currentMedications: sanitize(t) })}
                    multiline
                  />

                  <Text style={styles.label}>Medical Conditions</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder="e.g. Diabetes, Hypertension, Asthma…"
                    value={formData.medicalIntake.medicalConditions}
                    onChangeText={(t) => setIntake({ medicalConditions: sanitize(t) })}
                    multiline
                  />

                  <Text style={styles.label}>Past Surgeries / Hospitalizations</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput]}
                    placeholder="e.g. Appendectomy (2019), Wisdom teeth (2021)…"
                    value={formData.medicalIntake.pastSurgeries}
                    onChangeText={(t) => setIntake({ pastSurgeries: sanitize(t) })}
                    multiline
                  />

                  <Text style={styles.label}>Smoking Status</Text>
                  <View style={styles.chipRow}>
                    {(
                      [
                        ["never", "Never"],
                        ["former", "Former"],
                        ["current", "Current"],
                      ] as const
                    ).map(([val, lbl]) => (
                      <TouchableOpacity
                        key={val}
                        style={[
                          styles.chip,
                          formData.medicalIntake.smokingStatus === val && styles.chipActive,
                        ]}
                        onPress={() => setIntake({ smokingStatus: val })}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            formData.medicalIntake.smokingStatus === val && styles.chipTextActive,
                          ]}
                        >
                          {lbl}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>Currently Pregnant?</Text>
                  <View style={styles.chipRow}>
                    {(
                      [
                        ["yes", "Yes"],
                        ["no", "No"],
                        ["na", "N/A"],
                      ] as const
                    ).map(([val, lbl]) => (
                      <TouchableOpacity
                        key={val}
                        style={[
                          styles.chip,
                          formData.medicalIntake.pregnancyStatus === val && styles.chipActive,
                        ]}
                        onPress={() => setIntake({ pregnancyStatus: val })}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            formData.medicalIntake.pregnancyStatus === val && styles.chipTextActive,
                          ]}
                        >
                          {lbl}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.navRow}>
                    <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={() => setStep(2)}>
                      <Text style={styles.secondaryBtnText}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.primaryBtn, { flex: 1, marginLeft: 10 }]} onPress={handleNext}>
                      <Text style={styles.btnText}>Next: Create Account →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ════════════ Step 4: Credentials ════════════ */}
              {step === 4 && (
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
                  {formData.password.length > 0 && (
                    <View style={styles.strengthSection}>
                      {/* Strength bar */}
                      <View style={styles.strengthBarBg}>
                        <View
                          style={[
                            styles.strengthBarFill,
                            { width: `${strengthPercent}%`, backgroundColor: strengthColor },
                          ]}
                        />
                      </View>
                      <Text style={[styles.strengthLabel, { color: strengthColor }]}>
                        {strengthPercent <= 40
                          ? "Weak"
                          : strengthPercent <= 70
                          ? "Fair"
                          : strengthPercent < 100
                          ? "Good"
                          : "Strong ✓"}
                      </Text>
                      {/* Checklist */}
                      {passwordChecks.map((c) => (
                        <Text key={c.label} style={{ color: c.met ? "#22c55e" : "#9ca3af", fontSize: 13, marginTop: 2 }}>
                          {c.met ? "✓" : "○"} {c.label}
                        </Text>
                      ))}
                    </View>
                  )}

                  {/* Doctor access code (doctor role only) */}
                  {role === "doctor" && (
                    <>
                      <Text style={[styles.label, { marginTop: 8 }]}>Clinic Access Code *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your clinic access code"
                        autoCapitalize="characters"
                        value={formData.doctorAccessCode}
                        onChangeText={(t) => setField("doctorAccessCode", t)}
                      />
                      <Text style={styles.helperText}>
                        This code is issued by your clinic administrator and is required to verify
                        your identity as an authorized provider.
                      </Text>
                    </>
                  )}

                  {/* Lockout warning */}
                  {loginAttempts > 0 && mode === "login" && (
                    <Text style={styles.warningText}>
                      ⚠️ {MAX_LOGIN_ATTEMPTS - loginAttempts} login attempt(s) remaining before
                      temporary lockout.
                    </Text>
                  )}

                  <TouchableOpacity
                    style={[styles.btn, styles.primaryBtn, { marginTop: 12 }]}
                    onPress={handleFinalize}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnText}>
                        {mode === "login" ? "Enter Portal" : "Complete Registration"}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Back button for patient register flow */}
                  {mode === "register" && role === "patient" && (
                    <TouchableOpacity style={[styles.btn, styles.secondaryBtn, { marginTop: 10 }]} onPress={() => setStep(3)}>
                      <Text style={styles.secondaryBtnText}>← Back to Medical History</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* ════════════ Step 5: Success (Register Only) ════════════ */}
              {step === 5 && (
                <View style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 40, marginBottom: 10 }}>🎉</Text>
                  <Text style={styles.h2}>All Set!</Text>
                  <Text style={styles.p}>Your {role} portal is ready.</Text>
                  <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={enterDashboardAfterSuccess}>
                    <Text style={styles.btnText}>Enter Dashboard</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityLabel="Close authentication modal"
            accessibilityRole="button"
          >
            <Text style={styles.closeBtnText}>Exit</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
  strengthBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e5e7eb",
    marginBottom: 6,
  },
  strengthBarFill: {
    height: 6,
    borderRadius: 3,
  },
  strengthLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
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
