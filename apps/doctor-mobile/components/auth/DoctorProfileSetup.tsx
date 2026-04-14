/**
 * Doctor Registration Form Component
 * Step 1: Doctor Details (License, Specialization, Clinic)
 * Step 2: Credentials (Email, Password, Confirm Password)
 */

import React, { useState, useMemo } from "react";
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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Doctor, EMPTY_DOCTOR, PasswordCheck } from "@smileguard/shared-types";
import PasswordStrengthMeter from "../ui/password-strength-meter";
import { useAuth } from "@smileguard/shared-hooks";
import { createDoctorProfile } from "../../lib/doctorService";
import { pickImage, uploadProfileImage } from "../../lib/imageUploadService";
import { supabase } from "@smileguard/supabase-client";

export interface DoctorRegistrationFormProps {
  onSuccess: (user: { name: string; email: string; role: "doctor" }) => void;
  onCancel?: () => void;
}

export default function DoctorRegistrationForm({
  onSuccess,
  onCancel,
}: DoctorRegistrationFormProps) {
  const { register, ensureRoleSet } = useAuth();
  const [step, setStep] = useState(1); // Step 1: Doctor details, Step 2: Credentials
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  // ── Doctor Details (Step 1)
  const [doctorData, setDoctorData] = useState<Doctor>({
    ...EMPTY_DOCTOR,
    user_id: "",
  });

  // ── Credentials (Step 2)
  const [credentials, setCredentials] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    showPassword: false,
    showConfirmPassword: false,
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
  // PASSWORD STRENGTH VALIDATION (Step 2)
  // ────────────────────────────────────────────────────────────────

  const passwordChecks: PasswordCheck[] = useMemo(() => {
    const p = credentials.password;
    return [
      { label: "At least 8 characters", met: p.length >= 8 },
      { label: "One uppercase letter (A-Z)", met: /[A-Z]/.test(p) },
      { label: "One lowercase letter (a-z)", met: /[a-z]/.test(p) },
      { label: "One number (0-9)", met: /\d/.test(p) },
      { label: "One special character (!@#$…)", met: /[^A-Za-z0-9]/.test(p) },
    ];
  }, [credentials.password]);

  const passwordStrong = passwordChecks.every((c) => c.met);
  const passwordsMatch =
    credentials.password === credentials.confirmPassword &&
    credentials.password.length >= 8;

  const strengthPercent = useMemo(() => {
    const met = passwordChecks.filter((c) => c.met).length;
    return Math.round((met / passwordChecks.length) * 100);
  }, [passwordChecks]);

  // ────────────────────────────────────────────────────────────────
  // STEP 1: DOCTOR DETAILS
  // ────────────────────────────────────────────────────────────────

  const isValidLicenseNumber = (license: string): boolean => {
    const trimmed = license.trim();
    // Check length: 5-7 characters
    if (trimmed.length < 5 || trimmed.length > 7) {
      return false;
    }
    // Check alphanumeric only (letters and numbers)
    if (!/^[a-zA-Z0-9]+$/.test(trimmed)) {
      return false;
    }
    // Check if it's a mix (at least one letter AND one number)
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

  const isStep1Valid = () => {
    return (
      isValidLicenseNumber(doctorData.license_number) &&
      doctorData.specialization.trim() !== "" &&
      doctorData.doctor_name?.trim() !== ""
    );
  };

  const handleStep1Next = () => {
    if (!isStep1Valid()) {
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
    setStep(2);
  };
  // ────────────────────────────────────────────────────────────────
  // IMAGE UPLOAD HANDLER
  // ────────────────────────────────────────────────────────────────

  const handleImagePick = async () => {
    try {
      setUploadingImage(true);
      console.log("️  Picking image...");

      const image = await pickImage();
      if (!image) {
        console.log(" No image selected");
        return;
      }

      // Store full image data for later upload
      setSelectedImage(image);
      setSelectedImageUri(image.uri); // For preview

      // Note: We'll upload after user confirms registration
      console.log(" Image selected, will upload during registration");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to pick image";
      Alert.alert("Image Selection Error", message);
      console.error(" Image pick error:", error);
    } finally {
      setUploadingImage(false);
    }
  };
  // ────────────────────────────────────────────────────────────────
  // STEP 2: CREDENTIALS & REGISTRATION
  // ────────────────────────────────────────────────────────────────

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isStep2Valid = () => {
    return (
      credentials.email.trim() !== "" &&
      isValidEmail(credentials.email) &&
      passwordStrong &&
      passwordsMatch
    );
  };

  const handleRegister = async () => {
    if (!isStep2Valid()) {
      Alert.alert(
        "Missing/Invalid Info",
        "Please complete all required fields with valid information."
      );
      return;
    }

    setLoading(true);
    try {
      console.log(" Starting doctor registration...");

      // Register the doctor account
      const formData = {
        service: "General",
        name: doctorData.doctor_name || "Doctor", // Use doctor name from Step 1
        email: credentials.email,
        password: credentials.password,
        medicalIntake: {},
        doctorAccessCode: "",
      };

      await register(formData, "doctor");
      console.log(" Registration completed, verifying role...");

      // Get the current user and ensure role is set to doctor
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        console.log(" Ensuring role is set to doctor for user:", data.user.id);
        await ensureRoleSet(data.user.id, "doctor");

        // Upload image if provided
        let profileImageUrl = doctorData.profile_picture_url || "";
        if (selectedImage) {
          try {
            console.log(" Uploading image...");
            profileImageUrl = await uploadProfileImage(selectedImage, data.user.id);
            console.log(" Image uploaded successfully:", profileImageUrl);
          } catch (imageError) {
            console.warn(
              "️  Image upload failed, continuing without image:",
              imageError
            );
          }
        }

        // Update doctor data with the user_id and image URL
        doctorData.user_id = data.user.id;
        doctorData.profile_picture_url = profileImageUrl;

        // Save doctor details to the doctors table
        console.log(" Saving doctor details to database...");
        const result = await createDoctorProfile(doctorData);

        if (!result) {
          throw new Error("Failed to save doctor profile");
        }

        console.log(" Doctor profile created successfully!");
        onSuccess({
          name: doctorData.doctor_name || "Doctor",
          email: credentials.email,
          role: "doctor",
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Registration failed. Please try again.";
      console.error(" Registration failed:", message);
      Alert.alert("Registration Error", message);
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // RENDER STEPS
  // ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      enabled={step === 2}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={true}
      >
      {/* ━━━━━━━━━━━━ STEP 1: DOCTOR DETAILS ━━━━━━━━━━━━ */}
      {step === 1 && (
        <View style={styles.stepContent}>
          <Text style={styles.h2}> Doctor Professional Details</Text>
          <Text style={styles.p}>Step 1 of 2: Fill in your professional information</Text>

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
                  ✓ Valid license number
                </Text>
              ) : (
                <View>
                  {doctorData.license_number.length < 5 ||
                  doctorData.license_number.length > 7 ? (
                    <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "500" }}>
                      ✗ Must be 5-7 characters (current: {doctorData.license_number.length})
                    </Text>
                  ) : null}
                  {!/^[a-zA-Z0-9]+$/.test(doctorData.license_number) ? (
                    <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "500" }}>
                      ✗ Only letters and numbers allowed
                    </Text>
                  ) : null}
                  {!/[a-zA-Z]/.test(doctorData.license_number) ||
                  !/[0-9]/.test(doctorData.license_number) ? (
                    <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "500" }}>
                      ✗ Must contain both letters and numbers
                    </Text>
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

          {/* Image Preview or Placeholder */}
          <View style={styles.imagePreviewContainer}>
            {selectedImageUri ? (
              <Image
                source={{ uri: selectedImageUri }}
                style={styles.imagePreview}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderText}></Text>
                <Text style={styles.imagePlaceholderLabel}>
                  No image selected
                </Text>
              </View>
            )}
          </View>

          {/* Image Picker Button */}
          <TouchableOpacity
            style={[styles.btn, styles.secondaryBtn, { marginTop: 8 }]}
            onPress={handleImagePick}
            disabled={uploadingImage || loading}
          >
            {uploadingImage ? (
              <ActivityIndicator color="#0b7fab" size="small" />
            ) : (
              <Text style={styles.secondaryBtnText}>
                {selectedImage ? " Change Photo" : " Choose Photo"}
              </Text>
            )}
          </TouchableOpacity>

          {selectedImage && (
            <TouchableOpacity
              style={[styles.btn, { marginTop: 6, backgroundColor: "#fee2e2" }]}
              onPress={() => {
                setSelectedImage(null);
                setSelectedImageUri(null);
              }}
              disabled={loading}
            >
              <Text style={{ color: "#dc2626", fontSize: 14, fontWeight: "600" }}>
                ✕ Remove Photo
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

          {/* Next Button */}
          <TouchableOpacity
            style={[styles.btn, styles.primaryBtn, { marginTop: 12 }]}
            onPress={handleStep1Next}
            disabled={!isStep1Valid()}
          >
            <Text style={styles.btnText}>Continue to Credentials</Text>
          </TouchableOpacity>

          {/* Cancel Button */}
          {onCancel && (
            <TouchableOpacity
              style={[styles.btn, styles.secondaryBtn, { marginTop: 10 }]}
              onPress={onCancel}
            >
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ━━━━━━━━━━━━ STEP 2: CREDENTIALS ━━━━━━━━━━━━ */}
      {step === 2 && (
        <View style={styles.stepContent}>
          <Text style={styles.h2}> Create Your Account</Text>
          <Text style={styles.p}>Step 2 of 2: Set up your login credentials</Text>

          {/* Email */}
          <TextInput
            style={styles.input}
            placeholder="Email *"
            autoCapitalize="none"
            keyboardType="email-address"
            value={credentials.email}
            onChangeText={(text) =>
              setCredentials((prev) => ({ ...prev, email: text }))
            }
          />

          {/* Password */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password *"
              secureTextEntry={!credentials.showPassword}
              value={credentials.password}
              onChangeText={(text) =>
                setCredentials((prev) => ({ ...prev, password: text }))
              }
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() =>
                setCredentials((prev) => ({
                  ...prev,
                  showPassword: !prev.showPassword,
                }))
              }
            >
              <Image
                source={require("../../assets/images/icon/view.png")}
                style={styles.passwordToggleIcon}
              />
            </TouchableOpacity>
          </View>

          {/* Password Strength Meter */}
          {credentials.password.length > 0 && (
            <View style={styles.strengthSection}>
              <PasswordStrengthMeter strengthPercent={strengthPercent} />
              {passwordChecks.map((c) => (
                <Text
                  key={c.label}
                  style={{
                    color: c.met ? "#22c55e" : "#9ca3af",
                    fontSize: 13,
                    marginTop: 2,
                  }}
                >
                  {c.met ? "✓" : "○"} {c.label}
                </Text>
              ))}
            </View>
          )}

          {/* Confirm Password */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm Password *"
              secureTextEntry={!credentials.showConfirmPassword}
              value={credentials.confirmPassword}
              onChangeText={(text) =>
                setCredentials((prev) => ({ ...prev, confirmPassword: text }))
              }
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() =>
                setCredentials((prev) => ({
                  ...prev,
                  showConfirmPassword: !prev.showConfirmPassword,
                }))
              }
            >
              <Image
                source={require("../../assets/images/icon/view.png")}
                style={styles.passwordToggleIcon}
              />
            </TouchableOpacity>
          </View>

          {/* Password Match Status */}
          {credentials.confirmPassword.length > 0 && (
            <Text
              style={[
                styles.matchStatus,
                {
                  color: passwordsMatch ? "#22c55e" : "#ef4444",
                  marginTop: 8,
                  marginBottom: 12,
                },
              ]}
            >
              {passwordsMatch ? "Passwords match" : "Passwords do not match"}
            </Text>
          )}

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.btn, styles.primaryBtn, { marginTop: 12 }]}
            onPress={handleRegister}
            disabled={loading || !isStep2Valid()}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Create Doctor Account</Text>
            )}
          </TouchableOpacity>

          {/* Back Button */}
          <TouchableOpacity
            style={[styles.btn, styles.secondaryBtn, { marginTop: 6 }]}
            onPress={() => setStep(1)}
            disabled={loading}
          >
            <Text style={styles.secondaryBtnText}>Back</Text>
          </TouchableOpacity>
        </View>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ══════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingBottom: 60,
  },
  stepContent: {
    borderColor: "#2bf1ff7d",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#f8fbff",
    marginBottom: 20,
  },
  h2: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  p: {
    fontSize: 13,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
    marginTop: 10,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    fontSize: 13,
    backgroundColor: "#fff",
  },
  textAreaInput: {
    height: 60,
    textAlignVertical: "top",
    paddingTop: 8,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  passwordToggle: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  passwordToggleText: {
    fontSize: 16,
  },
  passwordToggleIcon: {
    width: 24,
    height: 24,
    resizeMode: "contain",
  },
  matchStatus: {
    fontSize: 12,
    fontWeight: "500",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f3f4f6",
    borderRadius: 6,
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 13,
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
    paddingVertical: 10,
    paddingHorizontal: 16,
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
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryBtnText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
  strengthSection: {
    marginBottom: 8,
  },
  imagePreviewContainer: {
    width: "100%",
    height: 120,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    fontSize: 36,
    marginBottom: 4,
  },
  imagePlaceholderLabel: {
    fontSize: 12,
    color: "#999",
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
    fontWeight: "600",
    color: "#1f2937",
    padding: 14,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  dropdownList: {
    paddingHorizontal: 0,
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  dropdownOptionSelected: {
    backgroundColor: "#f0f9ff",
  },
  dropdownOptionText: {
    fontSize: 13,
    color: "#374151",
  },
});
