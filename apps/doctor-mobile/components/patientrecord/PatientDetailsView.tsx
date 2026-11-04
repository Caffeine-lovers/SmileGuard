import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  X,
  User,
  Phone,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Stethoscope,
  CreditCard,
  ShieldCheck,
  Activity,
  ChevronRight,
  ExternalLink,
  Sparkles,
} from "lucide-react-native";
import {
  getPatientMedicalInfo,
  getPatientAppointments,
  updatePastAppointmentsToNoShow,
  getPatientBillingInfo,
  getPatientProfile,
  updatePatientPwdStatus,
  getPatientIdPhotoUrl,
  type PatientBillingInfo,
} from "../../lib/profilesPatients";
import { MedicalIntake } from "../../types/index";
import AppointmentHistory from "../appointments/appointmentHistory";
import AppointmentEdit from "../appointments/appointmentEdit";
import { getStatusColor, getStatusBgColor, getStatusLabel } from "../../lib/statusHelpers";
import { formatDateOfBirth, formatAppointmentDate, formatAppointmentTime } from "../../lib/dateFormatters";

export type AppointmentType = {
  id: string;
  patient_id?: string;
  name: string;
  service: string;
  time: string;
  date: string; // YYYY-MM-DD
  age: number;
  gender: string;
  contact: string;
  email: string;
  notes: string;
  imageUrl: string | number; // string for URI, number for require()
  initials?: string;
  status?: 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined';
  // Medical intake fields
  dateOfBirth?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  emergencyContact2Name?: string;
  emergencyContact2Phone?: string;
  emergencyContact2Relationship?: string;
  allergies?: string;
  dummy?: boolean;
  is_dummy?: boolean;
  currentMedications?: string;
  medicalConditions?: string;
  pastSurgeries?: string;
  smokingStatus?: "never" | "former" | "current" | "";
  pregnancyStatus?: "yes" | "no" | "na" | "";
};

