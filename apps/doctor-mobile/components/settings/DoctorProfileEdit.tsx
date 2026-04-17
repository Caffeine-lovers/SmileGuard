import React, { useState } from "react";
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
} from "react-native";
import { Doctor, EMPTY_DOCTOR } from "@smileguard/shared-types";

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
  const [showSpecializationDropdown, setShowSpecializationDropdown] =
    useState(false);
  const [loading, setLoading] = useState(false);

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

  const isValidLicenseNumber = (license: string): boolean => {
    if (license.length < 5 || license.length > 7) return false;
    if (!/^[a-zA-Z0-9]+$/.test(license)) return false;
    const hasLetters = /[a-zA-Z]/.test(license);
    const hasNumbers = /[0-9]/.test(license);
    return hasLetters && hasNumbers;
  };

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isFormValid = () => {
    return (
      doctorData.license_number &&
      isValidLicenseNumber(doctorData.license_number) &&
      doctorData.specialization &&
      doctorData.doctor_name?.trim() &&
      (!doctorData.doctor_phone ||
        doctorData.doctor_phone?.length > 0)
    );
  };

  const handleSave = async () => {
    if (!isFormValid()) {
      Alert.alert(
        "Validation Error",
        "Please fill in all required fields correctly"
      );
      return;
    }

    setLoading(true);
    try {
      await onSave(doctorData);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save profile";
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Edit Doctor Profile</Text>
        <TouchableOpacity onPress={onCancel}>
          <Image
            source={require("../../assets/images/icon/close.png")}
            style={{ width: 20, height: 20 }}
          />
        </TouchableOpacity>
      </View>

      {/* Form Content */}
      <View style={styles.stepContent}>
        <Text style={styles.h2}> Doctor Professional Details</Text>
        <Text style={styles.p}>Update your professional information</Text>

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
          <View style={{ marginBottom: 8, marginTop: -4 }}>
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
                  <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "500" }}>
                    ✗ Must be 5-7 characters (current:{" "}
                    {doctorData.license_number.length})
                  </Text>
                ) : null}
                {!/^[a-zA-Z0-9]+$/.test(doctorData.license_number) ? (
                  <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "500" }}>
                    ✗ Only letters and numbers allowed
                  </Text>
                ) : null}
                {(!/[a-zA-Z]/.test(doctorData.license_number) ||
                  !/[0-9]/.test(doctorData.license_number)) && (
                  <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "500" }}>
                    ✗ Must contain both letters and numbers
                  </Text>
                )}
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
              height: 45,
            },
          ]}
          onPress={() => setShowSpecializationDropdown(true)}
        >
          <Text
            style={{
              fontSize: 13,
              color: doctorData.specialization ? "#333" : "#999",
            }}
          >
            {doctorData.specialization || "Select Specialization *"}
          </Text>
        </TouchableOpacity>

        <Modal
          visible={showSpecializationDropdown}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSpecializationDropdown(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Specialization</Text>
              <ScrollView style={{ maxHeight: "80%" }}>
                {specializations.map((spec) => (
                  <TouchableOpacity
                    key={spec}
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
          </View>
        </Modal>

        <TextInput
          style={styles.input}
          placeholder="Years of Experience (e.g., 5, 10)"
          keyboardType="number-pad"
          value={
            doctorData.years_of_experience &&
            doctorData.years_of_experience > 0
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

        <TouchableOpacity
          style={[
            styles.input,
            {
              justifyContent: "center",
              paddingVertical: 0,
              height: 45,
            },
          ]}
          disabled={false}
          onPress={() => {}}
        >
          <Text
            style={{
              fontSize: 13,
              color: "#333",
            }}
          >
            Available
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btn, styles.secondaryBtn]}
          onPress={onCancel}
          disabled={loading}
        >
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.primaryBtn]}
          onPress={handleSave}
          disabled={loading || !isFormValid()}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
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
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingBottom: 60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: "#ddd",
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#0b7fab",
  },
  closeBtn: {
    fontSize: 24,
    color: "#0b7fab",
    fontWeight: "bold",
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 16,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 12,
    marginLeft: 16,
    color: "#1f2937",
  },
  dropdownOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomColor: "#f0f0f0",
    borderBottomWidth: 1,
  },
  dropdownOptionSelected: {
    backgroundColor: "#dbeafe",
  },
  dropdownOptionText: {
    fontSize: 13,
    color: "#666",
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
    borderTopColor: "#ddd",
    borderTopWidth: 1,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtn: {
    backgroundColor: "#0b7fab",
  },
  secondaryBtn: {
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  btnText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    textAlign: "center",
  },
});
