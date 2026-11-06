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
  KeyboardAvoidingView,
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
  Pencil,
  Plus,
  Tag,
  AlertCircle,
  Percent,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppTour, { useTourTargets, TourStep } from '../tour/AppTour';
import { isDoctorGuideCompleted, markDoctorGuideCompleted, setDoctorGuideCompleted } from '../../lib/doctorService';
import { AppColors } from '../../constants/theme';

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '₱0.00';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
  if (isNaN(num)) return '₱0.00';
  return `₱${num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface Patient {
  id: string;
  name: string;
  email: string;
  is_dummy?: boolean;
}

interface BillingTabProps {
  doctorId: string;
  styles: any;
  startTourTrigger?: number;
  userRole?: string;
  refreshTrigger?: number;
}

interface BillingWithPatientName extends Billing {
  patient_name?: string;
  patient_email?: string;
  is_dummy?: boolean;
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

export default function BillingTab({ doctorId, styles, startTourTrigger, userRole, refreshTrigger }: BillingTabProps) {
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
  const scrollViewRef = useRef<any>(null);

  // Edit Dummy Billing State
  const [editingBilling, setEditingBilling] = useState<BillingWithPatientName | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editDiscountType, setEditDiscountType] = useState<string>('none');
  const [editDiscountAmount, setEditDiscountAmount] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<string>('not_paid');
  const [editPaymentMethod, setEditPaymentMethod] = useState('cash');
  const [savingEdit, setSavingEdit] = useState(false);

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
      id: "billing-filter",
      target: "billing-filter",
      title: "Patient Ledger Filter",
      description: "Filter invoices by a specific patient to view their payment history, or reset to show all clinic records.",
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
      description: "Quick summary of your clinic billing: total billed, total paid payments, and remaining balances.",
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
          title: "Invoice Details & Dummy Editing",
          description: "Inspect invoice items, settlement status, discounts, and edit billing details directly for dummy walk-in patients.",
          icon: Receipt,
          padding: 6,
          radius: 12,
          placement: "bottom" as const,
          onEnter: () => {
            try {
              scrollViewRef.current?.scrollTo?.({ y: 280, animated: false });
            } catch (e) { }
          },
        },
      ]
      : [
        {
          id: "billing-empty-state",
          target: "billing-empty-state",
          title: "Clinic Invoices",
          description: "Once your clinic records invoices and treatments, they will appear chronologically here.",
          icon: FileText,
          padding: 8,
          radius: 12,
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
          description: "Navigate easily through multiple pages of billing and invoice records.",
          icon: ChevronRight,
          padding: 6,
          radius: 12,
          placement: "bottom" as const,
          onEnter: () => {
            try {
              scrollViewRef.current?.scrollToEnd?.({ animated: false });
            } catch (e) { }
          },
        },
      ]
      : []),
  ];

  const handleFinishTour = async () => {
    setTourVisible(false);
    try {
      await markDoctorGuideCompleted(doctorId, "billing");
    } catch (e) {
      console.warn("Could not mark billing walkthrough as completed:", e);
    }
  };

  const handleSkipTour = async () => {
    setTourVisible(false);
    try {
      await markDoctorGuideCompleted(doctorId, "billing");
    } catch (e) {
      console.warn("Could not mark billing walkthrough as completed:", e);
    }
  };

  const handleRestartTour = () => {
    setTourIndex(0);
    setTourVisible(true);
  };

  useEffect(() => {
    let isMounted = true;
    const checkFirstTimeTour = async () => {
      try {
        const completed = await isDoctorGuideCompleted(doctorId, "billing");
        if (!completed && isMounted) {
          const timer = setTimeout(async () => {
            const freshCheck = await isDoctorGuideCompleted(doctorId, "billing");
            if (!freshCheck && isMounted) {
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

  // Support triggering walkthrough from parent (e.g. Settings tab or top bar Guide)
  useEffect(() => {
    if (startTourTrigger && startTourTrigger > 0) {
      setTourIndex(0);
      setTourVisible(true);
    }
  }, [startTourTrigger]);

  // Support triggering refresh from parent (top bar Refresh or tab switch)
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      handleRefresh();
    }
  }, [refreshTrigger]);

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

      // 2. Fetch profiles for patients with billings
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', uniquePatientIds.length > 0 ? uniquePatientIds : ['00000000-0000-0000-0000-000000000000']);

      if (profileError) {
        console.error('Error fetching profiles for billing patients:', profileError);
      }

      // 3. Fetch all dummy patients so they are available in filter and billing creation
      const { data: dummyPatients, error: dummyError } = await supabase
        .from('dummy_patients')
        .select('id, name, email');

      if (dummyError) {
        console.error('Error fetching dummy patients for billing:', dummyError);
      }

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      const dummyMap = new Map((dummyPatients || []).map((d) => [d.id, d]));

      const patientList: Patient[] = [];

      // Registered Patients
      (profiles || []).forEach((p) => {
        patientList.push({
          id: p.id,
          name: p.name || `Patient (${p.id.slice(0, 8)})`,
          email: p.email || '',
          is_dummy: false,
        });
      });

      // Dummy Patients
      (dummyPatients || []).forEach((d) => {
        patientList.push({
          id: d.id,
          name: d.name || `Walk-in Patient (${d.id.slice(0, 8)})`,
          email: d.email || '',
          is_dummy: true,
        });
      });

      // Any remaining IDs from billings
      uniquePatientIds.forEach((id) => {
        if (!profileMap.has(id) && !dummyMap.has(id)) {
          patientList.push({
            id,
            name: `Patient (${id.slice(0, 8)})`,
            email: '',
            is_dummy: false,
          });
        }
      });

      patientList.sort((a, b) => a.name.localeCompare(b.name));
      setPatients(patientList);
      return patientList;
    } catch (error) {
      console.error('Error loading patients:', error);
      return [];
    }
  };

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

      // Build patient lookup map
      const patientPool = currentPatients || patients;
      const patientInfoMap = new Map<string, { name: string; email: string; is_dummy: boolean }>();

      patientPool.forEach((p) => {
        patientInfoMap.set(p.id, {
          name: p.name,
          email: p.email,
          is_dummy: !!p.is_dummy,
        });
      });

      // Check any missing IDs in both profiles and dummy_patients
      const missingIds = records
        .map((b) => b.patient_id || b.dummy_patient_id)
        .filter((id) => id && !patientInfoMap.has(id));

      if (missingIds.length > 0) {
        const uniqueMissing = [...new Set(missingIds)];
        const [profilesRes, dummiesRes] = await Promise.all([
          supabase.from('profiles').select('id, name, email').in('id', uniqueMissing),
          supabase.from('dummy_patients').select('id, name, email').in('id', uniqueMissing),
        ]);

        (profilesRes.data || []).forEach((p) => {
          patientInfoMap.set(p.id, { name: p.name || 'Unknown Patient', email: p.email || '', is_dummy: false });
        });
        (dummiesRes.data || []).forEach((d) => {
          patientInfoMap.set(d.id, { name: d.name || 'Walk-in Patient', email: d.email || '', is_dummy: true });
        });
      }

      const billingsWithNames: BillingWithPatientName[] = records.map((b) => {
        const targetId = b.patient_id || b.dummy_patient_id;
        const info = patientInfoMap.get(targetId);
        return {
          ...b,
          patient_name: info?.name || (targetId ? `Patient (${targetId.slice(0, 8)})` : 'Unknown Patient'),
          patient_email: info?.email || '',
          is_dummy: info?.is_dummy ?? !!b.dummy_patient_id,
        };
      });

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

  // Refresh button handler
  const handleRefresh = async () => {
    try {
      setLoading(true);
      setCurrentPage(1);
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

  // ─────────────────────────────────────────
  // DUMMY BILLING EDITING LOGIC
  // ─────────────────────────────────────────
  const handleOpenEditModal = (item: BillingWithPatientName) => {
    setEditingBilling(item);
    setEditAmount(item.amount ? item.amount.toString() : '');
    setEditDiscountType(item.discount_type || 'none');
    setEditDiscountAmount(item.discount_amount ? item.discount_amount.toString() : '0');
    setEditPaymentStatus(item.payment_status || 'not_paid');
    setEditPaymentMethod(item.payment_method || 'cash');
    setShowEditModal(true);
  };

  const handleEditDiscountTypeChange = (type: string) => {
    setEditDiscountType(type);
    const numAmount = parseFloat(editAmount) || 0;
    if (type === 'pwd' || type === 'senior') {
      const disc = (numAmount * 0.20).toFixed(2);
      setEditDiscountAmount(disc);
    } else if (type === 'none') {
      setEditDiscountAmount('0');
    }
  };

  const handleEditAmountChange = (text: string) => {
    setEditAmount(text);
    const numAmount = parseFloat(text) || 0;
    if (editDiscountType === 'pwd' || editDiscountType === 'senior') {
      const disc = (numAmount * 0.20).toFixed(2);
      setEditDiscountAmount(disc);
    }
  };

  const handleSaveEditDummyBilling = async () => {
    if (!editingBilling) return;
    const parsedAmount = parseFloat(editAmount) || 0;
    const parsedDiscount = parseFloat(editDiscountAmount) || 0;

    if (parsedAmount <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid billing amount greater than 0.');
      return;
    }

    const computedFinal = Math.max(0, parsedAmount - parsedDiscount);
    const paymentDate = editPaymentStatus === 'paid'
      ? (editingBilling.payment_date || new Date().toISOString())
      : null;

    try {
      setSavingEdit(true);

      // Attempt secure RPC first
      const { error: rpcError } = await supabase.rpc('update_dummy_billing', {
        p_billing_id: editingBilling.id,
        p_amount: parsedAmount,
        p_discount_type: editDiscountType,
        p_discount_amount: parsedDiscount,
        p_final_amount: computedFinal,
        p_payment_status: editPaymentStatus,
        p_payment_method: editPaymentMethod || null,
        p_payment_date: paymentDate,
      });

      if (rpcError) {
        console.warn('RPC update_dummy_billing failed, attempting direct table update:', rpcError);
        // Fallback to direct update
        const { error: directError } = await supabase
          .from('billings')
          .update({
            amount: parsedAmount,
            discount_type: editDiscountType,
            discount_amount: parsedDiscount,
            final_amount: computedFinal,
            payment_status: editPaymentStatus,
            payment_method: editPaymentMethod || null,
            payment_date: paymentDate,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingBilling.id);

        if (directError) {
          throw directError;
        }
      }

      Alert.alert('Success', 'Dummy patient billing record updated successfully!');
      setShowEditModal(false);
      setEditingBilling(null);
      await loadBillings();
    } catch (err: any) {
      console.error('Error saving dummy billing update:', err);
      Alert.alert('Update Failed', err.message || 'Could not update dummy billing record.');
    } finally {
      setSavingEdit(false);
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

  const dummyPatientsList = patients.filter((p) => p.is_dummy);

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
        </View>

        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >

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

          {/* Summary Cards with formatted comma currency */}
          <View ref={tour.register("billing-summary")} collapsable={false} style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {/* Total Card */}
              <View style={[localStyles.summaryCard, { borderTopColor: '#0284C7', borderTopWidth: 3 }]}>
                <Text style={localStyles.summaryLabel}>TOTAL BILLED</Text>
                <Text style={[localStyles.summaryValue, { color: '#0284C7' }]} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(totalAmount)}
                </Text>
              </View>

              {/* Paid Card */}
              <View style={[localStyles.summaryCard, { borderTopColor: '#047857', borderTopWidth: 3 }]}>
                <Text style={localStyles.summaryLabel}>PAID REVENUE</Text>
                <Text style={[localStyles.summaryValue, { color: '#047857' }]} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(paidAmount)}
                </Text>
              </View>

              {/* Pending Card */}
              <View style={[localStyles.summaryCard, { borderTopColor: '#DC2626', borderTopWidth: 3 }]}>
                <Text style={localStyles.summaryLabel}>PENDING</Text>
                <Text style={[localStyles.summaryValue, { color: '#DC2626' }]} numberOfLines={1} adjustsFontSizeToFit>
                  {formatCurrency(pendingAmount)}
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
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <View style={localStyles.billIdPill}>
                              <Text style={localStyles.billIdText}>
                                BILL #{item.id?.slice(0, 8).toUpperCase()}
                              </Text>
                            </View>
                            {item.is_dummy && (
                              <View style={localStyles.dummyBadgePill}>
                                <Text style={localStyles.dummyBadgeText}>WALK-IN</Text>
                              </View>
                            )}
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
                          {item.patient_email ? (
                            <Text style={localStyles.patientSubEmailText}>{item.patient_email}</Text>
                          ) : null}
                        </View>

                        {/* Amount Box formatted with commas */}
                        <View style={localStyles.amountBox}>
                          <View>
                            <Text style={localStyles.amountLabel}>Original Amount</Text>
                            <Text style={localStyles.amountValue}>
                              {formatCurrency(item.amount)}
                            </Text>
                          </View>

                          {item.discount_amount ? (
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={localStyles.amountLabel}>Discount ({item.discount_type})</Text>
                              <Text style={[localStyles.amountValue, { color: '#DC2626' }]}>
                                -{formatCurrency(item.discount_amount)}
                              </Text>
                            </View>
                          ) : null}

                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={localStyles.amountLabel}>Final Settled</Text>
                            <Text style={[localStyles.amountValue, { color: '#047857', fontWeight: '900' }]}>
                              {formatCurrency(item.final_amount ?? item.amount)}
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

                        {/* EDIT BUTTON (ONLY FOR DUMMY PATIENT BILLING) */}
                        {item.is_dummy && (
                          <View style={localStyles.cardActionRow}>
                            <TouchableOpacity
                              style={localStyles.editCardBtn}
                              onPress={() => handleOpenEditModal(item)}
                              activeOpacity={0.8}
                            >
                              <Pencil size={13} color="#047857" style={{ marginRight: 6 }} />
                              <Text style={localStyles.editCardBtnText}>Edit Dummy Billing</Text>
                            </TouchableOpacity>
                          </View>
                        )}
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
              keyboardShouldPersistTaps="handled"
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={localStyles.patientModalItemName}>{item.name}</Text>
                        {item.is_dummy && (
                          <View style={localStyles.dummyBadgePill}>
                            <Text style={localStyles.dummyBadgeText}>WALK-IN</Text>
                          </View>
                        )}
                      </View>
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
              <View style={localStyles.modalHeader}>
                <View>
                  <Text style={localStyles.modalTitle}>APPOINTMENT DETAILS</Text>
                  <Text style={localStyles.modalSubtitle}>
                    {selectedAppointment ? `#${selectedAppointment.id.slice(0, 8).toUpperCase()}` : ''}
                  </Text>
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

              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {loadingAppointment ? (
                  <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#047857" />
                    <Text style={{ marginTop: 12, color: '#047857', fontSize: 13, fontWeight: '600' }}>
                      Loading appointment data...
                    </Text>
                  </View>
                ) : selectedAppointment ? (
                  <>
                    {/* Status & Service */}
                    <View style={localStyles.skeuoCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={localStyles.cardSectionHeader}>SERVICE DETAILS</Text>
                        <View
                          style={[
                            localStyles.statusBadge,
                            {
                              backgroundColor: selectedAppointment.status === 'completed' ? '#ECFDF5' : '#FEF3C7',
                              borderColor: selectedAppointment.status === 'completed' ? '#A7F3D0' : '#FDE68A',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              localStyles.statusBadgeText,
                              { color: selectedAppointment.status === 'completed' ? '#047857' : '#B45309' },
                            ]}
                          >
                            {selectedAppointment.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 4 }}>
                        {selectedAppointment.service}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>
                        Registered dental service appointment
                      </Text>
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

        {/* ─────────────────────────────────────────
            EDIT DUMMY BILLING MODAL
        ───────────────────────────────────────── */}
        <Modal
          visible={showEditModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => {
            if (!savingEdit) {
              setShowEditModal(false);
              setEditingBilling(null);
            }
          }}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View style={localStyles.modalHeader}>
              <View>
                <Text style={localStyles.modalTitle}>EDIT DUMMY BILLING</Text>
                <Text style={localStyles.modalSubtitle}>
                  {editingBilling ? `BILL #${editingBilling.id?.slice(0, 8).toUpperCase()} • ${editingBilling.patient_name}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setEditingBilling(null);
                }}
                disabled={savingEdit}
                style={localStyles.modalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} color="#047857" />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
              {/* Original Amount Input */}
              <View style={localStyles.formGroup}>
                <Text style={localStyles.formLabel}>Original Amount (₱)</Text>
                <View style={localStyles.inputWrapper}>
                  <Text style={localStyles.inputPrefix}>₱</Text>
                  <TextInput
                    style={localStyles.formInputWithPrefix}
                    keyboardType="numeric"
                    value={editAmount}
                    onChangeText={handleEditAmountChange}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <Text style={localStyles.helperText}>
                  Formatted: {formatCurrency(editAmount)}
                </Text>
              </View>

              {/* Discount Type Selector */}
              <View style={localStyles.formGroup}>
                <Text style={localStyles.formLabel}>Discount Type</Text>
                <View style={localStyles.pillSelectorRow}>
                  {[
                    { id: 'none', label: 'None (0%)' },
                    { id: 'pwd', label: 'PWD (20%)' },
                    { id: 'senior', label: 'Senior (20%)' },
                    { id: 'custom', label: 'Custom' },
                  ].map((dt) => {
                    const isSelected = editDiscountType === dt.id;
                    return (
                      <TouchableOpacity
                        key={dt.id}
                        style={[
                          localStyles.pillOption,
                          isSelected && localStyles.pillOptionActive,
                        ]}
                        onPress={() => handleEditDiscountTypeChange(dt.id)}
                      >
                        <Text
                          style={[
                            localStyles.pillOptionText,
                            isSelected && localStyles.pillOptionTextActive,
                          ]}
                        >
                          {dt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Discount Amount Input */}
              <View style={localStyles.formGroup}>
                <Text style={localStyles.formLabel}>Discount Amount (₱)</Text>
                <View style={localStyles.inputWrapper}>
                  <Text style={localStyles.inputPrefix}>₱</Text>
                  <TextInput
                    style={localStyles.formInputWithPrefix}
                    keyboardType="numeric"
                    value={editDiscountAmount}
                    onChangeText={setEditDiscountAmount}
                    editable={editDiscountType === 'custom' || editDiscountType === 'insurance'}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <Text style={localStyles.helperText}>
                  Discount: -{formatCurrency(editDiscountAmount)}
                </Text>
              </View>

              {/* Live Calculation Preview Card */}
              <View style={localStyles.calcPreviewCard}>
                <Text style={localStyles.calcPreviewTitle}>SETTLEMENT BREAKDOWN</Text>
                <View style={localStyles.calcRow}>
                  <Text style={localStyles.calcLabel}>Subtotal</Text>
                  <Text style={localStyles.calcValue}>{formatCurrency(editAmount)}</Text>
                </View>
                <View style={localStyles.calcRow}>
                  <Text style={localStyles.calcLabel}>Discount ({editDiscountType.toUpperCase()})</Text>
                  <Text style={[localStyles.calcValue, { color: '#DC2626' }]}>
                    -{formatCurrency(editDiscountAmount)}
                  </Text>
                </View>
                <View style={localStyles.calcDivider} />
                <View style={localStyles.calcRow}>
                  <Text style={[localStyles.calcLabel, { fontWeight: '800', color: '#0F172A' }]}>Final Settled Amount</Text>
                  <Text style={[localStyles.calcValue, { fontWeight: '900', color: '#047857', fontSize: 16 }]}>
                    {formatCurrency(
                      Math.max(0, (parseFloat(editAmount) || 0) - (parseFloat(editDiscountAmount) || 0))
                    )}
                  </Text>
                </View>
              </View>

              {/* Payment Status Selector */}
              <View style={localStyles.formGroup}>
                <Text style={localStyles.formLabel}>Payment Status</Text>
                <View style={localStyles.pillSelectorRow}>
                  {[
                    { id: 'not_paid', label: 'Unpaid' },
                    { id: 'paid', label: 'Paid' },
                    { id: 'overdue', label: 'Overdue' },
                    { id: 'cancelled', label: 'Cancelled' },
                  ].map((st) => {
                    const isSelected = editPaymentStatus === st.id;
                    return (
                      <TouchableOpacity
                        key={st.id}
                        style={[
                          localStyles.pillOption,
                          isSelected && localStyles.pillOptionActive,
                        ]}
                        onPress={() => setEditPaymentStatus(st.id)}
                      >
                        <Text
                          style={[
                            localStyles.pillOptionText,
                            isSelected && localStyles.pillOptionTextActive,
                          ]}
                        >
                          {st.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Payment Method Selector */}
              <View style={localStyles.formGroup}>
                <Text style={localStyles.formLabel}>Payment Method</Text>
                <View style={localStyles.pillSelectorRow}>
                  {[
                    { id: 'cash', label: 'Cash' },
                    { id: 'gcash', label: 'GCash' },
                    { id: 'card', label: 'Card' },
                    { id: 'paymaya', label: 'Maya' },
                    { id: 'bank-transfer', label: 'Bank' },
                  ].map((m) => {
                    const isSelected = editPaymentMethod === m.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[
                          localStyles.pillOption,
                          isSelected && localStyles.pillOptionActive,
                        ]}
                        onPress={() => setEditPaymentMethod(m.id)}
                      >
                        <Text
                          style={[
                            localStyles.pillOptionText,
                            isSelected && localStyles.pillOptionTextActive,
                          ]}
                        >
                          {m.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ marginTop: 24, gap: 10 }}>
                <TouchableOpacity
                  style={[localStyles.modalPrimaryBtn, savingEdit && { opacity: 0.7 }]}
                  onPress={handleSaveEditDummyBilling}
                  disabled={savingEdit}
                  activeOpacity={0.8}
                >
                  {savingEdit ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={localStyles.modalPrimaryBtnText}>Save Billing Changes</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={localStyles.modalSecondaryBtn}
                  onPress={() => {
                    setShowEditModal(false);
                    setEditingBilling(null);
                  }}
                  disabled={savingEdit}
                  activeOpacity={0.8}
                >
                  <Text style={localStyles.modalSecondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
</KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>



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
  createInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#064E3B',
    borderBottomWidth: 2,
    borderBottomColor: '#022C22',
  },
  createInvoiceBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  skeuoActionBtn: {
    width: 36,
    height: 36,
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
    color: '#047857',
    letterSpacing: 0.8,
  },
  showAllBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  showAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
    textDecorationLine: 'underline',
  },
  patientSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  patientSelectorTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  patientSelectorSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
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
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 10,
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '900',
  },
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
  dummyBadgePill: {
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  dummyBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#15803D',
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
  patientSubEmailText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
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
    fontSize: 13,
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
  cardActionRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  editCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  editCardBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
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
    marginTop: 10,
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
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  modalSecondaryBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalSecondaryBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  // Form Controls in Edit/Create Modals
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  inputWrapper: {
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
    height: 44,
  },
  inputPrefix: {
    fontSize: 15,
    fontWeight: '800',
    color: '#047857',
    marginRight: 6,
  },
  formInputWithPrefix: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    padding: 0,
  },
  helperText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
    marginTop: 4,
  },
  pillSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pillOption: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  pillOptionActive: {
    backgroundColor: '#047857',
    borderColor: '#064E3B',
  },
  pillOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  pillOptionTextActive: {
    color: '#FFFFFF',
  },
  calcPreviewCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    padding: 12,
    marginBottom: 16,
  },
  calcPreviewTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  calcLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  calcValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
  },
  calcDivider: {
    height: 1,
    backgroundColor: '#BBF7D0',
    marginVertical: 6,
  },
  patientPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  patientPillActive: {
    backgroundColor: '#047857',
    borderColor: '#064E3B',
  },
  patientPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  patientPillTextActive: {
    color: '#FFFFFF',
  },
});
