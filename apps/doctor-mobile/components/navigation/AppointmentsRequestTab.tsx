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
import { Inbox, Check, X, RefreshCw } from 'lucide-react-native';
import { AppColors } from '../../constants/theme';

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
    Alert.alert(
      'Accept Request',
      `Accept this appointment request with ${request.name}?`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              if (!userId) {
                Alert.alert('Error', 'Doctor ID not found');
                return;
              }

              // Update the appointment with the current doctor's ID
              const result = await updateDoctorAppointmentStatus(request.id, 'scheduled', userId, {
                dentist_id: userId,
              });

              if (!result?.success) {
                Alert.alert('Error', result?.message || 'Failed to accept appointment');
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
          },
          style: 'default',
        },
      ]
    );
  };

  const handleDeclineAppointmentRequest = async (request: DashboardAppointment) => {
    Alert.alert(
      'Decline Request',
      `Are you sure you want to decline this appointment request with ${request.name}?`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Decline',
          onPress: async () => {
            try {
              if (!userId) {
                Alert.alert('Error', 'Doctor ID not found');
                return;
              }

              // Update appointment status to 'declined' and assign the doctor ID
              const result = await updateDoctorAppointmentStatus(request.id, 'declined', userId, {
                dentist_id: userId,
              });

              if (!result?.success) {
                Alert.alert('Error', result?.message || 'Failed to decline appointment');
                return;
              }

              // Remove from requests list
              setAppointmentRequests((prev) => prev.filter((r) => r.id !== request.id));

              // Trigger manual notification for declining request
              const notification = createManualNotification(
                'appointment-declined',
                'Appointment Declined',
                `You declined the appointment with ${request.name} for ${request.date}`,
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

              Alert.alert('Success', `Appointment request with ${request.name} has been declined`);
            } catch (error) {
              Alert.alert('Error', 'Failed to decline appointment request');
              console.error('Error declining appointment request:', error);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: AppColors.background }}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={{ marginTop: 16, color: AppColors.primaryDark, fontSize: 15, fontWeight: '600' }}>
          Loading requests...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: AppColors.background }}>
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
            <ActivityIndicator size="small" color={AppColors.primary} />
          ) : (
            <RefreshCw size={20} color={AppColors.primaryDark} />
          )}
        </TouchableOpacity>
      </View>

      {appointmentRequests.length === 0 ? (
        <View style={tabStyles.emptyState}>
          <Inbox size={48} color={AppColors.textMuted} style={{ marginBottom: 16 }} />
          <Text style={tabStyles.emptyStateTitle}>No Appointment Requests</Text>
          <Text style={tabStyles.emptyStateMessage}>
            All pending appointments have been processed.
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
                  <Check size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={tabStyles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeclineAppointmentRequest(request)}
                  style={tabStyles.declineButton}
                >
                  <X size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
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
    backgroundColor: '#E6ECEF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#CBD5E1',
  },

  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: AppColors.primaryDark,
    letterSpacing: -0.3,
  },

  badgeContainer: {
    backgroundColor: AppColors.primary,
    borderRadius: 4, // Sharp, defined micro-radius (avoiding soft bordering)
    borderWidth: 1,
    borderColor: AppColors.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  badgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },

  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 4, // Sharp micro-radius
    backgroundColor: '#DDE4E8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    borderBottomColor: '#B0BAC5',
    borderRightColor: '#B0BAC5',
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

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 8,
  },

  emptyStateMessage: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },

  requestCard: {
    backgroundColor: '#E6ECEF',
    borderRadius: 4, // Sharp defined micro-radius
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    borderLeftWidth: 4,
    borderTopColor: '#FFFFFF',
    borderRightColor: '#B0BAC5',
    borderBottomColor: '#B0BAC5',
    borderLeftColor: AppColors.primary,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#9AA7B5',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },

  patientSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },

  patientAvatar: {
    width: 52,
    height: 52,
    borderRadius: 4, // Crisp defined avatar radius (avoiding circle/soft bordering)
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 12,
  },

  patientInfo: {
    flex: 1,
  },

  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 4,
  },

  patientEmail: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },

  detailsSection: {
    marginBottom: 16,
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primaryDark,
    flex: 0.35,
  },

  detailValue: {
    fontSize: 12,
    color: AppColors.textPrimary,
    flex: 0.65,
    textAlign: 'right',
    fontWeight: '500',
  },

  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },

  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    paddingVertical: 10,
    borderRadius: 4, // Crisp defined border
    borderWidth: 1.5,
    borderTopColor: '#34D399',
    borderLeftColor: '#34D399',
    borderBottomColor: '#047857',
    borderRightColor: '#047857',
  },

  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.danger,
    paddingVertical: 10,
    borderRadius: 4, // Crisp defined border
    borderWidth: 1.5,
    borderTopColor: '#F87171',
    borderLeftColor: '#F87171',
    borderBottomColor: '#B91C1C',
    borderRightColor: '#B91C1C',
  },

  declineButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
