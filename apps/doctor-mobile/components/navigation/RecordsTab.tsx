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
} from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppTour, { useTourTargets, TourStep } from "../tour/AppTour";

// Type alias for backwards compatibility
type AppointmentType = Appointment;

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
          name: patient.name || 'Unknown Patient',
          email: patient.email || '',
          service: patient.service || 'General',
          contact: patient.phone || '',
          time: '',
          date: patient.created_at || new Date().toISOString(),
          age: 0,
          gender: patient.gender || '',
          notes: '',
          imageUrl: require('../../assets/images/user.png'),
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
        name: patient.name || 'Unknown Patient',
        email: patient.email || '',
        service: patient.service || 'General',
        contact: patient.phone || '',
        time: '',
        date: patient.created_at,
        age: 0,
        gender: patient.gender || '',
        notes: '',
        imageUrl: require('../../assets/images/user.png'),
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
        } catch (e) {}
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
        } catch (e) {}
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
        } catch (e) {}
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
        } catch (e) {}
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
        } catch (e) {}
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
        } catch (e) {}
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
        } catch (e) {}
      },
    },
  ];

  const handleFinishTour = async () => {
    setTourVisible(false);
    if (currentUser?.id) {
      try {
        await AsyncStorage.setItem(
          `@smileguard_doctor_records_walkthrough_completed_${currentUser.id}`,
          "true"
        );
      } catch (err) {
        console.error("Failed to save records walkthrough status:", err);
      }
    }
  };

  const handleSkipTour = async () => {
    setTourVisible(false);
    if (currentUser?.id) {
      try {
        await AsyncStorage.setItem(
          `@smileguard_doctor_records_walkthrough_completed_${currentUser.id}`,
          "true"
        );
      } catch (err) {
        console.error("Failed to save records walkthrough status:", err);
      }
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <View
        ref={tour.setContainer}
        collapsable={false}
        style={{ flex: 1 }}
      >
        {/* Header with Current User Name */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 13, borderBottomColor: '#ddd', borderBottomWidth: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 25, fontWeight: 'bold', color: "#047857", marginBottom: 4 }}>
            Patient Records
          </Text>
          <View
            ref={tour.register("records-actions")}
            collapsable={false}
            style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}
          >
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={isRefreshing}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: '#ECFDF5',
                borderWidth: 1,
                borderColor: '#A7F3D0',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#047857" />
              ) : (
                <RefreshCw size={18} color="#047857" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleStartTour}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: '#ECFDF5',
                borderWidth: 1,
                borderColor: '#A7F3D0',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Sparkles size={18} color="#047857" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, borderBottomColor: '#ddd', borderBottomWidth: 1 }}>
          <View
            ref={tour.register("records-search")}
            collapsable={false}
            style={{ marginBottom: 12 }}
          >
            <TextInput
              style={{
                backgroundColor: '#fff',
                borderColor: '#10B981',
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: '#333',
              }}
              placeholder="Search by name, service, email, contact..."
              placeholderTextColor="#999"
              value={quickSearchQuery}
              onChangeText={setQuickSearchQuery}
            />
          </View>

          <View
            ref={tour.register("records-sort")}
            collapsable={false}
            style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap', marginBottom: 7 }}
          >
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#666', alignSelf: 'center' }}>Sort by:</Text>
            <TouchableOpacity
              onPress={() => setPatientSortBy('name')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: patientSortBy === 'name' ? '#10B981' : '#e0e0e0',
                borderWidth: 1,
                borderColor: patientSortBy === 'name' ? '#10B981' : '#ccc',
              }}
            >
              <Text style={{ fontSize: 12, color: patientSortBy === 'name' ? '#fff' : '#333', fontWeight: '500' }}>Name</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPatientSortBy('date')}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: patientSortBy === 'date' ? '#10B981' : '#e0e0e0',
                borderWidth: 1,
                borderColor: patientSortBy === 'date' ? '#10B981' : '#ccc',
              }}
            >
              <Text style={{ fontSize: 12, color: patientSortBy === 'date' ? '#fff' : '#333', fontWeight: '500' }}>Date Created</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPatientSortOrder(patientSortOrder === 'asc' ? 'desc' : 'asc')}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: '#f0f0f0',
                borderWidth: 1,
                borderColor: '#ccc',
              }}
            >
              <Text style={{ fontSize: 12, color: '#333', fontWeight: '500' }}>
                {patientSortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView ref={scrollViewRef} style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 32 }}>
          {loadingSupabase ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={{ marginTop: 12, color: "#047857", fontSize: 14 }}>Loading patients...</Text>
            </View>
          ) : basePatients.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
              No patients found
            </Text>
          ) : sortedPatients.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
              No patients found matching "{quickSearchQuery}"
            </Text>
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
                  style={[styles.card, styles.shadow, { marginBottom: 12, padding: 12 }]}
                  onPress={() => {
                    setViewingPatient(patient);
                    setShowPatientDetails(true);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Image
                      source={typeof patient.imageUrl === "string" ? { uri: patient.imageUrl } : patient.imageUrl}
                      style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#333', marginBottom: 2 }}>{patient.name}</Text>
                      <Text style={{ fontSize: 12, color: '#666' }}>{patient.email}</Text>
                      <Text style={{ fontSize: 12, color: "#047857", fontWeight: '500' }}>Patient</Text>
                    </View>
                    <ChevronRight size={18} color="#94A3B8" />
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
