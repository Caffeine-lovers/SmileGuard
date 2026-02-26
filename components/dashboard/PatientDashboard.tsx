import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CurrentUser, Appointment as DbAppointment } from "../../types";
import { Appointment } from "../../lib/database.ts";
import BookAppointment from "../appointments/BookAppointment.tsx";
import BillingPayment from "../billing/BillingPayment.tsx";

interface PatientDashboardProps {
  user: CurrentUser;
  onLogout: () => void;
}

export default function PatientDashboard({ user, onLogout }: PatientDashboardProps) {
  // State for Objective 2: Explainable AI Overlay
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  
  // Modal states
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);

  const appointments: DbAppointment[] = [
    { id: "1", service: "Checkup", date: "Mar 15, 2026", status: "Pending" },
    { id: "2", service: "Cleaning", date: "Jan 20, 2026", status: "Completed" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Welcome Back, {user.name}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Upcoming Appointment Card */}
        <View style={styles.highlightCard}>
          <Text style={styles.cardLabel}>Upcoming Appointment</Text>
          <Text style={styles.cardMain}>Mar 15, 2026 at 10:00 AM</Text>
          <Text style={styles.cardSub}>General Dental Checkup</Text>
        </View>

        {/* --- OBJECTIVE 2: EDGE-BASED DIAGNOSTIC AID SECTION --- */}
        <Text style={styles.sectionTitle}>Edge-AI Diagnostics</Text>
        <View style={styles.diagnosticCard}>
          <Text style={styles.aptService}>Intra-oral Scan: Q3 Molar</Text>
          <Text style={styles.aptDate}>Processed locally via Edge-Node</Text>

          <View style={styles.imageContainer}>
            {/* Base Image (Simulated Raw X-ray) */}
            <View
              style={[styles.imagePlaceholder, { backgroundColor: "#333" }]}
            >
              <Text style={{ color: "#fff", fontSize: 10 }}>
                RAW RADIOGRAPH
              </Text>
            </View>

            {/* Explainable Overlay (Triggered by showAiAnalysis) */}
            {showAiAnalysis && (
              <View style={styles.overlayLayer}>
                {/* This represents the Python CM Luminosity output */}
                <View style={styles.anomalyHighlight} />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.aiToggle, showAiAnalysis && styles.aiToggleActive]}
            onPress={() => setShowAiAnalysis(!showAiAnalysis)}
          >
            <Text style={styles.aiToggleText}>
              {showAiAnalysis
                ? "Disable AI Insights"
                : "Run Luminosity Analysis"}
            </Text>
          </TouchableOpacity>

          {showAiAnalysis && (
            <View style={styles.explanationBox}>
              <Text style={styles.explanationTitle}>
                🔍 Explainable AI Report:
              </Text>
              <Text style={styles.explanationBody}>
                Anomalies detected in lower-left region. Luminosity levels
                dropped by
                <Text style={{ fontWeight: "bold" }}> 32% </Text>
                relative to healthy enamel (Rule-based detection).
              </Text>
            </View>
          )}
        </View>
        {/* ----------------------------------------------------- */}

        <Text style={styles.sectionTitle}>Your Activity</Text>
        {appointments.map((item) => (
          <View key={item.id} style={styles.aptRow}>
            <View>
              <Text style={styles.aptService}>{item.service}</Text>
              <Text style={styles.aptDate}>{item.date}</Text>
            </View>
            <View
              style={[
                styles.badge,
                item.status === "Completed"
                  ? styles.bgSuccess
                  : styles.bgPending,
              ]}
            >
              <Text style={styles.badgeText}>{item.status}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Quick Action Buttons */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={() => setShowBookingModal(true)}
        >
          <Text style={styles.quickActionIcon}>📅</Text>
          <Text style={styles.quickActionText}>Book</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={() => setShowBillingModal(true)}
        >
          <Text style={styles.quickActionIcon}>💳</Text>
          <Text style={styles.quickActionText}>Pay</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionBtn}
          onPress={() => Alert.alert("Medical Records", "View your treatment history")}
        >
          <Text style={styles.quickActionIcon}>📋</Text>
          <Text style={styles.quickActionText}>Records</Text>
        </TouchableOpacity>
      </View>

      {/* Booking Modal */}
      <Modal visible={showBookingModal} animationType="slide">
        <BookAppointment
          patientId={user.email}
          dentistId={undefined}
          onSuccess={() => setShowBookingModal(false)}
          onCancel={() => setShowBookingModal(false)}
        />
      </Modal>

      {/* Billing Modal */}
      <Modal visible={showBillingModal} animationType="slide">
        <BillingPayment
          patientId={user.email}
          baseAmount={300}
          onSuccess={() => setShowBillingModal(false)}
          onCancel={() => setShowBillingModal(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 25,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  welcome: { fontSize: 14, color: "#6b7280" },
  userName: { fontSize: 22, fontWeight: "bold" },
  logoutBtn: { padding: 8 },
  logoutText: { color: "#ef4444", fontWeight: "bold" },
  content: { padding: 20 },
  highlightCard: {
    backgroundColor: "#0b7fab",
    padding: 25,
    borderRadius: 20,
    marginBottom: 30,
  },
  cardLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 5 },
  cardMain: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  cardSub: { color: "#fff", fontSize: 14, marginTop: 5 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 15 },

  // DIAGNOSTIC STYLES
  diagnosticCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  imageContainer: {
    width: "100%",
    height: 180,
    backgroundColor: "#000",
    borderRadius: 8,
    marginVertical: 12,
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  anomalyHighlight: {
    width: 60,
    height: 40,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#ef4444",
    backgroundColor: "rgba(239, 68, 68, 0.3)",
    position: "absolute",
    top: 50,
    left: 40,
  },
  aiToggle: {
    backgroundColor: "#6366f1",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  aiToggleActive: {
    backgroundColor: "#4338ca",
  },
  aiToggleText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  explanationBox: {
    marginTop: 15,
    padding: 12,
    backgroundColor: "#f5f3ff",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#6366f1",
  },
  explanationTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#4338ca",
    marginBottom: 4,
  },
  explanationBody: {
    fontSize: 12,
    color: "#4b5563",
    lineHeight: 18,
  },

  aptRow: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  aptService: { fontSize: 16, fontWeight: "600" },
  aptDate: { fontSize: 13, color: "#6b7280" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  bgSuccess: { backgroundColor: "#dcfce7" },
  bgPending: { backgroundColor: "#fef9c3" },
  badgeText: { fontSize: 11, fontWeight: "bold" },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#0b7fab",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  fabText: { color: "#fff", fontSize: 30 },
  
  // Quick Actions
  quickActions: {
    position: "absolute",
    bottom: 30,
    right: 30,
    flexDirection: "row",
    gap: 10,
  },
  quickActionBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#0b7fab",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  quickActionIcon: {
    fontSize: 20,
  },
  quickActionText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 2,
  },
});
