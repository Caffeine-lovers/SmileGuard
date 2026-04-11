import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { updateDoctorAppointmentStatus, getAppointmentRequests } from '../../lib/appointmentService';
import { createManualNotification } from '../../lib/notificationService';
import { formatAppointmentDate } from '../../lib/dateFormatters';
import { DashboardAppointment } from '../dashboard/DoctorDashboard';

interface AppointmentsRequestTabProps {
  userId: string;
  onRequestAccepted?: () => void;
  onRequestAcceptedWithNotification?: (notification: any) => void;
  styles: any;
}

export default function AppointmentsRequestTab({
  userId,
  onRequestAccepted,
  onRequestAcceptedWithNotification,
  styles,
}: AppointmentsRequestTabProps) {
  const [appointmentRequests, setAppointmentRequests] = useState<DashboardAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch appointment requests
  const fetchAppointmentRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const appointmentRequestsData = await getAppointmentRequests();
      
      if (appointmentRequestsData && appointmentRequestsData.length > 0) {
        const transformedRequests = appointmentRequestsData.map((apt: any) => ({
          id: apt.id || '',
          name: apt.patient_name || 'Patient',
          service: apt.service || '',
          time: apt.appointment_time || '',
          date: apt.appointment_date || '',
          age: 0,
          gender: apt.patient_profile?.gender || '',
          contact: apt.patient_profile?.phone || '',
          email: apt.profiles?.email || '',
          notes: apt.notes || '',
          imageUrl: apt.patient_avatar || require('../../assets/images/user.png'),
          status: (apt.status || 'scheduled') as 'scheduled' | 'completed' | 'cancelled' | 'no-show',
          patient_id: apt.patient_id,
          dentist_id: apt.dentist_id,
          medicalIntake: apt.patient_profile ? {
            gender: apt.patient_profile.gender || '',
            phone: apt.patient_profile.phone || '',
            address: apt.patient_profile.address || '',
            dateOfBirth: apt.patient_profile.date_of_birth || '',
            emergencyContactName: apt.patient_profile.emergency_contact_name || '',
            emergencyContactPhone: apt.patient_profile.emergency_contact_phone || '',
            allergies: apt.patient_profile.allergies || '',
            currentMedications: apt.patient_profile.current_medications || '',
            medicalConditions: apt.patient_profile.medical_conditions || '',
            pastSurgeries: apt.patient_profile.past_surgeries || '',
            smokingStatus: apt.patient_profile.smoking_status || '',
            pregnancyStatus: apt.patient_profile.pregnancy_status || '',
            notes: apt.patient_profile.notes || '',
          } : null,
        }));
        setAppointmentRequests(transformedRequests);
      } else {
        setAppointmentRequests([]);
      }
    } catch (error) {
      console.error('Error fetching appointment requests:', error);
      Alert.alert('Error', 'Failed to load appointment requests');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch on component mount
  useFocusEffect(
    useCallback(() => {
      fetchAppointmentRequests();
    }, [fetchAppointmentRequests])
  );

  const handleAcceptAppointmentRequest = async (request: DashboardAppointment) => {
    try {
      if (!userId) {
        Alert.alert('Error', 'Doctor ID not found');
        return;
      }

      // Update the appointment with the current doctor's ID
      const result = await updateDoctorAppointmentStatus(request.id, 'scheduled', userId, {
        dentist_id: userId,
      });

      if (!result.success) {
        Alert.alert('Error', result.message);
        return;
      }

      // Remove from requests list
      setAppointmentRequests((prev) => prev.filter((r) => r.id !== request.id));

      // Trigger manual notification for accepting request
      const notification = createManualNotification(
        'appointment-updated',
        'Appointment Accepted',
        `You accepted the appointment with ${request.name} for ${request.date}`,
        {
          appointmentId: request.id,
          patientId: request.patient_id,
          action: 'UPDATE',
        }
      );

      // Call the callback to add notification to DoctorDashboard
      if (onRequestAcceptedWithNotification) {
        onRequestAcceptedWithNotification(notification);
      }

      if (onRequestAccepted) {
        onRequestAccepted();
      }

      Alert.alert('Success', `Appointment with ${request.name} has been accepted`);
    } catch (error) {
      Alert.alert('Error', 'Failed to accept appointment request');
      console.error('Error accepting appointment request:', error);
    }
  };

  const handleDeclineAppointmentRequest = async (request: DashboardAppointment) => {
    Alert.alert(
      'Decline Request',
      `Are you sure you want to decline this appointment request with ${request.name}?`,
      [
        { text: 'Keep', onPress: () => {}, style: 'cancel' },
        {
          text: 'Decline',
          onPress: () => {
            setAppointmentRequests((prev) => prev.filter((r) => r.id !== request.id));
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f8ff' }}>
        <ActivityIndicator size="large" color="#0b7fab" />
        <Text style={{ marginTop: 16, color: '#0b7fab', fontSize: 16 }}>Loading requests...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f0f8ff' }}>
      {/* Header */}
      <View style={tabStyles.header}>
        <View style={tabStyles.headerContent}>
          <Text style={tabStyles.headerTitle}>Appointment Requests</Text>
          <View style={tabStyles.badgeContainer}>
            <Text style={tabStyles.badgeText}>{appointmentRequests.length}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => {
            setIsRefreshing(true);
            fetchAppointmentRequests();
          }}
          disabled={isRefreshing}
          style={tabStyles.refreshButton}
          activeOpacity={0.7}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color="#0b7fab" />
          ) : (
            <Image
              source={require('../../assets/images/icon/refresh.png')}
              style={{ width: 24, height: 24, resizeMode: 'contain' }}
            />
          )}
        </TouchableOpacity>
      </View>

      {appointmentRequests.length === 0 ? (
        <View style={tabStyles.emptyState}>
          <Text style={tabStyles.emptyStateIcon}>📭</Text>
          <Text style={tabStyles.emptyStateTitle}>No Appointment Requests</Text>
          <Text style={tabStyles.emptyStateMessage}>
            All pending appointments have been processed!
          </Text>
        </View>
      ) : (
        <ScrollView style={tabStyles.requestsList} contentContainerStyle={tabStyles.requestsListContent}>
          {appointmentRequests.map((request) => (
            <View key={request.id} style={tabStyles.requestCard}>
              {/* Patient Info */}
              <View style={tabStyles.patientSection}>
                <Image
                  source={typeof request.imageUrl === 'string' ? { uri: request.imageUrl } : request.imageUrl}
                  style={tabStyles.patientAvatar}
                />
                <View style={tabStyles.patientInfo}>
                  <Text style={tabStyles.patientName}>{request.name}</Text>
                  <Text style={tabStyles.patientEmail}>{request.email || 'No email'}</Text>
                </View>
              </View>

              {/* Appointment Details */}
              <View style={tabStyles.detailsSection}>
                <View style={tabStyles.detailRow}>
                  <Text style={tabStyles.detailLabel}>Service:</Text>
                  <Text style={tabStyles.detailValue}>{request.service || 'Not specified'}</Text>
                </View>
                <View style={tabStyles.detailRow}>
                  <Text style={tabStyles.detailLabel}>Date & Time:</Text>
                  <Text style={tabStyles.detailValue}>{formatAppointmentDate(request.date)} at {request.time}</Text>
                </View>
                <View style={tabStyles.detailRow}>
                  <Text style={tabStyles.detailLabel}>Contact:</Text>
                  <Text style={tabStyles.detailValue}>{request.contact || 'Not provided'}</Text>
                </View>
                {request.notes && (
                  <View style={tabStyles.detailRow}>
                    <Text style={tabStyles.detailLabel}>Notes:</Text>
                    <Text style={tabStyles.detailValue}>{request.notes}</Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={tabStyles.actionButtons}>
                <TouchableOpacity
                  onPress={() => handleAcceptAppointmentRequest(request)}
                  style={tabStyles.acceptButton}
                >
                  <Image
                    source={require('../../assets/images/icon/check.png')}
                    style={{ width: 18, height: 18, resizeMode: 'contain', marginRight: 6 }}
                  />
                  <Text style={tabStyles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeclineAppointmentRequest(request)}
                  style={tabStyles.declineButton}
                >
                  <Image
                    source={require('../../assets/images/icon/close.png')}
                    style={{ width: 18, height: 18, resizeMode: 'contain', marginRight: 6 }}
                  />
                  <Text style={tabStyles.declineButtonText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },

  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0b7fab',
  },

  badgeContainer: {
    backgroundColor: '#ff9800',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },

  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0b7fab',
  },

  requestsList: {
    flex: 1,
  },

  requestsListContent: {
    padding: 16,
    paddingBottom: 24,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },

  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },

  emptyStateMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },

  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },

  patientSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  patientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },

  patientInfo: {
    flex: 1,
  },

  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },

  patientEmail: {
    fontSize: 12,
    color: '#999',
  },

  detailsSection: {
    marginBottom: 16,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0b7fab',
    flex: 0.35,
  },

  detailValue: {
    fontSize: 12,
    color: '#333',
    flex: 0.65,
    textAlign: 'right',
  },

  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },

  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
  },

  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },

  declineButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
