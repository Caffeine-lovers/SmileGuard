import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Calendar,
  Clock,
  Check,
  CheckCircle2,
  AlertCircle,
  XCircle,
  UserX,
  FileText,
  Stethoscope,
  User,
  Activity,
} from "lucide-react-native";
import { updateDoctorAppointmentStatus } from "../../lib/appointmentService";
import { getStatusColor, getStatusBgColor, getStatusLabel } from "../../lib/statusHelpers";
import { formatAppointmentDate, formatAppointmentTime } from "../../lib/dateFormatters";

interface AppointmentEditProps {
  visible: boolean;
  appointment: any;
  doctorId: string;
  onClose: () => void;
  onSave: () => void;
  onAppointmentStatusUpdated?: (
    status: 'completed' | 'cancelled' | 'no-show' | 'declined',
    patientName: string,
    appointmentId: string,
    patientId: string,
    doctorId: string
  ) => void;
}

const STATUS_OPTIONS: Array<'scheduled' | 'completed' | 'no-show' | 'cancelled' | 'declined'> = [
  'scheduled',
  'completed',
  'no-show',
  'cancelled',
  'declined',
];

// 2x3 Grid definition: 2 items per row for rows 1 & 2, full-width row 3 for declined
const STATUS_ROWS: Array<Array<'scheduled' | 'completed' | 'no-show' | 'cancelled' | 'declined'>> = [
  ['scheduled', 'completed'],
  ['no-show', 'cancelled'],
  ['declined'],
];

interface StatusMeta {
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; style?: any }>;
  description: string;
  hint: string;
}

const STATUS_META: Record<
  'scheduled' | 'completed' | 'pending' | 'no-show' | 'cancelled' | 'declined',
  StatusMeta
> = {
  scheduled: {
    label: "Scheduled",
    icon: Calendar,
    description: "Appointment is confirmed and scheduled on your clinic calendar.",
    hint: "Patient is queued to arrive for their treatment session.",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    description: "Procedure or treatment has been successfully finished.",
    hint: "Patient record will be logged as attended and completed.",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    description: "Appointment is awaiting clinic review and final approval.",
    hint: "Patient will be in the requests queue awaiting doctor confirmation.",
  },
  'no-show': {
    label: "No Show",
    icon: UserX,
    description: "Patient did not attend during their scheduled appointment window.",
    hint: "Marked as missed attendance for clinic tracking and follow-up.",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    description: "Appointment has been cancelled prior to the session.",
    hint: "This timeslot will be freed up on your clinic schedule.",
  },
  declined: {
    label: "Declined",
    icon: AlertCircle,
    description: "Appointment request was declined by the clinic.",
    hint: "Patient will receive a notification that the slot was declined.",
  },
};

