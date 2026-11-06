import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Appointment } from "../../data/dashboardData";
import * as dashboardService from "../../lib/dashboardService";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { supabase } from "@smileguard/supabase-client";
import { getAllPatients } from "../../lib/profilesPatients";
import {
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Users,
  Sparkles,
  ShieldCheck,
  Layers,
  X,
  UserPlus,
} from "lucide-react-native";
import AddPatientModal from "../patientrecord/AddPatientModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppTour, { useTourTargets, TourStep } from "../tour/AppTour";
import { isDoctorGuideCompleted, markDoctorGuideCompleted } from "../../lib/doctorService";

// Type alias for backwards compatibility
type AppointmentType = Appointment & { patient_id?: string; dummy?: boolean; priority?: 'Low' | 'Medium' | 'High' | 'low' | 'medium' | 'high'; };

interface RecordsTabProps {
  patients: AppointmentType[];
  quickSearchQuery: string;
  setQuickSearchQuery: (query: string) => void;
  patientSortBy: 'name' | 'date' | 'service';
  setPatientSortBy: (sortBy: 'name' | 'date' | 'service') => void;
  patientSortOrder: 'asc' | 'desc';
  setPatientSortOrder: (order: 'asc' | 'desc') => void;
  sortPatients: (patientsToSort: AppointmentType[]) => AppointmentType[];
  setViewingPatient: (patient: AppointmentType) => void;
  setShowPatientDetails: (show: boolean) => void;
  styles: any;
  startTourTrigger?: number;
  userRole?: string;
  refreshTrigger?: number;
  doctorId?: string;
}

const ITEMS_PER_PAGE = 4;

