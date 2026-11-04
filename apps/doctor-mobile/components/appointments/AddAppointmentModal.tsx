import React, { useState, useEffect } from "react";
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
  Calendar,
  Clock,
  User,
  Search,
  Check,
  Stethoscope,
  Sparkles,
  AlertCircle,
  Plus,
  ShieldCheck,
  ChevronDown,
  CheckCircle2,
} from "lucide-react-native";
import { supabase } from "@smileguard/supabase-client";
import { getAllPatients, fetchWalkInPatients } from "../../lib/profilesPatients";
import { createDirectAppointment } from "../../lib/appointmentService";
import AddPatientModal from "../patientrecord/AddPatientModal";

interface AddAppointmentModalProps {
  visible: boolean;
  onClose: () => void;
  onAppointmentAdded?: () => void;
  initialDate?: string;
  defaultDoctorId?: string | null;
}

const DEFAULT_SERVICES = [
  "General Consultation",
  "Oral Prophylaxis (Cleaning)",
  "Tooth Extraction",
  "Dental Filling (Pasta)",
  "Root Canal Treatment",
  "Orthodontic Consultation",
  "Teeth Whitening",
  "Dentures / Prosthetics",
];

const STANDARD_TIMES = [
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
];

export default function AddAppointmentModal({
  visible,
  onClose,
  onAppointmentAdded,
  initialDate,
  defaultDoctorId,
}: AddAppointmentModalProps) {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top || (Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0);

  // Form Fields
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string; contact?: string; dummy?: boolean } | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(defaultDoctorId || null);
  const [service, setService] = useState(DEFAULT_SERVICES[0]);
  const [customService, setCustomService] = useState("");
  const [appointmentDate, setAppointmentDate] = useState(initialDate || new Date().toISOString().split("T")[0]);
  const [appointmentTime, setAppointmentTime] = useState(STANDARD_TIMES[1]);
  const [notes, setNotes] = useState("");

  // Patients Picker State
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [showCreatePatientModal, setShowCreatePatientModal] = useState(false);

  // Doctors list
  const [doctorsList, setDoctorsList] = useState<any[]>([]);

  // Submission State
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCreatedAppointment, setSuccessCreatedAppointment] = useState<{
    patientName: string;
    date: string;
    time: string;
    service: string;
    doctorName?: string;
  } | null>(null);

  // Reset initial date whenever prop updates
  useEffect(() => {
    if (initialDate) {
      setAppointmentDate(initialDate);
    }
  }, [initialDate]);

  // Fetch patients and doctors when modal opens
  useEffect(() => {
    if (visible) {
      fetchPatients();
      fetchDoctors();
    }
  }, [visible]);

  const fetchPatients = async () => {
    setLoadingPatients(true);
    try {
      const [regularPatients, walkInPatients] = await Promise.all([
        getAllPatients(),
        fetchWalkInPatients(),
      ]);
      const regularList = regularPatients || [];
      const walkInList = (walkInPatients || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        email: w.email || "",
        phone: w.phone || "",
        allergies: w.allergies || "None",
        dummy: true,
      }));
      const combined = [...regularList, ...walkInList];
      setPatientsList(combined);
      return combined;
    } catch (err) {
      console.error("[AddAppointmentModal] Error fetching patients:", err);
      return [];
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const { data } = await supabase
        .from("doctors")
        .select("id, user_id, first_name, last_name, doctor_name")
        .limit(20);
      setDoctorsList(data || []);
      if (!selectedDoctorId && data && data.length > 0) {
        setSelectedDoctorId(data[0].id || data[0].user_id);
      }
    } catch (err) {
      console.error("[AddAppointmentModal] Error fetching doctors:", err);
    }
  };

  const resetForm = () => {
    setSelectedPatient(null);
    setService(DEFAULT_SERVICES[0]);
    setCustomService("");
    setAppointmentDate(initialDate || new Date().toISOString().split("T")[0]);
    setAppointmentTime(STANDARD_TIMES[1]);
    setNotes("");
    setErrorMessage(null);
    setShowPatientPicker(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedPatient) {
      setErrorMessage("Please select a patient for this appointment.");
      return;
    }
    const finalDate = appointmentDate.trim();
    if (!finalDate || !/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
      setErrorMessage("Please enter a valid appointment date (YYYY-MM-DD).");
      return;
    }
    const finalService = customService.trim() || service;
    if (!finalService) {
      setErrorMessage("Please select or enter a dental service.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const result = await createDirectAppointment({
        patient_id: selectedPatient.id,
        is_dummy: (selectedPatient as any).dummy === true,
        dentist_id: selectedDoctorId || null,
        service: finalService,
        appointment_date: finalDate,
        appointment_time: appointmentTime,
        status: "scheduled",
        notes: notes.trim() || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to schedule appointment.");
      }

      let displayDate = finalDate;
      try {
        const [yr, mo, dy] = finalDate.split("-").map(Number);
        if (yr && mo && dy) {
          const dObj = new Date(yr, mo - 1, dy);
          displayDate = dObj.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        }
      } catch {
        displayDate = finalDate;
      }

      const assignedDoc = doctorsList.find((d: any) => (d.id === selectedDoctorId || d.user_id === selectedDoctorId));
      const doctorDisplayName = assignedDoc
        ? (assignedDoc.doctor_name || `${assignedDoc.first_name || ''} ${assignedDoc.last_name || ''}`.trim())
        : undefined;

      setSuccessCreatedAppointment({
        patientName: selectedPatient.name,
        date: displayDate,
        time: appointmentTime,
        service: finalService,
        doctorName: doctorDisplayName || "Assigned Clinic Dentist",
      });
    } catch (err: any) {
      console.error("[AddAppointmentModal] Submission error:", err);
      setErrorMessage(err.message || "Failed to schedule appointment.");
    } finally {
      setLoading(false);
    }
  };

  const filteredPatients = patientsList.filter((p) => {
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    );
  });

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
              <Text style={styles.title}>NEW APPOINTMENT</Text>
              <View style={styles.assistantBadge}>
                <Stethoscope size={11} color="#047857" />
                <Text style={styles.assistantBadgeText}>CLINIC BOOKING</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>Directly schedule appointments for walk-in or existing patients</Text>
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
            {/* 1. PATIENT SELECTION */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.labelGroup}>
                  <User size={15} color="#047857" />
                  <Text style={styles.label}>
                    Patient <Text style={styles.required}>*</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.quickAddPatientBtn}
                  onPress={() => setShowCreatePatientModal(true)}
                  activeOpacity={0.7}
                >
                  <Plus size={13} color="#047857" />
                  <Text style={styles.quickAddPatientBtnText}>New Patient</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.patientPickerTrigger, !selectedPatient && styles.patientPickerTriggerEmpty]}
                onPress={() => setShowPatientPicker(true)}
                activeOpacity={0.7}
              >
                {selectedPatient ? (
                  <View style={styles.selectedPatientBox}>
                    <View style={styles.patientAvatarBox}>
                      <Text style={styles.patientAvatarText}>
                        {selectedPatient.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.selectedPatientName} numberOfLines={1}>
                          {selectedPatient.name}
                        </Text>
                        {selectedPatient.dummy && (
                          <View style={styles.walkinPill}>
                            <Text style={styles.walkinPillText}>Walk-in</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.selectedPatientContact}>
                        {selectedPatient.contact || "No phone provided"}
                      </Text>
                    </View>
                    <ChevronDown size={18} color="#047857" />
                  </View>
                ) : (
                  <View style={styles.emptyPatientRow}>
                    <Text style={styles.emptyPatientText}>Tap to choose a patient...</Text>
                    <ChevronDown size={18} color="#94A3B8" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* 2. DENTAL SERVICE */}
            <View style={[styles.card, { marginTop: 14 }]}>
              <View style={styles.labelGroup}>
                <Sparkles size={15} color="#047857" />
                <Text style={styles.label}>
                  Dental Service <Text style={styles.required}>*</Text>
                </Text>
              </View>

              <View style={styles.pillGroup}>
                {DEFAULT_SERVICES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.servicePill, service === s && styles.servicePillActive]}
                    onPress={() => {
                      setService(s);
                      setCustomService("");
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.servicePillText, service === s && styles.servicePillTextActive]}
                      numberOfLines={1}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.input, { marginTop: 10 }]}
                placeholder="Or specify custom service..."
                placeholderTextColor="#94A3B8"
                value={customService}
                onChangeText={(val) => {
                  setCustomService(val);
                  if (val) setService("");
                }}
              />
            </View>

            {/* 3. SCHEDULE DATE & TIME */}
            <View style={[styles.card, { marginTop: 14 }]}>
              <View style={styles.labelGroup}>
                <Calendar size={15} color="#047857" />
                <Text style={styles.label}>
                  Appointment Date (YYYY-MM-DD) <Text style={styles.required}>*</Text>
                </Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                value={appointmentDate}
                onChangeText={setAppointmentDate}
              />

              <View style={[styles.labelGroup, { marginTop: 14 }]}>
                <Clock size={15} color="#047857" />
                <Text style={styles.label}>
                  Preferred Time Slot <Text style={styles.required}>*</Text>
                </Text>
              </View>

              <View style={styles.pillGroup}>
                {STANDARD_TIMES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.timePill, appointmentTime === t && styles.timePillActive]}
                    onPress={() => setAppointmentTime(t)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.timePillText, appointmentTime === t && styles.timePillTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 4. DOCTOR / DENTIST SELECTION (Optional) */}
            {doctorsList.length > 0 && (
              <View style={[styles.card, { marginTop: 14 }]}>
                <View style={styles.labelGroup}>
                  <Stethoscope size={15} color="#047857" />
                  <Text style={styles.label}>Assigned Dentist</Text>
                </View>

                <View style={styles.pillGroup}>
                  {doctorsList.map((doc) => {
                    const docId = doc.id || doc.user_id;
                    const docName = doc.doctor_name || `Dr. ${doc.first_name || ""} ${doc.last_name || ""}`.trim();
                    const isSelected = selectedDoctorId === docId;
                    return (
                      <TouchableOpacity
                        key={docId}
                        style={[styles.pillBtn, isSelected && styles.pillBtnActive]}
                        onPress={() => setSelectedDoctorId(docId)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pillBtnText, isSelected && styles.pillBtnTextActive]}>
                          {docName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 5. NOTES */}
            <View style={[styles.card, { marginTop: 14 }]}>
              <Text style={styles.label}>Internal Notes / Patient Request Details</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add special notes, reminders, or reasons for visit..."
                placeholderTextColor="#94A3B8"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
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
                <Text style={styles.submitBtnText}>Schedule Appointment</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Patient Selection Bottom-Sheet / Overlay Modal */}
        <Modal
          visible={showPatientPicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowPatientPicker(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }} edges={["top", "bottom"]}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>CHOOSE PATIENT</Text>
                <Text style={styles.pickerSubtitle}>Select a registered patient or create a walk-in</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowPatientPicker(false)}
              >
                <X size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBarBox}>
              <Search size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Search by patient name, phone, or email..."
                placeholderTextColor="#94A3B8"
                value={patientSearch}
                onChangeText={setPatientSearch}
                autoFocus
              />
              {patientSearch ? (
                <TouchableOpacity onPress={() => setPatientSearch("")}>
                  <X size={16} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.newPatientShortcutRow}>
              <TouchableOpacity
                style={styles.newPatientShortcutBtn}
                onPress={() => {
                  setShowPatientPicker(false);
                  setShowCreatePatientModal(true);
                }}
                activeOpacity={0.8}
              >
                <Plus size={15} color="#047857" style={{ marginRight: 6 }} />
                <Text style={styles.newPatientShortcutText}>Register New Walk-in Patient</Text>
              </TouchableOpacity>
            </View>

            {loadingPatients ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#047857" />
                <Text style={{ marginTop: 10, fontSize: 13, color: "#64748B" }}>Loading patients...</Text>
              </View>
            ) : filteredPatients.length === 0 ? (
              <View style={styles.centerContainer}>
                <User size={36} color="#CBD5E1" />
                <Text style={{ marginTop: 10, fontSize: 14, fontWeight: "700", color: "#64748B" }}>
                  No patients found
                </Text>
                <Text style={{ marginTop: 4, fontSize: 12, color: "#94A3B8" }}>
                  Try a different search or register a new patient
                </Text>
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {filteredPatients.map((p) => {
                  const isCurrent = selectedPatient?.id === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.patientItemRow, isCurrent && styles.patientItemRowSelected]}
                      onPress={() => {
                        setSelectedPatient({
                          id: p.id,
                          name: p.name || "Patient",
                          contact: p.phone,
                          dummy: p.dummy,
                        });
                        setShowPatientPicker(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.patientItemAvatar}>
                        <Text style={styles.patientItemAvatarText}>
                          {(p.name || "P").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.patientItemName}>{p.name}</Text>
                          {p.dummy && (
                            <View style={styles.walkinPill}>
                              <Text style={styles.walkinPillText}>Walk-in</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.patientItemMeta}>
                          {p.phone || p.email || "No contact info"}
                        </Text>
                      </View>
                      {isCurrent ? (
                        <Check size={18} color="#047857" strokeWidth={2.5} />
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </SafeAreaView>
        </Modal>

        {/* Embedded Add Patient Modal */}
        <AddPatientModal
          visible={showCreatePatientModal}
          onClose={() => setShowCreatePatientModal(false)}
          onPatientAdded={async (newId) => {
            setShowCreatePatientModal(false);
            const combined = await fetchPatients();
            const found = combined?.find((p: any) => p.id === newId) as any;
            if (found) {
              setSelectedPatient({
                id: found.id,
                name: found.name,
                contact: found.phone,
                dummy: found.dummy,
              });
            }
          }}
        />

        {/* Success Modal */}
        <Modal
          visible={successCreatedAppointment !== null}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setSuccessCreatedAppointment(null);
            handleClose();
            onAppointmentAdded?.();
          }}
        >
          <View style={styles.successOverlay}>
            <View style={styles.successModalCard}>
              <View style={styles.successIconBadge}>
                <CheckCircle2 size={36} color="#059669" strokeWidth={2.5} />
              </View>
              <Text style={styles.successTitle}>Appointment Scheduled!</Text>
              <Text style={styles.successSubtitle}>
                The appointment has been confirmed and placed on the clinic calendar.
              </Text>

              <View style={styles.successSummaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Patient</Text>
                  <Text style={styles.summaryValue}>{successCreatedAppointment?.patientName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Date & Time</Text>
                  <Text style={styles.summaryValue}>
                    {successCreatedAppointment?.date} at {successCreatedAppointment?.time}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Service</Text>
                  <Text style={styles.summaryValue}>{successCreatedAppointment?.service}</Text>
                </View>
                <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.summaryLabel}>Dentist</Text>
                  <Text style={styles.summaryValue}>{successCreatedAppointment?.doctorName}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.successDoneBtn}
                onPress={() => {
                  setSuccessCreatedAppointment(null);
                  handleClose();
                  onAppointmentAdded?.();
                }}
                activeOpacity={0.8}
              >
                <Check size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.successDoneBtnText}>Done</Text>
              </TouchableOpacity>
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
    letterSpacing: 0.3,
  },
  assistantBadge: {
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
  assistantBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
  },
  errorText: {
    fontSize: 12,
    fontWeight: "700",
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  labelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  required: {
    color: "#EF4444",
  },
  quickAddPatientBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  quickAddPatientBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  patientPickerTrigger: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 12,
  },
  patientPickerTriggerEmpty: {
    borderStyle: "dashed",
  },
  emptyPatientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emptyPatientText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  selectedPatientBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  patientAvatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#047857",
    alignItems: "center",
    justifyContent: "center",
  },
  patientAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  selectedPatientName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  selectedPatientContact: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  walkinPill: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  walkinPillText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
  },
  textArea: {
    minHeight: 65,
    textAlignVertical: "top",
  },
  pillGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  servicePill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  servicePillActive: {
    backgroundColor: "#047857",
    borderColor: "#047857",
  },
  servicePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  servicePillTextActive: {
    color: "#FFFFFF",
  },
  timePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  timePillActive: {
    backgroundColor: "#047857",
    borderColor: "#047857",
  },
  timePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  timePillTextActive: {
    color: "#FFFFFF",
  },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pillBtnActive: {
    backgroundColor: "#047857",
    borderColor: "#047857",
  },
  pillBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  pillBtnTextActive: {
    color: "#FFFFFF",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
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
    backgroundColor: "#047857",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#047857",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: "#94A3B8",
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  pickerSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  searchBarBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
  },
  newPatientShortcutRow: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  newPatientShortcutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECFDF5",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  newPatientShortcutText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#047857",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  patientItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  patientItemRowSelected: {
    backgroundColor: "#F0FDF4",
  },
  patientItemAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  patientItemAvatarText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#475569",
  },
  patientItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  patientItemMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
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
});

