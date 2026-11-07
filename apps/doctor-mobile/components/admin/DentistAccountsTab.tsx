import React, { useCallback, useEffect, useRef, useState } from "react";
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
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { Stethoscope, Trash2, BadgeCheck, Users, ShieldAlert } from "lucide-react-native";
import { AdminDoctorRow, listDentists, setDoctorVerified, deleteDoctorAccount } from "../../lib/adminService";
import {
  AdminPagination,
  AdminCountHeader,
  ADMIN_ITEMS_PER_PAGE,
} from "./AdminPagination";

export default function DentistAccountsTab() {
  const [doctors, setDoctors] = useState<AdminDoctorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const scrollViewRef = useRef<ScrollView>(null);

  const totalPages = Math.max(1, Math.ceil(doctors.length / ADMIN_ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ADMIN_ITEMS_PER_PAGE;
  const paginatedDoctors = doctors.slice(startIndex, startIndex + ADMIN_ITEMS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setCurrentPage(page);
      try {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      } catch (err) {
        // safe fallback
      }
    }
  };

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
    setDoctors((prev) =>
      prev.map((d) => (d.id === doctor.id ? { ...d, is_verified: !d.is_verified } : d))
    );
    const ok = await setDoctorVerified(doctor.id, !doctor.is_verified);
    if (!ok) {
      setDoctors((prev) =>
        prev.map((d) => (d.id === doctor.id ? { ...d, is_verified: doctor.is_verified } : d))
      );
      Alert.alert("Error", "Failed to update verification status.");
    }
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
            setDoctors((prev) => prev.filter((d) => d.id !== doctor.id));
            const ok = await deleteDoctorAccount(doctor.id, doctor.user_id);
            if (!ok) {
              Alert.alert("Error", "Failed to delete account.");
              await fetchDoctors();
            }
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
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#047857"]} />}
        showsVerticalScrollIndicator={false}
      >
        {doctors.length === 0 ? (
          <View style={styles.emptyCard}>
            <Stethoscope size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Staff Registered</Text>
          </View>
        ) : (
          <>
            <AdminCountHeader
              startIndex={startIndex}
              endIndex={Math.min(startIndex + ADMIN_ITEMS_PER_PAGE, doctors.length)}
              totalItems={doctors.length}
              currentPage={currentPage}
              totalPages={totalPages}
              itemLabel="staff members"
            />

            {paginatedDoctors.map((doctor, index) => {
            const fullName = [doctor.first_name, doctor.middle_name, doctor.last_name].filter(Boolean).join(" ") || "Unnamed Staff";
            const isAssistant = doctor.role === "assistant";
            return (
              <Animated.View
                key={doctor.id}
                entering={FadeInDown.duration(220).delay(Math.min(index, 8) * 35)}
                exiting={FadeOut.duration(150)}
                style={styles.card}
              >
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
              </Animated.View>
            );
          })}

          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
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
