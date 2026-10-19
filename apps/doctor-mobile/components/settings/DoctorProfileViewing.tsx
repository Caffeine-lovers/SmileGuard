import { Doctor } from "@smileguard/shared-types";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { X } from "lucide-react-native";
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>‍️ Doctor Profile</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {onClose && (
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
            >
              <X size={20} color="#047857" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => setIsEditing(true)}
          >
            <Text style={styles.editBtnText}> Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        {/* Profile Picture */}
        <View style={styles.profileImageContainer}>
          {doctor.profile_picture_url ? (
            <Image
              source={{ uri: doctor.profile_picture_url }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Image
                source={require("../../assets/images/user.png")}
                style={styles.profileImagePlaceholderIcon}
              />
            </View>
          )}
        </View>

        {/* Basic Info */}
        <View style={styles.basicInfo}>
          <Text style={styles.doctorName}>{doctor.doctor_name || "N/A"}</Text>
          <Text style={styles.specialization}>
            {doctor.specialization || "Specialization: N/A"}
          </Text>
          <Text style={styles.subtext}>
            {doctor.years_of_experience || 0} {doctor.years_of_experience === 1 ? "year" : "years"} of experience
          </Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* License & Credentials Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}> License & Credentials</Text>

          <View style={styles.infoRow}>
            <Text style={styles.label}>License Number:</Text>
            <Text style={styles.value}>{doctor.license_number || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Specialization:</Text>
            <Text style={styles.value}>{doctor.specialization || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Years of Experience:</Text>
            <Text style={styles.value}>
              {doctor.years_of_experience || 0} {doctor.years_of_experience === 1 ? "year" : "years"}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Doctor Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}> Doctor Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Name:</Text>
            <Text style={styles.value}>{doctor.doctor_name || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Phone:</Text>
            <Text style={styles.value}>{doctor.doctor_phone || "N/A"}</Text>
          </View>

          {doctor.bio && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Bio:</Text>
              <Text style={styles.value}>{doctor.bio}</Text>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />



        {/* Additional Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>️ Additional Information</Text>

          {doctor.created_at && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Profile Created:</Text>
              <Text style={styles.value}>
                {new Date(doctor.created_at).toLocaleDateString()}
              </Text>
            </View>
          )}

          {doctor.updated_at && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Last Updated:</Text>
              <Text style={styles.value}>
                {new Date(doctor.updated_at).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomColor: "#ddd",
    borderBottomWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#047857",
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#10B981",
    borderRadius: 6,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f0f0f0",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#666",
  },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderColor: "#CBD5E1",
    borderWidth: 1.5,
  },
  profileImageContainer: {
    alignSelf: "center",
    marginBottom: 12,
    position: "relative",
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: "center",
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  profileImagePlaceholderIcon: {
    width: 60,
    height: 60,
    resizeMode: "contain",
  },
  basicInfo: {
    alignItems: "center",
    marginBottom: 16,
  },
  doctorName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  specialization: {
    fontSize: 14,
    fontWeight: "600",
    color: "#047857",
    marginBottom: 4,
  },
  subtext: {
    fontSize: 12,
    color: "#6b7280",
  },
  divider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 12,
  },
  section: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#047857",
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6b7280",
    flex: 1,
  },
  value: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1f2937",
    flex: 1,
    textAlign: "right",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#ECFDF5",
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
