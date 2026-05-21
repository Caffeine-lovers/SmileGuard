import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@smileguard/supabase-client';
import { Billing } from '@smileguard/shared-types';

interface CancellationFeeProps {
  billings: Billing[];
  selectedPatientId: string;
  selectedPatientIsDummy: boolean;
  onPaymentStatusUpdate: () => void;
}

interface AppointmentDetails {
  id: string;
  patient_id: string;
  dummy_account_id?: string;
  dentist_id: string | null;
  service: string;
  appointment_date: string;
  appointment_time: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export default function CancellationFee({
  billings,
  selectedPatientId,
  selectedPatientIsDummy,
  onPaymentStatusUpdate,
}: CancellationFeeProps) {
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDetails | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [loadingAppointment, setLoadingAppointment] = useState(false);
  const [selectedBillingForEdit, setSelectedBillingForEdit] = useState<Billing | null>(null);
  const [showPaymentStatusModal, setShowPaymentStatusModal] = useState(false);
  const [updatingPaymentStatus, setUpdatingPaymentStatus] = useState(false);
  const [appointmentBillings, setAppointmentBillings] = useState<Billing[]>([]);
  const [showBillingHistoryModal, setShowBillingHistoryModal] = useState(false);
  const [loadingBillingHistory, setLoadingBillingHistory] = useState(false);

  // Filter to show only cancellation fees
  const cancellationBillings = billings.filter((b) => {
    const desc = b.description?.toLowerCase() || '';
    return desc.includes('cancellation') || desc.includes('cancelled');
  });

  // Calculate totals for cancellation fees only
  const calculateTotals = () => {
    let total = 0;
    let paid = 0;
    let pending = 0;

    cancellationBillings.forEach((record) => {
      const finalAmount = record.final_amount || record.amount;
      total += finalAmount;

      if (record.payment_status === 'paid') {
        paid += finalAmount;
      } else {
        pending += finalAmount;
      }
    });

    return { total, paid, pending };
  };

  const { total: totalAmount, paid: paidAmount, pending: pendingAmount } = calculateTotals();

  const getPaymentStatusColor = (status: string): string => {
    switch (status) {
      case 'paid':
        return '#10b981';
      case 'overdue':
        return '#ef4444';
      case 'pending':
      default:
        return '#f59e0b';
    }
  };

  const loadAppointmentDetails = async (appointmentId: string) => {
    try {
      setLoadingAppointment(true);
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (error) {
        console.error('Error fetching appointment:', error);
        Alert.alert('Error', 'Failed to load appointment details');
        return;
      }

      if (data) {
        setSelectedAppointment(data);
        setShowAppointmentModal(true);
      }
    } catch (error) {
      console.error('Error loading appointment:', error);
      Alert.alert('Error', 'Failed to load appointment details');
    } finally {
      setLoadingAppointment(false);
    }
  };

  const loadBillingHistory = async (appointmentId: string) => {
    try {
      setLoadingBillingHistory(true);
      const { data, error } = await supabase
        .from('billings')
        .select('*')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching billing history:', error);
        Alert.alert('Error', 'Failed to load billing history');
        return;
      }

      setAppointmentBillings(data || []);
      setShowBillingHistoryModal(true);
    } catch (error) {
      console.error('Error loading billing history:', error);
      Alert.alert('Error', 'Failed to load billing history');
    } finally {
      setLoadingBillingHistory(false);
    }
  };

  const handleEditPaymentStatus = (billing: Billing) => {
    if (!selectedPatientIsDummy) {
      Alert.alert('Info', 'Payment status can only be edited for dummy account patients');
      return;
    }
    setSelectedBillingForEdit(billing);
    setShowPaymentStatusModal(true);
  };

