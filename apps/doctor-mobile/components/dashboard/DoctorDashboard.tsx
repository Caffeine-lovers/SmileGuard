import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  Animated,
  ActivityIndicator,
  ScrollView as RNScrollView,
  BackHandler,
  Platform,
  ToastAndroid,
} from "react-native";
import AppointmentCard from "./AppointmentCard";
import AppointmentEdit from "../appointments/appointmentEdit";
import AppointmentRequestPromptModal from "../appointments/AppointmentRequestPromptModal";
import { useFocusEffect, useRouter } from "expo-router";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useClinic } from "../../contexts/ClinicContext";
import StatCard from "./StatCard";
import LeftNavRail, { NAV_RAIL_WIDTH } from "../navigation/LeftNavRail";
import NotificationBell from "./NotificationBell";
import NotificationCenter from "./NotificationCenter";
import PatientDetailsView from "../patientrecord/PatientDetailsView";
import RecordsTab from "../navigation/RecordsTab";
import AppointmentsTab from "../navigation/AppointmentsTab";
import AppointmentsRequestTab from "../navigation/AppointmentsRequestTab";
import BillingTab from "../navigation/BillingTab";
import SettingsTab from "../navigation/SettingsTab";
import { updateDoctorAppointmentStatus, getDoctorAppointments, getAppointmentRequests, getAppointmentById } from "../../lib/appointmentService";
import { getPatientMedicalInfo } from "../../lib/profilesPatients";
import * as dashboardService from "../../lib/dashboardService";
import { getDoctorProfile, isDoctorGuideCompleted, markDoctorGuideCompleted, setDoctorGuideCompleted } from "../../lib/doctorService";
import { getDoctorFullName, getDoctorPrefix, getDoctorTitleName } from "@smileguard/shared-types";
import { supabase } from '@smileguard/supabase-client';
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppTour, { useTourTargets, TourStep } from "../tour/AppTour";
import { getStatusColor, getStatusBgColor } from "../../lib/statusHelpers";
import { formatDateOfBirth, formatAppointmentDate, formatAppointmentTime } from "../../lib/dateFormatters";
import { useNotifications } from "../../hooks/useNotifications";
import { Notification, NotificationType } from "../../types/notifications";
import { CurrentUser, Appointment as SupabaseAppointment } from "@smileguard/shared-types";
import {
  Stethoscope,
  X,
  Check,
  Activity,
  ShieldCheck,
  Menu,
  RefreshCw,
  Calendar,
  CalendarDays,
  Users,
  CreditCard,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Clock,
  LayoutDashboard,
  Bell,
  Sparkles,
  FileText,
  Phone,
  Compass,
  CheckCircle2
} from "lucide-react-native";
import { AppColors } from "../../constants/theme";
import {
  SERVICE_OPTIONS,
  GENDER_OPTIONS,
  TIME_OPTIONS,
  getToday,
} from "../../data/dashboardData";

const APP_LOGO = require('../../assets/images/SmileGuard-Doc-Logo.png');

// Type definitions
export interface DashboardAppointment {
  id: string;
  name: string;
  service: string;
  time: string;
  date: string;
  age: number;
  gender: string;
  contact: string;
  email: string;
  notes: string;
  imageUrl: string | number;
  initials?: string;
  status?: 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined';
  patient_id?: string;
  dentist_id?: string | null;
  medicalIntake?: any;
  doctor_note?: string;
  created_at?: string;
  rescheduled_by?: string | null;
  rescheduled_at?: string | null;
  reschedule_at?: string | null;
}

interface DoctorDashboardProps {
  user: CurrentUser;
  onLogout: () => void;
  promptAppointmentId?: string;
}

