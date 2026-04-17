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
import { getPatientMedicalInfo, getPatientAppointments, updatePastAppointmentsToNoShow, updatePatientMedicalInfo } from "../../lib/profilesPatients";
import { MedicalIntake } from "../../types/index";
import AppointmentHistory from "../appointments/appointmentHistory";
import AppointmentEdit from "../appointments/appointmentEdit";
import PatientDetailsEdit from "./PatientDetailsEdit";
import { getStatusColor, getStatusBgColor } from "../../lib/statusHelpers";
import { formatDateOfBirth } from "../../lib/dateFormatters";

export type AppointmentType = {
  id: string;
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
  status?: 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined'; // Appointment status
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
  onEdit?: () => void;
  onMedicalIntakeUpdated?: (patientName: string, patientId: string) => void;
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

export default function PatientDetailsView({ visible, patient, doctorId, onClose, onEdit,onMedicalIntakeUpdated, onAppointmentStatusUpdated }: PatientDetailsViewProps) {
  const [medicalIntake, setMedicalIntake] = useState<MedicalIntake | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAppointmentHistory, setShowAppointmentHistory] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editedPatient, setEditedPatient] = useState<AppointmentType | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (visible && patient?.id) {
      // Immediately clear old data and show loading
      setMedicalIntake(null);
      setAppointments([]);
      setLoading(true);
      
      // Load new patient data
      loadPatientData(patient.id);
    }
  }, [visible, patient?.id]);

  const loadPatientData = async (patientId: string) => {
    try {
      // Load both in parallel
      const [intake, appts] = await Promise.all([
        getPatientMedicalInfo(patientId),
        getPatientAppointments(patientId),
      ]);

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

  const handleEditAppointment = (appointment: any) => {
    console.log('🔧 Opening appointment edit modal for:', appointment.id);
    setEditingAppointment(appointment);
    setShowEditModal(true);
  };

  const handleSaveAppointment = async () => {
    console.log('✅ Appointment saved, refreshing appointments...');
    if (patient?.id) {
      await loadAppointments(patient.id);
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
              <Image
                source={require("../../assets/images/icon/close.png")}
                style={{ width: 20, height: 20 }}
              />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Patient Details</Text>
            <View style={{ width: 30 }} />
          </View>

          {/* Loading Screen */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#0b7fab" />
            <Text style={{ marginTop: 12, fontSize: 14, color: '#0b7fab', fontWeight: '600' }}>
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
              <DetailRow label="Email" value={patient.email || "Not provided"} />
              <DetailRow label="Date of Birth" value={formatDateOfBirth(medicalIntake?.dateOfBirth || "")} />
              {(() => {
                const calculatedAge = calculateAge(medicalIntake?.dateOfBirth || patient.dateOfBirth);
                return calculatedAge !== null ? (
                  <DetailRow label="Age" value={calculatedAge.toString()} />
                ) : patient.age > 0 ? (
                  <DetailRow label="Age" value={patient.age.toString()} />
                ) : null;
              })()}
              <DetailRow label="Address" value={medicalIntake?.address || "Not provided"} />
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

          {/* All Appointments History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appointments History</Text>
            <View style={styles.infoContainer}>
              {appointments.length === 0 ? (
                <Text style={styles.noDataText}>No appointments found</Text>
              ) : (
                <>
                  {(() => {
                    const cancelledAppts = appointments.filter((appt: any) => appt.status === 'cancelled');
                    const otherAppts = appointments.filter((appt: any) => appt.status !== 'cancelled').slice(0, 3);
                    console.log(`🔍 Rendering appointments: ${cancelledAppts.length} cancelled, ${otherAppts.length} other`);
                    
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
                        
                        {/* See More Button */}
                        {appointments.length > 3 && (
                          <TouchableOpacity 
                            style={styles.seeMoreButton}
                            onPress={() => setShowAppointmentHistory(true)}
                          >
                            <Text style={styles.seeMoreText}>
                              See All ({appointments.length}) →
                            </Text>
                          </TouchableOpacity>
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
              <DetailRow label="Patient ID" value={patient.id} />
              <DetailRow label="Account Created" value={formatDate(patient.date)} />
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity 
              style={[styles.closeButtonFull, { backgroundColor: '#0b7fab', flex: 1 }]} 
              onPress={() => {
                // Merge fresh medicalIntake data with patient to get the latest data
                const patientWithFreshData: AppointmentType = {
                  ...patient,
                  dateOfBirth: medicalIntake?.dateOfBirth || patient.dateOfBirth,
                  gender: medicalIntake?.gender || patient.gender,
                  contact: medicalIntake?.phone || patient.contact,
                  address: medicalIntake?.address || patient.address,
                  emergencyContactName: medicalIntake?.emergencyContactName || patient.emergencyContactName,
                  emergencyContactPhone: medicalIntake?.emergencyContactPhone || patient.emergencyContactPhone,
                  allergies: medicalIntake?.allergies || patient.allergies,
                  currentMedications: medicalIntake?.currentMedications || patient.currentMedications,
                  medicalConditions: medicalIntake?.medicalConditions || patient.medicalConditions,
                  pastSurgeries: medicalIntake?.pastSurgeries || patient.pastSurgeries,
                  smokingStatus: medicalIntake?.smokingStatus || patient.smokingStatus,
                  pregnancyStatus: medicalIntake?.pregnancyStatus || patient.pregnancyStatus,
                  notes: medicalIntake?.notes || patient.notes,
                };
                setEditedPatient(patientWithFreshData);
                setIsEditingPatient(true);
                if (onEdit) onEdit();
              }}
            >
              <Text style={styles.closeButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.closeButtonFull, { backgroundColor: '#999', flex: 1 }]} 
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* Appointment History Modal */}
      {showAppointmentHistory && patient && (
        <Modal
          visible={showAppointmentHistory}
          animationType="slide"
          onRequestClose={() => setShowAppointmentHistory(false)}
        >
          <AppointmentHistory
            patientId={patient.id}
            patientName={patient.name}
            doctorId={doctorId || ''}
            onBack={() => setShowAppointmentHistory(false)}
          />
        </Modal>
      )}

      {/* Edit Patient Modal */}
      {editedPatient && (
        <PatientDetailsEdit
          visible={isEditingPatient}
          patient={editedPatient}
          onClose={() => {
            setIsEditingPatient(false);
            setEditedPatient(null);
          }}
          onSave={async (updatedPatient) => {
            // Update to Supabase (automatically handles dummy accounts vs existing profiles)
            const result = await updatePatientMedicalInfo(patient?.id || '', {
              dateOfBirth: updatedPatient.dateOfBirth,
              gender: updatedPatient.gender,
              phone: updatedPatient.contact,
              address: updatedPatient.address,
              emergencyContactName: updatedPatient.emergencyContactName,
              emergencyContactPhone: updatedPatient.emergencyContactPhone,
              allergies: updatedPatient.allergies,
              currentMedications: updatedPatient.currentMedications,
              medicalConditions: updatedPatient.medicalConditions,
              pastSurgeries: updatedPatient.pastSurgeries,
              smokingStatus: updatedPatient.smokingStatus,
              pregnancyStatus: updatedPatient.pregnancyStatus,
              notes: updatedPatient.notes,
            });

            if (result.success) {
              // Send notification about medical intake update
              if (onMedicalIntakeUpdated) {
                onMedicalIntakeUpdated(patient?.name || 'Patient', patient?.id || '');
              }
              // Reload data from Supabase
              if (patient?.id) {
                await loadMedicalIntake(patient.id);
              }
              // Close the modal
              setIsEditingPatient(false);
              setEditedPatient(null);
            }
          }}
        />
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
  const formattedDate = appointment.appointment_date && appointment.appointment_time
    ? (() => {
        const dateStr = appointment.appointment_date; // YYYY-MM-DD
        const timeStr = appointment.appointment_time; // HH:MM
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);
        const date = new Date(year, month - 1, day, hour, minute);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
      })()
    : 'Invalid date';
  
  const statusColors: { [key: string]: string } = {
    scheduled: '#FFC107',
    completed: '#4CAF50',
    cancelled: '#F44336',
    'no-show': '#9C27B0',
    declined: '#FF6F00',
  };

  // Ensure status has a default value and handle null/undefined cases
  const appointmentStatus = appointment.status || 'scheduled';
  const statusColor = statusColors[appointmentStatus] || '#666';
  
  // Format status text: capitalize first letter, handle no-show properly
  const getStatusText = (status: string): string => {
    if (status === 'no-show') return 'No Show';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={[styles.appointmentRow, { borderLeftColor: statusColor, flex: 1 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.appointmentService}>{appointment.service || 'General'}</Text>
          <Text style={styles.appointmentDate}>{formattedDate}</Text>
        </View>
        <Text style={[styles.appointmentStatus, { color: statusColor }]}>
          {getStatusText(appointmentStatus)}
        </Text>
      </View>
      {onEdit && (
        <TouchableOpacity
          onPress={() => onEdit(appointment)}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            backgroundColor: '#4CAF50',
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
    color: '#0b7fab',
  },
  closeButton: {
    fontSize: 24,
    color: '#0b7fab',
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
    color: '#0b7fab',
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
    color: '#0b7fab',
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
    color: '#0b7fab',
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
    color: '#0b7fab',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  seeMoreButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0b7fab',
    alignItems: 'center',
  },
  seeMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0b7fab',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopColor: '#ddd',
    borderTopWidth: 1,
    backgroundColor: '#fff',
  },
  closeButtonFull: {
    backgroundColor: '#0b7fab',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
