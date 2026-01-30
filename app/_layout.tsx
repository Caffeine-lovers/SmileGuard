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

// Mocking PatientDashboard since it's an external file
// In your real project, update _patientDashboard.tsx to use these new fields.
const PatientDashboard = ({ user, onLogout }: any) => (
  <SafeAreaView style={styles.container}>
    <View style={styles.nav}>
      <Text style={styles.logo}>DentaApp EDR</Text>
      <TouchableOpacity onPress={onLogout}>
        <Text>Logout</Text>
      </TouchableOpacity>
    </View>
    <ScrollView style={{ padding: 20 }}>
      <Text style={styles.h2}>Welcome, {user.name}</Text>

      {/* Objective 2: Edge-based AI Diagnostic Section */}
      <View
        style={[
          styles.card,
          { width: "100%", backgroundColor: "#f0fdf4", marginBottom: 20 },
        ]}
      >
        <Text style={styles.cardTitle}>🔍 AI Diagnostic Insights (Edge)</Text>
        <Text style={styles.mutedText}>
          Rule-based overlays active. 3 anomalies detected in latest X-ray.
        </Text>
        <TouchableOpacity
          style={[styles.outlineBtn, { marginTop: 10, borderColor: "#16a34a" }]}
        >
          <Text style={{ color: "#16a34a" }}>View Explainable Overlays</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Treatment Records</Text>
        <Text style={styles.mutedText}>
          Source of Truth: Syncing with Web...
        </Text>
        <View
          style={{
            marginTop: 10,
            borderTopWidth: 1,
            borderColor: "#eee",
            paddingTop: 10,
          }}
        >
          <Text>• Last Visit: Routine Cleaning (Jan 15)</Text>
          <Text>• Balance: $0.00</Text>
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>
);

const { width } = Dimensions.get("window");