export default function DoctorDashboard({ user, onLogout, promptAppointmentId }: DoctorDashboardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { clinic, loading: clinicLoading } = useClinic();

  // ─────────────────────────────────────────
  // NOTIFICATION SYSTEM
  // ─────────────────────────────────────────
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const refreshRef = useRef<(() => void) | null>(null);

  const handleIncomingNotification = useCallback((notification: any) => {
    console.log('[DoctorDashboard] Incoming notification popped:', notification.title);
    // When appointment, paid bill, or new patient registration arrives, auto refresh dashboard data
    if (
      notification.type.startsWith('appointment-') ||
      notification.type === 'bill-paid' ||
      notification.type === 'billing-paid' ||
      notification.type === 'patient-registered'
    ) {
      refreshRef.current?.();
    }
  }, []);

  const notificationState = useNotifications(user?.id, true, handleIncomingNotification);

  // Doctor profile state
  const [doctorProfile, setDoctorProfile] = useState<CurrentUser & { first_name?: string; middle_name?: string; last_name?: string; doctor_name?: string; gender?: string }>(user);

  // Sync when user prop updates
  useEffect(() => {
    if (user) {
      setDoctorProfile(prev => ({
        ...user,
        ...prev,
        gender: prev.gender || (user as any).gender,
        first_name: prev.first_name || (user as any).first_name,
        last_name: prev.last_name || (user as any).last_name,
      }));
    }
  }, [user]);

  // Loading states
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingOnTabSwitch, setLoadingOnTabSwitch] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appointmentRequests, setAppointmentRequests] = useState<DashboardAppointment[]>([]);

  // Track read/deleted status for synthesized request notifications
  const [readRequestIds, setReadRequestIds] = useState<Set<string>>(new Set());
  const [deletedRequestIds, setDeletedRequestIds] = useState<Set<string>>(new Set());

  const mergedNotifications = useMemo(() => {
    const list: Notification[] = [...notificationState.notifications];
    const existingIds = new Set(
      list.map((n: Notification) => n.data?.appointmentId || n.id).filter(Boolean)
    );

    appointmentRequests.forEach((req) => {
      const syntheticId = `req-${req.id}`;
      if (
        !existingIds.has(req.id) &&
        !existingIds.has(syntheticId) &&
        !deletedRequestIds.has(syntheticId)
      ) {
        list.push({
          id: syntheticId,
          type: 'appointment-created' as NotificationType,
          title: 'New Appointment Request',
          message: `${req.name} requested an appointment for ${req.service || 'Dental Care'}.`,
          timestamp: req.created_at ? new Date(req.created_at) : new Date(),
          read: readRequestIds.has(syntheticId),
          data: {
            appointmentId: req.id,
            patientName: req.name,
            service: req.service,
            appointmentDate: formatAppointmentDate(req.date),
            appointmentTime: formatAppointmentTime(req.time),
          },
        });
      }
    });

    return list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [notificationState.notifications, appointmentRequests, readRequestIds, deletedRequestIds]);

  const totalUnreadCount = useMemo(() => {
    return mergedNotifications.filter((n: Notification) => !n.read).length;
  }, [mergedNotifications]);

  const handleMarkAsRead = useCallback((id: string) => {
    if (id.startsWith('req-')) {
      setReadRequestIds((prev) => new Set([...prev, id]));
    } else {
      notificationState.actions.markAsRead(id);
    }
  }, [notificationState.actions]);

  const handleMarkAllAsRead = useCallback(() => {
    setReadRequestIds(new Set(mergedNotifications.map((n: Notification) => n.id)));
    notificationState.actions.markAllAsRead();
  }, [mergedNotifications, notificationState.actions]);

  const handleDeleteNotification = useCallback((id: string) => {
    if (id.startsWith('req-')) {
      setDeletedRequestIds((prev) => new Set([...prev, id]));
    } else {
      notificationState.actions.deleteNotification(id);
    }
  }, [notificationState.actions]);

  const handleClearAll = useCallback(() => {
    setDeletedRequestIds(new Set(mergedNotifications.map((n: Notification) => n.id)));
    notificationState.actions.clearAll();
  }, [mergedNotifications, notificationState.actions]);

  // Push notification prompt modal state
  const [promptAppointment, setPromptAppointment] = useState<DashboardAppointment | null>(null);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [loadingPromptAppointment, setLoadingPromptAppointment] = useState(false);

  // Handle profile updates
  const handleUpdateProfile = (updatedData: any) => {
    console.log('[DoctorDashboard] handleUpdateProfile called with:', updatedData);
    const fullName = getDoctorFullName(updatedData);
    setDoctorProfile(prev => ({
      ...prev,
      ...updatedData,
      first_name: updatedData.first_name !== undefined ? updatedData.first_name : prev.first_name,
      middle_name: updatedData.middle_name !== undefined ? updatedData.middle_name : prev.middle_name,
      last_name: updatedData.last_name !== undefined ? updatedData.last_name : prev.last_name,
      gender: updatedData.gender !== undefined ? updatedData.gender : prev.gender,
      doctor_name: fullName || updatedData.doctor_name || prev.doctor_name,
      name: fullName || updatedData.doctor_name || updatedData.name || prev.name,
    }));
  };

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnimatedValue = useRef(new Animated.Value(-280)).current;

  useEffect(() => {
    Animated.timing(sidebarAnimatedValue, {
      toValue: sidebarOpen ? 0 : -280,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [sidebarOpen, sidebarAnimatedValue]);

  // Patient viewing state
  const [patientSortBy, setPatientSortBy] = useState<'name' | 'date' | 'service'>('name');
  const [patientSortOrder, setPatientSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const [expandPatientDetails, setExpandPatientDetails] = useState(false);
  const [viewingPatient, setViewingPatient] = useState<DashboardAppointment | null>(null);
  const [showQuickPatientSearch, setShowQuickPatientSearch] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'appointments' | 'appointment-requests' | 'billing' | 'settings'>('dashboard');
  const [tabHistory, setTabHistory] = useState<('dashboard' | 'records' | 'appointments' | 'appointment-requests' | 'billing' | 'settings')[]>([]);
  const lastBackPressRef = useRef<number>(0);

  // Appointment status edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);

  // App tour state
  const [tourVisible, setTourVisible] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [recordsTourTrigger, setRecordsTourTrigger] = useState(0);
  const [appointmentsTourTrigger, setAppointmentsTourTrigger] = useState(0);
  const [requestsTourTrigger, setRequestsTourTrigger] = useState(0);
  const [billingTourTrigger, setBillingTourTrigger] = useState(0);

  // Tab-specific refresh triggers
  const [recordsRefreshTrigger, setRecordsRefreshTrigger] = useState(0);
  const [appointmentsRefreshTrigger, setAppointmentsRefreshTrigger] = useState(0);
  const [requestsRefreshTrigger, setRequestsRefreshTrigger] = useState(0);
  const [billingRefreshTrigger, setBillingRefreshTrigger] = useState(0);

  // Hierarchical back handler & tab navigation
  const navigateToTab = useCallback((nextTab: 'dashboard' | 'records' | 'appointments' | 'appointment-requests' | 'billing' | 'settings') => {
    if (nextTab === activeTab) return;
    setTabHistory(prev => {
      if (nextTab === 'dashboard') {
        return [];
      }
      const filtered = prev.filter(t => t !== nextTab);
      return [...filtered, activeTab];
    });
    setActiveTab(nextTab);

    // Refresh the specific tab when clicked (or whole dashboard on dashboard)
    if (nextTab === 'dashboard') {
      refreshDashboardData();
    } else if (nextTab === 'billing') {
      setBillingRefreshTrigger(prev => prev + 1);
    } else if (nextTab === 'appointments') {
      setAppointmentsRefreshTrigger(prev => prev + 1);
    } else if (nextTab === 'records') {
      setRecordsRefreshTrigger(prev => prev + 1);
    } else if (nextTab === 'appointment-requests') {
      setRequestsRefreshTrigger(prev => prev + 1);
    }
  }, [activeTab]);

  const handleGoBack = useCallback(() => {
    // 1. If sidebar drawer is open, close it
    if (sidebarOpen) {
      setSidebarOpen(false);
      return true;
    }

    // 2. If app tour is visible, dismiss it
    if (tourVisible) {
      setTourVisible(false);
      return true;
    }

    // 3. If notification center is open, close it
    if (showNotificationCenter) {
      setShowNotificationCenter(false);
      return true;
    }

    // 4. If appointment status edit modal is open, close it
    if (showEditModal) {
      setShowEditModal(false);
      setEditingAppointment(null);
      return true;
    }

    // 5. If patient details view is open, close it
    if (showPatientDetails) {
      setShowPatientDetails(false);
      setViewingPatient(null);
      return true;
    }

    // 6. If quick patient search is active, dismiss it
    if (showQuickPatientSearch) {
      setShowQuickPatientSearch(false);
      setQuickSearchQuery("");
      return true;
    }

    // 7. If on a tab other than 'dashboard', go back respectively in tab history
    if (activeTab !== 'dashboard') {
      if (tabHistory.length > 0) {
        const prevTab = tabHistory[tabHistory.length - 1];
        setTabHistory(prev => prev.slice(0, prev.length - 1));
        setActiveTab(prevTab);
      } else {
        setActiveTab('dashboard');
      }
      return true;
    }

    // 8. On root dashboard with no overlays: double press to exit
    const now = Date.now();
    if (now - lastBackPressRef.current < 2000) {
      return false; // Exit app
    }
    lastBackPressRef.current = now;
    if (Platform.OS === 'android') {
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
    }
    return true;
  }, [
    sidebarOpen,
    tourVisible,
    showNotificationCenter,
    showEditModal,
    showPatientDetails,
    showQuickPatientSearch,
    activeTab,
    tabHistory,
  ]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => handleGoBack();
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );
      return () => subscription.remove();
    }, [handleGoBack])
  );

  // ─────────────────────────────────────────
  // INTERACTIVE APP TOUR SYSTEM
  // ─────────────────────────────────────────
  const tour = useTourTargets();
  const dashboardScrollRef = useRef<any>(null);
  const dashboardColumnsLayoutY = useRef<number>(0);
  const patientDetailsLayoutY = useRef<number>(0);

  const tourSteps: TourStep[] = [
    {
      id: "welcome",
      title: "Welcome to SmileGuard Doctor!",
      description: "Your digital dental clinic command center. Let's take a quick 1-minute walkthrough to show you how navigation and daily workflows work.",
      icon: Stethoscope,
      placement: "center",
      onEnter: () => setSidebarOpen(false),
    },
    {
      id: "menu-btn",
      target: "menu-btn",
      title: "Clinic Menu",
      description: "Use this bar on the left anytime to switch between clinic sections, restart the guide, or log out.",
      icon: Menu,
      padding: 6,
      radius: 12,
      onEnter: () => setSidebarOpen(false),
    },
    {
      id: "sidebar-nav",
      target: "sidebar-nav",
      title: "Clinic Sections & Tools",
      description: "Easily open Patient Records, Appointments, Booking Requests, Billings, and Clinic Settings.",
      icon: LayoutDashboard,
      padding: 6,
      radius: 14,
      onEnter: () => setSidebarOpen(false),
      delay: 450,
    },
    {
      id: "notifications-btn",
      target: "notifications-btn",
      title: "Live Patient Notifications",
      description: "Get notifications whenever patients book online, request schedule changes, or submit their health history.",
      icon: Bell,
      padding: 4,
      radius: 10,
      onEnter: () => setSidebarOpen(false),
      delay: 350,
    },
    {
      id: "stats-panel",
      target: "stats-panel",
      title: "Daily Practice Stats",
      description: "See your patient count, confirmed appointments, and paid patient bills in real-time.",
      icon: Activity,
      padding: 6,
      radius: 14,
      onEnter: () => {
        setSidebarOpen(false);
        setActiveTab("dashboard");
        dashboardScrollRef.current?.scrollTo?.({ y: 0, animated: false });
      },
    },
    {
      id: "today-appointments",
      target: "today-appointments",
      title: "Today's Patient Schedule",
      description: "Today's schedule of arriving patients. Tap any patient card to view their dental chart and notes.",
      icon: Calendar,
      padding: 6,
      radius: 14,
      onEnter: () => {
        setSidebarOpen(false);
        setActiveTab("dashboard");
        dashboardScrollRef.current?.scrollTo?.({ y: 0, animated: false });
      },
    },
    {
      id: "patient-details",
      target: "patient-details",
      title: "Medical Charting & Actions",
      description: "View the patient's requested service, contact details, medical history, allergies, and update their appointment status (Completed, Cancelled, etc.).",
      icon: Users,
      padding: 6,
      radius: 14,
      onEnter: () => {
        setSidebarOpen(false);
        setActiveTab("dashboard");
        const yOffset = (dashboardColumnsLayoutY.current || 280) + (patientDetailsLayoutY.current || 180) - 12;
        try {
          dashboardScrollRef.current?.scrollTo?.({ y: Math.max(0, yOffset), animated: false });
        } catch (e) { }
      },
      delay: 350,
    },
    {
      id: "guide-btn",
      target: "guide-btn",
      title: "Replay Guide Anytime",
      description: "You can tap this Sparkles button anytime to replay this interactive walkthrough or view the PayMongo setup checklist.",
      icon: Sparkles,
      padding: 6,
      radius: 12,
      onEnter: () => {
        setSidebarOpen(false);
        try {
          dashboardScrollRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) { }
      },
    },
    {
      id: "finish",
      title: "You're All Set, Doctor!",
      description: "SmileGuard keeps your schedule organized and synced across web and mobile. Let's make every smile shine!",
      icon: ShieldCheck,
      placement: "center",
      onEnter: () => {
        setSidebarOpen(false);
        try {
          dashboardScrollRef.current?.scrollTo?.({ y: 0, animated: false });
        } catch (e) { }
      },
    },
  ];

  // Auto-prompt tour on first login
  useEffect(() => {
    if (!user?.id || loadingAppointments || loadingPatients) return;

    let isMounted = true;
    const checkFirstTimeTour = async () => {
      try {
        const alreadyDone = await isDoctorGuideCompleted(user?.id || "", "dashboard");
        if (alreadyDone) return;

        const key = `@smileguard_doctor_interactive_tour_completed_${user.id}`;
        const hasCompleted = await AsyncStorage.getItem(key);
        if (!hasCompleted && isMounted) {
          const timer = setTimeout(() => {
            if (isMounted) {
              setTourIndex(0);
              setTourVisible(true);
            }
          }, 1200);
          return () => clearTimeout(timer);
        }
      } catch (e) {
        console.warn("[DoctorDashboard] Failed checking tour status", e);
      }
    };

    checkFirstTimeTour();
    return () => {
      isMounted = false;
    };
  }, [user?.id, loadingAppointments, loadingPatients]);

  const handleFinishTour = async () => {
    setTourVisible(false);
    setSidebarOpen(false);
    try {
      dashboardScrollRef.current?.scrollTo?.({ y: 0, animated: false });
    } catch (e) { }
    if (user?.id) {
      await markDoctorGuideCompleted(user.id, "dashboard");
    }
  };

  const handleSkipTour = async () => {
    setTourVisible(false);
    setSidebarOpen(false);
    try {
      dashboardScrollRef.current?.scrollTo?.({ y: 0, animated: false });
    } catch (e) { }
    if (user?.id) {
      await markDoctorGuideCompleted(user.id, "dashboard");
    }
  };

  const handleRestartTour = () => {
    setSidebarOpen(false);
    setActiveTab("dashboard");
    setTourIndex(0);
    setTourVisible(true);
  };

  const handleOpenGuideOptions = () => {
    Alert.alert(
      "SmileGuard Doctor Guide",
      "Choose what you would like to explore:",
      [
        {
          text: "Start App Walkthrough",
          onPress: handleRestartTour,
        },
        {
          text: "Clinic & PayMongo Guide",
          onPress: () => router.push("/onboarding"),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  const handleTopBarGuide = () => {
    if (activeTab === 'records') {
      setRecordsTourTrigger((prev) => prev + 1);
    } else if (activeTab === 'appointments') {
      setAppointmentsTourTrigger((prev) => prev + 1);
    } else if (activeTab === 'appointment-requests') {
      setRequestsTourTrigger((prev) => prev + 1);
    } else if (activeTab === 'billing') {
      setBillingTourTrigger((prev) => prev + 1);
    } else {
      handleOpenGuideOptions();
    }
  };

  const handleTopBarRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshDashboardData();
      if (activeTab === 'billing') {
        setBillingRefreshTrigger((prev) => prev + 1);
      } else if (activeTab === 'appointments') {
        setAppointmentsRefreshTrigger((prev) => prev + 1);
      } else if (activeTab === 'records') {
        setRecordsRefreshTrigger((prev) => prev + 1);
      } else if (activeTab === 'appointment-requests') {
        setRequestsRefreshTrigger((prev) => prev + 1);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const today = getToday();
  const [appointments, setAppointments] = useState<DashboardAppointment[]>([]);
  const [requests, setRequests] = useState<DashboardAppointment[]>([]);
  const [patients, setPatients] = useState<DashboardAppointment[]>([]);
  const [stats, setStats] = useState({ total: 0, scheduled: 0, completed: 0, cancelled: 0, noShow: 0, paidBillings: 0 });

  // Filter today's appointments - exclude completed, cancelled, no-show, and declined ones
  const todayAppointments = appointments
    .filter(apt =>
      apt.date === today &&
      apt.status !== 'completed' &&
      apt.status !== 'cancelled' &&
      apt.status !== 'no-show' &&
      apt.status !== 'declined'
    )
    .sort((a, b) => {
      // Convert time strings (e.g., "09:30 AM" or "2:30 PM") to comparable format
      const timeA = a.time || '';
      const timeB = b.time || '';

      const parseTime = (timeStr: string) => {
        // Handle 24-hour and 12-hour formats
        const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (!match) return 0;

        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const period = match[3]?.toUpperCase();

        // Convert to 24-hour format if AM/PM is present
        if (period) {
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
        }

        return hours * 60 + minutes;
      };

      return parseTime(timeA) - parseTime(timeB);
    });

  // Auto-select first appointment from today's list
  const [selectedPatient, setSelectedPatient] = useState<DashboardAppointment | null>(
    todayAppointments.length > 0 ? todayAppointments[0] : (appointments.length > 0 ? appointments[0] : null)
  );

  // Update selectedPatient whenever todayAppointments changes
  useEffect(() => {
    if (todayAppointments.length > 0) {
      // Only auto-select the first patient if no selection or current selection is no longer valid
      if (!selectedPatient || !todayAppointments.some(apt => apt.id === selectedPatient.id)) {
        setSelectedPatient(todayAppointments[0]);
      }
    } else {
      // If no today's appointments, clear selection
      setSelectedPatient(null);
    }
  }, [todayAppointments, selectedPatient]);

  // Fetch and enrich selected patient's emergency contact for contact information
  useEffect(() => {
    const patientId = selectedPatient?.patient_id || selectedPatient?.id;
    if (!patientId) return;

    let isMounted = true;
    const loadEmergencyContact = async () => {
      try {
        const intake = await getPatientMedicalInfo(patientId);
        if (!isMounted || !intake) return;

        setSelectedPatient((prev) => {
          if (!prev) return prev;
          const currentId = prev.patient_id || prev.id;
          if (currentId !== patientId) return prev;

          return {
            ...prev,
            medicalIntake: {
              ...(prev.medicalIntake || {}),
              emergencyContactName: intake.emergencyContactName || prev.medicalIntake?.emergencyContactName || '',
              emergencyContactPhone: intake.emergencyContactPhone || prev.medicalIntake?.emergencyContactPhone || '',
            },
          };
        });
      } catch (err) {
        console.warn('[DoctorDashboard] Error loading emergency contact:', err);
      }
    };

    loadEmergencyContact();

    return () => {
      isMounted = false;
    };
  }, [selectedPatient?.id, selectedPatient?.patient_id]);

  // Helper to open full patient chart with verified patient_id
  const handleOpenPatientDetails = (item: DashboardAppointment) => {
    setViewingPatient({
      ...item,
      id: item.patient_id || item.id,
      patient_id: item.patient_id || item.id,
    });
    setShowPatientDetails(true);
  };

  const fetchDoctorInfo = useCallback(async () => {
    if (!user?.id) return;

    try {
      const profile = await getDoctorProfile(user.id);
      if (profile) {
        const fullName = getDoctorFullName(profile);
        setDoctorProfile(prev => ({
          ...prev,
          first_name: profile.first_name !== undefined ? profile.first_name : prev.first_name,
          middle_name: profile.middle_name !== undefined ? profile.middle_name : prev.middle_name,
          last_name: profile.last_name !== undefined ? profile.last_name : prev.last_name,
          gender: profile.gender !== undefined ? profile.gender : prev.gender,
          doctor_name: fullName || profile.doctor_name || prev.doctor_name,
          name: fullName || profile.doctor_name || prev.name,
        }));
      }
    } catch (error) {
      console.error("Error fetching doctor profile:", error);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDoctorInfo();
  }, [fetchDoctorInfo]);

  // ─────────────────────────────────────────
  // FETCH DATA FROM SUPABASE
  // ─────────────────────────────────────────

  const refreshDashboardData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoadingAppointments(true);
      setLoadingPatients(true);
      setErrorMessage(null);

      // Fetch appointment requests (pending approval)
      const appointmentRequestsData = await getAppointmentRequests();
      if (appointmentRequestsData && appointmentRequestsData.length > 0) {
        const filteredRequests = appointmentRequestsData.filter((apt: any) => !['cancelled', 'declined', 'completed', 'no-show'].includes((apt.status || '').toLowerCase()));
        const transformedRequests = filteredRequests.map((apt: any) => {
          const medicalData = apt.patient_profile;

          const medicalIntake = medicalData ? {
            gender: medicalData.gender || '',
            phone: medicalData.phone || '',
            address: medicalData.address || '',
            dateOfBirth: medicalData.date_of_birth || '',
            emergencyContactName: medicalData.emergency_contact_name || '',
            emergencyContactPhone: medicalData.emergency_contact_phone || '',
            allergies: medicalData.alergies || medicalData.allergies || '',
            currentMedications: medicalData.current_medications || '',
            medicalConditions: medicalData.medical_conditions || '',
            pastSurgeries: medicalData.past_surgeries || '',
            smokingStatus: medicalData.smoking_status || '',
            pregnancyStatus: medicalData.pregnancy_status || '',
            notes: medicalData.notes || '',
          } : null;

          return {
            id: apt.id || '',
            name: apt.patient_name || 'Patient',
            service: apt.service || '',
            time: apt.appointment_time || '',
            date: apt.appointment_date || '',
            age: 0,
            gender: medicalData?.gender || apt.profiles?.gender || '',
            contact: medicalData?.phone || apt.profiles?.phone || apt.contact || apt.phone || '',
            email: apt.profiles?.email || apt.email || '',
            notes: apt.notes || '',
            imageUrl: apt.patient_avatar || require('../../assets/images/user.png'),
            status: (apt.status?.toLowerCase() === 'pending' ? 'pending' : (apt.status || 'pending')) as any,
            patient_id: apt.patient_id,
            dentist_id: apt.dentist_id,
            medicalIntake: medicalIntake,
            created_at: apt.created_at || (apt as any).appointment_date || null,
            rescheduled_by: apt.rescheduled_by || (apt as any).reschedule_by || null,
            rescheduled_at: apt.rescheduled_at || (apt as any).reschedule_at || null,
          };
        });
        setAppointmentRequests(transformedRequests);
      } else {
        setAppointmentRequests([]);
      }

      // Use RPC function to get ALL appointments including cancelled (bypasses RLS, excludes pending)
      const rawRpcAppointments = await getDoctorAppointments(user.id);
      const rpcAppointments = (rawRpcAppointments || []).filter((apt: any) => (apt.status || '').toLowerCase() !== 'pending');
      console.log('[DoctorDashboard] Got appointments from getDoctorAppointments:', rpcAppointments.length);
      if (rpcAppointments && rpcAppointments.length > 0) {
        console.log('📝 First appointment data:', rpcAppointments[0]);

        const transformedAppointments = rpcAppointments.map((apt: any) => {
          console.log(`📐 Transforming appointment ${apt.id}:`, {
            patient_name: apt.patient_name,
            patient_id: apt.patient_id,
          });

          const medicalData = apt.patient_profile;

          const medicalIntake = medicalData ? {
            gender: medicalData.gender || '',
            phone: medicalData.phone || '',
            address: medicalData.address || '',
            dateOfBirth: medicalData.date_of_birth || '',
            emergencyContactName: medicalData.emergency_contact_name || '',
            emergencyContactPhone: medicalData.emergency_contact_phone || '',
            allergies: medicalData.alergies || medicalData.allergies || '',
            currentMedications: medicalData.current_medications || '',
            medicalConditions: medicalData.medical_conditions || '',
            pastSurgeries: medicalData.past_surgeries || '',
            smokingStatus: medicalData.smoking_status || '',
            pregnancyStatus: medicalData.pregnancy_status || '',
            notes: medicalData.notes || '',
          } : null;

          return {
            id: apt.id || '',
            name: apt.patient_name || 'Patient',
            service: apt.service || '',
            time: apt.appointment_time || '',
            date: apt.appointment_date || '',
            age: 0,
            gender: medicalData?.gender || apt.profiles?.gender || '',
            contact: medicalData?.phone || apt.profiles?.phone || apt.contact || apt.phone || '',
            email: apt.profiles?.email || apt.email || '',
            notes: apt.notes || '',
            imageUrl: apt.patient_avatar || require('../../assets/images/user.png'),
            status: (apt.status || 'scheduled') as 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined',
            patient_id: apt.patient_id,
            dentist_id: apt.dentist_id,
            medicalIntake: medicalIntake,
            created_at: apt.created_at || (apt as any).appointment_date || null,
            rescheduled_by: apt.rescheduled_by || (apt as any).reschedule_by || null,
            rescheduled_at: apt.rescheduled_at || (apt as any).reschedule_at || null,
          };
        });
        setAppointments(transformedAppointments);

        // Calculate stats excluding declined appointments
        const appointmentsExcludingDeclined = transformedAppointments.filter(apt => apt.status !== 'declined');
        // Fetch paid billings count for this doctor using appointment IDs
        const appointmentIds = rpcAppointments
          .filter((apt: any) => apt.id)
          .map((apt: any) => apt.id);

        let paidBillings: any[] = [];
        if (appointmentIds.length > 0) {
          const { data: billingData, error: billingError } = await supabase
            .from('billings')
            .select('id')
            .in('appointment_id', appointmentIds)
            .eq('payment_status', 'paid');

          if (billingError) {
            console.error('[DoctorDashboard] Billing query error:', billingError);
          } else {
            paidBillings = billingData || [];
          }
        }

        console.log('[DoctorDashboard] Paid billings count:', paidBillings.length);

        const calculatedStats = {
          total: appointmentsExcludingDeclined.length,
          scheduled: appointmentsExcludingDeclined.filter(a => a.status === 'scheduled').length,
          completed: appointmentsExcludingDeclined.filter(a => a.status === 'completed').length,
          cancelled: appointmentsExcludingDeclined.filter(a => a.status === 'cancelled').length,
          noShow: appointmentsExcludingDeclined.filter(a => a.status === 'no-show').length,
          paidBillings: paidBillings?.length || 0,
        };
        setStats(calculatedStats);

      } else {
        setAppointments([]);
        setStats({ total: 0, scheduled: 0, completed: 0, cancelled: 0, noShow: 0, paidBillings: 0 });

      }

      const { success: patSuccess, data: patientData } = await dashboardService.fetchDoctorPatients(user.id!);

      if (patSuccess && patientData.length > 0) {
        const transformedPatients: DashboardAppointment[] = patientData.map((patient: any) => ({
          id: patient.id,
          name: patient.name || 'Unknown',
          email: patient.email || '',
          contact: patient.phone || '',
          service: patient.service || '',
          time: '',
          date: patient.created_at || today,
          created_at: patient.created_at,
          age: 0,
          gender: '',
          notes: '',
          imageUrl: patient.avatar_url || patient.avatar || patient.profile_picture || patient.image_url || require('../../assets/images/user.png'),
          status: 'scheduled' as const,
          patient_id: patient.id,
          dummy: Boolean(patient.dummy),
        }));
        // Sort orderly by account creation date (newest first)
        transformedPatients.sort((a, b) => {
          const timeA = a.created_at || a.date ? new Date(a.created_at || a.date).getTime() : 0;
          const timeB = b.created_at || b.date ? new Date(b.created_at || b.date).getTime() : 0;
          return timeB - timeA;
        });
        setPatients(transformedPatients);

      } else {
        setPatients([]);

      }
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      setErrorMessage('Failed to load dashboard data');
    } finally {
      // Re-fetch doctor info to ensure prefix and gender remain fresh
      fetchDoctorInfo();
      setLoadingAppointments(false);
      setLoadingPatients(false);
      setIsRefreshing(false);
    }
  }, [user?.id, today, fetchDoctorInfo]);

  useEffect(() => {
    if (!user?.id) return;
    refreshDashboardData();
  }, [user?.id]);

  // Handle incoming push notification prompt when doctor opens the app from status bar
  useEffect(() => {
    if (!promptAppointmentId) return;

    let isMounted = true;
    const loadPromptAppointment = async () => {
      try {
        setLoadingPromptAppointment(true);
        // First check if it is already in loaded requests
        const inMemory = appointmentRequests.find((r) => r.id === promptAppointmentId);
        if (inMemory) {
          if (isMounted) {
            setPromptAppointment(inMemory);
            setShowPromptModal(true);
          }
          return;
        }

        // Fetch fresh appointment details from DB
        const apt = await getAppointmentById(promptAppointmentId);
        if (!isMounted || !apt) return;

        const medicalData = apt.patient_profile;
        const formatted: DashboardAppointment = {
          id: apt.id,
          name: apt.patient_name || 'Patient',
          service: apt.service || 'General Dental Consultation',
          time: apt.appointment_time || '',
          date: apt.appointment_date || '',
          age: 0,
          gender: medicalData?.gender || apt.profiles?.gender || '',
          contact: medicalData?.phone || apt.profiles?.phone || '',
          email: apt.profiles?.email || '',
          notes: apt.notes || '',
          imageUrl: apt.patient_avatar || require('../../assets/images/user.png'),
          status: (apt.status?.toLowerCase() === 'pending' ? 'pending' : (apt.status || 'pending')) as any,
          patient_id: apt.patient_id,
          dentist_id: apt.dentist_id,
          doctor_note: apt.doctor_note || '',
          medicalIntake: medicalData
            ? {
              gender: medicalData.gender || '',
              phone: medicalData.phone || '',
              address: medicalData.address || '',
              dateOfBirth: medicalData.date_of_birth || '',
              emergencyContactName: medicalData.emergency_contact_name || '',
              emergencyContactPhone: medicalData.emergency_contact_phone || '',
              allergies: medicalData.alergies || medicalData.allergies || '',
              currentMedications: medicalData.current_medications || '',
              medicalConditions: medicalData.medical_conditions || '',
              pastSurgeries: medicalData.past_surgeries || '',
              smokingStatus: medicalData.smoking_status || '',
              pregnancyStatus: medicalData.pregnancy_status || '',
              notes: medicalData.notes || '',
            }
            : null,
        };

        if (isMounted) {
          setPromptAppointment(formatted);
          setShowPromptModal(true);
        }
      } catch (err) {
        console.error('[DoctorDashboard] Error loading push prompt appointment:', err);
      } finally {
        if (isMounted) setLoadingPromptAppointment(false);
      }
    };

    loadPromptAppointment();
    return () => {
      isMounted = false;
    };
  }, [promptAppointmentId]);

  // ─────────────────────────────────────────
  // UPDATE DASHBOARD WHEN COMPONENT OPENS
  // ─────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      setLoadingOnTabSwitch(true);
      fetchDoctorInfo();
      refreshDashboardData();
      setExpandPatientDetails(false);

      // Hide loading indicator after a short delay to show the content
      const timer = setTimeout(() => {
        setLoadingOnTabSwitch(false);
      }, 500);

      return () => {
        clearTimeout(timer);
      };
    }, [refreshDashboardData, fetchDoctorInfo])
  );

  // ─────────────────────────────────────────
  // LOAD CLINIC LOGO AND NAME
  // ─────────────────────────────────────────
  // Clinic data is now loaded from ClinicContext and updates in real-time

        const handleOpenStatusModal = (appointment: DashboardAppointment) => {
    setEditingAppointment({
      ...appointment,
      appointment_date: appointment.date,
      appointment_time: appointment.time,
    });
    setShowEditModal(true);
  };

  const handlePress = (apt: DashboardAppointment) => {
    setSelectedPatient(apt);
    setExpandPatientDetails(false);
  };

  const handleAcceptRequest = (req: DashboardAppointment) => {
    setAppointments((prev) => [...prev, { ...req, id: `apt-${Date.now()}` }]);
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
  };

  const handleDeclineRequest = (req: DashboardAppointment) => {
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
  };

  const handleAcceptAppointmentRequest = async (request: DashboardAppointment) => {
    try {
      if (!user?.id) {
        Alert.alert('Error', 'Doctor ID not found');
        return;
      }

      // Update the appointment with the current doctor's ID
      const result = await updateDoctorAppointmentStatus(request.id, 'scheduled', user.id, {
        dentist_id: user.id
      });

      if (!result.success) {
        Alert.alert('Error', result.message);
        return;
      }

      // Remove from requests list
      setAppointmentRequests((prev) => prev.filter((r) => r.id !== request.id));

      // Add to appointments list with updated status and dentist_id
      setAppointments((prev) => [...prev, { ...request, dentist_id: user.id, status: 'scheduled' }]);

      Alert.alert('Success', `Appointment with ${request.name} has been accepted`);
    } catch (error) {
      Alert.alert('Error', 'Failed to accept appointment request');
      console.error('Error accepting appointment request:', error);
    }
  };

  const handleDeclineAppointmentRequest = async (request: DashboardAppointment, doctorNote?: string) => {
    try {
      if (!user?.id) {
        Alert.alert('Error', 'Doctor ID not found');
        return;
      }

      // Update the appointment status to 'declined' with doctor's note
      const result = await updateDoctorAppointmentStatus(request.id, 'declined', user.id, {
        dentist_id: user.id,
        doctor_note: doctorNote || undefined,
      });

      if (!result?.success) {
        Alert.alert('Error', result?.message || 'Failed to decline appointment');
        return;
      }

      // Remove from requests list
      setAppointmentRequests((prev) => prev.filter((r) => r.id !== request.id));

      // Update appointment in appointments list if present
      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === request.id
            ? { ...apt, status: 'declined', dentist_id: user.id, doctor_note: doctorNote || apt.doctor_note }
            : apt
        )
      );

      Alert.alert('Success', `Appointment request with ${request.name} has been declined`);
    } catch (error) {
      Alert.alert('Error', 'Failed to decline appointment request');
      console.error('Error declining appointment request:', error);
    }
  };


  const sortPatients = (patientsToSort: DashboardAppointment[]): DashboardAppointment[] => {
    const sorted = [...patientsToSort];
    if (patientSortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (patientSortBy === 'date') {
      sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (patientSortBy === 'service') {
      sorted.sort((a, b) => a.service.localeCompare(b.service));
    }

    if (patientSortOrder === 'desc') {
      sorted.reverse();
    }
    return sorted;
  };

  const formatAccountCreatedDate = (rawDate?: string) => {
    if (!rawDate) return null;
    const parsed = new Date(rawDate);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };


  const handleUpdateAppointmentStatus = async (appointmentId: string, status: 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'declined') => {
    try {
      if (!user?.id) {
        Alert.alert('Error', 'Doctor ID not found');
        return;
      }

      const result = await updateDoctorAppointmentStatus(appointmentId, status, user.id);

      if (!result.success) {
        Alert.alert('Error', result.message);
        return;
      }

      // Update local state
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === appointmentId ? { ...apt, status } : apt))
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update appointment status');
      console.error('Error updating appointment status:', error);
    }
  };

  // Loading indicator
  if (loadingAppointments || loadingPatients) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC", justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={{ marginTop: 16, color: '#047857', fontSize: 16, fontWeight: '600' }}>Loading dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <View ref={tour.setContainer} collapsable={false} style={[styles.mainContainer, { paddingLeft: NAV_RAIL_WIDTH }]}>
        <LeftNavRail
          activeTab={activeTab}
          railRef={tour.register("menu-btn")}
          navRef={tour.register("sidebar-nav")}
          logoSource={
            clinic?.logo_url === 'APP_LOGO'
              ? APP_LOGO
              : clinic?.logo_url
                ? { uri: clinic.logo_url }
                : undefined
          }
          onSelect={(tab) => {
            if (tab === 'dashboard') {
              setActiveTab('dashboard');
              setTabHistory([]);
            } else {
              navigateToTab(tab);
            }
          }}
          onTour={handleRestartTour}
          onLogout={() => {
            Alert.alert("Confirm Logout", "Are you sure?", [
              { text: "Cancel", style: "cancel" },
              { text: "Logout", style: "destructive", onPress: onLogout },
            ]);
          }}
        />
        {/* Modern HeroUI Top App Bar */}
        <View style={styles.topAppBar}>
          <View style={styles.topBarCenter}>
            <Text style={styles.topBarDoctorName} numberOfLines={1}>
              {getDoctorTitleName(doctorProfile) || (doctorProfile as any)?.doctor_name || doctorProfile.name || 'Doctor'}
            </Text>
            <Text style={styles.topBarClinic} numberOfLines={1}>
              {(doctorProfile as any)?.specialization || clinic?.clinic_name || 'SmileGuard'}
            </Text>
          </View>

          <View style={styles.topBarRightActions}>
            <View ref={tour.register("guide-btn")} collapsable={false} style={{ width: 40, height: 40 }}>
              <TouchableOpacity
                onPress={handleTopBarGuide}
                style={styles.topBarRefreshBtn}
                activeOpacity={0.7}
                accessibilityLabel="Clinic Guide & Interactive Tour"
              >
                <Sparkles size={16} color="#047857" />
              </TouchableOpacity>
            </View>
            <View ref={tour.register("notifications-btn")} collapsable={false} style={{ width: 40, height: 40 }}>
              <NotificationBell
                unreadCount={totalUnreadCount}
                onPress={() => setShowNotificationCenter(true)}
                animateOnNewNotification={true}
              />
            </View>
            <TouchableOpacity
              onPress={handleTopBarRefresh}
              disabled={isRefreshing}
              style={styles.topBarRefreshBtn}
              activeOpacity={0.7}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <RefreshCw size={17} color="#047857" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Real-Time Floating Notification Banner (Pops Up Immediately) */}
        {notificationState.activeNotification && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              const notif = notificationState.activeNotification;
              notificationState.actions.dismissActiveNotification();
              if (notif?.type.startsWith('appointment-')) {
                navigateToTab('appointment-requests');
              } else if (notif?.type === 'bill-paid' || notif?.type === 'billing-paid') {
                navigateToTab('billing');
              } else if (notif?.type === 'patient-registered') {
                navigateToTab('records');
              } else {
                setShowNotificationCenter(true);
              }
            }}
            style={{
              position: 'absolute',
              top: 68,
              left: 16,
              right: 16,
              backgroundColor: '#064E3B',
              borderRadius: 14,
              paddingVertical: 12,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 9999,
              elevation: 10,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.35,
              shadowRadius: 8,
              borderWidth: 1.5,
              borderColor: '#10B981',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(16, 185, 129, 0.25)',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 10,
              }}>
                <Bell size={18} color="#34D399" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F9FAFB', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                  {notificationState.activeNotification.title}
                </Text>
                <Text style={{ color: '#D1FAE5', fontSize: 11, marginTop: 1 }} numberOfLines={2}>
                  {notificationState.activeNotification.message}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => notificationState.actions.dismissActiveNotification()}
              style={{
                padding: 6,
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: 20,
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}

        <View style={styles.contentArea}>
          {activeTab === 'dashboard' ? (
            <ScrollView ref={dashboardScrollRef} contentContainerStyle={styles.scrollContent}>
              <View style={styles.container}>
                {/* Signature Clinical Header Banner - Aligned with Patient Web */}
                <View style={styles.clinicBanner}>
                  {/* Subtle top bevel highlight */}
                  <View style={styles.clinicBannerBevel} />

                  <View style={styles.clinicBannerContent}>
                    <View style={styles.clinicBannerIconBox}>
                      <Stethoscope size={24} color="#A7F3D0" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.clinicBannerBadgeRow}>
                        <View style={styles.clinicBannerBadge}>
                          <ShieldCheck size={11} color="#022C22" style={{ marginRight: 4 }} />
                          <Text style={styles.clinicBannerBadgeText}>SMILEGUARD DOCTOR PORTAL</Text>
                        </View>
                      </View>
                      <Text style={styles.clinicBannerDoctorName} numberOfLines={1}>
                        {getDoctorTitleName(doctorProfile) || (doctorProfile as any)?.doctor_name || doctorProfile.name || 'Doctor'}
                      </Text>
                      <Text style={styles.clinicBannerSubtitle} numberOfLines={1}>
                        {clinic?.clinic_name || 'SmileGuard Dental Clinic'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Stats Panel - from Supabase with Iconic Lucide Icons */}
                <View ref={tour.register("stats-panel")} collapsable={false} style={styles.firstPanel}>

                  <StatCard
                    number={stats.total}
                    label="Appointments"
                    icon={<Calendar size={20} color="#0284C7" />}
                    accentColor="#0369A1"
                    bgTint="#E0F2FE"
                  />
                  <StatCard
                    number={stats.paidBillings}
                    label="Paid Billings"
                    icon={<CreditCard size={20} color="#7C3AED" />}
                    accentColor="#6D28D9"
                    bgTint="#F5F3FF"
                  />
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.header}>DAILY CLINICAL SCHEDULE</Text>
                </View>

                <View style={styles.dashboardColumns} onLayout={(e) => { dashboardColumnsLayoutY.current = e.nativeEvent.layout.y; }}>
                  {/* Left Column: Today's Appointments */}
                  <View ref={tour.register("today-appointments")} collapsable={false} style={styles.column}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionTitleGroup}>
                        <Text style={styles.sectionHeaderTitle}>TODAY'S APPOINTMENTS</Text>
                        <View style={styles.pillCountBadge}>
                          <Text style={styles.pillCountText}>{todayAppointments.length}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => navigateToTab('appointments')}
                        style={styles.seeAllBtn}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.seeAllBtnText}>See all</Text>
                        <ChevronRight size={14} color="#047857" />
                      </TouchableOpacity>
                    </View>
                    {todayAppointments.length === 0 ? (
                      <View style={{ padding: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', minHeight: 100 }}>
                        <Calendar size={28} color="#94A3B8" style={{ marginBottom: 8 }} />
                        <Text style={{ color: '#64748B', fontSize: 14, fontWeight: '500', textAlign: 'center' }}>No appointments scheduled for today</Text>
                      </View>
                    ) : (
                      todayAppointments.map((apt, idx) => (
                        <AppointmentCard
                          key={apt.id}
                          name={apt.name}
                          service={apt.service}
                          time={apt.time}
                          imageUrl={apt.imageUrl}
                          onPress={() => handlePress(apt)}
                          highlighted={idx === 0}
                        />
                      ))
                    )}
                  </View>

                  {/* Right Column: Patient Details */}
                  <View style={styles.column}>
                    <View ref={tour.register("patient-details")} collapsable={false} onLayout={(e) => { patientDetailsLayoutY.current = e.nativeEvent.layout.y; }}>
                      <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionHeaderTitle}>PATIENT DETAILS</Text>
                      </View>
                      {!selectedPatient ? (
                        <View style={[styles.detailsCard, { alignItems: 'center', justifyContent: 'center', minHeight: 140, paddingVertical: 24, backgroundColor: '#F8FAFC', borderStyle: 'dashed' }]}>
                          <View style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: '#EDF2F7', borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                            <Users size={22} color="#047857" />
                          </View>
                          <Text style={{ color: '#0F172A', fontSize: 13, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>No Patient Selected</Text>
                          <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '500', textAlign: 'center', marginTop: 4, maxWidth: 220 }}>
                            Select an appointment from Today's Schedule or Requests to view patient records.
                          </Text>
                        </View>
                      ) : (
                        <View style={[styles.detailsCard, styles.shadow, {
                          position: 'relative',
                        }]}>
                          {/* Status Badge - Top Right Corner */}
                          <View
                            style={{
                              position: 'absolute',
                              top: 12,
                              right: 12,
                              paddingHorizontal: 8,
                              paddingVertical: (selectedPatient.status || 'scheduled').toLowerCase() === 'pending' ? 4 : 3.5,
                              borderRadius: (selectedPatient.status || 'scheduled').toLowerCase() === 'pending' ? 10 : 4,
                              borderWidth: (selectedPatient.status || 'scheduled').toLowerCase() === 'pending' ? 0 : 1,
                              borderColor: '#6EE7B7',
                              backgroundColor: (selectedPatient.status || 'scheduled').toLowerCase() === 'pending' ? '#65A30D' : '#D1FAE5',
                              zIndex: 10,
                            }}
                          >
                            <Text style={{
                              fontWeight: 'bold',
                              color: (selectedPatient.status || 'scheduled').toLowerCase() === 'pending' ? '#FFFFFF' : '#065F46',
                              fontSize: 10,
                              letterSpacing: (selectedPatient.status || 'scheduled').toLowerCase() === 'pending' ? 0 : 0.6,
                            }}>
                              {(selectedPatient.status || 'scheduled').toUpperCase()}
                            </Text>
                          </View>

                          {/* Patient Header */}
                          <View style={{ alignItems: 'center', marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                            <Image
                              source={typeof selectedPatient.imageUrl === "string" ? { uri: selectedPatient.imageUrl } : selectedPatient.imageUrl}
                              style={{ width: 62, height: 62, borderRadius: 6, borderWidth: 1.5, borderColor: '#CBD5E1', marginBottom: 8 }}
                            />
                            <Text style={{ fontWeight: "900", fontSize: 17, color: '#0F172A', letterSpacing: -0.3 }}>
                              {selectedPatient.name}
                            </Text>
                            {(selectedPatient.email || selectedPatient.contact) && (
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#047857', letterSpacing: 0.5, marginTop: 2 }}>
                                {selectedPatient.email || selectedPatient.contact}
                              </Text>
                            )}
                            {((selectedPatient as any).pwd_status === 'approved' || (selectedPatient as any).medicalIntake?.pwd_status === 'approved') && (
                              <View style={{ marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#ECFDF5', borderRadius: 4, borderWidth: 1, borderColor: '#10B981' }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#047857' }}>
                                  ✓ Verified {(selectedPatient as any).pwd_type === 'senior' ? 'Senior' : 'PWD'}
                                </Text>
                              </View>
                            )}
                            {((selectedPatient as any).pwd_status === 'pending' || (selectedPatient as any).medicalIntake?.pwd_status === 'pending') && (
                              <View style={{ marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: '#FFFBEB', borderRadius: 4, borderWidth: 1, borderColor: '#F59E0B' }}>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#B45309' }}>
                                  ⚠️ PWD/Senior Review Pending
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Appointment Details Box */}
                          <View style={{
                            marginBottom: 14,
                            backgroundColor: '#F8FAFC',
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            padding: 10,
                          }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 }}>
                              <Calendar size={13} color="#047857" />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#047857', letterSpacing: 0.6 }}>APPOINTMENT DETAILS</Text>
                            </View>
                            <DetailRow label="Service" value={selectedPatient.service || "General Dental"} />
                            <DetailRow label="Time" value={selectedPatient.time ? formatAppointmentTime(selectedPatient.time) : "Not specified"} isHighlight={true} />
                            <DetailRow label="Date" value={formatAppointmentDate(selectedPatient.date) || "Not specified"} />
                          </View>

                          {/* Action Buttons: Full Record & Update Status (Side by Side) */}
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                            {/* Action: Open Full Medical Record */}
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                paddingVertical: 10,
                                paddingHorizontal: 8,
                                backgroundColor: '#047857',
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: '#064E3B',
                                borderBottomWidth: 2.5,
                                borderBottomColor: '#022C22',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 6,
                              }}
                              onPress={() => {
                                if (selectedPatient) {
                                  handleOpenPatientDetails(selectedPatient);
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <FileText size={13} color="#FFFFFF" />
                              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.4 }}>
                                FULL RECORD
                              </Text>
                            </TouchableOpacity>

                            {/* Action: Update Appointment Status */}
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                paddingVertical: 10,
                                paddingHorizontal: 8,
                                backgroundColor: '#F8FAFC',
                                borderRadius: 6,
                                borderWidth: 1.5,
                                borderColor: '#CBD5E1',
                                borderBottomWidth: 2.5,
                                borderBottomColor: '#94A3B8',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 6,
                              }}
                              onPress={() => {
                                if (selectedPatient) {
                                  handleOpenStatusModal(selectedPatient);
                                }
                              }}
                              activeOpacity={0.8}
                            >
                              <Clock size={13} color="#475569" />
                              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '800', color: '#1E293B', letterSpacing: 0.4 }}>
                                UPDATE STATUS
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                    </View>

                    {/* Patients List */}
                    <View style={[styles.sectionHeaderRow, { marginTop: 20, marginBottom: 10 }]}>
                      <View style={styles.sectionTitleGroup}>
                        <Text style={styles.sectionHeaderTitle}>PATIENTS</Text>
                        <View style={styles.pillCountBadge}>
                          <Text style={styles.pillCountText}>{patients.length}</Text>
                        </View>
                      </View>
                      {patients.length > 0 && (
                        <TouchableOpacity
                          onPress={() => navigateToTab('records')}
                          style={styles.seeAllBtn}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.seeAllBtnText}>See more patients</Text>
                          <ChevronRight size={14} color="#047857" />
                        </TouchableOpacity>
                      )}
                    </View>
                    {patients.length > 0 ? (
                      patients
                        .slice()
                        .sort((a, b) => {
                          const timeA = a.created_at || a.date ? new Date(a.created_at || a.date).getTime() : 0;
                          const timeB = b.created_at || b.date ? new Date(b.created_at || b.date).getTime() : 0;
                          return timeB - timeA;
                        })
                        .slice(0, 3)
                        .map((patient) => (
                          <TouchableOpacity
                            key={patient.id}
                            onPress={() => {
                              handleOpenPatientDetails(patient);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.card, styles.shadow, { marginBottom: 10 }]}>
                              <Image
                                source={typeof patient.imageUrl === "string" && patient.imageUrl.length > 0 ? { uri: patient.imageUrl } : (typeof patient.imageUrl === "number" ? patient.imageUrl : require('../../assets/images/user.png'))}
                                style={{ width: 44, height: 44, borderRadius: 6, borderWidth: 1, borderColor: '#CBD5E1', marginRight: 12 }}
                              />
                              <View style={{ flex: 1 }}>
                                <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#0F172A' }}>{patient.name}</Text>
                                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 1 }}>{patient.email || patient.contact || 'No email provided'}</Text>
                                {formatAccountCreatedDate(patient.created_at || patient.date) ? (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500' }}>
                                      Account created: <Text style={{ color: '#047857', fontWeight: '700' }}>{formatAccountCreatedDate(patient.created_at || patient.date)}</Text>
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          </TouchableOpacity>
                        ))
                    ) : (
                      <Text style={{ fontSize: 12, color: '#999', marginVertical: 10 }}>No patients yet</Text>
                    )}
                  </View>
                </View>

                              </View>
            </ScrollView>
          ) : activeTab === 'records' ? (
            <RecordsTab
              patients={patients}
              quickSearchQuery={quickSearchQuery}
              setQuickSearchQuery={setQuickSearchQuery}
              patientSortBy={patientSortBy}
              setPatientSortBy={setPatientSortBy}
              patientSortOrder={patientSortOrder}
              setPatientSortOrder={setPatientSortOrder}
              sortPatients={sortPatients}
              setViewingPatient={setViewingPatient}
              setShowPatientDetails={setShowPatientDetails}
              styles={styles}
              startTourTrigger={recordsTourTrigger}
              refreshTrigger={recordsRefreshTrigger}
              doctorId={user?.id}
              userRole={user?.role}
            />
          ) : activeTab === 'appointments' ? (
            <AppointmentsTab
              startTourTrigger={appointmentsTourTrigger}
              refreshTrigger={appointmentsRefreshTrigger}
              appointments={appointments}
              onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
              styles={styles}
              doctorId={user.id}
              userRole={user.role}
              onAppointmentStatusUpdated={() => {
                // Handled in AppointmentsTab
              }}
            />
          ) : activeTab === 'appointment-requests' ? (
            <AppointmentsRequestTab
              userId={user.id || ''}
              startTourTrigger={requestsTourTrigger}
              refreshTrigger={requestsRefreshTrigger}
              onRequestAccepted={() => {
                // Refresh dashboard data when request is accepted
                refreshDashboardData();
              }}
              onRequestAcceptedWithNotification={(notification) => {
                // Add notification to the notification center
                notificationState.actions.addNotification(notification);
              }}
              styles={styles}
            />
          ) : activeTab === 'billing' ? (
            <BillingTab
              doctorId={user.id || ''}
              styles={styles}
              startTourTrigger={billingTourTrigger}
              refreshTrigger={billingRefreshTrigger}
            />
          ) : (
            <SettingsTab
              user={doctorProfile}
              onUpdateProfile={handleUpdateProfile}
              styles={styles}
              onProfileUpdated={(doctorName, doctorId) => {
                // Doctor profile updated
              }}
              onStartTutorial={() => {
                navigateToTab('dashboard');
                setTimeout(() => {
                  setTourIndex(0);
                  setTourVisible(true);
                }, 250);
              }}
              onStartRecordsTutorial={() => {
                navigateToTab('records');
                setRecordsTourTrigger((prev) => prev + 1);
              }}
              onStartAppointmentsTutorial={() => {
                navigateToTab('appointments');
                setAppointmentsTourTrigger((prev) => prev + 1);
              }}
              onStartBillingTutorial={() => {
                navigateToTab('billing');
                setBillingTourTrigger((prev) => prev + 1);
              }}
            />
          )}
        </View>

        {/* Patient Details Modal */}
        <PatientDetailsView
          visible={showPatientDetails}
          patient={viewingPatient}
          doctorId={user.id}
          onClose={() => {
            setShowPatientDetails(false);
            setViewingPatient(null);
          }}

          onAppointmentStatusUpdated={() => {
            // Handled in PatientDetailsView
          }}
        />

        {/* Loading Overlay for Tab Navigation */}
        {loadingOnTabSwitch && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 999,
          }}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={{ marginTop: 16, color: '#047857', fontSize: 14, fontWeight: '700' }}>Loading...</Text>
          </View>
        )}

        {/* Notification Center Modal */}
        <Modal
          visible={showNotificationCenter}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowNotificationCenter(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View style={{ flex: 1 }}>
              <NotificationCenter
                notifications={mergedNotifications}
                unreadCount={totalUnreadCount}
                isLoading={notificationState.isLoading}
                error={notificationState.error}
                onMarkAsRead={handleMarkAsRead}
                onMarkAllAsRead={handleMarkAllAsRead}
                onDeleteNotification={handleDeleteNotification}
                onClearAll={handleClearAll}
                onClose={() => setShowNotificationCenter(false)}
                onNavigateToTab={(tab) => {
                  setShowNotificationCenter(false);
                  navigateToTab(tab);
                }}
              />
            </View>
          </SafeAreaView>
        </Modal>

        {/* Appointment Status Edit Modal */}
        {editingAppointment && (
          <AppointmentEdit
            visible={showEditModal}
            appointment={editingAppointment}
            doctorId={user.id || ''}
            userRole={user.role}
            onClose={() => {
              setShowEditModal(false);
              setEditingAppointment(null);
            }}
            onSave={async () => {
              await refreshDashboardData();
            }}
            onAppointmentStatusUpdated={() => {
              // Handled in AppointmentEdit
            }}
          />
        )}

        {/* Status Bar / Push Notification Triage Prompt Modal */}
        <AppointmentRequestPromptModal
          visible={showPromptModal}
          appointment={promptAppointment}
          loading={loadingPromptAppointment}
          onClose={() => {
            setShowPromptModal(false);
            setPromptAppointment(null);
          }}
          onAccept={async (req) => {
            await handleAcceptAppointmentRequest(req);
            await refreshDashboardData();
          }}
          onDecline={async (req, doctorNote) => {
            await handleDeclineAppointmentRequest(req, doctorNote);
            await refreshDashboardData();
          }}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },

  topAppBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },

  menuIconButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
  },

  topBarCenter: {
    flex: 1,
    marginHorizontal: 12,
  },

  topBarDoctorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },

  topBarClinic: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '500',
    marginTop: 1,
  },

  topBarRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  topBarRefreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },

  welcomeGreeting: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  welcomeName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: -0.3,
    marginTop: 2,
  },

  sidebarOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 280,
    backgroundColor: '#064E3B',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderRightWidth: 1.5,
    borderRightColor: '#047857',
    zIndex: 50,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },

  sidebarHeader: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },

  sidebarBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  sidebarBrandLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },

  sidebarBrandIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sidebarCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  logoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },

  sidebarSubtitle: {
    fontSize: 12,
    color: '#A7F3D0',
    fontWeight: '500',
    marginTop: 2,
  },

  navItems: {
    flex: 1,
    gap: 8,
  },

  navItemsList: {
    width: "100%",
    gap: 8,
  },

  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },

  navItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },

  navLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  sidebarTourBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    borderWidth: 1,
    borderColor: '#34D399',
    borderRadius: 10,
  },

  sidebarTourText: {
    color: '#E6FFFA',
    fontSize: 13,
    fontWeight: '700',
  },

  sidebarLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    marginTop: 16,
  },

  sidebarLogoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  backdropOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 40,
  },

  contentArea: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 40,
  },

  container: {
    padding: 16,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },

  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
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

  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },

  seeAllBtnText: {
    color: '#047857',
    fontWeight: '700',
    fontSize: 12,
  },

  // Signature Clinic Header Banner
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
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clinicBannerBadgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
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
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  },
  clinicBannerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D1FAE5',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginTop: 2,
  },

  // Appointment Requests Section
  requestsSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  requestsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  requestsHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestsHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  requestsCountBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
  },
  requestsCountBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#E2E8F0',
    borderRightColor: '#CBD5E1',
    borderBottomColor: '#CBD5E1',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  requestCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 10,
  },
  requestPatientName: {
    fontWeight: '800',
    fontSize: 14,
    color: '#0F172A',
  },
  requestService: {
    fontWeight: '700',
    fontSize: 12,
    color: '#047857',
    marginTop: 1,
  },
  requestTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  requestTimeText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  requestPendingBadge: {
    backgroundColor: '#65A30D',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  requestPendingBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  requestNotesBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
    padding: 8,
    marginTop: 10,
  },
  requestNotesText: {
    fontSize: 11.5,
    color: '#475569',
    fontStyle: 'italic',
  },
  requestActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  requestAcceptBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#047857',
    borderBottomWidth: 2,
    borderBottomColor: '#022C22',
  },
  requestAcceptBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  requestDeclineBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  requestDeclineBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seeMoreRequestsBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
  },
  seeMoreRequestsBtnText: {
    color: '#B45309',
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  header: {
    fontSize: 16,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.5,
  },

  subHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },

  sectionHeader: {
    width: "100%",
    marginTop: 24,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 8,
  },

  firstPanel: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
    marginBottom: 8,
  },

  dashboardColumns: {
    flexDirection: "column",
    width: "100%",
    gap: 16,
  },

  column: {
    width: "100%",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },

  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    padding: 16,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 150,
    justifyContent: "center",
    alignItems: "center",
  },

  shadow: {
    shadowColor: "#9AA7B5",
    shadowOpacity: 0.35,
    shadowOffset: { width: 1, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },

  editHeader: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },

  editField: {
    marginBottom: 20,
  },

  editLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    color: "#475569",
  },

  editInput: {
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 4,
    backgroundColor: "#DDE4E8",
    padding: 12,
    fontSize: 14,
    color: "#0F172A",
  },

  editButtonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },

  editButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },

  editButtonSave: {
    backgroundColor: "#10B981",
    borderWidth: 1.5,
    borderTopColor: "#34D399",
    borderLeftColor: "#34D399",
    borderBottomColor: "#047857",
    borderRightColor: "#047857",
  },

  editButtonCancel: {
    backgroundColor: "#E2E8F0",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
  },

  editButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  editButtonCancelText: {
    color: "#475569",
    fontWeight: "700",
  },
  // Reschedule Requests Section
  rescheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 12,
    marginBottom: 10,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  rescheduleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rescheduleAvatar: {
    width: 38,
    height: 38,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  reschedulePatientName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  rescheduleService: {
    fontSize: 12,
    color: '#475569',
    marginTop: 1,
  },
  rescheduleSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  rescheduleSlotText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  rescheduledByBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  rescheduledByBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C2410C',
    textTransform: 'uppercase',
  },
  rescheduleNotesBox: {
    backgroundColor: '#FFF7ED',
    borderLeftWidth: 3,
    borderLeftColor: '#F97316',
    padding: 8,
    borderRadius: 6,
    marginVertical: 6,
  },
  rescheduleNotesLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9A3412',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  rescheduleNotesText: {
    fontSize: 12,
    color: '#7C2D12',
    fontStyle: 'italic',
  },
  rescheduleTimestampText: {
    fontSize: 10,
    color: '#94A3B8',
    marginBottom: 8,
    fontWeight: '500',
  },
  rescheduleActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  rescheduleConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047857',
    paddingVertical: 8,
    borderRadius: 7,
    borderBottomWidth: 2,
    borderBottomColor: '#065F46',
  },
  rescheduleConfirmBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  rescheduleReviewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescheduleReviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  emptyRescheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyRescheduleText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  // Reschedule Confirmation Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  confirmModalCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  confirmModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  confirmModalTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  confirmModalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  confirmModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  confirmModalCloseBtn: {
    padding: 6,
  },
  confirmPatientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  confirmPatientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  confirmPatientName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  confirmServiceText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 1,
  },
  confirmContactText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  scheduleChangesBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FED7AA',
    padding: 12,
    marginBottom: 12,
  },
  scheduleChangesBoxTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C2410C',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  scheduleNewSlotCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 10,
    marginBottom: 10,
  },
  slotDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotDetailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    marginRight: 6,
  },
  slotDetailValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  rescheduleMetaBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  metaRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaRowLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  requestedByPill: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  requestedByPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C2410C',
  },
  metaRowTimestamp: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  reasonCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F97316',
  },
  reasonTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9A3412',
    letterSpacing: 0.4,
  },
  reasonText: {
    fontSize: 12,
    color: '#7C2D12',
    fontStyle: 'italic',
    marginTop: 2,
  },
  confirmNoticeText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 14,
    textAlign: 'center',
  },
  confirmModalActionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  confirmModalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  confirmModalSubmitBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#047857',
    borderBottomWidth: 2.5,
    borderBottomColor: '#064E3B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmModalSubmitText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  // Success Modal Styles
  successModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22,
    width: '88%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  successIconOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#A7F3D0',
  },
  successIconInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#065F46',
    marginBottom: 6,
    textAlign: 'center',
  },
  successModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  successDetailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 18,
  },
  successPatientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  successPatientAvatar: {
    width: 38,
    height: 38,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  successPatientName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  successServiceText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 1,
  },
  successSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successSlotDate: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },
  successSlotDot: {
    marginHorizontal: 6,
    color: '#047857',
    fontWeight: '800',
  },
  successSlotTime: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  successDoneBtn: {
    width: '100%',
    backgroundColor: '#047857',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#064E3B',
  },
  successDoneBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

