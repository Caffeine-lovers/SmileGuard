import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  X,
  Pencil,
  ShieldCheck,
  Stethoscope,
  Phone,
  Calendar,
  Clock,
  FileText,
  ChevronRight,
  Activity,
} from "lucide-react-native";
import {
  Doctor,
  getDoctorTitleName,
} from "@smileguard/shared-types";
import DoctorProfileEdit from "./DoctorProfileEdit";

interface DoctorProfileViewProps {
  doctor: Doctor;
  onSave: (updatedDoctor: Partial<Doctor>) => Promise<void>;
  onClose?: () => void;
}

export default function DoctorProfileView({
  doctor,
  onSave,
  onClose,
}: DoctorProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isEditing) return;
    const onBackPress = () => {
      setIsEditing(false);
      return true;
    };
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
    return () => subscription.remove();
  }, [isEditing]);

  const handleSave = async (updatedDoctor: Partial<Doctor>) => {
    setLoading(true);
    try {
      await onSave(updatedDoctor);
      setIsEditing(false);
    } finally {
      setLoading(false);
    }
  };

  if (isEditing) {
    return (
      <DoctorProfileEdit
        doctor={doctor}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  const doctorTitle = getDoctorTitleName(doctor) || "Doctor";
  const experienceYears = doctor.years_of_experience || 0;
  const rawDoctorId = doctor.id || doctor.user_id || "";
  const doctorId = rawDoctorId
    ? rawDoctorId.length > 12
      ? `${rawDoctorId.slice(0, 8)}...${rawDoctorId.slice(-4)}`
      : rawDoctorId
    : "Not assigned";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" animated={true} />
      {/* Module Top Header (Clean - No Badge) */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.topHeaderTitle}>DOCTOR PROFILE</Text>
        </View>

        <View style={styles.headerActionsRow}>
          <TouchableOpacity
            style={styles.editHeaderBtn}
            onPress={() => setIsEditing(true)}
            activeOpacity={0.75}
          >
            <Pencil size={13} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.editHeaderBtnText}>Edit</Text>
          </TouchableOpacity>

          {onClose && (
            <TouchableOpacity
              style={styles.closeActionBtn}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Close Profile"
            >
              <X size={17} color="#047857" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Doctor Portfolio Card (Neutral Skeuomorphic) */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerContentRow}>
            <View style={styles.avatarWrapper}>
              {doctor.profile_picture_url ? (
                <Image
                  source={{ uri: doctor.profile_picture_url }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Image
                    source={require("../../assets/images/user.png")}
                    style={styles.avatarPlaceholderIcon}
                  />
                </View>
              )}
            </View>

            <View style={styles.bannerTextCol}>
              <Text style={styles.bannerDoctorTitle} numberOfLines={2}>
                {doctorTitle}
              </Text>
              <View style={styles.bannerSpecialtyPill}>
                <Stethoscope size={11} color="#047857" />
                <Text style={styles.bannerSpecialtyText}>
                  {doctor.specialization || "General Dentistry"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Floating 2-Metric Strip */}
        <View style={styles.statStripCard}>
          <View style={styles.statCol}>
            <Text style={styles.statValue}>
              {experienceYears} {experienceYears === 1 ? "Yr" : "Yrs"}
            </Text>
            <Text style={styles.statLabel}>EXPERIENCE</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCol}>
            <Text style={styles.statValue} numberOfLines={1}>
              {doctor.license_number || "Not on file"}
            </Text>
            <Text style={styles.statLabel}>LICENSE NO.</Text>
          </View>
        </View>

        {/* Direct Contact Card */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>CONTACT INFORMATION</Text>
        </View>

        <View style={styles.contactCard}>
          <View style={styles.contactCardContent}>
            <View style={styles.tileIconBox}>
              <Phone size={16} color="#047857" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactCardLabel}>CONTACT NUMBER</Text>
              <Text style={styles.contactCardValue} numberOfLines={1}>
                {doctor.doctor_phone || "No phone added"}
              </Text>
              <Text style={styles.contactCardSubtext}>Available for patient inquiries & SMS notifications</Text>
            </View>
          </View>
        </View>

        {/* Clinical Statement & Biography Card */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>DOCTOR'S BIOGRAPHY</Text>
        </View>

        <View style={styles.bioCard}>
          <Text style={styles.bioCardBody}>
            {doctor.bio
              ? `"${doctor.bio}"`
              : "No doctor biography provided yet. Tap Edit to add your professional background, dental school, and patient care philosophy."}
          </Text>
          <View style={styles.bioSignoffRow}>
            <View style={styles.bioSignoffLine} />
            <Text style={styles.bioSignoffText}>{doctorTitle}</Text>
          </View>
        </View>

        {/* Registration Audit & System ID Strip */}
        <View style={styles.auditCard}>
          <View style={styles.auditIdRow}>
            <ShieldCheck size={13} color="#047857" />
            <Text style={styles.auditLabel}>Doctor ID:</Text>
            <Text style={styles.auditIdValue} numberOfLines={1} selectable>
              {doctorId}
            </Text>
          </View>

          {(doctor.created_at || doctor.updated_at) && (
            <View style={styles.auditDatesRow}>
              {doctor.created_at && (
                <View style={styles.auditItem}>
                  <Calendar size={12} color="#64748B" />
                  <Text style={styles.auditLabel}>Enrolled:</Text>
                  <Text style={styles.auditValue}>
                    {new Date(doctor.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </View>
              )}

              {doctor.created_at && doctor.updated_at && (
                <View style={styles.auditDot} />
              )}

              {doctor.updated_at && (
                <View style={styles.auditItem}>
                  <Clock size={12} color="#64748B" />
                  <Text style={styles.auditLabel}>Updated:</Text>
                  <Text style={styles.auditValue}>
                    {new Date(doctor.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════
// STYLES: CLINICAL EXECUTIVE PORTFOLIO ARCHETYPE
// ══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },

  // Top Header (Module Standard)
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1.5,
    borderBottomColor: "#E2E8F0",
  },
  headerTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  topHeaderTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.6,
  },
  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#047857",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#064E3B",
    borderBottomWidth: 2.5,
    borderBottomColor: "#022C22",
  },
  editHeaderBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  closeActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },

  // Doctor Portfolio Card (Neutral Skeuomorphic)
  bannerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    padding: 16,
    marginBottom: 12,
  },
  bannerContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#F8FAFC",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderIcon: {
    width: 44,
    height: 44,
    resizeMode: "contain",
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerDoctorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  bannerSpecialtyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9999,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  bannerSpecialtyText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },

  // 3-Metric Floating Strip
  statStripCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "space-around",
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  statCol: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  statValueEmerald: {
    fontSize: 14,
    fontWeight: "800",
    color: "#047857",
  },
  activeLicenseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginTop: 3,
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: "#E2E8F0",
  },

  // Section Header
  sectionHeaderRow: {
    marginBottom: 8,
    paddingLeft: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.6,
  },

  // Contact Card
  contactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    padding: 14,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  contactCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contactCardLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  contactCardValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  contactCardSubtext: {
    fontSize: 10.5,
    color: "#94A3B8",
    fontWeight: "500",
  },
  tileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    justifyContent: "center",
    alignItems: "center",
  },

  // Biography Quote Card
  bioCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    padding: 14,
    marginBottom: 16,
  },
  bioCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  bioQuoteCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
  },
  bioCardTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.3,
  },
  bioCardBody: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 20,
    fontWeight: "500",
    fontStyle: "italic",
  },
  bioSignoffRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    justifyContent: "flex-end",
  },
  bioSignoffLine: {
    width: 20,
    height: 1,
    backgroundColor: "#A7F3D0",
  },
  bioSignoffText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },

  // Audit Strip
  auditCard: {
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 6,
  },
  auditIdRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  auditIdValue: {
    fontSize: 11,
    color: "#0F172A",
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  auditDatesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  auditRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  auditItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  auditLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  auditValue: {
    fontSize: 11,
    color: "#334155",
    fontWeight: "700",
  },
  auditDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#94A3B8",
  },

  // Action Button
  primaryActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#047857",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#064E3B",
    borderBottomWidth: 3,
    borderBottomColor: "#022C22",
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: "#047857",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryActionButtonText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
});
