import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Building2, CalendarDays, LifeBuoy, MapPin, Pencil, ShieldAlert, Stethoscope, UserPlus, Users } from "lucide-react-native";
import ClinicSetup from "../settings/ClinicSetup";
import { ClinicOverview, getClinicOverview } from "../../lib/adminService";
import type { AdminTab } from "./AdminTourModal";

interface ClinicOverviewTabProps {
  onOpenTab: (tab: AdminTab) => void;
}

export default function ClinicOverviewTab({ onOpenTab }: ClinicOverviewTabProps) {
  const [overview, setOverview] = useState<ClinicOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const fetchOverview = useCallback(async () => {
    try {
      setOverview(await getClinicOverview());
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load the clinic.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchOverview();
      setLoading(false);
    })();
  }, [fetchOverview]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOverview();
    setRefreshing(false);
  };

  const handleCloseEditor = () => {
    setEditing(false);
    fetchOverview();
  };

  if (loading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  const clinic = overview?.clinic;
  const serviceCount = Array.isArray(clinic?.services) ? clinic.services.length : 0;
  const stats: { label: string; value: number; icon: any; tab?: AdminTab }[] = overview
    ? [
        { label: "Staff", value: overview.staffCount, icon: Stethoscope, tab: "dentists" },
        { label: "Patients", value: overview.patientCount, icon: Users, tab: "patients" },
        { label: "Walk-ins", value: overview.walkInCount, icon: UserPlus },
        { label: "Upcoming", value: overview.upcomingAppointments, icon: CalendarDays },
        { label: "Appointments", value: overview.totalAppointments, icon: CalendarDays },
        { label: "Open Feedback", value: overview.openFeedback, icon: LifeBuoy, tab: "support" },
      ]
    : [];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={["#047857"]} />}
        showsVerticalScrollIndicator={false}
      >
        {loadError ? (
          <View style={styles.emptyCard}>
            <ShieldAlert size={32} color="#DC2626" />
            <Text style={styles.emptyTitle}>Couldn't Load the Clinic</Text>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : (
          <>
            <View style={styles.clinicCard}>
              <View style={styles.clinicHeader}>
                {clinic?.logo_url ? (
                  <Image source={{ uri: clinic.logo_url }} style={styles.logo} />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Building2 size={24} color="#047857" />
                  </View>
                )}
                <View style={styles.clinicInfo}>
                  <Text style={styles.clinicName}>{clinic?.clinic_name || "Clinic not set up"}</Text>
                  {clinic?.address ? (
                    <View style={styles.addressRow}>
                      <MapPin size={12} color="#64748B" />
                      <Text style={styles.addressText}>{clinic.address}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.serviceText}>
                    {serviceCount} {serviceCount === 1 ? "service" : "services"}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={styles.editBtn} onPress={() => setEditing(true)} activeOpacity={0.8}>
                <Pencil size={14} color="#FFFFFF" />
                <Text style={styles.editBtnText}>Edit Clinic</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statGrid}>
              {stats.map((stat) => {
                const StatIcon = stat.icon;
                const tab = stat.tab;
                return (
                  <TouchableOpacity
                    key={stat.label}
                    style={styles.statCard}
                    disabled={!tab}
                    onPress={() => tab && onOpenTab(tab)}
                    activeOpacity={0.8}
                  >
                    <StatIcon size={16} color="#047857" />
                    <Text style={styles.statValue}>{stat.value}</Text>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={editing} animationType="slide" onRequestClose={handleCloseEditor}>
        <SafeAreaView style={styles.editorSafeArea}>
          <ClinicSetup onSave={handleCloseEditor} onClose={handleCloseEditor} initialMode="edit" />
        </SafeAreaView>
      </Modal>
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
  errorText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },
  clinicCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 12,
  },
  clinicHeader: {
    flexDirection: "row",
    gap: 12,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  clinicInfo: {
    flex: 1,
    gap: 3,
  },
  clinicName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: "#64748B",
  },
  serviceText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#047857",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#047857",
    borderRadius: 9,
    paddingVertical: 10,
    marginTop: 12,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
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
    gap: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
  },
  statLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748B",
  },
  editorSafeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
});
