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
import { Smartphone, Camera, Brain, CircuitBoard, Activity, CheckCircle, ArrowDown} from 'lucide-react-native';

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
const Footer = () => (
  <View style={styles.footer}>
    <View style={styles.footerRow}>
      <View style={styles.footerSection}>
        <Text style={styles.footerTitle}>Contact</Text>
        <Text style={styles.footerText}>📍 123 Dental St., Malabon</Text>
        <Text style={styles.footerText}>📞 (02) 1234-5678</Text>
        <Text style={styles.footerText}>📧 info@smileguard.ph</Text>
      </View>

      <View style={styles.footerSection}>
        <Text style={styles.footerTitle}>Quick Links</Text>
        <Text style={styles.footerLink}>Book Appointment</Text>
        <Text style={styles.footerLink}>Services</Text>
        <Text style={styles.footerLink}>Insurance Accepted</Text>
      </View>

      <View style={styles.footerSection}>
        <Text style={styles.footerTitle}>Hours</Text>
        <Text style={styles.footerText}>🕗Mon: 10:00 AM – 4:00 PM</Text>
        <Text style={styles.footerText}>❌ Tue: Closed </Text>
        <Text style={styles.footerText}>🕗 Wed–Fri: 10:00 AM – 3:00 PM</Text>
        <Text style={styles.footerText}>🕗 Sat: 10:00 AM – 3:00 PM</Text>
        <Text style={styles.footerText}>❌ Sun: Closed</Text>
      </View>
    </View>
    <View style={styles.footerBottom}>
      <Text style={styles.footerLegal}>© 2026 SmileGuard Dental</Text>
      <Text style={styles.footerLegal}>Privacy Policy | Terms of Service</Text>
    </View>
  </View>
);



  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView stickyHeaderIndices={[0]}>
          {/* Refined Navigation */}
          <View style={styles.nav}>
            <Text style={styles.logo}>SmileGuard</Text>
            <View style={[styles.navLinks]}>
              <TouchableOpacity
                style={[styles.portalBtn]}
                onPress={() => openPortal("patient")}
              >
                <Text style={[styles.portalBtnText]}>Patient Portal</Text>
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

          {/* Features Grid */}
          <View style={styles.featuresSection}>
            <ScrollView contentContainerStyle={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>How It Works</Text>
        <Text style={styles.subtitle}>
          We’ve simplified dental monitoring into three secure steps.
        </Text>
      </View>

      {/* Steps Container */}
      <View style={styles.stepsContainer}>
        
        {/* Connecting Line (Vertical for Mobile) */}
        <View style={styles.connectingLine} />

        {/* --- STEP 1: CAPTURE --- */}
        <View style={styles.stepCard}>
          <View style={styles.iconContainer}>
            <Smartphone size={40} color="#94a3b8" />
            <View style={styles.badge}>
              <Camera size={16} color="white" />
            </View>
          </View>
          <Text style={styles.stepTitle}>1. Capture & Upload</Text>
          <Text style={styles.stepDesc}>
            Use your phone to take guided photos. Encrypted for your privacy.
          </Text>
        </View>

        {/* Arrow Connector */}
        <View style={styles.arrowContainer}>
          <ArrowDown size={32} color="#22d3ee" />
        </View>

        {/* --- STEP 2: AI ANALYSIS --- */}
        <View style={styles.stepCard}>
          <View style={styles.iconContainer}>
            <Brain size={40} color="#0891b2" />
            {/* Simple overlay for the circuit look */}
            <View style={{ position: 'absolute', bottom: -5, right: -5, opacity: 0.5 }}>
               <CircuitBoard size={24} color="#22d3ee" />
            </View>
          </View>
          <Text style={styles.stepTitle}>2. AI-Driven Analysis</Text>
          <Text style={styles.stepDesc}>
            Our Python AI scans for inflammation and tissue health instantly.
          </Text>
        </View>

        {/* Arrow Connector */}
        <View style={styles.arrowContainer}>
           <ArrowDown size={32} color="#22d3ee" />
        </View>

        {/* --- STEP 3: TRACK PROGRESS --- */}
        <View style={styles.stepCard}>
          <View style={styles.iconContainer}>
            <Activity size={40} color="#334155" />
            <View style={[styles.badge, { backgroundColor: '#22c55e' }]}>
              <CheckCircle size={16} color="white" />
            </View>
          </View>
          <Text style={styles.stepTitle}>3. Track Progress</Text>
          <Text style={styles.stepDesc}>
            View your recovery timeline and know exactly when to see a doctor.
          </Text>
        </View>

      </View>
    </ScrollView>
          </View>
          
          <Footer />
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
                <Text style={{ fontSize: 15, color: "#ef4444", fontWeight: "bold" , borderColor: "#ef4444", borderWidth: 1,paddingHorizontal: 20,paddingVertical: 10, borderRadius: 30, shadowColor: "#ef4444", shadowOpacity: 0.3, shadowRadius: 10,  }}>
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
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
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
    flexWrap: "wrap",
  },
  h2: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
 
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a', // slate-900
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b', // slate-500
    textAlign: 'center',
  },
  stepsContainer: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  connectingLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#cffafe', // cyan-100
    zIndex: -1, // Puts the line behind the cards
  },
  stepCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    // Shadow for Android
    elevation: 3,
    marginBottom: 0,
    zIndex: 1,
  },
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#f0f9ff', // light cyan bg for icon
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#0891b2', // cyan-600
    padding: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  stepDesc: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  arrowContainer: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    backgroundColor: '#ecfeff', // Matches bg to hide line crossing through arrow
    paddingVertical: 10,
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
footer: {
  backgroundColor: "#f9fafb",
  padding: 20,
  borderTopWidth: 1,
  borderTopColor: "#e5e7eb",
},
footerRow: {
  borderColor: "#2bf1ff7d",
  flexDirection: "row",
  justifyContent: "space-between",
  flexWrap: "wrap",
  borderWidth: 1,
  borderRadius: 12,
  padding: 20,
  marginBottom: 20,
},
footerSection: {
  width: "30%",
  marginBottom: 20,
},
footerTitle: {
  fontWeight: "bold",
  fontSize: 16,
  marginBottom: 8,
},
footerText: {
  fontSize: 12,
  color: "#4b5563",
  fontWeight: "500",
  marginBottom: 4,
  padding: 4,
},
footerLink: {
  fontSize: 14,
  color: "#0b7fab",
  textDecorationLine: "underline",
  marginBottom: 4,
},
footerBottom: {
  borderTopWidth: 1,
  borderTopColor: "#e5e7eb",
  paddingTop: 10,
  alignItems: "center",
},
footerLegal: {
  fontSize: 12,
  color: "#6b7280",
},
});
