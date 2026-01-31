import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import PatientDashboard from "./_patientDashboard";

// Simple placeholder for Doctor Dashboard
const DoctorDashboard = ({ user, onLogout }: any) => (
  <View style={styles.container}>
    <SafeAreaView
      style={{
        padding: 20,
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
      }}
    >
      <Text style={styles.h2}>Provider Portal: Dr. {user.name}</Text>
      <TouchableOpacity
        style={[styles.btn, styles.primaryBtn, { width: 200 }]}
        onPress={onLogout}
      >
        <Text style={styles.btnText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  </View>
);

export default function App() {
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [step, setStep] = useState(0); // Start at 0 for Portal Selection
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const [mode, setMode] = useState<"register" | "login">("register");

  const [user, setUser] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    service: "",
    name: "",
    email: "",
    password: "",
  });

  // Opens the modal and sets the role context
  const openPortal = (selectedRole: "patient" | "doctor") => {
    setRole(selectedRole);
    setStep(0); // Show Login/Register choice
    setShowEnrollment(true);
  };

  // Logic to handle choosing Login vs Register inside the portal
  const handleChoice = (selectedMode: "register" | "login") => {
    setMode(selectedMode);
    if (selectedMode === "login" || role === "doctor") {
      setStep(2); // Go to credentials
    } else {
      setStep(1); // Go to Service Intake (Patients only)
    }
  };

  const handleNext = () => setStep((s) => s + 1);

  const handleFinalize = async () => {
    if (!formData.email || !formData.password) {
      alert("Please complete the required fields.");
      return;
    }
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLoading(false);

    if (mode === "register") {
      setStep(3); // Success Screen
    } else {
      enterDashboard();
    }
  };

  const enterDashboard = () => {
    setUser({
      name: formData.name || (role === "doctor" ? "Provider" : "Patient"),
      email: formData.email,
      role: role,
    });
    setShowEnrollment(false);
    setFormData({ service: "", name: "", email: "", password: "" });
  };

  if (user) {
    return user.role === "doctor" ? (
      <DoctorDashboard user={user} onLogout={() => setUser(null)} />
    ) : (
      <PatientDashboard user={user} onLogout={() => setUser(null)} />
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView stickyHeaderIndices={[0]}>
          {/* Refined Navigation */}
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
              <Text style={styles.h1}>Smile-Guard Dental{"\n"}Portal.</Text>
              <Text style={styles.p}>
                Secure, synchronized care for patients and providers.
              </Text>
              <TouchableOpacity
                style={[styles.btn, styles.primaryBtn]}
                onPress={() => openPortal("patient")}
              >
                <Text style={styles.btnText}>Start Secure Intake</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Features Grid */}
          <View style={styles.featuresSection}>
            <Text style={styles.h2}>System Architecture</Text>
            <View style={styles.featuresGrid}>
              <FeatureCard
                title="Synchronized EDR"
                desc="Web & Android parity."
              />
              <FeatureCard
                title="Explainable AI"
                desc="Rule-based luminosity aids."
              />
              <FeatureCard
                title="Secure Intake"
                desc="50% pre-visit completion rate."
              />
            </View>
          </View>
        </ScrollView>

        {/* Multi-Step Intake Modal */}
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
                      <Text style={[styles.outlineChoiceText]}>
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
                      ),
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
                    {mode === "register" && (
                      <TextInput
                        style={styles.input}
                        placeholder="Full Name"
                        onChangeText={(t) =>
                          setFormData({ ...formData, name: t })
                        }
                      />
                    )}
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      autoCapitalize="none"
                      onChangeText={(t) =>
                        setFormData({ ...formData, email: t })
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      secureTextEntry
                      onChangeText={(t) =>
                        setFormData({ ...formData, password: t })
                      }
                    />
                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn]}
                      onPress={handleFinalize}
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

                {/* Step 3: Success */}
                {step === 3 && (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 40, marginBottom: 10 }}>🎉</Text>
                    <Text style={styles.h2}>All Set!</Text>
                    <Text style={styles.p}>Your {role} portal is ready.</Text>
                    <TouchableOpacity
                      style={[ styles.btn, styles.primaryBtn]}
                      onPress={enterDashboard}
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
                <Text style={{ color: "#ef4444", fontWeight: "bold" }}>
                  Exit Portal
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const FeatureCard = ({ title, desc }: { title: string; desc: string }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    <Text style={styles.mutedText}>{desc}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  nav: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  navLinks: { flexDirection: "row", gap: 12 },
  logo: { fontSize: 22, fontWeight: "800", color: "#0b7fab" },
  portalBtn: {
    backgroundColor: "#0b7fab",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  doctorPortalBtn: { backgroundColor: "#1e293b" },
  portalBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  hero: { padding: 60, backgroundColor: "#f0f9ff", alignItems: "center" },
  heroContent: { maxWidth: 600, alignItems: "center" },
  h1: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  p: { fontSize: 18, color: "#4b5563", textAlign: "center", marginBottom: 30 },
  featuresSection: { padding: 40 },
  featuresGrid: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 20,
    justifyContent: "center",
  },
  h2: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 16,
    width: Platform.OS === "web" ? 280 : "100%",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  mutedText: { color: "#6b7280" },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
  },
  modalbtn: { marginTop: 90 },
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
    shadowColor: "#2bf1ff7d",
    shadowOpacity: 0.3,
    shadowRadius: 10,
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
