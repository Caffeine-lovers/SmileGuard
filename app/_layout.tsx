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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Centralized State: This is your "Source of Truth"
  const [user, setUser] = useState<{ name: string; email: string } | null>(
    null,
  );

  const [formData, setFormData] = useState({
    service: "",
    name: "",
    email: "",
    password: "",
  });

  const handleNext = () => setStep((s) => s + 1);

  const handleFinalize = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      alert("Please complete the secure intake fields.");
      return;
    }
    setLoading(true);
    // Simulate Edge-Node Database Sync (Objective 1)
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLoading(false);
    setStep(3);
  };

  const enterDashboard = () => {
    // Transitioning from Intake to Centralized EDR
    setUser({
      name: formData.name || "Patient",
      email: formData.email,
    });
    setShowEnrollment(false);
  };

  // Conditional Rendering: Switch between Landing and Dashboard
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
                setStep(2); // Jump to Sign In
                setShowEnrollment(true);
              }}
            >
              <Text style={styles.btnLabel}>Portal Login</Text>
            </TouchableOpacity>
          </View>

          {/* Hero Section */}
          <View style={styles.hero}>
            <View style={styles.heroContent}>
              <Text style={styles.h1}>Edge-AI Dental{"\n"}Management.</Text>
              <Text style={styles.p}>
                A synchronized platform reducing manual entry by 45% with
                rule-driven diagnostic aids.
              </Text>
              <TouchableOpacity
                style={[styles.btn, styles.primaryBtn]}
                onPress={() => {
                  setStep(1);
                  setShowEnrollment(true);
                }}
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

        {/* Multi-Step Intake Modal (Objective 3) */}
        <Modal visible={showEnrollment} animationType="slide">
          <SafeAreaView style={styles.modalFull}>
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
              </View>

              <View style={styles.stepContent}>
                {step === 1 && (
                  <View>
                    <Text style={styles.h2}>Service Intake</Text>
                    {["Cleaning", "AI-Diagnostic Scan", "Root Canal"].map(
                      (service) => (
                        <TouchableOpacity
                          key={service}
                          style={styles.radioRow}
                          onPress={() => setFormData({ ...formData, service })}
                        >
                          <View
                            style={[
                              styles.radio,
                              formData.service === service &&
                                styles.radioActive,
                            ]}
                          />
                          <Text>{service}</Text>
                        </TouchableOpacity>
                      ),
                    )}
                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn]}
                      onPress={handleNext}
                    >
                      <Text style={styles.btnText}>Next: Patient Details</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {step === 2 && (
                  <View>
                    <Text style={styles.h2}>Secure Demographics</Text>
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
                      onChangeText={(t) =>
                        setFormData({ ...formData, email: t })
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Secure Password"
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
                        <Text style={styles.btnText}>Verify & Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {step === 3 && (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 40, marginBottom: 10 }}>🦷</Text>
                    <Text style={styles.h2}>Record Created!</Text>
                    <Text style={styles.p}>
                      Your intake is complete. Your EDR is now synced across all
                      clinic terminals.
                    </Text>
                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn]}
                      onPress={enterDashboard}
                    >
                      <Text style={styles.btnText}>Enter Portal</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
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
  cardTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  mutedText: { color: "#6b7280" },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtn: { backgroundColor: "#0b7fab", width: "100%" },
  btnText: { color: "#fff", fontWeight: "700" },
  btnLabel: { fontWeight: "600" },
  modalFull: { flex: 1, padding: 30 },
  bordercard: { flex: 1, maxWidth: 500, alignSelf: "center", width: "100%" },
  progressHeader: { marginBottom: 30 },
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
  line: { width: 60, height: 2, backgroundColor: "#e5e7eb" },
  activeLine: { backgroundColor: "#0b7fab" },
  stepContent: { flex: 1, marginTop: 20 },
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
