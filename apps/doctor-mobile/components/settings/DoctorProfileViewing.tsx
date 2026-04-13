import { Doctor } from "@smileguard/shared-types";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { pickImage, uploadProfileImage } from "../../lib/imageUploadService";
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const [tempIsAvailable, setTempIsAvailable] = useState(doctor.is_available);

  const hasAvailabilityChanged = tempIsAvailable !== doctor.is_available;

  const handleChangeProfilePicture = async () => {
    try {
      console.log(' Opening image picker...');
      const selectedImage = await pickImage();

      if (!selectedImage) {
        console.log('User cancelled image picker');
        return;
      }

      Alert.alert(
        "Confirm Picture Change",
        "Do you want to update your profile picture?",
        [
          {
            text: "Cancel",
            onPress: () => console.log('User cancelled picture update'),
            style: "cancel",
          },
          {
            text: "Update",
            onPress: async () => {
              setUploadingImage(true);
              try {
                console.log(' Uploading new profile picture...');
                const newImageUrl = await uploadProfileImage(
                  selectedImage,
                  doctor.user_id
                );

                console.log(' Image uploaded:', newImageUrl);
                // Save the new image URL to the database
                await onSave({ profile_picture_url: newImageUrl });
              } catch (error) {
                console.error(' Failed to upload image:', error);
                Alert.alert(
                  "Upload Failed",
                  "Failed to upload profile picture. Please try again."
                );
              } finally {
                setUploadingImage(false);
              }
            },
            style: "default",
          },
        ]
      );
    } catch (error) {
      console.error(' Error in handleChangeProfilePicture:', error);
      Alert.alert(
        "Error",
        "Failed to select image. Please try again."
      );
    }
  };

  const handleAvailabilityToggle = (newValue: boolean) => {
    const oldValue = doctor.is_available;
    setTempIsAvailable(newValue);

    if (newValue !== oldValue) {
      Alert.alert(
        "Update Availability",
        `Are you sure you want to change your availability status to ${
          newValue ? "Available" : "Not Available"
        }?`,
        [
          {
            text: "Cancel",
            onPress: () => {
              // Revert the UI state
              setTempIsAvailable(oldValue);
            },
            style: "cancel",
          },
          {
            text: "Save",
            onPress: async () => {
              setLoading(true);
              try {
                await onSave({ is_available: newValue });
              } finally {
                setLoading(false);
              }
            },
            style: "default",
          },
        ]
      );
    }
  };

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
              <Text style={styles.closeBtnText}>✕</Text>
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
        <TouchableOpacity
          onPress={handleChangeProfilePicture}
          disabled={uploadingImage}
          style={styles.profileImageContainer}
        >
          {doctor.profile_picture_url ? (
            <Image
              source={{ uri: doctor.profile_picture_url }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileImagePlaceholderText}>‍️</Text>
            </View>
          )}
          {uploadingImage && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
          {!uploadingImage && (
            <View style={styles.cameraIconContainer}>
              <Text style={styles.cameraIcon}></Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Basic Info */}
        <View style={styles.basicInfo}>
          <Text style={styles.doctorName}>{doctor.doctor_name || "N/A"}</Text>
          <Text style={styles.specialization}>
            {doctor.specialization || "Specialization: N/A"}
          </Text>
          <Text style={styles.subtext}>
            {doctor.years_of_experience || 0} years of experience
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
              {doctor.years_of_experience || 0} years
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

        {/* Availability Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}> Availability</Text>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Status:</Text>
            <View style={styles.availabilityToggleContainer}>
              <Switch
                value={tempIsAvailable}
                onValueChange={handleAvailabilityToggle}
                disabled={loading}
                trackColor={{ false: "#ef4444", true: "#22c55e" }}
                thumbColor={tempIsAvailable ? "#22c55e" : "#ef4444"}
              />
              <Text
                style={[
                  styles.availabilityText,
                  {
                    color: tempIsAvailable ? "#22c55e" : "#ef4444",
                  },
                ]}
              >
                {tempIsAvailable ? "✓ Available" : "✗ Not Available"}
              </Text>
              {hasAvailabilityChanged && (
                <Text style={styles.changedIndicator}>●</Text>
              )}
            </View>
          </View>


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

      {/* Edit Button (Floating) */}
      <TouchableOpacity
        style={styles.floatingEditBtn}
        onPress={() => setIsEditing(true)}
      >
        <Text style={styles.floatingEditBtnText}> Edit Profile</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f8ff",
  },
  scrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingBottom: 80,
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
    color: "#0b7fab",
  },
  editBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#0b7fab",
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderColor: "#2bf1ff7d",
    borderWidth: 1,
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
  profileImagePlaceholderText: {
    fontSize: 40,
  },
  cameraIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0b7fab",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  cameraIcon: {
    fontSize: 16,
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
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
    color: "#0b7fab",
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
    fontWeight: "600",
    color: "#0b7fab",
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
    backgroundColor: "#f0f9ff",
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  availabilityToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    justifyContent: "flex-end",
  },
  availabilityText: {
    fontSize: 13,
    fontWeight: "600",
  },
  changedIndicator: {
    fontSize: 18,
    color: "#f59e0b",
    marginLeft: 4,
  },
  floatingEditBtn: {
    position: "absolute",
    bottom: 20,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#0b7fab",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  floatingEditBtnText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
});
