import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Appointment } from "../../data/dashboardData";
import { getDoctorAppointmentsByDate, getDoctorAppointments, cancelAppointment, DoctorAppointment } from "../../lib/appointmentService";
import { supabase } from "../../lib/supabase";
import AppointmentEdit from "../appointments/appointmentEdit";
import AppointmentAdd from "../appointments/appointmentAdd";

// Type alias for backwards compatibility
type AppointmentType = Appointment;

// Extended appointment type with account type info and additional fields from DoctorAppointment
type AppointmentWithAccountType = AppointmentType & { 
  accountType?: 'Patient' | 'Dummy',
  patient_avatar?: string,
  dummy_account_id?: string
};

interface AppointmentsTabProps {
  appointments: AppointmentType[];
  onUpdateAppointmentStatus: (appointmentId: string, status: 'scheduled' | 'completed' | 'cancelled' | 'no-show', shouldRemoveFromDashboard?: boolean) => Promise<void>;
  styles: any;
  doctorId?: string;
  onAppointmentCreated?: (patientName: string, service: string, time: string, appointmentId: string, patientId: string, doctorId: string) => void;
  onAppointmentStatusUpdated?: (status: 'completed' | 'cancelled' | 'no-show' | 'declined', patientName: string, appointmentId: string, patientId: string, doctorId: string) => void;
}

