import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  TextInput,
  Alert,
  StyleSheet,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@smileguard/supabase-client';
import { Billing } from '@smileguard/shared-types';

interface Patient {
  id: string;
  name: string;
  email: string;
}

interface BillingTabProps {
  doctorId: string;
  styles: any;
}

interface BillingWithPatientName extends Billing {
  patient_name?: string;
}

interface AppointmentDetails {
  id: string;
  patient_id: string;
  dentist_id: string | null;
  service: string;
  appointment_date: string;
  appointment_time: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export default function BillingTab({ doctorId, styles }: BillingTabProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedPatientName, setSelectedPatientName] = useState<string>('');
  const [billings, setBillings] = useState<BillingWithPatientName[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentDetails | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [loadingAppointment, setLoadingAppointment] = useState(false);

  // Fetch all patients associated with doctor
  useFocusEffect(
    React.useCallback(() => {
      loadPatients();
      return () => {};
    }, [])
  );

  const loadPatients = async () => {
    try {
      setLoading(true);
      
      // Get doctor's appointments to find associated patients
      let query = supabase
        .from('appointments')
        .select('patient_id');

      // Filter by dentist_id (which is the doctor's ID)
      query = query.eq('dentist_id', doctorId);

      const { data: appointments, error: appointmentError } = await query;

      if (appointmentError) {
        console.error('Error fetching appointments:', appointmentError);
        return;
      }

      // Get unique patient IDs from appointments
      const patientIds = [...new Set((appointments || []).map((a) => a.patient_id).filter(Boolean))];

      if (patientIds.length === 0) {
        setPatients([]);
        return;
      }

      // Fetch patient profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', patientIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        return;
      }

      const mappedPatients = (profiles || []).map((p) => ({
        id: p.id,
        name: p.name || 'Unknown',
        email: p.email || '',
      }));

      setPatients(mappedPatients);
    } catch (error) {
      console.error('Error loading patients:', error);
      Alert.alert('Error', 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  // Load billings for selected patient
  useEffect(() => {
    if (selectedPatientId) {
      loadPatientBillings();
    }
  }, [selectedPatientId]);

  const loadPatientBillings = async () => {
    try {
      setLoading(true);
      const { data: billingRecords, error } = await supabase
        .from('billings')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching billings:', error);
        Alert.alert('Error', 'Failed to load billings');
        return;
      }

      setBillings(billingRecords || []);
      calculateTotals(billingRecords || []);
    } catch (error) {
      console.error('Error loading billings:', error);
      Alert.alert('Error', 'Failed to load billings');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (records: Billing[]) => {
    let total = 0;
    let paid = 0;
    let pending = 0;

    records.forEach((record) => {
      const finalAmount = record.final_amount || record.amount;
      total += finalAmount;

      if (record.payment_status === 'paid') {
        paid += finalAmount;
      } else {
        pending += finalAmount;
      }
    });

    setTotalAmount(total);
    setPaidAmount(paid);
    setPendingAmount(pending);
  };

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setSelectedPatientName(patient.name);
    setShowPatientModal(false);
    setSearchQuery('');
  };

  // Refresh button handler - fetches latest patients and billings
  const handleRefresh = async () => {
    try {
      setLoading(true);
      console.log('🔄 Refreshing billing data...');
      
      // Refresh patients list
      await loadPatients();
      
      // If a patient is selected, refresh their billings too
      if (selectedPatientId) {
        await loadPatientBillings();
      }
      
      Alert.alert('✅ Refreshed', 'Billing data updated successfully!');
    } catch (error) {
      console.error('❌ Error refreshing billing data:', error);
      Alert.alert('❌ Error', 'Failed to refresh billing data. Please try again.');
    } finally {
      setLoading(false);
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

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16, gap: 16 }}>
          {/* Header */}
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#111', marginBottom: 4 }}>
              Billing Ledger
            </Text>
            <Text style={{ fontSize: 13, color: '#666' }}>
              Manage patient billings and payment statuses
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
            {/* Refresh Button */}
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={loading}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: loading ? '#ccc' : '#0b7fab',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600' }}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Patient Selection Card */}
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: 12,
              padding: 14,
              borderLeftWidth: 4,
              borderLeftColor: '#0b7fab',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 8 }}>
              SELECTED PATIENT
            </Text>
            <TouchableOpacity
              onPress={() => setShowPatientModal(true)}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 12,
                backgroundColor: '#f0f9ff',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#0b7fab',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#111' }}>
                  {selectedPatientName || 'Select Patient'}
                </Text>
                {selectedPatientId && (
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>ID: {selectedPatientId.slice(0, 8)}...</Text>
                )}
              </View>
              <Text style={{ fontSize: 20, color: '#0b7fab' }}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Summary Cards */}
          {selectedPatientId && (
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
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

          {/* Billings List */}
          {selectedPatientId ? (
            <>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 12 }}>
                  Billing Records ({billings.length})
                </Text>

                {loading ? (
                  <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="large" color="#0b7fab" />
                  </View>
                ) : billings.length === 0 ? (
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
                      No Billings
                    </Text>
                    <Text style={{ fontSize: 13, color: '#666', textAlign: 'center' }}>
                      No billing records found for this patient yet.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    scrollEnabled={false}
                    data={billings}
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
                            <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600', textTransform: 'capitalize' }}>
                              {item.payment_status}
                            </Text>
                          </View>
                        </View>

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
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontSize: 11, color: '#666' }}>Discount ({item.discount_type})</Text>
                              <Text style={{ fontSize: 16, fontWeight: '700', color: '#ef4444', marginTop: 2 }}>
                                -${item.discount_amount.toFixed(2)}
                              </Text>
                            </View>
                          ) : null}

                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 11, color: '#666' }}>Final Amount</Text>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0b7fab', marginTop: 2 }}>
                              ${(item.final_amount || item.amount).toFixed(2)}
                            </Text>
                          </View>
                        </View>

                        {/* Details */}
                        <View style={{ gap: 6 }}>
                          {item.appointment_id && (
                            <TouchableOpacity 
                              onPress={() => loadAppointmentDetails(item.appointment_id!)}
                              activeOpacity={0.7}
                            >
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ fontSize: 11, color: '#666' }}>Appointment</Text>
                                <Text style={{ fontSize: 11, color: '#0b7fab', fontWeight: '600', textDecorationLine: 'underline' }}>
                                  {item.appointment_id.slice(0, 8).toUpperCase()}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          )}

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 11, color: '#666' }}>Created</Text>
                            <Text style={{ fontSize: 11, color: '#111', fontWeight: '500' }}>
                              {item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                            </Text>
                          </View>

                          {item.payment_date && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 11, color: '#666' }}>Payment Date</Text>
                              <Text style={{ fontSize: 11, color: '#111', fontWeight: '500' }}>
                                {new Date(item.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                              </Text>
                            </View>
                          )}

                          {item.payment_method && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 11, color: '#666' }}>Method</Text>
                              <Text style={{ fontSize: 11, color: '#111', fontWeight: '500', textTransform: 'capitalize' }}>
                                {item.payment_method}
                              </Text>
                            </View>
                          )}
                        </View>

                      </View>
                    )}
                  />
                )}
              </View>
            </>
          ) : (
            <View
              style={{
                backgroundColor: '#fff',
                borderRadius: 12,
                padding: 24,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 }}>
                Select a Patient
              </Text>
              <Text style={{ fontSize: 13, color: '#666', textAlign: 'center' }}>
                Choose a patient from the list to view their billing information
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Patient Selection Modal */}
      <Modal
        visible={showPatientModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPatientModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>Select Patient</Text>
              <TouchableOpacity onPress={() => setShowPatientModal(false)}>
                <Text style={{ fontSize: 18, color: '#0b7fab', fontWeight: '600' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Search by name or email..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                marginBottom: 16,
              }}
            />
          </View>

          <FlatList
            data={filteredPatients}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleSelectPatient(item)}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 12,
                  borderLeftWidth: 3,
                  borderLeftColor: '#0b7fab',
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#111' }}>{item.name}</Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{item.email}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 16, color: '#666' }}>No patients found</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

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
          <SafeAreaView style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 24, paddingBottom: 32 }}
            >
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>Appointment Details</Text>
                  <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>View appointment information</Text>
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

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e5e5' }}>
                      <View>
                        <Text style={{ fontSize: 11, color: '#666', fontWeight: '600', marginTop: 8 }}>Service</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#111', marginTop: 4 }}>
                          {selectedAppointment.service || 'General'}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 11, color: '#666', fontWeight: '600', marginTop: 8 }}>Patient ID</Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#0b7fab', marginTop: 4 }}>
                          {selectedAppointment.patient_id.slice(0, 8).toUpperCase()}
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
                      Created: {selectedAppointment.created_at
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
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
