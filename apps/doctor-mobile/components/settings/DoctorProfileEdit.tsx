import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
  Switch,
  Modal,
  ActivityIndicator,
  Image,
} from "react-native";
import { Doctor, EMPTY_DOCTOR } from "@smileguard/shared-types";
import { X, Check, Camera, User, AlertCircle } from "lucide-react-native";
import { pickImage, uploadProfileImage, ImagePickerResult } from "../../lib/imageUploadService";

interface DoctorProfileEditProps {
  doctor: Doctor;
  onSave: (updatedDoctor: Partial<Doctor>) => Promise<void>;
  onCancel: () => void;
}

export default function DoctorProfileEdit({
  doctor,
  onSave,
  onCancel,
}: DoctorProfileEditProps) {
  const [doctorData, setDoctorData] = useState<Doctor>(doctor || EMPTY_DOCTOR);
  const [selectedImage, setSelectedImage] = useState<ImagePickerResult | null>(null);
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(
    doctor?.profile_picture_url || null
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showSpecializationDropdown, setShowSpecializationDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync state if doctor prop changes
  useEffect(() => {
    if (doctor) {
      setDoctorData({
        ...EMPTY_DOCTOR,
        ...doctor,
        doctor_name: doctor.doctor_name || (doctor as any).name || "",
        doctor_phone: doctor.doctor_phone || (doctor as any).phone_number || (doctor as any).clinic_phone || "",
      });
      if (doctor.profile_picture_url) {
        setImagePreviewUri(doctor.profile_picture_url);
      }
    }
  }, [doctor]);

  const specializations = [
    "General Dentistry",
    "Orthodontics",
    "Periodontics",
    "Prosthodontics",
    "Oral Surgery",
    "Pediatric Dentistry",
    "Endodontics",
    "Cosmetic Dentistry",
    "Implant Dentistry",
  ];

  const updateDoctorData = (key: keyof Doctor, value: any) => {
    setDoctorData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  /**
   * License number validation:
   * Accepts 4 to 15 alphanumeric characters (digits, letters, and hyphens allowed)
   */
  const isValidLicenseNumber = (license?: string): boolean => {
    if (!license) return false;
    const trimmed = license.trim();
    if (trimmed.length < 4 || trimmed.length > 15) return false;
    return /^[a-zA-Z0-9-]+$/.test(trimmed);
  };

  /**
   * Pick new profile image from media library
   */
  const handlePickImage = async () => {
    try {
      console.log("[DoctorProfileEdit] Picking image...");
      const result = await pickImage([1, 1]);
      if (!result) {
        console.log("[DoctorProfileEdit] Image picking cancelled");
        return;
      }
      setSelectedImage(result);
      setImagePreviewUri(result.uri);
      console.log("[DoctorProfileEdit] Selected image URI:", result.uri);
    } catch (error) {
      console.error("[DoctorProfileEdit] Failed to pick image:", error);
      Alert.alert(
        "Image Selection Failed",
        error instanceof Error ? error.message : "Failed to select image from gallery"
      );
    }
  };

  /**
   * Validates form and returns error message if invalid, or null if valid
   */
  const validateForm = (): string | null => {
    const name = (doctorData.doctor_name || "").trim();
    if (!name) {
      return "Doctor Name is required.";
    }

    const license = (doctorData.license_number || "").trim();
    if (!license) {
      return "Medical License Number is required.";
    }
    if (!isValidLicenseNumber(license)) {
      return "Medical License Number must be 4 to 15 alphanumeric characters.";
    }

    const spec = (doctorData.specialization || "").trim();
    if (!spec) {
      return "Please select a specialization.";
    }

    return null;
  };

  const isFormValid = (): boolean => {
    return validateForm() === null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert("Validation Error", validationError);
      return;
    }

    setLoading(true);
    try {
      let finalPictureUrl = doctorData.profile_picture_url || "";

      // If user selected a new image, upload it to storage
      if (selectedImage) {
        setUploadingImage(true);
        try {
          const userId =
            doctorData.user_id ||
            doctor.user_id ||
            doctorData.id ||
            doctor.id ||
            "doctor";
          console.log("[DoctorProfileEdit] Uploading profile picture for user:", userId);
          finalPictureUrl = await uploadProfileImage(selectedImage, userId);
          console.log("[DoctorProfileEdit] Uploaded picture URL:", finalPictureUrl);
        } catch (uploadError) {
          console.error("[DoctorProfileEdit] Photo upload error:", uploadError);
          Alert.alert(
            "Upload Warning",
            "Could not upload profile picture. Continuing to save other details..."
          );
        } finally {
          setUploadingImage(false);
        }
      }

      const updatedPayload: Partial<Doctor> = {
        ...doctorData,
        doctor_name: (doctorData.doctor_name || "").trim(),
        license_number: (doctorData.license_number || "").trim(),
        specialization: (doctorData.specialization || "").trim(),
        doctor_phone: (doctorData.doctor_phone || "").trim(),
        bio: (doctorData.bio || "").trim(),
        years_of_experience: Number(doctorData.years_of_experience) || 0,
        is_available: Boolean(doctorData.is_available),
        profile_picture_url: finalPictureUrl,
      };

      console.log("[DoctorProfileEdit] Saving doctor updates:", updatedPayload);
      await onSave(updatedPayload);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      console.error("[DoctorProfileEdit] Save error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to save profile";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const licenseNum = doctorData.license_number || "";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Edit Doctor Profile</Text>
        <TouchableOpacity
          onPress={onCancel}
          disabled={loading || uploadingImage}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={22} color="#047857" />
        </TouchableOpacity>
      </View>

      {/* Profile Picture Card */}
      <View style={styles.avatarCard}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handlePickImage}
          disabled={loading || uploadingImage}
          activeOpacity={0.8}
        >
          {imagePreviewUri ? (
            <Image source={{ uri: imagePreviewUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={46} color="#94A3B8" />
            </View>
          )}

          {uploadingImage ? (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : (
            <View style={styles.cameraBadge}>
              <Camera size={14} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePickImage}
          disabled={loading || uploadingImage}
          style={styles.changePhotoBtn}
        >
          <Camera size={15} color="#047857" style={{ marginRight: 6 }} />
          <Text style={styles.changePhotoText}>
            {imagePreviewUri ? "Change Profile Picture" : "Upload Profile Picture"}
          </Text>
        </TouchableOpacity>
        <Text style={styles.photoHint}>JPG or PNG (square recommended)</Text>
      </View>

      {/* Form Content */}
      <View style={styles.stepContent}>
        <Text style={styles.h2}>Doctor Professional Details</Text>
        <Text style={styles.p}>Update your professional credentials and contact details</Text>

        {/* Section: Doctor Information */}
        <Text style={styles.sectionHeader}>Doctor Information</Text>

        <Text style={styles.inputLabel}>Doctor Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Dr. Maria Santos"
          value={doctorData.doctor_name || ""}
          onChangeText={(text) => updateDoctorData("doctor_name", text)}
        />

        <Text style={styles.inputLabel}>Contact Phone Number</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. +63 912 345 6789"
          keyboardType="phone-pad"
          value={doctorData.doctor_phone || ""}
          onChangeText={(text) => updateDoctorData("doctor_phone", text)}
        />

        {/* Section: License & Credentials */}
        <Text style={styles.sectionHeader}>License & Credentials</Text>

        <Text style={styles.inputLabel}>Medical / Dental License Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 0123456 or DL12345"
          value={licenseNum}
          onChangeText={(text) => updateDoctorData("license_number", text.trim())}
          autoCapitalize="characters"
        />

        {/* License Number Validation Feedback */}
        {licenseNum.length > 0 && (
          <View style={styles.validationRow}>
            {isValidLicenseNumber(licenseNum) ? (
              <View style={styles.feedbackSuccess}>
                <Check size={14} color="#22c55e" style={{ marginRight: 4 }} />
                <Text style={styles.feedbackSuccessText}>Valid license number</Text>
              </View>
            ) : (
              <View style={styles.feedbackError}>
                <AlertCircle size={14} color="#ef4444" style={{ marginRight: 4 }} />
                <Text style={styles.feedbackErrorText}>
                  {licenseNum.length < 4 || licenseNum.length > 15
                    ? `Must be 4-15 characters (currently: ${licenseNum.length})`
                    : "Only letters, numbers, and hyphens allowed"}
                </Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.inputLabel}>Specialization *</Text>
        <TouchableOpacity
          style={[styles.input, styles.dropdownTrigger]}
          onPress={() => setShowSpecializationDropdown(true)}
        >
          <Text
            style={{
              fontSize: 14,
              color: doctorData.specialization ? "#1f2937" : "#9ca3af",
            }}
          >
            {doctorData.specialization || "Select Specialization"}
          </Text>
        </TouchableOpacity>

        <Modal
          visible={showSpecializationDropdown}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSpecializationDropdown(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSpecializationDropdown(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Specialization</Text>
                <TouchableOpacity onPress={() => setShowSpecializationDropdown(false)}>
                  <X size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 350 }}>
                {specializations.map((spec) => {
                  const isSelected = doctorData.specialization === spec;
                  return (
                    <TouchableOpacity
                      key={spec}
                      style={[
                        styles.dropdownOption,
                        isSelected && styles.dropdownOptionSelected,
                      ]}
                      onPress={() => {
                        updateDoctorData("specialization", spec);
                        setShowSpecializationDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          isSelected && styles.dropdownOptionTextSelected,
                        ]}
                      >
                        {spec}
                      </Text>
                      {isSelected && <Check size={18} color="#047857" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        <Text style={styles.inputLabel}>Years of Experience</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 5"
          keyboardType="numeric"
          value={
            doctorData.years_of_experience !== undefined &&
            doctorData.years_of_experience !== null
              ? doctorData.years_of_experience.toString()
              : ""
          }
          onChangeText={(text) => {
            const clean = text.replace(/[^0-9]/g, "");
            updateDoctorData("years_of_experience", clean === "" ? 0 : parseInt(clean, 10));
          }}
        />

        <Text style={styles.inputLabel}>Professional Bio</Text>
        <TextInput
          style={[styles.input, styles.textAreaInput]}
          placeholder="Write a brief description of your background and expertise..."
          multiline
          numberOfLines={3}
          value={doctorData.bio || ""}
          onChangeText={(text) => updateDoctorData("bio", text)}
        />

        {/* Section: Availability */}
        <Text style={styles.sectionHeader}>Availability</Text>

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Appointment Availability</Text>
            <Text style={styles.switchSubtext}>
              {doctorData.is_available
                ? "Available for patient appointments"
                : "Currently not accepting appointments"}
            </Text>
          </View>
          <Switch
            value={Boolean(doctorData.is_available)}
            onValueChange={(value) => updateDoctorData("is_available", value)}
            trackColor={{ false: "#d1d5db", true: "#6ee7b7" }}
            thumbColor={doctorData.is_available ? "#047857" : "#9ca3af"}
          />
        </View>

        <View
          style={[
            styles.availabilityBadge,
            doctorData.is_available ? styles.badgeAvailable : styles.badgeUnavailable,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: doctorData.is_available ? "#22c55e" : "#ef4444" },
            ]}
          />
          <Text
            style={[
              styles.availabilityBadgeText,
              { color: doctorData.is_available ? "#065f46" : "#991b1b" },
            ]}
          >
            Status: {doctorData.is_available ? "Available" : "Not Available"}
          </Text>
        </View>
      </View>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, styles.secondaryBtn]}
          onPress={onCancel}
          disabled={loading || uploadingImage}
        >
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.btn,
            styles.primaryBtn,
            (loading || uploadingImage) && styles.btnDisabled,
          ]}
          onPress={handleSave}
          disabled={loading || uploadingImage}
          activeOpacity={0.8}
        >
          {loading || uploadingImage ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>Save Changes</Text>
          )}
        </TouchableOpacity>
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
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingBottom: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 12,
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#047857",
  },
  avatarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    position: "relative",
    marginBottom: 12,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: "#10B981",
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F1F5F9",
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#10B981",
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  changePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#047857",
  },
  photoHint: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 6,
  },
  stepContent: {
    borderColor: "#E2E8F0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#FFFFFF",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  h2: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 4,
    textAlign: "center",
  },
  p: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#047857",
    marginTop: 14,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomColor: "#F1F5F9",
    borderBottomWidth: 1.5,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    fontSize: 14,
    backgroundColor: "#FFFFFF",
    color: "#1F2937",
  },
  dropdownTrigger: {
    justifyContent: "center",
    height: 44,
  },
  textAreaInput: {
    height: 75,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  validationRow: {
    marginBottom: 8,
    marginTop: 2,
  },
  feedbackSuccess: {
    flexDirection: "row",
    alignItems: "center",
  },
  feedbackSuccessText: {
    color: "#22c55e",
    fontSize: 12,
    fontWeight: "500",
  },
  feedbackError: {
    flexDirection: "row",
    alignItems: "center",
  },
  feedbackErrorText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "500",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 4,
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
  },
  switchSubtext: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  availabilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginTop: 2,
  },
  badgeAvailable: {
    backgroundColor: "#DCFCE7",
  },
  badgeUnavailable: {
    backgroundColor: "#FEE2E2",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  availabilityBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  dropdownOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomColor: "#F1F5F9",
    borderBottomWidth: 1,
  },
  dropdownOptionSelected: {
    backgroundColor: "#ECFDF5",
    borderRadius: 6,
  },
  dropdownOptionText: {
    fontSize: 14,
    color: "#374151",
  },
  dropdownOptionTextSelected: {
    color: "#047857",
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtn: {
    backgroundColor: "#10B981",
  },
  secondaryBtn: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475569",
    textAlign: "center",
  },
});