export default function AppointmentsTab({
  appointments,
  onUpdateAppointmentStatus,
  styles,
  doctorId: providedDoctorId,
  onAppointmentCreated,
  onAppointmentStatusUpdated,
}: AppointmentsTabProps) {
  console.log('🎯 AppointmentsTab rendered. providedDoctorId:', providedDoctorId);
  
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [appointmentFilterBy, setAppointmentFilterBy] = useState<'all' | 'scheduled' | 'completed' | 'cancelled' | 'no-show'>('all');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Helper to get today's date in YYYY-MM-DD format
  const getTodayFormatted = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to format date as "February 14, 2026"
  const formatDateDisplay = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayFormatted());
  const [loading, setLoading] = useState(false);
  const [fetchedAppointments, setFetchedAppointments] = useState<AppointmentWithAccountType[]>([]);
  const [allMonthAppointments, setAllMonthAppointments] = useState<AppointmentWithAccountType[]>([]);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [doctorId, setDoctorId] = useState<string>('');
  const [clinicSchedule, setClinicSchedule] = useState<any>(null);
  const [blockoutDates, setBlockoutDates] = useState<any[]>([]);

  const STATUS_OPTIONS = ['scheduled', 'completed', 'cancelled', 'no-show'] as const;

  // Log whenever blockoutDates changes
  useEffect(() => {
    if (blockoutDates && blockoutDates.length > 0) {
      console.log('📌 ========== BLOCKOUT DATES UPDATED ==========');
      console.log(`🔴 Total Blocked Dates: ${blockoutDates.length}`);
      blockoutDates.forEach((b, i) => {
        console.log(`   [${i+1}] ${b.blockout_date} - is_blocked: ${b.is_blocked} - reason: ${b.reason}`);
      });
      console.log('🔴 ==========================================');
    } else {
      console.log('⚠️ No blockout dates loaded');
    }
  }, [blockoutDates]);

  // Log whenever doctorId changes
  useEffect(() => {
    console.log('📌 doctorId state changed:', doctorId);
  }, [doctorId]);

  // Helper to get day name from date (e.g., "monday", "tuesday")
  const getDayName = (date: Date): string => {
    const dayIndex = date.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayNames[dayIndex];
  };

  // Initialize doctor ID from prop or auth
  useEffect(() => {
    if (providedDoctorId) {
      console.log('👨‍⚕️ Setting doctorId from props:', providedDoctorId);
      setDoctorId(providedDoctorId);
    } else {
      // Try to get from Supabase auth
      const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          console.log('👨‍⚕️ Setting doctorId from auth:', user.id);
          setDoctorId(user.id);
        }
      };
      getCurrentUser();
    }
  }, [providedDoctorId]);

  // Load clinic schedule from clinic_setup table
  useEffect(() => {
    console.log('⏸️  Clinic schedule useEffect triggered. doctorId:', doctorId);
    
    const loadClinicSchedule = async () => {
      try {
        if (!doctorId) {
          console.warn('⚠️ Cannot load schedule: doctorId is empty');
          return;
        }
        
        console.log('🔄 Loading clinic schedule for doctorId:', doctorId);
        
        // First try: query with filter
        console.log('📋 Attempting query with .eq(user_id)...');
        const { data, error, status } = await supabase
          .from('clinic_setup')
          .select('schedule, user_id')
          .eq('user_id', doctorId);
        
        console.log('📊 [CLINIC_SETUP] Query result - status:', status, 'data.length:', data?.length, 'error:', error?.message, 'error.code:', error?.code);
        
        if (error) {
          console.error('❌ Error loading clinic schedule:', error.message, error.code);
          console.log('💡 This may be an RLS policy issue');
          return;
        }
        
        if (!data || data.length === 0) {
          console.warn('⚠️ Query returned empty results for user:', doctorId);
          console.log('💡 Checking if RLS policies need adjustment...');
          
          // Try alternative: query all and filter client-side
          console.log('📋 [CLINIC_SETUP] Attempting fallback: query all records...');
          const { data: allData, error: allError } = await supabase
            .from('clinic_setup')
            .select('schedule, user_id');
          
          console.log('📊 [CLINIC_SETUP] Fallback query - data.length:', allData?.length, 'error:', allError?.message);
          
          if (allData && allData.length > 0) {
            console.log('📋 [CLINIC_SETUP] Available records:');
            allData.forEach((record: any) => {
              console.log(`   - user_id: ${record.user_id}`);
            });
            
            const userRecord = allData.find((r: any) => r.user_id === doctorId);
            if (userRecord) {
              console.log('🟢 [CLINIC_SETUP] ✅ Found user record in fallback query!');
              if (userRecord.schedule) {
                console.log('✅ Loaded clinic schedule from fallback:', JSON.stringify(userRecord.schedule, null, 2));
                setClinicSchedule(userRecord.schedule);
              }
              return;
            } else {
              console.warn('❌ [CLINIC_SETUP] doctorId not found in fallback results');
            }
          } else {
            console.error('❌ [CLINIC_SETUP] Fallback query also returned empty. RLS may be blocking all reads.');
          }
          
          console.warn('⚠️ No clinic_setup record found for user:', doctorId);
          return;
        }

        const clinicData = data[0];
        if (clinicData.schedule) {
          console.log('✅ Loaded clinic schedule:', JSON.stringify(clinicData.schedule, null, 2));
          console.log('Schedule keys:', Object.keys(clinicData.schedule));
          // Check each day
          Object.entries(clinicData.schedule).forEach(([day, dayData]: [string, any]) => {
            console.log(`  ${day}: isOpen = ${dayData?.isOpen}`);
          });
          setClinicSchedule(clinicData.schedule);
        } else {
          console.warn('⚠️ Schedule field is null/empty in clinic_setup for this user');
        }
        
        // Load blockout dates for this doctor
        console.log('� [BLOCKOUT] Starting to load blockout dates...');
        // Get current authenticated user to ensure RLS policy passes
        const authUserId = doctorId;
        console.log('🔴 [BLOCKOUT] authUserId:', authUserId, 'doctorId:', doctorId);
        
        if (authUserId) {
          console.log('🔴 [BLOCKOUT] Querying blockout_dates with user_id =', authUserId);
          const { data: blockoutData, error: blockoutError, status: blockoutStatus } = await supabase
            .from('clinic_blockout_dates')
            .select('*')
            .eq('user_id', authUserId); // Query by authenticated user ID (required for RLS)
          
          console.log('🔴 [BLOCKOUT] Query result - status:', blockoutStatus, 'error:', blockoutError?.message, 'data.length:', blockoutData?.length);
          
          if (blockoutError) {
            console.error('❌ [BLOCKOUT] Error loading blockout dates:', blockoutError.message, blockoutError.code, 'Status:', blockoutStatus);
          } else if (blockoutData) {
            console.log('🟢 [BLOCKOUT] ✅ Setting', blockoutData.length, 'blockout dates');
            setBlockoutDates(blockoutData);
            blockoutData.forEach(b => {
              console.log(`   🔴 [BLOCKOUT] ${b.blockout_date} - is_blocked: ${b.is_blocked} - reason: ${b.reason}`);
            });
          } else {
            console.warn('🔴 [BLOCKOUT] blockoutData is null');
          }
        } else {
          console.error('🔴 [BLOCKOUT] ❌ Cannot load blockout dates - authUserId is not set');
        }
      } catch (error) {
        console.error('❌ Error loading clinic schedule:', error);
      }
    };
    
    if (doctorId) {
      loadClinicSchedule();
    }
  }, [doctorId]);

  // Transform backend appointments to match UI format
  const transformBackendAppointment = (apt: DoctorAppointment): AppointmentWithAccountType => {
    // Determine account type based on which ID is set
    const accountType = apt.dummy_account_id ? 'Dummy' : 'Patient';
    
    return {
      id: apt.id,
      name: apt.patient_name || 'Unknown Patient',
      service: apt.service || 'General Visit',
      time: apt.appointment_time || '00:00',
      date: apt.appointment_date || '',
      age: 0,
      gender: 'N/A',
      contact: '',
      email: '',
      notes: apt.notes || '',
      imageUrl: 'https://via.placeholder.com/50', // Placeholder
      status: apt.status as any,
      accountType: accountType,
    };
  };

  // Fetch all appointments for the current month on mount and when month changes
  useEffect(() => {
    const fetchMonthAppointments = async () => {
      try {
        // Get first and last day of the month
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const startDate = formatDate(firstDay);
        const endDate = formatDate(lastDay);
        
        // Also reload blockout dates for the current month
        if (doctorId) {
          console.log('� [BLOCKOUT] Reloading blockout dates for month view... doctorId:', doctorId);
          try {
            // Get current authenticated user to ensure RLS policy passes
            const authUserId = doctorId;
            console.log('🔴 [BLOCKOUT] Auth user ID:', authUserId, 'Doctor ID:', doctorId);
            
            if (authUserId) {
              console.log('🔴 [BLOCKOUT] Querying blockout_dates (month view)...');
              const { data: blockoutData, error: blockoutError, status } = await supabase
                .from('clinic_blockout_dates')
                .select('*')
                .eq('user_id', authUserId); // Query by authenticated user ID (required for RLS)
              
              console.log('🔴 [BLOCKOUT] Month view query - status:', status, 'error:', blockoutError?.message, 'data.length:', blockoutData?.length);
              
              if (blockoutError) {
                console.error('❌ [BLOCKOUT] Error fetching blockout dates:', blockoutError.message, blockoutError.code, 'Status:', status);
              } else {
                console.log('🟢 [BLOCKOUT] ✅ Setting', blockoutData?.length || 0, 'blockout dates (month view)');
                if (blockoutData) {
                  setBlockoutDates(blockoutData);
                  blockoutData.forEach(b => {
                    console.log(`   🔴 [BLOCKOUT] ${b.blockout_date} - is_blocked: ${b.is_blocked} - reason: ${b.reason}`);
                  });
                }
              }
            } else {
              console.error('🔴 [BLOCKOUT] ❌ authUserId is not set (month view)');
            }
          } catch (queryError) {
            console.error('❌ [BLOCKOUT] Exception fetching blockout dates:', queryError);
          }
        } else {
          console.warn('⚠️ Cannot fetch blockout dates - doctorId is not set');
        }
        
        // Fetch appointments for the current doctor (dentist_id must match)
        const doctorAppointments = await getDoctorAppointments(doctorId || null, startDate, endDate);
        
        if (doctorAppointments.length > 0) {
          const transformed = doctorAppointments.map(transformBackendAppointment);
          // Filter out declined appointments before storing
          const filtered = transformed.filter(apt => apt.status !== 'declined');
          
          // Log breakdown by status
          const statusBreakdown = {
            scheduled: filtered.filter(apt => apt.status === 'scheduled').length,
            completed: filtered.filter(apt => apt.status === 'completed').length,
            cancelled: filtered.filter(apt => apt.status === 'cancelled').length,
            'no-show': filtered.filter(apt => apt.status === 'no-show').length,
          };
          setAllMonthAppointments(filtered);
        } else {
          setAllMonthAppointments([]);
        }
      } catch (error) {
        console.error('❌ Error in fetchMonthAppointments:', error);
        setAllMonthAppointments([]);
      }
    };

    if (doctorId) {
      fetchMonthAppointments();
    }
  }, [currentMonth, doctorId]);

  // Fetch appointments for the selected date from backend
  useEffect(() => {
    const fetchAppointmentsForDate = async () => {
      try {
        setLoading(true);
        const doctorAppointments = await getDoctorAppointmentsByDate(doctorId || null, selectedDate);
        
        if (doctorAppointments.length > 0) {
          const transformed = doctorAppointments.map(transformBackendAppointment);
          setFetchedAppointments(transformed);
        } else {
          setFetchedAppointments([]);
        }
      } catch (error) {
        setFetchedAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    if (selectedDate && doctorId) {
      fetchAppointmentsForDate();
    }
  }, [selectedDate, doctorId]);

  // Calendar format helper (used throughout component)
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getStatusColor = (status: string) => {
    if (status === 'scheduled') return '#FFC107';
    if (status === 'completed') return '#4CAF50';
    if (status === 'cancelled') return '#F44336';
    if (status === 'no-show') return '#9C27B0';
    return '#999';
  };

  const getFilterBadgeColor = () => {
    if (appointmentFilterBy === 'all') return '#0b7fab';
    if (appointmentFilterBy === 'scheduled') return '#FFC107';
    if (appointmentFilterBy === 'completed') return '#4CAF50';
    if (appointmentFilterBy === 'cancelled') return '#F44336';
    if (appointmentFilterBy === 'no-show') return '#9C27B0';
    return '#0b7fab';
  };

  const getCalendarBadgeColor = () => {
    // Used for calendar badge - matches the filter color
    return getFilterBadgeColor();
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getAppointmentCountForDate = (dateStr: string) => {
    // Use all month appointments for calendar counts
    const appointmentsToUse = allMonthAppointments;
    // Exclude declined appointments from calendar counts
    let appointmentsForDate = appointmentsToUse.filter(apt => apt.date === dateStr && apt.status !== 'declined');
    
    // Apply the active filter to calendar counts
    if (appointmentFilterBy === 'all') {
      // Show all appointments excluding declined
      const count = appointmentsForDate.length;
      console.log(`✅ Calendar count for ${dateStr}: ${count} (filter: all, total appointments: ${appointmentsForDate.map(a => a.status).join(', ') || 'none'})`);
      return count;
    } else if (appointmentFilterBy === 'scheduled') {
      // Show only scheduled/pending appointments
      return appointmentsForDate.filter(apt => apt.status === 'scheduled').length;
    } else if (appointmentFilterBy === 'completed') {
      // Show only completed appointments
      return appointmentsForDate.filter(apt => apt.status === 'completed').length;
    } else if (appointmentFilterBy === 'cancelled') {
      // Show only cancelled appointments
      return appointmentsForDate.filter(apt => apt.status === 'cancelled').length;
    } else if (appointmentFilterBy === 'no-show') {
      // Show only no-show appointments
      return appointmentsForDate.filter(apt => apt.status === 'no-show').length;
    }
    
    return appointmentsForDate.length;
  };

  const isUnavailableDay = (date: Date) => {
    const dateStr = formatDate(date);
    
    // 1. Check specific blockout dates first (highest priority)
    console.log(`🔍 [isUnavailableDay] Checking ${dateStr}... blockoutDates.length = ${blockoutDates.length}`);
    const blockout = blockoutDates.find(b => b.blockout_date === dateStr);
    
    if (blockout) {
      if (blockout.is_blocked) {
        console.log(`🔴 BLOCKED: ${dateStr} (reason: ${blockout.reason})`);
        return true;
      } else {
        console.log(`✅ AVAILABLE: ${dateStr} (override)`);
        return false;
      }
    }
    
    // 2. Check weekly schedule - if day is closed, block all instances of that day
    if (clinicSchedule) {
      const dayName = getDayName(date);
      const daySchedule = clinicSchedule[dayName];
      
      // If the day is marked as closed, it's unavailable
      if (daySchedule && daySchedule.isOpen === false) {
        console.log(`🚫 ${dayName} (${dateStr}) is CLOSED`);
        return true;
      }
    }
    
    return false;
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(formatDate(today));
  };

  // Refresh appointments whenever this tab comes into focus
  useFocusEffect(
    useCallback(() => {
      if (!doctorId) return;
      
      console.log('🔄 AppointmentsTab focused - refreshing all data...');
      setLoading(true);
      
      // Load clinic schedule and blockout dates
      const loadSchedule = async () => {
        try {
          console.log('📅 Loading clinic schedule...');
          const { data, error } = await supabase
            .from('clinic_setup')
            .select('schedule')
            .eq('user_id', doctorId);
          
          console.log('📊 [CLINIC_SETUP] useFocusEffect query - data.length:', data?.length, 'error:', error?.message, 'error.code:', error?.code);
          
          if (error) {
            console.error('❌ Error loading clinic schedule:', error.message);
            return;
          }
          
          if (data && data.length > 0 && data[0].schedule) {
            console.log('✅ Schedule loaded from useFocusEffect');
            setClinicSchedule(data[0].schedule);
          } else {
            console.warn('⚠️ No schedule found in clinic_setup');
          }
          
          // Load blockout dates
          console.log('� [BLOCKOUT] Loading blockout dates from useFocusEffect...');
          // Load blockout dates - use doctorId directly
          const authUserId = doctorId;
          
          if (authUserId) {
            console.log('🔴 [BLOCKOUT] Querying blockout_dates (useFocusEffect)...');
            const { data: blockoutData, error: blockoutError, status: blockoutStatus } = await supabase
              .from('clinic_blockout_dates')
              .select('*')
              .eq('user_id', authUserId); // Query by authenticated user ID (required for RLS)
            
            console.log('🔴 [BLOCKOUT] useFocusEffect query - status:', blockoutStatus, 'error:', blockoutError?.message, 'data.length:', blockoutData?.length);
            
            if (blockoutError) {
              console.error('❌ [BLOCKOUT] Error loading blockout dates:', blockoutError.message, blockoutError.code, 'Status:', blockoutStatus);
            } else if (blockoutData) {
              console.log('🟢 [BLOCKOUT] ✅ Setting', blockoutData.length, 'blockout dates (useFocusEffect)');
              setBlockoutDates(blockoutData);
              blockoutData.forEach(b => {
                console.log(`   🔴 [BLOCKOUT] ${b.blockout_date} - is_blocked: ${b.is_blocked} - reason: ${b.reason}`);
              });
            } else {
              console.warn('🔴 [BLOCKOUT] blockoutData is null (useFocusEffect)');
            }
          } else {
            console.error('🔴 [BLOCKOUT] ❌ authUserId is not set (useFocusEffect)');
          }
        } catch (error) {
          console.error('❌ Error in loadSchedule:', error);
        }
      };
      
      loadSchedule();
      
      // Refresh both month and daily appointments
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      
      const startDate = formatDate(firstDay);
      const endDate = formatDate(lastDay);
      
      let monthFetched = false;
      let dayFetched = false;
      
      const checkBothComplete = () => {
        if (monthFetched && dayFetched) {
          setLoading(false);
        }
      };
      
      // Fetch month appointments
      getDoctorAppointments(doctorId, startDate, endDate).then(doctorAppointments => {
        if (doctorAppointments.length > 0) {
          const transformed = doctorAppointments.map(transformBackendAppointment);
          setAllMonthAppointments(transformed);
          console.log(`✅ Refreshed ${transformed.length} appointments for the month`);
        } else {
          setAllMonthAppointments([]);
        }
        monthFetched = true;
        checkBothComplete();
      });
      
      // Fetch daily appointments
      getDoctorAppointmentsByDate(doctorId, selectedDate).then(doctorAppointments => {
        if (doctorAppointments.length > 0) {
          const transformed = doctorAppointments.map(transformBackendAppointment);
          setFetchedAppointments(transformed);
          console.log(`✅ Refreshed ${transformed.length} appointments for ${selectedDate}`);
        } else {
          setFetchedAppointments([]);
        }
        dayFetched = true;
        checkBothComplete();
      });
    }, [currentMonth, selectedDate, doctorId])
  );

  // Handler to cancel appointment using backend service
  const handleCancelAppointmentFromBackend = async (appointmentId: string, appointmentName: string) => {
    Alert.alert(
      "Cancel Appointment",
      `Are you sure you want to cancel the appointment with ${appointmentName}?`,
      [
        { text: "Keep", onPress: () => {}, style: "cancel" },
        {
          text: "Cancel Appointment",
          onPress: async () => {
            try {
              const result = await cancelAppointment(appointmentId);
              if (result.success) {
                Alert.alert("✅ Success", result.message);
                
                // Auto-switch to 'all' filter to show the cancelled appointment
                console.log('🔄 Switching filter to "All" to show cancelled appointment...');
                setAppointmentFilterBy('all');
                
                // Refresh appointments after cancellation
                console.log('🔄 Refreshing appointments after cancellation...');
                if (!doctorId) return;
                
                // Refresh current day appointments
                const doctorAppointments = await getDoctorAppointmentsByDate(doctorId, selectedDate);
                if (doctorAppointments.length > 0) {
                  const transformed = doctorAppointments.map(transformBackendAppointment);
                  setFetchedAppointments(transformed);
                } else {
                  setFetchedAppointments([]);
                }
                console.log(`✅ Day appointments refreshed - now showing ${doctorAppointments.length} appointments with filter 'all'`);
                
                // Also refresh entire month appointments for calendar
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const startDate = formatDate(firstDay);
                const endDate = formatDate(lastDay);
                
                const monthAppointments = await getDoctorAppointments(doctorId, startDate, endDate);
                if (monthAppointments.length > 0) {
                  const transformed = monthAppointments.map(transformBackendAppointment);
                  // Filter out declined appointments before storing
                  const filtered = transformed.filter(apt => apt.status !== 'declined');
                  
                  // Log breakdown by status to verify cancelled appointments are included
                  const statusBreakdown = {
                    scheduled: filtered.filter(apt => apt.status === 'scheduled').length,
                    completed: filtered.filter(apt => apt.status === 'completed').length,
                    cancelled: filtered.filter(apt => apt.status === 'cancelled').length,
                    'no-show': filtered.filter(apt => apt.status === 'no-show').length,
                  };
                  console.log('📊 Status breakdown after cancellation:', statusBreakdown);
                  
                  setAllMonthAppointments(filtered);
                } else {
                  setAllMonthAppointments([]);
                }
                console.log(`✅ Month appointments refreshed - calendar updated`);
              } else {
                Alert.alert("❌ Error", result.message);
              }
            } catch (error) {
              console.error("❌ Error cancelling appointment:", error);
              Alert.alert("❌ Error", "Failed to cancel appointment. Please try again.");
            }
          },
          style: "destructive",
        },
      ]
    );
  };

  // Handler to open AppointmentEdit modal
  const handleEditAppointment = (appointment: any) => {
    console.log('🔧 Opening appointment edit modal for:', appointment.id);
    // Ensure appointment has appointment_date and appointment_time fields for AppointmentEdit component
    // (these were mapped to 'date' and 'time' during transformation)
    const appointmentForModal = {
      ...appointment,
      appointment_date: appointment.date, // Restore appointment_date field from 'date'
      appointment_time: appointment.time, // Restore appointment_time field from 'time'
    };
    console.log('📋 Appointment data for modal:', appointmentForModal);
    console.log('📋 appointment_date:', appointmentForModal.appointment_date);
    console.log('📋 appointment_time:', appointmentForModal.appointment_time);
    setEditingAppointment(appointmentForModal);
    setShowEditModal(true);
  };

  // Handler after appointment is saved in edit modal
  const handleSaveAppointment = async () => {
    console.log('✅ Appointment saved, refreshing appointments...');
    if (!doctorId) return;
    
    // Reload appointments for the selected date
    const dayAppointments = await getDoctorAppointmentsByDate(doctorId, selectedDate);
    if (dayAppointments.length > 0) {
      const transformed = dayAppointments.map(transformBackendAppointment);
      setFetchedAppointments(transformed);
    } else {
      setFetchedAppointments([]);
    }
    
    // Also reload month appointments for calendar
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = formatDate(firstDay);
    const endDate = formatDate(lastDay);
    
    const monthAppointments = await getDoctorAppointments(doctorId, startDate, endDate);
    if (monthAppointments.length > 0) {
      const transformed = monthAppointments.map(transformBackendAppointment);
      setAllMonthAppointments(transformed);
    }
  };

  // Refresh button handler - fetches latest appointments from Supabase
  const handleRefreshAppointments = async () => {
    try {
      if (!doctorId) {
        Alert.alert('Error', 'Doctor ID not found');
        return;
      }
      
      setLoading(true);
      console.log('🔄 Refreshing appointments...');
      
      // Refresh month appointments for calendar
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDate = formatDate(firstDay);
      const endDate = formatDate(lastDay);
      
      const monthAppointments = await getDoctorAppointments(doctorId, startDate, endDate);
      if (monthAppointments.length > 0) {
        const transformed = monthAppointments.map(transformBackendAppointment);
        // Filter out declined appointments before storing
        const filtered = transformed.filter(apt => apt.status !== 'declined');
        
        // Log breakdown by status
        const statusBreakdown = {
          scheduled: filtered.filter(apt => apt.status === 'scheduled').length,
          completed: filtered.filter(apt => apt.status === 'completed').length,
          cancelled: filtered.filter(apt => apt.status === 'cancelled').length,
          'no-show': filtered.filter(apt => apt.status === 'no-show').length,
        };
        console.log('📊 Status breakdown on refresh:', statusBreakdown);
        
        setAllMonthAppointments(filtered);
      } else {
        setAllMonthAppointments([]);
      }
      console.log(`✅ Month appointments refreshed: ${monthAppointments.length} appointments found`);
      
      // Refresh daily appointments for selected date
      const dayAppointments = await getDoctorAppointmentsByDate(doctorId, selectedDate);
      if (dayAppointments.length > 0) {
        const transformed = dayAppointments.map(transformBackendAppointment);
        setFetchedAppointments(transformed);
      } else {
        setFetchedAppointments([]);
      }
      console.log(`✅ Daily appointments refreshed: ${dayAppointments.length} appointments found`);
      
      Alert.alert('✅ Refreshed', 'Appointments updated successfully!');
    } catch (error) {
      console.error('❌ Error refreshing appointments:', error);
      Alert.alert('❌ Error', 'Failed to refresh appointments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handler for when a new appointment is added
  const handleAddAppointmentSaved = async () => {
    console.log('✅ New appointment created, refreshing appointments...');
    if (!doctorId) return;
    
    // Refresh current day appointments
    const dayAppointments = await getDoctorAppointmentsByDate(doctorId, selectedDate);
    if (dayAppointments.length > 0) {
      const transformed = dayAppointments.map(transformBackendAppointment);
      setFetchedAppointments(transformed);
    } else {
      setFetchedAppointments([]);
    }
    
    // Also refresh entire month appointments for calendar
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = formatDate(firstDay);
    const endDate = formatDate(lastDay);
    
    const monthAppointments = await getDoctorAppointments(doctorId, startDate, endDate);
    if (monthAppointments.length > 0) {
      const transformed = monthAppointments.map(transformBackendAppointment);
      setAllMonthAppointments(transformed);
    }
  };

  // Filter appointments - only use real Supabase data (no fallback to sample data)
  const appointmentsToDisplay = fetchedAppointments;
  const filteredAppointments = appointmentsToDisplay.filter((apt) => {
    // Exclude declined appointments from display
    if (apt.status === 'declined') {
      return false;
    }

    const matchesSearch =
      apt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.service.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.contact.includes(searchQuery);

    const matchesDate = selectedDate ? apt.date === selectedDate : true;

    // Apply status filter
    if (appointmentFilterBy === 'all') {
      return matchesSearch && matchesDate;
    } else if (appointmentFilterBy === 'scheduled') {
      return matchesSearch && matchesDate && apt.status === 'scheduled';
    } else if (appointmentFilterBy === 'completed') {
      return matchesSearch && matchesDate && apt.status === 'completed';
    } else if (appointmentFilterBy === 'cancelled') {
      return matchesSearch && matchesDate && apt.status === 'cancelled';
    } else if (appointmentFilterBy === 'no-show') {
      return matchesSearch && matchesDate && apt.status === 'no-show';
    }
    return matchesSearch && matchesDate;
  });

  // DEBUG: Log appointments to display and filter details
  console.log('\n=== FILTER DEBUG ===');
  console.log(`Filter: "${appointmentFilterBy}"`);
  console.log(`Total appointments available: ${appointmentsToDisplay.length}`);
  if (appointmentsToDisplay.length > 0) {
    console.log('Appointments to display:');
    appointmentsToDisplay.forEach((apt, idx) => {
      console.log(`  [${idx}] ${apt.name} - status: "${apt.status}"`);
    });
  }
  console.log(`After filtering: ${filteredAppointments.length} appointments match filter`);
  console.log('===================\n');


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f8ff" }}>
      <ScrollView style={{ flex: 1 }}>
        {/* Title Section */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#0b7fab', marginTop: 15 }}>Appointments</Text>
          <Text style={{ fontSize: 13, color: '#666', marginTop: 4 }}>Manage your patient appointments</Text>
        </View>

        {/* Header Section with Search and Filters */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => setShowAddModal(true)}
              disabled={loading}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: loading ? '#ccc' : '#4CAF50',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 14, color: '#fff', fontWeight: '600' }}>Add</Text>
            </TouchableOpacity>

            {/* Refresh Button */}
            <TouchableOpacity
              onPress={handleRefreshAppointments}
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
              <Image
                source={require('../../assets/images/icon/refresh.png')}
                style={{
                  width: 18,
                  height: 18,
                  resizeMode: 'contain',
                  opacity: loading ? 0.6 : 1,
                }}
              />
            </TouchableOpacity>
          </View>
          
          <TextInput
            style={{
              backgroundColor: '#fff',
              borderColor: '#0b7fab',
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 14,
              color: '#333',
              marginBottom: 12,
            }}
            placeholder="Search by name, service, email, contact..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>Filter:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setAppointmentFilterBy('all')}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: appointmentFilterBy === 'all' ? '#0b7fab' : '#e0e0e0',
                    borderWidth: 1,
                    borderColor: appointmentFilterBy === 'all' ? '#0b7fab' : '#ccc',
                  }}
                >
                  <Text style={{ fontSize: 12, color: appointmentFilterBy === 'all' ? '#fff' : '#333', fontWeight: '500' }}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAppointmentFilterBy('scheduled')}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: appointmentFilterBy === 'scheduled' ? '#0b7fab' : '#e0e0e0',
                    borderWidth: 1,
                    borderColor: appointmentFilterBy === 'scheduled' ? '#0b7fab' : '#ccc',
                  }}
                >
                  <Text style={{ fontSize: 12, color: appointmentFilterBy === 'scheduled' ? '#fff' : '#333', fontWeight: '500' }}>Pending</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAppointmentFilterBy('completed')}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: appointmentFilterBy === 'completed' ? '#0b7fab' : '#e0e0e0',
                    borderWidth: 1,
                    borderColor: appointmentFilterBy === 'completed' ? '#0b7fab' : '#ccc',
                  }}
                >
                  <Text style={{ fontSize: 12, color: appointmentFilterBy === 'completed' ? '#fff' : '#333', fontWeight: '500' }}>Completed</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAppointmentFilterBy('cancelled')}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: appointmentFilterBy === 'cancelled' ? '#0b7fab' : '#e0e0e0',
                    borderWidth: 1,
                    borderColor: appointmentFilterBy === 'cancelled' ? '#0b7fab' : '#ccc',
                  }}
                >
                  <Text style={{ fontSize: 12, color: appointmentFilterBy === 'cancelled' ? '#fff' : '#333', fontWeight: '500' }}>Cancelled</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAppointmentFilterBy('no-show')}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    backgroundColor: appointmentFilterBy === 'no-show' ? '#0b7fab' : '#e0e0e0',
                    borderWidth: 1,
                    borderColor: appointmentFilterBy === 'no-show' ? '#0b7fab' : '#ccc',
                  }}
                >
                  <Text style={{ fontSize: 12, color: appointmentFilterBy === 'no-show' ? '#fff' : '#333', fontWeight: '500' }}>No-show</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          {/* Calendar View */}
          <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 12, borderColor: '#ddd', borderWidth: 1 }}>
            {/* Month Navigation */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <TouchableOpacity onPress={goToPreviousMonth} style={{ padding: 8 }}>
                <Text style={{ fontSize: 18, color: '#0b7fab', fontWeight: 'bold' }}>‹</Text>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#333' }}>
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity onPress={goToToday} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#e3f2fd', borderRadius: 4 }}>
                  <Text style={{ fontSize: 11, color: '#0b7fab', fontWeight: 'bold' }}>Today</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={goToNextMonth} style={{ padding: 8 }}>
                <Text style={{ fontSize: 18, color: '#0b7fab', fontWeight: 'bold' }}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Weekday Headers */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => {
                // Check if this day is closed based on clinic schedule
                let isClosed = false;
                if (clinicSchedule) {
                  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                  const dayName = dayNames[index];
                  const daySchedule = clinicSchedule[dayName];
                  isClosed = daySchedule && daySchedule.isOpen === false;
                }
                
                return (
                  <Text key={day} style={{ fontSize: 11, fontWeight: 'bold', color: isClosed ? '#ff6b6b' : '#666', width: '14.28%', textAlign: 'center', opacity: isClosed ? 0.7 : 1 }}>
                    {day}
                  </Text>
                );
              })}
            </View>

            {/* Calendar Days */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {Array.from({ length: getFirstDayOfMonth(currentMonth) }).map((_, index) => (
                <View key={`empty-${index}`} style={{ width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' }} />
              ))}
              {Array.from({ length: getDaysInMonth(currentMonth) }).map((_, index) => {
                const day = index + 1;
                const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const dateStr = formatDate(date);
                const appointmentCount = getAppointmentCountForDate(dateStr);
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === formatDate(new Date());
                
                // Debug log for specific dates
                if (dateStr === '2026-04-18' || dateStr === '2026-04-24') {
                  console.log(`📍 [RENDER] Checking ${dateStr} - blockoutDates.length: ${blockoutDates?.length}`);
                }
                
                const isUnavailable = isUnavailableDay(date);
                
                // Check if this date is specifically blocked (not just closed by schedule)
                const blockoutEntry = blockoutDates.find(b => b.blockout_date === dateStr && b.is_blocked);
                const isBlockedSpecific = !!blockoutEntry;

                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => !isUnavailable && setSelectedDate(dateStr)}
                    disabled={isUnavailable}
                    style={{
                      width: '14.28%',
                      aspectRatio: 1,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderRadius: 6,
                      backgroundColor: isBlockedSpecific ? '#ffebee' : isUnavailable ? '#f0f0f0' : isSelected ? '#0b7fab' : isToday ? '#e3f2fd' : '#f9f9f9',
                      borderWidth: isBlockedSpecific ? 2 : isUnavailable ? 1 : isToday ? 2 : 0,
                      borderColor: isBlockedSpecific ? '#d32f2f' : isUnavailable ? '#ddd' : isToday ? '#0b7fab' : 'transparent',
                      opacity: isUnavailable ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: isSelected ? 'bold' : '600', color: isBlockedSpecific ? '#d32f2f' : isUnavailable ? '#ccc' : isSelected ? '#fff' : '#333', textDecorationLine: isUnavailable ? 'line-through' : 'none' }}>
                      {day}
                    </Text>
                    {isBlockedSpecific && (
                      <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#d32f2f', marginTop: 1 }}>
                        🔒
                      </Text>
                    )}
                    {!isUnavailable && appointmentCount > 0 && (
                      <View
                        style={{
                          backgroundColor: isSelected ? '#fff' : getCalendarBadgeColor(),
                          borderRadius: 8,
                          width: 14,
                          height: 14,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginTop: 2,
                        }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: isSelected ? getCalendarBadgeColor() : '#fff' }}>
                          {appointmentCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Appointments List */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 }}>
          {selectedDate && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0b7fab', paddingBottom: 8 }}>
                {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
          )}
          {loading ? (
            <Text style={{ textAlign: 'center', color: '#0b7fab', marginTop: 20, fontSize: 14, fontWeight: 'bold' }}>
              ⏳ Loading appointments...
            </Text>
          ) : filteredAppointments.length === 0 ? (
            <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
              {searchQuery ? `No appointments found matching "${searchQuery}"` : selectedDate ? 'No appointments on this date' : 'No appointments found'}
            </Text>
          ) : (
          filteredAppointments.map((appointment) => (
            <View
              key={appointment.id}
              style={[styles.card, styles.shadow, { marginBottom: 12, padding: 12 }]}
            >
              {/* Row 1: Image + (Name + Status) + Edit Button */}
              <View style={{ flexDirection: 'row', alignItems: 'center'}}>
                <Image
                  source={
                    appointment.patient_avatar
                      ? { uri: appointment.patient_avatar }
                      : require('../../assets/images/user.png')
                  }
                  style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#333' }}>{appointment.name}</Text>
                    {/* Status Badge */}
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 10,
                        backgroundColor: getStatusColor(appointment.status || 'scheduled'),
                      }}
                    >
                      <Text style={{ fontSize: 10, color: '#fff', fontWeight: 'bold' }}>
                        {appointment.status === 'scheduled' ? 'Pending' :
                         appointment.status === 'completed' ? 'Completed' :
                         appointment.status === 'cancelled' ? 'Cancelled' : 'No-show'}
                      </Text>
                    </View>
                  </View>
                  {/* Account Type Badge Below Name */}
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor: appointment.accountType === 'Dummy' ? '#fff3e0' : '#e3f2fd',
                      borderWidth: 1,
                      borderColor: appointment.accountType === 'Dummy' ? '#f57c00' : '#0b7fab',
                      alignSelf: 'flex-start',
                      marginBottom: 6,
                    }}
                  >
                    <Text style={{ fontSize: 9, color: appointment.accountType === 'Dummy' ? '#f57c00' : '#0b7fab', fontWeight: '600' }}>
                      {appointment.accountType === 'Dummy' ? 'Dummy Account' : 'Patient'}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>{appointment.service}</Text>
                  <Text style={{ fontSize: 11, color: '#999' }}>
                    {formatDateDisplay(selectedDate)} at {appointment.time}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleEditAppointment(appointment)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    backgroundColor: '#0b7fab',
                    borderRadius: 6,
                    marginLeft: 8,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
          )}
        </View>
      </ScrollView>

      {/* AppointmentEdit Modal */}
      {editingAppointment && (
        <AppointmentEdit
          visible={showEditModal}
          appointment={editingAppointment}
          doctorId={doctorId}
          onClose={() => {
            setShowEditModal(false);
            setEditingAppointment(null);
          }}
          onSave={handleSaveAppointment}
          onAppointmentStatusUpdated={onAppointmentStatusUpdated}
        />
      )}

      {/* AppointmentAdd Modal */}
      <AppointmentAdd
        visible={showAddModal}
        doctorId={doctorId}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddAppointmentSaved}
        onAppointmentCreated={onAppointmentCreated}
      />
    </SafeAreaView>
  );
}
