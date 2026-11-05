import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
} from "react-native";
import { Stethoscope, Trash2, BadgeCheck } from "lucide-react-native";
import { AdminDoctorRow, listDentists, setDoctorVerified, deleteDoctorAccount } from "../../lib/adminService";

export default function DentistAccountsTab() {
  const [doctors, setDoctors] = useState<AdminDoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDoctors = useCallback(async () => {
    const data = await listDentists();
    setDoctors(data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchDoctors();
      setLoading(false);
    })();
  }, [fetchDoctors]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDoctors();
    setRefreshing(false);
  };

  const handleToggleVerified = async (doctor: AdminDoctorRow) => {
    const ok = await setDoctorVerified(doctor.id, !doctor.is_verified);
    if (ok) await fetchDoctors();
  };

  const handleDelete = (doctor: AdminDoctorRow) => {
    const fullName = [doctor.first_name, doctor.last_name].filter(Boolean).join(" ") || "this account";
    Alert.alert(
      "Delete Account",
      `Permanently delete ${fullName}'s ${doctor.role === "assistant" ? "assistant" : "dentist"} account? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const ok = await deleteDoctorAccount(doctor.id, doctor.user_id);
            if (ok) await fetchDoctors();
            else Alert.alert("Error", "Failed to delete account.");
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      <Text style={styles.sectionLabel}>DENTIST & ASSISTANT ACCOUNTS ({doctors.length})</Text>

      {doctors.length === 0 ? (
        <Text style={styles.emptyText}>No dentist or assistant accounts yet.</Text>
      ) : (
        doctors.map((doctor) => {
          const fullName = [doctor.first_name, doctor.middle_name, doctor.last_name].filter(Boolean).join(" ") || "Unnamed";
          return (
            <View key={doctor.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.iconBox}>
                  <Stethoscope size={16} color="#047857" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{fullName}</Text>
                  <Text style={styles.cardSubtitle}>
                    {doctor.role === "assistant" ? "Clinic Assistant" : doctor.specialization || "Dentist"}
                    {doctor.license_number ? ` · Lic. ${doctor.license_number}` : ""}
                  </Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <View style={styles.verifyRow}>
                  <BadgeCheck size={14} color={doctor.is_verified ? "#047857" : "#94A3B8"} />
                  <Text style={styles.verifyLabel}>Verified</Text>
                  <Switch
                    value={!!doctor.is_verified}
                    onValueChange={() => handleToggleVerified(doctor)}
                    trackColor={{ false: "#E2E8F0", true: "#A7F3D0" }}
                    thumbColor={doctor.is_verified ? "#047857" : "#94A3B8"}
                  />
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(doctor)}
                  activeOpacity={0.75}
                >
                  <Trash2 size={14} color="#B91C1C" />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centerFill: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: "#64748B", letterSpacing: 0.6, marginBottom: 12 },
  emptyText: { textAlign: "center", color: "#94A3B8", marginTop: 32, fontSize: 13 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    padding: 12,
    marginBottom: 10,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  cardSubtitle: { fontSize: 11, color: "#64748B", marginTop: 2 },
  actionsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  verifyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  verifyLabel: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  deleteBtnText: { fontSize: 12, fontWeight: "700", color: "#B91C1C" },
});