export default function App() {
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [step, setStep] = useState(1); // 1: Booking/Intake, 2: Security, 3: Success
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{
    name: string;
    demographics: object;
  } | null>(null);

  // Objective 3: Expanded form data for redundant data reduction
  const [formData, setFormData] = useState({
    service: "",
    name: "",
    email: "",
    phone: "",
    dob: "",
    insuranceId: "",
    password: "",
    docsUploaded: false,
  });

  const handleNext = () => setStep((s) => s + 1);

  const handleFinalize = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLoading(false);
    setStep(3);
  };

  const enterDashboard = () => {
    setUser({
      name: formData.name || "Patient",
      demographics: { phone: formData.phone, dob: formData.dob },
    });
    setShowEnrollment(false);
  };

  if (user) {
    return <PatientDashboard user={user} onLogout={() => setUser(null)} />;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView stickyHeaderIndices={[0]}>
          <View style={styles.nav}>
            <Text style={styles.logo}>DentaApp</Text>
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => setShowEnrollment(true)}
            >
              <Text style={styles.btnLabel}>Portal Login</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroContent}>
              <Text style={styles.h1}>
                Your Dental Health,{"\n"}Centralized.
              </Text>
              <Text style={styles.p}>
                Edge-AI diagnostics and secure electronic records in one
                synchronized platform.
              </Text>
              <TouchableOpacity
                style={[styles.btn, styles.primaryBtn]}
                onPress={() => {
                  setStep(1);
                  setShowEnrollment(true);
                }}
              >
                <Text style={styles.btnText}>Start Pre-Visit Intake</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.featuresSection}>
            <Text style={styles.h2}>System Capabilities</Text>
            <View style={styles.featuresGrid}>
              <FeatureCard
                title="Centralized EDR"
                desc="Web/Android synchronized records."
              />
              <FeatureCard
                title="Edge AI"
                desc="Explainable diagnostic overlays."
              />
              <FeatureCard
                title="Secure Intake"
                desc="Reduce front-desk manual entry."
              />
            </View>
          </View>
        </ScrollView>

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
                <View style={styles.labelRow}>
                  <Text style={styles.stepLabel}>Intake</Text>
                  <Text style={styles.stepLabel}>Security</Text>
                  <Text style={styles.stepLabel}>Verified</Text>
                </View>
              </View>

              <ScrollView style={styles.stepContent}>
                {step === 1 && (
                  <View>
                    <Text style={styles.h2}>Secure Intake Form</Text>
                    <Text
                      style={[
                        styles.mutedText,
                        { marginBottom: 15, textAlign: "center" },
                      ]}
                    >
                      Complete this to reduce your waiting time by 45%.
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      onChangeText={(t) =>
                        setFormData({ ...formData, name: t })
                      }
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Date of Birth (MM/DD/YYYY)"
                      onChangeText={(t) => setFormData({ ...formData, dob: t })}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Insurance ID (Optional)"
                      onChangeText={(t) =>
                        setFormData({ ...formData, insuranceId: t })
                      }
                    />

                    <Text style={{ fontWeight: "bold", marginVertical: 10 }}>
                      Select Service
                    </Text>
                    {["Cleaning", "Extraction", "AI-Checkup"].map((s) => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => setFormData({ ...formData, service: s })}
                        style={styles.radioRow}
                      >
                        <View
                          style={[
                            styles.radio,
                            formData.service === s && styles.radioActive,
                          ]}
                        />
                        <Text>{s}</Text>
                      </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn, { marginTop: 20 }]}
                      onPress={handleNext}
                    >
                      <Text style={styles.btnText}>Continue to Security</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {step === 2 && (
                  <View>
                    <Text style={styles.h2}>Portal Security</Text>
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

                    {/* Objective 3: Document Upload Simulation */}
                    <TouchableOpacity
                      style={[
                        styles.outlineBtn,
                        {
                          borderStyle: "dashed",
                          padding: 20,
                          marginBottom: 20,
                        },
                      ]}
                      onPress={() =>
                        setFormData({ ...formData, docsUploaded: true })
                      }
                    >
                      <Text style={{ textAlign: "center" }}>
                        {formData.docsUploaded
                          ? "✅ ID Document Attached"
                          : "📁 Upload Photo ID / Insurance Card"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn]}
                      onPress={handleFinalize}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.btnText}>Complete Enrollment</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {step === 3 && (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 50 }}>✅</Text>
                    <Text style={styles.h2}>Intake Complete!</Text>
                    <Text style={styles.p}>
                      Your data is synchronized. Your provider can now access
                      your edge-enhanced images.
                    </Text>
                    <TouchableOpacity
                      style={[styles.btn, styles.primaryBtn]}
                      onPress={enterDashboard}
                    >
                      <Text style={styles.btnText}>Open Patient Portal</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>

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

// Sub-components and updated styles
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
  logo: { fontSize: 22, fontWeight: "800", color: "#0b7fab" },
  outlineBtn: {
    borderWidth: 1,
    borderColor: "#333",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  hero: { padding: 40, backgroundColor: "#f0f9ff", alignItems: "center" },
  heroContent: { maxWidth: 600, alignItems: "center" },
  h1: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  p: { fontSize: 16, color: "#4b5563", textAlign: "center", marginBottom: 30 },
  featuresSection: { padding: 40 },
  featuresGrid: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 20,
    justifyContent: "center",
  },
  h2: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    width: Platform.OS === "web" ? 250 : "100%",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  mutedText: { color: "#6b7280", fontSize: 14 },
  btn: { paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  primaryBtn: { backgroundColor: "#0b7fab", width: "100%" },
  btnText: { color: "#fff", fontWeight: "700" },
  btnLabel: { fontWeight: "600" },
  modalFull: { flex: 1, padding: 20 },
  bordercard: { flex: 1, maxWidth: 600, width: "100%", alignSelf: "center" },
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
  dotText: { color: "#fff", fontWeight: "bold" },
  line: { width: 50, height: 2, backgroundColor: "#e5e7eb" },
  activeLine: { backgroundColor: "#0b7fab" },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  stepLabel: { fontSize: 10, color: "#9ca3af", width: 60, textAlign: "center" },
  stepContent: { flex: 1, paddingVertical: 10 },
  input: {
    backgroundColor: "#f3f4f6",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  radioRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#0b7fab",
    marginRight: 10,
  },
  radioActive: { backgroundColor: "#0b7fab" },
  closeBtn: { alignItems: "center", padding: 20 },
});
