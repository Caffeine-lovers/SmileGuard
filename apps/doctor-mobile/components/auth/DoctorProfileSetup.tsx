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
      
      if (!isValidLicenseNumber(doctorData.license_number)) {
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
      console.log("[DoctorProfileSetup] Creating doctor profile in database...");
      const result = await createDoctorProfile(finalDoctorData);

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
                <Image
                  source={require("../../assets/images/icon/back.png")}
                  style={{ width: 24, height: 24, tintColor: "#0b7fab" }}
                />
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
              <Text style={styles.h2}>Doctor Professional Details</Text>
            </View>
          )}
          {!onCancel && <Text style={styles.h2}>Doctor Professional Details</Text>}
          
          <Text style={styles.p}>Complete your profile to access the dashboard</Text>

          {/* Section: License & Credentials */}
          <Text style={styles.sectionHeader}>License & Credentials</Text>

          <TextInput
            style={styles.input}
            placeholder="Medical License Number (5-7 chars) *"
            value={doctorData.license_number}
            onChangeText={(text) => updateDoctorData("license_number", text)}
            keyboardType="default"
          />

          {/* License Number Validation Feedback */}
          {doctorData.license_number.length > 0 && (
            <View
              style={{
                marginBottom: 8,
                marginTop: -4,
              }}
            >
              {isValidLicenseNumber(doctorData.license_number) ? (
                <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "500" }}>
                  <Image
                    source={require("../../assets/images/icon/check.png")}
                    style={{ width: 16, height: 16, tintColor: "#22c55e" }}
                  />
                  <Text> Valid license number</Text>
                </Text>
              ) : (
                <View>
                  {doctorData.license_number.length < 5 ||
                  doctorData.license_number.length > 7 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <HeroIcon name="xmark" size="xs" color="#ef4444" />
                      <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "500" }}>
                        Must be 5-7 characters (current: {doctorData.license_number.length})
                      </Text>
                    </View>
                  ) : null}
                  {!/^[a-zA-Z0-9]+$/.test(doctorData.license_number) ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
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
          <TouchableOpacity
            style={[
              styles.input,
              {
                justifyContent: "center",
                paddingVertical: 0,
                borderColor: doctorData.specialization
                  ? "#0b7fab"
                  : "#d1d5db",
              },
            ]}
            onPress={() => setShowSpecializationDropdown(true)}
          >
            <Text
              style={{
                fontSize: 13,
                color: doctorData.specialization ? "#000" : "#999",
                paddingVertical: 10,
                paddingHorizontal: 10,
              }}
            >
              {doctorData.specialization ||
                "Select Specialization *"}
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
                            color: "#0b7fab",
                            fontWeight: "600",
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

          <TextInput
            style={styles.input}
            placeholder="Years of Experience (e.g., 5, 10)"
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

          <TextInput
            style={[styles.input, styles.textAreaInput]}
            placeholder="Professional Bio (optional)"
            multiline
            numberOfLines={3}
            value={doctorData.bio}
            onChangeText={(text) => updateDoctorData("bio", text)}
          />

          {/* Section: Doctor Information */}
          <Text style={styles.sectionHeader}>Doctor Information</Text>

          <TextInput
            style={styles.input}
            placeholder="Doctor Name *"
            value={doctorData.doctor_name || ""}
            onChangeText={(text) => updateDoctorData("doctor_name", text)}
          />

          <TextInput
            style={styles.input}
            placeholder="Doctor Phone"
            keyboardType="phone-pad"
            value={doctorData.doctor_phone || ""}
            onChangeText={(text) => updateDoctorData("doctor_phone", text)}
          />

          {/* Section: Availability */}
          <Text style={styles.sectionHeader}>Availability</Text>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Currently Available</Text>
            <Switch
              value={doctorData.is_available || false}
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
                <Image
                  source={require("../../assets/images/icon/camera.png")}
                  style={styles.cameraIcon}
                />
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
              <Text style={{ color: "#dc2626", fontSize: 14, fontWeight: "600" }}>
                <Image
                  source={require("../../assets/images/icon/close.png")}
                  style={{ width: 18, height: 18, tintColor: "#dc2626" }}
                />
                <Text> Remove Photo</Text>
              </Text>
            </TouchableOpacity>
          )}

          {/* Mandatory Fields Note */}
          <Text style={styles.requiredNote}>
            * License: 5-7 alphanumeric chars with letters & numbers (e.g., ABC123)
          </Text>
          <Text style={styles.requiredNote}>
            * Specialization and Doctor Name are also required
          </Text>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.btn, styles.primaryBtn, { marginTop: 12 }]}
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
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  centerContent: {
    width: "100%",
    maxWidth: 400,
    justifyContent: "center",
  },
  scrollView: {
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    paddingBottom: 40,
  },
  stepContent: {
    borderColor: "#2bf1ff7d",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#f8fbff",
    marginBottom: 14,
  },
  headerWithBack: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    gap: 6,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0b7fab",
  },
  h2: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 3,
    textAlign: "center",
  },
  p: {
    fontSize: 11,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 10,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1f2937",
    marginTop: 7,
    marginBottom: 5,
    paddingBottom: 4,
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
    fontSize: 11,
    backgroundColor: "#fff",
  },
  textAreaInput: {
    height: 40,
    textAlignVertical: "top",
    paddingTop: 6,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    backgroundColor: "#fff",
    marginBottom: 6,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11,
  },
  passwordToggle: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  passwordToggleText: {
    fontSize: 16,
  },
  passwordToggleIcon: {
    width: 18,
    height: 18,
    resizeMode: "contain",
  },
  matchStatus: {
    fontSize: 9,
    fontWeight: "500",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    marginBottom: 6,
  },
  switchLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: "#1f2937",
  },
  requiredNote: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 8,
    fontStyle: "italic",
  },
  btn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtn: {
    backgroundColor: "#0b7fab",
  },
  secondaryBtn: {
    backgroundColor: "#e5e7eb",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  btnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  secondaryBtnText: {
    color: "#374151",
    fontSize: 11,
    fontWeight: "600",
  },
  strengthSection: {
    marginBottom: 8,
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
    width: 18,
    height: 18,
    resizeMode: "contain",
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
    fontSize: 11,
    fontWeight: "600",
    color: "#1f2937",
    padding: 10,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  dropdownList: {
    paddingHorizontal: 0,
  },
  dropdownOption: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  dropdownOptionSelected: {
    backgroundColor: "#f0f9ff",
  },
  dropdownOptionText: {
    fontSize: 11,
    color: "#374151",
  },
});
