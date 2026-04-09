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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { updateDoctorAppointmentStatus } from "../../lib/appointmentService";

interface AppointmentEditProps {
  visible: boolean;
  appointment: any;
  doctorId: string;
  onClose: () => void;
  onSave: () => void;
}

const STATUS_OPTIONS: Array<'scheduled' | 'completed' | 'cancelled' | 'no-show'> = [
  'scheduled',
  'completed',
  'cancelled',
  'no-show',
];

const STATUS_COLORS: { [key: string]: string } = {
  scheduled: '#FFC107',
  completed: '#4CAF50',
  cancelled: '#F44336',
  'no-show': '#9C27B0',
};

export default function AppointmentEdit({
  visible,
  appointment,
  doctorId,
  onClose,
  onSave,
}: AppointmentEditProps) {
  const [selectedStatus, setSelectedStatus] = useState<'scheduled' | 'completed' | 'cancelled' | 'no-show'>('scheduled');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && appointment) {
      console.log('🔍 AppointmentEdit opened with appointment:', {
        id: appointment.id,
        status: appointment.status,
        service: appointment.service,
        apt_date: appointment.appointment_date,
        keys: Object.keys(appointment)
      });
      setSelectedStatus(appointment.status || 'scheduled');
    }
  }, [visible, appointment]);

  const handleSave = async () => {
    if (!appointment || selectedStatus === appointment.status) {
      Alert.alert('Info', 'No changes made');
      return;
    }

    try {
      setLoading(true);
      
      const appointmentId = appointment.id;
      console.log('🔄 Starting appointment status update...');
      console.log('   Appointment ID:', appointmentId);
      console.log('   Current Status:', appointment.status);
      console.log('   New Status:', selectedStatus);
      console.log('   Doctor ID:', doctorId);
      console.log('   Full Appointment Object:', appointment);
      
      const result = await updateDoctorAppointmentStatus(
        appointmentId,
        selectedStatus,
        doctorId
      );

      console.log('📊 Update Result:', result);
      
      if (result.success) {
        console.log('✅ Appointment status updated successfully');
        Alert.alert('Success', `Appointment status updated to ${selectedStatus}`);
        onSave();
        onClose();
      } else {
        console.error('❌ Failed to update appointment:', result.message);
        Alert.alert('Error', result.message || 'Failed to update appointment status');
      }
    } catch (error) {
      console.error('❌ Exception updating appointment:', error);
      Alert.alert('Error', 'Failed to update appointment status');
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) return null;

  // Use separate date and time fields if available
  const formattedDate = appointment.date && appointment.time 
    ? (() => {
        const dateObj = new Date(appointment.date);
        const dateFormatted = dateObj.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        return `${dateFormatted} ${appointment.time}`;
      })()
    : new Date(appointment.appointment_date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Image
              source={require('../../assets/images/icon/back.png')}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Appointment</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* Content */}
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Appointment Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appointment Details</Text>

            <View style={styles.detailContainer}>
              <Text style={styles.detailLabel}>Service:</Text>
              <Text style={styles.detailValue}>{appointment.service || 'General Appointment'}</Text>
            </View>

            <View style={styles.detailContainer}>
              <Text style={styles.detailLabel}>Date & Time:</Text>
              <Text style={styles.detailValue}>{formattedDate}</Text>
            </View>

            {appointment.notes && (
              <View style={styles.detailContainer}>
                <Text style={styles.detailLabel}>Notes:</Text>
                <Text style={styles.detailValue}>{appointment.notes}</Text>
              </View>
            )}
          </View>

          {/* Status Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Update Status</Text>
            <Text style={styles.label}>Current Status: <Text style={{ fontWeight: '700', color: STATUS_COLORS[appointment.status] }}>{appointment.status?.toUpperCase()}</Text></Text>

            <View style={styles.statusContainer}>
              {STATUS_OPTIONS.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusButton,
                    {
                      backgroundColor:
                        selectedStatus === status
                          ? STATUS_COLORS[status]
                          : '#e0e0e0',
                      borderWidth: selectedStatus === status ? 2 : 0,
                      borderColor: STATUS_COLORS[status],
                    },
                  ]}
                  onPress={() => setSelectedStatus(status)}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      {
                        color: selectedStatus === status ? '#fff' : '#333',
                        fontWeight: selectedStatus === status ? '700' : '600',
                      },
                    ]}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Status Descriptions */}
            <View style={styles.descriptionBox}>
              {selectedStatus === 'scheduled' && (
                <Text style={styles.descriptionText}>Appointment is scheduled</Text>
              )}
              {selectedStatus === 'completed' && (
                <Text style={styles.descriptionText}>Appointment has been completed</Text>
              )}
              {selectedStatus === 'cancelled' && (
                <Text style={styles.descriptionText}>Appointment has been cancelled</Text>
              )}
              {selectedStatus === 'no-show' && (
                <Text style={styles.descriptionText}>Patient did not show up</Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.button, styles.saveButton]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
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
  backIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b7fab',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  detailContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#0b7fab',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  statusButton: {
    width: '48%',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonText: {
    fontSize: 13,
    textAlign: 'center',
  },
  descriptionBox: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0b7fab',
    marginTop: 12,
  },
  descriptionText: {
    fontSize: 13,
    color: '#0b7fab',
    fontWeight: '600',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopColor: '#e0e0e0',
    borderTopWidth: 1,
    backgroundColor: '#fff',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#0b7fab',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  cancelButtonText: {
    color: '#333',
  },
});
