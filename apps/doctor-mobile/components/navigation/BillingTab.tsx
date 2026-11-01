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
import {
  FileText,
  X,
  ChevronDown,
  RefreshCw,
  Users,
  User,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Receipt,
  DollarSign,
  Calendar,
  Search,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppTour, { useTourTargets, TourStep } from '../tour/AppTour';
import { isDoctorGuideCompleted, markDoctorGuideCompleted, setDoctorGuideCompleted } from '../../lib/doctorService';
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
  startTourTrigger?: number;
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
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

const ITEMS_PER_PAGE = 4;

export default function BillingTab({ doctorId, styles, startTourTrigger }: BillingTabProps) {
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

  const totalPages = Math.max(1, Math.ceil(billings.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedBillings = billings.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // ─────────────────────────────────────────
  // INTERACTIVE BILLING WALKTHROUGH SYSTEM
  // ─────────────────────────────────────────
  const tour = useTourTargets();
  const [tourVisible, setTourVisible] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);

  const tourSteps: TourStep[] = [
    {
      id: "billing-welcome",
      title: "Welcome to Billing Ledger!",
      description: "Track your clinic's billing history, monitor paid versus pending invoices, review patient discounts, and configure digital payment gateways.",
      icon: Receipt,
      placement: "center",
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) { }
      },
    },
    {
      id: "billing-actions",
      target: "billing-actions",
      title: "Ledger Actions & Walkthrough",
      description: "Tap the refresh icon anytime to sync payments from Supabase, or launch this walkthrough tour anytime.",
      icon: Sparkles,
      padding: 6,
      radius: 12,
      placement: "bottom" as const,
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) { }
      },
    },
    {
      id: "billing-paymongo",
      target: "billing-paymongo",
      title: "PayMongo Payout Gateway",
      description: "Learn how to link your clinic's bank account, GCash, or Maya via PayMongo to receive direct automated settlements.",
      icon: CreditCard,
      padding: 6,
      radius: 14,
      placement: "bottom" as const,
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) { }
      },
    },
    {
      id: "billing-filter",
      target: "billing-filter",
      title: "Patient Ledger Filter",
      description: "Filter all invoices by specific patient to audit their personal statement of account, or reset to show all clinic records.",
      icon: Users,
      padding: 6,
      radius: 12,
      placement: "bottom" as const,
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 60, animated: false });
        } catch (e) { }
      },
    },
    {
      id: "billing-summary",
      target: "billing-summary",
      title: "Financial Ledger Summary",
      description: "At-a-glance financial health metrics: gross total billed, total settled payments, and pending outstanding balances.",
      icon: DollarSign,
      padding: 6,
      radius: 12,
      placement: "bottom" as const,
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 150, animated: false });
        } catch (e) { }
      },
    },
    ...(paginatedBillings.length > 0
      ? [
        {
          id: "billing-first-card",
          target: "billing-first-card",
          title: "Invoice & Payment Card",
          description: "Inspect invoice items, see original vs discounted amounts, payment method (Cash, GCash, Card), and tap appointment links to review details.",
          icon: Receipt,
          padding: 6,
          radius: 14,
          placement: "bottom" as const,
          onEnter: () => {
            try {
              scrollViewRef.current?.scrollTo?.({ y: 240, animated: false });
            } catch (e) { }
          },
        },
      ]
      : [
        {
          id: "billing-empty-state",
          target: "billing-empty-state",
          title: "Billing Ledger Records",
          description: "When treatments and appointments are billed, comprehensive invoice summaries will appear here for audit and tracking.",
          icon: FileText,
          padding: 8,
          radius: 8,
          placement: "bottom" as const,
          onEnter: () => {
            try {
              scrollViewRef.current?.scrollTo?.({ y: 220, animated: false });
            } catch (e) { }
          },
        },
      ]),
    ...(totalPages > 1
      ? [
        {
          id: "billing-pagination",
          target: "billing-pagination",
          title: "Ledger Pagination",
          description: "Navigate easily through multi-page billing records using numbered buttons or previous/next arrow controls.",
          icon: ChevronRight,
          padding: 6,
          radius: 12,
          placement: "auto" as const,
          onEnter: () => {
            try {
              scrollViewRef.current?.scrollToEnd?.({ animated: false });
            } catch (e) { }
          },
        },
      ]
      : []),
    {
      id: "billing-finish",
      title: "You're All Set, Doctor!",
      description: "Your billing ledger and financial tracking are ready. Manage clinic payments and patient billing with ease!",
      icon: ShieldCheck,
      placement: "center",
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) { }
      },
    },
  ];

  const handleStartTour = () => {
    setTourIndex(0);
    setTourVisible(true);
  };

  const handleFinishTour = async () => {
    setTourVisible(false);
    if (doctorId) {
      await markDoctorGuideCompleted(doctorId, "billing");
    }
  };

  const handleSkipTour = async () => {
    setTourVisible(false);
    if (doctorId) {
      await markDoctorGuideCompleted(doctorId, "billing");
    }
  };

  // Auto-prompt walkthrough on first visit to BillingTab
  useEffect(() => {
    if (!doctorId) return;

    let isMounted = true;
    const checkFirstTimeTour = async () => {
      try {
        const alreadyDone = await isDoctorGuideCompleted(doctorId, "billing");
        if (alreadyDone) return;

        const key = `@smileguard_doctor_billing_walkthrough_completed_${doctorId}`;
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
        console.error("Error checking billing walkthrough status:", err);
      }
    };

    checkFirstTimeTour();
    return () => {
      isMounted = false;
    };
  }, [doctorId]);

  // Support triggering walkthrough from parent (e.g. Settings tab)
  useEffect(() => {
    if (startTourTrigger && startTourTrigger > 0) {
      setTourIndex(0);
      setTourVisible(true);
    }
  }, [startTourTrigger]);

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
      if (record.payment_status === 'cancelled') return;
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

  const getPaymentStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return {
          bg: '#ECFDF5',
          text: '#047857',
          border: '#A7F3D0',
          label: 'PAID',
        };
      case 'overdue':
      case 'cancelled':
      case 'failed':
        return {
          bg: '#FEE2E2',
          text: '#DC2626',
          border: '#FECACA',
          label: status.toUpperCase(),
        };
      case 'not_paid':
      case 'pending':
      default:
        return {
          bg: '#FEF3C7',
          text: '#B45309',
          border: '#FDE68A',
          label: 'PENDING',
        };
    }
  };

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
        scrollViewRef.current?.scrollTo?.({ y: 0, animated: true });
      } catch (err) { }
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
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <View ref={tour.setContainer} collapsable={false} style={{ flex: 1 }}>
        {/* Module Top Header */}
        <View style={localStyles.topHeader}>
          <View style={localStyles.headerTitleGroup}>
            <Text style={localStyles.topHeaderTitle}>BILLING LEDGER</Text>
            <View style={localStyles.pillCountBadge}>
              <Text style={localStyles.pillCountText}>{billings.length}</Text>
            </View>
          </View>

          <View
            ref={tour.register("billing-actions")}
            collapsable={false}
            style={localStyles.headerActionsRow}
          >
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={loading}
              style={localStyles.skeuoActionBtn}
              activeOpacity={0.7}
              accessibilityLabel="Refresh Billing"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#047857" />
              ) : (
                <RefreshCw size={17} color="#047857" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleStartTour}
              style={localStyles.skeuoActionBtn}
              activeOpacity={0.7}
              accessibilityLabel="Start Walkthrough"
            >
              <Sparkles size={17} color="#047857" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >

          {/* PayMongo Onboarding & Guidelines Card */}
          <View ref={tour.register("billing-paymongo")} collapsable={false} style={{ marginBottom: 14 }}>
            <TouchableOpacity
              onPress={() => setShowPayMongoGuide(true)}
              style={localStyles.paymongoCard}
              activeOpacity={0.85}
            >
              <View style={localStyles.paymongoBevel} />
              <View style={localStyles.paymongoContent}>
                <View style={localStyles.paymongoIconBox}>
                  <CreditCard size={22} color="#34D399" />
                </View>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Text style={localStyles.paymongoTitle}>PayMongo Payout Guide</Text>
                    <View style={localStyles.paymongoBadge}>
                      <Text style={localStyles.paymongoBadgeText}>GUIDELINES</Text>
                    </View>
                  </View>
                  <Text style={localStyles.paymongoDesc}>
                    Step-by-step setup: BIR Form 2303, GCash/Maya & bank settlements.
                  </Text>
                </View>
                <View style={localStyles.paymongoActionBtn}>
                  <Text style={localStyles.paymongoActionBtnText}>Open</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Patient Selection Filter Card */}
          <View
            ref={tour.register("billing-filter")}
            collapsable={false}
            style={localStyles.skeuoCard}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Users size={14} color="#047857" />
                <Text style={localStyles.cardSectionHeader}>FILTER BY PATIENT</Text>
              </View>
              {selectedPatientId ? (
                <TouchableOpacity
                  onPress={() => handleSelectPatient(null)}
                  style={localStyles.showAllBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Text style={localStyles.showAllBtnText}>Show All</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => setShowPatientModal(true)}
              style={localStyles.patientSelectorBtn}
              activeOpacity={0.75}
            >
              <View style={{ flex: 1 }}>
                <Text style={localStyles.patientSelectorTitle}>
                  {selectedPatientName || 'All Patients'}
                </Text>
                <Text style={localStyles.patientSelectorSubtitle}>
                  {selectedPatientId
                    ? `Patient ID: ${selectedPatientId.slice(0, 8)}...`
                    : 'Showing all clinic ledger records'}
                </Text>
              </View>
              <View style={localStyles.selectorChevronBox}>
                <ChevronDown size={18} color="#047857" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Summary Cards */}
          <View ref={tour.register("billing-summary")} collapsable={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Total Card */}
              <View style={[localStyles.summaryCard, { borderTopColor: '#0284C7', borderTopWidth: 3 }]}>
                <Text style={localStyles.summaryLabel}>TOTAL BILLED</Text>
                <Text style={[localStyles.summaryValue, { color: '#0284C7' }]} numberOfLines={1} adjustsFontSizeToFit>
                  ₱{totalAmount.toFixed(2)}
                </Text>
              </View>

              {/* Paid Card */}
              <View style={[localStyles.summaryCard, { borderTopColor: '#047857', borderTopWidth: 3 }]}>
                <Text style={localStyles.summaryLabel}>PAID REVENUE</Text>
                <Text style={[localStyles.summaryValue, { color: '#047857' }]} numberOfLines={1} adjustsFontSizeToFit>
                  ₱{paidAmount.toFixed(2)}
                </Text>
              </View>

              {/* Pending Card */}
              <View style={[localStyles.summaryCard, { borderTopColor: '#DC2626', borderTopWidth: 3 }]}>
                <Text style={localStyles.summaryLabel}>PENDING</Text>
                <Text style={[localStyles.summaryValue, { color: '#DC2626' }]} numberOfLines={1} adjustsFontSizeToFit>
                  ₱{pendingAmount.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* Billings List */}
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Receipt size={14} color="#047857" />
                <Text style={localStyles.cardSectionHeader}>
                  BILLING INVOICES ({billings.length})
                </Text>
              </View>
              {selectedPatientName ? (
                <View style={localStyles.filterActivePill}>
                  <Text style={localStyles.filterActivePillText}>
                    {selectedPatientName}
                  </Text>
                </View>
              ) : null}
            </View>

            {loading ? (
              <View style={localStyles.loadingContainer}>
                <ActivityIndicator size="large" color="#047857" />
                <Text style={localStyles.loadingText}>Loading ledger records...</Text>
              </View>
            ) : billings.length === 0 ? (
              <View
                ref={tour.register("billing-empty-state")}
                collapsable={false}
                style={localStyles.emptyContainer}
              >
                <View style={localStyles.emptyIconBox}>
                  <FileText size={28} color="#047857" />
                </View>
                <Text style={localStyles.emptyTitle}>NO BILLING RECORDS</Text>
                <Text style={localStyles.emptySubtitle}>
                  {selectedPatientId
                    ? 'No billing records found for this patient yet.'
                    : 'No billing invoices recorded in the clinic ledger.'}
                </Text>
              </View>
            ) : (
              <>
                {/* Header count info */}
                <View style={localStyles.countHeader}>
                  <Text style={localStyles.countHeaderText}>
                    Showing <Text style={localStyles.countHeaderBold}>{startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, billings.length)}</Text> of <Text style={localStyles.countHeaderBold}>{billings.length}</Text> invoices
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
                  renderItem={({ item, index }) => {
                    const statusBadge = getPaymentStatusBadge(item.payment_status);
                    return (
                      <View
                        ref={index === 0 ? tour.register("billing-first-card") : undefined}
                        collapsable={false}
                        style={localStyles.billingCard}
                      >
                        {/* Header Row */}
                        <View style={localStyles.billingCardHeader}>
                          <View style={localStyles.billIdPill}>
                            <Text style={localStyles.billIdText}>
                              BILL #{item.id?.slice(0, 8).toUpperCase()}
                            </Text>
                          </View>
                          <View
                            style={[
                              localStyles.statusBadge,
                              { backgroundColor: statusBadge.bg, borderColor: statusBadge.border },
                            ]}
                          >
                            <Text style={[localStyles.statusBadgeText, { color: statusBadge.text }]}>
                              {statusBadge.label}
                            </Text>
                          </View>
                        </View>

                        {/* Patient Name */}
                        <View style={{ marginBottom: 10 }}>
                          <Text style={localStyles.patientNameText}>
                            {item.patient_name || 'Patient'}
                          </Text>
                        </View>

                        {/* Amount Box */}
                        <View style={localStyles.amountBox}>
                          <View>
                            <Text style={localStyles.amountLabel}>Original Amount</Text>
                            <Text style={localStyles.amountValue}>
                              ₱{item.amount.toFixed(2)}
                            </Text>
                          </View>

                          {item.discount_amount ? (
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={localStyles.amountLabel}>Discount ({item.discount_type})</Text>
                              <Text style={[localStyles.amountValue, { color: '#DC2626' }]}>
                                -₱{item.discount_amount.toFixed(2)}
                              </Text>
                            </View>
                          ) : null}

                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={localStyles.amountLabel}>Final Settled</Text>
                            <Text style={[localStyles.amountValue, { color: '#047857', fontWeight: '900' }]}>
                              ₱{(item.final_amount || item.amount).toFixed(2)}
                            </Text>
                          </View>
                        </View>

                        {/* Details */}
                        <View style={{ gap: 6, marginTop: 10 }}>
                          {item.appointment_id && (
                            <TouchableOpacity
                              onPress={() => loadAppointmentDetails(item.appointment_id!)}
                              activeOpacity={0.7}
                            >
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={localStyles.detailLabel}>Appointment</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Calendar size={12} color="#047857" />
                                  <Text style={localStyles.detailAppointmentLink}>
                                    #{item.appointment_id.slice(0, 8).toUpperCase()}
                                  </Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          )}

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={localStyles.detailLabel}>Issued</Text>
                            <Text style={localStyles.detailValue}>
                              {item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                            </Text>
                          </View>

                          {item.payment_date && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={localStyles.detailLabel}>Paid On</Text>
                              <Text style={localStyles.detailValue}>
                                {new Date(item.payment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </Text>
                            </View>
                          )}

                          {item.payment_method && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={localStyles.detailLabel}>Method</Text>
                              <Text style={[localStyles.detailValue, { textTransform: 'uppercase' }]}>
                                {item.payment_method}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    );
                  }}
                />

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <View ref={tour.register("billing-pagination")} collapsable={false} style={localStyles.paginationContainer}>
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
                      <ChevronLeft size={16} color={currentPage === 1 ? '#94A3B8' : '#047857'} />
                    </TouchableOpacity>

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
                      <ChevronRight size={16} color={currentPage === totalPages ? '#94A3B8' : '#047857'} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
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
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View style={localStyles.modalHeader}>
              <View>
                <Text style={localStyles.modalTitle}>SELECT PATIENT</Text>
                <Text style={localStyles.modalSubtitle}>Filter ledger entries by patient</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowPatientModal(false)}
                style={localStyles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="#047857" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              <View style={localStyles.searchContainer}>
                <Search size={16} color="#047857" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="Search by patient name..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={localStyles.searchInput}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={14} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <FlatList
              data={filteredPatients}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                !searchQuery ? (
                  <TouchableOpacity
                    onPress={() => handleSelectPatient(null)}
                    style={[
                      localStyles.patientModalItem,
                      !selectedPatientId && localStyles.patientModalItemActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={localStyles.patientModalItemName}>All Patients</Text>
                      <Text style={localStyles.patientModalItemEmail}>
                        View all billing records in the clinic ledger
                      </Text>
                    </View>
                    {!selectedPatientId && (
                      <View style={localStyles.checkPill}>
                        <Check size={14} color="#047857" />
                      </View>
                    )}
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item }) => {
                const isSelected = item.id === selectedPatientId;
                return (
                  <TouchableOpacity
                    onPress={() => handleSelectPatient(item)}
                    style={[
                      localStyles.patientModalItem,
                      isSelected && localStyles.patientModalItemActive,
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={localStyles.patientModalItemName}>{item.name}</Text>
                      <Text style={localStyles.patientModalItemEmail}>{item.email || 'No email'}</Text>
                    </View>
                    {isSelected && (
                      <View style={localStyles.checkPill}>
                        <Check size={14} color="#047857" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ fontSize: 14, color: '#64748B', fontWeight: '500' }}>
                    No patients with billing records found
                  </Text>
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
          <View style={localStyles.modalOverlay}>
            <SafeAreaView style={localStyles.appointmentModalCard}>
              <ScrollView
                contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20, paddingBottom: 32 }}
              >
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1.5, borderBottomColor: '#E2E8F0', paddingBottom: 12 }}>
                  <View>
                    <Text style={localStyles.modalTitle}>APPOINTMENT DETAILS</Text>
                    <Text style={localStyles.modalSubtitle}>Clinical booking & schedule info</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setShowAppointmentModal(false);
                      setSelectedAppointment(null);
                    }}
                    style={localStyles.modalCloseBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <X size={18} color="#047857" />
                  </TouchableOpacity>
                </View>

                {loadingAppointment ? (
                  <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                    <ActivityIndicator size="large" color="#047857" />
                  </View>
                ) : selectedAppointment ? (
                  <>
                    <View style={localStyles.skeuoCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={localStyles.amountLabel}>APPOINTMENT ID</Text>
                          <Text style={[localStyles.patientNameText, { marginTop: 2 }]}>
                            #{selectedAppointment.id.slice(0, 8).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={localStyles.amountLabel}>STATUS</Text>
                          <View
                            style={{
                              backgroundColor:
                                selectedAppointment.status === 'completed'
                                  ? '#ECFDF5'
                                  : selectedAppointment.status === 'cancelled'
                                    ? '#FEE2E2'
                                    : '#FEF3C7',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 4,
                              marginTop: 4,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '800',
                                color:
                                  selectedAppointment.status === 'completed'
                                    ? '#047857'
                                    : selectedAppointment.status === 'cancelled'
                                      ? '#DC2626'
                                      : '#B45309',
                                textTransform: 'uppercase',
                              }}
                            >
                              {selectedAppointment.status}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                        <View>
                          <Text style={localStyles.amountLabel}>SERVICE</Text>
                          <Text style={[localStyles.patientNameText, { fontSize: 14, marginTop: 2 }]}>
                            {selectedAppointment.service || 'General'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={localStyles.amountLabel}>PATIENT ID</Text>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#047857', marginTop: 2 }}>
                            #{selectedAppointment.patient_id.slice(0, 8).toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Date & Time */}
                    <View style={[localStyles.skeuoCard, { marginTop: 12 }]}>
                      <Text style={[localStyles.cardSectionHeader, { marginBottom: 10 }]}>SCHEDULED TIME</Text>
                      <View style={{ gap: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={localStyles.detailLabel}>Date</Text>
                          <Text style={localStyles.detailValue}>
                            {new Date(selectedAppointment.appointment_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={localStyles.detailLabel}>Time</Text>
                          <Text style={[localStyles.detailValue, { fontWeight: '700', color: '#047857' }]}>
                            {selectedAppointment.appointment_time}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Notes */}
                    {selectedAppointment.notes && (
                      <View style={[localStyles.skeuoCard, { marginTop: 12 }]}>
                        <Text style={[localStyles.cardSectionHeader, { marginBottom: 8 }]}>CLINICAL NOTES</Text>
                        <Text style={{ fontSize: 13, color: '#334155', lineHeight: 19 }}>
                          {selectedAppointment.notes}
                        </Text>
                      </View>
                    )}

                    {/* Close Button */}
                    <TouchableOpacity
                      onPress={() => {
                        setShowAppointmentModal(false);
                        setSelectedAppointment(null);
                      }}
                      style={localStyles.modalPrimaryBtn}
                      activeOpacity={0.8}
                    >
                      <Text style={localStyles.modalPrimaryBtnText}>Close</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
                    <Text style={{ fontSize: 14, color: '#64748B' }}>No appointment data available</Text>
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
    </View>
  );
}

const localStyles = StyleSheet.create({
  // Top Header Module Row
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.6,
  },
  pillCountBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pillCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skeuoActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // PayMongo Card
  paymongoCard: {
    backgroundColor: '#042F2E',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#022C22',
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  paymongoBevel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  paymongoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymongoIconBox: {
    width: 42,
    height: 42,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymongoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  paymongoBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  paymongoBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  paymongoDesc: {
    fontSize: 11,
    color: '#99F6E4',
    lineHeight: 15,
    marginTop: 2,
  },
  paymongoActionBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#047857',
  },
  paymongoActionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#022C22',
    textTransform: 'uppercase',
  },

  // Skeuomorphic Cards
  skeuoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 14,
    marginBottom: 14,
  },
  cardSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  showAllBtn: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  showAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  patientSelectorBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
  },
  patientSelectorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  patientSelectorSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  selectorChevronBox: {
    width: 28,
    height: 28,
    borderRadius: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Summary Cards
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 10,
  },
  summaryLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.3,
  },

  // Filter Pill
  filterActivePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  filterActivePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },

  // Loading & Empty States
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  emptyIconBox: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  // Count Header
  countHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  countHeaderText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  countHeaderBold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  pageBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pageBadgeText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '700',
  },

  // Billing Item Card
  billingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 12,
    marginBottom: 10,
  },
  billingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  billIdPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  billIdText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  patientNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  amountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginVertical: 4,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  detailLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '600',
  },
  detailAppointmentLink: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },

  // Pagination
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    gap: 8,
  },
  navButton: {
    width: 34,
    height: 34,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
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
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  pageButtonActive: {
    backgroundColor: '#047857',
    borderColor: '#064E3B',
    borderBottomWidth: 2.5,
    borderBottomColor: '#022C22',
  },
  pageButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
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

  // Modal Styles
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.6,
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    padding: 0,
  },
  patientModalItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientModalItemActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  patientModalItemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  patientModalItemEmail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  checkPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  appointmentModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '85%',
  },
  modalPrimaryBtn: {
    marginTop: 20,
    backgroundColor: '#047857',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#064E3B',
    borderBottomWidth: 3,
    borderBottomColor: '#022C22',
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
