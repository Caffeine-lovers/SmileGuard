import React, { useState, useMemo } from "react";
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
  StatusBar,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  X,
  User,
  HeartPulse,
  AlertCircle,
  ShieldCheck,
  Check,
  CheckCircle2,
  PhoneCall,
  Calendar as CalendarIcon,
  ChevronDown,
  Pencil,
} from "lucide-react-native";
import { createWalkInPatient, updateWalkInPatient } from "../../lib/profilesPatients";
import { formatDateOfBirth } from "../../lib/dateFormatters";

interface AddPatientModalProps {
  visible: boolean;
  onClose: () => void;
  onPatientAdded?: (patientId: string) => void;
  patientToEdit?: any;
  onPatientUpdated?: () => void;
}

const GENDER_OPTIONS = ["Male", "Female", "Prefer not to say"] as const;

const RELATIONSHIP_OPTIONS = [
  "Parent",
  "Spouse",
  "Partner",
  "Child",
  "Sibling",
  "Grandparent",
  "Grandchild",
  "Guardian",
  "Caregiver",
  "Relative / Aunt / Uncle / Cousin",
  "Friend",
  "Colleague",
  "Other",
];

const CURRENT_YEAR = new Date().getFullYear();
const MIN_AGE = 10;
const MAX_AGE = 99;
const MAX_BIRTH_YEAR = CURRENT_YEAR - MIN_AGE; // e.g. 2016
const MIN_BIRTH_YEAR = CURRENT_YEAR - MAX_AGE; // e.g. 1927

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function AddPatientModal({
  visible,
  onClose,
  onPatientAdded,
  patientToEdit,
  onPatientUpdated,
}: AddPatientModalProps) {
  // Personal Details
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(""); // 10 digits after +63
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Prefer not to say" | "">("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");

  // Emergency Contact 1 (Primary)
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState(""); // 10 digits after +63

  // Emergency Contact 2 (Secondary / Backup)
  const [emergency2Name, setEmergency2Name] = useState("");
  const [emergency2Relationship, setEmergency2Relationship] = useState("");
  const [emergency2Phone, setEmergency2Phone] = useState(""); // 10 digits after +63

  // Medical Alerts: ONLY Allergies kept (empty initial, hint text only)
  const [allergies, setAllergies] = useState("");

  // Picker Modals
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState<number | null>(null);
  const [pickerMonth, setPickerMonth] = useState<number | null>(null); // 1-12
  const [pickerDay, setPickerDay] = useState<number | null>(null);

  const [showRelationshipPickerFor, setShowRelationshipPickerFor] = useState<1 | 2 | null>(null);

  // Success Created Patient Modal State
  const [successCreatedPatient, setSuccessCreatedPatient] = useState<{
    id: string;
    name: string;
    phone: string;
    dob: string;
    emergencyName: string;
    emergencyRelationship: string;
    isEdit?: boolean;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmSaveModal, setShowConfirmSaveModal] = useState(false);

  // Baseline tracking for edit mode
  const [initialValues, setInitialValues] = useState<{
    name: string;
    phone: string;
    email: string;
    gender: string;
    dob: string;
    address: string;
    emergencyName: string;
    emergencyRelationship: string;
    emergencyPhone: string;
    emergency2Name: string;
    emergency2Relationship: string;
    emergency2Phone: string;
    allergies: string;
  } | null>(null);

  // Validation helpers
  const isDobValid = useMemo(() => {
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
    const parts = dob.split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const age = CURRENT_YEAR - y;
    return age >= MIN_AGE && age <= MAX_AGE;
  }, [dob]);

  const calculatedAge = useMemo(() => {
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
    const y = parseInt(dob.split("-")[0], 10);
    if (isNaN(y)) return null;
    return CURRENT_YEAR - y;
  }, [dob]);

  const formattedDisplayDob = useMemo(() => {
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return "";
    const parts = dob.split("-");
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12) return dob;
    const monthName = MONTH_NAMES[m - 1];
    return `${monthName} ${d}, ${y}`;
  }, [dob]);

  // Clean phone input digits
  const handlePhoneChange = (val: string, setter: (cleaned: string) => void) => {
    let cleaned = val.replace(/\D/g, "");
    if (cleaned.startsWith("63")) cleaned = cleaned.slice(2);
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    if (cleaned.length <= 10) setter(cleaned);
  };

  // Populate form in edit mode or reset in create mode
  React.useEffect(() => {
    if (visible && patientToEdit) {
      const initName = (patientToEdit.name || "").trim();
      const pRaw = patientToEdit.phone || patientToEdit.contact || "";
      let pClean = pRaw.replace(/\D/g, "");
      if (pClean.startsWith("63")) pClean = pClean.slice(2);
      if (pClean.startsWith("0")) pClean = pClean.slice(1);
      const initPhone = pClean.slice(0, 10);
      const initEmail = (patientToEdit.email || "").trim();
      const initGender = (patientToEdit.gender || "") as any;
      const initDob = (patientToEdit.date_of_birth || patientToEdit.dateOfBirth || "").trim();
      const initAddress = (patientToEdit.address || "").trim();
      const initEm1Name = (patientToEdit.emergency_contact_name || patientToEdit.emergencyContactName || "").trim();
      const initEm1Rel = (patientToEdit.emergency_contact_relationship || patientToEdit.emergencyContactRelationship || "").trim();
      let em1 = (patientToEdit.emergency_contact_phone || patientToEdit.emergencyContactPhone || "").replace(/\D/g, "");
      if (em1.startsWith("63")) em1 = em1.slice(2);
      if (em1.startsWith("0")) em1 = em1.slice(1);
      const initEm1Phone = em1.slice(0, 10);
      const initEm2Name = (patientToEdit.emergency_contact_2_name || patientToEdit.emergencyContact2Name || "").trim();
      const initEm2Rel = (patientToEdit.emergency_contact_2_relationship || patientToEdit.emergencyContact2Relationship || "").trim();
      let em2 = (patientToEdit.emergency_contact_2_phone || patientToEdit.emergencyContact2Phone || "").replace(/\D/g, "");
      if (em2.startsWith("63")) em2 = em2.slice(2);
      if (em2.startsWith("0")) em2 = em2.slice(1);
      const initEm2Phone = em2.slice(0, 10);
      const initAllergies = (patientToEdit.allergies && patientToEdit.allergies.toLowerCase() !== "none" ? patientToEdit.allergies : "").trim();

      setName(initName);
      setPhone(initPhone);
      setEmail(initEmail);
      setGender(initGender);
      setDob(initDob);
      setAddress(initAddress);
      setEmergencyName(initEm1Name);
      setEmergencyRelationship(initEm1Rel);
      setEmergencyPhone(initEm1Phone);
      setEmergency2Name(initEm2Name);
      setEmergency2Relationship(initEm2Rel);
      setEmergency2Phone(initEm2Phone);
      setAllergies(initAllergies);

      setInitialValues({
        name: initName,
        phone: initPhone,
        email: initEmail,
        gender: initGender,
        dob: initDob,
        address: initAddress,
        emergencyName: initEm1Name,
        emergencyRelationship: initEm1Rel,
        emergencyPhone: initEm1Phone,
        emergency2Name: initEm2Name,
        emergency2Relationship: initEm2Rel,
        emergency2Phone: initEm2Phone,
        allergies: initAllergies,
      });
      setErrorMessage(null);
    } else if (visible && !patientToEdit) {
      setInitialValues(null);
      resetForm();
    }
  }, [visible, patientToEdit]);

  // Form Validity check
  const isFormValid = useMemo(() => {
    const hasName = name.trim().length > 0;
    const hasPhone = phone.trim().length === 10;
    const hasDob = isDobValid;
    const hasGender = gender !== "";
    const hasAddress = address.trim().length > 0;
    const hasEmergency1Name = emergencyName.trim().length > 0;
    const hasEmergency1Rel = emergencyRelationship.trim().length > 0;
    const hasEmergency1Phone = emergencyPhone.trim().length === 10;

    return (
      hasName &&
      hasPhone &&
      hasDob &&
      hasGender &&
      hasAddress &&
      hasEmergency1Name &&
      hasEmergency1Rel &&
      hasEmergency1Phone
    );
  }, [
    name,
    phone,
    isDobValid,
    gender,
    address,
    emergencyName,
    emergencyRelationship,
    emergencyPhone,
  ]);

  // Check whether any input field was modified in edit mode
  const isFormChanged = useMemo(() => {
    if (!patientToEdit || !initialValues) return true;
    return (
      name.trim() !== initialValues.name ||
      phone.trim() !== initialValues.phone ||
      email.trim() !== initialValues.email ||
      gender !== initialValues.gender ||
      dob.trim() !== initialValues.dob ||
      address.trim() !== initialValues.address ||
      emergencyName.trim() !== initialValues.emergencyName ||
      emergencyRelationship.trim() !== initialValues.emergencyRelationship ||
      emergencyPhone.trim() !== initialValues.emergencyPhone ||
      emergency2Name.trim() !== initialValues.emergency2Name ||
      emergency2Relationship.trim() !== initialValues.emergency2Relationship ||
      emergency2Phone.trim() !== initialValues.emergency2Phone ||
      allergies.trim() !== initialValues.allergies
    );
  }, [
    patientToEdit,
    initialValues,
    name,
    phone,
    email,
    gender,
    dob,
    address,
    emergencyName,
    emergencyRelationship,
    emergencyPhone,
    emergency2Name,
    emergency2Relationship,
    emergency2Phone,
    allergies,
  ]);

  const isSubmitEnabled = useMemo(() => {
    if (!isFormValid) return false;
    if (patientToEdit && !isFormChanged) return false;
    return true;
  }, [isFormValid, patientToEdit, isFormChanged]);

  const resetForm = () => {
    setName("");
    setPhone("");
    setEmail("");
    setGender("");
    setDob("");
    setAddress("");
    setEmergencyName("");
    setEmergencyRelationship("");
    setEmergencyPhone("");
    setEmergency2Name("");
    setEmergency2Relationship("");
    setEmergency2Phone("");
    setAllergies("");
    setErrorMessage(null);
    setShowDobPicker(false);
    setPickerYear(null);
    setPickerMonth(null);
    setPickerDay(null);
    setShowRelationshipPickerFor(null);
    setShowConfirmSaveModal(false);
    setInitialValues(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleOpenDobPicker = () => {
    if (dob && /^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      const parts = dob.split("-");
      setPickerYear(parseInt(parts[0], 10) || null);
      setPickerMonth(parseInt(parts[1], 10) || null);
      setPickerDay(parseInt(parts[2], 10) || null);
    } else {
      setPickerYear(null);
      setPickerMonth(null);
      setPickerDay(null);
    }
    setShowDobPicker(true);
  };

  const handleConfirmDob = () => {
    if (!pickerYear || !pickerMonth || !pickerDay) return;
    const mm = String(pickerMonth).padStart(2, "0");
    const dd = String(pickerDay).padStart(2, "0");
    const formatted = `${pickerYear}-${mm}-${dd}`;
    setDob(formatted);
    setShowDobPicker(false);
  };

  const handleSubmit = async () => {
    if (!isFormValid) {
      setErrorMessage("Please complete all required fields with valid details.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const formattedPhone = `+63${phone.trim()}`;
      const formattedEmPhone1 = `+63${emergencyPhone.trim()}`;
      const formattedEmPhone2 = emergency2Phone.trim() ? `+63${emergency2Phone.trim()}` : undefined;

      if (patientToEdit) {
        const editId = patientToEdit.id || patientToEdit.patient_id;
        const result = await updateWalkInPatient(editId, {
          name: name.trim(),
          email: email.trim() || undefined,
          phone: formattedPhone,
          date_of_birth: dob.trim(),
          gender: gender || undefined,
          address: address.trim(),
          emergency_contact_name: emergencyName.trim(),
          emergency_contact_phone: formattedEmPhone1,
          emergency_contact_relationship: emergencyRelationship.trim(),
          emergency_contact_2_name: emergency2Name.trim() || undefined,
          emergency_contact_2_phone: formattedEmPhone2,
          emergency_contact_2_relationship: emergency2Relationship.trim() || undefined,
          allergies: allergies.trim() || "None",
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to update patient record");
        }

        setSuccessCreatedPatient({
          id: editId,
          name: name.trim(),
          phone: formattedPhone,
          dob: formattedDisplayDob || dob,
          emergencyName: emergencyName.trim(),
          emergencyRelationship: emergencyRelationship.trim(),
          isEdit: true,
        });
      } else {
        const result = await createWalkInPatient({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: formattedPhone,
          date_of_birth: dob.trim(),
          gender: gender || undefined,
          address: address.trim(),
          emergency_contact_name: emergencyName.trim(),
          emergency_contact_phone: formattedEmPhone1,
          emergency_contact_relationship: emergencyRelationship.trim(),
          emergency_contact_2_name: emergency2Name.trim() || undefined,
          emergency_contact_2_phone: formattedEmPhone2,
          emergency_contact_2_relationship: emergency2Relationship.trim() || undefined,
          allergies: allergies.trim() || "None",
        });

        if (!result.success || !result.patient_id) {
          throw new Error(result.error || "Failed to save patient record");
        }

        setSuccessCreatedPatient({
          id: result.patient_id!,
          name: name.trim(),
          phone: formattedPhone,
          dob: formattedDisplayDob || dob,
          emergencyName: emergencyName.trim(),
          emergencyRelationship: emergencyRelationship.trim(),
          isEdit: false,
        });
      }
    } catch (err: any) {
      console.error("[AddPatientModal] Submit error:", err);
      setErrorMessage(err.message || "An unexpected error occurred while saving.");
    } finally {
      setLoading(false);
    }
  };

  // Generate Year List for DOB (10 to 99 years old)
  const yearsList = useMemo(() => {
    const arr = [];
    for (let y = MAX_BIRTH_YEAR; y >= MIN_BIRTH_YEAR; y--) {
      arr.push(y);
    }
    return arr;
  }, []);

  // Days count for selected year and month
  const daysInSelectedMonth = useMemo(() => {
    if (!pickerYear || !pickerMonth) return 31;
    return new Date(pickerYear, pickerMonth, 0).getDate();
  }, [pickerYear, pickerMonth]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={["top", "bottom", "left", "right"]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" animated />

        {/* Modal Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{patientToEdit ? "EDIT PATIENT RECORD" : "ADD PATIENT"}</Text>
            </View>
            <Text style={styles.subtitle}>
              {patientToEdit
                ? "Update patient profile, emergency contacts, and allergies"
                : "Create a record for walk-in patients without an online account"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            disabled={loading}
            activeOpacity={0.7}
            accessibilityLabel="Close modal"
          >
            <X size={20} color="#0F172A" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <AlertCircle size={15} color="#DC2626" style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* SECTION 1: PERSONAL DETAILS */}
            <View style={styles.sectionHeader}>
              <User size={15} color="#047857" />
              <Text style={styles.sectionTitle}>PERSONAL DETAILS</Text>
            </View>

            <View style={styles.card}>
              {/* Full Name */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Full Name {!name.trim() && <Text style={styles.required}>*</Text>}
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

              {/* Contact Phone (+63 prefix) */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Contact Phone {phone.trim().length !== 10 && <Text style={styles.required}>*</Text>}
                </Text>
                <View style={styles.phoneInputContainer}>
                  <View style={styles.countryCodeBadge}>
                    <Text style={styles.countryCodeText}>+63</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="912 345 6789"
                    placeholderTextColor="#94A3B8"
                    value={phone}
                    onChangeText={(val) => handlePhoneChange(val, setPhone)}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
                {phone.length > 0 && phone.length < 10 && (
                  <Text style={styles.fieldHint}>Must be 10 digits (e.g. 912 345 6789)</Text>
                )}
              </View>

              {/* Date of Birth Picker + Input */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>
                    Date of Birth {!isDobValid && <Text style={styles.required}>*</Text>}
                  </Text>
                  {calculatedAge !== null && (
                    <Text
                      style={[
                        styles.ageBadge,
                        calculatedAge >= MIN_AGE && calculatedAge <= MAX_AGE
                          ? styles.ageBadgeValid
                          : styles.ageBadgeInvalid,
                      ]}
                    >
                      {calculatedAge} yrs old
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.dobSelectorBtn}
                  onPress={handleOpenDobPicker}
                  activeOpacity={0.7}
                >
                  <View style={styles.dobSelectorLeft}>
                    <CalendarIcon size={16} color="#047857" style={{ marginRight: 8 }} />
                    <Text
                      style={[
                        styles.dobSelectorText,
                        !dob && styles.dobSelectorPlaceholder,
                      ]}
                    >
                      {formattedDisplayDob || "Select date of birth"}
                    </Text>
                  </View>
                  <View style={styles.dobPickerBadge}>
                    <Text style={styles.dobPickerBadgeText}>Pick Date</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Email Address */}
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

              {/* Gender */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Gender {!gender && <Text style={styles.required}>*</Text>}
                </Text>
                <View style={styles.pillGroup}>
                  {GENDER_OPTIONS.map((g) => (
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

              {/* Home Address */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>
                    Home Address {!address.trim() && <Text style={styles.required}>*</Text>}
                  </Text>
                  <Text style={styles.charCounter}>
                    {address.length}/200
                  </Text>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Street, Barangay, City, Province"
                  placeholderTextColor="#94A3B8"
                  value={address}
                  onChangeText={setAddress}
                  maxLength={200}
                />
              </View>
            </View>

            {/* SECTION 2: EMERGENCY CONTACTS (2 CONTACTS) */}
            <View style={[styles.sectionHeader, { marginTop: 18 }]}>
              <PhoneCall size={15} color="#047857" />
              <Text style={styles.sectionTitle}>EMERGENCY CONTACTS (2 CONTACTS)</Text>
            </View>

            {/* Emergency Contact 1: Primary */}
            <View style={styles.card}>
              <View style={styles.subHeaderRow}>
                <Text style={styles.subHeaderTitle}>Primary Emergency Contact</Text>
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>CONTACT 1 (REQUIRED)</Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Contact Full Name {!emergencyName.trim() && <Text style={styles.required}>*</Text>}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Juan Santos"
                  placeholderTextColor="#94A3B8"
                  value={emergencyName}
                  onChangeText={setEmergencyName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Relationship to Patient {!emergencyRelationship.trim() && <Text style={styles.required}>*</Text>}
                </Text>
                <TouchableOpacity
                  style={styles.dropdownBtn}
                  onPress={() => setShowRelationshipPickerFor(1)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dropdownBtnText,
                      !emergencyRelationship && styles.dropdownBtnPlaceholder,
                    ]}
                  >
                    {emergencyRelationship || "Select relationship from list"}
                  </Text>
                  <ChevronDown size={17} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Phone Number {emergencyPhone.trim().length !== 10 && <Text style={styles.required}>*</Text>}
                </Text>
                <View style={styles.phoneInputContainer}>
                  <View style={styles.countryCodeBadge}>
                    <Text style={styles.countryCodeText}>+63</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="912 345 6789"
                    placeholderTextColor="#94A3B8"
                    value={emergencyPhone}
                    onChangeText={(val) => handlePhoneChange(val, setEmergencyPhone)}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
                {emergencyPhone.length > 0 && emergencyPhone.length < 10 && (
                  <Text style={styles.fieldHint}>Must be 10 digits</Text>
                )}
              </View>
            </View>

            {/* Emergency Contact 2: Secondary / Backup */}
            <View style={[styles.card, { marginTop: 12 }]}>
              <View style={styles.subHeaderRow}>
                <Text style={styles.subHeaderTitle}>Secondary Emergency Contact</Text>
                <View style={[styles.primaryBadge, { backgroundColor: "#F1F5F9", borderColor: "#CBD5E1" }]}>
                  <Text style={[styles.primaryBadgeText, { color: "#64748B" }]}>CONTACT 2 (OPTIONAL)</Text>
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Contact Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Elena Santos"
                  placeholderTextColor="#94A3B8"
                  value={emergency2Name}
                  onChangeText={setEmergency2Name}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Relationship to Patient</Text>
                <TouchableOpacity
                  style={styles.dropdownBtn}
                  onPress={() => setShowRelationshipPickerFor(2)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dropdownBtnText,
                      !emergency2Relationship && styles.dropdownBtnPlaceholder,
                    ]}
                  >
                    {emergency2Relationship || "Select relationship from list"}
                  </Text>
                  <ChevronDown size={17} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <View style={styles.phoneInputContainer}>
                  <View style={styles.countryCodeBadge}>
                    <Text style={styles.countryCodeText}>+63</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="912 345 6789"
                    placeholderTextColor="#94A3B8"
                    value={emergency2Phone}
                    onChangeText={(val) => handlePhoneChange(val, setEmergency2Phone)}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>
            </View>

            {/* SECTION 3: MEDICAL ALERTS & ALLERGIES */}
            <View style={[styles.sectionHeader, { marginTop: 18 }]}>
              <HeartPulse size={15} color="#047857" />
              <Text style={styles.sectionTitle}>MEDICAL ALERTS</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Known Allergies (Medications / Latex / Anesthesia)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Penicillin, Latex, Local Anesthetics (Leave blank if none)"
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
          {!isFormValid ? (
            <Text style={styles.validationNotice}>
              Please fill in all required fields (*) with valid details to save.
            </Text>
          ) : patientToEdit && !isFormChanged ? (
            <Text style={[styles.validationNotice, { color: "#64748B" }]}>
              Make changes to any field to enable saving.
            </Text>
          ) : null}

          <View style={styles.footerBtnRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!isSubmitEnabled || loading) && styles.submitBtnDisabled,
              ]}
              onPress={() => {
                if (patientToEdit) {
                  setShowConfirmSaveModal(true);
                } else {
                  handleSubmit();
                }
              }}
              disabled={!isSubmitEnabled || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>
                    {patientToEdit ? "Save Changes" : "Save Patient Record"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ───────────────────────────────────────── */}
        {/* MODAL 1: DATE OF BIRTH PICKER (10-99 YRS) */}
        {/* ───────────────────────────────────────── */}
        <Modal
          visible={showDobPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDobPicker(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerModalCard}>
              <View style={styles.pickerModalHeader}>
                <View>
                  <Text style={styles.pickerModalTitle}>Select Date of Birth</Text>
                  {pickerYear ? (
                    <Text style={styles.pickerModalSubtitle}>
                      Age: {CURRENT_YEAR - pickerYear} years old ({pickerYear})
                    </Text>
                  ) : (
                    <Text style={[styles.pickerModalSubtitle, { color: "#64748B" }]}>
                      Select Year, Month, and Day
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.pickerCloseBtn}
                  onPress={() => setShowDobPicker(false)}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <View style={styles.pickerColumnsContainer}>
                {/* Year Column */}
                <View style={styles.pickerCol}>
                  <Text style={styles.pickerColHeader}>YEAR</Text>
                  <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                    {yearsList.map((y) => (
                      <TouchableOpacity
                        key={y}
                        style={[styles.pickerItem, pickerYear === y && styles.pickerItemActive]}
                        onPress={() => setPickerYear(y)}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            pickerYear === y && styles.pickerItemTextActive,
                          ]}
                        >
                          {y}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Month Column */}
                <View style={styles.pickerCol}>
                  <Text style={styles.pickerColHeader}>MONTH</Text>
                  <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                    {MONTH_NAMES.map((m, idx) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.pickerItem,
                          pickerMonth === idx + 1 && styles.pickerItemActive,
                        ]}
                        onPress={() => setPickerMonth(idx + 1)}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            pickerMonth === idx + 1 && styles.pickerItemTextActive,
                          ]}
                        >
                          {m.slice(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Day Column */}
                <View style={styles.pickerCol}>
                  <Text style={styles.pickerColHeader}>DAY</Text>
                  <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
                    {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map((d) => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.pickerItem, pickerDay === d && styles.pickerItemActive]}
                        onPress={() => setPickerDay(d)}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            pickerDay === d && styles.pickerItemTextActive,
                          ]}
                        >
                          {d}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.pickerActionRow}>
                <TouchableOpacity
                  style={styles.pickerCancelBtn}
                  onPress={() => setShowDobPicker(false)}
                >
                  <Text style={styles.pickerCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.pickerConfirmBtn,
                    (!pickerYear || !pickerMonth || !pickerDay) && styles.pickerConfirmBtnDisabled,
                  ]}
                  onPress={handleConfirmDob}
                  disabled={!pickerYear || !pickerMonth || !pickerDay}
                >
                  <Text style={styles.pickerConfirmBtnText}>Apply Date</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ───────────────────────────────────────── */}
        {/* MODAL 2: RELATIONSHIP DROPDOWN PICKER     */}
        {/* ───────────────────────────────────────── */}
        <Modal
          visible={showRelationshipPickerFor !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRelationshipPickerFor(null)}
        >
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerModalCard, { maxHeight: "65%" }]}>
              <View style={styles.pickerModalHeader}>
                <Text style={styles.pickerModalTitle}>Select Relationship</Text>
                <TouchableOpacity
                  style={styles.pickerCloseBtn}
                  onPress={() => setShowRelationshipPickerFor(null)}
                >
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ paddingHorizontal: 16 }}>
                {RELATIONSHIP_OPTIONS.map((rel) => {
                  const currentSelected =
                    showRelationshipPickerFor === 1
                      ? emergencyRelationship
                      : emergency2Relationship;
                  const isSelected = currentSelected === rel;

                  return (
                    <TouchableOpacity
                      key={rel}
                      style={[styles.relOptionRow, isSelected && styles.relOptionRowActive]}
                      onPress={() => {
                        if (showRelationshipPickerFor === 1) {
                          setEmergencyRelationship(rel);
                        } else if (showRelationshipPickerFor === 2) {
                          setEmergency2Relationship(rel);
                        }
                        setShowRelationshipPickerFor(null);
                      }}
                    >
                      <Text style={[styles.relOptionText, isSelected && styles.relOptionTextActive]}>
                        {rel}
                      </Text>
                      {isSelected && <Check size={16} color="#047857" strokeWidth={2.5} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ───────────────────────────────────────── */}
        {/* MODAL 3: PATIENT CREATED SUCCESS MESSAGE  */}
        {/* ───────────────────────────────────────── */}
        <Modal
          visible={successCreatedPatient !== null}
          transparent
          animationType="fade"
          onRequestClose={() => {
            const pId = successCreatedPatient?.id;
            setSuccessCreatedPatient(null);
            handleClose();
            if (pId) onPatientAdded?.(pId);
          }}
        >
          <View style={styles.successOverlay}>
            <View style={styles.successModalCard}>
              <View style={styles.successIconBadge}>
                <CheckCircle2 size={36} color="#059669" strokeWidth={2.5} />
              </View>

              <Text style={styles.successTitle}>
                {successCreatedPatient?.isEdit ? "Patient Record Updated!" : "Patient Record Created!"}
              </Text>
              <Text style={styles.successSubtitle}>
                {successCreatedPatient?.isEdit
                  ? "The walk-in patient record has been updated successfully in clinic records."
                  : "The walk-in patient record has been saved successfully and is ready for appointments."}
              </Text>

              <View style={styles.successSummaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Patient Name</Text>
                  <Text style={styles.summaryValue}>{successCreatedPatient?.name}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Contact Phone</Text>
                  <Text style={styles.summaryValue}>{successCreatedPatient?.phone}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Date of Birth</Text>
                  <Text style={styles.summaryValue}>{formatDateOfBirth(successCreatedPatient?.dob || "")}</Text>
                </View>
                <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.summaryLabel}>Emergency Contact</Text>
                  <Text style={styles.summaryValue}>
                    {successCreatedPatient?.emergencyName} ({successCreatedPatient?.emergencyRelationship})
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.successDoneBtn}
                onPress={() => {
                  const pId = successCreatedPatient?.id;
                  const isEdit = successCreatedPatient?.isEdit;
                  setSuccessCreatedPatient(null);
                  handleClose();
                  if (isEdit) {
                    onPatientUpdated?.();
                  } else if (pId) {
                    onPatientAdded?.(pId);
                  }
                }}
                activeOpacity={0.8}
              >
                <Check size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.successDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ───────────────────────────────────────── */}
        {/* MODAL 4: CONFIRM SAVE CHANGES (EDIT MODE) */}
        {/* ───────────────────────────────────────── */}
        <Modal
          visible={showConfirmSaveModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowConfirmSaveModal(false)}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmModalCard}>
              <View style={styles.confirmIconBadge}>
                <AlertCircle size={32} color="#059669" strokeWidth={2.5} />
              </View>
              <Text style={styles.confirmTitle}>Save Changes?</Text>
              <Text style={styles.confirmSubtitle}>
                Are you sure you want to save the updated information for {name.trim() || "this patient"}?
              </Text>
              <View style={styles.confirmBtnRow}>
                <TouchableOpacity
                  style={styles.confirmCancelBtn}
                  onPress={() => setShowConfirmSaveModal(false)}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.confirmCancelBtnText}>Keep Editing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmSaveBtn}
                  onPress={async () => {
                    setShowConfirmSaveModal(false);
                    await handleSubmit();
                  }}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Check size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                      <Text style={styles.confirmSaveBtnText}>Confirm & Save</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
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
  editBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FCD34D",
    gap: 4,
  },
  editBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B45309",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
    paddingHorizontal: 20,
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
    paddingBottom: 30,
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
  subHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  subHeaderTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
  },
  primaryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  primaryBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.5,
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
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
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
  ageBadge: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ageBadgeValid: {
    backgroundColor: "#ECFDF5",
    color: "#047857",
  },
  ageBadgeInvalid: {
    backgroundColor: "#FEF2F2",
    color: "#DC2626",
  },
  fieldHint: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  charCounter: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
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
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    overflow: "hidden",
  },
  countryCodeBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: "#CBD5E1",
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: "#0F172A",
  },
  dobSelectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dobSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dobSelectorText: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "500",
  },
  dobSelectorPlaceholder: {
    color: "#94A3B8",
  },
  dobPickerBadge: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  dobPickerBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  pillGroup: {
    flexDirection: "row",
    gap: 8,
  },
  pillBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pillBtnActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#059669",
  },
  pillBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    textAlign: "center",
  },
  pillBtnTextActive: {
    color: "#047857",
    fontWeight: "700",
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownBtnText: {
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "500",
  },
  dropdownBtnPlaceholder: {
    color: "#94A3B8",
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  validationNotice: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 8,
  },
  footerBtnRow: {
    flexDirection: "row",
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
    backgroundColor: "#94A3B8",
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  pickerModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  pickerModalTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  pickerModalSubtitle: {
    fontSize: 12,
    color: "#047857",
    fontWeight: "600",
    marginTop: 2,
  },
  pickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerColumnsContainer: {
    flexDirection: "row",
    height: 220,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  pickerCol: {
    flex: 1,
    paddingHorizontal: 4,
  },
  pickerColHeader: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    textAlign: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  pickerScroll: {
    flex: 1,
  },
  pickerItem: {
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    marginVertical: 2,
  },
  pickerItemActive: {
    backgroundColor: "#ECFDF5",
  },
  pickerItemText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "500",
  },
  pickerItemTextActive: {
    color: "#047857",
    fontWeight: "800",
  },
  pickerActionRow: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 8,
  },
  pickerCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  pickerCancelBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  pickerConfirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#059669",
    alignItems: "center",
  },
  pickerConfirmBtnDisabled: {
    backgroundColor: "#94A3B8",
    opacity: 0.5,
  },
  pickerConfirmBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  relOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  relOptionRowActive: {
    backgroundColor: "#F0FDF4",
  },
  relOptionText: {
    fontSize: 13,
    color: "#1E293B",
    fontWeight: "500",
  },
  relOptionTextActive: {
    color: "#047857",
    fontWeight: "700",
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  successModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ECFDF5",
    borderWidth: 2,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  successSummaryCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700",
    maxWidth: "58%",
    textAlign: "right",
  },
  successDoneBtn: {
    width: "100%",
    flexDirection: "row",
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  successDoneBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  confirmModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  confirmIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ECFDF5",
    borderWidth: 2,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 6,
  },
  confirmSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  confirmBtnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  confirmSaveBtn: {
    flex: 1.2,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmSaveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
