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
  Image,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  const [yearsOfExperienceStr, setYearsOfExperienceStr] = useState<string>("");
  const [phoneDigits, setPhoneDigits] = useState<string>("");
  const [phoneDisplay, setPhoneDisplay] = useState<string>("");

  const formatPhoneChunks = (digits: string) => {
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
    return digits;
  };

  const handlePhoneChange = (text: string) => {
    let cleaned = text.replace(/\D/g, "");
    if (cleaned.startsWith("63") && cleaned.length > 10) {
      cleaned = cleaned.slice(2);
    } else if (cleaned.startsWith("0")) {
      cleaned = cleaned.slice(1);
    }
    cleaned = cleaned.slice(0, 10);
    setPhoneDigits(cleaned);

    if (cleaned.length === 10) {
      setPhoneDisplay(formatPhoneChunks(cleaned));
    } else {
      setPhoneDisplay(cleaned);
    }

    const fullPhone = cleaned.length === 10 ? `+63${formatPhoneChunks(cleaned)}` : "";
    updateDoctorData("doctor_phone", fullPhone);
  };

  const handlePhoneBlur = () => {
    if (phoneDigits.length === 10) {
      setPhoneDisplay(formatPhoneChunks(phoneDigits));
    }
  };

  // Pre-fill access code if stored during welcome screen
  React.useEffect(() => {
    AsyncStorage.getItem("@pending_doctor_access_code").then((savedCode) => {
      if (savedCode) {
        setAccessCode(savedCode);
      }
    });
  }, []);

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
      yearsOfExperienceStr.trim() !== "" &&
      !isNaN(Number(yearsOfExperienceStr)) &&
      (doctorData.bio || "").trim() !== "" &&
      (doctorData.first_name || "").trim() !== "" &&
      (doctorData.last_name || "").trim() !== "" &&
      (doctorData.gender || "").trim() !== "" &&
      phoneDigits.trim().length === 10
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
        errorMsg = "Please select a specialization.";
      } else if (yearsOfExperienceStr.trim() === "" || isNaN(Number(yearsOfExperienceStr))) {
        errorMsg = "Please enter your years of experience.";
      } else if ((doctorData.bio || "").trim() === "") {
        errorMsg = "Please enter your professional bio.";
      } else if ((doctorData.first_name || "").trim() === "") {
        errorMsg = "Please enter your first name.";
      } else if ((doctorData.last_name || "").trim() === "") {
        errorMsg = "Please enter your last name.";
      } else if ((doctorData.gender || "").trim() === "") {
        errorMsg = "Please select your gender.";
      } else if (phoneDigits.trim().length !== 10) {
        errorMsg = "Please enter a valid 10-digit phone number after +63 (e.g., 912-345-6789).";
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
        first_name: doctorData.first_name,
        middle_name: doctorData.middle_name,
        last_name: doctorData.last_name,
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
      const { is_available, doctor_name, ...doctorDataClean } = doctorData as any;
      const fullPhoneNumber = `+63${formatPhoneChunks(phoneDigits.trim())}`;
      const finalDoctorData: Doctor = {
        ...doctorDataClean,
        user_id: data.user.id,
        gender: (doctorData.gender || "").trim() || undefined,
        profile_picture_url: profileImageUrl,
        doctor_phone: fullPhoneNumber,
        years_of_experience: Number(yearsOfExperienceStr) || 0,
        office_hours: doctorData.office_hours || EMPTY_DOCTOR.office_hours,
      };

      console.log("[DoctorProfileSetup] Final doctor data to save:", {
        user_id: finalDoctorData.user_id,
        first_name: finalDoctorData.first_name,
        middle_name: finalDoctorData.middle_name,
        last_name: finalDoctorData.last_name,
        specialization: finalDoctorData.specialization,
        license_number: finalDoctorData.license_number,
        doctor_phone: finalDoctorData.doctor_phone,
        years_of_experience: finalDoctorData.years_of_experience,
        has_office_hours: !!finalDoctorData.office_hours,
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
              isValidLicenseNumber(doctorData.license_number) ? (
                <View
                  style={{
                    marginBottom: 10,
                    marginTop: -2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Text style={{ color: "#047857", fontSize: 12, fontWeight: "600" }}>
                    Valid license number
                  </Text>
                </View>
              ) : !/^[a-zA-Z0-9]+$/.test(doctorData.license_number) ? (
                <View
                  style={{
                    marginBottom: 10,
                    marginTop: -2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <HeroIcon name="xmark" size="xs" color="#ef4444" />
                  <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "500" }}>
                    Only letters and numbers allowed
                  </Text>
                </View>
              ) : null
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

            <Text style={styles.label}>
              Years of Experience <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 5, 10"
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              value={yearsOfExperienceStr}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, "");
                setYearsOfExperienceStr(cleaned);
                updateDoctorData("years_of_experience", cleaned ? parseInt(cleaned, 10) : 0);
              }}
            />

            <Text style={styles.label}>
              Professional Bio <Text style={styles.requiredStar}>*</Text>
            </Text>
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
              First Name <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Mart"
              placeholderTextColor="#94A3B8"
              value={doctorData.first_name || ""}
              onChangeText={(text) => updateDoctorData("first_name", text)}
            />

            <Text style={styles.label}>Middle Name (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Lee (optional)"
              placeholderTextColor="#94A3B8"
              value={doctorData.middle_name || ""}
              onChangeText={(text) => updateDoctorData("middle_name", text)}
            />

            <Text style={styles.label}>
              Last Name <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Yanga"
              placeholderTextColor="#94A3B8"
              value={doctorData.last_name || ""}
              onChangeText={(text) => updateDoctorData("last_name", text)}
            />

            <Text style={styles.label}>
              Gender <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.genderChipRow}>
              {[
                { label: "Male (Dr.)", value: "Male" },
                { label: "Female (Dra.)", value: "Female" },
              ].map((item) => {
                const isSelected = (doctorData.gender || "").toLowerCase() === item.value.toLowerCase();
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.genderChip,
                      isSelected && styles.genderChipActive,
                    ]}
                    onPress={() => updateDoctorData("gender", item.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.genderChipText,
                        isSelected && styles.genderChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>
              Doctor Phone <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View
              style={[
                styles.phoneContainer,
                phoneDigits.length === 10
                  ? styles.phoneContainerValid
                  : phoneDigits.length > 0
                    ? styles.phoneContainerInvalid
                    : null,
              ]}
            >
              <View
                style={[
                  styles.phonePrefixContainer,
                  phoneDigits.length === 10
                    ? styles.phonePrefixValid
                    : phoneDigits.length > 0
                      ? styles.phonePrefixInvalid
                      : null,
                ]}
              >
                <Text style={styles.phonePrefixText}>+63</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="912-345-6789"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={12}
                value={phoneDisplay}
                onChangeText={handlePhoneChange}
                onBlur={handlePhoneBlur}
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
              * All fields are required except Middle Name and Profile Picture (optional)
            </Text>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.btn,
                styles.primaryBtn,
                (!isFormValid() || loading) && styles.btnDisabled,
                { marginTop: 16 },
              ]}
              onPress={handleSubmit}
              disabled={loading || !isFormValid()}
              activeOpacity={isFormValid() && !loading ? 0.8 : 1}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.btnText, (!isFormValid() || loading) && styles.btnTextDisabled]}>
                  Continue to Clinic Setup
                </Text>
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
  fieldHint: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
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
  btnDisabled: {
    backgroundColor: "#CBD5E1",
    borderTopColor: "#E2E8F0",
    borderLeftColor: "#E2E8F0",
    borderBottomColor: "#94A3B8",
    borderRightColor: "#94A3B8",
    opacity: 0.7,
  },
  btnTextDisabled: {
    color: "#64748B",
  },
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
    marginBottom: 4,
    overflow: "hidden",
  },
  phoneContainerValid: {
    borderColor: "#10B981",
  },
  phoneContainerInvalid: {
    borderColor: "#FCA5A5",
  },
  phonePrefixContainer: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRightWidth: 1.5,
    borderRightColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  phonePrefixValid: {
    backgroundColor: "#D1FAE5",
    borderRightColor: "#10B981",
  },
  phonePrefixInvalid: {
    backgroundColor: "#FEE2E2",
    borderRightColor: "#FCA5A5",
  },
  phonePrefixText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
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
  genderChipRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  genderChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  genderChipActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#047857",
  },
  genderChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  genderChipTextActive: {
    color: "#047857",
    fontWeight: "700",
  },
});