export default function AppointmentEdit({
  visible,
  appointment,
  doctorId,
  onClose,
  onSave,
  onAppointmentStatusUpdated,
}: AppointmentEditProps) {
  const [selectedStatus, setSelectedStatus] = useState<
    'scheduled' | 'completed' | 'no-show' | 'cancelled' | 'declined'
  >('scheduled');
  const [doctorNote, setDoctorNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && appointment) {
      const normalizedStatus = (appointment.status || 'scheduled').toLowerCase();
      if (STATUS_OPTIONS.includes(normalizedStatus as any)) {
        setSelectedStatus(normalizedStatus as any);
      } else {
        // If appointment was pending or another status not in the 5 options, default selection to 'scheduled'
        setSelectedStatus('scheduled');
      }
      setDoctorNote(appointment.doctor_note || '');
    }
  }, [visible, appointment]);

  if (!appointment) return null;

  const patientName = appointment.name || appointment.patient_name || 'Patient';
  const serviceName = appointment.service || 'General Dental Treatment';
  const dateValue = appointment.appointment_date || appointment.date;
  const timeValue = appointment.appointment_time || appointment.time;
  const currentStatus = ((appointment.status || 'scheduled') as string).toLowerCase() as
    | 'scheduled'
    | 'completed'
    | 'pending'
    | 'no-show'
    | 'cancelled'
    | 'declined';
  const avatarSource =
    typeof appointment.imageUrl === 'string' && appointment.imageUrl.length > 0
      ? { uri: appointment.imageUrl }
      : typeof appointment.patient_avatar === 'string' && appointment.patient_avatar.length > 0
      ? { uri: appointment.patient_avatar }
      : typeof appointment.imageUrl === 'number'
      ? appointment.imageUrl
      : null;

  const isNoteChanged = (doctorNote || '').trim() !== (appointment.doctor_note || '').trim();
  const isStatusChanged = selectedStatus !== currentStatus || (selectedStatus === 'declined' && isNoteChanged);
  const activeMeta = STATUS_META[selectedStatus] || STATUS_META.scheduled;
  const ActiveIcon = activeMeta.icon;

  const handleSave = async () => {
    if (!appointment) return;

    if (!isStatusChanged && !isNoteChanged) {
      Alert.alert('No Changes', 'Please select a different status or update notes to save.');
      return;
    }

    try {
      setLoading(true);
      const appointmentId = appointment.id;

      const result = await updateDoctorAppointmentStatus(
        appointmentId,
        selectedStatus,
        doctorId,
        { doctor_note: doctorNote.trim() || undefined }
      );

      if (result.success) {
        // Trigger notification callback if status changed and callback is provided
        if (
          selectedStatus !== 'scheduled' &&
          onAppointmentStatusUpdated
        ) {
          onAppointmentStatusUpdated(
            selectedStatus,
            patientName,
            appointmentId,
            appointment.patient_id || '',
            doctorId
          );
        }

        Alert.alert(
          'Status Updated',
          `${patientName}'s appointment status has been updated to "${getStatusLabel(selectedStatus)}".`
        );
        onSave();
        onClose();
      } else {
        Alert.alert('Error', result.message || 'Failed to update appointment status.');
      }
    } catch (error) {
      console.error('[AppointmentEdit] Exception updating appointment:', error);
      Alert.alert('Error', 'An unexpected error occurred while updating status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Modern Top App Bar */}
        <View style={styles.topAppBar}>
          <TouchableOpacity
            style={styles.navIconButton}
            onPress={onClose}
            disabled={loading}
            activeOpacity={0.7}
            accessibilityLabel="Back"
          >
            <ChevronLeft size={20} color="#475569" />
          </TouchableOpacity>

          <View style={styles.topAppBarCenter}>
            <Text style={styles.topAppBarTitle}>UPDATE APPOINTMENT</Text>
            <Text style={styles.topAppBarSubtitle}>Clinical Status & Schedule</Text>
          </View>

          <View style={styles.topAppBarSpacer} />
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Patient & Appointment Card */}
          <View style={[styles.skeuoCard, styles.cardShadow]}>
            <View style={styles.patientHeaderRow}>
              {avatarSource ? (
                <Image source={avatarSource} style={styles.patientAvatar} />
              ) : (
                <View style={styles.patientAvatarFallback}>
                  <User size={22} color="#64748B" />
                </View>
              )}

              <View style={styles.patientHeaderInfo}>
                <Text style={styles.patientNameText} numberOfLines={1}>
                  {patientName}
                </Text>
                <View style={styles.serviceRow}>
                  <Stethoscope size={13} color="#64748B" />
                  <Text style={styles.serviceText} numberOfLines={1}>
                    {serviceName}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.currentBadge,
                  {
                    backgroundColor: getStatusBgColor(currentStatus),
                    borderColor: getStatusColor(currentStatus),
                  },
                ]}
              >
                <View
                  style={[
                    styles.currentBadgeDot,
                    { backgroundColor: getStatusColor(currentStatus) },
                  ]}
                />
                <Text
                  style={[
                    styles.currentBadgeText,
                    { color: getStatusColor(currentStatus) },
                  ]}
                >
                  {getStatusLabel(currentStatus).toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Appointment Schedule Box */}
            <View style={styles.appointmentInfoBox}>
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <View style={styles.infoIconWrap}>
                    <Calendar size={14} color="#64748B" />
                  </View>
                  <View style={styles.infoTextWrap}>
                    <Text style={styles.infoLabel}>APPOINTMENT DATE</Text>
                    <Text style={styles.infoValue}>
                      {formatAppointmentDate(dateValue) || "Not specified"}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoItemDivider} />

                <View style={styles.infoItem}>
                  <View style={styles.infoIconWrap}>
                    <Clock size={14} color="#64748B" />
                  </View>
                  <View style={styles.infoTextWrap}>
                    <Text style={styles.infoLabel}>SCHEDULED TIME</Text>
                    <Text style={styles.infoValue}>
                      {formatAppointmentTime(timeValue) || "Not specified"}
                    </Text>
                  </View>
                </View>
              </View>

              {appointment.notes ? (
                <View style={styles.notesContainer}>
                  <View style={styles.notesHeader}>
                    <FileText size={12} color="#64748B" />
                    <Text style={styles.notesLabel}>PATIENT NOTES & HEALTH INFO</Text>
                  </View>
                  <Text style={styles.notesText}>{appointment.notes}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Section: Status Selector */}
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <Activity size={15} color="#64748B" />
              <Text style={styles.sectionTitle}>SELECT NEW APPOINTMENT STATUS</Text>
            </View>
            <View style={styles.statusCountBadge}>
              <Text style={styles.statusCountText}>{STATUS_OPTIONS.length} OPTIONS</Text>
            </View>
          </View>

          {/* 2x3 Status Grid: 2 columns for rows 1 & 2, full width for row 3 (declined) */}
          <View style={styles.statusGrid}>
            {STATUS_ROWS.map((row, rowIndex) => {
              const isFullWidthRow = row.length === 1;

              return (
                <View key={`row-${rowIndex}`} style={styles.statusRow}>
                  {row.map((status) => {
                    const meta = STATUS_META[status];
                    const IconComponent = meta.icon;
                    const isSelected = selectedStatus === status;
                    const isCurrent = currentStatus === status;
                    const statusColor = getStatusColor(status);
                    const statusBg = getStatusBgColor(status);

                    return (
                      <TouchableOpacity
                        key={status}
                        activeOpacity={0.8}
                        style={[
                          styles.statusCard,
                          isFullWidthRow && styles.statusCardFullWidth,
                          isSelected
                            ? [
                                styles.statusCardSelected,
                                {
                                  backgroundColor: statusBg,
                                  borderColor: statusColor,
                                  borderBottomColor: statusColor,
                                },
                              ]
                            : styles.statusCardUnselected,
                        ]}
                        onPress={() => setSelectedStatus(status)}
                      >
                        {isFullWidthRow ? (
                          <View style={styles.fullWidthCardRow}>
                            <View style={styles.fullWidthLeftGroup}>
                              <View
                                style={[
                                  styles.statusIconCircle,
                                  {
                                    backgroundColor: isSelected ? '#FFFFFF' : '#F1F5F9',
                                    borderColor: isSelected ? statusColor : '#E2E8F0',
                                  },
                                ]}
                              >
                                <IconComponent
                                  size={16}
                                  color={isSelected ? statusColor : '#64748B'}
                                />
                              </View>
                              <View style={styles.fullWidthLabelGroup}>
                                <Text
                                  style={[
                                    styles.statusCardTitle,
                                    { color: isSelected ? statusColor : '#1E293B' },
                                  ]}
                                >
                                  {meta.label}
                                </Text>
                                {isCurrent && (
                                  <Text style={styles.statusCurrentTag}>Current</Text>
                                )}
                              </View>
                            </View>

                            {isSelected ? (
                              <View
                                style={[
                                  styles.checkIndicator,
                                  { backgroundColor: statusColor },
                                ]}
                              >
                                <Check size={11} color="#FFFFFF" strokeWidth={3} />
                              </View>
                            ) : (
                              <View style={styles.unselectedRadio} />
                            )}
                          </View>
                        ) : (
                          <>
                            <View style={styles.statusCardTop}>
                              <View
                                style={[
                                  styles.statusIconCircle,
                                  {
                                    backgroundColor: isSelected ? '#FFFFFF' : '#F1F5F9',
                                    borderColor: isSelected ? statusColor : '#E2E8F0',
                                  },
                                ]}
                              >
                                <IconComponent
                                  size={16}
                                  color={isSelected ? statusColor : '#64748B'}
                                />
                              </View>

                              {isSelected ? (
                                <View
                                  style={[
                                    styles.checkIndicator,
                                    { backgroundColor: statusColor },
                                  ]}
                                >
                                  <Check size={11} color="#FFFFFF" strokeWidth={3} />
                                </View>
                              ) : (
                                <View style={styles.unselectedRadio} />
                              )}
                            </View>

                            <View style={styles.statusCardBody}>
                              <Text
                                style={[
                                  styles.statusCardTitle,
                                  { color: isSelected ? statusColor : '#1E293B' },
                                ]}
                              >
                                {meta.label}
                              </Text>
                              {isCurrent && (
                                <Text style={styles.statusCurrentTag}>Current</Text>
                              )}
                            </View>
                          </>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>

          {/* Active Status Explanation Card */}
          <View
            style={[
              styles.explanationCard,
              {
                borderColor: getStatusColor(selectedStatus),
                backgroundColor: getStatusBgColor(selectedStatus),
              },
            ]}
          >
            <View style={styles.explanationHeader}>
              <View
                style={[
                  styles.explanationIconWrap,
                  { backgroundColor: getStatusColor(selectedStatus) },
                ]}
              >
                <ActiveIcon size={14} color="#FFFFFF" />
              </View>
              <Text
                style={[
                  styles.explanationTitle,
                  { color: getStatusColor(selectedStatus) },
                ]}
              >
                {activeMeta.label.toUpperCase()} STATUS EFFECT
              </Text>
            </View>
            <Text style={styles.explanationDescription}>
              {activeMeta.description}
            </Text>
            <Text style={styles.explanationHint}>
              💡 {activeMeta.hint}
            </Text>
          </View>

          {/* Doctor Note Section (Particularly important when declining) */}
          <View style={styles.doctorNoteCard}>
            <View style={styles.doctorNoteHeader}>
              <AlertCircle size={15} color="#0F766E" />
              <Text style={styles.doctorNoteTitle}>
                {selectedStatus === 'declined' ? "DOCTOR'S NOTE / REASON FOR DECLINING" : "CLINICAL / DOCTOR'S NOTE"}
              </Text>
            </View>
            <Text style={styles.doctorNoteSubtext}>
              {selectedStatus === 'declined'
                ? "Provide clinical reasoning or reasons why this appointment is declined."
                : "Internal clinical remarks or instructions regarding this appointment."}
            </Text>
            <TextInput
              style={styles.doctorNoteInput}
              placeholder={selectedStatus === 'declined' ? "e.g., Slot unavailable, patient medical clearance needed..." : "Add doctor's note..."}
              placeholderTextColor="#94A3B8"
              value={doctorNote}
              onChangeText={setDoctorNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!loading}
            />
          </View>
        </ScrollView>

        {/* Tactile Skeuomorphic Footer */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>CANCEL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              !isStatusChanged && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={loading || !isStatusChanged}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.saveButtonText}>
                  {isStatusChanged ? "CONFIRM STATUS" : "NO CHANGES"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // Top App Bar
  topAppBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1.5,
    borderBottomColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 2,
  },

  topAppBarCenter: {
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 8,
  },

  topAppBarTitle: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.5,
  },

  topAppBarSubtitle: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 1,
  },

  navIconButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },

  topAppBarSpacer: {
    width: 36,
    height: 36,
  },

  // Content
  scrollContainer: {
    flex: 1,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },

  // Skeuo Card
  skeuoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    padding: 14,
    marginBottom: 20,
  },

  cardShadow: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },

  patientHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  patientAvatar: {
    width: 46,
    height: 46,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },

  patientAvatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },

  patientHeaderInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  patientNameText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.2,
  },

  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },

  serviceText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },

  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 4,
    borderWidth: 1,
  },

  currentBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  currentBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // Appointment Info Box
  appointmentInfoBox: {
    marginTop: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  infoItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  infoItemDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 8,
  },

  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },

  infoTextWrap: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.4,
  },

  infoValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 1,
  },

  notesContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },

  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },

  notesLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.5,
  },

  notesText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "500",
    lineHeight: 16,
  },

  // Section Headers
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  sectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.6,
  },

  statusCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#E2E8F0",
  },

  statusCountText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.5,
  },

  // 2x3 Status Grid
  statusGrid: {
    marginBottom: 16,
  },

  statusRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },

  statusCard: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    minHeight: 82,
    justifyContent: "space-between",
  },

  statusCardFullWidth: {
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
  },

  fullWidthCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },

  fullWidthLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
  },

  fullWidthLabelGroup: {
    marginLeft: 10,
  },

  statusCardSelected: {
    borderWidth: 1.5,
    borderBottomWidth: 2.5,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  statusCardUnselected: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    borderBottomWidth: 2,
  },

  statusCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  statusIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  checkIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  unselectedRadio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },

  statusCardBody: {
    marginTop: 8,
  },

  statusCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  statusCurrentTag: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 1,
  },

  // Explanation Callout
  explanationCard: {
    borderRadius: 6,
    borderWidth: 1.5,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 8,
  },

  explanationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },

  explanationIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  explanationTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  explanationDescription: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E293B",
    lineHeight: 17,
  },

  explanationHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    marginTop: 6,
    lineHeight: 15,
  },

  // Footer Actions
  footerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1.5,
    borderTopColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 3,
  },

  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderBottomWidth: 2.5,
    borderBottomColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.5,
  },

  saveButton: {
    flex: 1.6,
    paddingVertical: 12,
    backgroundColor: "#10B981",
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#34D399",
    borderLeftColor: "#34D399",
    borderBottomColor: "#047857",
    borderRightColor: "#047857",
    borderBottomWidth: 2.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  saveButtonDisabled: {
    backgroundColor: "#94A3B8",
    borderTopColor: "#CBD5E1",
    borderLeftColor: "#CBD5E1",
    borderBottomColor: "#64748B",
    borderRightColor: "#64748B",
    opacity: 0.7,
  },

  saveButtonText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },

  // Doctor note card styles
  doctorNoteCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  doctorNoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  doctorNoteTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0F766E",
    letterSpacing: 0.5,
  },
  doctorNoteSubtext: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 8,
    lineHeight: 15,
  },
  doctorNoteInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 6,
    padding: 10,
    fontSize: 13,
    color: "#1E293B",
    minHeight: 70,
  },
});
