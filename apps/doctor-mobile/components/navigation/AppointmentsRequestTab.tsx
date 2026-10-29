import React, { useCallback, useState, useEffect, useRef } from 'react';
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
import { formatAppointmentDate, formatAppointmentTime } from '../../lib/dateFormatters';
import { DashboardAppointment } from '../dashboard/DoctorDashboard';
import { Inbox, Check, X, RefreshCw, ChevronLeft, ChevronRight, Sparkles, Clock, Calendar, ShieldCheck, UserCheck } from 'lucide-react-native';
import { AppColors } from '../../constants/theme';
import AppTour, { useTourTargets, TourStep } from '../tour/AppTour';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppointmentsRequestTabProps {
  userId: string;
  onRequestAccepted?: () => void;
  onRequestAcceptedWithNotification?: (notification: any) => void;
  styles: any;
  startTourTrigger?: number;
}

const ITEMS_PER_PAGE = 4;

export default function AppointmentsRequestTab({
  userId,
  onRequestAccepted,
  onRequestAcceptedWithNotification,
  styles,
  startTourTrigger,
}: AppointmentsRequestTabProps) {
  const [appointmentRequests, setAppointmentRequests] = useState<DashboardAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const scrollViewRef = useRef<any>(null);

  const totalPages = Math.max(1, Math.ceil(appointmentRequests.length / ITEMS_PER_PAGE));

  // ─────────────────────────────────────────
  // INTERACTIVE WALKTHROUGH SYSTEM
  // ─────────────────────────────────────────
  const tour = useTourTargets();
  const [tourVisible, setTourVisible] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);



  const tourSteps: TourStep[] = [
    {
      id: "requests-welcome",
      title: "Welcome to Appointment Requests!",
      description: "Review, evaluate, and triage incoming booking requests submitted by your patients in real time.",
      icon: Inbox,
      placement: "center",
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) {}
      },
    },
    {
      id: "requests-actions",
      target: "requests-actions",
      title: "Sync & Walkthrough Guide",
      description: "Tap the refresh icon anytime to sync real-time patient requests from the cloud, or tap Sparkles to replay this guide.",
      icon: Sparkles,
      padding: 6,
      radius: 8,
      placement: "bottom",
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) {}
      },
    },
    {
      id: "requests-counter",
      target: "requests-counter",
      title: "Request Queue Counter",
      description: "See the exact number of patient booking requests currently waiting in your triage queue.",
      icon: Clock,
      padding: 6,
      radius: 8,
      placement: "bottom",
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) {}
      },
    },
    ...(appointmentRequests.length > 0
      ? [
          {
            id: "requests-first-card",
            target: "requests-first-card",
            title: "Patient & Booking Details",
            description: "Inspect the patient's name, email, contact number, requested service, preferred date, and formatted AM/PM visit time.",
            icon: Calendar,
            padding: 6,
            radius: 8,
            placement: "bottom" as const,
            onEnter: () => {
              try {
                scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
              } catch (e) {}
            },
          },
          {
            id: "requests-action-buttons",
            target: "requests-action-buttons",
            title: "Accept or Decline",
            description: "Tap Accept to confirm the appointment and add it to your daily schedule, or tap Decline to reject the request.",
            icon: UserCheck,
            padding: 6,
            radius: 8,
            placement: "auto" as const,
          },
        ]
      : [
          {
            id: "requests-empty-state",
            target: "requests-empty-state",
            title: "Clean Triage Queue",
            description: "When patient booking requests arrive, they will appear here with full clinical details and one-tap approval actions.",
            icon: Inbox,
            padding: 8,
            radius: 8,
            placement: "bottom" as const,
          },
        ]),
    ...(totalPages > 1
      ? [
          {
            id: "requests-pagination",
            target: "requests-pagination",
            title: "Queue Pagination",
            description: "Browse across multiple pages of pending bookings easily using page numbers or next/previous buttons.",
            icon: ChevronRight,
            padding: 6,
            radius: 8,
            placement: "auto" as const,
            onEnter: () => {
              try {
                scrollViewRef.current?.scrollToEnd?.({ animated: false });
              } catch (e) {}
            },
          },
        ]
      : []),
    {
      id: "requests-finish",
      title: "You're All Set, Doctor!",
      description: "You're now ready to manage your clinic's patient requests swiftly and efficiently. Enjoy a smooth triage workflow!",
      icon: ShieldCheck,
      placement: "center",
    },
  ];

  const handleStartTour = () => {
    setTourIndex(0);
    setTourVisible(true);
  };

  const handleFinishTour = async () => {
    setTourVisible(false);
    if (userId) {
      try {
        await AsyncStorage.setItem(
          `@smileguard_doctor_appointment_requests_walkthrough_completed_${userId}`,
          "true"
        );
      } catch (err) {
        console.error("Error saving request walkthrough status:", err);
      }
    }
  };

  const handleSkipTour = async () => {
    setTourVisible(false);
    if (userId) {
      try {
        await AsyncStorage.setItem(
          `@smileguard_doctor_appointment_requests_walkthrough_completed_${userId}`,
          "true"
        );
      } catch (err) {
        console.error("Error saving request walkthrough status:", err);
      }
    }
  };

  // Auto-prompt walkthrough on first visit to AppointmentsRequestTab
  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    const checkFirstTimeTour = async () => {
      try {
        const key = `@smileguard_doctor_appointment_requests_walkthrough_completed_${userId}`;
        const hasCompleted = await AsyncStorage.getItem(key);
        if (!hasCompleted && isMounted) {
          const timer = setTimeout(() => {
            if (isMounted) {
              setTourIndex(0);
              setTourVisible(true);
            }
          }, 600);
          return () => clearTimeout(timer);
        }
      } catch (err) {
        console.error("Error checking appointment requests walkthrough status:", err);
      }
    };

    checkFirstTimeTour();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Support triggering walkthrough from parent
  useEffect(() => {
    if (startTourTrigger && startTourTrigger > 0) {
      setTourIndex(0);
      setTourVisible(true);
    }
  }, [startTourTrigger]);

  // Fetch appointment requests
  const fetchAppointmentRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const appointmentRequestsData = await getAppointmentRequests();
      
      if (appointmentRequestsData && appointmentRequestsData.length > 0) {
        const filteredRequests = appointmentRequestsData.filter((apt: any) => !['cancelled', 'declined', 'completed', 'no-show'].includes((apt.status || '').toLowerCase()));
        const transformedRequests = filteredRequests.map((apt: any) => ({
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
          status: (apt.status?.toLowerCase() === 'pending' ? 'pending' : (apt.status || 'pending')) as any,
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

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRequests = appointmentRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Keep currentPage valid if totalPages shrinks
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setCurrentPage(page);
      try {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      } catch (err) {
        // safe fallback
      }
    }
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
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
    <View
      ref={tour.setContainer}
      collapsable={false}
      style={{ flex: 1, backgroundColor: AppColors.background }}
    >
      {/* Header */}
      <View style={tabStyles.header}>
        <View
          ref={tour.register("requests-counter")}
          collapsable={false}
          style={tabStyles.headerContent}
        >
          <Text style={tabStyles.headerTitle}>Appointment Requests</Text>
          <View style={tabStyles.badgeContainer}>
            <Text style={tabStyles.badgeText}>{appointmentRequests.length}</Text>
          </View>
        </View>

        <View
          ref={tour.register("requests-actions")}
          collapsable={false}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <TouchableOpacity
            onPress={() => {
              setIsRefreshing(true);
              fetchAppointmentRequests();
            }}
            disabled={isRefreshing}
            style={tabStyles.refreshButton}
            activeOpacity={0.7}
            accessibilityLabel="Refresh Requests"
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={AppColors.primary} />
            ) : (
              <RefreshCw size={18} color={AppColors.primaryDark} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleStartTour}
            style={tabStyles.tourButton}
            activeOpacity={0.7}
            accessibilityLabel="Start Walkthrough"
          >
            <Sparkles size={18} color="#047857" />
          </TouchableOpacity>
        </View>
      </View>

      {appointmentRequests.length === 0 ? (
        <View
          ref={tour.register("requests-empty-state")}
          collapsable={false}
          style={tabStyles.emptyState}
        >
          <Inbox size={48} color={AppColors.textMuted} style={{ marginBottom: 16 }} />
          <Text style={tabStyles.emptyStateTitle}>No Appointment Requests</Text>
          <Text style={tabStyles.emptyStateMessage}>
            All pending appointments have been processed.
          </Text>
        </View>
      ) : (
        <ScrollView ref={scrollViewRef} style={tabStyles.requestsList} contentContainerStyle={tabStyles.requestsListContent}>
          {/* Header info showing request count and page */}
          <View style={tabStyles.countHeader}>
            <Text style={tabStyles.countHeaderText}>
              Showing <Text style={tabStyles.countHeaderBold}>{startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, appointmentRequests.length)}</Text> of <Text style={tabStyles.countHeaderBold}>{appointmentRequests.length}</Text> requests
            </Text>
            {totalPages > 1 && (
              <View style={tabStyles.pageBadge}>
                <Text style={tabStyles.pageBadgeText}>
                  Page {currentPage} of {totalPages}
                </Text>
              </View>
            )}
          </View>

          {paginatedRequests.map((request, index) => (
            <View
              key={request.id}
              ref={index === 0 ? tour.register("requests-first-card") : undefined}
              collapsable={false}
              style={tabStyles.requestCard}
            >
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
                <View style={tabStyles.pendingBadge}>
                  <Text style={tabStyles.pendingBadgeText}>PENDING</Text>
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
                  <Text style={tabStyles.detailValue}>{formatAppointmentDate(request.date)} at {formatAppointmentTime(request.time)}</Text>
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
              <View
                ref={index === 0 ? tour.register("requests-action-buttons") : undefined}
                collapsable={false}
                style={tabStyles.actionButtons}
              >
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <View
              ref={tour.register("requests-pagination")}
              collapsable={false}
              style={tabStyles.paginationContainer}
            >
              {/* Previous Button */}
              <TouchableOpacity
                style={[
                  tabStyles.navButton,
                  currentPage === 1 && tabStyles.navButtonDisabled,
                ]}
                onPress={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                activeOpacity={0.7}
                accessibilityLabel="Previous Page"
              >
                <ChevronLeft size={18} color={currentPage === 1 ? '#94A3B8' : AppColors.primaryDark} />
              </TouchableOpacity>

              {/* Page Numbers */}
              <View style={tabStyles.pageNumbersRow}>
                {getPageNumbers().map((pageNum, index) => {
                  if (pageNum === '...') {
                    return (
                      <View key={`ellipsis-${index}`} style={tabStyles.ellipsisBox}>
                        <Text style={tabStyles.ellipsisText}>•••</Text>
                      </View>
                    );
                  }
                  const isSelected = pageNum === currentPage;
                  return (
                    <TouchableOpacity
                      key={`page-${pageNum}`}
                      style={[
                        tabStyles.pageButton,
                        isSelected && tabStyles.pageButtonActive,
                      ]}
                      onPress={() => handlePageChange(pageNum as number)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          tabStyles.pageButtonText,
                          isSelected && tabStyles.pageButtonTextActive,
                        ]}
                      >
                        {pageNum}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Next Button */}
              <TouchableOpacity
                style={[
                  tabStyles.navButton,
                  currentPage === totalPages && tabStyles.navButtonDisabled,
                ]}
                onPress={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                activeOpacity={0.7}
                accessibilityLabel="Next Page"
              >
                <ChevronRight size={18} color={currentPage === totalPages ? '#94A3B8' : AppColors.primaryDark} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Interactive Walkthrough Tour */}
      <AppTour
        visible={tourVisible}
        steps={tourSteps}
        index={tourIndex}
        onIndexChange={setTourIndex}
        measureTarget={tour.measure}
        onFinish={handleFinishTour}
        onSkip={handleSkipTour}
      />
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
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderBottomColor: '#CBD5E1',
    borderRightColor: '#CBD5E1',
  },

  tourButton: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderBottomColor: '#CBD5E1',
    borderRightColor: '#CBD5E1',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
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

  pendingBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'center',
  },

  pendingBadgeText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
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

  countHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 2,
  },

  countHeaderText: {
    fontSize: 13,
    color: AppColors.textSecondary,
    fontWeight: '500',
  },

  countHeaderBold: {
    fontWeight: '700',
    color: AppColors.textPrimary,
  },

  pageBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },

  pageBadgeText: {
    fontSize: 11,
    color: AppColors.primaryDark,
    fontWeight: '700',
  },

  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#E6ECEF',
    borderRadius: 4,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    borderBottomColor: '#B0BAC5',
    borderRightColor: '#B0BAC5',
    gap: 8,
  },

  navButton: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },

  navButtonDisabled: {
    backgroundColor: '#DDE4E8',
    borderColor: '#CBD5E1',
  },

  pageNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  pageButton: {
    minWidth: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    backgroundColor: '#DDE4E8',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },

  pageButtonActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primaryDark,
  },

  pageButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textPrimary,
  },

  pageButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  ellipsisBox: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ellipsisText: {
    fontSize: 12,
    color: '#94A3B8',
    letterSpacing: 1,
  },
});