export default function RecordsTab({
  patients,
  quickSearchQuery,
  setQuickSearchQuery,
  patientSortBy,
  setPatientSortBy,
  patientSortOrder,
  setPatientSortOrder,
  sortPatients,
  setViewingPatient,
  setShowPatientDetails,
  styles,
  startTourTrigger,
  userRole,
  refreshTrigger,
  doctorId,
}: RecordsTabProps) {
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const router = useRouter();
  const currentUser = useCurrentUser();
  const activeUserId = doctorId || currentUser?.id;
  const [supabasePatients, setSupabasePatients] = useState<AppointmentType[]>([]);
  const [loadingSupabase, setLoadingSupabase] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [patientTypeFilter, setPatientTypeFilter] = useState<'all' | 'patient' | 'dummy'>('all');
  const scrollViewRef = useRef<any>(null);

  // Note: Session restoration is no longer needed!
  // RLS policies now use auth.role() = 'authenticated' which uses JWT tokens
  // JWT tokens are sent with every request and work reliably in React Native

  // Fetch profiles patients on initial load
  useEffect(() => {
    let isMounted = true;

    const fetchSupabasePatients = async () => {
      // Resolve user id from props, hook, or direct session fallback
      let idToUse = activeUserId;
      if (!idToUse) {
        const { data: { session } } = await supabase.auth.getSession();
        idToUse = session?.user?.id;
      }
      if (!idToUse) return;

      setLoadingSupabase(true);
      try {
        const result = await dashboardService.fetchDoctorPatients(idToUse);
        if (!isMounted) return;
        console.log('RecordsTab - Received profiles patients:', result.data);

        const mapped: AppointmentType[] = (result.data || []).map((patient: any) => ({
          id: patient.id,
          patient_id: patient.id,
          name: patient.name || 'Unknown Patient',
          email: patient.email || '',
          service: patient.service || 'General Dental',
          contact: patient.phone || '',
          time: '',
          date: patient.created_at || new Date().toISOString(),
          age: 0,
          gender: patient.gender || '',
          notes: '',
          imageUrl: patient.avatar_url || patient.avatar || patient.profile_picture || patient.image_url || require('../../assets/images/user.png'),
          status: 'scheduled' as const,
          dummy: Boolean(patient.dummy),
          priority: (patient.priority as any) || 'Low',
        }));

        console.log('RecordsTab - Mapped profiles patients:', mapped);
        setSupabasePatients(mapped);
      } catch (error) {
        console.error('Error fetching profiles patients:', error);
      } finally {
        if (isMounted) setLoadingSupabase(false);
      }
    };

    fetchSupabasePatients();

    return () => {
      isMounted = false;
    };
  }, [activeUserId]);

  // Reset to first page when search query, type filter, or sort order changes
  useEffect(() => {
    setCurrentPage(1);
  }, [quickSearchQuery, patientSortBy, patientSortOrder, patientTypeFilter]);

  const basePatients = supabasePatients.length > 0 ? supabasePatients : (patients || []);

  const patientOnlyCount = basePatients.filter((p) => !p.dummy).length;
  const dummyOnlyCount = basePatients.filter((p) => p.dummy).length;

  const filteredPatients = basePatients.filter((patient) => {
    // 1. Patient Type Filter (all, patient, dummy)
    if (patientTypeFilter === 'patient' && patient.dummy) return false;
    if (patientTypeFilter === 'dummy' && !patient.dummy) return false;

    // 2. Search query filter
    const query = quickSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return Boolean(patient.name && patient.name.toLowerCase().includes(query));
  });

  const sortedPatients = sortPatients(filteredPatients);
  const totalPages = Math.max(1, Math.ceil(sortedPatients.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPatients = sortedPatients.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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

  // Refresh function to refetch both patient sources
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Resolve user id from props, hook, or direct session fallback
      let idToUse = activeUserId;
      if (!idToUse) {
        const { data: { session } } = await supabase.auth.getSession();
        idToUse = session?.user?.id;
      }

      if (!idToUse) {
        console.log('⏳ [RecordsTab] Waiting for user session to initialize before refreshing');
        setIsRefreshing(false);
        return;
      }

      console.log('🔄 Refreshing patient data for user:', idToUse);

      // Fetch Supabase patients
      const supabaseData = await getAllPatients();
      // Filter to show only patients with role='patient'
      const filteredSupabaseData = supabaseData.filter((patient: any) => patient.role === 'patient');
      const mappedSupabase: AppointmentType[] = filteredSupabaseData.map((patient: any) => ({
        id: patient.patient_id,
        patient_id: patient.patient_id,
        name: patient.name || 'Unknown Patient',
        email: patient.email || '',
        service: patient.service || 'General',
        contact: patient.phone || '',
        time: '',
        date: patient.created_at,
        age: 0,
        gender: patient.gender || '',
        notes: '',
        imageUrl: (patient as any).avatar_url || (patient as any).avatar || (patient as any).profile_picture || (patient as any).image_url || require('../../assets/images/user.png'),
        status: 'scheduled' as const,
        priority: (patient.priority as any) || 'Low',
      }));
      setSupabasePatients(mappedSupabase);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error refreshing patients:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // ─────────────────────────────────────────
  // INTERACTIVE RECORDS WALKTHROUGH SYSTEM
  // ─────────────────────────────────────────
  const tour = useTourTargets();
  const [tourVisible, setTourVisible] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);

  const tourSteps: TourStep[] = [
    {
      id: "records-welcome",
      title: "Welcome to Patient Records!",
      description: "Manage your patient records, search patients, organize appointments, and open digital dental charts.",
      icon: Users,
      placement: "center",
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) { }
      },
    },
    {
      id: "records-search",
      target: "records-search",
      title: "Search by Patient Name",
      description: "Instantly filter patients by their full name.",
      icon: Search,
      padding: 6,
      radius: 12,
      placement: "bottom",
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) { }
      },
    },
    {
      id: "records-sort",
      target: "records-sort",
      title: "Sort & Reorder",
      description: "Sort your patient list by Name (A to Z) or by Date Created (newest or oldest first).",
      icon: ArrowUpDown,
      padding: 6,
      radius: 14,
      placement: "bottom",
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) { }
      },
    },
    {
      id: "records-card",
      target: paginatedPatients.length > 0 ? "records-card" : "records-count",
      title: "Digital Dental Chart",
      description: "Tap any patient card to open their complete dental chart—including health history, allergies, notes, and past appointments.",
      icon: FileText,
      padding: 6,
      radius: 14,
      placement: "bottom",
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) { }
      },
    },
    {
      id: "records-pagination",
      target: totalPages > 1 ? "records-pagination" : "records-count",
      title: totalPages > 1 ? "Page Navigation" : "Patient Count",
      description: totalPages > 1
        ? "Flip through pages to browse your patient list easily."
        : "Shows the number of patients matching your search.",
      icon: Layers,
      padding: 6,
      radius: 14,
      placement: "auto",
      onEnter: () => {
        try {
          if (totalPages > 1) {
            scrollViewRef.current?.scrollToEnd?.({ animated: false });
          }
        } catch (e) { }
      },
    },
    {
      id: "records-actions",
      target: "records-actions",
      title: "Sync & Walkthrough",
      description: "Tap the refresh icon to sync the latest cloud patient records, or tap Sparkles anytime to restart this walkthrough.",
      icon: Sparkles,
      padding: 6,
      radius: 12,
      placement: "bottom",
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) { }
      },
    },
    {
      id: "records-finish",
      title: "You're All Set, Doctor!",
      description: "Patient records and digital charts are now organized and ready at your fingertips.",
      icon: ShieldCheck,
      placement: "center",
      onEnter: () => {
        try {
          scrollViewRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) { }
      },
    },
  ];

  const handleFinishTour = async () => {
    setTourVisible(false);
    if (activeUserId) {
      await markDoctorGuideCompleted(activeUserId, "records");
    }
  };

  const handleSkipTour = async () => {
    setTourVisible(false);
    if (activeUserId) {
      await markDoctorGuideCompleted(activeUserId, "records");
    }
  };

  const handleStartTour = () => {
    setTourIndex(0);
    setTourVisible(true);
  };

  // Auto-prompt walkthrough on first visit to RecordsTab
  useEffect(() => {
    if (!activeUserId || loadingSupabase) return;

    let isMounted = true;
    const checkFirstTimeTour = async () => {
      try {
        const alreadyDone = await isDoctorGuideCompleted(activeUserId, "records");
        if (alreadyDone) return;

        const key = `@smileguard_doctor_records_walkthrough_completed_${activeUserId}`;
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
        console.error("Error checking records walkthrough status:", err);
      }
    };

    checkFirstTimeTour();
    return () => {
      isMounted = false;
    };
  }, [activeUserId, loadingSupabase]);

  // Support triggering walkthrough from parent (e.g. Settings tab)
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

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <View
        ref={tour.setContainer}
        collapsable={false}
        style={{ flex: 1 }}
      >
        {/* Top Header Row matching DoctorDashboard modules */}
        <View style={localStyles.topHeader}>
          <View
            ref={tour.register("records-actions")}
            collapsable={false}
            style={localStyles.headerTitleGroup}
          >
            <Text style={localStyles.headerTitle}>PATIENT RECORDS</Text>
            <View style={localStyles.pillCountBadge}>
              <Text style={localStyles.pillCountText}>{basePatients.length}</Text>
            </View>
          </View>

          <View style={localStyles.headerActionsRow}>
            {userRole === "assistant" && (
              <TouchableOpacity
                onPress={() => setShowAddPatientModal(true)}
                style={localStyles.addPatientHeaderBtn}
                activeOpacity={0.8}
                accessibilityLabel="Add Patient"
              >
                <UserPlus size={14} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 5 }} />
                <Text style={localStyles.addPatientHeaderBtnText}>Add Patient</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search & Sort Filter Section */}
        <View style={localStyles.filterSection}>
          <View
            ref={tour.register("records-search")}
            collapsable={false}
            style={localStyles.searchContainer}
          >
            <Search size={16} color="#047857" style={{ marginRight: 8 }} />
            <TextInput
              style={localStyles.searchInput}
              placeholder={
                patientTypeFilter === 'dummy'
                  ? "Search dummy patients..."
                  : patientTypeFilter === 'patient'
                  ? "Search registered patients..."
                  : "Search by patient name..."
              }
              placeholderTextColor="#94A3B8"
              value={quickSearchQuery}
              onChangeText={setQuickSearchQuery}
            />
            {quickSearchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuickSearchQuery("")}
                style={localStyles.clearSearchBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={14} color="#64748B" />
              </TouchableOpacity>
            )}

            {/* Quick Type Switcher Toggle directly on Search Bar */}
            <TouchableOpacity
              style={[
                localStyles.searchToggleBtn,
                patientTypeFilter === 'dummy'
                  ? localStyles.searchToggleBtnDummy
                  : patientTypeFilter === 'patient'
                  ? localStyles.searchToggleBtnPatient
                  : localStyles.searchToggleBtnAll,
              ]}
              onPress={() => {
                if (patientTypeFilter === 'all') setPatientTypeFilter('patient');
                else if (patientTypeFilter === 'patient') setPatientTypeFilter('dummy');
                else setPatientTypeFilter('all');
              }}
              activeOpacity={0.7}
              accessibilityLabel={`Filter: currently ${patientTypeFilter}. Tap to switch between All, Patient, and Dummy`}
            >
              <View
                style={[
                  localStyles.searchToggleDot,
                  patientTypeFilter === 'dummy'
                    ? { backgroundColor: '#D97706' }
                    : patientTypeFilter === 'patient'
                    ? { backgroundColor: '#047857' }
                    : { backgroundColor: '#64748B' },
                ]}
              />
              <Text
                style={[
                  localStyles.searchToggleText,
                  patientTypeFilter === 'dummy'
                    ? localStyles.searchToggleTextDummy
                    : patientTypeFilter === 'patient'
                    ? localStyles.searchToggleTextPatient
                    : localStyles.searchToggleTextAll,
                ]}
              >
                {patientTypeFilter === 'dummy' ? 'DUMMY' : patientTypeFilter === 'patient' ? 'PATIENT' : 'ALL'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* View Filter Options (All / Patients / Dummy) */}
          <View style={localStyles.typeFilterRow}>
            <Text style={localStyles.typeFilterLabel}>VIEW:</Text>
            <TouchableOpacity
              onPress={() => setPatientTypeFilter('all')}
              style={[
                localStyles.typeTabBtn,
                patientTypeFilter === 'all' ? localStyles.typeTabBtnActive : localStyles.typeTabBtnInactive,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  localStyles.typeTabBtnText,
                  patientTypeFilter === 'all' ? localStyles.typeTabBtnTextActive : localStyles.typeTabBtnTextInactive,
                ]}
              >
                All ({basePatients.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPatientTypeFilter('patient')}
              style={[
                localStyles.typeTabBtn,
                patientTypeFilter === 'patient' ? localStyles.typeTabBtnActive : localStyles.typeTabBtnInactive,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  localStyles.typeTabBtnText,
                  patientTypeFilter === 'patient' ? localStyles.typeTabBtnTextActive : localStyles.typeTabBtnTextInactive,
                ]}
              >
                Patients ({patientOnlyCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPatientTypeFilter('dummy')}
              style={[
                localStyles.typeTabBtn,
                patientTypeFilter === 'dummy' ? localStyles.typeTabBtnActiveDummy : localStyles.typeTabBtnInactive,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  localStyles.typeTabBtnText,
                  patientTypeFilter === 'dummy' ? localStyles.typeTabBtnTextActiveDummy : localStyles.typeTabBtnTextInactive,
                ]}
              >
                Dummy ({dummyOnlyCount})
              </Text>
            </TouchableOpacity>
          </View>

          <View
            ref={tour.register("records-sort")}
            collapsable={false}
            style={localStyles.sortRow}
          >
            <Text style={localStyles.sortLabel}>SORT BY:</Text>
            <TouchableOpacity
              onPress={() => setPatientSortBy('name')}
              style={[
                localStyles.sortBtn,
                patientSortBy === 'name' ? localStyles.sortBtnActive : localStyles.sortBtnInactive,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  localStyles.sortBtnText,
                  patientSortBy === 'name' ? localStyles.sortBtnTextActive : localStyles.sortBtnTextInactive,
                ]}
              >
                Name
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPatientSortBy('date')}
              style={[
                localStyles.sortBtn,
                patientSortBy === 'date' ? localStyles.sortBtnActive : localStyles.sortBtnInactive,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  localStyles.sortBtnText,
                  patientSortBy === 'date' ? localStyles.sortBtnTextActive : localStyles.sortBtnTextInactive,
                ]}
              >
                Date Created
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPatientSortOrder(patientSortOrder === 'asc' ? 'desc' : 'asc')}
              style={[
                localStyles.sortBtn,
                localStyles.sortBtnInactive,
                localStyles.sortOrderBtn,
              ]}
              activeOpacity={0.7}
              accessibilityLabel={patientSortOrder === 'asc' ? 'Sort Ascending' : 'Sort Descending'}
            >
              {patientSortOrder === 'asc' ? (
                <ArrowUp size={12} color="#047857" style={{ marginRight: 4 }} />
              ) : (
                <ArrowDown size={12} color="#047857" style={{ marginRight: 4 }} />
              )}
              <Text style={[localStyles.sortBtnText, localStyles.sortBtnTextInactive]}>
                {patientSortOrder === 'asc' ? 'Asc' : 'Desc'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" ref={scrollViewRef} style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 32 }}>
          {loadingSupabase ? (
            <View style={{ paddingVertical: 48, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#047857" />
              <Text style={{ marginTop: 12, color: "#047857", fontSize: 14, fontWeight: '600' }}>Loading patient records...</Text>
            </View>
          ) : basePatients.length === 0 ? (
            <View style={localStyles.emptyContainer}>
              <View style={localStyles.emptyIconBox}>
                <Users size={26} color="#047857" />
              </View>
              <Text style={localStyles.emptyTitle}>NO PATIENTS YET</Text>
              <Text style={localStyles.emptySubtitle}>
                No patient accounts have registered with your clinic yet.
              </Text>
            </View>
          ) : sortedPatients.length === 0 ? (
            <View style={localStyles.emptyContainer}>
              <View style={localStyles.emptyIconBox}>
                <Search size={26} color="#047857" />
              </View>
              <Text style={localStyles.emptyTitle}>NO MATCHES FOUND</Text>
              <Text style={localStyles.emptySubtitle}>
                {patientTypeFilter === 'dummy'
                  ? `No dummy patient records found${quickSearchQuery ? ` matching "${quickSearchQuery}"` : ""}.`
                  : patientTypeFilter === 'patient'
                  ? `No registered patient records found${quickSearchQuery ? ` matching "${quickSearchQuery}"` : ""}.`
                  : `No patient records match "${quickSearchQuery}". Try a different patient name.`}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setQuickSearchQuery("");
                  setPatientTypeFilter("all");
                }}
                style={localStyles.clearFilterBtn}
                activeOpacity={0.7}
              >
                <Text style={localStyles.clearFilterBtnText}>Reset Search & Filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Header info showing patient count and page */}
              <View
                ref={tour.register("records-count")}
                collapsable={false}
                style={localStyles.countHeader}
              >
                <Text style={localStyles.countHeaderText}>
                  Showing <Text style={localStyles.countHeaderBold}>{startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, sortedPatients.length)}</Text> of <Text style={localStyles.countHeaderBold}>{sortedPatients.length}</Text> patients
                </Text>
                {totalPages > 1 && (
                  <View style={localStyles.pageBadge}>
                    <Text style={localStyles.pageBadgeText}>
                      Page {currentPage} of {totalPages}
                    </Text>
                  </View>
                )}
              </View>

              {/* Paginated Patients List */}
              {paginatedPatients.map((patient, index) => (
                <TouchableOpacity
                  key={patient.id}
                  ref={index === 0 ? tour.register("records-card") : undefined}
                  style={[styles.card, styles.shadow, localStyles.patientCard]}
                  onPress={() => {
                    setViewingPatient({
                      ...patient,
                      patient_id: patient.patient_id || patient.id,
                    });
                    setShowPatientDetails(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Image
                      source={
                        typeof patient.imageUrl === "string" && patient.imageUrl.length > 0
                          ? { uri: patient.imageUrl }
                          : typeof patient.imageUrl === "number"
                            ? patient.imageUrl
                            : require('../../assets/images/user.png')
                      }
                      style={localStyles.patientAvatar}
                    />
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={localStyles.patientName} numberOfLines={1}>{patient.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {patient.priority ? (
                            <View style={[
                              localStyles.cardPriorityBadge,
                              patient.priority.toLowerCase() === 'high' ? localStyles.cardPriorityBadgeHigh :
                              patient.priority.toLowerCase() === 'medium' ? localStyles.cardPriorityBadgeMed :
                              localStyles.cardPriorityBadgeLow
                            ]}>
                              <Text style={[
                                localStyles.cardPriorityText,
                                patient.priority.toLowerCase() === 'high' ? localStyles.cardPriorityTextHigh :
                                patient.priority.toLowerCase() === 'medium' ? localStyles.cardPriorityTextMed :
                                localStyles.cardPriorityTextLow
                              ]}>
                                {patient.priority.toUpperCase()}
                              </Text>
                            </View>
                          ) : null}
                          {patient.dummy ? (
                            <View style={localStyles.dummyBadge}>
                              <Text style={localStyles.dummyBadgeText}>DUMMY</Text>
                            </View>
                          ) : (
                            <View style={localStyles.patientBadge}>
                              <Text style={localStyles.patientBadgeText}>PATIENT</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      {(patient.email || patient.contact) ? (
                        <Text style={localStyles.patientContact} numberOfLines={1}>
                          {patient.email || patient.contact}
                        </Text>
                      ) : null}
                    </View>
                    <View style={localStyles.cardActionBtn}>
                      <ChevronRight size={15} color="#047857" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <View
                  ref={tour.register("records-pagination")}
                  collapsable={false}
                  style={localStyles.paginationContainer}
                >
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
        </ScrollView>

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

        {/* Add Patient Modal (Assistant Only) */}
        {userRole === "assistant" && (
          <AddPatientModal
            visible={showAddPatientModal}
            onClose={() => setShowAddPatientModal(false)}
            onPatientAdded={async () => {
              await handleRefresh();
            }}
          />
        )}
      </View>
    </View>
  );
}

const localStyles = StyleSheet.create({
  topHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: 1.5,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  pillCountBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
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
  addPatientHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#047857',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  addPatientHeaderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
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
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#E2E8F0',
    borderBottomWidth: 1,
    backgroundColor: '#FFFFFF',
    gap: 10,
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
    height: 42,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
    height: '100%',
    padding: 0,
  },
  clearSearchBtn: {
    padding: 3,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  searchToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 6,
    gap: 5,
  },
  searchToggleBtnAll: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  searchToggleBtnPatient: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  searchToggleBtnDummy: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  searchToggleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  searchToggleText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  searchToggleTextAll: {
    color: '#475569',
  },
  searchToggleTextPatient: {
    color: '#047857',
  },
  searchToggleTextDummy: {
    color: '#B45309',
  },
  typeFilterRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  typeFilterLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginRight: 2,
  },
  typeTabBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 6,
  },
  typeTabBtnActive: {
    backgroundColor: '#047857',
    borderWidth: 1,
    borderColor: '#064E3B',
    borderBottomWidth: 2.5,
    borderBottomColor: '#022C22',
  },
  typeTabBtnActiveDummy: {
    backgroundColor: '#D97706',
    borderWidth: 1,
    borderColor: '#B45309',
    borderBottomWidth: 2.5,
    borderBottomColor: '#78350F',
  },
  typeTabBtnInactive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
  },
  typeTabBtnText: {
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  typeTabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  typeTabBtnTextActiveDummy: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  typeTabBtnTextInactive: {
    color: '#475569',
    fontWeight: '700',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  sortLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginRight: 2,
  },
  sortBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sortBtnActive: {
    backgroundColor: '#047857',
    borderWidth: 1,
    borderColor: '#064E3B',
    borderBottomWidth: 2.5,
    borderBottomColor: '#022C22',
  },
  sortBtnInactive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
  },
  sortOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    paddingHorizontal: 8,
  },
  sortBtnText: {
    fontSize: 11.5,
    letterSpacing: 0.3,
  },
  sortBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  sortBtnTextInactive: {
    color: '#475569',
    fontWeight: '700',
  },
  clinicBanner: {
    backgroundColor: '#064E3B',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#022C22',
    padding: 16,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  clinicBannerBevel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  clinicBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clinicBannerIconBox: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clinicBannerBadgeRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  clinicBannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6EE7B7',
    borderWidth: 1,
    borderColor: '#34D399',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  clinicBannerBadgeText: {
    color: '#022C22',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  clinicBannerDoctorName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  },
  clinicBannerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D1FAE5',
    letterSpacing: 0.3,
    marginTop: 1,
  },
  patientCard: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  patientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 12,
  },
  patientName: {
    fontWeight: '800',
    fontSize: 14.5,
    color: '#0F172A',
    flexShrink: 1,
    marginRight: 6,
  },
  patientBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  patientBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.5,
  },
  cardPriorityBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderWidth: 1,
  },
  cardPriorityBadgeLow: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  cardPriorityBadgeMed: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  cardPriorityBadgeHigh: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  cardPriorityText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardPriorityTextLow: {
    color: '#047857',
  },
  cardPriorityTextMed: {
    color: '#B45309',
  },
  cardPriorityTextHigh: {
    color: '#B91C1C',
  },
  dummyBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  dummyBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 0.5,
  },
  patientService: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    marginTop: 1,
  },
  patientContact: {
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  cardActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginVertical: 16,
  },
  emptyIconBox: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
    lineHeight: 17,
  },
  clearFilterBtn: {
    marginTop: 12,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  clearFilterBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.3,
  },
  countHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  countHeaderText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  countHeaderBold: {
    fontWeight: '800',
    color: '#0F172A',
  },
  pageBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  pageBadgeText: {
    fontSize: 10.5,
    color: '#047857',
    fontWeight: '800',
    letterSpacing: 0.3,
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
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    gap: 8,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
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
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
  },
  pageButtonActive: {
    backgroundColor: '#047857',
    borderWidth: 1,
    borderColor: '#064E3B',
    borderBottomWidth: 2,
    borderBottomColor: '#022C22',
  },
  pageButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
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
