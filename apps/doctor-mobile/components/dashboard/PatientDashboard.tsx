import React, { useState, useEffect } from "react";
import {
  Alert, ScrollView, StyleSheet, Text,
  TouchableOpacity, View, Modal, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CurrentUser } from "@smileguard/shared-types";
import { getAppointments, Appointment } from "../../lib/database.ts";
import BookAppointment from "../appointments/BookAppointment.tsx";
import BillingPayment from "../billing/BillingPayment.tsx";

interface PatientDashboardProps {
  user: CurrentUser;
  onLogout: () => void;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function badgeStyle(status: string) {
  switch (status) {
    case "completed":  return styles.bgSuccess;
    case "cancelled":
    case "no-show":    return styles.bgCancelled;
    case "approved":   return styles.bgApproved;
    default:            return styles.bgPending;
  }
}

function badgeLabel(status: string): string {
  switch (status) {
    case "scheduled":  return "Pending";
    case "completed":  return "Completed";
    case "cancelled":  return "Cancelled";
    case "no-show":    return "No Show";
    case "approved":   return "Approved";
    default:            return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export default function PatientDashboard({ user, onLogout }: PatientDashboardProps) {
  const [showAiAnalysis, setShowAiAnalysis]     = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [appointments, setAppointments]         = useState<Appointment[]>([]);
  const [loadingApts, setLoadingApts]           = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    setLoadingApts(true);
    try {
      const data = await getAppointments();
      const mine = data
        .filter((a) => a.patient_id === user.id)
        .sort((a, b) =>
          b.appointment_date.localeCompare(a.appointment_date) ||
          b.appointment_time.localeCompare(a.appointment_time)
        );
      setAppointments(mine);
    } catch (err) {
      console.error("Error fetching appointments:", err);
    } finally {
      setLoadingApts(false);
    }
  };

  const handleBookingSuccess = (newAppointment: Appointment) => {
    setShowBookingModal(false);
    if (newAppointment?.appointment_date) {
      // Prepend immediately — no re-fetch needed
      setAppointments((prev) =>
        [newAppointment, ...prev].sort((a, b) =>
          b.appointment_date.localeCompare(a.appointment_date) ||
          b.appointment_time.localeCompare(a.appointment_time)
        )
      );
    } else {
      // Offline save — full object not returned, re-fetch
      fetchAppointments();
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const upcoming = appointments.find(
    (a) => a.status === "scheduled" && a.appointment_date >= today
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Welcome Back, {user.name}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

        {/* Upcoming Appointment — live */}
        <View style={styles.highlightCard}>
          <Text style={styles.cardLabel}>Upcoming Appointment</Text>
          {upcoming ? (
            <>
              <Text style={styles.cardMain}>
                {formatDate(upcoming.appointment_date)} at {formatTime(upcoming.appointment_time)}
              </Text>
              <Text style={styles.cardSub}>{upcoming.service}</Text>
            </>
          ) : (
            <>
              <Text style={styles.cardMain}>No upcoming appointments</Text>
              <Text style={styles.cardSub}>Tap Book below to schedule one</Text>
            </>
          )}
        </View>

        {/* Edge-AI Diagnostics */}
        <Text style={styles.sectionTitle}>Edge-AI Diagnostics</Text>
        <View style={styles.diagnosticCard}>
          <Text style={styles.aptService}>Intra-oral Scan: Q3 Molar</Text>
          <Text style={styles.aptDate}>Processed locally via Edge-Node</Text>
          <View style={styles.imageContainer}>
            <View style={[styles.imagePlaceholder, { backgroundColor: "#333" }]}>
              <Text style={{ color: "#fff", fontSize: 10 }}>RAW RADIOGRAPH</Text>
            </View>
            {showAiAnalysis && (
              <View style={styles.overlayLayer}>
                <View style={styles.anomalyHighlight} />
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.aiToggle, showAiAnalysis && styles.aiToggleActive]}
            onPress={() => setShowAiAnalysis(!showAiAnalysis)}
          >
            <Text style={styles.aiToggleText}>
              {showAiAnalysis ? "Disable AI Insights" : "Run Luminosity Analysis"}
            </Text>
          </TouchableOpacity>
          {showAiAnalysis && (
            <View style={styles.explanationBox}>
              <Text style={styles.explanationTitle}>🔍 Explainable AI Report:</Text>
              <Text style={styles.explanationBody}>
                Anomalies detected in lower-left region. Luminosity levels dropped by
                <Text style={{ fontWeight: "bold" }}> 32% </Text>
                relative to healthy enamel (Rule-based detection).
              </Text>
            </View>
          )}
        </View>

        {/* Activity — live from Supabase */}
        <Text style={styles.sectionTitle}>Your Activity</Text>

        {loadingApts ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#0b7fab" />
            <Text style={styles.loadingText}>Loading appointments...</Text>
          </View>
        ) : appointments.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No appointments yet.</Text>
            <Text style={styles.emptySubText}>Book one using the button below.</Text>
          </View>
        ) : (
          appointments.map((item, idx) => (
            <View key={item.id ?? idx} style={styles.aptRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.aptService}>{item.service}</Text>
                <Text style={styles.aptDate}>
                  {formatDate(item.appointment_date)} · {formatTime(item.appointment_time)}
                </Text>
              </View>
              <View style={[styles.badge, badgeStyle(item.status)]}>
                <Text style={styles.badgeText}>{badgeLabel(item.status)}</Text>
              </View>
            </View>
          ))
        )}

      </ScrollView>

      {/* Quick Action Buttons */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowBookingModal(true)}>
          <Text style={styles.quickActionIcon}>📅</Text>
          <Text style={styles.quickActionText}>Book</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => setShowBillingModal(true)}>
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
      <Modal
        visible={showBookingModal}
        animationType="slide"
        onRequestClose={() => setShowBookingModal(false)}
      >
        <BookAppointment
          patientId={user.id}
          dentistId={undefined}
          onSuccess={handleBookingSuccess}
          onCancel={() => setShowBookingModal(false)}
        />
      </Modal>

      {/* Billing Modal */}
      <Modal
        visible={showBillingModal}
        animationType="slide"
        onRequestClose={() => setShowBillingModal(false)}
      >
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
  container:        { flex: 1, backgroundColor: "#f9fafb" },
  header:           { flexDirection: "row", justifyContent: "space-between", padding: 25, backgroundColor: "#fff", alignItems: "center" },
  welcome:          { fontSize: 14, color: "#6b7280" },
  logoutBtn:        { padding: 8 },
  logoutText:       { color: "#ef4444", fontWeight: "bold" },
  content:          { padding: 20, paddingBottom: 120 },
  highlightCard:    { backgroundColor: "#0b7fab", padding: 25, borderRadius: 20, marginBottom: 30 },
  cardLabel:        { color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 5 },
  cardMain:         { color: "#fff", fontSize: 20, fontWeight: "bold" },
  cardSub:          { color: "#fff", fontSize: 14, marginTop: 5 },
  sectionTitle:     { fontSize: 18, fontWeight: "bold", marginBottom: 15 },
  diagnosticCard:   { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 25, borderWidth: 1, borderColor: "#e5e7eb" },
  imageContainer:   { width: "100%", height: 180, backgroundColor: "#000", borderRadius: 8, marginVertical: 12, overflow: "hidden", position: "relative", justifyContent: "center", alignItems: "center" },
  imagePlaceholder: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  overlayLayer:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(99,102,241,0.2)", justifyContent: "center", alignItems: "center" },
  anomalyHighlight: { width: 60, height: 40, borderRadius: 30, borderWidth: 2, borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.3)", position: "absolute", top: 50, left: 40 },
  aiToggle:         { backgroundColor: "#6366f1", padding: 12, borderRadius: 8, alignItems: "center" },
  aiToggleActive:   { backgroundColor: "#4338ca" },
  aiToggleText:     { color: "#fff", fontWeight: "700", fontSize: 14 },
  explanationBox:   { marginTop: 15, padding: 12, backgroundColor: "#f5f3ff", borderRadius: 8, borderLeftWidth: 4, borderLeftColor: "#6366f1" },
  explanationTitle: { fontSize: 13, fontWeight: "bold", color: "#4338ca", marginBottom: 4 },
  explanationBody:  { fontSize: 12, color: "#4b5563", lineHeight: 18 },
  aptRow:           { backgroundColor: "#fff", padding: 16, borderRadius: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderWidth: 1, borderColor: "#f3f4f6" },
  aptService:       { fontSize: 16, fontWeight: "600" },
  aptDate:          { fontSize: 13, color: "#6b7280", marginTop: 2 },
  badge:            { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  bgSuccess:        { backgroundColor: "#dcfce7" },
  bgPending:        { backgroundColor: "#fef9c3" },
  bgCancelled:      { backgroundColor: "#fee2e2" },
  bgApproved:       { backgroundColor: "#dbeafe" },
  badgeText:        { fontSize: 11, fontWeight: "bold" },
  loadingContainer: { flexDirection: "row", alignItems: "center", gap: 10, padding: 20 },
  loadingText:      { fontSize: 14, color: "#6b7280" },
  emptyState:       { alignItems: "center", padding: 30 },
  emptyText:        { fontSize: 15, color: "#6b7280", fontWeight: "600" },
  emptySubText:     { fontSize: 13, color: "#9ca3af", marginTop: 4 },
  quickActions:     { position: "absolute", bottom: 30, right: 30, flexDirection: "row", gap: 10 },
  quickActionBtn:   { width: 60, height: 60, borderRadius: 30, backgroundColor: "#0b7fab", justifyContent: "center", alignItems: "center", elevation: 5 },
  quickActionIcon:  { fontSize: 20 },
  quickActionText:  { color: "#fff", fontSize: 10, fontWeight: "bold", marginTop: 2 },
});