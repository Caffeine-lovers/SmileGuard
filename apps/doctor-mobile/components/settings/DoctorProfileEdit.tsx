import React, { useState, useEffect, useCallback } from "react";
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
import {
  X,
  Check,
  Camera,
  User,
  AlertCircle,
  RefreshCw,
  Trash2,
  Plus,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react-native";
import {
  pickImage,
  uploadProfileImage,
  listDoctorProfileImages,
  deleteProfileImage,
  ImagePickerResult,
  UploadedProfileImage,
} from "../../lib/imageUploadService";

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

  // Bucket photos state
  const [uploadedImages, setUploadedImages] = useState<UploadedProfileImage[]>([]);
  const [loadingBucketImages, setLoadingBucketImages] = useState(true);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  const getEffectiveUserId = useCallback((): string => {
    return (
      doctorData.user_id ||
      doctor.user_id ||
      doctorData.id ||
      doctor.id ||
      "doctor"
    );
  }, [doctorData.user_id, doctorData.id, doctor.user_id, doctor.id]);

  // Load all uploaded images from the storage bucket
  const loadBucketImages = useCallback(async () => {
    try {
      setLoadingBucketImages(true);
      const userIds = [doctorData.user_id, doctor.user_id, doctorData.id, doctor.id].filter(
        (id): id is string => Boolean(id) && id !== "doctor"
      );
      if (userIds.length === 0) userIds.push("doctor");

      console.log("[DoctorProfileEdit] Fetching bucket images for IDs:", userIds);
      const images = await listDoctorProfileImages(userIds);
      console.log("[DoctorProfileEdit] Found bucket images:", images.length);
      setUploadedImages(images);

      // If user has a current profile_picture_url and no preview is set, default to it
      if (doctor.profile_picture_url && !imagePreviewUri) {
        setImagePreviewUri(doctor.profile_picture_url);
      }
    } catch (err) {
      console.error("[DoctorProfileEdit] Failed to load bucket images:", err);
    } finally {
      setLoadingBucketImages(false);
    }
  }, [doctorData.user_id, doctorData.id, doctor.user_id, doctor.id, doctor.profile_picture_url]);

  // Fetch bucket photos on mount
  useEffect(() => {
    loadBucketImages();
  }, [loadBucketImages]);

  useEffect(() => {
    if (doctor) {
      const parts = (doctor.doctor_name || (doctor as any).name || "").trim().split(" ");
      const fallbackFirst = parts[0] || "";
      const fallbackLast = parts.length > 1 ? parts.slice(1).join(" ") : "";

      setDoctorData({
        ...EMPTY_DOCTOR,
        ...doctor,
        first_name: doctor.first_name || fallbackFirst,
        middle_name: doctor.middle_name || "",
        last_name: doctor.last_name || fallbackLast,
        gender: doctor.gender || "",
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
   * Pick new profile image from media library and immediately upload to bucket
   */
  const handlePickAndUploadImage = async () => {
    try {
      console.log("[DoctorProfileEdit] Picking image...");
      const result = await pickImage([1, 1]);
      if (!result) {
        console.log("[DoctorProfileEdit] Image picking cancelled");
        return;
      }

      // Show immediate local preview
      setSelectedImage(result);
      setImagePreviewUri(result.uri);

      // Upload directly to bucket so it appears in the photo gallery
      setUploadingImage(true);
      const userId = getEffectiveUserId();
      try {
        const uploadedUrl = await uploadProfileImage(result, userId);
        console.log("[DoctorProfileEdit] Uploaded picture to bucket:", uploadedUrl);
        setImagePreviewUri(uploadedUrl);
        updateDoctorData("profile_picture_url", uploadedUrl);
        setSelectedImage(null); // Upload succeeded, no need to re-upload on save

        // Prepend to gallery
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
        // Will retry upload on form save
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

  /**
   * Select a previously uploaded photo from the bucket gallery
   */
  const handleSelectBucketPhoto = (photo: UploadedProfileImage) => {
    setSelectedImage(null); // Clear any local staging
    setImagePreviewUri(photo.url);
    updateDoctorData("profile_picture_url", photo.url);
  };

  /**
   * Delete photo from Supabase storage bucket
   */
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
              console.log("[DoctorProfileEdit] Deleting photo from bucket:", photo.fullPath || photo.url);
              await deleteProfileImage(photo.fullPath || photo.url);

              setUploadedImages((prev) =>
                prev.filter((p) => p.id !== photo.id && p.url !== photo.url)
              );

              // If deleted photo was active, fallback to next photo or clear
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

  /**
   * Validates form and returns error message if invalid, or null if valid
   */
  const validateForm = (): string | null => {
    const firstName = (doctorData.first_name || "").trim();
    if (!firstName) {
      return "First Name is required.";
    }

    const lastName = (doctorData.last_name || "").trim();
    if (!lastName) {
      return "Last Name is required.";
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
      let finalPictureUrl = imagePreviewUri || doctorData.profile_picture_url || "";

      // If user selected a new image that wasn't uploaded yet, upload it now
      if (selectedImage) {
        setUploadingImage(true);
        try {
          const userId = getEffectiveUserId();
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
        first_name: (doctorData.first_name || "").trim(),
        middle_name: (doctorData.middle_name || "").trim(),
        last_name: (doctorData.last_name || "").trim(),
        gender: (doctorData.gender || "").trim(),
        license_number: (doctorData.license_number || "").trim(),
        specialization: (doctorData.specialization || "").trim(),
        doctor_phone: (doctorData.doctor_phone || "").trim(),
        bio: (doctorData.bio || "").trim(),
        years_of_experience: Number(doctorData.years_of_experience) || 0,
        profile_picture_url: finalPictureUrl,
      };

      // Ensure is_available and doctor_name are never sent to Supabase
      delete (updatedPayload as any).is_available;
      delete (updatedPayload as any).doctor_name;

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

      {/* Dynamic Profile Picture Card with Storage Gallery */}
      <View style={styles.avatarCard}>
        {/* Main Hero Avatar Preview */}
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

        {/* Selected Photo Status Label */}
        {imagePreviewUri ? (
          <View style={styles.activePhotoIndicator}>
            <Check size={12} color="#047857" />
            <Text style={styles.activePhotoText} numberOfLines={1}>
              Active Profile Photo
            </Text>
          </View>
        ) : (
          <Text style={styles.photoHint}>No profile photo selected</Text>
        )}

        {/* Quick Upload Button */}
        <TouchableOpacity
          onPress={handlePickAndUploadImage}
          disabled={loading || uploadingImage}
          style={styles.changePhotoBtn}
        >
          {uploadingImage ? (
            <ActivityIndicator size="small" color="#047857" style={{ marginRight: 6 }} />
          ) : (
            <Camera size={15} color="#047857" style={{ marginRight: 6 }} />
          )}
          <Text style={styles.changePhotoText}>
            {uploadingImage ? "Uploading to Bucket..." : "Upload New Photo from Device"}
          </Text>
        </TouchableOpacity>

        {/* Horizontal Storage Bucket Photo Picker */}
        <View style={styles.gallerySection}>
          <View style={styles.galleryHeaderRow}>
            <View style={styles.galleryTitleContainer}>
              <ImageIcon size={14} color="#047857" />
              <Text style={styles.galleryTitle}>Profile Photos</Text>
              <View style={styles.galleryBadge}>
                <Text style={styles.galleryBadgeText}>
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
                size={14}
                color={loadingBucketImages ? "#94A3B8" : "#047857"}
              />
            </TouchableOpacity>
          </View>

          {loadingBucketImages ? (
            <View style={styles.loadingGalleryContainer}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text style={styles.loadingGalleryText}>Loading photos from bucket...</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galleryScroll}
            >
              {/* Tile 1: Upload New */}
              <TouchableOpacity
                style={styles.uploadTile}
                onPress={handlePickAndUploadImage}
                disabled={loading || uploadingImage}
                activeOpacity={0.7}
              >
                <Plus size={20} color="#047857" />
                <Text style={styles.uploadTileText}>Upload</Text>
              </TouchableOpacity>

              {/* Uploaded Bucket Photos */}
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
                    {/* Main Image Selector Touchable */}
                    <TouchableOpacity
                      style={styles.photoTileMain}
                      onPress={() => handleSelectBucketPhoto(photo)}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: photo.url }} style={styles.photoTileImage} />

                      {/* Active checkmark badge */}
                      {isSelected && (
                        <View style={styles.activeCheckBadge}>
                          <Check size={11} color="#FFFFFF" strokeWidth={3} />
                        </View>
                      )}
                    </TouchableOpacity>

                    {/* Delete button (Independent touchable with clear tap target) */}
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
                        <Trash2 size={11} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}

              {uploadedImages.length === 0 && (
                <View style={styles.emptyGalleryContainer}>
                  <Text style={styles.emptyGalleryText}>
                    No pictures in bucket yet. Tap Upload to add your first photo!
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>

      {/* Form Content */}
      <View style={styles.stepContent}>
        <Text style={styles.h2}>Doctor Professional Details</Text>
        <Text style={styles.p}>Update your professional credentials and contact details</Text>

        {/* Section: Doctor Information */}
        <Text style={styles.sectionHeader}>Doctor Information</Text>

        <Text style={styles.inputLabel}>First Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Maria"
          value={doctorData.first_name || ""}
          onChangeText={(text) => updateDoctorData("first_name", text)}
        />

        <Text style={styles.inputLabel}>Middle Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Clara (optional)"
          value={doctorData.middle_name || ""}
          onChangeText={(text) => updateDoctorData("middle_name", text)}
        />

        <Text style={styles.inputLabel}>Last Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Santos"
          value={doctorData.last_name || ""}
          onChangeText={(text) => updateDoctorData("last_name", text)}
        />

        <Text style={styles.inputLabel}>Gender (determines Dr. or Dra. title)</Text>
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
  activePhotoIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  activePhotoText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#047857",
  },
  gallerySection: {
    width: "100%",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  galleryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  galleryTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  galleryTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  galleryBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  galleryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  loadingGalleryContainer: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingGalleryText: {
    fontSize: 12,
    color: "#64748B",
  },
  galleryScroll: {
    paddingVertical: 4,
    gap: 10,
    alignItems: "center",
  },
  uploadTile: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#10B981",
    backgroundColor: "#F0FDF4",
    justifyContent: "center",
    alignItems: "center",
    padding: 6,
  },
  uploadTileText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
    marginTop: 4,
    textAlign: "center",
  },
  photoTile: {
    width: 80,
    height: 80,
    borderRadius: 12,
    position: "relative",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  photoTileActive: {
    borderColor: "#10B981",
    borderWidth: 2.5,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  photoTileMain: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
    overflow: "hidden",
  },
  photoTileImage: {
    width: "100%",
    height: "100%",
  },
  activeCheckBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "#10B981",
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    elevation: 3,
  },
  deletePhotoBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(220, 38, 38, 0.95)",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  emptyGalleryContainer: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    width: 220,
  },
  emptyGalleryText: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 16,
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
