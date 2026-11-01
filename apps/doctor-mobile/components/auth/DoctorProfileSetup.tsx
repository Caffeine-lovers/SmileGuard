/**
 * Doctor Profile Setup Component
 * 
 * Shown after Google OAuth login to collect doctor professional information.
 * Includes image upload, specialization, license, and bio.
 * Designed with modern HeroUI/tactile styling consistent with SmileGuard.
 */

import React, { useState, useEffect } from "react";
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
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Doctor, EMPTY_DOCTOR } from "@smileguard/shared-types";
import {
  ChevronLeft,
  Camera,
  X,
  ShieldCheck,
  Building2,
  Lock,
  Stethoscope,
  Clock,
  User,
  Phone,
  FileText,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react-native";
import { createDoctorProfile, doctorLicenseExists } from "../../lib/doctorService";
import { pickImage, uploadProfileImage, ImagePickerResult } from "../../lib/imageUploadService";
import { supabase } from "@smileguard/supabase-client";

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

  // License Uniqueness State
  const [isCheckingLicense, setIsCheckingLicense] = useState(false);
  const [licenseDuplicateError, setLicenseDuplicateError] = useState<string | null>(null);
  const [isLicenseVerified, setIsLicenseVerified] = useState(false);

  const sanitizeName = (text: string): string => {
    // Only allow alphabetic characters, spaces, and hyphens (e.g., Mary-Ann, Dela Cruz)
    return text.replace(/[^a-zA-Z\s-]/g, "");
  };

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
  useEffect(() => {
    AsyncStorage.getItem("@pending_doctor_access_code").then((savedCode) => {
      if (savedCode) {
        setAccessCode(savedCode.trim().toUpperCase());
      } else {
        // Fallback default dev code if none set
        setAccessCode("SMILE-DOC-2026");
      }
    });
  }, []);

  // ── Specialization Dropdown
  const [showSpecializationDropdown, setShowSpecializationDropdown] = useState(false);

  // ── Selected Image Data
  const [selectedImage, setSelectedImage] = useState<ImagePickerResult | null>(null);

  // Available Dental Specializations
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

  // License number: numbers only, exactly 7 digits (pads with leading zeros if shorter on submit or blur)
  const formatLicenseNumber = (raw: string): string => {
    const digits = raw.replace(/[^0-9]/g, "");
    if (!digits) return "";
    return digits.padStart(7, "0").slice(-7);
  };

  const isValidLicenseNumber = (license: string): boolean => {
    const trimmed = license.trim();
    if (!trimmed) return false;
    // Valid if 1-7 numeric digits (which can be padded to 7 digits)
    return /^\d{1,7}$/.test(trimmed);
  };

  const handleLicenseBlur = async () => {
    const current = (doctorData.license_number || "").trim();
    if (!current) {
      setLicenseDuplicateError(null);
      setIsLicenseVerified(false);
      return;
    }

    const padded = formatLicenseNumber(current);
    if (current.length < 7) {
      updateDoctorData("license_number", padded);
    }

    setIsCheckingLicense(true);
    setIsLicenseVerified(false);
    try {
      const exists = await doctorLicenseExists(padded);
      if (exists) {
        setLicenseDuplicateError("This PRC License Number is already registered to another doctor.");
        setIsLicenseVerified(false);
      } else {
        setLicenseDuplicateError(null);
        setIsLicenseVerified(true);
      }
    } catch (e) {
      console.warn("[DoctorProfileSetup] Failed to verify license uniqueness:", e);
      setIsLicenseVerified(false);
    } finally {
      setIsCheckingLicense(false);
    }
  };

  const updateDoctorData = (key: keyof Doctor, value: any) => {
    setDoctorData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Field completion check for conditional asterisks
  const isFieldComplete = (field: string): boolean => {
    switch (field) {
      case "access_code":
        return accessCode.trim().length >= 4;
      case "license_number":
        return (
          isValidLicenseNumber(doctorData.license_number || "") &&
          isLicenseVerified &&
          !licenseDuplicateError &&
          !isCheckingLicense
        );
      case "specialization":
        return (doctorData.specialization || "").trim().length > 0;
      case "years_of_experience":
        return yearsOfExperienceStr.trim().length > 0 && !isNaN(Number(yearsOfExperienceStr));
      case "first_name":
        return (doctorData.first_name || "").trim().length > 0;
      case "last_name":
        return (doctorData.last_name || "").trim().length > 0;
      case "gender":
        return (doctorData.gender || "").trim().length > 0;
      case "phone":
        return phoneDigits.trim().length === 10;
      default:
        return false;
    }
  };

  const isFormValid = () => {
    return (
      accessCode.trim().length >= 4 &&
      isValidLicenseNumber(doctorData.license_number || "") &&
      isLicenseVerified &&
      !licenseDuplicateError &&
      !isCheckingLicense &&
      (doctorData.specialization || "").trim() !== "" &&
      yearsOfExperienceStr.trim() !== "" &&
      !isNaN(Number(yearsOfExperienceStr)) &&
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
      const image = await pickImage([1, 1]);
      if (!image) return;

      setSelectedImage(image);
      setSelectedImageUri(image.uri);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to pick image";
      Alert.alert("Image Selection Error", message);
      console.error("[DoctorProfileSetup] Image error:", error);
    } finally {
      setUploadingImage(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // SUBMIT: SAVE DOCTOR PROFILE
  // ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!isFormValid()) {
      let errorMsg = "Please complete all required fields.";

      if (!accessCode.trim() || accessCode.trim().length < 4) {
        errorMsg = "Clinic Access Code is missing or invalid.";
      } else if (!isValidLicenseNumber(doctorData.license_number || "")) {
        errorMsg = "Medical License Number must be 1 to 7 numeric digits (e.g. 0123456).";
      } else if (isCheckingLicense) {
        errorMsg = "Please wait while your license number is being verified...";
      } else if (licenseDuplicateError) {
        errorMsg = licenseDuplicateError;
      } else if (!isLicenseVerified) {
        errorMsg = "Please enter your license number and tap outside the field to complete verification.";
      } else if ((doctorData.specialization || "").trim() === "") {
        errorMsg = "Please select a specialization.";
      } else if (yearsOfExperienceStr.trim() === "" || isNaN(Number(yearsOfExperienceStr))) {
        errorMsg = "Please enter your years of experience (1-2 digits).";
      } else if ((doctorData.first_name || "").trim() === "") {
        errorMsg = "Please enter your first name.";
      } else if ((doctorData.last_name || "").trim() === "") {
        errorMsg = "Please enter your last name.";
      } else if ((doctorData.gender || "").trim() === "") {
        errorMsg = "Please select your gender / honorific.";
      } else if (phoneDigits.trim().length !== 10) {
        errorMsg = "Please enter a valid 10-digit phone number after +63 (e.g., 912-345-6789).";
      }

      Alert.alert("Incomplete Details", errorMsg);
      return;
    }

    setLoading(true);
    try {
      const paddedLicense = formatLicenseNumber(doctorData.license_number || "");

      // Pre-flight duplicate check against doctors table
      const duplicateExists = await doctorLicenseExists(paddedLicense);
      if (duplicateExists) {
        setLicenseDuplicateError("This PRC License Number is already registered to another doctor.");
        Alert.alert(
          "Duplicate License Number",
          `License number ${paddedLicense} is already registered to an existing doctor in the system. Please verify your PRC license credentials.`
        );
        setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        throw new Error("User not authenticated. Please log in again.");
      }

      // Pre-seed profile in public.profiles to guarantee existence for doctor_user_id_fkey
      try {
        const constructedName = `${(doctorData.first_name || "").trim()} ${(doctorData.last_name || "").trim()}`.trim() || data.user.email?.split("@")[0] || "Doctor";
        await supabase.from("profiles").upsert(
          [
            {
              id: data.user.id,
              name: constructedName,
              email: data.user.email || "",
              role: "doctor",
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "id" }
        );
      } catch (profPreErr) {
        console.warn("[DoctorProfileSetup] Pre-seed profiles warning:", profPreErr);
      }

      let profileImageUrl = "";
      if (selectedImage) {
        try {
          profileImageUrl = await uploadProfileImage(selectedImage, data.user.id);
        } catch (imageError) {
          console.warn("[DoctorProfileSetup] Image upload failed, continuing without image:", imageError);
        }
      }

      const fullPhoneNumber = `+63${formatPhoneChunks(phoneDigits.trim())}`;
      const finalDoctorData: Doctor = {
        ...doctorData,
        user_id: data.user.id,
        first_name: (doctorData.first_name || "").trim(),
        middle_name: (doctorData.middle_name || "").trim(),
        last_name: (doctorData.last_name || "").trim(),
        doctor_phone: fullPhoneNumber,
        years_of_experience: Number(yearsOfExperienceStr) || 0,
        license_number: paddedLicense,
        profile_picture_url: profileImageUrl || undefined,
      };

      const result = await createDoctorProfile(finalDoctorData, accessCode.trim());
      if (!result) {
        throw new Error("Failed to save doctor profile. Please try again.");
      }

      onContinue();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save profile. Please try again.";
      console.error("[DoctorProfileSetup] Error saving profile:", err);
      Alert.alert("Registration Error", message);
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" animated={true} />

      {/* Module Top Header */}
      <View style={styles.topHeader}>
        {onCancel ? (
          <TouchableOpacity
            style={styles.headerBackBtn}
            onPress={onCancel}
            disabled={loading}
            activeOpacity={0.7}
            accessibilityLabel="Back to Initial Screen"
          >
            <ChevronLeft size={16} color="#047857" strokeWidth={2.5} />
            <Text style={styles.headerBackBtnText}>Back</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}

        <View style={styles.headerTitleGroup}>
          <Text style={styles.topHeaderTitle}>DOCTOR REGISTRATION</Text>
        </View>

        <View style={styles.headerStepPill}>
          <Text style={styles.headerStepPillText}>Step 1 of 2</Text>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Registration Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroBadgeRow}>
            <View style={styles.heroIconBox}>
              <Stethoscope size={18} color="#047857" strokeWidth={2.3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Professional Credentials</Text>
              <Text style={styles.heroSubtitle}>
                Complete your medical practitioner registration to activate your SmileGuard clinic portal.
              </Text>
            </View>
          </View>
        </View>

        {/* Section 1: Clinic Verification */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeaderWrap}>
            <Building2 size={13} color="#047857" />
            <Text style={styles.formSectionTitle}>CLINIC VERIFICATION</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>CLINIC ACCESS CODE</Text>
                {!isFieldComplete("access_code") ? (
                  <Text style={styles.requiredStar}>*</Text>
                ) : (
                  <CheckCircle2 size={12} color="#047857" />
                )}
              </View>

              <View style={styles.lockedInputWrap}>
                <Lock size={14} color="#64748B" style={{ marginLeft: 12, marginRight: 6 }} />
                <TextInput
                  style={styles.lockedInput}
                  value={accessCode}
                  editable={false}
                  selectTextOnFocus={false}
                  placeholder="Clinic Code"
                  placeholderTextColor="#94A3B8"
                />
                <View style={styles.verifiedBadge}>
                  <ShieldCheck size={12} color="#047857" style={{ marginRight: 4 }} />
                  <Text style={styles.verifiedBadgeText}>Verified</Text>
                </View>
              </View>
              <Text style={styles.fieldNote}>
                Authenticated by your dental clinic administrator during initial setup.
              </Text>
            </View>
          </View>
        </View>

        {/* Section 2: Portrait Photo */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeaderWrap}>
            <User size={13} color="#047857" />
            <Text style={styles.formSectionTitle}>DOCTOR PORTRAIT</Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.avatarRow}>
              <TouchableOpacity
                onPress={handleImagePick}
                disabled={uploadingImage || loading}
                style={styles.avatarContainer}
                activeOpacity={0.8}
              >
                {selectedImageUri ? (
                  <Image source={{ uri: selectedImageUri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <User size={36} color="#94A3B8" />
                  </View>
                )}

                {uploadingImage ? (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={styles.cameraBadge}>
                    <Camera size={13} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.avatarInfoCol}>
                <Text style={styles.avatarTitle}>Professional Portrait</Text>
                <Text style={styles.avatarSubtitle}>
                  Displayed to patients on appointment bookings and medical receipts.
                </Text>
                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={handleImagePick}
                  disabled={uploadingImage || loading}
                  activeOpacity={0.75}
                >
                  <Camera size={13} color="#047857" style={{ marginRight: 6 }} />
                  <Text style={styles.uploadBtnText}>
                    {selectedImageUri ? "Change Photo" : "Upload Photo"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Section 3: Practitioner Identity */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeaderWrap}>
            <User size={13} color="#047857" />
            <Text style={styles.formSectionTitle}>DOCTOR IDENTITY</Text>
          </View>

          <View style={styles.formCard}>
            {/* First Name & Last Name Split Row */}
            <View style={styles.splitRow}>
              <View style={styles.splitCol}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>FIRST NAME</Text>
                  {!isFieldComplete("first_name") && <Text style={styles.requiredStar}>*</Text>}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Mart"
                  placeholderTextColor="#94A3B8"
                  value={doctorData.first_name || ""}
                  onChangeText={(text) => updateDoctorData("first_name", sanitizeName(text))}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.splitCol}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>LAST NAME</Text>
                  {!isFieldComplete("last_name") && <Text style={styles.requiredStar}>*</Text>}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Yanga"
                  placeholderTextColor="#94A3B8"
                  value={doctorData.last_name || ""}
                  onChangeText={(text) => updateDoctorData("last_name", sanitizeName(text))}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Middle Name (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>MIDDLE NAME (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Lee"
                placeholderTextColor="#94A3B8"
                value={doctorData.middle_name || ""}
                onChangeText={(text) => updateDoctorData("middle_name", sanitizeName(text))}
                autoCapitalize="words"
              />
            </View>

            {/* Honorific Prefix / Gender */}
            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>HONORIFIC PREFIX</Text>
                {!isFieldComplete("gender") && <Text style={styles.requiredStar}>*</Text>}
              </View>

              <View style={styles.genderRow}>
                {[
                  { label: "Male (Dr.)", value: "Male" },
                  { label: "Female (Dra.)", value: "Female" },
                ].map((item) => {
                  const isSelected = (doctorData.gender || "").toLowerCase() === item.value.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[styles.genderBtn, isSelected && styles.genderBtnActive]}
                      onPress={() => updateDoctorData("gender", item.value)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.genderBtnText, isSelected && styles.genderBtnTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* Section 4: PRC Credentials & Practice */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeaderWrap}>
            <ShieldCheck size={13} color="#047857" />
            <Text style={styles.formSectionTitle}>PRC CREDENTIALS & SPECIALTY</Text>
          </View>

          <View style={styles.formCard}>
            {/* PRC License Input (7 digits, numbers only) */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>PRC DENTAL LICENSE NO.</Text>
                {!isFieldComplete("license_number") && <Text style={styles.requiredStar}>*</Text>}
              </View>
              <TextInput
                style={styles.input}
                placeholder="e.g. 0123456"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={7}
                value={doctorData.license_number || ""}
                onChangeText={(text) => {
                  const numericOnly = text.replace(/[^0-9]/g, "").slice(0, 7);
                  updateDoctorData("license_number", numericOnly);
                  if (licenseDuplicateError) setLicenseDuplicateError(null);
                  setIsLicenseVerified(false);
                }}
                onBlur={handleLicenseBlur}
              />

              {isCheckingLicense && (
                <View style={styles.validationRow}>
                  <View style={styles.feedbackChecking}>
                    <ActivityIndicator size="small" color="#047857" style={{ marginRight: 6 }} />
                    <Text style={styles.feedbackCheckingText}>Verifying license uniqueness...</Text>
                  </View>
                </View>
              )}

              {!isCheckingLicense && licenseDuplicateError && (
                <View style={styles.validationRow}>
                  <View style={styles.feedbackError}>
                    <AlertCircle size={12} color="#EF4444" style={{ marginRight: 4 }} />
                    <Text style={styles.feedbackErrorText}>{licenseDuplicateError}</Text>
                  </View>
                </View>
              )}

              {!isCheckingLicense && !licenseDuplicateError && isLicenseVerified && (doctorData.license_number || "").length > 0 && (
                <View style={styles.validationRow}>
                  <View style={styles.feedbackSuccess}>
                    <ShieldCheck size={12} color="#047857" style={{ marginRight: 4 }} />
                    <Text style={styles.feedbackSuccessText}>PRC License verified & available</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Specialization & Experience (Split Row) */}
            <View style={styles.splitRow}>
              <View style={[styles.splitCol, { flex: 1.4 }]}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>SPECIALIZATION</Text>
                  {!isFieldComplete("specialization") && <Text style={styles.requiredStar}>*</Text>}
                </View>
                <TouchableOpacity
                  style={styles.dropdownBtn}
                  onPress={() => setShowSpecializationDropdown(true)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: doctorData.specialization ? "700" : "500",
                      color: doctorData.specialization ? "#0F172A" : "#94A3B8",
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {doctorData.specialization || "Select Specialty"}
                  </Text>
                  <ChevronDown size={15} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.splitCol}>
                <View style={styles.labelRow}>
                  <Text style={styles.inputLabel}>EXPERIENCE</Text>
                  {!isFieldComplete("years_of_experience") && <Text style={styles.requiredStar}>*</Text>}
                </View>
                <View style={styles.expInputWrap}>
                  <Clock size={14} color="#047857" style={{ marginLeft: 8, marginRight: 4 }} />
                  <TextInput
                    style={styles.expInput}
                    placeholder="Yrs (2 digits)"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={2}
                    value={yearsOfExperienceStr}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9]/g, "").slice(0, 2);
                      setYearsOfExperienceStr(cleaned);
                      updateDoctorData("years_of_experience", cleaned ? parseInt(cleaned, 10) : 0);
                    }}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Section 5: Direct Contact */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeaderWrap}>
            <Phone size={13} color="#047857" />
            <Text style={styles.formSectionTitle}>DIRECT CONTACT NUMBER</Text>
          </View>

          <View style={styles.formCard}>
            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>MOBILE PHONE</Text>
                {!isFieldComplete("phone") && <Text style={styles.requiredStar}>*</Text>}
              </View>

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
                <View style={styles.phonePrefixContainer}>
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
            </View>
          </View>
        </View>

        {/* Section 6: Professional Bio */}
        <View style={styles.formSection}>
          <View style={styles.sectionHeaderWrap}>
            <FileText size={13} color="#047857" />
            <Text style={styles.formSectionTitle}>PRACTITIONER BIOGRAPHY</Text>
          </View>

          <View style={styles.formCard}>
            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <View style={styles.labelRow}>
                <Text style={styles.inputLabel}>DOCTOR'S BIOGRAPHY (OPTIONAL)</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textAreaInput]}
                placeholder="Share your dental school, clinical experience, specializations, and patient care philosophy (optional)..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={doctorData.bio || ""}
                onChangeText={(text) => updateDoctorData("bio", text)}
              />
            </View>
          </View>
        </View>

        {/* Submit Action Card */}
        <View style={styles.actionCard}>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (!isFormValid() || loading) && styles.primaryBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading || !isFormValid()}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Sparkles size={15} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={styles.primaryBtnText}>Continue to Clinic Setup</Text>
              </>
            )}
          </TouchableOpacity>

          {onCancel && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>Cancel and Return to Welcome Screen</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Specialization Picker Modal */}
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
            <View style={styles.dropdownHeaderRow}>
              <Text style={styles.dropdownHeaderTitle}>Select Specialization</Text>
              <TouchableOpacity
                onPress={() => setShowSpecializationDropdown(false)}
                style={styles.dropdownCloseBtn}
              >
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.dropdownList}>
              {specializations.map((spec) => {
                const isSelected = doctorData.specialization === spec;
                return (
                  <TouchableOpacity
                    key={spec}
                    style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                    onPress={() => {
                      updateDoctorData("specialization", spec);
                      setShowSpecializationDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}
                    >
                      {spec}
                    </Text>
                    {isSelected && <ShieldCheck size={16} color="#047857" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1.5,
    borderBottomColor: "#E2E8F0",
  },
  headerBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  headerBackBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#047857",
  },
  headerTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  topHeaderTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.6,
  },
  headerStepPill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  headerStepPillText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#475569",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // Hero Banner
  heroBanner: {
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    padding: 14,
    marginBottom: 16,
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroIconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    justifyContent: "center",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#047857",
  },
  heroSubtitle: {
    fontSize: 11.5,
    color: "#334155",
    marginTop: 2,
    lineHeight: 16,
  },

  // Form Sections
  formSection: {
    marginBottom: 16,
  },
  sectionHeaderWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingLeft: 2,
  },
  formSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    padding: 14,
  },
  inputGroup: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 5,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.4,
  },
  requiredStar: {
    fontSize: 12,
    fontWeight: "800",
    color: "#EF4444",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },
  textAreaInput: {
    height: 72,
    textAlignVertical: "top",
    paddingTop: 8,
  },

  // Locked Access Code
  lockedInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  lockedInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
    letterSpacing: 0.6,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  verifiedBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#047857",
  },
  fieldNote: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 5,
  },

  // Avatar Row
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarContainer: {
    position: "relative",
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: "#047857",
  },
  avatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarOverlay: {
    position: "absolute",
    inset: 0,
    borderRadius: 34,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#047857",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInfoCol: {
    flex: 1,
  },
  avatarTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  avatarSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 15,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginTop: 8,
  },
  uploadBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#047857",
  },

  // Split Rows
  splitRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  splitCol: {
    flex: 1,
  },

  // Gender Buttons
  genderRow: {
    flexDirection: "row",
    gap: 8,
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  genderBtnActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#047857",
    borderBottomWidth: 2.5,
  },
  genderBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  genderBtnTextActive: {
    color: "#047857",
    fontWeight: "800",
  },

  // Dropdown Button
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    paddingHorizontal: 10,
    paddingVertical: 9,
  },

  // Experience Input
  expInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
  },
  expInput: {
    flex: 1,
    paddingVertical: 9,
    paddingRight: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },

  // Validation
  validationRow: {
    marginTop: 6,
  },
  feedbackSuccess: {
    flexDirection: "row",
    alignItems: "center",
  },
  feedbackSuccessText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  feedbackChecking: {
    flexDirection: "row",
    alignItems: "center",
  },
  feedbackCheckingText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#047857",
  },
  feedbackError: {
    flexDirection: "row",
    alignItems: "center",
  },
  feedbackErrorText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#EF4444",
  },

  // Phone Container
  phoneContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    overflow: "hidden",
  },
  phoneContainerValid: {
    borderColor: "#047857",
  },
  phoneContainerInvalid: {
    borderColor: "#EF4444",
  },
  phonePrefixContainer: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRightWidth: 1,
    borderRightColor: "#CBD5E1",
  },
  phonePrefixText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#047857",
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },

  // Action Buttons
  actionCard: {
    marginTop: 8,
    gap: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#047857",
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#064E3B",
    borderBottomWidth: 3,
    borderBottomColor: "#022C22",
  },
  primaryBtnDisabled: {
    backgroundColor: "#94A3B8",
    borderColor: "#64748B",
    borderBottomColor: "#475569",
    opacity: 0.7,
  },
  primaryBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  secondaryBtn: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textDecorationLine: "underline",
  },

  // Modal Dropdown
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  dropdownContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: "70%",
    paddingBottom: 24,
  },
  dropdownHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  dropdownHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  dropdownCloseBtn: {
    padding: 4,
  },
  dropdownList: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownItemSelected: {
    backgroundColor: "#ECFDF5",
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  dropdownItemTextSelected: {
    color: "#047857",
    fontWeight: "800",
  },
});
