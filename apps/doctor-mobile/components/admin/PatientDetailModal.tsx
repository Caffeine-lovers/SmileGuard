import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Mail, ShieldAlert } from "lucide-react-native";
import { AdminPatientRow, PatientOverview, getPatientOverview } from "../../lib/adminService";
import { formatAppointmentDate, formatAppointmentTime } from "../../lib/dateFormatters";

interface PatientDetailModalProps {
  patient: AdminPatientRow | null;
  onClose: () => void;
}

export default function PatientDetailModal({ patient, onClose }: PatientDetailModalProps) {
  const [overview, setOverview] = useState<PatientOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const patientId = patient?.id;

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    setOverview(null);
    setError(null);
    getPatientOverview(patientId)
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this patient.");
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  const stats = overview
    ? [
        { label: "Appointments", value: String(overview.appointmentCount) },
        { label: "Bills", value: String(overview.billingCount) },
        { label: "Unpaid", value: String(overview.unpaidBillingCount) },
        { label: "Documents", value: String(overview.documentCount) },
        { label: "AI Scans", value: String(overview.scanCount) },
        { label: "Medical Intake", value: overview.hasMedicalIntake ? "Done" : "None" },
      ]
    : [];

  return (
    <Modal visible={!!patient} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} accessibilityLabel="Back">
            <ChevronLeft size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.name} numberOfLines={1}>{patient?.name || "Anonymous Patient"}</Text>
            {patient?.email ? (
              <View style={styles.emailRow}>
                <Mail size={11} color="#64748B" />
                <Text style={styles.email} numberOfLines={1}>{patient.email}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {error ? (
            <View style={styles.centerBlock}>
              <ShieldAlert size={32} color="#DC2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : !overview ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="large" color="#047857" />
            </View>
          ) : (
            <>
              <View style={styles.statGrid}>
                {stats.map((stat) => (
                  <View key={stat.label} style={styles.statCard}>
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Recent Appointments</Text>
              {overview.appointments.length === 0 ? (
                <Text style={styles.emptyText}>None</Text>
              ) : (
                overview.appointments.map((appointment) => (
                  <View key={appointment.id} style={styles.row}>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{appointment.service || "Appointment"}</Text>
                      <Text style={styles.rowSub}>
                        {[formatAppointmentDate(appointment.appointment_date || ""), formatAppointmentTime(appointment.appointment_time || undefined)].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Text style={styles.rowStatus}>{(appointment.status || "").replace("_", " ").toUpperCase()}</Text>
                  </View>
                ))
              )}

              <Text style={styles.sectionTitle}>Feedback</Text>
              {overview.feedback.length === 0 ? (
                <Text style={styles.emptyText}>None</Text>
              ) : (
                overview.feedback.map((item) => (
                  <View key={item.id} style={styles.row}>
                    <View style={styles.rowInfo}>
                      <Text style={styles.rowTitle}>{item.subject || "No Subject"}</Text>
                      <Text style={styles.rowSub}>
                        {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    </View>
                    <Text style={styles.rowStatus}>{item.status.replace("_", " ").toUpperCase()}</Text>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  email: {
    flex: 1,
    fontSize: 12,
    color: "#64748B",
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  centerBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 10,
  },
  errorText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  statCard: {
    width: "48.5%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 18,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 12,
    color: "#94A3B8",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 11,
    marginBottom: 8,
  },
  rowInfo: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  rowSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  rowStatus: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#047857",
  },
});
