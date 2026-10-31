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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { getPatientMedicalInfo, getPatientAppointments, updatePastAppointmentsToNoShow, getPatientBillingInfo, getPatientProfile, updatePatientPwdStatus, type PatientBillingInfo } from "../../lib/profilesPatients";
import { Alert } from "react-native";
import { MedicalIntake } from "../../types/index";
import AppointmentHistory from "../appointments/appointmentHistory";
import AppointmentEdit from "../appointments/appointmentEdit";
import { getStatusColor, getStatusLabel } from "../../lib/statusHelpers";
import { formatDateOfBirth } from "../../lib/dateFormatters";

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
  status?: 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined'; // Appointment status
  // Medical intake fields
  dateOfBirth?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  allergies?: string;
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
  onAppointmentStatusUpdated?: (status: 'completed' | 'cancelled' | 'no-show' | 'declined', patientName: string, appointmentId: string, patientId: string, doctorId: string) => void;
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const calculateAge = (dateOfBirth: string | undefined): number | null => {
  if (!dateOfBirth) return null;
  
  try {
    let birthDate: Date;
    
    // Handle mm/dd/YYYY format
    if (dateOfBirth.includes('/')) {
      const [month, day, year] = dateOfBirth.split('/');
      birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      // Handle ISO date format and other formats
      birthDate = new Date(dateOfBirth);
    }
    
    // Check if date is valid
    if (isNaN(birthDate.getTime())) {
      return null;
    }
    
    const today = new Date();
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // If birthday hasn't occurred yet this year, subtract 1 from age
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= 0 ? age : null;
  } catch (error) {
    console.error('Error calculating age:', error);
    return null;
  }
};

const categorizeAppointments = (appointments: any[]) => {
  const now = new Date();
  const past: any[] = [];
  const current: any[] = [];
  const future: any[] = [];

  appointments.forEach((appt) => {
    const apptDate = new Date(appt.appointment_date);
    const diffMs = apptDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    // Current: within today
    if (diffDays >= 0 && diffDays < 1) {
      current.push(appt);
    }
    // Future: more than 1 day away
    else if (diffDays >= 1) {
      future.push(appt);
    }
    // Past: more than 1 day ago
    else {
      past.push(appt);
    }
  });

  return { past, current, future };
};

