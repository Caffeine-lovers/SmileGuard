import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
  allAppointments?: AppointmentType[];
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

export default function PatientDetailsView({ visible, patient, onClose, onEdit, allAppointments = [] }: PatientDetailsViewProps) {
  if (!patient) return null;

  // Get today's date for comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter all appointments by patient name (including current appointment)
  const allPatientAppointments = allAppointments
    .filter(apt => apt.name === patient.name)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Separate appointments into past, current, and upcoming
  const upcomingAppointments = allPatientAppointments.filter(apt => new Date(apt.date) > today);
  const pastAppointments = allPatientAppointments.filter(apt => new Date(apt.date) < today);
  const currentAppointments = allPatientAppointments.filter(apt => {
    const aptDate = new Date(apt.date);
    return aptDate.getTime() === today.getTime();
  });

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

          {/* Appointment Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appointment Information</Text>
            <View style={styles.infoContainer}>
              <DetailRow label="Date" value={formatDate(patient.date)} />
              <DetailRow label="Time" value={patient.time} />
              <DetailRow label="Service" value={patient.service} />
            </View>
          </View>

          {/* Personal Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <View style={styles.infoContainer}>
              <DetailRow label="Age" value={patient.age.toString()} />
              <DetailRow label="Gender" value={patient.gender} />
              <DetailRow label="Contact Number" value={patient.contact} />
              <DetailRow label="Email" value={patient.email} />
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

          {/* Additional Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Information</Text>
            <View style={styles.infoContainer}>
              <DetailRow label="Patient ID" value={patient.id} />
              <DetailRow 
                label="Record Status" 
                value={patient.status ? patient.status.charAt(0).toUpperCase() + patient.status.slice(1) : "N/A"} 
              />
            </View>
          </View>

          {/* Appointment History */}
          {allPatientAppointments.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>All Appointments</Text>
              
              {/* Upcoming Appointments */}
              {upcomingAppointments.length > 0 && (
                <View style={styles.appointmentCategory}>
                  <Text style={styles.categoryLabel}>Upcoming</Text>
                  <View style={styles.historyContainer}>
                    {upcomingAppointments.map((apt, index) => (
                      <View key={apt.id} style={[styles.historyItem, index !== upcomingAppointments.length - 1 && styles.historyItemBorder]}>
                        <View style={styles.historyItemLeft}>
                          <Text style={styles.historyItemDate}>{formatDate(apt.date)}</Text>
                          <Text style={styles.historyItemTime}>{apt.time}</Text>
                        </View>
                        <View style={styles.historyItemCenter}>
                          <Text style={styles.historyItemService}>{apt.service}</Text>
                          <Text style={styles.historyItemNotes}>{apt.notes || 'No notes'}</Text>
                        </View>
                        <View style={[styles.historyItemStatus, { backgroundColor: getStatusBgColor(apt.status) }]}>
                          <Text style={[styles.historyItemStatusText, { color: getStatusColor(apt.status) }]}>
                            {apt.status ? apt.status.charAt(0).toUpperCase() + apt.status.slice(1) : 'N/A'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Current Appointments */}
              {currentAppointments.length > 0 && (
                <View style={styles.appointmentCategory}>
                  <Text style={styles.categoryLabel}>Today</Text>
                  <View style={styles.historyContainer}>
                    {currentAppointments.map((apt, index) => (
                      <View key={apt.id} style={[styles.historyItem, index !== currentAppointments.length - 1 && styles.historyItemBorder]}>
                        <View style={styles.historyItemLeft}>
                          <Text style={styles.historyItemDate}>{formatDate(apt.date)}</Text>
                          <Text style={styles.historyItemTime}>{apt.time}</Text>
                        </View>
                        <View style={styles.historyItemCenter}>
                          <Text style={styles.historyItemService}>{apt.service}</Text>
                          <Text style={styles.historyItemNotes}>{apt.notes || 'No notes'}</Text>
                        </View>
                        <View style={[styles.historyItemStatus, { backgroundColor: getStatusBgColor(apt.status) }]}>
                          <Text style={[styles.historyItemStatusText, { color: getStatusColor(apt.status) }]}>
                            {apt.status ? apt.status.charAt(0).toUpperCase() + apt.status.slice(1) : 'N/A'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Past Appointments */}
              {pastAppointments.length > 0 && (
                <View style={styles.appointmentCategory}>
                  <Text style={styles.categoryLabel}>Past</Text>
                  <View style={styles.historyContainer}>
                    {pastAppointments.map((apt, index) => (
                      <View key={apt.id} style={[styles.historyItem, index !== pastAppointments.length - 1 && styles.historyItemBorder]}>
                        <View style={styles.historyItemLeft}>
                          <Text style={styles.historyItemDate}>{formatDate(apt.date)}</Text>
                          <Text style={styles.historyItemTime}>{apt.time}</Text>
                        </View>
                        <View style={styles.historyItemCenter}>
                          <Text style={styles.historyItemService}>{apt.service}</Text>
                          <Text style={styles.historyItemNotes}>{apt.notes || 'No notes'}</Text>
                        </View>
                        <View style={[styles.historyItemStatus, { backgroundColor: getStatusBgColor(apt.status) }]}>
                          <Text style={[styles.historyItemStatusText, { color: getStatusColor(apt.status) }]}>
                            {apt.status ? apt.status.charAt(0).toUpperCase() + apt.status.slice(1) : 'N/A'}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
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
  historyContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    overflow: 'hidden',
  },
  historyItem: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 10,
  },
  historyItemBorder: {
    borderBottomColor: '#f0f0f0',
    borderBottomWidth: 1,
  },
  historyItemLeft: {
    width: 60,
    alignItems: 'center',
  },
  historyItemDate: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0b7fab',
    marginBottom: 2,
  },
  historyItemTime: {
    fontSize: 11,
    color: '#666',
  },
  historyItemCenter: {
    flex: 1,
  },
  historyItemService: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
  },
  historyItemNotes: {
    fontSize: 11,
    color: '#999',
  },
  historyItemStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  historyItemStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  appointmentCategory: {
    marginBottom: 16,
  },
  categoryLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0b7fab',
    marginBottom: 8,
    paddingLeft: 4,
  },
});
