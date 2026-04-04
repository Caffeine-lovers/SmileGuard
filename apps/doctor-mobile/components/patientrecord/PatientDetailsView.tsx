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
import { getPatientMedicalIntake } from "../../lib/profilesPatients";
import { MedicalIntake } from "../../types/index";

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
  status?: 'scheduled' | 'completed' | 'cancelled' | 'no-show'; // Appointment status
};

interface PatientDetailsViewProps {
  visible: boolean;
  patient: AppointmentType | null;
  onClose: () => void;
  onEdit?: () => void;
}

const getStatusColor = (status?: string) => {
  switch (status) {
    case 'scheduled':
      return '#FFC107'; // Yellow
    case 'completed':
      return '#4CAF50'; // Green
    case 'cancelled':
      return '#F44336'; // Red
    case 'no-show':
      return '#9C27B0'; // Purple
    default:
      return '#666';
  }
};

const getStatusBgColor = (status?: string) => {
  switch (status) {
    case 'scheduled':
      return '#FFF9C4';
    case 'completed':
      return '#C8E6C9';
    case 'cancelled':
      return '#FFCDD2';
    case 'no-show':
      return '#E1BEE7';
    default:
      return '#f5f5f5';
  }
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function PatientDetailsView({ visible, patient, onClose, onEdit }: PatientDetailsViewProps) {
  const [medicalIntake, setMedicalIntake] = useState<MedicalIntake | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && patient?.id) {
      loadMedicalIntake(patient.id);
    }
  }, [visible, patient?.id]);

  const loadMedicalIntake = async (patientId: string) => {
    setLoading(true);
    try {
      const intake = await getPatientMedicalIntake(patientId);
      setMedicalIntake(intake);
      console.log('Loaded medical intake:', intake);
    } catch (error) {
      console.error('Error loading medical intake:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!patient) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Patient Details</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
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
              {patient.age > 0 && <DetailRow label="Age" value={patient.age.toString()} />}
              <DetailRow label="Gender" value={medicalIntake?.gender ? medicalIntake.gender : patient.gender || "Not specified"} />
              <DetailRow label="Contact Number" value={medicalIntake?.phone ? medicalIntake.phone : patient.contact || "Not provided"} />
              <DetailRow label="Email" value={patient.email || "Not provided"} />
              <DetailRow label="Date of Birth" value={medicalIntake?.dateOfBirth || "Not provided"} />
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
              {loading ? (
                <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <ActivityIndicator size="small" color="#0b7fab" />
                  <Text style={{ marginTop: 8, color: '#0b7fab', fontSize: 12 }}>Loading medical records...</Text>
                </View>
              ) : medicalIntake ? (
                <>
                  <DetailRow label="Allergies" value={medicalIntake.allergies || "Not specified"} />
                  <DetailRow label="Current Medications" value={medicalIntake.currentMedications || "Not specified"} />
                  <DetailRow label="Medical Conditions" value={medicalIntake.medicalConditions || "Not specified"} />
                  <DetailRow label="Past Surgeries" value={medicalIntake.pastSurgeries || "Not specified"} />
                  <DetailRow label="Smoking Status" value={medicalIntake.smokingStatus || "Not specified"} />
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
                {patient.notes || "No notes available"}
              </Text>
            </View>
          </View>

          {/* Appointment Information (if available) */}
          {patient.date && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Appointment Information</Text>
              <View style={styles.infoContainer}>
                <DetailRow label="Date" value={formatDate(patient.date)} />
                {patient.time && <DetailRow label="Time" value={patient.time} />}
                {patient.service && <DetailRow label="Service" value={patient.service} />}
              </View>
            </View>
          )}

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
            {onEdit && (
              <TouchableOpacity 
                style={[styles.closeButtonFull, { backgroundColor: '#0b7fab', flex: 1 }]} 
                onPress={() => {
                  onEdit();
                  onClose();
                }}
              >
                <Text style={styles.closeButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.closeButtonFull, { backgroundColor: '#999', flex: onEdit ? 1 : undefined }]} 
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
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
