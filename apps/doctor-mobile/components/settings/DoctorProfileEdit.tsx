import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Image,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Doctor, EMPTY_DOCTOR } from "@smileguard/shared-types";
import {
  X,
  Check,
  Camera,
  User,
  AlertCircle,
  RefreshCw,
  Trash2,
  Plus,
  ChevronDown,
  Award,
  Stethoscope,
  Clock,
  Phone,
  Image as ImageIcon,
  ShieldCheck,
  FileText,
} from "lucide-react-native";
import {
  pickImage,
  uploadProfileImage,
  listDoctorProfileImages,
  deleteProfileImage,
  ImagePickerResult,
  UploadedProfileImage,
} from "../../lib/imageUploadService";
import { doctorLicenseExists } from "../../lib/doctorService";

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
  const [isCheckingLicense, setIsCheckingLicense] = useState(false);
  const [licenseDuplicateError, setLicenseDuplicateError] = useState<string | null>(null);
  const [isLicenseVerified, setIsLicenseVerified] = useState(true);

  // Bucket photos state
  const [uploadedImages, setUploadedImages] = useState<UploadedProfileImage[]>([]);
  const [loadingBucketImages, setLoadingBucketImages] = useState(true);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

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

  const extractPhoneDigits = (phone?: string): string => {
    if (!phone) return "";
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("63") && cleaned.length > 10) {
      cleaned = cleaned.slice(2);
    } else if (cleaned.startsWith("0")) {
      cleaned = cleaned.slice(1);
    }
    return cleaned.slice(0, 10);
  };

  const [phoneDigits, setPhoneDigits] = useState<string>(() => {
    const existing =
      doctor?.doctor_phone ||
      (doctor as any)?.phone_number ||
      (doctor as any)?.clinic_phone ||
      "";
    return extractPhoneDigits(existing);
  });
  const [phoneDisplay, setPhoneDisplay] = useState<string>(() => {
    const existing =
      doctor?.doctor_phone ||
      (doctor as any)?.phone_number ||
      (doctor as any)?.clinic_phone ||
      "";
    const digits = extractPhoneDigits(existing);
    return digits.length === 10 ? formatPhoneChunks(digits) : digits;
  });

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

  const getEffectiveUserId = useCallback((): string => {
    return (
      doctorData.user_id ||
      doctor.user_id ||
      doctorData.id ||
      doctor.id ||
      "doctor"
    );
  }, [doctorData.user_id, doctorData.id, doctor.user_id, doctor.id]);

  const loadBucketImages = useCallback(async () => {
    try {
      setLoadingBucketImages(true);
      const userIds = [doctorData.user_id, doctor.user_id, doctorData.id, doctor.id].filter(
        (id): id is string => Boolean(id) && id !== "doctor"
      );
      if (userIds.length === 0) userIds.push("doctor");

      const images = await listDoctorProfileImages(userIds);
      setUploadedImages(images);

      if (doctor.profile_picture_url && !imagePreviewUri) {
        setImagePreviewUri(doctor.profile_picture_url);
      }
    } catch (err) {
      console.error("[DoctorProfileEdit] Failed to load bucket images:", err);
    } finally {
      setLoadingBucketImages(false);
    }
  }, [doctorData.user_id, doctorData.id, doctor.user_id, doctor.id, doctor.profile_picture_url]);

  useEffect(() => {
    loadBucketImages();
  }, [loadBucketImages]);

  useEffect(() => {
    if (doctor) {
      const parts = (doctor.doctor_name || (doctor as any).name || "").trim().split(" ");
      const fallbackFirst = parts[0] || "";
      const fallbackLast = parts.length > 1 ? parts.slice(1).join(" ") : "";
      const existingPhone =
        doctor.doctor_phone ||
        (doctor as any)?.phone_number ||
        (doctor as any)?.clinic_phone ||
        "";
      const digits = extractPhoneDigits(existingPhone);
      setPhoneDigits(digits);
      setPhoneDisplay(digits.length === 10 ? formatPhoneChunks(digits) : digits);

      setDoctorData({
        ...EMPTY_DOCTOR,
        ...doctor,
        first_name: doctor.first_name || fallbackFirst,
        middle_name: doctor.middle_name || "",
        last_name: doctor.last_name || fallbackLast,
        gender: doctor.gender || "",
        doctor_phone: digits.length === 10 ? `+63${formatPhoneChunks(digits)}` : existingPhone,
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

  const formatLicenseNumber = (raw?: string): string => {
    if (!raw) return "";
    const digits = raw.replace(/[^0-9]/g, "");
    if (!digits) return "";
    return digits.padStart(7, "0").slice(-7);
  };

  const isValidLicenseNumber = (license?: string): boolean => {
    if (!license) return false;
    const trimmed = license.trim();
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
      const ownId = doctor?.id || doctor?.user_id;
      const exists = await doctorLicenseExists(padded, ownId);
      if (exists) {
        setLicenseDuplicateError("This PRC License Number is already registered to another doctor.");
        setIsLicenseVerified(false);
      } else {
        setLicenseDuplicateError(null);
        setIsLicenseVerified(true);
      }
    } catch (e) {
      console.warn("[DoctorProfileEdit] Failed to verify license uniqueness:", e);
      setIsLicenseVerified(false);
    } finally {
      setIsCheckingLicense(false);
    }
  };

  const handlePickAndUploadImage = async () => {
    try {
      const result = await pickImage([1, 1]);
      if (!result) return;

      setSelectedImage(result);
      setImagePreviewUri(result.uri);

      setUploadingImage(true);
      const userId = getEffectiveUserId();
      try {
        const uploadedUrl = await uploadProfileImage(result, userId);
        setImagePreviewUri(uploadedUrl);
        updateDoctorData("profile_picture_url", uploadedUrl);
        setSelectedImage(null);

        const newPhoto: UploadedProfileImage = {
          id: `img_${Date.now()}`,
          name: result.name || `profile_${Date.now()}`,
          url: uploadedUrl,
          createdAt: new Date().toISOString(),
          fullPath: `profile/${userId}/${result.name}`,
        };
        setUploadedImages((prev) => [newPhoto, ...prev.filter((p) => p.url !== uploadedUrl)]);
      } catch (uploadError) {
        console.warn("[DoctorProfileEdit] Immediate upload failed, keeping staged locally:", uploadError);
      } finally {
        setUploadingImage(false);
      }
    } catch (error) {
      console.error("[DoctorProfileEdit] Failed to pick image:", error);
      Alert.alert(
        "Image Selection Failed",
        error instanceof Error ? error.message : "Failed to select image from gallery"
      );
    }
  };

  const handleSelectBucketPhoto = (photo: UploadedProfileImage) => {
    setSelectedImage(null);
    setImagePreviewUri(photo.url);
    updateDoctorData("profile_picture_url", photo.url);
  };

  const handleDeleteBucketPhoto = (photo: UploadedProfileImage) => {
    Alert.alert(
      "Delete Photo",
      "Are you sure you want to permanently delete this photo from your storage bucket?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingImageId(photo.id);
              await deleteProfileImage(photo.fullPath || photo.url);

              setUploadedImages((prev) =>
                prev.filter((p) => p.id !== photo.id && p.url !== photo.url)
              );

              if (imagePreviewUri === photo.url) {
                const remaining = uploadedImages.filter(
                  (p) => p.id !== photo.id && p.url !== photo.url
                );
                const nextUrl = remaining.length > 0 ? remaining[0].url : "";
                setImagePreviewUri(nextUrl);
                updateDoctorData("profile_picture_url", nextUrl);
              }

              Alert.alert("Success", "Photo successfully deleted from storage.");
            } catch (err) {
              console.error("[DoctorProfileEdit] Delete failed:", err);
              const errMsg =
                err instanceof Error ? err.message : "Could not remove the photo from storage.";
              Alert.alert("Delete Failed", errMsg);
            } finally {
              setDeletingImageId(null);
            }
          },
        },
      ]
    );
  };

  const validateForm = (): string | null => {
    const firstName = (doctorData.first_name || "").trim();
    if (!firstName) return "First Name is required.";

    const lastName = (doctorData.last_name || "").trim();
    if (!lastName) return "Last Name is required.";

    const license = (doctorData.license_number || "").trim();
    if (!license) return "Medical License Number is required.";
    if (!isValidLicenseNumber(license)) {
      return "Medical License Number must be 1 to 7 numeric digits.";
    }
    if (licenseDuplicateError) {
      return licenseDuplicateError;
    }

    const spec = (doctorData.specialization || "").trim();
    if (!spec) return "Please select a specialization.";

    if (phoneDigits.length > 0 && phoneDigits.length !== 10) {
      return "Please enter a valid 10-digit phone number after +63 (e.g., 912-345-6789).";
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert("Validation Error", validationError);
      return;
    }

    setLoading(true);
    try {
      const paddedLicense = formatLicenseNumber(doctorData.license_number || "");
      const ownId = doctor?.id || doctor?.user_id;
      const isDuplicate = await doctorLicenseExists(paddedLicense, ownId);
      if (isDuplicate) {
        setLicenseDuplicateError("This PRC License Number is already registered to another doctor.");
        Alert.alert(
          "Duplicate License Number",
          `License number ${paddedLicense} is already registered to an existing doctor in the system. Please verify your PRC license credentials.`
        );
        setLoading(false);
        return;
      }

      let finalPictureUrl = imagePreviewUri || doctorData.profile_picture_url || "";

      if (selectedImage) {
        setUploadingImage(true);
        try {
          const userId = getEffectiveUserId();
          finalPictureUrl = await uploadProfileImage(selectedImage, userId);
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

      const fullPhoneNumber =
        phoneDigits.length === 10
          ? `+63${formatPhoneChunks(phoneDigits.trim())}`
          : (doctorData.doctor_phone || "").trim();

      const updatedPayload: Partial<Doctor> = {
        ...doctorData,
        first_name: (doctorData.first_name || "").trim(),
        middle_name: (doctorData.middle_name || "").trim(),
        last_name: (doctorData.last_name || "").trim(),
        gender: (doctorData.gender || "").trim(),
        license_number: formatLicenseNumber(doctorData.license_number || ""),
        specialization: (doctorData.specialization || "").trim(),
        doctor_phone: fullPhoneNumber,
        bio: (doctorData.bio || "").trim(),
        years_of_experience: Number(doctorData.years_of_experience) || 0,
        profile_picture_url: finalPictureUrl,
      };

      delete (updatedPayload as any).is_available;
      delete (updatedPayload as any).doctor_name;

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
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" animated={true} />
      {/* Module Top Header (No Badge) */}
      <View style={styles.topHeader}>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.topHeaderTitle}>EDIT DOCTOR PROFILE</Text>
        </View>

        <TouchableOpacity
          onPress={onCancel}
          disabled={loading || uploadingImage}
          style={styles.closeActionBtn}
          activeOpacity={0.7}
          accessibilityLabel="Cancel Edit"
        >
          <X size={17} color="#047857" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Studio Avatar Split Card */}
        <View style={styles.studioAvatarCard}>
          <View style={styles.avatarSplitRow}>
            {/* Left: Avatar with Camera Trigger */}
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handlePickAndUploadImage}
              disabled={loading || uploadingImage}
              activeOpacity={0.8}
            >
              {imagePreviewUri ? (
                <Image source={{ uri: imagePreviewUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={38} color="#94A3B8" />
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

            {/* Right: Studio Action Column */}
            <View style={styles.studioInfoCol}>
              <Text style={styles.studioDoctorName} numberOfLines={1}>
                {doctorData.first_name || doctorData.last_name
                  ? `${doctorData.first_name || ""} ${doctorData.last_name || ""}`.trim()
                  : "Doctor Profile Photo"}
              </Text>
              <Text style={styles.studioSubtext}>
                Professional portrait for patient bookings
              </Text>

              <TouchableOpacity
                onPress={handlePickAndUploadImage}
                disabled={loading || uploadingImage}
                style={styles.uploadBtn}
                activeOpacity={0.75}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#047857" style={{ marginRight: 6 }} />
                ) : (
                  <Camera size={14} color="#047857" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.uploadBtnText}>
                  {uploadingImage ? "Uploading..." : "Upload New Photo"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Horizontal Staged Photos Filmstrip */}
          <View style={styles.filmstripSection}>
            <View style={styles.filmstripHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ImageIcon size={13} color="#047857" />
                <Text style={styles.filmstripTitle}>Stored Photos</Text>
                <View style={styles.filmstripCountPill}>
                  <Text style={styles.filmstripCountText}>
                    {loadingBucketImages ? "..." : `${uploadedImages.length}`}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={loadBucketImages}
                disabled={loadingBucketImages}
                style={styles.refreshBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <RefreshCw
                  size={13}
                  color={loadingBucketImages ? "#94A3B8" : "#047857"}
                />
              </TouchableOpacity>
            </View>

            {loadingBucketImages ? (
              <View style={styles.loadingGalleryRow}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={styles.loadingGalleryText}>Loading photos from bucket...</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filmstripScroll}
              >
                {/* Upload Staged Tile */}
                <TouchableOpacity
                  style={styles.uploadTile}
                  onPress={handlePickAndUploadImage}
                  disabled={loading || uploadingImage}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color="#047857" strokeWidth={2.5} />
                  <Text style={styles.uploadTileText}>Add</Text>
                </TouchableOpacity>

                {uploadedImages.map((photo, idx) => {
                  const isSelected = imagePreviewUri === photo.url;
                  const isDeleting = deletingImageId === photo.id;

                  return (
                    <View
                      key={photo.id || photo.url || idx}
                      style={[
                        styles.photoTile,
                        isSelected && styles.photoTileActive,
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.photoTileMain}
                        onPress={() => handleSelectBucketPhoto(photo)}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: photo.url }} style={styles.photoTileImage} />
                        {isSelected && (
                          <View style={styles.activeCheckBadge}>
                            <Check size={10} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deletePhotoBtn}
                        onPress={() => handleDeleteBucketPhoto(photo)}
                        disabled={isDeleting}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Trash2 size={10} color="#FFFFFF" />
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>

        {/* Section: Doctor Identification (2-Column Split Row) */}
        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>DOCTOR IDENTITY</Text>

          <View style={styles.formCard}>
            {/* Split Row: First Name & Last Name */}
            <View style={styles.splitRow}>
              <View style={styles.splitCol}>
                <Text style={styles.inputLabel}>FIRST NAME *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Maria"
                  placeholderTextColor="#94A3B8"
                  value={doctorData.first_name || ""}
                  onChangeText={(text) => updateDoctorData("first_name", sanitizeName(text))}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.splitCol}>
                <Text style={styles.inputLabel}>LAST NAME *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Santos"
                  placeholderTextColor="#94A3B8"
                  value={doctorData.last_name || ""}
                  onChangeText={(text) => updateDoctorData("last_name", sanitizeName(text))}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Middle Name Full Width */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>MIDDLE NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Clara (optional)"
                placeholderTextColor="#94A3B8"
                value={doctorData.middle_name || ""}
                onChangeText={(text) => updateDoctorData("middle_name", sanitizeName(text))}
                autoCapitalize="words"
              />
            </View>

            {/* Gender Honorific Selector */}
            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <Text style={styles.inputLabel}>HONORIFIC PREFIX</Text>
              <View style={styles.genderRow}>
                {[
                  { label: "Male (Dr.)", value: "Male" },
                  { label: "Female (Dra.)", value: "Female" },
                ].map((item) => {
                  const isSelected =
                    (doctorData.gender || "").toLowerCase() === item.value.toLowerCase();
                  return (
                    <TouchableOpacity
                      key={item.value}
                      style={[
                        styles.genderBtn,
                        isSelected ? styles.genderBtnActive : styles.genderBtnInactive,
                      ]}
                      onPress={() => updateDoctorData("gender", item.value)}
                      activeOpacity={0.7}
                    >
                      <Award
                        size={13}
                        color={isSelected ? "#FFFFFF" : "#64748B"}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.genderBtnText,
                          isSelected ? styles.genderBtnTextActive : styles.genderBtnTextInactive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* Section: Medical Credentials & License */}
        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>PRC CREDENTIALS & PRACTICE</Text>

          <View style={styles.formCard}>
            {/* License Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PRC MEDICAL / DENTAL LICENSE NO. *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 0123456 (7 digits)"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={7}
                value={licenseNum}
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
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <ActivityIndicator size="small" color="#047857" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 11, fontWeight: "600", color: "#047857" }}>
                      Verifying license uniqueness...
                    </Text>
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

              {!isCheckingLicense && !licenseDuplicateError && isLicenseVerified && licenseNum.length > 0 && (
                <View style={styles.validationRow}>
                  <View style={styles.feedbackSuccess}>
                    <ShieldCheck size={12} color="#047857" style={{ marginRight: 4 }} />
                    <Text style={styles.feedbackSuccessText}>PRC License verified & available</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Specialty Picker & Years Experience in Split Layout */}
            <View style={styles.splitRow}>
              <View style={[styles.splitCol, { flex: 1.4 }]}>
                <Text style={styles.inputLabel}>SPECIALIZATION *</Text>
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
                <Text style={styles.inputLabel}>EXP (YEARS)</Text>
                <View style={styles.expInputWrap}>
                  <Clock size={14} color="#047857" style={{ marginLeft: 8, marginRight: 4 }} />
                  <TextInput
                    style={styles.expInput}
                    placeholder="e.g. 5"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    maxLength={2}
                    value={
                      doctorData.years_of_experience !== undefined &&
                        doctorData.years_of_experience !== null
                        ? doctorData.years_of_experience.toString()
                        : ""
                    }
                    onChangeText={(text) => {
                      const clean = text.replace(/[^0-9]/g, "").slice(0, 2);
                      updateDoctorData("years_of_experience", clean === "" ? 0 : parseInt(clean, 10));
                    }}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Communication & Contact */}
        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>CONTACT NUMBER</Text>

          <View style={styles.formCard}>
            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <Text style={styles.inputLabel}>DOCTOR MOBILE PHONE</Text>
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

        {/* Section: Clinical Bio */}
        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>DOCTOR'S BIOGRAPHY</Text>

          <View style={styles.formCard}>
            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <TextInput
                style={[styles.input, styles.textAreaInput]}
                placeholder="Share your dental school, clinical experience, specializations, and patient care approach..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={doctorData.bio || ""}
                onChangeText={(text) => updateDoctorData("bio", text)}
              />
            </View>
          </View>
        </View>

        {/* Sticky Action Footer */}
        <View style={styles.actionFooter}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            disabled={loading || uploadingImage}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveBtn,
              (loading || uploadingImage) && styles.btnDisabled,
            ]}
            onPress={handleSave}
            disabled={loading || uploadingImage}
            activeOpacity={0.8}
          >
            {loading || uploadingImage ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.saveBtnText}>Save Profile</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Specialty Picker Modal */}
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
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Stethoscope size={18} color="#047857" />
                <Text style={styles.modalTitle}>Select Dental Specialty</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSpecializationDropdown(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
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
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        isSelected && styles.dropdownOptionTextSelected,
                      ]}
                    >
                      {spec}
                    </Text>
                    {isSelected && <Check size={18} color="#047857" strokeWidth={2.5} />}
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
// STYLES: STUDIO MULTI-STAGE FORM ARCHETYPE
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

  // Module Top Header
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
  closeActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },

  // Studio Avatar Split Card
  studioAvatarCard: {
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
  avatarSplitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    position: "relative",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    borderColor: "#10B981",
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#ECFDF5",
    borderWidth: 2.5,
    borderColor: "#A7F3D0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#047857",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  studioInfoCol: {
    flex: 1,
  },
  studioDoctorName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  studioSubtext: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 8,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    alignSelf: "flex-start",
  },
  uploadBtnText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#047857",
  },

  // Filmstrip Drawer
  filmstripSection: {
    paddingTop: 10,
  },
  filmstripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  filmstripTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0F172A",
  },
  filmstripCountPill: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  filmstripCountText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#047857",
  },
  refreshBtn: {
    padding: 3,
  },
  loadingGalleryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  loadingGalleryText: {
    fontSize: 11,
    color: "#64748B",
  },
  filmstripScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  uploadTile: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    gap: 2,
  },
  uploadTileText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#047857",
  },
  photoTile: {
    width: 56,
    height: 56,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  photoTileActive: {
    borderColor: "#047857",
    borderWidth: 2,
  },
  photoTileMain: {
    width: "100%",
    height: "100%",
  },
  photoTileImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  activeCheckBadge: {
    position: "absolute",
    top: 2,
    left: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#047857",
    justifyContent: "center",
    alignItems: "center",
  },
  deletePhotoBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },

  // Form Sections & Cards
  formSection: {
    marginBottom: 16,
  },
  formSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingLeft: 2,
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
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  splitRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  splitCol: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.4,
    marginBottom: 5,
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
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  textAreaInput: {
    minHeight: 84,
    paddingTop: 10,
  },

  // Gender Row
  genderRow: {
    flexDirection: "row",
    gap: 10,
  },
  genderBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  genderBtnActive: {
    backgroundColor: "#047857",
    borderWidth: 1,
    borderColor: "#064E3B",
    borderBottomWidth: 2.5,
    borderBottomColor: "#022C22",
  },
  genderBtnInactive: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
  },
  genderBtnText: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  genderBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  genderBtnTextInactive: {
    color: "#475569",
    fontWeight: "700",
  },

  // Validation Row
  validationRow: {
    marginTop: 6,
  },
  feedbackSuccess: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    alignSelf: "flex-start",
  },
  feedbackSuccessText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#047857",
  },
  feedbackError: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FECACA",
    alignSelf: "flex-start",
  },
  feedbackErrorText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#EF4444",
  },

  // Dropdown Button
  dropdownBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
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
    height: 40,
  },
  expInput: {
    flex: 1,
    padding: 0,
    paddingHorizontal: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },

  // Phone Input
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
    borderColor: "#10B981",
  },
  phoneContainerInvalid: {
    borderColor: "#EF4444",
  },
  phonePrefixContainer: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRightWidth: 1,
    borderRightColor: "#A7F3D0",
  },
  phonePrefixText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#047857",
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A",
  },

  // Action Footer
  actionFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
    marginBottom: 24,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.3,
  },
  saveBtn: {
    flex: 1.8,
    backgroundColor: "#047857",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#064E3B",
    borderBottomWidth: 3,
    borderBottomColor: "#022C22",
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#047857",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // Modal Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    padding: 20,
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.3,
  },
  dropdownOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginVertical: 2,
  },
  dropdownOptionSelected: {
    backgroundColor: "#ECFDF5",
  },
  dropdownOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  dropdownOptionTextSelected: {
    color: "#047857",
    fontWeight: "800",
  },
});
