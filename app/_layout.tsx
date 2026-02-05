import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

// Custom Components
import HowItWorks from "./_HowItWorks"; // Ensure this exists or comment out
import Footer from "./_Footer"; // Ensure this exists or comment out
import PatientDashboard from "./_patientDashboard"; // Placeholder needed if not created
import DoctorDashboard from "./_docDashboard";

// --- MOCK DATABASE INITIALIZATION ---
// In a real app, this data comes from your backend (Firebase/MongoDB)
const INITIAL_USERS = [
  {
    name: "Dr. Smith",
    email: "doctor@test.com",
    password: "password123",
    role: "doctor",
    service: "General",
  },
  {
    name: "John Doe",
    email: "patient@test.com",
    password: "password123",
    role: "patient",
    service: "Cleaning",
  },
];

export default function App() {
  // --- STATE MANAGEMENT ---
  const [users, setUsers] = useState(INITIAL_USERS); // Simulates DB
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [step, setStep] = useState(0); 
  const [loading, setLoading] = useState(false);
  
  // Context State
  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const [mode, setMode] = useState<"register" | "login">("register");

  // Logged In User
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);

  // Form Inputs
  const [formData, setFormData] = useState({
    service: "",
    name: "",
    email: "",
    password: "",
  });

  // --- ACTIONS ---

  const openPortal = (selectedRole: "patient" | "doctor") => {
    setRole(selectedRole);
    setStep(0);
    setShowEnrollment(true);
    setFormData({ service: "", name: "", email: "", password: "" }); // Reset form
  };

  const handleChoice = (selectedMode: "register" | "login") => {
    setMode(selectedMode);
    // Patients registering need to select a service first (Step 1)
    // Doctors or Logins go straight to Credentials (Step 2)
    if (selectedMode === "login" || role === "doctor") {
      setStep(2);
    } else {
      setStep(1);
    }
  };

  const handleNext = () => setStep((s) => s + 1);

  const handleFinalize = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert("Missing Info", "Please complete all required fields.");
      return;
    }

    if (mode === "register" && !formData.name) {
      Alert.alert("Missing Info", "Please enter your full name.");
      return;
    }

    setLoading(true);
    // Simulate Network Request
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLoading(false);

    try {
      if (mode === "login") {
        performLogin();
      } else {
        performRegister();
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // --- AUTH LOGIC ---

  const performLogin = () => {
    // 1. Find user
    const foundUser = users.find(
      (u) =>
        u.email.toLowerCase() === formData.email.toLowerCase() &&
        u.password === formData.password
    );

    // 2. Validate
    if (!foundUser) {
      throw new Error("Invalid email or password.");
    }
    if (foundUser.role !== role) {
      throw new Error(`This account is not registered as a ${role}.`);
    }

    // 3. Success
    setCurrentUser({
      name: foundUser.name,
      email: foundUser.email,
      role: foundUser.role,
    });
    setShowEnrollment(false);
  };

  const performRegister = () => {
    // 1. Check if email exists
    const exists = users.find(
      (u) => u.email.toLowerCase() === formData.email.toLowerCase()
    );
    if (exists) {
      throw new Error("Email already registered. Please login.");
    }

    // 2. Create User Object
    const newUser = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: role,
      service: formData.service || "General",
    };

    // 3. Save to "DB"
    setUsers([...users, newUser]);

    // 4. Move to Success Screen
    setStep(3);
  };

  const enterDashboardAfterSuccess = () => {
    setCurrentUser({
      name: formData.name,
      email: formData.email,
      role: role,
    });
    setShowEnrollment(false);
  };

  // --- RENDER ---

  if (currentUser) {
    return currentUser.role === "doctor" ? (
      <DoctorDashboard user={currentUser} onLogout={() => setCurrentUser(null)} />
    ) : (
      // Placeholder if you haven't created PatientDashboard yet
      <PatientDashboard user={currentUser} onLogout={() => setCurrentUser(null)} />
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView stickyHeaderIndices={[0]}>
          
          {/* Navigation */}
          <View style={styles.nav}>
            <Text style={styles.logo}>SmileGuard</Text>
            <View style={styles.navLinks}>
              <TouchableOpacity
                style={styles.portalBtn}
                onPress={() => openPortal("patient")}
              >
                <Text style={styles.portalBtnText}>Patient Portal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.portalBtn, styles.doctorPortalBtn]}
                onPress={() => openPortal("doctor")}
              >
                <Text style={styles.portalBtnText}>Doctor Portal</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hero Section */}
          <View style={styles.hero}>
            <View style={styles.heroContent}>
              <Text style={styles.h1}>Smile-Guard Dental Portal:</Text>
              <Text style={styles.p}>
                Secure, AI-Enhanced Patient Intake & Provider Dashboard
              </Text>
              <TouchableOpacity
                style={[styles.btn, styles.primaryBtn]}
                onPress={() => openPortal("patient")}
              >
                <Text style={styles.btnText}>Start Secure Intake</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Placeholders for your other components */}
          {HowItWorks ? <HowItWorks /> : <View style={{padding:20}}><Text>How It Works Section</Text></View>}
          {Footer ? <Footer /> : <View style={{padding:20}}><Text>Footer Section</Text></View>}

        </ScrollView>

        {/* --- AUTH MODAL --- */}
        <Modal visible={showEnrollment} animationType="slide">
          <SafeAreaView style={styles.modalFull}>
            <View style={styles.bordercard}>
              <View style={styles.stepContent}>
                
                {/* Step 0: Portal Entry Choice */}
                {step === 0 && (
                  <View style={{ alignItems: "center" }}>
                    <Text style={styles.h2}>
                      {role === "doctor" ? "Doctor" : "Patient"} Access
                    </Text>
                    <Text style={[styles.p, { marginBottom: 40 }]}>
                      Please select an option to continue to your dashboard.
                    </Text>

                    <TouchableOpacity
                      style={[styles.btn, styles.choiceBtn, styles.modalbtn, { marginBottom: 30, width: "80%" }]}
                      onPress={() => handleChoice("login")}
                    >
                      <Text style={styles.choiceBtnText}>
                        I have an account (Login)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.btn, styles.outlineChoiceBtn, { width: "80%" }]}
                      onPress={() => handleChoice("register")}
                    >
                      <Text style={styles.outlineChoiceText}>
                        New to SmileGuard? (Register)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Step 1: Service Intake (Patient Register Only) */}
                {step === 1 && (
                  <View>
                    <Text style={styles.h2}>Service Intake</Text>
                    {["Cleaning", "AI-Diagnostic Scan", "Root Canal"].map(
                      (s) => (
                        <TouchableOpacity
                          key={s}
                          style={styles.radioRow}
                          onPress={() =>
                            setFormData({ ...formData, service: s })
                          }
                        >
                          <View
                            style={[
                              styles.radio,
                              formData.service === s && styles.radioActive,
                            ]}
                          />
                          <Text>{s}</Text>
                        </TouchableOpacity>
                      )
                    )}
                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn]}
                      onPress={handleNext}
                    >
                      <Text style={styles.btnText}>Next: Details</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Step 2: Credentials */}
                {step === 2 && (
                  <View>
                    <Text style={styles.h2}>
                      {mode === "login" ? "Welcome Back" : "Create Account"}
                    </Text>
                    
                    {/* Name field is only for registration */}
                    {mode === "register" && (
                      <TextInput
                        style={styles.input}
                        placeholder="Full Name"
                        value={formData.name}
                        onChangeText={(t) =>
                          setFormData({ ...formData, name: t })
                        }
                      />
                    )}
                    
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={formData.email}
                      onChangeText={(t) =>
                        setFormData({ ...formData, email: t })
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      secureTextEntry
                      value={formData.password}
                      onChangeText={(t) =>
                        setFormData({ ...formData, password: t })
                      }
                    />
                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn]}
                      onPress={handleFinalize}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.btnText}>
                          {mode === "login"
                            ? "Enter Portal"
                            : "Complete Registration"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Step 3: Success (Only for Register) */}
                {step === 3 && (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 40, marginBottom: 10 }}>🎉</Text>
                    <Text style={styles.h2}>All Set!</Text>
                    <Text style={styles.p}>Your {role} portal is ready.</Text>
                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn]}
                      onPress={enterDashboardAfterSuccess}
                    >
                      <Text style={styles.btnText}>Enter Dashboard</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowEnrollment(false)}
              >
                 <Text style={{ fontSize: 15, color: "#ef4444", fontWeight: "bold" , borderColor: "#ef4444", borderWidth: 1,paddingHorizontal: 20,paddingVertical: 10, borderRadius: 30 }}>
                  Exit
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  nav: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 20,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "#fafafa",
    backgroundColor: "#fff",
  },
  navLinks: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  logo: { fontSize: 28, fontWeight: "800", color: "#0b7fab" },
  portalBtn: {
    backgroundColor: "#0b7fab",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  doctorPortalBtn: { backgroundColor: "#1e293b" },
  portalBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  hero: { padding: 60, backgroundColor: "#f0f9ff", alignItems: "center" },
  heroContent: { maxWidth: 600, alignItems: "center" },
  h1: { fontSize: 36, fontWeight: "bold", textAlign: "center", marginBottom: 15 },
  p: { fontSize: 18, color: "#4b5563", textAlign: "center", marginBottom: 30 },
  h2: { fontSize: 24, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
  },
  modalbtn: { marginTop: 50 },
  primaryBtn: { backgroundColor: "#0b7fab", width: "100%" },
  choiceBtn: { backgroundColor: "#0b7fab", width: "100%", marginBottom: 12 },
  choiceBtnText: { color: "#fff", fontWeight: "700" },
  outlineChoiceBtn: { borderWidth: 2, borderColor: "#0b7fab", width: "100%" },
  outlineChoiceText: { color: "#0b7fab", fontWeight: "700" },
  btnText: { color: "#fff", fontWeight: "700" },
  modalFull: { flex: 1, padding: 30 },
  bordercard: { flex: 1, maxWidth: 500, alignSelf: "center", width: "100%" },
  stepContent: {
    justifyContent: "center",
    flex: 1,
    marginTop: 40,
    borderColor: "#2bf1ff7d",
    borderWidth: 1,
    borderRadius: 45,
    padding: 16,
  },
  input: {
    backgroundColor: "#f3f4f6",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
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
  radioActive: { backgroundColor: "#0b7fab" },
  closeBtn: { alignItems: "center", padding: 20 },
});