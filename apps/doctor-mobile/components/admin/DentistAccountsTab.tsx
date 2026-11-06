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
import { Stethoscope, Trash2, BadgeCheck, Users, ShieldAlert } from "lucide-react-native";
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
      "Remove Staff Account",
      `Permanently delete ${fullName}'s ${doctor.role === "assistant" ? "assistant" : "dentist"} account from the clinic system?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove Account",
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
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#047857"]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.sectionTitle}>Clinicians & Assistants</Text>
            <Text style={styles.sectionSubtitle}>
              {doctors.length} {doctors.length === 1 ? "staff member" : "staff members"} registered
            </Text>
          </View>
        </View>

        {doctors.length === 0 ? (
          <View style={styles.emptyCard}>
            <Stethoscope size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Clinicians Found</Text>
            <Text style={styles.emptySub}>When doctors or assistants sign in using an access code, they appear here.</Text>
          </View>
        ) : (
          doctors.map((doctor) => {
            const fullName = [doctor.first_name, doctor.middle_name, doctor.last_name].filter(Boolean).join(" ") || "Unnamed Staff";
            const isAssistant = doctor.role === "assistant";
            return (
              <View key={doctor.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.avatarBox, isAssistant && styles.avatarBoxAssistant]}>
                    {isAssistant ? (
                      <Users size={17} color="#2563EB" />
                    ) : (
                      <Stethoscope size={17} color="#047857" />
                    )}
                  </View>

                  <View style={styles.doctorInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.doctorName}>{fullName}</Text>
                      {doctor.is_verified && (
                        <BadgeCheck size={16} color="#047857" />
                      )}
                    </View>
                    <Text style={styles.doctorSpecialty}>
                      {isAssistant ? "Clinic Assistant" : doctor.specialization || "General Dentistry"}
                      {doctor.license_number ? ` · PRC #${doctor.license_number}` : ""}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteIconBtn}
                    onPress={() => handleDelete(doctor)}
                    activeOpacity={0.7}
                    accessibilityLabel="Delete practitioner"
                  >
                    <Trash2 size={15} color="#DC2626" />
                  </TouchableOpacity>
                </View>

                {/* Verification Control Row */}
                <View style={styles.verificationRow}>
                  <View style={styles.verifyTextWrap}>
                    <Text style={styles.verifyLabel}>Verified Medical License</Text>
                    <Text style={styles.verifySub}>
                      {doctor.is_verified ? "Accredited practitioner" : "Pending admin validation"}
                    </Text>
                  </View>
                  <Switch
                    value={Boolean(doctor.is_verified)}
                    onValueChange={() => handleToggleVerified(doctor)}
                    trackColor={{ false: "#E2E8F0", true: "#A7F3D0" }}
                    thumbColor={doctor.is_verified ? "#047857" : "#94A3B8"}
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  centerFill: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  headerBar: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  emptySub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBoxAssistant: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  doctorInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  doctorName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  doctorSpecialty: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2,
  },
  deleteIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  verificationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  verifyTextWrap: {
    flex: 1,
  },
  verifyLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  verifySub: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 1,
  },
});