// ─────────────────────────────────────────
// HELPER COMPONENT
// ─────────────────────────────────────────

function DetailRow({
  label,
  value,
  isHighlight,
  isAlert,
}: {
  label: string;
  value: string;
  isHighlight?: boolean;
  isAlert?: boolean;
}) {
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 4,
      borderBottomColor: '#F1F5F9',
      borderBottomWidth: 1,
      gap: 10,
    }}>
      <Text style={{
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        flexShrink: 0,
      }}>
        {label}
      </Text>
      {isAlert ? (
        <View style={{
          backgroundColor: '#FEF2F2',
          borderWidth: 1,
          borderColor: '#FCA5A5',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 4,
        }}>
          <Text style={{
            fontSize: 11.5,
            fontWeight: '800',
            color: '#B91C1C',
            textAlign: 'right',
          }}>
            {value}
          </Text>
        </View>
      ) : isHighlight ? (
        <View style={{
          backgroundColor: '#ECFDF5',
          borderWidth: 1,
          borderColor: '#A7F3D0',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 4,
        }}>
          <Text style={{
            fontSize: 11.5,
            fontWeight: '800',
            color: '#047857',
            textAlign: 'right',
          }}>
            {value}
          </Text>
        </View>
      ) : (
        <Text style={{
          fontSize: 12.5,
          color: '#0F172A',
          textAlign: 'right',
          fontWeight: '700',
          flexShrink: 1,
        }}>
          {value}
        </Text>
      )}
    </View>
  );
}