interface PatientDetailsViewProps {
  visible: boolean;
  patient: AppointmentType | null;
  doctorId?: string;
  onClose: () => void;
  onAppointmentStatusUpdated?: (
    status: 'completed' | 'cancelled' | 'no-show' | 'declined',
    patientName: string,
    appointmentId: string,
    patientId: string,
    doctorId: string
  ) => void;
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "Not available";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const calculateAge = (dateOfBirth: string | undefined): number | null => {
  if (!dateOfBirth) return null;

  try {
    let birthDate: Date;
    if (dateOfBirth.includes('/')) {
      const [month, day, year] = dateOfBirth.split('/');
      birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      birthDate = new Date(dateOfBirth);
    }

    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age >= 0 ? age : null;
  } catch {
    return null;
  }
};

export default function PatientDetailsView({
  visible,
  patient,
  doctorId,
  onClose,
  onAppointmentStatusUpdated,
}: PatientDetailsViewProps) {
  const [medicalIntake, setMedicalIntake] = useState<MedicalIntake | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [billingInfo, setBillingInfo] = useState<PatientBillingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAppointmentHistory, setShowAppointmentHistory] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [showIdPhotoModal, setShowIdPhotoModal] = useState(false);
  const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null);

  // IDs live in a private bucket — resolve a short-lived signed link whenever the profile changes
  useEffect(() => {
    let cancelled = false;
    getPatientIdPhotoUrl(patientProfile).then((url) => {
      if (!cancelled) setIdPhotoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [patientProfile?.pwd_id_path, patientProfile?.pwd_id_url]);
  const [updatingPwd, setUpdatingPwd] = useState(false);

  const effectivePatientId = patient?.patient_id || patient?.id;

  useEffect(() => {
    if (visible && effectivePatientId) {
      setMedicalIntake(null);
      setAppointments([]);
      setBillingInfo(null);
      setLoading(true);
      loadPatientData(effectivePatientId);
    }
  }, [visible, effectivePatientId]);

  const loadPatientData = async (patientId: string) => {
    try {
      const [intake, appts, billing, profile] = await Promise.all([
        getPatientMedicalInfo(patientId),
        getPatientAppointments(patientId),
        getPatientBillingInfo(patientId),
        getPatientProfile(patientId),
      ]);
      setPatientProfile(profile);
      setMedicalIntake(intake);

      await updatePastAppointmentsToNoShow(appts);
      const updatedAppts = await getPatientAppointments(patientId);
      setAppointments(updatedAppts);
      setBillingInfo(billing);
    } catch (error) {
      console.error('❌ Error loading patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAppointments = async (patientId: string) => {
    try {
      const appts = await getPatientAppointments(patientId);
      await updatePastAppointmentsToNoShow(appts);
      const updatedAppts = await getPatientAppointments(patientId);
      setAppointments(updatedAppts);
    } catch (error) {
      console.error('Error reloading appointments:', error);
    }
  };

  const handleApprovePwd = async () => {
    if (!effectivePatientId) return;
    setUpdatingPwd(true);
    try {
      const res = await updatePatientPwdStatus(effectivePatientId, 'approved', doctorId);
      if (res.success) {
        setPatientProfile((prev: any) => ({ ...prev, pwd_status: 'approved' }));
        Alert.alert(
          'Verification Approved',
          'Patient has been certified as a verified ' +
            (patientProfile?.pwd_type === 'senior' ? 'Senior Citizen' : 'PWD') +
            '. The statutory 20% discount is now active.'
        );
      } else {
        Alert.alert('Error', res.error || 'Failed to approve PWD status.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUpdatingPwd(false);
    }
  };

  const handleRejectPwd = async () => {
    if (!effectivePatientId) return;
    setUpdatingPwd(true);
    try {
      const res = await updatePatientPwdStatus(effectivePatientId, 'rejected', doctorId);
      if (res.success) {
        setPatientProfile((prev: any) => ({ ...prev, pwd_status: 'rejected' }));
        Alert.alert(
          'Verification Declined',
          'Patient verification was rejected. The patient will be notified to re-submit.'
        );
      } else {
        Alert.alert('Error', res.error || 'Failed to reject PWD status.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setUpdatingPwd(false);
    }
  };

  const handleEditAppointment = (appointment: any) => {
    setEditingAppointment({
      ...appointment,
      appointment_date: appointment.appointment_date || appointment.date,
      appointment_time: appointment.appointment_time || appointment.time,
    });
    setShowEditModal(true);
  };

  const handleSaveAppointment = async () => {
    if (effectivePatientId) {
      await loadAppointments(effectivePatientId);
    }
  };

  if (!patient) return null;

  const patientName = patientProfile?.name || patient.name || 'Patient';
  const avatarSource =
    typeof patientProfile?.avatar_url === 'string' && patientProfile.avatar_url.length > 0
      ? { uri: patientProfile.avatar_url }
      : typeof patient.imageUrl === 'string' && patient.imageUrl.length > 0
      ? { uri: patient.imageUrl }
      : typeof patient.imageUrl === 'number'
      ? patient.imageUrl
      : null;

  const age = calculateAge(medicalIntake?.dateOfBirth || patient.dateOfBirth) ?? (patient.age > 0 ? patient.age : null);
  const gender = medicalIntake?.gender || patient.gender || null;
  const phone = medicalIntake?.phone || patientProfile?.phone || patient.contact || null;
  const email = patientProfile?.email || patient.email || null;

  // Appointment metrics
  const completedCount = appointments.filter((a) => a.status === 'completed').length;
  const totalAppointmentsCount = appointments.length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        {/* Top App Bar */}
        <View style={styles.topAppBar}>
          <TouchableOpacity
            style={styles.navIconButton}
            onPress={onClose}
            activeOpacity={0.7}
            accessibilityLabel="Back"
          >
            <ChevronLeft size={20} color="#475569" />
          </TouchableOpacity>

          <View style={styles.topAppBarCenter}>
            <Text style={styles.topAppBarTitle}>PATIENT MEDICAL RECORD</Text>
            <Text style={styles.topAppBarSubtitle} numberOfLines={1}>
              {patientName} • Dental Chart
            </Text>
          </View>

          <View style={styles.topAppBarSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Loading patient records...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Patient Hero Card */}
            <View style={[styles.skeuoCard, styles.cardShadow]}>
              <View style={styles.heroHeaderRow}>
                {avatarSource ? (
                  <Image source={avatarSource} style={styles.heroAvatar} />
                ) : (
                  <View style={styles.heroAvatarFallback}>
                    <User size={28} color="#047857" />
                  </View>
                )}

                <View style={styles.heroInfoWrap}>
                  <Text style={styles.heroName} numberOfLines={1}>
                    {patientName}
                  </Text>

                  <View style={styles.heroBadgeRow}>
                    {((patient as any).dummy || patientProfile?.dummy) ? (
                      <View style={styles.dummyBadge}>
                        <Text style={styles.dummyBadgeText}>DUMMY</Text>
                      </View>
                    ) : (
                      <View style={styles.patientBadge}>
                        <Text style={styles.patientBadgeText}>PATIENT</Text>
                      </View>
                    )}
                    {(age || gender) && (
                      <View style={styles.demographicBadge}>
                        <Text style={styles.demographicText}>
                          {[age ? `${age} yrs` : null, gender].filter(Boolean).join(' • ')}
                        </Text>
                      </View>
                    )}
                    {patientProfile?.pwd_status === 'approved' && (
                      <View style={styles.pwdVerifiedBadge}>
                        <ShieldCheck size={11} color="#047857" />
                        <Text style={styles.pwdVerifiedText}>
                          {patientProfile.pwd_type === 'senior' ? 'SENIOR' : 'PWD'} VERIFIED
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Practice Metrics Bar */}
              <View style={styles.metricsBar}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>APPOINTMENTS</Text>
                  <Text style={styles.metricValue}>{totalAppointmentsCount}</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>COMPLETED</Text>
                  <Text style={[styles.metricValue, { color: '#047857' }]}>{completedCount}</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>TOTAL PAID</Text>
                  <Text style={[styles.metricValue, { color: '#10B981' }]}>
                    ₱{billingInfo ? billingInfo.paidAmount.toFixed(0) : '0'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Statutory Discount & Verification Banner */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <ShieldCheck size={14} color="#047857" />
                  <Text style={styles.sectionHeaderTitle}>STATUTORY DISCOUNT (PWD / SENIOR)</Text>
                </View>
              </View>

              <View style={[styles.skeuoCard, styles.cardShadow, { padding: 14 }]}>
                {patientProfile?.pwd_status === 'approved' ? (
                  <View style={styles.pwdApprovedBox}>
                    <View style={styles.pwdAlertHeader}>
                      <ShieldCheck size={15} color="#047857" />
                      <Text style={styles.pwdApprovedTitle}>
                        Verified {patientProfile?.pwd_type === 'senior' ? 'Senior Citizen' : 'PWD'} Patient
                      </Text>
                    </View>
                    <Text style={styles.pwdApprovedDesc}>
                      Certified by clinic. The statutory 20% deduction is applied to invoices.
                    </Text>
                    {(idPhotoUrl || patientProfile?.pwd_id_url) && (
                      <TouchableOpacity
                        onPress={() => setShowIdPhotoModal(true)}
                        style={styles.pwdViewIdBtn}
                        activeOpacity={0.7}
                      >
                        <ExternalLink size={12} color="#047857" />
                        <Text style={styles.pwdViewIdText}>View Verified Government ID</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={handleRejectPwd}
                      disabled={updatingPwd}
                      style={styles.pwdRevokeBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.pwdRevokeText}>
                        {updatingPwd ? 'Updating...' : 'Revoke Discount Verification'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : patientProfile?.pwd_status === 'pending' ? (
                  <View style={styles.pwdPendingBox}>
                    <View style={styles.pwdAlertHeader}>
                      <AlertCircle size={15} color="#B45309" />
                      <Text style={styles.pwdPendingTitle}>
                        {patientProfile?.pwd_type === 'senior' ? 'Senior Citizen' : 'PWD'} Verification Request
                      </Text>
                    </View>
                    <Text style={styles.pwdPendingDesc}>
                      Patient uploaded government ID proof requesting 20% statutory discount. Please review the ID card below.
                    </Text>

                    {(idPhotoUrl || patientProfile?.pwd_id_url) && (
                      <TouchableOpacity
                        onPress={() => setShowIdPhotoModal(true)}
                        style={styles.pwdThumbnailBox}
                        activeOpacity={0.8}
                      >
                        <Image
                          source={{ uri: idPhotoUrl || patientProfile.pwd_id_url }}
                          style={styles.pwdThumbnailImage}
                          resizeMode="contain"
                        />
                        <View style={styles.pwdExpandPill}>
                          <Text style={styles.pwdExpandPillText}>Tap to View Full Size</Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    <View style={styles.pwdActionButtons}>
                      <TouchableOpacity
                        onPress={handleApprovePwd}
                        disabled={updatingPwd}
                        style={styles.pwdApproveBtn}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.pwdApproveBtnText}>
                          {updatingPwd ? 'Processing...' : '✓ Approve 20% Discount'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleRejectPwd}
                        disabled={updatingPwd}
                        style={styles.pwdRejectBtn}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.pwdRejectBtnText}>✕ Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : patientProfile?.pwd_status === 'rejected' ? (
                  <View style={styles.pwdRejectedBox}>
                    <View style={styles.pwdAlertHeader}>
                      <AlertCircle size={15} color="#B91C1C" />
                      <Text style={styles.pwdRejectedTitle}>Verification Declined by Doctor</Text>
                    </View>
                    <Text style={styles.pwdRejectedDesc}>
                      Patient has not been certified for statutory discounts.
                    </Text>
                    <TouchableOpacity
                      onPress={handleApprovePwd}
                      disabled={updatingPwd}
                      style={styles.pwdReevaluateBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.pwdReevaluateText}>
                        {updatingPwd ? 'Updating...' : 'Re-evaluate & Approve'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.noDataMutedText}>
                    No statutory PWD or Senior Citizen discount requested. Standard clinic pricing applies.
                  </Text>
                )}
              </View>
            </View>

            {/* Personal Information */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <User size={14} color="#047857" />
                  <Text style={styles.sectionHeaderTitle}>PERSONAL INFORMATION</Text>
                </View>
              </View>

              <View style={[styles.skeuoCard, styles.cardShadow, { paddingHorizontal: 12, paddingVertical: 4 }]}>
                <DetailRow label="Gender" value={gender || "Not specified"} />
                <DetailRow label="Contact Number" value={phone || "Not provided"} />
                <DetailRow label="Email" value={email || "Not provided"} />
                <DetailRow label="Date of Birth" value={formatDateOfBirth(medicalIntake?.dateOfBirth || patientProfile?.date_of_birth || "")} />
                {age !== null && <DetailRow label="Age" value={`${age} years old`} />}
                <DetailRow
                  label="Address"
                  value={medicalIntake?.address || patientProfile?.address || (patient as any).address || "Not provided"}
                  isLast={true}
                />
              </View>
            </View>

            {/* Emergency Contact */}
            {Boolean(
              medicalIntake?.emergencyContactName ||
              medicalIntake?.emergencyContactPhone ||
              patientProfile?.emergency_contact_name ||
              patientProfile?.emergency_contact_phone
            ) ? (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleGroup}>
                    <Phone size={14} color="#047857" />
                    <Text style={styles.sectionHeaderTitle}>EMERGENCY CONTACT INFORMATION</Text>
                  </View>
                </View>

                <View style={[styles.skeuoCard, styles.cardShadow, { paddingHorizontal: 12, paddingVertical: 4 }]}>
                  {/* Primary Emergency Contact */}
                  <DetailRow
                    label="Primary Contact"
                    value={
                      medicalIntake?.emergencyContactName ||
                      patientProfile?.emergency_contact_name ||
                      "Not provided"
                    }
                  />
                  {(medicalIntake?.emergencyContactRelationship || patientProfile?.emergency_contact_relationship) ? (
                    <DetailRow
                      label="Relationship"
                      value={
                        medicalIntake?.emergencyContactRelationship ||
                        patientProfile?.emergency_contact_relationship ||
                        "Not provided"
                      }
                    />
                  ) : null}
                  <DetailRow
                    label="Primary Phone"
                    value={
                      medicalIntake?.emergencyContactPhone ||
                      patientProfile?.emergency_contact_phone ||
                      "Not provided"
                    }
                    isHighlight={true}
                    isLast={!medicalIntake?.emergencyContact2Name && !patientProfile?.emergency_contact_2_name}
                  />

                  {/* Secondary Emergency Contact */}
                  {(medicalIntake?.emergencyContact2Name || patientProfile?.emergency_contact_2_name) ? (
                    <>
                      <DetailRow
                        label="Secondary Contact"
                        value={
                          medicalIntake?.emergencyContact2Name ||
                          patientProfile?.emergency_contact_2_name ||
                          "Not provided"
                        }
                      />
                      {(medicalIntake?.emergencyContact2Relationship || patientProfile?.emergency_contact_2_relationship) ? (
                        <DetailRow
                          label="Relationship"
                          value={
                            medicalIntake?.emergencyContact2Relationship ||
                            patientProfile?.emergency_contact_2_relationship ||
                            "Not provided"
                          }
                        />
                      ) : null}
                      <DetailRow
                        label="Secondary Phone"
                        value={
                          medicalIntake?.emergencyContact2Phone ||
                          patientProfile?.emergency_contact_2_phone ||
                          "Not provided"
                        }
                        isHighlight={true}
                        isLast={true}
                      />
                    </>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Clinical & Medical History */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <Activity size={14} color="#047857" />
                  <Text style={styles.sectionHeaderTitle}>CLINICAL & MEDICAL HISTORY</Text>
                </View>
              </View>

              <View style={[styles.skeuoCard, styles.cardShadow, { paddingHorizontal: 12, paddingVertical: 4 }]}>
                {medicalIntake ? (
                  <>
                    <DetailRow
                      label="Allergies"
                      value={medicalIntake.allergies || "None declared"}
                      isAlert={Boolean(medicalIntake.allergies && medicalIntake.allergies.toLowerCase() !== 'none')}
                    />
                    {((patient as any).dummy || patientProfile?.dummy) ? (
                      <DetailRow
                        label="Record Type"
                        value="Walk-in / Clinic Keeper Patient"
                        isLast={true}
                      />
                    ) : (
                      <>
                        <DetailRow
                          label="Current Medications"
                          value={medicalIntake.currentMedications || "None"}
                        />
                        <DetailRow
                          label="Medical Conditions"
                          value={medicalIntake.medicalConditions || "None declared"}
                          isAlert={Boolean(medicalIntake.medicalConditions && medicalIntake.medicalConditions.toLowerCase() !== 'none')}
                        />
                        <DetailRow
                          label="Past Surgeries"
                          value={medicalIntake.pastSurgeries || "None"}
                        />
                        <DetailRow
                          label="Smoking Status"
                          value={medicalIntake.smokingStatus ? medicalIntake.smokingStatus.toUpperCase() : "None"}
                        />
                        {medicalIntake.gender?.toLowerCase() !== 'male' && (
                          <DetailRow
                            label="Pregnancy Status"
                            value={medicalIntake.pregnancyStatus || "Not applicable"}
                          />
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <Text style={styles.noDataMutedText}>No medical history records available</Text>
                )}
              </View>
            </View>

            {/* Doctor & Clinic Notes */}
            {(medicalIntake?.notes || patient.notes) ? (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleGroup}>
                    <FileText size={14} color="#047857" />
                    <Text style={styles.sectionHeaderTitle}>DOCTOR & CLINIC NOTES</Text>
                  </View>
                </View>

                <View style={[styles.skeuoCard, styles.cardShadow, { padding: 12 }]}>
                  <Text style={styles.notesBodyText}>
                    {medicalIntake?.notes || patient.notes}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Financial & Billing Summary */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <CreditCard size={14} color="#047857" />
                  <Text style={styles.sectionHeaderTitle}>BILLING & PAYMENT SUMMARY</Text>
                </View>
              </View>

              <View style={[styles.skeuoCard, styles.cardShadow, { paddingHorizontal: 12, paddingVertical: 4 }]}>
                {billingInfo ? (
                  <>
                    <DetailRow
                      label="Total Charges"
                      value={`₱${billingInfo.totalAmount.toFixed(2)}`}
                    />
                    <DetailRow
                      label="Amount Paid"
                      value={`₱${billingInfo.paidAmount.toFixed(2)}`}
                      isHighlight={true}
                    />
                    {billingInfo.pendingAmount > 0 && (
                      <DetailRow
                        label="Pending Balance"
                        value={`₱${billingInfo.pendingAmount.toFixed(2)}`}
                        isAlert={true}
                      />
                    )}
                    {billingInfo.overdueAmount > 0 && (
                      <DetailRow
                        label="Overdue Balance"
                        value={`₱${billingInfo.overdueAmount.toFixed(2)}`}
                        isAlert={true}
                      />
                    )}
                    <DetailRow
                      label="Total Invoices"
                      value={billingInfo.billingCount.toString()}
                      isLast={true}
                    />
                  </>
                ) : (
                  <Text style={styles.noDataMutedText}>No billing records generated for this patient yet</Text>
                )}
              </View>
            </View>

            {/* Appointments History Timeline */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <Calendar size={14} color="#047857" />
                  <Text style={styles.sectionHeaderTitle}>APPOINTMENTS TIMELINE</Text>
                </View>
                {appointments.length > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{appointments.length}</Text>
                  </View>
                )}
              </View>

              <View style={[styles.skeuoCard, styles.cardShadow, { padding: 12 }]}>
                {appointments.length === 0 ? (
                  <Text style={styles.noDataMutedText}>No appointment records found for this patient</Text>
                ) : (
                  <>
                    {appointments.slice(0, 3).map((appt: any) => (
                      <AppointmentItemRow
                        key={appt.id}
                        appointment={appt}
                        onEdit={handleEditAppointment}
                      />
                    ))}

                    {appointments.length > 3 && (
                      <TouchableOpacity
                        style={styles.seeAllApptsBtn}
                        onPress={() => setShowAppointmentHistory(true)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.seeAllApptsBtnText}>
                          View All Appointments ({appointments.length})
                        </Text>
                        <ChevronRight size={14} color="#047857" />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </View>

            {/* Account Details */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleGroup}>
                  <Text style={styles.sectionHeaderTitle}>ACCOUNT DETAILS</Text>
                </View>
              </View>

              <View style={[styles.skeuoCard, styles.cardShadow, { paddingHorizontal: 12, paddingVertical: 4, marginBottom: 30 }]}>
                <DetailRow label="Patient ID" value={effectivePatientId || patient.id} />
                <DetailRow
                  label="Registered Since"
                  value={
                    patientProfile?.created_at
                      ? formatDate(patientProfile.created_at)
                      : patient.date
                      ? formatDate(patient.date)
                      : "Not available"
                  }
                  isLast={true}
                />
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* ID Card Photo Modal */}
      {showIdPhotoModal && (idPhotoUrl || patientProfile?.pwd_id_url) && (
        <Modal
          visible={showIdPhotoModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowIdPhotoModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <SafeAreaView style={styles.photoModalContainer}>
              <View style={styles.photoModalHeader}>
                <Text style={styles.photoModalTitle}>Government ID Card Proof</Text>
                <TouchableOpacity
                  style={styles.photoModalCloseBtn}
                  onPress={() => setShowIdPhotoModal(false)}
                  activeOpacity={0.7}
                >
                  <X size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.photoModalImageWrap}>
                <Image
                  source={{ uri: idPhotoUrl || patientProfile.pwd_id_url }}
                  style={styles.photoModalImage}
                  resizeMode="contain"
                />
              </View>
            </SafeAreaView>
          </View>
        </Modal>
      )}

      {/* Appointment History Modal */}
      {showAppointmentHistory && patient && (
        <Modal
          visible={showAppointmentHistory}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAppointmentHistory(false)}
        >
          <AppointmentHistory
            patientId={effectivePatientId || patient.id}
            patientName={patientName}
            doctorId={doctorId || ''}
            onBack={() => setShowAppointmentHistory(false)}
          />
        </Modal>
      )}

      {/* Modernized AppointmentEdit Modal */}
      {editingAppointment && doctorId && (
        <AppointmentEdit
          visible={showEditModal}
          appointment={editingAppointment}
          doctorId={doctorId}
          onClose={() => {
            setShowEditModal(false);
            setEditingAppointment(null);
          }}
          onSave={handleSaveAppointment}
          onAppointmentStatusUpdated={onAppointmentStatusUpdated}
        />
      )}

      {/* PWD / Senior ID Photo Modal */}
      <Modal
        visible={showIdPhotoModal && !!idPhotoUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIdPhotoModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: 16 }}>
          <TouchableOpacity
            onPress={() => setShowIdPhotoModal(false)}
            style={{ position: 'absolute', top: 48, right: 20, zIndex: 2, padding: 8 }}
            accessibilityLabel="Close ID photo"
          >
            <X size={28} color="#fff" />
          </TouchableOpacity>
          {idPhotoUrl && (
            <Image source={{ uri: idPhotoUrl }} style={{ width: '100%', height: '75%' }} resizeMode="contain" />
          )}
          <Text style={{ color: '#D1FAE5', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
            {patientProfile?.pwd_type === 'senior' ? 'Senior Citizen' : 'PWD'} ID · Confidential (RA 10173)
          </Text>
        </View>
      </Modal>
    </Modal>
  );
}

// ─────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────

function DetailRow({
  label,
  value,
  isHighlight,
  isAlert,
  isLast,
}: {
  label: string;
  value: string;
  isHighlight?: boolean;
  isAlert?: boolean;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        isLast && { borderBottomWidth: 0 },
      ]}
    >
      <Text style={styles.detailLabel}>{label}</Text>
      {isAlert ? (
        <View style={styles.alertPill}>
          <Text style={styles.alertPillText}>{value}</Text>
        </View>
      ) : isHighlight ? (
        <View style={styles.highlightPill}>
          <Text style={styles.highlightPillText}>{value}</Text>
        </View>
      ) : (
        <Text style={styles.detailValue} numberOfLines={2}>
          {value}
        </Text>
      )}
    </View>
  );
}

function AppointmentItemRow({
  appointment,
  onEdit,
}: {
  appointment: any;
  onEdit?: (appt: any) => void;
}) {
  const status = ((appointment.status || 'scheduled') as string).toLowerCase();
  const statusColor = getStatusColor(status);
  const statusBg = getStatusBgColor(status);
  const statusLabel = getStatusLabel(status);

  const dateValue = appointment.appointment_date || appointment.date;
  const timeValue = appointment.appointment_time || appointment.time;

  return (
    <View style={styles.apptItemRow}>
      <View style={styles.apptItemContent}>
        <View style={styles.apptItemHeader}>
          <Text style={styles.apptItemService} numberOfLines={1}>
            {appointment.service || 'General Dental Treatment'}
          </Text>
          <View
            style={[
              styles.apptStatusBadge,
              { backgroundColor: statusBg, borderColor: statusColor },
            ]}
          >
            <Text style={[styles.apptStatusBadgeText, { color: statusColor }]}>
              {statusLabel.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.apptItemDateTimeRow}>
          <Calendar size={12} color="#64748B" />
          <Text style={styles.apptItemDateTimeText}>
            {formatAppointmentDate(dateValue)} • {formatAppointmentTime(timeValue)}
          </Text>
        </View>
      </View>

      {onEdit && (
        <TouchableOpacity
          onPress={() => onEdit(appointment)}
          style={styles.apptEditBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.apptEditBtnText}>Edit</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────

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

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: "#047857",
    fontWeight: "700",
  },

  // Content
  scrollContainer: {
    flex: 1,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Skeuomorphic Card
  skeuoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
  },

  cardShadow: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },

  // Hero Card
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },

  heroAvatar: {
    width: 58,
    height: 58,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },

  heroAvatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    justifyContent: "center",
    alignItems: "center",
  },

  heroInfoWrap: {
    flex: 1,
    marginLeft: 12,
  },

  heroName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
  },

  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },

  demographicBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },

  demographicText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },

  dummyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#FEF3C7",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },

  dummyBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B45309",
    letterSpacing: 0.5,
  },

  patientBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#ECFDF5",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },

  patientBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.5,
  },

  pwdVerifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#ECFDF5",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#10B981",
  },

  pwdVerifiedText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.4,
  },

  // Metrics Bar
  metricsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#F8FAFC",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },

  metricItem: {
    flex: 1,
    alignItems: "center",
  },

  metricDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E2E8F0",
  },

  metricLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },

  metricValue: {
    fontSize: 15,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 2,
  },

  // Section Headers
  sectionContainer: {
    marginTop: 18,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  sectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#047857",
    letterSpacing: 0.6,
  },

  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#E2E8F0",
  },

  countBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },

  // Detail Row
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },

  detailLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    flexShrink: 0,
  },

  detailValue: {
    fontSize: 12.5,
    color: "#0F172A",
    textAlign: "right",
    fontWeight: "700",
    flexShrink: 1,
  },

  alertPill: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },

  alertPillText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#B91C1C",
    textAlign: "right",
  },

  highlightPill: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },

  highlightPillText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#047857",
    textAlign: "right",
  },

  noDataMutedText: {
    fontSize: 12,
    color: "#94A3B8",
    fontStyle: "italic",
    paddingVertical: 8,
    textAlign: "center",
  },

  // PWD Cards
  pwdApprovedBox: {
    padding: 4,
    gap: 6,
  },

  pwdAlertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  pwdApprovedTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#047857",
  },

  pwdApprovedDesc: {
    fontSize: 11.5,
    color: "#065F46",
    lineHeight: 16,
  },

  pwdViewIdBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    alignSelf: "flex-start",
  },

  pwdViewIdText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#047857",
    textDecorationLine: "underline",
  },

  pwdRevokeBtn: {
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },

  pwdRevokeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B91C1C",
  },

  pwdPendingBox: {
    padding: 4,
    gap: 8,
  },

  pwdPendingTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E",
  },

  pwdPendingDesc: {
    fontSize: 11.5,
    color: "#78350F",
    lineHeight: 16,
  },

  pwdThumbnailBox: {
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#FCD34D",
    height: 130,
    backgroundColor: "#0F172A",
    marginTop: 4,
    position: "relative",
  },

  pwdThumbnailImage: {
    width: "100%",
    height: "100%",
  },

  pwdExpandPill: {
    position: "absolute",
    bottom: 6,
    right: 8,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },

  pwdExpandPillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  pwdActionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },

  pwdApproveBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#047857",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#064E3B",
    borderBottomWidth: 2.5,
    borderBottomColor: "#022C22",
    alignItems: "center",
    justifyContent: "center",
  },

  pwdApproveBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  pwdRejectBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    alignItems: "center",
    justifyContent: "center",
  },

  pwdRejectBtnText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "700",
  },

  pwdRejectedBox: {
    padding: 4,
    gap: 6,
  },

  pwdRejectedTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#991B1B",
  },

  pwdRejectedDesc: {
    fontSize: 11.5,
    color: "#7F1D1D",
  },

  pwdReevaluateBtn: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#ECFDF5",
    borderRadius: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },

  pwdReevaluateText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },

  // Notes Body
  notesBodyText: {
    fontSize: 12.5,
    color: "#334155",
    fontWeight: "500",
    lineHeight: 18,
  },

  // Appointment Timeline Item
  apptItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    marginBottom: 8,
  },

  apptItemContent: {
    flex: 1,
    marginRight: 8,
  },

  apptItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  apptItemService: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    flex: 1,
    marginRight: 8,
  },

  apptStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 3.5,
    borderWidth: 1,
  },

  apptStatusBadgeText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },

  apptItemDateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  apptItemDateTimeText: {
    fontSize: 11.5,
    color: "#64748B",
    fontWeight: "600",
  },

  apptEditBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#ECFDF5",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#10B981",
    borderBottomWidth: 2,
    borderBottomColor: "#059669",
  },

  apptEditBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
  },

  seeAllApptsBtn: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#ECFDF5",
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#10B981",
    borderBottomWidth: 2.5,
    borderBottomColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  seeAllApptsBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.4,
  },

  // Fullscreen Photo Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    justifyContent: "center",
  },

  photoModalContainer: {
    flex: 1,
    justifyContent: "space-between",
  },

  photoModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  photoModalTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  photoModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  photoModalImageWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },

  photoModalImage: {
    width: "100%",
    height: "100%",
  },
});
