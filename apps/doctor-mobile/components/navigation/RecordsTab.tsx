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
  FileText,
  Users,
  Sparkles,
  ShieldCheck,
  Layers,
  X,
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppTour, { useTourTargets, TourStep } from "../tour/AppTour";
import { isDoctorGuideCompleted, markDoctorGuideCompleted } from "../../lib/doctorService";

// Type alias for backwards compatibility
type AppointmentType = Appointment & { patient_id?: string };

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
  onBack?: () => void;
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
  onBack,
}: RecordsTabProps) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [supabasePatients, setSupabasePatients] = useState<AppointmentType[]>([]);
  const [loadingSupabase, setLoadingSupabase] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const scrollViewRef = useRef<any>(null);

  // Note: Session restoration is no longer needed!
  // RLS policies now use auth.role() = 'authenticated' which uses JWT tokens
  // JWT tokens are sent with every request and work reliably in React Native

  // Fetch profiles patients on initial load
  useEffect(() => {
    const fetchSupabasePatients = async () => {
      setLoadingSupabase(true);
      try {
        const result = await dashboardService.fetchDoctorPatients(currentUser?.id || '');
        console.log('RecordsTab - Received profiles patients:', result.data);

        const mapped: AppointmentType[] = (result.data || []).map((patient: any) => ({
          id: patient.id,
          patient_id: patient.id,
          name: patient.name || 'Unknown Patient',
          email: patient.email || '',
          service: patient.service || 'General',
          contact: patient.phone || '',
          time: '',
          date: patient.created_at || new Date().toISOString(),
          age: 0,
          gender: patient.gender || '',
          notes: '',
          imageUrl: patient.avatar_url || patient.avatar || patient.profile_picture || patient.image_url || require('../../assets/images/user.png'),
          status: 'scheduled' as const,
        }));

        console.log('RecordsTab - Mapped profiles patients:', mapped);
        setSupabasePatients(mapped);
      } catch (error) {
        console.error('Error fetching profiles patients:', error);
      } finally {
        setLoadingSupabase(false);
      }
    };

    if (currentUser?.id) {
      fetchSupabasePatients();
    }
  }, [currentUser?.id]);

  // Reset to first page when search query or sort order changes
  useEffect(() => {
    setCurrentPage(1);
  }, [quickSearchQuery, patientSortBy, patientSortOrder]);

  const basePatients = supabasePatients.length > 0 ? supabasePatients : (patients || []);

  const filteredPatients = basePatients.filter((patient) => {
    const query = quickSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      (patient.name && patient.name.toLowerCase().includes(query)) ||
      (patient.service && patient.service.toLowerCase().includes(query)) ||
      (patient.email && patient.email.toLowerCase().includes(query)) ||
      (patient.contact && patient.contact.toLowerCase().includes(query))
    );
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
      // Verify user is logged in via currentUser hook
      if (!currentUser?.id) {
        console.error('❌ No authenticated user for refresh');
        setIsRefreshing(false);
        return;
      }

      console.log('🔄 Refreshing patient data for user:', currentUser.id);

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
      description: "Manage your clinical directory, search patient records, organize appointments, and access full digital dental charts.",
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
      title: "Quick Search",
      description: "Instantly filter patients by full name, requested dental procedure, email address, or contact number.",
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
      description: "Sort your patient roster alphabetically by Name or chronologically by Date Created, in Ascending or Descending order.",
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
      description: "Tap any patient card to open their complete clinical chart—including medical intake, allergies, notes, and past appointments.",
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
      title: totalPages > 1 ? "Page Navigation" : "Patient Directory Stats",
      description: totalPages > 1
        ? "Flip through pages of your patient directory to manage large clinic rosters cleanly and efficiently."
        : "Displays the active patient count currently matching your search and filter criteria.",
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
    if (currentUser?.id) {
      await markDoctorGuideCompleted(currentUser.id, "records");
    }
  };

  const handleSkipTour = async () => {
    setTourVisible(false);
    if (currentUser?.id) {
      await markDoctorGuideCompleted(currentUser.id, "records");
    }
  };

  const handleStartTour = () => {
    setTourIndex(0);
    setTourVisible(true);
  };

  // Auto-prompt walkthrough on first visit to RecordsTab
  useEffect(() => {
    if (!currentUser?.id || loadingSupabase) return;

    let isMounted = true;
    const checkFirstTimeTour = async () => {
      try {
        const alreadyDone = await isDoctorGuideCompleted(currentUser.id, "records");
        if (alreadyDone) return;

        const key = `@smileguard_doctor_records_walkthrough_completed_${currentUser.id}`;
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
  }, [currentUser?.id, loadingSupabase]);

  // Support triggering walkthrough from parent (e.g. Settings tab)
  useEffect(() => {
    if (startTourTrigger && startTourTrigger > 0) {
      setTourIndex(0);
      setTourVisible(true);
    }
  }, [startTourTrigger]);

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <View
        ref={tour.setContainer}
        collapsable={false}
        style={{ flex: 1 }}
      >
        {/* Top Header Row matching DoctorDashboard modules */}
        <View style={localStyles.topHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {onBack && (
              <TouchableOpacity
                onPress={onBack}
                style={localStyles.backButton}
                activeOpacity={0.7}
                accessibilityLabel="Back to Dashboard"
              >
                <ChevronLeft size={18} color="#047857" />
                <Text style={localStyles.backButtonText}>BACK</Text>
              </TouchableOpacity>
            )}
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
          </View>

          <View style={localStyles.headerActionsRow}>
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={isRefreshing}
              style={localStyles.skeuoActionBtn}
              activeOpacity={0.7}
              accessibilityLabel="Refresh Records"
            >
              {isRefreshing ? (
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
              placeholder="Search by name, service, email, contact..."
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
              style={[localStyles.sortBtn, localStyles.sortBtnInactive, { flexDirection: 'row', alignItems: 'center' }]}
              activeOpacity={0.7}
            >
              <ArrowUpDown size={12} color="#047857" style={{ marginRight: 4 }} />
              <Text style={[localStyles.sortBtnText, localStyles.sortBtnTextInactive]}>
                {patientSortOrder === 'asc' ? 'Ascending' : 'Descending'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView ref={scrollViewRef} style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 32 }}>
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
                No patient accounts have been registered in the clinic database yet.
              </Text>
            </View>
          ) : sortedPatients.length === 0 ? (
            <View style={localStyles.emptyContainer}>
              <View style={localStyles.emptyIconBox}>
                <Search size={26} color="#047857" />
              </View>
              <Text style={localStyles.emptyTitle}>NO MATCHES FOUND</Text>
              <Text style={localStyles.emptySubtitle}>
                No patient records match "{quickSearchQuery}". Try a different name, email, or contact number.
              </Text>
              <TouchableOpacity
                onPress={() => setQuickSearchQuery("")}
                style={localStyles.clearFilterBtn}
                activeOpacity={0.7}
              >
                <Text style={localStyles.clearFilterBtnText}>Clear Search Filter</Text>
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
                        <View style={localStyles.patientBadge}>
                          <Text style={localStyles.patientBadgeText}>PATIENT</Text>
                        </View>
                      </View>
                      <Text style={localStyles.patientService} numberOfLines={1}>
                        {patient.service || "General Dental"}
                      </Text>
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
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  backButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#047857',
    letterSpacing: 0.5,
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
