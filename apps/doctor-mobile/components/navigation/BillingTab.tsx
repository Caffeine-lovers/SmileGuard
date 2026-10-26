import React, { useState, useEffect, useRef } from 'react';
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
import { FileText, X, ChevronDown, RefreshCw, Users, User, Check, ChevronLeft, ChevronRight, CreditCard, ShieldCheck, Sparkles } from 'lucide-react-native';
import PayMongoDoctorGuideModal from '../billing/PayMongoDoctorGuideModal';
import { AppColors } from '../../constants/theme';

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

const ITEMS_PER_PAGE = 4;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [showPayMongoGuide, setShowPayMongoGuide] = useState(false);
  const scrollViewRef = useRef<any>(null);

  // Fetch all patients and billings on screen focus
  useFocusEffect(
    React.useCallback(() => {
      let isMounted = true;

      const initData = async () => {
        try {
          const loadedPatients = await loadPatients();
          if (isMounted) {
            await loadBillings(selectedPatientId, loadedPatients);
          }
        } catch (err) {
          console.error('Error initializing billing data on focus:', err);
        }
      };

      initData();

      return () => {
        isMounted = false;
      };
    }, [selectedPatientId, doctorId])
  );

  const loadPatients = async (): Promise<Patient[]> => {
    try {
      // 1. Query billings to get all unique patient IDs with existing billings
      const { data: billingPatientData, error: billingError } = await supabase
        .from('billings')
        .select('patient_id');

      if (billingError) {
        console.error('Error fetching billing patient IDs:', billingError);
      }

      const uniquePatientIds = [
        ...new Set((billingPatientData || []).map((b: any) => b.patient_id).filter(Boolean)),
      ];

      if (uniquePatientIds.length === 0) {
        setPatients([]);
        return [];
      }

      // 2. Fetch profiles only for patients who have billings
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', uniquePatientIds);

      if (profileError) {
        console.error('Error fetching profiles for billing patients:', profileError);
      }

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      const mappedPatients: Patient[] = uniquePatientIds
        .map((id) => {
          const profile = profileMap.get(id);
          return {
            id,
            name: profile?.name || `Patient (${id.slice(0, 8)})`,
            email: profile?.email || '',
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      setPatients(mappedPatients);
      return mappedPatients;
    } catch (error) {
      console.error('Error loading patients with billings:', error);
      return [];
    }
  };

  // Load billings for selected patient or all patients
  const loadBillings = async (targetPatientId?: string, currentPatients?: Patient[]) => {
    try {
      setLoading(true);
      const activePatientId = targetPatientId !== undefined ? targetPatientId : selectedPatientId;

      let query = supabase
        .from('billings')
        .select('*')
        .order('created_at', { ascending: false });

      if (activePatientId) {
        query = query.eq('patient_id', activePatientId);
      }

      const { data: billingRecords, error } = await query;

      if (error) {
        console.error('Error fetching billings:', error);
        Alert.alert('Error', 'Failed to load billings');
        return;
      }

      const records = billingRecords || [];

      // Build patient name lookup map
      const patientPool = currentPatients || patients;
      const patientMap = new Map<string, string>();
      patientPool.forEach((p) => {
        patientMap.set(p.id, p.name);
      });

      // Find any patient_id in billings not yet in map
      const missingIds = records
        .map((b) => b.patient_id)
        .filter((id) => id && !patientMap.has(id));

      if (missingIds.length > 0) {
        const uniqueMissing = [...new Set(missingIds)];
        const { data: missingProfiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', uniqueMissing);

        (missingProfiles || []).forEach((p) => {
          patientMap.set(p.id, p.name || 'Unknown Patient');
        });
      }

      const billingsWithNames: BillingWithPatientName[] = records.map((b) => ({
        ...b,
        patient_name: patientMap.get(b.patient_id) || (b.patient_id ? `Patient (${b.patient_id.slice(0, 8)})` : 'Unknown Patient'),
      }));

      setBillings(billingsWithNames);
      calculateTotals(billingsWithNames);
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
      const finalAmount = record.final_amount ?? record.amount ?? 0;
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

  const handleSelectPatient = (patient: Patient | null) => {
    setCurrentPage(1);
    if (patient) {
      setSelectedPatientId(patient.id);
      setSelectedPatientName(patient.name);
      loadBillings(patient.id);
    } else {
      setSelectedPatientId('');
      setSelectedPatientName('');
      loadBillings('');
    }
    setShowPatientModal(false);
    setSearchQuery('');
  };

  // Refresh button handler - fetches latest patients and billings
  const handleRefresh = async () => {
    try {
      setLoading(true);
      setCurrentPage(1);
      console.log('🔄 Refreshing billing data...');
      const loadedPatients = await loadPatients();
      await loadBillings(selectedPatientId, loadedPatients);
      Alert.alert('Refreshed', 'Billing data updated successfully!');
    } catch (error) {
      console.error('Error refreshing billing data:', error);
      Alert.alert('Error', 'Failed to refresh billing data. Please try again.');
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

  const totalPages = Math.max(1, Math.ceil(billings.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedBillings = billings.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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
        // safe fallback if scrollTo is not supported on ref
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

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16, gap: 16 }}>
          {/* Header */}
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 24, fontWeight: '700', color: '#111', marginBottom: 4 }}>
              Billing Ledger
            </Text>
            <Text style={{ fontSize: 13, color: '#666' }}>
              Manage patient billings and payment statuses
            </Text>
          </View>

          {/* PayMongo Onboarding & Guidelines Card */}
          <TouchableOpacity
            onPress={() => setShowPayMongoGuide(true)}
            style={{
              backgroundColor: '#042F2E',
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: '#0D9488',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#115E59', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={22} color="#34D399" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>PayMongo Payout Guide</Text>
                  <View style={{ backgroundColor: '#059669', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFFFFF' }}>GUIDELINES</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: '#99F6E4', lineHeight: 16 }}>
                  Step-by-step setup: BIR Form 2303, GCash/Maya & direct bank settlements.
                </Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#10B981', borderRadius: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#042F2E' }}>Open Steps</Text>
            </View>
          </TouchableOpacity>

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
                backgroundColor: loading ? '#ccc' : '#10B981',
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
              borderLeftColor: '#10B981',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666' }}>
                FILTER BY PATIENT
              </Text>
              {selectedPatientId ? (
                <TouchableOpacity onPress={() => handleSelectPatient(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={{ fontSize: 12, color: '#10B981', fontWeight: '600' }}>Show All</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => setShowPatientModal(true)}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 12,
                backgroundColor: '#f0f9ff',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#10B981',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#111' }}>
                  {selectedPatientName || 'All'}
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  {selectedPatientId
                    ? `ID: ${selectedPatientId.slice(0, 8)}...`
                    : 'Showing all billing records'}
                </Text>
              </View>
              <Text style={{ fontSize: 20, color: "#047857", marginLeft: 8 }}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Summary Cards */}
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

          {/* Billings List */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#111' }}>
                Billing Records ({billings.length})
              </Text>
              {selectedPatientName ? (
                <Text style={{ fontSize: 12, color: '#10B981', fontWeight: '600' }}>
                  Filtered: {selectedPatientName}
                </Text>
              ) : (
                <Text style={{ fontSize: 12, color: '#666' }}>
                  All Patients
                </Text>
              )}
            </View>

            {loading ? (
              <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                <ActivityIndicator size="large" color="#10B981" />
              </View>
            ) : billings.length === 0 ? (
              <View
                style={{
                  backgroundColor: '#E6ECEF',
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderTopColor: '#FFFFFF',
                  borderLeftColor: '#FFFFFF',
                  borderBottomColor: '#B0BAC5',
                  borderRightColor: '#B0BAC5',
                  padding: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileText size={44} color={AppColors.textMuted} style={{ marginBottom: 12 }} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: AppColors.textPrimary, marginBottom: 4 }}>
                  No Billings Found
                </Text>
                <Text style={{ fontSize: 13, color: AppColors.textSecondary, textAlign: 'center' }}>
                  {selectedPatientId
                    ? 'No billing records found for this patient yet.'
                    : 'No billing records found in the clinic ledger.'}
                </Text>
              </View>
            ) : (
              <>
                {/* Header info showing billing count and page */}
                <View style={localStyles.countHeader}>
                  <Text style={localStyles.countHeaderText}>
                    Showing <Text style={localStyles.countHeaderBold}>{startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, billings.length)}</Text> of <Text style={localStyles.countHeaderBold}>{billings.length}</Text> records
                  </Text>
                  {totalPages > 1 && (
                    <View style={localStyles.pageBadge}>
                      <Text style={localStyles.pageBadgeText}>
                        Page {currentPage} of {totalPages}
                      </Text>
                    </View>
                  )}
                </View>

                <FlatList
                  scrollEnabled={false}
                  data={paginatedBillings}
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
                          marginBottom: 6,
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

                      {/* Patient Name */}
                      <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>
                          {item.patient_name || 'Patient'}
                        </Text>
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
                          <Text style={{ fontSize: 16, fontWeight: '700', color: "#047857", marginTop: 2 }}>
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
                              <Text style={{ fontSize: 11, color: "#047857", fontWeight: '600', textDecorationLine: 'underline' }}>
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

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <View style={localStyles.paginationContainer}>
                    {/* Previous Button */}
                    <TouchableOpacity
                      style={[
                        localStyles.navButton,
                        currentPage === 1 && localStyles.navButtonDisabled,
                      ]}
                      onPress={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      activeOpacity={0.7}
                      accessibilityLabel="Previous Page"
                    >
                      <ChevronLeft size={18} color={currentPage === 1 ? '#94A3B8' : '#047857'} />
                    </TouchableOpacity>

                    {/* Page Numbers */}
                    <View style={localStyles.pageNumbersRow}>
                      {getPageNumbers().map((pageNum, index) => {
                        if (pageNum === '...') {
                          return (
                            <View key={`ellipsis-${index}`} style={localStyles.ellipsisBox}>
                              <Text style={localStyles.ellipsisText}>•••</Text>
                            </View>
                          );
                        }
                        const isSelected = pageNum === currentPage;
                        return (
                          <TouchableOpacity
                            key={`page-${pageNum}`}
                            style={[
                              localStyles.pageButton,
                              isSelected && localStyles.pageButtonActive,
                            ]}
                            onPress={() => handlePageChange(pageNum as number)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                localStyles.pageButtonText,
                                isSelected && localStyles.pageButtonTextActive,
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
                        localStyles.navButton,
                        currentPage === totalPages && localStyles.navButtonDisabled,
                      ]}
                      onPress={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      activeOpacity={0.7}
                      accessibilityLabel="Next Page"
                    >
                      <ChevronRight size={18} color={currentPage === totalPages ? '#94A3B8' : '#047857'} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
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
              <TouchableOpacity onPress={() => setShowPatientModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color={AppColors.primary} />
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
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              !searchQuery ? (
                <TouchableOpacity
                  onPress={() => handleSelectPatient(null)}
                  style={{
                    backgroundColor: !selectedPatientId ? '#ecfdf5' : '#fff',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: !selectedPatientId ? '#047857' : '#10B981',
                    borderWidth: !selectedPatientId ? 1.5 : 0,
                    borderColor: !selectedPatientId ? '#10B981' : 'transparent',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111' }}>
                      All
                    </Text>
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                      View all billing records in the clinic ledger
                    </Text>
                  </View>
                  {!selectedPatientId && <Check size={20} color="#10B981" />}
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => {
              const isSelected = item.id === selectedPatientId;
              return (
                <TouchableOpacity
                  onPress={() => handleSelectPatient(item)}
                  style={{
                    backgroundColor: isSelected ? '#ecfdf5' : '#fff',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: isSelected ? '#047857' : '#10B981',
                    borderWidth: isSelected ? 1 : 0,
                    borderColor: isSelected ? '#10B981' : 'transparent',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111' }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{item.email || 'No email'}</Text>
                  </View>
                  {isSelected && <Check size={20} color="#10B981" />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Text style={{ fontSize: 16, color: '#666' }}>No patients with billing records found</Text>
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
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={22} color={AppColors.textMuted} />
                </TouchableOpacity>
              </View>

              {loadingAppointment ? (
                <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                  <ActivityIndicator size="large" color="#10B981" />
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
                      borderLeftColor: '#10B981',
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
                                    : '#10B981',
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
                        <Text style={{ fontSize: 12, fontWeight: '600', color: "#047857", marginTop: 4 }}>
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
                          borderLeftColor: '#10B981',
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
                      backgroundColor: '#10B981',
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

      {/* PayMongo Doctor Onboarding & Guidelines Modal */}
      <PayMongoDoctorGuideModal
        visible={showPayMongoGuide}
        onClose={() => setShowPayMongoGuide(false)}
      />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  countHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  countHeaderText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  countHeaderBold: {
    fontWeight: '700',
    color: '#1E293B',
  },
  pageBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pageBadgeText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    gap: 8,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  navButtonDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  pageNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pageButton: {
    minWidth: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pageButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  pageButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  pageButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
