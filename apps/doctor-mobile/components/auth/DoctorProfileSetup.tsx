/**
 * Doctor Profile Setup Component
 * 
 * Shown after Google OAuth login to collect doctor professional information.
 * Includes image upload, specialization, license, and bio.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Switch,
  Image,
  Modal,
} from "react-native";
import { Doctor, EMPTY_DOCTOR } from "@smileguard/shared-types";
import { ChevronLeft, Camera, X } from "lucide-react-native";
import { createDoctorProfile } from "../../lib/doctorService";
import { pickImage, uploadProfileImage } from "../../lib/imageUploadService";
import { supabase } from "@smileguard/supabase-client";
import { HeroIcon } from "../ui/HeroIcon";

export interface DoctorProfileSetupProps {
  onContinue: () => void;
  onCancel?: () => void;
}

export default function DoctorProfileSetup({
  onContinue,
  onCancel,
}: DoctorProfileSetupProps) {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  // ── Doctor Details
  const [accessCode, setAccessCode] = useState("");
  const [doctorData, setDoctorData] = useState<Doctor>({
    ...EMPTY_DOCTOR,
    user_id: "",
  });

  // ── Specialization Dropdown
  const [showSpecializationDropdown, setShowSpecializationDropdown] =
    useState(false);

  // ── Selected Image Data
  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    name: string;
    type: string;
  } | null>(null);

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

  // ────────────────────────────────────────────────────────────────
  // DOCTOR DETAILS VALIDATION
  // ────────────────────────────────────────────────────────────────

  const isValidLicenseNumber = (license: string): boolean => {
    const trimmed = license.trim();
    if (trimmed.length < 5 || trimmed.length > 7) {
      return false;
    }
    if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
      return false;
    }
    const hasLetter = /[a-zA-Z]/.test(trimmed);
    const hasNumber = /[0-9]/.test(trimmed);
    return hasLetter && hasNumber;
  };

  const updateDoctorData = (key: keyof Doctor, value: any) => {
    setDoctorData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const isFormValid = () => {
    return (
      accessCode.trim().length >= 4 &&
      isValidLicenseNumber(doctorData.license_number) &&
      doctorData.specialization.trim() !== "" &&
      doctorData.doctor_name?.trim() !== ""
    );
  };
  // ────────────────────────────────────────────────────────────────
  // IMAGE UPLOAD HANDLER
  // ────────────────────────────────────────────────────────────────

  const handleImagePick = async () => {
    try {
      setUploadingImage(true);
      console.log("[ImagePick] Picking image...");

      const image = await pickImage();
      if (!image) {
        console.log("[ImagePick] No image selected");
        return;
      }

      // Store full image data for later upload
      setSelectedImage(image);
      setSelectedImageUri(image.uri); // For preview

      // Note: We'll upload after user confirms registration
      console.log("[ImagePick] Image selected, will upload during registration");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to pick image";
      Alert.alert("Image Selection Error", message);
      console.error("[ImagePick] Error:", error);
    } finally {
      setUploadingImage(false);
    }
  };
  // ────────────────────────────────────────────────────────────────
  // STEP 2: CREDENTIALS & REGISTRATION
  // ────────────────────────────────────────────────────────────────

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // ────────────────────────────────────────────────────────────────
  // SUBMIT: SAVE DOCTOR PROFILE
  // ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!isFormValid()) {
      let errorMsg = "Please complete all required fields.";
      
      if (!accessCode.trim() || accessCode.trim().length < 4) {
        errorMsg = "Please enter a valid Clinic Access Code (e.g., SMILE-TEST-2026).";
      } else if (!isValidLicenseNumber(doctorData.license_number)) {
        errorMsg = "Medical License Number must be 5-7 characters with both letters and numbers (e.g., ABC123)";
      } else if (doctorData.specialization.trim() === "") {
        errorMsg = "Please enter a specialization.";
      } else if (doctorData.doctor_name?.trim() === "") {
        errorMsg = "Please enter a doctor name.";
      }
      
      Alert.alert("Invalid Information", errorMsg);
      return;
    }

    setLoading(true);
    try {
      console.log("[DoctorProfileSetup] Saving doctor profile...");

      // Get current authenticated user from Supabase
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        throw new Error("User not authenticated. Please log in again.");
      }

      console.log("[DoctorProfileSetup] Authenticated user ID:", data.user.id);
      console.log("[DoctorProfileSetup] Current doctorData before save:", {
        doctor_name: doctorData.doctor_name,
        specialization: doctorData.specialization,
        license_number: doctorData.license_number,
        bio: doctorData.bio,
      });

      // Upload image if provided
      let profileImageUrl = doctorData.profile_picture_url || "";
      if (selectedImage) {
        try {
          console.log("[DoctorProfileSetup] Uploading profile image...");
          profileImageUrl = await uploadProfileImage(selectedImage, data.user.id);
          console.log("[DoctorProfileSetup] Image uploaded successfully, URL:", profileImageUrl);
        } catch (imageError) {
          console.warn("[DoctorProfileSetup] Image upload failed, continuing without image:", imageError);
        }
      }

      // Update doctor data with user_id and image URL
      const finalDoctorData = {
        ...doctorData,
        user_id: data.user.id,
        profile_picture_url: profileImageUrl,
      };

      console.log("[DoctorProfileSetup] Final doctor data to save:", {
        user_id: finalDoctorData.user_id,
        doctor_name: finalDoctorData.doctor_name,
        specialization: finalDoctorData.specialization,
        license_number: finalDoctorData.license_number,
      });

      // Save doctor profile to database
      console.log("[DoctorProfileSetup] Creating doctor profile via secure RPC...");
      const result = await createDoctorProfile(finalDoctorData, accessCode.trim());

      if (!result) {
        throw new Error("Failed to save doctor profile - no data returned");
      }

      console.log("[DoctorProfileSetup] Doctor profile saved successfully!");
      
      // Move to clinic setup step
      onContinue();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save profile. Please try again.";
      console.error("[DoctorProfileSetup] Full error:", err);
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.centerContent}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
        >
        <View style={styles.stepContent}>
          {/* Back Button Header */}
          {onCancel && (
            <View style={styles.headerWithBack}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={onCancel}
                disabled={loading}
              >
                <ChevronLeft size={22} color="#10B981" />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
              <Text style={styles.h2}>Doctor Professional Details</Text>
            </View>
          )}
          {!onCancel && <Text style={styles.h2}>Doctor Professional Details</Text>}
          
          <Text style={styles.p}>Complete your profile to access the dashboard</Text>

          {/* Section: Clinic Verification */}
          <Text style={styles.sectionHeader}>Clinic Verification</Text>

          <Text style={styles.label}>
            Clinic Access Code <Text style={styles.requiredStar}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., SMILE-TEST-2026"
            placeholderTextColor="#94A3B8"
            value={accessCode}
            onChangeText={setAccessCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Text style={{ fontSize: 12, color: "#64748B", marginTop: -6, marginBottom: 16 }}>
            Provided by your clinic administrator to verify your credentials.
          </Text>

          {/* Section: License & Credentials */}
          <Text style={styles.sectionHeader}>License & Credentials</Text>

          <Text style={styles.label}>
            Medical License Number <Text style={styles.requiredStar}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., ABC123"
            placeholderTextColor="#94A3B8"
            value={doctorData.license_number}
            onChangeText={(text) => updateDoctorData("license_number", text)}
            keyboardType="default"
            autoCapitalize="characters"
          />

          {/* License Number Validation Feedback */}
          {doctorData.license_number.length > 0 && (
            <View
              style={{
                marginBottom: 10,
                marginTop: -2,
              }}
            >
              {isValidLicenseNumber(doctorData.license_number) ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <HeroIcon name="circle" size="xs" color="#10B981" />
                  <Text style={{ color: "#047857", fontSize: 12, fontWeight: "600" }}>
                    Valid license number
                  </Text>
                </View>
              ) : (
                <View>
                  {doctorData.license_number.length < 5 ||
                  doctorData.license_number.length > 7 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <HeroIcon name="xmark" size="xs" color="#ef4444" />
                      <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "500" }}>
                        Must be 5-7 characters (current: {doctorData.license_number.length})
                      </Text>
                    </View>
                  ) : null}
                  {!/^[a-zA-Z0-9]+$/.test(doctorData.license_number) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                      <HeroIcon name="xmark" size="xs" color="#ef4444" />
                      <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "500" }}>
                        Only letters and numbers allowed
                      </Text>
                    </View>
                  ) : null}
                  {!/[a-zA-Z]/.test(doctorData.license_number) ||
                  !/[0-9]/.test(doctorData.license_number) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <HeroIcon name="xmark" size="xs" color="#ef4444" />
                      <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "500" }}>
                        Must contain both letters and numbers
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          )}

          {/* Specialization Dropdown */}
          <Text style={styles.label}>
            Specialization <Text style={styles.requiredStar}>*</Text>
          </Text>
          <TouchableOpacity
            style={[
              styles.input,
              {
                justifyContent: "center",
                paddingVertical: 12,
                borderColor: doctorData.specialization
                  ? "#10B981"
                  : "#CBD5E1",
              },
            ]}
            onPress={() => setShowSpecializationDropdown(true)}
          >
            <Text
              style={{
                fontSize: 13,
                color: doctorData.specialization ? "#0F172A" : "#94A3B8",
                paddingHorizontal: 4,
              }}
            >
              {doctorData.specialization || "Select Specialization"}
            </Text>
          </TouchableOpacity>

          {/* Specialization Dropdown Modal */}
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
              <View style={styles.dropdownContainer}>
                <Text style={styles.dropdownHeader}>Select Specialization</Text>
                <ScrollView style={styles.dropdownList}>
                  {specializations.map((spec, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dropdownOption,
                        doctorData.specialization === spec &&
                          styles.dropdownOptionSelected,
                      ]}
                      onPress={() => {
                        updateDoctorData("specialization", spec);
                        setShowSpecializationDropdown(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          doctorData.specialization === spec && {
                            color: "#047857",
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {spec}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>

          <Text style={styles.label}>Years of Experience</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 5, 10"
            placeholderTextColor="#94A3B8"
            keyboardType="number-pad"
            value={
              doctorData.years_of_experience && doctorData.years_of_experience > 0
                ? doctorData.years_of_experience.toString()
                : ""
            }
            onChangeText={(text) =>
              updateDoctorData("years_of_experience", parseInt(text) || 0)
            }
          />

          <Text style={styles.label}>Professional Bio</Text>
          <TextInput
            style={[styles.input, styles.textAreaInput]}
            placeholder="Brief overview of your practice, background and interests"
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            value={doctorData.bio}
            onChangeText={(text) => updateDoctorData("bio", text)}
          />

          {/* Section: Doctor Information */}
          <Text style={styles.sectionHeader}>Doctor Information</Text>

          <Text style={styles.label}>
            Doctor Name <Text style={styles.requiredStar}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Dr. Jane Doe"
            placeholderTextColor="#94A3B8"
            value={doctorData.doctor_name || ""}
            onChangeText={(text) => updateDoctorData("doctor_name", text)}
          />

          <Text style={styles.label}>Doctor Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., +1 (555) 123-4567"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            value={doctorData.doctor_phone || ""}
            onChangeText={(text) => updateDoctorData("doctor_phone", text)}
          />

          {/* Section: Availability */}
          <Text style={styles.sectionHeader}>Availability</Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Currently Available for Patients</Text>
            <Switch
              value={doctorData.is_available || false}
              trackColor={{ false: "#CBD5E1", true: "#A7F3D0" }}
              thumbColor={doctorData.is_available ? "#10B981" : "#F1F5F9"}
              onValueChange={(value) => updateDoctorData("is_available", value)}
            />
          </View>

          {/* Section: Profile Picture */}
          <Text style={styles.sectionHeader}>Profile Picture</Text>

          {/* Profile Picture Container - Circular with Camera Overlay */}
          <TouchableOpacity
            onPress={handleImagePick}
            disabled={uploadingImage || loading}
            style={styles.profileImageContainer}
          >
            {selectedImageUri ? (
              <Image
                source={{ uri: selectedImageUri }}
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
            {uploadingImage && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}
            {!uploadingImage && (
              <View style={styles.cameraIconContainer}>
                <Camera size={14} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          {selectedImage && (
            <TouchableOpacity
              style={[styles.btn, { marginTop: 12, backgroundColor: "#fee2e2" }]}
              onPress={() => {
                setSelectedImage(null);
                setSelectedImageUri(null);
              }}
              disabled={loading}
            >
              <Text style={{ color: "#dc2626", fontSize: 13, fontWeight: "600", flexDirection: "row", alignItems: "center" }}>
                <X size={16} color="#dc2626" />
                <Text> Remove Photo</Text>
              </Text>
            </TouchableOpacity>
          )}

          {/* Mandatory Fields Note */}
          <Text style={styles.requiredNote}>
            * License: 5-7 alphanumeric characters with both letters and numbers (e.g., ABC123)
          </Text>
          <Text style={styles.requiredNote}>
            * Specialization and Doctor Name are also required
          </Text>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.btn, styles.primaryBtn, { marginTop: 16 }]}
            onPress={handleSubmit}
            disabled={loading || !isFormValid()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Continue to Clinic Setup</Text>
            )}
          </TouchableOpacity>

          {/* Cancel Button */}
          {onCancel && (
            <TouchableOpacity
              style={[styles.btn, styles.secondaryBtn, { marginTop: 10 }]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  centerContent: {
    width: "100%",
    maxWidth: 440,
    justifyContent: "center",
  },
  scrollView: {
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingBottom: 40,
  },
  stepContent: {
    borderColor: "#CBD5E1",
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 16,
    backgroundColor: "#FFFFFF",
    marginBottom: 14,
  },
  headerWithBack: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#047857",
  },
  h2: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
    textAlign: "center",
  },
  p: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1.5,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 4,
    marginTop: 6,
  },
  requiredStar: {
    color: "#EF4444",
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 4,
    fontSize: 13,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },
  textAreaInput: {
    height: 70,
    textAlignVertical: "top",
    paddingTop: 8,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
  },
  requiredNote: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 6,
    fontStyle: "italic",
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtn: {
    backgroundColor: "#10B981",
    borderWidth: 1.5,
    borderTopColor: "#34D399",
    borderLeftColor: "#34D399",
    borderBottomColor: "#047857",
    borderRightColor: "#047857",
  },
  secondaryBtn: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
  btnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryBtnText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
  profileImageContainer: {
    alignSelf: "center",
    marginBottom: 12,
    position: "relative",
  },
  profileImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: "center",
    borderWidth: 2,
    borderColor: "#10B981",
  },
  profileImagePlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },
  profileImagePlaceholderIcon: {
    width: 56,
    height: 56,
    resizeMode: "contain",
  },
  cameraIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  cameraIcon: {
    width: 16,
    height: 16,
    resizeMode: "contain",
    tintColor: "#FFFFFF",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  dropdownContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  dropdownHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    padding: 14,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  dropdownList: {
    paddingHorizontal: 0,
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownOptionSelected: {
    backgroundColor: "#ECFDF5",
  },
  dropdownOptionText: {
    fontSize: 13,
    color: "#334155",
  },
});
