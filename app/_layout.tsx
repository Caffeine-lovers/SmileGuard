import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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

// Logic for Firebase would be imported here
// import { db } from './firebaseConfig';
// import { collection, addDoc } from 'firebase/firestore';

export default function App() {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  // 1. FORM STATE
  const [formData, setFormData] = useState({ name: "", phone: "" });

  const handleBooking = async () => {
    if (!formData.name || !formData.phone) {
      alert("Please fill in all details");
      return;
    }

    setLoading(true);
    try {
      // Simulate Firebase Delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Actual Firebase logic:
      // await addDoc(collection(db, "appointments"), { ...formData, date: new Date() });

      alert(`Success! We'll call you soon, ${formData.name}.`);
      setFormData({ name: "", phone: "" });
      setShowForm(false);
    } catch (e) {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView stickyHeaderIndices={[0]}>
          {/* Navigation */}
          <View style={styles.nav}>
            <Text style={styles.logo}>DentaApp</Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => setShowForm(true)}
            >
              <Text style={styles.btnLabel}>Book Now</Text>
            </TouchableOpacity>
          </View>

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.heroContent}>
              <Text style={styles.h1}>Gentle care.{"\n"}Bright smiles.</Text>
              <Text style={styles.p}>
                Modern dental management for patients and clinics.
              </Text>
              <TouchableOpacity
                style={[styles.btn, styles.primaryBtn]}
                onPress={() => setShowForm(true)}
              >
                <Text style={styles.btnText}>Get Started</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Features - Responsive Grid */}
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

        {/* 2. ENHANCED MODAL */}
        <Modal visible={showForm} animationType="fade" transparent={true}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <Text style={styles.h2}>Request Appointment</Text>

              <TextInput
                style={styles.input}
                placeholder="Full Name"
                value={formData.name}
                onChangeText={(t) => setFormData({ ...formData, name: t })}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                keyboardType="phone-pad"
                value={formData.phone}
                onChangeText={(t) => setFormData({ ...formData, phone: t })}
              />

              <TouchableOpacity
                style={[
                  styles.btn,
                  styles.primaryBtn,
                  loading && { opacity: 0.7 },
                ]}
                onPress={handleBooking}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Confirm Booking</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowForm(false)}
                style={styles.cancelLink}
              >
                <Text style={{ color: "#666" }}>Close</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// Reusable Feature Component
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
    ...Platform.select({
      android: { elevation: 4 },
      ios: { shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 10 },
      web: { boxShadow: "0 4px 12px rgba(0,0,0,0.08)" },
    }),
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    color: "#1f2937",
  },
  mutedText: { color: "#6b7280", lineHeight: 20 },

  btn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
  },
  btnLabel: { fontWeight: "600", color: "#333" },
  primaryBtn: { backgroundColor: "#0b7fab" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 32,
    borderRadius: 24,
    width: "90%",
    maxWidth: 400,
  },
  input: {
    backgroundColor: "#f3f4f6",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  cancelLink: { marginTop: 20, alignItems: "center" },
});