  const updatePaymentStatus = async (newStatus: 'pending' | 'paid' | 'overdue') => {
    if (!selectedBillingForEdit || !selectedBillingForEdit.id) {
      Alert.alert('Error', 'Unable to update billing record');
      return;
    }

    try {
      setUpdatingPaymentStatus(true);

      const updateData: any = {
        payment_status: newStatus,
      };

      if (newStatus === 'paid') {
        updateData.payment_date = new Date().toISOString();
        updateData.payment_method = 'cash';
      }

      const { error } = await supabase
        .from('billings')
        .update(updateData)
        .eq('id', selectedBillingForEdit.id);

      if (error) {
        Alert.alert('Error', `Failed to update payment status: ${error.message}`);
        return;
      }

      setShowPaymentStatusModal(false);
      setSelectedBillingForEdit(null);
      Alert.alert('Success', `Payment status updated to ${newStatus}`);
      onPaymentStatusUpdate();
    } catch (error) {
      console.error('Error updating payment status:', error);
      Alert.alert('Error', 'Failed to update payment status');
    } finally {
      setUpdatingPaymentStatus(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
      <View style={{ padding: 16, gap: 16 }}>
        {/* Summary Cards */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 4 }}>
            Cancellation Fees
          </Text>
          <Text style={{ fontSize: 13, color: '#666' }}>
            Manage cancellation penalty charges
          </Text>
        </View>

        {selectedPatientId && (
          <View>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              {/* Total Amount Card */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 12,
                  borderTopWidth: 3,
                  borderTopColor: '#3b82f6',
                }}
              >
                <Text style={{ fontSize: 10, color: '#666', marginBottom: 6, fontWeight: '600' }}>
                  TOTAL
                </Text>
                <Text
                  style={{ fontSize: 16, fontWeight: '700', color: '#3b82f6' }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  ${totalAmount.toFixed(2)}
                </Text>
              </View>

              {/* Paid Amount Card */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 12,
                  borderTopWidth: 3,
                  borderTopColor: '#10b981',
                }}
              >
                <Text style={{ fontSize: 10, color: '#666', marginBottom: 6, fontWeight: '600' }}>
                  PAID
                </Text>
                <Text
                  style={{ fontSize: 16, fontWeight: '700', color: '#10b981' }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  ${paidAmount.toFixed(2)}
                </Text>
              </View>

              {/* Pending Amount Card */}
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 12,
                  borderTopWidth: 3,
                  borderTopColor: '#ef4444',
                }}
              >
                <Text style={{ fontSize: 10, color: '#666', marginBottom: 6, fontWeight: '600' }}>
                  PENDING
                </Text>
                <Text
                  style={{ fontSize: 16, fontWeight: '700', color: '#ef4444' }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  ${pendingAmount.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Cancellation Fees List */}
        <View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 12 }}>
            Charges ({cancellationBillings.length})
          </Text>

          {cancellationBillings.length === 0 ? (
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 12,
                padding: 24,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 48, marginBottom: 8 }}>📋</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 }}>
                No Cancellation Fees
              </Text>
              <Text style={{ fontSize: 13, color: '#666', textAlign: 'center' }}>
                No cancellation penalties found for this patient.
              </Text>
            </View>
          ) : (
            <FlatList
              scrollEnabled={false}
              data={cancellationBillings}
              keyExtractor={(item) => item.id || Math.random().toString()}
              renderItem={({ item }) => (
                <View
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 12,
                    marginBottom: 12,
                    padding: 14,
                    borderLeftWidth: 4,
                    borderLeftColor: getPaymentStatusColor(item.payment_status),
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
                    shadowRadius: 2,
                    elevation: 2,
                  }}
                >
                  {/* Header Row */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: '#666', fontWeight: '600' }}>
                        Bill #{item.id?.slice(0, 8).toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: getPaymentStatusColor(item.payment_status),
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          color: '#fff',
                          fontWeight: '600',
                          textTransform: 'capitalize',
                        }}
                      >
                        {item.payment_status}
                      </Text>
                    </View>
                  </View>

                  {/* Billing Type Indicator */}
                  {item.description && (
                    <View
                      style={{
                        backgroundColor: '#fed7aa',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8,
                        marginBottom: 12,
                        borderLeftWidth: 3,
                        borderLeftColor: '#ea580c',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color: '#ea580c',
                        }}
                      >
                        {item.description}
                      </Text>
                    </View>
                  )}

                  {/* Amount Row */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                      paddingBottom: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: '#e5e5e5',
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 11, color: '#666' }}>Original Amount</Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#111', marginTop: 2 }}>
                        ${item.amount.toFixed(2)}
                      </Text>
                    </View>

                    {item.discount_amount ? (
                      <TouchableOpacity
                        onPress={() => item.appointment_id && loadBillingHistory(item.appointment_id)}
                        activeOpacity={0.7}
                      >
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 11, color: '#666' }}>
                            Discount ({item.discount_type})
                          </Text>
                          <Text style={{ fontSize: 16, fontWeight: '700', color: '#ef4444', marginTop: 2 }}>
                            -${item.discount_amount.toFixed(2)}
                          </Text>
                          <Text style={{ fontSize: 9, color: '#0b7fab', marginTop: 4, fontWeight: '600', textDecorationLine: 'underline' }}>
                            Tap to verify bill
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : null}

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 11, color: '#666' }}>Final Amount</Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0b7fab', marginTop: 2 }}>
                        ${(item.final_amount || item.amount).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Discount Info Callout */}
                  {item.discount_amount && (
                    <View
                      style={{
                        backgroundColor: '#fef3c7',
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 12,
                        borderLeftWidth: 3,
                        borderLeftColor: '#f59e0b',
                      }}
                    >
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 11, color: '#92400e', fontWeight: '600', marginBottom: 4 }}>
                          💡 Discount Applied
                        </Text>
                        <Text style={{ fontSize: 11, color: '#b45309', lineHeight: 16 }}>
                          This charge has a discount applied. {item.appointment_id ? 'View the appointment details to verify the payment status and understand where this discount came from.' : 'No appointment linked to verify the discount source.'}
                        </Text>
                      </View>
                      {item.appointment_id && (
                        <TouchableOpacity
                          onPress={() => loadAppointmentDetails(item.appointment_id!)}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            backgroundColor: '#f59e0b',
                            borderRadius: 6,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#fff' }}>
                            View Appointment Details
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Details */}
                  <View style={{ gap: 6, marginBottom: 12 }}>
                    {item.appointment_id && (
                      <TouchableOpacity
                        onPress={() => loadAppointmentDetails(item.appointment_id!)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 11, color: '#666' }}>Appointment</Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: '#0b7fab',
                              fontWeight: '600',
                              textDecorationLine: 'underline',
                            }}
                          >
                            {item.appointment_id.slice(0, 8).toUpperCase()}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 11, color: '#666' }}>Created</Text>
                      <Text style={{ fontSize: 11, color: '#111', fontWeight: '500' }}>
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : 'N/A'}
                      </Text>
                    </View>

                    {item.payment_date && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 11, color: '#666' }}>Payment Date</Text>
                        <Text style={{ fontSize: 11, color: '#111', fontWeight: '500' }}>
                          {new Date(item.payment_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                    )}

                    {item.payment_method && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 11, color: '#666' }}>Method</Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: '#111',
                            fontWeight: '500',
                            textTransform: 'capitalize',
                          }}
                        >
                          {item.payment_method}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Edit Button for Dummy Accounts */}
                  {selectedPatientIsDummy && (
                    <TouchableOpacity
                      onPress={() => handleEditPaymentStatus(item)}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        backgroundColor: '#f0f9ff',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#0b7fab',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#0b7fab' }}>
                        Edit Payment Status
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </View>

      {/* Appointment Details Modal */}
      <Modal
        visible={showAppointmentModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowAppointmentModal(false);
          setSelectedAppointment(null);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
          >
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24, paddingBottom: 32 }}>
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 24,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>
                    Appointment Details
                  </Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    View appointment information
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowAppointmentModal(false);
                    setSelectedAppointment(null);
                  }}
                >
                  <Text style={{ fontSize: 24, color: '#999', fontWeight: '300' }}>✕</Text>
                </TouchableOpacity>
              </View>

              {loadingAppointment ? (
                <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <ActivityIndicator size="large" color="#0b7fab" />
                </View>
              ) : selectedAppointment ? (
                <>
                  {/* Appointment Info Card */}
                  <View
                    style={{
                      backgroundColor: '#f9f9f9',
                      borderRadius: 12,
                      padding: 14,
                      marginBottom: 24,
                      borderLeftWidth: 4,
                      borderLeftColor: '#0b7fab',
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Appointment ID</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginTop: 4 }}>
                          {selectedAppointment.id.slice(0, 8).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Status</Text>
                        <View
                          style={{
                            backgroundColor:
                              selectedAppointment.status === 'completed'
                                ? '#10b981'
                                : selectedAppointment.status === 'cancelled'
                                ? '#ef4444'
                                : selectedAppointment.status === 'no-show'
                                ? '#f59e0b'
                                : '#0b7fab',
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 6,
                            marginTop: 4,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '600',
                              color: '#fff',
                              textTransform: 'capitalize',
                            }}
                          >
                            {selectedAppointment.status}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingTop: 12,
                        borderTopWidth: 1,
                        borderTopColor: '#e5e5e5',
                      }}
                    >
                      <View>
                        <Text style={{ fontSize: 11, color: '#666', fontWeight: '600', marginTop: 8 }}>
                          Service
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginTop: 4 }}>
                          {selectedAppointment.service || 'General'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 11, color: '#666', fontWeight: '600', marginTop: 8 }}>
                          Patient ID
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#0b7fab', marginTop: 4 }}>
                          {(selectedAppointment.patient_id ||
                            selectedAppointment.dummy_account_id ||
                            'N/A'
                          ).slice(0, 8)
                            .toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Date & Time */}
                  <View style={{ marginBottom: 24 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 12 }}>
                      Date & Time
                    </Text>
                    <View style={{ gap: 10 }}>
                      <View
                        style={{
                          backgroundColor: '#fff',
                          borderRadius: 10,
                          padding: 12,
                          borderWidth: 1,
                          borderColor: '#e5e5e5',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Date</Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111', marginTop: 6 }}>
                          {new Date(selectedAppointment.appointment_date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </Text>
                      </View>
                      <View
                        style={{
                          backgroundColor: '#fff',
                          borderRadius: 10,
                          padding: 12,
                          borderWidth: 1,
                          borderColor: '#e5e5e5',
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Time</Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111', marginTop: 6 }}>
                          {selectedAppointment.appointment_time}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Notes */}
                  {selectedAppointment.notes && (
                    <View style={{ marginBottom: 24 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 12 }}>
                        Notes
                      </Text>
                      <View
                        style={{
                          backgroundColor: '#f9f9f9',
                          borderRadius: 10,
                          padding: 12,
                          borderLeftWidth: 3,
                          borderLeftColor: '#0b7fab',
                        }}
                      >
                        <Text style={{ fontSize: 12, color: '#333', lineHeight: 18 }}>
                          {selectedAppointment.notes}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Created Date */}
                  <View
                    style={{
                      backgroundColor: '#f0f9ff',
                      borderRadius: 10,
                      padding: 12,
                      borderLeftWidth: 3,
                      borderLeftColor: '#3b82f6',
                    }}
                  >
                    <Text style={{ fontSize: 11, color: '#0369a1', fontWeight: '600' }}>
                      Created:{' '}
                      {selectedAppointment.created_at
                        ? new Date(selectedAppointment.created_at).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'N/A'}
                    </Text>
                  </View>

                  {/* Close Button */}
                  <TouchableOpacity
                    onPress={() => {
                      setShowAppointmentModal(false);
                      setSelectedAppointment(null);
                    }}
                    style={{
                      marginTop: 24,
                      paddingVertical: 14,
                      borderRadius: 10,
                      backgroundColor: '#0b7fab',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Close</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 14, color: '#666' }}>No appointment data available</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Billing History Modal */}
      <Modal
        visible={showBillingHistoryModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowBillingHistoryModal(false);
          setAppointmentBillings([]);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
          <View style={{ flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24, paddingBottom: 32 }}>
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 24,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>
                    Appointment Billing History
                  </Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    View all bills for this appointment
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowBillingHistoryModal(false);
                    setAppointmentBillings([]);
                  }}
                >
                  <Text style={{ fontSize: 24, color: '#999', fontWeight: '300' }}>✕</Text>
                </TouchableOpacity>
              </View>

              {loadingBillingHistory ? (
                <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <ActivityIndicator size="large" color="#0b7fab" />
                </View>
              ) : appointmentBillings.length === 0 ? (
                <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 48, marginBottom: 8 }}>📋</Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 }}>
                    No Billing Records
                  </Text>
                  <Text style={{ fontSize: 13, color: '#666', textAlign: 'center' }}>
                    No billing records found for this appointment.
                  </Text>
                </View>
              ) : (
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 16 }}>
                    Records ({appointmentBillings.length})
                  </Text>
                  {appointmentBillings.map((bill) => (
                    <View
                      key={bill.id}
                      style={{
                        backgroundColor: '#f9f9f9',
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 12,
                        borderLeftWidth: 4,
                        borderLeftColor:
                          bill.payment_status === 'paid'
                            ? '#10b981'
                            : bill.payment_status === 'overdue'
                            ? '#ef4444'
                            : '#f59e0b',
                      }}
                    >
                      {/* Bill Header */}
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>
                            Bill #{bill.id?.slice(0, 8).toUpperCase()}
                          </Text>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: '#111', marginTop: 4 }}>
                            {bill.description || 'Service Charge'}
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor:
                              bill.payment_status === 'paid'
                                ? '#10b981'
                                : bill.payment_status === 'overdue'
                                ? '#ef4444'
                                : '#f59e0b',
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 6,
                            marginLeft: 8,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              color: '#fff',
                              fontWeight: '600',
                              textTransform: 'capitalize',
                            }}
                          >
                            {bill.payment_status}
                          </Text>
                        </View>
                      </View>

                      {/* Amount Section */}
                      <View
                        style={{
                          paddingVertical: 12,
                          borderTopWidth: 1,
                          borderBottomWidth: 1,
                          borderColor: '#e5e5e5',
                          marginBottom: 12,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                          <Text style={{ fontSize: 11, color: '#666' }}>Amount</Text>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#111' }}>
                            ${bill.amount.toFixed(2)}
                          </Text>
                        </View>
                        {bill.discount_amount && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text style={{ fontSize: 11, color: '#666' }}>
                              Discount ({bill.discount_type})
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#ef4444' }}>
                              -${bill.discount_amount.toFixed(2)}
                            </Text>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Final</Text>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: '#0b7fab' }}>
                            ${(bill.final_amount || bill.amount).toFixed(2)}
                          </Text>
                        </View>
                      </View>

                      {/* Payment Details */}
                      <View style={{ gap: 6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 11, color: '#666' }}>Created</Text>
                          <Text style={{ fontSize: 11, color: '#111', fontWeight: '500' }}>
                            {bill.created_at
                              ? new Date(bill.created_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })
                              : 'N/A'}
                          </Text>
                        </View>
                        {bill.payment_date && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, color: '#666' }}>Payment Date</Text>
                            <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '600' }}>
                              {new Date(bill.payment_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </Text>
                          </View>
                        )}
                        {bill.payment_method && (
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, color: '#666' }}>Method</Text>
                            <Text style={{ fontSize: 11, color: '#111', fontWeight: '500', textTransform: 'capitalize' }}>
                              {bill.payment_method}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Close Button */}
              <TouchableOpacity
                onPress={() => {
                  setShowBillingHistoryModal(false);
                  setAppointmentBillings([]);
                }}
                style={{
                  marginTop: 24,
                  paddingVertical: 14,
                  borderRadius: 10,
                  backgroundColor: '#0b7fab',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Status Edit Modal */}
      <Modal
        visible={showPaymentStatusModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowPaymentStatusModal(false);
          setSelectedBillingForEdit(null);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
          >
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24, paddingBottom: 32 }}>
              {/* Header */}
              <View style={{ marginBottom: 24 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>
                  Edit Payment Status
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  Bill #{selectedBillingForEdit?.id?.slice(0, 8).toUpperCase()}
                </Text>
              </View>

              {/* Amount Info */}
              {selectedBillingForEdit && (
                <View
                  style={{
                    backgroundColor: '#f9f9f9',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 24,
                    borderLeftWidth: 4,
                    borderLeftColor: '#0b7fab',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View>
                      <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Amount</Text>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0b7fab', marginTop: 4 }}>
                        ${(selectedBillingForEdit.final_amount || selectedBillingForEdit.amount).toFixed(2)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 11, color: '#666', fontWeight: '600' }}>Current Status</Text>
                      <View
                        style={{
                          backgroundColor: getPaymentStatusColor(selectedBillingForEdit.payment_status),
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 6,
                          marginTop: 4,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: '#fff',
                            textTransform: 'capitalize',
                          }}
                        >
                          {selectedBillingForEdit.payment_status}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}

              {/* Status Options */}
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 12 }}>
                Select New Status
              </Text>

              {['pending', 'paid', 'overdue'].map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => updatePaymentStatus(status as 'pending' | 'paid' | 'overdue')}
                  disabled={updatingPaymentStatus}
                  style={{
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: getPaymentStatusColor(status),
                    backgroundColor:
                      selectedBillingForEdit?.payment_status === status
                        ? getPaymentStatusColor(status)
                        : '#fff',
                    marginBottom: 12,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '600',
                        color:
                          selectedBillingForEdit?.payment_status === status ? '#fff' : '#111',
                        textTransform: 'capitalize',
                      }}
                    >
                      {status}
                    </Text>
                    {status === 'pending' && (
                      <Text
                        style={{
                          fontSize: 11,
                          color:
                            selectedBillingForEdit?.payment_status === status ? '#fff' : '#666',
                          marginTop: 2,
                        }}
                      >
                        Not yet paid
                      </Text>
                    )}
                    {status === 'paid' && (
                      <Text
                        style={{
                          fontSize: 11,
                          color:
                            selectedBillingForEdit?.payment_status === status ? '#fff' : '#666',
                          marginTop: 2,
                        }}
                      >
                        Payment received
                      </Text>
                    )}
                    {status === 'overdue' && (
                      <Text
                        style={{
                          fontSize: 11,
                          color:
                            selectedBillingForEdit?.payment_status === status ? '#fff' : '#666',
                          marginTop: 2,
                        }}
                      >
                        Payment overdue
                      </Text>
                    )}
                  </View>
                  {updatingPaymentStatus && selectedBillingForEdit?.payment_status === status && (
                    <ActivityIndicator
                      color={
                        selectedBillingForEdit?.payment_status === status ? '#fff' : '#0b7fab'
                      }
                    />
                  )}
                </TouchableOpacity>
              ))}

              {/* Close Button */}
              <TouchableOpacity
                onPress={() => {
                  setShowPaymentStatusModal(false);
                  setSelectedBillingForEdit(null);
                }}
                disabled={updatingPaymentStatus}
                style={{
                  marginTop: 12,
                  paddingVertical: 14,
                  borderRadius: 10,
                  backgroundColor: '#e5e5e5',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#333' }}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