export default function PatientDetailsView({ visible, patient, doctorId, onClose, onAppointmentStatusUpdated }: PatientDetailsViewProps) {
  const [medicalIntake, setMedicalIntake] = useState<MedicalIntake | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [billingInfo, setBillingInfo] = useState<PatientBillingInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAppointmentHistory, setShowAppointmentHistory] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [showIdPhotoModal, setShowIdPhotoModal] = useState(false);
  const [updatingPwd, setUpdatingPwd] = useState(false);

  const effectivePatientId = patient?.patient_id || patient?.id;

  useEffect(() => {
    if (visible && effectivePatientId) {
      // Immediately clear old data and show loading
      setMedicalIntake(null);
      setAppointments([]);
      setBillingInfo(null);
      setLoading(true);
      
      // Load new patient data
      loadPatientData(effectivePatientId);
    }
  }, [visible, effectivePatientId]);

  const loadPatientData = async (patientId: string) => {
    try {
      // Load intake, appointments, billing, and profile in parallel
      const [intake, appts, billing, profile] = await Promise.all([
        getPatientMedicalInfo(patientId),
        getPatientAppointments(patientId),
        getPatientBillingInfo(patientId),
        getPatientProfile(patientId),
      ]);
      setPatientProfile(profile);

      // Update medical intake
      setMedicalIntake(intake);
      console.log('✅ Loaded medical intake:', intake);

      // Auto-update past appointments to no-show status
      await updatePastAppointmentsToNoShow(appts);

      // Reload appointments to get updated statuses
      const updatedAppts = await getPatientAppointments(patientId);
      
      // Log appointments breakdown
      const statusBreakdown = {
        scheduled: updatedAppts.filter(a => a.status === 'scheduled').length,
        completed: updatedAppts.filter(a => a.status === 'completed').length,
        cancelled: updatedAppts.filter(a => a.status === 'cancelled').length,
        'no-show': updatedAppts.filter(a => a.status === 'no-show').length,
      };
      console.log(`✅ Loaded ${updatedAppts.length} appointments. Breakdown:`, statusBreakdown);
      console.log('📋 Filtered cancelled:', updatedAppts.filter(a => a.status === 'cancelled'));
      
      setAppointments(updatedAppts);

      // Update billing info
      setBillingInfo(billing);
      console.log('✅ Loaded billing info:', billing);
    } catch (error) {
      console.error('❌ Error loading patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMedicalIntake = async (patientId: string) => {
    setLoading(true);
    try {
      const intake = await getPatientMedicalInfo(patientId);
      setMedicalIntake(intake);
      console.log('Loaded medical intake:', intake);
    } catch (error) {
      console.error('Error loading medical intake:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAppointments = async (patientId: string) => {
    try {
      const appts = await getPatientAppointments(patientId);
      
      // Auto-update past appointments to no-show status
      await updatePastAppointmentsToNoShow(appts);
      
      // Reload appointments to get updated statuses
      const updatedAppts = await getPatientAppointments(patientId);
      setAppointments(updatedAppts);
      console.log('Loaded appointments:', updatedAppts.length);
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  };


  const handleApprovePwd = async () => {
    if (!effectivePatientId) return;
    const effectiveId = effectivePatientId;
    setUpdatingPwd(true);
    try {
      const res = await updatePatientPwdStatus(effectiveId, 'approved', doctorId);
      if (res.success) {
        setPatientProfile((prev: any) => ({ ...prev, pwd_status: 'approved' }));
        Alert.alert(
          'Verification Approved',
          'Patient has been certified as a verified ' + (patientProfile?.pwd_type === 'senior' ? 'Senior Citizen' : 'PWD') + '. The statutory 20% discount is now active.'
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
    const effectiveId = effectivePatientId;
    setUpdatingPwd(true);
    try {
      const res = await updatePatientPwdStatus(effectiveId, 'rejected', doctorId);
      if (res.success) {
        setPatientProfile((prev: any) => ({ ...prev, pwd_status: 'rejected' }));
        Alert.alert('Verification Declined', 'Patient verification was rejected. The patient will be notified to re-submit.');
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
    console.log('🔧 Opening appointment edit modal for:', appointment.id);
    setEditingAppointment(appointment);
    setShowEditModal(true);
  };

  const handleSaveAppointment = async () => {
    console.log('✅ Appointment saved, refreshing appointments...');
    if (effectivePatientId) {
      await loadAppointments(effectivePatientId);
    }
  };

  if (!patient) return null;

  // Show full-page loading screen while data is being fetched
  if (loading) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <X size={22} color="#047857" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Patient Details</Text>
            <View style={{ width: 30 }} />
          </View>

          {/* Loading Screen */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={{ marginTop: 12, fontSize: 14, color: '#047857', fontWeight: '600' }}>
              Loading patient details...
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {scrollY > 100 ? patient.name : "Patient Details"}
          </Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView 
          style={styles.container} 
          contentContainerStyle={{ paddingBottom: 20 }}
          onScroll={(event) => {
            const offsetY = event.nativeEvent.contentOffset.y;
            setScrollY(offsetY);
          }}
          scrollEventThrottle={16}
        >
          {/* Patient Profile Section */}
          <View style={styles.profileSection}>
            <Image
              source={typeof patient.imageUrl === "string" ? { uri: patient.imageUrl } : patient.imageUrl}
              style={styles.profileImage}
            />
            <Text style={styles.patientName}>{patient.name}</Text>
          </View>

          {/* Personal Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <View style={styles.infoContainer}>
              <DetailRow label="Gender" value={medicalIntake?.gender ? medicalIntake.gender : patient.gender || "Not specified"} />
              <DetailRow label="Contact Number" value={medicalIntake?.phone ? medicalIntake.phone : patient.contact || "Not provided"} />
              <DetailRow label="Email" value={patientProfile?.email || patient.email || "Not provided"} />
              <DetailRow label="Date of Birth" value={formatDateOfBirth(medicalIntake?.dateOfBirth || "")} />
              {(() => {
                const calculatedAge = calculateAge(medicalIntake?.dateOfBirth || patient.dateOfBirth);
                return calculatedAge !== null ? (
                  <DetailRow label="Age" value={calculatedAge.toString()} />
                ) : patient.age > 0 ? (
                  <DetailRow label="Age" value={patient.age.toString()} />
                ) : null;
              })()}
              <DetailRow label="Address" value={medicalIntake?.address || patient.address || "Not provided"} />
            </View>
          </View>

          {/* Statutory Discount & Verification Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statutory Discount (PWD / Senior Citizen)</Text>
            <View style={styles.infoContainer}>
              {patientProfile?.pwd_status === 'approved' ? (
                <View style={{ padding: 12, backgroundColor: '#ECFDF5', borderRadius: 8, borderWidth: 1, borderColor: '#10B981', gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#047857' }}>
                    ✓ Verified {patientProfile?.pwd_type === 'senior' ? 'Senior Citizen' : 'PWD'} Patient
                  </Text>
                  <Text style={{ fontSize: 11, color: '#065F46', lineHeight: 16 }}>
                    Approved by doctor. Patient receives statutory 20% discount on all procedures.
                  </Text>
                  {patientProfile?.pwd_id_url && (
                    <TouchableOpacity
                      onPress={() => setShowIdPhotoModal(true)}
                      style={{ marginTop: 4, alignSelf: 'flex-start' }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#047857', textDecorationLine: 'underline' }}>
                        View Verified ID Card Photo
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleRejectPwd}
                    disabled={updatingPwd}
                    style={{ marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#FEE2E2', borderRadius: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#FCA5A5' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#B91C1C' }}>Revoke Discount Verification</Text>
                  </TouchableOpacity>
                </View>
              ) : patientProfile?.pwd_status === 'pending' ? (
                <View style={{ padding: 12, backgroundColor: '#FFFBEB', borderRadius: 8, borderWidth: 1, borderColor: '#F59E0B', gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400E' }}>
                    ⚠️ {patientProfile?.pwd_type === 'senior' ? 'Senior Citizen' : 'PWD'} Verification Request
                  </Text>
                  <Text style={{ fontSize: 11, color: '#78350F', lineHeight: 16 }}>
                    Patient submitted government ID proof requesting 20% statutory deduction. Please review the ID below before approving.
                  </Text>
                  {patientProfile?.pwd_id_url && (
                    <TouchableOpacity
                      onPress={() => setShowIdPhotoModal(true)}
                      style={{ borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: '#FCD34D', height: 140, backgroundColor: '#000' }}
                    >
                      <Image
                        source={{ uri: patientProfile.pwd_id_url }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                      />
                      <View style={{ position: 'absolute', bottom: 4, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Tap to Expand</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={handleApprovePwd}
                      disabled={updatingPwd}
                      style={{ flex: 1, paddingVertical: 10, backgroundColor: '#047857', borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                        {updatingPwd ? 'Updating...' : '✓ Approve 20% Discount'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleRejectPwd}
                      disabled={updatingPwd}
                      style={{ paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#FEE2E2', borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FCA5A5' }}
                    >
                      <Text style={{ color: '#B91C1C', fontSize: 12, fontWeight: '700' }}>✕ Reject</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : patientProfile?.pwd_status === 'rejected' ? (
                <View style={{ padding: 12, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#F87171', gap: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#991B1B' }}>
                    ✕ Verification Declined by Doctor
                  </Text>
                  <Text style={{ fontSize: 11, color: '#7F1D1D' }}>
                    Patient has not been certified for statutory discounts.
                  </Text>
                  <TouchableOpacity
                    onPress={handleApprovePwd}
                    disabled={updatingPwd}
                    style={{ marginTop: 4, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#ECFDF5', borderRadius: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#A7F3D0' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#047857' }}>Re-evaluate & Approve</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: '#64748B', fontStyle: 'italic', padding: 8 }}>
                  No statutory PWD or Senior Citizen discount requested. Standard clinic rates apply.
                </Text>
              )}
            </View>
          </View>

          {/* Emergency Contact */}
          {medicalIntake && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Emergency Contact</Text>
              <View style={styles.infoContainer}>
                <DetailRow label="Name" value={medicalIntake.emergencyContactName || "Not provided"} />
                <DetailRow label="Phone" value={medicalIntake.emergencyContactPhone || "Not provided"} />
              </View>
            </View>
          )}

          {/* Medical History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Medical History</Text>
            <View style={styles.infoContainer}>
              {medicalIntake ? (
                <>
                  <DetailRow label="Allergies" value={medicalIntake.allergies || "None"} />
                  <DetailRow label="Current Medications" value={medicalIntake.currentMedications || "None"} />
                  <DetailRow label="Medical Conditions" value={medicalIntake.medicalConditions || "None"} />
                  <DetailRow label="Past Surgeries" value={medicalIntake.pastSurgeries || "None"} />
                  <DetailRow label="Smoking Status" value={medicalIntake.smokingStatus || "None"} />
                  {medicalIntake.gender?.toLowerCase() !== 'male' && (
                    <DetailRow label="Pregnancy Status" value={medicalIntake.pregnancyStatus || "Not specified"} />
                  )}
                </>
              ) : (
                <Text style={styles.noDataText}>No medical history records available</Text>
              )}
            </View>
          </View>

          {/* Notes Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={[styles.infoContainer, { minHeight: 80 }]}>
              <Text style={styles.notesText}>
                {medicalIntake?.notes || patient.notes || "No notes available"}
              </Text>
            </View>
          </View>

          {/* Billing Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Billing Information</Text>
            <View style={styles.infoContainer}>
              {billingInfo ? (
                <>
                  <DetailRow label="Total Charges" value={`₱${billingInfo.totalAmount.toFixed(2)}`} />
                  <DetailRow label="Amount Paid" value={`₱${billingInfo.paidAmount.toFixed(2)}`} />
                  {billingInfo.pendingAmount > 0 && (
                    <DetailRow label="Pending Payment" value={`₱${billingInfo.pendingAmount.toFixed(2)}`} />
                  )}
                  {billingInfo.overdueAmount > 0 && (
                    <DetailRow label="Overdue Amount" value={`₱${billingInfo.overdueAmount.toFixed(2)}`} />
                  )}
                  <DetailRow label="Number of Bills" value={billingInfo.billingCount.toString()} />
                </>
              ) : (
                <Text style={styles.noDataText}>No billing records available</Text>
              )}
            </View>
          </View>

          {/* All Appointments History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appointments History</Text>
            <View style={styles.infoContainer}>
              {appointments.length === 0 ? (
                <Text style={styles.noDataText}>No appointments found</Text>
              ) : (
                <>
                  {(() => {
                    // Filter: Prioritize accepted appointments (dentist_id exists) or completed/past appointments.
                    // If no appointments match (e.g. dentist_id not set in legacy/test data),
                    // fallback to all non-declined appointments so valid appointment history is never hidden.
                    const acceptedAppointments = appointments.filter(
                      (appt: any) =>
                        appt.dentist_id ||
                        appt.status === 'completed' ||
                        appt.status === 'cancelled' ||
                        appt.status === 'no-show'
                    );

                    const appointmentsToDisplay =
                      acceptedAppointments.length > 0
                        ? acceptedAppointments
                        : appointments.filter((appt: any) => appt.status !== 'declined');

                    const cancelledAppts = appointmentsToDisplay.filter((appt: any) => appt.status === 'cancelled');
                    const otherAppts = appointmentsToDisplay.filter((appt: any) => appt.status !== 'cancelled').slice(0, 3);
                    console.log(`🔍 Rendering appointments: ${cancelledAppts.length} cancelled, ${otherAppts.length} other (total to display: ${appointmentsToDisplay.length})`);
                    
                    return (
                      <>
                        {/* Show cancelled appointments first if they exist */}
                        {cancelledAppts.length > 0 && (
                          <>
                            {cancelledAppts.map((appt: any) => (
                              <AppointmentRow key={appt.id} appointment={appt} onEdit={handleEditAppointment} />
                            ))}
                          </>
                        )}
                        
                        {/* Show other appointments (max 3) */}
                        {otherAppts.length > 0 && (
                          <>
                            {cancelledAppts.length > 0 && <Text style={{ fontSize: 11, color: '#999', marginBottom: 8, marginTop: 12 }}>Other Appointments:</Text>}
                            {otherAppts.map((appt: any) => (
                              <AppointmentRow key={appt.id} appointment={appt} onEdit={handleEditAppointment} />
                            ))}
                          </>
                        )}
                        
                        {/* See More Button - only show if there are more than 3 appointments to display */}
                        {appointmentsToDisplay.length > 3 && (
                          <TouchableOpacity 
                            style={styles.seeMoreButton}
                            onPress={() => setShowAppointmentHistory(true)}
                          >
                            <Text style={styles.seeMoreText}>
                              See All ({appointmentsToDisplay.length}) →
                            </Text>
                          </TouchableOpacity>
                        )}
                        
                        {/* Show message if no appointments to display */}
                        {appointmentsToDisplay.length === 0 && (
                          <Text style={styles.noDataText}>No accepted appointments yet</Text>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </View>
          </View>

          {/* Additional Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Information</Text>
            <View style={styles.infoContainer}>
              <DetailRow label="Patient ID" value={effectivePatientId || patient.id} />
              <DetailRow label="Account Created" value={patientProfile?.created_at ? formatDate(patientProfile.created_at) : (patient.date ? formatDate(patient.date) : "Not available")} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Appointment History Modal */}
      {showAppointmentHistory && patient && (
        <Modal
          visible={showAppointmentHistory}
          animationType="slide"
          onRequestClose={() => setShowAppointmentHistory(false)}
        >
          <AppointmentHistory
            patientId={effectivePatientId || patient.id}
            patientName={patient.name}
            doctorId={doctorId || ''}
            onBack={() => setShowAppointmentHistory(false)}
          />
        </Modal>
      )}


      {/* AppointmentEdit Modal */}
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
    </Modal>
  );
}

// Helper Component for Detail Rows
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// Helper Component for Appointment Rows
function AppointmentRow({ appointment, onEdit }: { appointment: any; onEdit?: (appt: any) => void }) {
  const formattedDate = (() => {
    try {
      if (!appointment.appointment_date) return 'Date not available';
      const cleanDateStr = String(appointment.appointment_date).split('T')[0].trim();
      const timeStr = appointment.appointment_time ? String(appointment.appointment_time).trim() : null;

      if (timeStr) {
        const timeParts = timeStr.split(':').map(Number);
        const dateParts = cleanDateStr.split('-').map(Number);
        if (dateParts.length === 3 && !dateParts.some(isNaN) && timeParts.length >= 2 && !timeParts.slice(0, 2).some(isNaN)) {
          const [year, month, day] = dateParts;
          const [hour, minute] = timeParts;
          const date = new Date(year, month - 1, day, hour, minute);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            });
          }
        }
      }

      // If only date is provided
      const dateParts = cleanDateStr.split('-').map(Number);
      if (dateParts.length === 3 && !dateParts.some(isNaN)) {
        const [year, month, day] = dateParts;
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
        }
      }

      const parsed = new Date(cleanDateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }

      return cleanDateStr;
    } catch {
      return appointment.appointment_date || 'Date not available';
    }
  })();
  
  const statusColor = getStatusColor(appointment.status || 'scheduled');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={[styles.appointmentRow, { borderLeftColor: statusColor, flex: 1 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appointmentService}>{appointment.service || 'General'}</Text>
          <Text style={styles.appointmentDate}>{formattedDate}</Text>
        </View>
        <Text style={[styles.appointmentStatus, { color: statusColor }]}>
          {getStatusLabel(appointment.status)}
        </Text>
      </View>
      {onEdit && (
        <TouchableOpacity
          onPress={() => onEdit(appointment)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: '#10B981',
            borderRadius: 6,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>Edit</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#047857',
  },
  closeButton: {
    fontSize: 24,
    color: '#047857',
    fontWeight: 'bold',
    width: 30,
    textAlign: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  profileSection: {
    alignItems: 'center',
    marginVertical: 24,
    paddingBottom: 16,
    borderBottomColor: '#e0e0e0',
    borderBottomWidth: 1,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
    backgroundColor: '#f0f0f0',
  },
  patientName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#047857',
    marginBottom: 12,
  },
  infoContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
  },
  detailRow_last: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    flex: 0.4,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 0.6,
    textAlign: 'right',
    fontWeight: '500',
  },
  notesText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  serviceText: {
    fontSize: 14,
    color: '#047857',
    fontWeight: '500',
    marginBottom: 4,
  },
  noDataText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  appointmentCategoryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
    marginTop: 12,
    marginBottom: 8,
  },
  appointmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    borderLeftWidth: 4,
  },
  appointmentService: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  appointmentDate: {
    fontSize: 12,
    color: '#666',
  },
  appointmentStatus: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  moreText: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  seeMoreButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#10B981',
    alignItems: 'center',
  },
  seeMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
});
