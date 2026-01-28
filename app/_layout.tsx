import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
const { width } = Dimensions.get("window");
export default function App() {
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [step, setStep] = useState(1); // 1: Booking, 2: Sign up, 3: Success
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ name: string } | null>(null);

  const [formData, setFormData] = useState({
    service: "",
    name: "",
    email: "",
    password: "",
  });

  const handleNext = () => setStep((s) => s + 1);

  const handleFinalize = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      alert("Please fill in all fields");
      return;
    }
    setLoading(true);
    // Simulate API/Firebase call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLoading(false);
    setStep(3);
  };

  const enterDashboard = () => {
    setUser({ name: formData.name || "Patient" });
    setShowEnrollment(false);
  };

  if (user) {
    return <PatientDashboard user={user} onLogout={() => setUser(null)} />;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView stickyHeaderIndices={[0]}>
          {/* Navigation */}
          <View style={styles.nav}>
            <Text style={styles.logo}>DentaApp</Text>
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => {
                setStep(2);
                setShowEnrollment(true);
              }}
            >
              <Text style={styles.btnLabel}>Log In</Text>
            </TouchableOpacity>
          </View>

          {/* Hero - Retaining your exact look */}
          <View style={styles.hero}>
            <View style={styles.heroContent}>
              <Text style={styles.h1}>Gentle care.{"\n"}Bright smiles.</Text>
              <Text style={styles.p}>
                Modern dental management for patients and clinics.
              </Text>
              <TouchableOpacity
                style={[styles.btn, styles.primaryBtn]}
                onPress={() => {
                  setStep(1);
                  setShowEnrollment(true);
                }}
              >
                <Text style={styles.btnText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Features */}
          <View style={styles.featuresSection}>
            <Text style={styles.h2}>What the app offers</Text>
            <View style={styles.featuresGrid}>
              <FeatureCard
                title="Online Booking"
                desc="Real-time scheduling."
              />
              <FeatureCard
                title="Patient Records"
                desc="Secure medical history."
              />
              <FeatureCard
                title="Reminders"
                desc="Never miss an appointment."
              />
            </View>
          </View>
        </ScrollView>

        {/* Enrollment Modal */}
        <Modal visible={showEnrollment} animationType="slide">
          <SafeAreaView style={styles.modalFull}>
            {/* PROGRESS BAR */}
            <View style={styles.bordercard}>
              <View style={styles.progressHeader}>
                <View style={styles.progressBar}>
                  <View style={[styles.dot, step >= 1 && styles.activeDot]}>
                    <Text style={styles.dotText}>1</Text>
                  </View>
                  <View style={[styles.line, step >= 2 && styles.activeLine]} />
                  <View style={[styles.dot, step >= 2 && styles.activeDot]}>
                    <Text style={styles.dotText}>2</Text>
                  </View>
                  <View style={[styles.line, step >= 3 && styles.activeLine]} />
                  <View style={[styles.dot, step >= 3 && styles.activeDot]}>
                    <Text style={styles.dotText}>3</Text>
                  </View>
                </View>
                <View style={styles.labelRow}>
                  <Text style={styles.stepLabel}>Booking</Text>
                  <Text style={styles.stepLabel}>Sign Up</Text>
                  <Text style={styles.stepLabel}>Finished</Text>
                </View>
              </View>

              <View style={styles.stepContent}>
                {step === 1 && (
                  <View>
                    <Text style={styles.h2}>Book Appointment</Text>
                    <View style={{ marginBottom: 16 }}>
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          marginBottom: 12,
                        }}
                      >
                        Select Service
                      </Text>
                      {[
                        "Cleaning",
                        "Tooth Extraction",
                        "Root Canal",
                        "Whitening",
                      ].map((service) => (
                        <TouchableOpacity
                          key={service}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginBottom: 10,
                          }}
                          onPress={() => setFormData({ ...formData, service })}
                        >
                          <View
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: 4,
                              borderWidth: 2,
                              borderColor: "#0b7fab",
                              backgroundColor:
                                formData.service === service
                                  ? "#0b7fab"
                                  : "#fff",
                              marginRight: 12,
                            }}
                          />
                          <Text style={{ fontSize: 16 }}>{service}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn]}
                      onPress={handleNext}
                    >
                      <Text style={styles.btnText}>Continue</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {step === 2 && (
                  <View>
                    <Text style={styles.h2}>Create Account</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      onChangeText={(t) =>
                        setFormData({ ...formData, name: t })
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Email"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onChangeText={(t) =>
                        setFormData({ ...formData, email: t })
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      secureTextEntry
                      textContentType="password"
                      onChangeText={(t) =>
                        setFormData({ ...formData, password: t })
                      }
                    />
                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn]}
                      onPress={() => {
                        try {
                          if (!formData.name || formData.name.trim() === "") {
                            throw new Error("Full Name is required");
                          }
                          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                          if (
                            !formData.email ||
                            !emailRegex.test(formData.email)
                          ) {
                            throw new Error("Valid email is required");
                          }
                          if (
                            !formData.password ||
                            formData.password.length < 6
                          ) {
                            throw new Error(
                              "Password must be at least 6 characters",
                            );
                          }
                          handleFinalize();
                        } catch (error) {
                          alert(
                            error instanceof Error
                              ? error.message
                              : "Validation error",
                          );
                        }
                      }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.btnText}>Complete</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {step === 3 && (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 50, marginBottom: 20 }}>✨</Text>
                    <Text style={styles.h2}>Success!</Text>
                    <Text style={styles.p}>
                      Your booking for {formData.service} is confirmed. Welcome
                      to the family.
                    </Text>
                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn]}
                      onPress={enterDashboard}
                    >
                      <Text style={styles.btnText}>Go to Dashboard</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowEnrollment(false)}
              >
                <Text style={{ color: "#ef4444", fontWeight: "bold" }}>
                  Cancel
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
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  logo: { fontSize: 22, fontWeight: "800", color: "#0b7fab" },
  outlineBtn: {
    borderWidth: 1,
    borderColor: "#333",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  hero: { padding: 60, backgroundColor: "#f0f9ff", alignItems: "center" },
  heroContent: { maxWidth: 600, alignItems: "center" },
  h1: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
    lineHeight: 42,
  },
  p: { fontSize: 18, color: "#4b5563", textAlign: "center", marginBottom: 30 },
  featuresSection: { padding: 40 },
  featuresGrid: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 20,
  },
  h2: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 25,
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    color: "#1f2937",
  },
  mutedText: { color: "#6b7280" },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtn: { backgroundColor: "#0b7fab", width: "100%" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  btnLabel: { fontWeight: "600", color: "#333" },
  // Modal Progress Styles
  modalFull: {
    flex: 1,
    padding: 30,
    justifyContent: "space-between",
  },
  bordercard: {
    flex: 1,
    justifyContent: "space-between",
    alignSelf: "center", // centers content on wide screens
    paddingTop: width < 768 ? 20 : 40, // smaller padding on mobile
    marginTop: width < 768 ? 40 : 80, // reduce margin on small screens
    width: Platform.OS === "web" ? "100%" : "auto",
    maxWidth: Platform.OS === "web" ? 800 : "100%", // cap width on desktop
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  //TAKE NOTE TO USE 'web' TO STYLE FOR WEB VERSIONS
  bordercardweb: {
    borderColor: "#dddddd",
    borderWidth: 5,
    borderRadius: "20%",
  },
  progressHeader: { marginBottom: 50 },
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
  },
  activeDot: { backgroundColor: "#0b7fab" },
  dotText: { color: "#fff", fontSize: 12, fontWeight: "bold" },
  line: { width: 100, height: 2, backgroundColor: "#e5e7eb" },
  lineweb: { width: 140, height: 2, backgroundColor: "#e5e7eb" },
  activeLine: { backgroundColor: "#0b7fab" },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: Platform.OS === "web" ? "100%" : "auto",
    maxWidth: Platform.OS === "web" ? 500 : "100%", // cap width on desktop
    alignSelf: "center", // centers content on wide screens
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#9ca3af",
    flex: 1,
    alignSelf: "center", // centers content on wide screens
    textAlign: "center",
  },
  stepContent: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
    paddingTop: width < 768 ? 20 : 40, // smaller padding on mobile
    marginTop: width < 768 ? 40 : 80, // reduce margin on small screens
    flex: 1,
    width: Platform.OS === "web" ? "100%" : "auto",
    maxWidth: Platform.OS === "web" ? 800 : "100%", // cap width on desktop
    alignSelf: "center", // centers content on wide screens
    paddingHorizontal: width < 768 ? 16 : 32, // side padding for breathing room
  },
  stepContentweb: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#e5e7eb",
    paddingTop: width < 768 ? 20 : 40, // smaller padding on mobile
    marginTop: width < 768 ? 40 : 80, // reduce margin on small screens
    flex: 1,
    width: Platform.OS === "web" ? "100%" : "auto",
    maxWidth: Platform.OS === "web" ? 800 : "100%", // cap width on desktop
    alignSelf: "center", // centers content on wide screens
    paddingHorizontal: width < 768 ? 16 : 32, // side padding for breathing room
  },
  centerContent: {
    alignItems: "center",
    padding: 0.5,
    justifyContent: "center",
  },
  input: {
    backgroundColor: "#f3f4f6",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  closeBtn: { alignItems: "center", padding: 20 },
});
