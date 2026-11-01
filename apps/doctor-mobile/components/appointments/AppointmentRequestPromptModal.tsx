import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  X,
  Stethoscope,
  HeartPulse,
} from "lucide-react-native";
import { DashboardAppointment } from "../dashboard/DoctorDashboard";
import { formatAppointmentDate, formatAppointmentTime } from "../../lib/dateFormatters";

export interface AppointmentRequestPromptModalProps {
  visible: boolean;
  appointment: DashboardAppointment | null;
  loading?: boolean;
  onClose: () => void;
  onAccept: (appointment: DashboardAppointment) => Promise<void> | void;
  onDecline: (appointment: DashboardAppointment, doctorNote: string) => Promise<void> | void;
}

export default function AppointmentRequestPromptModal({
  visible,
  appointment,
  loading = false,
  onClose,
  onAccept,
  onDecline,
}: AppointmentRequestPromptModalProps) {
  const [showDeclineReasonInput, setShowDeclineReasonInput] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset internal states when modal closes or appointment changes
  const handleClose = () => {
    if (submitting) return;
    setShowDeclineReasonInput(false);
    setDeclineReason("");
    onClose();
  };

  const handleConfirmAccept = async () => {
    if (!appointment || submitting) return;
    try {
      setSubmitting(true);
      await onAccept(appointment);
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartDecline = () => {
    setShowDeclineReasonInput(true);
  };

  const handleConfirmDecline = async () => {
    if (!appointment || submitting) return;
    try {
      setSubmitting(true);
      await onDecline(appointment, declineReason.trim());
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible || !appointment) return null;

  const patientName = appointment.name || "Patient";
  const avatarSource =
    typeof appointment.imageUrl === "string" && appointment.imageUrl.length > 0
      ? { uri: appointment.imageUrl }
      : typeof appointment.imageUrl === "number"
      ? appointment.imageUrl
      : require("../../assets/images/user.png");

  const formattedDate = formatAppointmentDate(appointment.date);
  const formattedTime = formatAppointmentTime(appointment.time);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardContainer}
        >
          <View style={styles.cardContainer}>
            {/* Header Badge & Title */}
            <View style={styles.headerRow}>
              <View style={styles.titleBadge}>
                <Stethoscope size={18} color="#047857" />
                <Text style={styles.titleBadgeText}>APPOINTMENT REQUEST</Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                disabled={submitting}
                style={styles.closeIconButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Patient Hero Card */}
              <View style={styles.patientHero}>
                <Image source={avatarSource} style={styles.patientAvatar} />
                <View style={styles.patientInfo}>
                  <Text style={styles.patientName} numberOfLines={1}>
                    {patientName}
                  </Text>
                  <Text style={styles.serviceText}>
                    {appointment.service || "General Dental Consultation"}
                  </Text>
                </View>
              </View>

              {/* Schedule Details Box */}
              <View style={styles.detailsBox}>
                <View style={styles.detailRow}>
                  <Calendar size={16} color="#059669" />
                  <Text style={styles.detailLabel}>Requested Date:</Text>
                  <Text style={styles.detailValue}>{formattedDate}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Clock size={16} color="#059669" />
                  <Text style={styles.detailLabel}>Preferred Time:</Text>
                  <Text style={styles.detailValue}>{formattedTime || appointment.time}</Text>
                </View>

                {appointment.contact ? (
                  <View style={styles.detailRow}>
                    <Phone size={16} color="#059669" />
                    <Text style={styles.detailLabel}>Contact:</Text>
                    <Text style={styles.detailValue}>{appointment.contact}</Text>
                  </View>
                ) : null}

                {appointment.email ? (
                  <View style={styles.detailRow}>
                    <Mail size={16} color="#059669" />
                    <Text style={styles.detailLabel}>Email:</Text>
                    <Text style={styles.detailValue} numberOfLines={1}>
                      {appointment.email}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Patient Notes / Chief Complaint */}
              {appointment.notes ? (
                <View style={styles.notesSection}>
                  <View style={styles.notesHeader}>
                    <FileText size={15} color="#0284C7" />
                    <Text style={styles.notesTitle}>PATIENT NOTES / INTAKE</Text>
                  </View>
                  <Text style={styles.notesBody}>{appointment.notes}</Text>
                </View>
              ) : null}

              {/* Medical Intake Flags (Allergies / Conditions if present) */}
              {appointment.medicalIntake?.allergies || appointment.medicalIntake?.medicalConditions ? (
                <View style={styles.medicalAlertBox}>
                  <View style={styles.notesHeader}>
                    <HeartPulse size={15} color="#DC2626" />
                    <Text style={styles.medicalAlertTitle}>MEDICAL ALERTS</Text>
                  </View>
                  {appointment.medicalIntake?.allergies ? (
                    <Text style={styles.alertText}>
                      <Text style={styles.boldText}>Allergies: </Text>
                      {appointment.medicalIntake.allergies}
                    </Text>
                  ) : null}
                  {appointment.medicalIntake?.medicalConditions ? (
                    <Text style={styles.alertText}>
                      <Text style={styles.boldText}>Conditions: </Text>
                      {appointment.medicalIntake.medicalConditions}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Decline Reason Input Section (Appears when doctor taps Decline) */}
              {showDeclineReasonInput && (
                <View style={styles.declineReasonSection}>
                  <View style={styles.declineHeader}>
                    <AlertCircle size={16} color="#DC2626" />
                    <Text style={styles.declineHeaderText}>Doctor&apos;s Note / Reason for Decline</Text>
                  </View>
                  <Text style={styles.declineSubtext}>
                    Provide a note explaining why this request cannot be accepted (e.g., fully booked, out of clinic, doctor schedule conflict).
                  </Text>
                  <TextInput
                    style={styles.declineInput}
                    placeholder="Enter reason for declining..."
                    placeholderTextColor="#94A3B8"
                    value={declineReason}
                    onChangeText={setDeclineReason}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    editable={!submitting}
                  />
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              {submitting || loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#059669" />
                  <Text style={styles.loadingText}>Updating appointment...</Text>
                </View>
              ) : !showDeclineReasonInput ? (
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.declineBtn]}
                    onPress={handleStartDecline}
                    activeOpacity={0.8}
                  >
                    <XCircle size={18} color="#DC2626" />
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.acceptBtn]}
                    onPress={handleConfirmAccept}
                    activeOpacity={0.8}
                  >
                    <CheckCircle2 size={18} color="#FFFFFF" />
                    <Text style={styles.acceptBtnText}>Accept Request</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.cancelReasonBtn]}
                    onPress={() => setShowDeclineReasonInput(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cancelReasonBtnText}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.confirmDeclineBtn]}
                    onPress={handleConfirmDecline}
                    activeOpacity={0.8}
                  >
                    <XCircle size={18} color="#FFFFFF" />
                    <Text style={styles.confirmDeclineBtnText}>Confirm Decline</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  keyboardContainer: {
    width: "100%",
    maxWidth: 440,
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    maxHeight: "88%",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    backgroundColor: "#F8FAFC",
  },
  titleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  titleBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F766E",
    letterSpacing: 0.8,
  },
  closeIconButton: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#EDF2F7",
  },
  scrollContent: {
    padding: 20,
  },
  patientHero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  patientAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    marginRight: 14,
    backgroundColor: "#E2E8F0",
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  serviceText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
  },
  detailsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 8,
    marginRight: 6,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    flex: 1,
    textAlign: "right",
  },
  notesSection: {
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  notesTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0369A1",
    letterSpacing: 0.6,
  },
  notesBody: {
    fontSize: 13,
    color: "#1E293B",
    lineHeight: 18,
  },
  medicalAlertBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  medicalAlertTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#B91C1C",
    letterSpacing: 0.6,
  },
  alertText: {
    fontSize: 12,
    color: "#7F1D1D",
    marginTop: 2,
  },
  boldText: {
    fontWeight: "700",
  },
  declineReasonSection: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1.5,
    borderColor: "#FDA4AF",
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  declineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  declineHeaderText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#BE123C",
  },
  declineSubtext: {
    fontSize: 11.5,
    color: "#9F1239",
    marginBottom: 10,
    lineHeight: 16,
  },
  declineInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F43F5E",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
    minHeight: 70,
  },
  actionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#FAFAFA",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    gap: 8,
  },
  declineBtn: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
  },
  acceptBtn: {
    backgroundColor: "#059669",
    borderWidth: 1,
    borderColor: "#047857",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cancelReasonBtn: {
    backgroundColor: "#E2E8F0",
  },
  cancelReasonBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  confirmDeclineBtn: {
    backgroundColor: "#E11D48",
    borderWidth: 1,
    borderColor: "#BE123C",
  },
  confirmDeclineBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

