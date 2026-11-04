import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  X,
  User,
  HeartPulse,
  AlertCircle,
  ShieldCheck,
  Check,
} from "lucide-react-native";
import { createWalkInPatient } from "../../lib/profilesPatients";

interface AddPatientModalProps {
  visible: boolean;
  onClose: () => void;
  onPatientAdded?: (patientId: string) => void;
}

export default function AddPatientModal({
  visible,
  onClose,
  onPatientAdded,
}: AddPatientModalProps) {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top || (Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0);

  // Personal & Contact State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other" | "">("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Medical Alerts: ONLY Allergies kept for dummy record
  const [allergies, setAllergies] = useState("None");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setGender("");
    setDob("");
    setAddress("");
    setEmergencyName("");
    setEmergencyPhone("");
    setAllergies("None");
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("Patient full name is required.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await createWalkInPatient({
        name: trimmedName,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        service: "General",
        date_of_birth: dob.trim() || undefined,
        gender: gender || undefined,
        address: address.trim() || undefined,
        emergency_contact_name: emergencyName.trim() || undefined,
        emergency_contact_phone: emergencyPhone.trim() || undefined,
        allergies: allergies.trim() || "None",
      });

      if (!result.success || !result.patient_id) {
        throw new Error(result.error || "Failed to save patient record");
      }

      Alert.alert(
        "Patient Added",
        `${trimmedName} has been recorded successfully.`,
        [{ text: "OK", onPress: () => {
          handleClose();
          onPatientAdded?.(result.patient_id!);
        }}]
      );
    } catch (err: any) {
      console.error("[AddPatientModal] Submit error:", err);
      setErrorMessage(err.message || "An unexpected error occurred while saving.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView
        style={[styles.container, { paddingTop: Platform.OS === "android" ? statusBarHeight : 0 }]}
        edges={["bottom", "left", "right"]}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" animated />

        {/* Modal Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>ADD PATIENT</Text>
              <View style={styles.keeperBadge}>
                <ShieldCheck size={11} color="#047857" />
                <Text style={styles.keeperBadgeText}>CLINIC KEEPER</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>Create a record for walk-in patients without an online account</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            disabled={loading}
            accessibilityLabel="Close modal"
          >
            <X size={18} color="#475569" />
          </TouchableOpacity>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <AlertCircle size={15} color="#DC2626" style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* SECTION 1: PERSONAL & CONTACT DETAILS */}
            <View style={styles.sectionHeader}>
              <User size={15} color="#047857" />
              <Text style={styles.sectionTitle}>PERSONAL DETAILS</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Full Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Maria Santos"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Contact Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0912 345 6789"
                    placeholderTextColor="#94A3B8"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Date of Birth</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                    value={dob}
                    onChangeText={setDob}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email Address (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="patient@example.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.pillGroup}>
                  {(["Male", "Female", "Other"] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.pillBtn, gender === g && styles.pillBtnActive]}
                      onPress={() => setGender(g)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pillBtnText, gender === g && styles.pillBtnTextActive]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Home Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Barangay, City, Province"
                  placeholderTextColor="#94A3B8"
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Emergency Contact</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Contact Name"
                    placeholderTextColor="#94A3B8"
                    value={emergencyName}
                    onChangeText={setEmergencyName}
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Emergency Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0912 345 6789"
                    placeholderTextColor="#94A3B8"
                    value={emergencyPhone}
                    onChangeText={setEmergencyPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>

            {/* SECTION 2: MEDICAL ALERTS & ALLERGIES */}
            <View style={[styles.sectionHeader, { marginTop: 18 }]}>
              <HeartPulse size={15} color="#047857" />
              <Text style={styles.sectionTitle}>MEDICAL ALERTS</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Known Allergies (Medications / Latex / Anesthesia)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Penicillin, Latex, Local Anesthetics (or None)"
                  placeholderTextColor="#94A3B8"
                  value={allergies}
                  onChangeText={setAllergies}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Action Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleClose}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Check size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.submitBtnText}>Save Patient Record</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  keeperBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 4,
  },
  keeperBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#047857",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 12,
    color: "#DC2626",
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  formGroup: {
    marginBottom: 12,
  },
  formRow: {
    flexDirection: "row",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  required: {
    color: "#DC2626",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: "#0F172A",
  },
  pillGroup: {
    flexDirection: "row",
    gap: 8,
  },
  pillBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pillBtnActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#059669",
  },
  pillBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  pillBtnTextActive: {
    color: "#047857",
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  submitBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
