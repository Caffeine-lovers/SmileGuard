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
  BackHandler,
  Platform,
  ToastAndroid,
  Linking,
  PanResponder,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useClinic } from "../../contexts/ClinicContext";
import StatCard from "./StatCard";
import NotificationBell from "./NotificationBell";
import NotificationCenter from "./NotificationCenter";
import PatientDetailsView from "../patientrecord/PatientDetailsView";
import RecordsTab from "../navigation/RecordsTab";
import AppointmentsTab from "../navigation/AppointmentsTab";
import AppointmentsRequestTab from "../navigation/AppointmentsRequestTab";
import AppointmentEdit from "../appointments/appointmentEdit";
import AppointmentRequestPromptModal from "../appointments/AppointmentRequestPromptModal";
import {
  updateDoctorAppointmentStatus,
  getDoctorAppointments,
  getAppointmentRequests,
  confirmAppointmentReschedule,
} from "../../lib/appointmentService";
import { getPatientMedicalInfo } from "../../lib/profilesPatients";
import * as dashboardService from "../../lib/dashboardService";
import {
  getDoctorProfile,
  isDoctorGuideCompleted,
  markDoctorGuideCompleted,
} from "../../lib/doctorService";
import { supabase } from "@smileguard/supabase-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppTour, { useTourTargets, TourStep } from "../tour/AppTour";
import { getStatusColor, getStatusBgColor } from "../../lib/statusHelpers";
import {
  formatAppointmentDate,
  formatAppointmentTime,
} from "../../lib/dateFormatters";
import { useNotifications } from "../../hooks/useNotifications";
import { Notification, NotificationType } from "../../types/notifications";
import { CurrentUser } from "@smileguard/shared-types";
import {
  Stethoscope,
  X,
  Check,
  ShieldCheck,
  Menu,
  RefreshCw,
  Calendar,
  CalendarDays,
  ArrowUpDown,
  Users,
  LogOut,
  ChevronRight,
  Clock,
  LayoutDashboard,
  Sparkles,
  FileText,
  Phone,
  Compass,
  Inbox,
  AlertTriangle,
  Search,
  CheckCircle2,
  AlertCircle,
  HeartPulse,
} from "lucide-react-native";
import { getToday } from "../../data/dashboardData";

const APP_LOGO = require("../../assets/images/SmileGuard-Doc-Logo.png");

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
  status?: "pending" | "scheduled" | "completed" | "cancelled" | "no-show" | "declined";
  patient_id?: string;
  dentist_id?: string | null;
  medicalIntake?: any;
  doctor_note?: string;
  created_at?: string;
  rescheduled_by?: string | null;
  rescheduled_at?: string | null;
  reschedule_at?: string | null;
}

interface AssistantDashboardProps {
  user: CurrentUser;
  onLogout: () => void;
  promptAppointmentId?: string;
}

interface SwipeableRequestCardProps {
  request: DashboardAppointment;
  isSelected: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onDecline: () => void;
}

function SwipeableRequestCard({
  request,
  isSelected,
  onSelect,
  onAccept,
  onDecline,
}: SwipeableRequestCardProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const [swipeState, setSwipeState] = useState<"idle" | "accept-threshold" | "decline-threshold">("idle");
  const SWIPE_THRESHOLD = 70;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dy) < 14;
      },
      onPanResponderMove: (_, gestureState) => {
        pan.x.setValue(gestureState.dx);
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          setSwipeState("accept-threshold");
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          setSwipeState("decline-threshold");
        } else {
          setSwipeState("idle");
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe Left -> Accept
          Animated.timing(pan, {
            toValue: { x: -500, y: 0 },
            duration: 180,
            useNativeDriver: false,
          }).start(() => {
            onAccept();
          });
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe Right -> Decline
          Animated.timing(pan, {
            toValue: { x: 500, y: 0 },
            duration: 180,
            useNativeDriver: false,
          }).start(() => {
            onDecline();
            pan.setValue({ x: 0, y: 0 });
            setSwipeState("idle");
          });
        } else {
          // Reset position
          setSwipeState("idle");
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            tension: 40,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      {/* Accept Background (Green, revealed when swiping LEFT: pan.x < 0) */}
      <Animated.View
        style={[
          styles.swipeBackgroundFull,
          styles.swipeBackgroundAccept,
          {
            opacity: pan.x.interpolate({
              inputRange: [-SWIPE_THRESHOLD, -15, 0, 1],
              outputRange: [1, 1, 0, 0],
              extrapolate: "clamp",
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.swipeActionIndicatorRight,
            {
              transform: [
                {
                  scale: pan.x.interpolate({
                    inputRange: [-SWIPE_THRESHOLD * 2, -SWIPE_THRESHOLD, -20],
                    outputRange: [1.12, 1.05, 0.9],
                    extrapolate: "clamp",
                  }),
                },
                {
                  translateX: pan.x.interpolate({
                    inputRange: [-SWIPE_THRESHOLD * 2, -SWIPE_THRESHOLD, 0],
                    outputRange: [0, 0, 12],
                    extrapolate: "clamp",
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.swipeIconCircleAccept}>
            <Check size={20} color="#FFFFFF" strokeWidth={3} />
          </View>
          <Text style={styles.swipeActionLabel}>
            {swipeState === "accept-threshold" ? "CONFIRM ACCEPT" : "ACCEPT"}
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Decline Background (Red, revealed when swiping RIGHT: pan.x > 0) */}
      <Animated.View
        style={[
          styles.swipeBackgroundFull,
          styles.swipeBackgroundDecline,
          {
            opacity: pan.x.interpolate({
              inputRange: [-1, 0, 15, SWIPE_THRESHOLD],
              outputRange: [0, 0, 1, 1],
              extrapolate: "clamp",
            }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.swipeActionIndicatorLeft,
            {
              transform: [
                {
                  scale: pan.x.interpolate({
                    inputRange: [20, SWIPE_THRESHOLD, SWIPE_THRESHOLD * 2],
                    outputRange: [0.9, 1.05, 1.12],
                    extrapolate: "clamp",
                  }),
                },
                {
                  translateX: pan.x.interpolate({
                    inputRange: [0, SWIPE_THRESHOLD, SWIPE_THRESHOLD * 2],
                    outputRange: [-12, 0, 0],
                    extrapolate: "clamp",
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.swipeIconCircleDecline}>
            <X size={20} color="#FFFFFF" strokeWidth={3} />
          </View>
          <Text style={styles.swipeActionLabel}>
            {swipeState === "decline-threshold" ? "CONFIRM DECLINE" : "DECLINE"}
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Swipeable Foreground Card */}
      <Animated.View
        style={[
          styles.requestCardContainer,
          isSelected && styles.requestCardContainerSelected,
          { transform: [{ translateX: pan.x }] },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onSelect}
          style={styles.requestCardTop}
        >
          <Image
            source={
              typeof request.imageUrl === "string" && request.imageUrl.length > 0
                ? { uri: request.imageUrl }
                : require("../../assets/images/user.png")
            }
            style={styles.queueAvatar}
          />

          <View style={{ flex: 1, marginRight: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.queuePatientName} numberOfLines={1}>
                {request.name}
              </Text>
              {isSelected && (
                <View style={styles.activePrepDot}>
                  <Text style={styles.activePrepDotText}>SELECTED</Text>
                </View>
              )}
            </View>

            <Text style={styles.queueService} numberOfLines={1}>
              {request.service || "General Dental Consultation"}
            </Text>

            <View style={styles.queueMetaRow}>
              <View style={styles.queueMetaItem}>
                <Calendar size={11} color="#047857" style={{ marginRight: 3 }} />
                <Text style={styles.queueMetaText}>
                  {formatAppointmentDate(request.date)}
                </Text>
              </View>

              {request.time ? (
                <View style={styles.queueMetaItem}>
                  <Clock size={11} color="#0284C7" style={{ marginRight: 3 }} />
                  <Text style={[styles.queueMetaText, { color: "#0284C7" }]}>
                    {formatAppointmentTime(request.time)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View
            style={[
              styles.queueStatusBadge,
              { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
            ]}
          >
            <Text style={[styles.queueStatusText, { color: "#B45309" }]}>
              WAITING
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default function AssistantDashboard({
  user,
  onLogout,
  promptAppointmentId,
}: AssistantDashboardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { clinic } = useClinic();

  // ─────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const refreshRef = useRef<(() => void) | null>(null);

  const handleIncomingNotification = useCallback((notification: any) => {
    console.log("[AssistantDashboard] Incoming notification:", notification?.title);
    if (
      notification?.type?.startsWith("appointment-") ||
      notification?.type === "bill-paid" ||
      notification?.type === "billing-paid" ||
      notification?.type === "patient-registered"
    ) {
      refreshRef.current?.();
    }
  }, []);

  const notificationState = useNotifications(user?.id, true, handleIncomingNotification);

  // Profile state
  const [assistantProfile, setAssistantProfile] = useState<
    CurrentUser & {
      first_name?: string;
      middle_name?: string;
      last_name?: string;
      doctor_name?: string;
      gender?: string;
    }
  >(user);

  useEffect(() => {
    if (user) {
      setAssistantProfile((prev) => ({
        ...user,
        ...prev,
        first_name: prev.first_name || (user as any).first_name,
        last_name: prev.last_name || (user as any).last_name,
      }));
    }
  }, [user]);

  // Loading states
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(true);
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
  const [patientSortBy, setPatientSortBy] = useState<"name" | "date" | "service">("name");
  const [patientSortOrder, setPatientSortOrder] = useState<"asc" | "desc">("asc");
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const [viewingPatient, setViewingPatient] = useState<DashboardAppointment | null>(null);
  const [showQuickPatientSearch, setShowQuickPatientSearch] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "records" | "appointments" | "appointment-requests"
  >("dashboard");
  const [tabHistory, setTabHistory] = useState<
    ("dashboard" | "records" | "appointments" | "appointment-requests")[]
  >([]);
  const lastBackPressRef = useRef<number>(0);

  // Appointment requests search & sorting (orderly by created_at)
  const [requestSearchQuery, setRequestSearchQuery] = useState("");
  const [requestSortOrder, setRequestSortOrder] = useState<"desc" | "asc">("desc");

  // Reschedule confirmation modal state
  const [confirmingReschedule, setConfirmingReschedule] = useState<DashboardAppointment | null>(null);
  const [showRescheduleConfirmModal, setShowRescheduleConfirmModal] = useState(false);
  const [confirmingLoading, setConfirmingLoading] = useState(false);
  const [confirmedRescheduleIds, setConfirmedRescheduleIds] = useState<Set<string>>(new Set());
  const [rescheduleSuccessData, setRescheduleSuccessData] = useState<{
    patientName: string;
    service: string;
    date: string;
    time: string;
    imageUrl?: string | number;
  } | null>(null);
  const [showRescheduleSuccessModal, setShowRescheduleSuccessModal] = useState(false);

  // Filter for today's visits list
  const [queueFilter, setQueueFilter] = useState<"all" | "scheduled" | "completed">("all");

  // Appointment status edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);

  // App tour state
  const [tourVisible, setTourVisible] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [recordsTourTrigger, setRecordsTourTrigger] = useState(0);
  const [appointmentsTourTrigger, setAppointmentsTourTrigger] = useState(0);

  // Doctors map for resolving doctor names on appointments
  const [doctorsMap, setDoctorsMap] = useState<Record<string, string>>({});

  // Navigation handlers
  const navigateToTab = useCallback(
    (nextTab: "dashboard" | "records" | "appointments" | "appointment-requests") => {
      if (nextTab === activeTab) return;
      setTabHistory((prev) => {
        if (nextTab === "dashboard") {
          return [];
        }
        const filtered = prev.filter((t) => t !== nextTab);
        return [...filtered, activeTab];
      });
      setActiveTab(nextTab);
    },
    [activeTab]
  );

  const handleGoBack = useCallback(() => {
    if (sidebarOpen) {
      setSidebarOpen(false);
      return true;
    }
    if (tourVisible) {
      setTourVisible(false);
      return true;
    }
    if (showNotificationCenter) {
      setShowNotificationCenter(false);
      return true;
    }
    if (showEditModal) {
      setShowEditModal(false);
      setEditingAppointment(null);
      return true;
    }
    if (showPatientDetails) {
      setShowPatientDetails(false);
      setViewingPatient(null);
      return true;
    }
    if (showQuickPatientSearch) {
      setShowQuickPatientSearch(false);
      setQuickSearchQuery("");
      return true;
    }
    if (activeTab !== "dashboard") {
      if (tabHistory.length > 0) {
        const prevTab = tabHistory[tabHistory.length - 1];
        setTabHistory((prev) => prev.slice(0, prev.length - 1));
        setActiveTab(prevTab);
      } else {
        setActiveTab("dashboard");
      }
      return true;
    }

    const now = Date.now();
    if (now - lastBackPressRef.current < 2000) {
      return false;
    }
    lastBackPressRef.current = now;
    if (Platform.OS === "android") {
      ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
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
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [handleGoBack])
  );

  // ─────────────────────────────────────────
  // SIMPLE & FRIENDLY APP WALKTHROUGH
  // ─────────────────────────────────────────
  const tour = useTourTargets();
  const dashboardScrollRef = useRef<any>(null);
  const dashboardColumnsLayoutY = useRef<number>(0);
  const patientDetailsLayoutY = useRef<number>(0);

  const tourSteps: TourStep[] = [
    {
      id: "welcome",
      title: "Welcome to SmileGuard!",
      description:
        "Here is a quick look at how you can see arriving patients, check new booking requests, and help dentists get ready for appointments.",
      icon: Stethoscope,
      placement: "center",
      onEnter: () => setSidebarOpen(false),
    },
    {
      id: "menu-btn",
      target: "menu-btn",
      title: "Menu",
      description:
        "Tap here anytime to go to your Dashboard, Patient Records, Appointments, or Booking Requests.",
      icon: Menu,
      padding: 6,
      radius: 12,
      onEnter: () => setSidebarOpen(false),
    },
    {
      id: "task-hub",
      target: "task-hub",
      title: "Quick Actions",
      description:
        "Helpful shortcuts to review new bookings, check today's arrivals, or find a patient.",
      icon: LayoutDashboard,
      padding: 6,
      radius: 14,
      onEnter: () => {
        setSidebarOpen(false);
        setActiveTab("dashboard");
      },
    },
    {
      id: "stats-panel",
      target: "stats-panel",
      title: "Today at a Glance",
      description:
        "Shows today's visits, new requests waiting for you, and finished appointments.",
      icon: Calendar,
      padding: 6,
      radius: 14,
      onEnter: () => {
        setSidebarOpen(false);
        setActiveTab("dashboard");
      },
    },
    {
      id: "today-queue",
      target: "today-queue",
      title: "Today's Patients",
      description:
        "All patients scheduled to visit the clinic today. Tap any patient to view their info on the right.",
      icon: Calendar,
      padding: 6,
      radius: 14,
      onEnter: () => {
        setSidebarOpen(false);
        setActiveTab("dashboard");
      },
    },
    {
      id: "chairside-prep",
      target: "chairside-prep",
      title: "Patient Details & Alerts",
      description:
        "See important health alerts like allergies, call the patient, or change appointment times.",
      icon: HeartPulse,
      padding: 6,
      radius: 14,
      onEnter: () => {
        setSidebarOpen(false);
        setActiveTab("dashboard");
        const yOffset =
          (dashboardColumnsLayoutY.current || 280) + (patientDetailsLayoutY.current || 180) - 12;
        try {
          dashboardScrollRef.current?.scrollTo?.({ y: Math.max(0, yOffset), animated: false });
        } catch (e) {}
      },
      delay: 350,
    },
    {
      id: "finish",
      title: "You're All Set!",
      description:
        "You have everything you need to welcome patients, manage visits, and assist the clinic.",
      icon: ShieldCheck,
      placement: "center",
      onEnter: () => {
        setSidebarOpen(false);
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

        const key = `@smileguard_assistant_tour_completed_${user.id}`;
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
        console.warn("[AssistantDashboard] Failed checking tour status", e);
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
    if (user?.id) {
      await markDoctorGuideCompleted(user.id, "dashboard");
    }
  };

  const handleSkipTour = async () => {
    setTourVisible(false);
    setSidebarOpen(false);
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

  const today = getToday();
  const [appointments, setAppointments] = useState<DashboardAppointment[]>([]);
  const [patients, setPatients] = useState<DashboardAppointment[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    scheduled: 0,
    completed: 0,
    cancelled: 0,
    noShow: 0,
    paidBillings: 0,
  });

  // Today's appointments list
  const todayAppointments = useMemo(() => {
    return appointments
      .filter((apt) => apt.date === today && apt.status !== "declined" && apt.status !== "cancelled")
      .sort((a, b) => {
        const timeA = a.time || "";
        const timeB = b.time || "";

        const parseTime = (timeStr: string) => {
          const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (!match) return 0;
          let hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          const period = match[3]?.toUpperCase();
          if (period) {
            if (period === "PM" && hours !== 12) hours += 12;
            if (period === "AM" && hours === 12) hours = 0;
          }
          return hours * 60 + minutes;
        };

        return parseTime(timeA) - parseTime(timeB);
      });
  }, [appointments, today]);

  // Filtered appointments
  const filteredQueueAppointments = useMemo(() => {
    if (queueFilter === "scheduled") {
      return todayAppointments.filter((apt) => (apt.status || "scheduled") === "scheduled");
    }
    if (queueFilter === "completed") {
      return todayAppointments.filter((apt) => apt.status === "completed");
    }
    return todayAppointments;
  }, [todayAppointments, queueFilter]);

  // Reschedule requests filter: ONLY pending patient requests that have NOT been confirmed
  const rescheduleRequests = useMemo(() => {
    const combined = [...appointments, ...appointmentRequests];
    const map = new Map<string, DashboardAppointment>();

    combined.forEach((apt: DashboardAppointment) => {
      // 1. If already confirmed in this session, skip
      if (confirmedRescheduleIds.has(apt.id)) return;

      const rBy = (apt.rescheduled_by || '').toLowerCase().trim();
      const status = (apt.status || '').toLowerCase().trim();

      // If already finished or cancelled, skip
      if (['completed', 'cancelled', 'declined'].includes(status)) return;

      // 2. CRITICAL RULE: If rescheduled_by is 'assistant' or 'doctor', IT HAS BEEN CONFIRMED! Skip!
      if (rBy === 'assistant' || rBy === 'doctor' || rBy === 'clinic') return;

      // 3. If status is already 'scheduled', the appointment is confirmed/locked! Skip!
      if (status === 'scheduled') return;

      // 4. Only show if it is a pending reschedule request from the patient
      const isPatientReschedule =
        rBy === 'patient' ||
        (Boolean(apt.rescheduled_at || apt.reschedule_at || (apt.notes && apt.notes.toLowerCase().includes('reschedule'))) &&
         status === 'pending');

      if (isPatientReschedule && !map.has(apt.id)) {
        map.set(apt.id, apt);
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const tA = a.rescheduled_at || a.date ? new Date(a.rescheduled_at || a.date).getTime() : 0;
      const tB = b.rescheduled_at || b.date ? new Date(b.rescheduled_at || b.date).getTime() : 0;
      return tB - tA;
    });
  }, [appointments, appointmentRequests, confirmedRescheduleIds]);

  // Selected patient
  const [selectedPatient, setSelectedPatient] = useState<DashboardAppointment | null>(null);

  // Focus Patient Details on Today's Appointments
  useEffect(() => {
    if (todayAppointments.length > 0) {
      if (!selectedPatient || !todayAppointments.some((apt) => apt.id === selectedPatient.id)) {
        setSelectedPatient(todayAppointments[0]);
      }
    } else if (rescheduleRequests.length > 0) {
      if (!selectedPatient || !rescheduleRequests.some((apt) => apt.id === selectedPatient.id)) {
        setSelectedPatient(rescheduleRequests[0]);
      }
    } else if (appointmentRequests.length > 0) {
      if (!selectedPatient || !appointmentRequests.some((apt) => apt.id === selectedPatient.id)) {
        setSelectedPatient(appointmentRequests[0]);
      }
    } else {
      setSelectedPatient(null);
    }
  }, [todayAppointments, rescheduleRequests, appointmentRequests, selectedPatient]);

  // Load patient contact and intake notes
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
              emergencyContactName:
                intake.emergencyContactName || prev.medicalIntake?.emergencyContactName || "",
              emergencyContactPhone:
                intake.emergencyContactPhone || prev.medicalIntake?.emergencyContactPhone || "",
              allergies:
                intake.allergies || (intake as any).alergies || prev.medicalIntake?.allergies || "",
              medicalConditions:
                intake.medicalConditions || prev.medicalIntake?.medicalConditions || "",
              currentMedications:
                intake.currentMedications || prev.medicalIntake?.currentMedications || "",
              pwd_status: (intake as any).pwd_status || prev.medicalIntake?.pwd_status || "",
              pwd_type: (intake as any).pwd_type || prev.medicalIntake?.pwd_type || "",
            },
          };
        });
      } catch (err) {
        console.warn("[AssistantDashboard] Error loading contact info:", err);
      }
    };

    loadEmergencyContact();
    return () => {
      isMounted = false;
    };
  }, [selectedPatient?.id, selectedPatient?.patient_id]);

  // Filtered & sorted appointment requests (orderly by created_at, search by patient name)
  const filteredRequests = useMemo(() => {
    let list = [...appointmentRequests];
    if (requestSearchQuery.trim()) {
      const q = requestSearchQuery.toLowerCase().trim();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      const getTimestamp = (item: DashboardAppointment) => {
        if (item.created_at) {
          const parsed = new Date(item.created_at).getTime();
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        if (item.date) {
          const dateTimeStr = item.time ? `${item.date}T${item.time}` : item.date;
          const parsed = new Date(dateTimeStr).getTime();
          if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        return 0;
      };

      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);

      if (timeA !== timeB) {
        return requestSortOrder === "desc" ? timeB - timeA : timeA - timeB;
      }
      return requestSortOrder === "desc" ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name);
    });

    return list;
  }, [appointmentRequests, requestSearchQuery, requestSortOrder]);

    // Helper to open full patient chart
  const handleOpenPatientDetails = (item: DashboardAppointment) => {
    setViewingPatient({
      ...item,
      id: item.patient_id || item.id,
      patient_id: item.patient_id || item.id,
    });
    setShowPatientDetails(true);
  };

  // Helper to open status and reschedule modal
  const handleOpenStatusModal = (appointment: DashboardAppointment) => {
    setEditingAppointment({
      ...appointment,
      appointment_date: appointment.date,
      appointment_time: appointment.time,
      patient_name: appointment.name,
      patient_avatar: appointment.imageUrl,
    });
    setShowEditModal(true);
  };

  // Fetch doctors list for easy-to-read dentist tags
  const fetchDoctorsList = useCallback(async () => {
    try {
      const { data: doctorsData } = await supabase
        .from("doctors")
        .select("id, doctor_name, first_name, last_name, role");

      if (doctorsData && doctorsData.length > 0) {
        const map: Record<string, string> = {};
        doctorsData.forEach((d: any) => {
          const docName =
            d.doctor_name ||
            (d.first_name ? `Dr. ${d.first_name} ${d.last_name || ""}`.trim() : "Dentist");
          map[d.id] = docName;
        });
        setDoctorsMap(map);
      }
    } catch (e) {
      console.warn("[AssistantDashboard] Error fetching doctors list:", e);
    }
  }, []);

  // Fetch assistant profile
  const fetchAssistantInfo = useCallback(async () => {
    if (!user?.id) return;
    try {
      const profile = await getDoctorProfile(user.id);
      if (profile) {
        setAssistantProfile((prev) => ({
          ...prev,
          first_name: profile.first_name !== undefined ? profile.first_name : prev.first_name,
          middle_name: profile.middle_name !== undefined ? profile.middle_name : prev.middle_name,
          last_name: profile.last_name !== undefined ? profile.last_name : prev.last_name,
          gender: profile.gender !== undefined ? profile.gender : prev.gender,
          doctor_name: profile.doctor_name || prev.doctor_name,
          name: profile.doctor_name || (profile as any).name || prev.name,
        }));
      }
    } catch (error) {
      console.error("[AssistantDashboard] Error fetching assistant profile:", error);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAssistantInfo();
    fetchDoctorsList();
  }, [fetchAssistantInfo, fetchDoctorsList]);

  // ─────────────────────────────────────────
  // FETCH CLINIC DATA (FOR ASSISTANT)
  // ─────────────────────────────────────────
  const refreshDashboardData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoadingAppointments(true);
      setLoadingPatients(true);
      setErrorMessage(null);

      // 1. Fetch pending booking requests
      const appointmentRequestsData = await getAppointmentRequests();
      if (appointmentRequestsData && appointmentRequestsData.length > 0) {
        const filteredRequests = appointmentRequestsData.filter(
          (apt: any) =>
            !["cancelled", "declined", "completed", "no-show"].includes(
              (apt.status || "").toLowerCase()
            )
        );
        const transformedRequests = filteredRequests.map((apt: any) => {
          const medicalData = apt.patient_profile;
          const medicalIntake = medicalData
            ? {
                gender: medicalData.gender || "",
                phone: medicalData.phone || "",
                address: medicalData.address || "",
                dateOfBirth: medicalData.date_of_birth || "",
                emergencyContactName: medicalData.emergency_contact_name || "",
                emergencyContactPhone: medicalData.emergency_contact_phone || "",
                allergies: medicalData.allergies || (medicalData as any).alergies || "",
                currentMedications: medicalData.current_medications || "",
                medicalConditions: medicalData.medical_conditions || "",
                pastSurgeries: medicalData.past_surgeries || "",
                notes: medicalData.notes || "",
                pwd_status: (medicalData as any).pwd_status || "",
                pwd_type: (medicalData as any).pwd_type || "",
              }
            : null;

          return {
            id: apt.id || "",
            name: apt.patient_name || "Patient",
            service: apt.service || "",
            time: apt.appointment_time || "",
            date: apt.appointment_date || "",
            age: 0,
            gender: medicalData?.gender || apt.profiles?.gender || "",
            contact: medicalData?.phone || apt.profiles?.phone || apt.contact || apt.phone || "",
            email: apt.profiles?.email || apt.email || "",
            notes: apt.notes || "",
            imageUrl: apt.patient_avatar || require("../../assets/images/user.png"),
            status: (apt.status?.toLowerCase() === "pending"
              ? "pending"
              : apt.status || "pending") as any,
            patient_id: apt.patient_id,
            dentist_id: apt.dentist_id,
            medicalIntake,
            created_at: apt.created_at || (apt as any).appointment_date || null,
            rescheduled_by: apt.rescheduled_by || (apt as any).reschedule_by || null,
            rescheduled_at: apt.rescheduled_at || (apt as any).reschedule_at || null,
            reschedule_at: (apt as any).reschedule_at || apt.rescheduled_at || null,
          };
        });
        setAppointmentRequests(transformedRequests);
      } else {
        setAppointmentRequests([]);
      }

      // 2. Fetch all clinic appointments
      const rawRpcAppointments = await getDoctorAppointments(null);
      const rpcAppointments = (rawRpcAppointments || []).filter(
        (apt: any) => (apt.status || "").toLowerCase() !== "pending"
      );

      if (rpcAppointments && rpcAppointments.length > 0) {
        const transformedAppointments = rpcAppointments.map((apt: any) => {
          const medicalData = apt.patient_profile;
          const medicalIntake = medicalData
            ? {
                gender: medicalData.gender || "",
                phone: medicalData.phone || "",
                address: medicalData.address || "",
                dateOfBirth: medicalData.date_of_birth || "",
                emergencyContactName: medicalData.emergency_contact_name || "",
                emergencyContactPhone: medicalData.emergency_contact_phone || "",
                allergies: medicalData.allergies || (medicalData as any).alergies || "",
                currentMedications: medicalData.current_medications || "",
                medicalConditions: medicalData.medical_conditions || "",
                notes: medicalData.notes || "",
                pwd_status: (medicalData as any).pwd_status || "",
                pwd_type: (medicalData as any).pwd_type || "",
              }
            : null;

          return {
            id: apt.id || "",
            name: apt.patient_name || "Patient",
            service: apt.service || "",
            time: apt.appointment_time || "",
            date: apt.appointment_date || "",
            age: 0,
            gender: medicalData?.gender || apt.profiles?.gender || "",
            contact: medicalData?.phone || apt.profiles?.phone || apt.contact || apt.phone || "",
            email: apt.profiles?.email || apt.email || "",
            notes: apt.notes || "",
            imageUrl: apt.patient_avatar || require("../../assets/images/user.png"),
            status: (apt.status || "scheduled") as
              | "scheduled"
              | "completed"
              | "cancelled"
              | "no-show"
              | "declined",
            patient_id: apt.patient_id,
            dentist_id: apt.dentist_id,
            medicalIntake,
            created_at: apt.created_at || (apt as any).appointment_date || null,
            rescheduled_by: apt.rescheduled_by || (apt as any).reschedule_by || null,
            rescheduled_at: apt.rescheduled_at || (apt as any).reschedule_at || null,
            reschedule_at: (apt as any).reschedule_at || apt.rescheduled_at || null,
          };
        });
        setAppointments(transformedAppointments);

        const appointmentsExcludingDeclined = transformedAppointments.filter(
          (apt) => apt.status !== "declined"
        );
        const calculatedStats = {
          total: appointmentsExcludingDeclined.length,
          scheduled: appointmentsExcludingDeclined.filter((a) => a.status === "scheduled").length,
          completed: appointmentsExcludingDeclined.filter((a) => a.status === "completed").length,
          cancelled: appointmentsExcludingDeclined.filter((a) => a.status === "cancelled").length,
          noShow: appointmentsExcludingDeclined.filter((a) => a.status === "no-show").length,
          paidBillings: 0,
        };
        setStats(calculatedStats);
      } else {
        setAppointments([]);
        setStats({ total: 0, scheduled: 0, completed: 0, cancelled: 0, noShow: 0, paidBillings: 0 });
      }

      // 3. Fetch all patients
      const { success: patSuccess, data: patientData } = await dashboardService.fetchDoctorPatients(
        user.id!
      );
      if (patSuccess && patientData) {
        const transformedPatients = patientData.map((pat: any) => ({
          id: pat.id || "",
          name: pat.name || `${pat.first_name || ""} ${pat.last_name || ""}`.trim() || "Patient",
          service: "General Dental",
          time: "",
          date: pat.created_at || "",
          age: 0,
          gender: pat.gender || "",
          contact: pat.phone || "",
          email: pat.email || "",
          notes: pat.notes || "",
          imageUrl: pat.avatar_url || require("../../assets/images/user.png"),
          patient_id: pat.id,
          created_at: pat.created_at,
        }));
        setPatients(transformedPatients);
      } else {
        setPatients([]);
      }
    } catch (err: any) {
      console.error("[AssistantDashboard] Refresh error:", err);
      setErrorMessage(err.message || "Failed to load dashboard");
    } finally {
      setLoadingAppointments(false);
      setLoadingPatients(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshRef.current = refreshDashboardData;
  }, [refreshDashboardData]);

  useEffect(() => {
    refreshDashboardData();
  }, [refreshDashboardData]);

  // Request review accept / decline handlers (Responsive optimistic UI updates)
  const handleAcceptAppointmentRequest = async (request: DashboardAppointment) => {
    try {
      if (!user?.id) {
        Alert.alert("Error", "User not logged in");
        return;
      }

      // 1. Optimistic UI update: Immediately remove from requests and add to appointments
      setAppointmentRequests((prev) => prev.filter((r) => r.id !== request.id));
      setAppointments((prev) => [
        { ...request, status: "scheduled" as const },
        ...prev.filter((a) => a.id !== request.id),
      ]);
      setConfirmedRescheduleIds((prev) => new Set([...prev, request.id]));

      if (selectedPatient?.id === request.id) {
        setSelectedPatient((prev) => (prev ? { ...prev, status: "scheduled" as const } : prev));
      }

      const result = await updateDoctorAppointmentStatus(request.id, "scheduled", user.id, {
        dentist_id: request.dentist_id || undefined,
      });

      if (!result.success) {
        // Revert on failure
        setAppointmentRequests((prev) => [request, ...prev]);
        Alert.alert("Error", result.message);
        return;
      }

      if (Platform.OS === "android") {
        ToastAndroid.show(`Appointment confirmed for ${request.name}`, ToastAndroid.SHORT);
      } else {
        Alert.alert("Success", `Appointment for ${request.name} is now confirmed`);
      }
      refreshDashboardData();
    } catch (error) {
      setAppointmentRequests((prev) => [request, ...prev]);
      Alert.alert("Error", "Could not confirm appointment request");
    }
  };

  const handleDeclineAppointmentRequest = async (
    request: DashboardAppointment,
    doctorNote?: string
  ) => {
    try {
      if (!user?.id) {
        Alert.alert("Error", "User not logged in");
        return;
      }

      // 1. Optimistic UI update: Immediately disappear from request queue
      setAppointmentRequests((prev) => prev.filter((r) => r.id !== request.id));
      setConfirmedRescheduleIds((prev) => new Set([...prev, request.id]));

      const result = await updateDoctorAppointmentStatus(request.id, "declined", user.id, {
        dentist_id: request.dentist_id || undefined,
        doctor_note: doctorNote || undefined,
      });

      if (!result?.success) {
        setAppointmentRequests((prev) => [request, ...prev]);
        Alert.alert("Error", result?.message || "Could not decline appointment");
        return;
      }
      refreshDashboardData();
    } catch (error) {
      setAppointmentRequests((prev) => [request, ...prev]);
      Alert.alert("Error", "Could not decline appointment request");
    }
  };

  const handleConfirmReschedule = async (request: DashboardAppointment) => {
    // 1. Optimistic UI update: Immediately mark confirmed and change rescheduled_by to 'assistant'
    setConfirmedRescheduleIds((prev) => new Set([...prev, request.id]));
    setAppointmentRequests((prev) => prev.filter((r) => r.id !== request.id));
    setAppointments((prev) => {
      const exists = prev.some((a) => a.id === request.id);
      if (exists) {
        return prev.map((a) =>
          a.id === request.id
            ? { ...a, status: "scheduled" as const, rescheduled_by: "assistant" }
            : a
        );
      }
      return [{ ...request, status: "scheduled" as const, rescheduled_by: "assistant" }, ...prev];
    });

    if (selectedPatient?.id === request.id) {
      setSelectedPatient((prev) =>
        prev ? { ...prev, status: "scheduled" as const, rescheduled_by: "assistant" } : prev
      );
    }

    try {
      // 2. Persist to database: explicitly change rescheduled_by to 'assistant' and status to 'scheduled'
      await confirmAppointmentReschedule(
        request.id,
        'assistant',
        request.dentist_id || undefined
      );

      // 3. Show Success Modal
      setRescheduleSuccessData({
        patientName: request.name,
        service: request.service || 'Dental Consultation',
        date: request.date,
        time: request.time,
        imageUrl: request.imageUrl,
      });
      setShowRescheduleSuccessModal(true);
      await refreshDashboardData();
    } catch (err: any) {
      setConfirmedRescheduleIds((prev) => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
      Alert.alert('Error', err?.message || 'Failed to confirm reschedule');
    }
  };

    // Simple one-tap status update helper (Responsive optimistic update)
  const handleQuickStatusChange = async (
    targetAppointment: DashboardAppointment,
    newStatus: "scheduled" | "completed" | "cancelled" | "no-show"
  ) => {
    if (!user?.id) {
      Alert.alert("Error", "User not logged in");
      return;
    }

    // 1. Optimistic update
    setAppointments((prev) =>
      prev.map((apt) => (apt.id === targetAppointment.id ? { ...apt, status: newStatus } : apt))
    );
    if (selectedPatient?.id === targetAppointment.id) {
      setSelectedPatient((prev) => (prev ? { ...prev, status: newStatus } : prev));
    }
    if (newStatus === "completed" || newStatus === "cancelled") {
      setConfirmedRescheduleIds((prev) => new Set([...prev, targetAppointment.id]));
    }

    try {
      const result = await updateDoctorAppointmentStatus(
        targetAppointment.id,
        newStatus,
        user.id,
        { dentist_id: targetAppointment.dentist_id || undefined }
      );
      if (result.success) {
        const friendlyLabel =
          newStatus === "completed"
            ? "Done"
            : newStatus === "no-show"
            ? "Missed"
            : newStatus.toUpperCase();

        if (Platform.OS === "android") {
          ToastAndroid.show(`Marked as ${friendlyLabel}`, ToastAndroid.SHORT);
        }
        await refreshDashboardData();
      } else {
        Alert.alert("Error", result.message || "Could not update status");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update appointment status");
    }
  };

  // Sorting helper for patients
  const sortPatients = (patientsToSort: DashboardAppointment[]): DashboardAppointment[] => {
    const sorted = [...patientsToSort];
    if (patientSortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (patientSortBy === "date") {
      sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (patientSortBy === "service") {
      sorted.sort((a, b) => a.service.localeCompare(b.service));
    }
    if (patientSortOrder === "desc") {
      sorted.reverse();
    }
    return sorted;
  };

  const formatAccountCreatedDate = (rawDate?: string) => {
    if (!rawDate) return null;
    const parsed = new Date(rawDate);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Computed counts for today
  const todayScheduledCount = todayAppointments.filter(
    (a) => (a.status || "scheduled") === "scheduled"
  ).length;
  const todayCompletedCount = todayAppointments.filter((a) => a.status === "completed").length;

  const assistantDisplayName = useMemo(() => {
    if (assistantProfile.first_name) {
      return `${assistantProfile.first_name} ${assistantProfile.last_name || ""}`.trim();
    }
    return assistantProfile.name || assistantProfile.email?.split("@")[0] || "Assistant";
  }, [assistantProfile]);

  return (
    <SafeAreaView style={styles.mainContainer} edges={["top"]}>
      {/* ─────────────────────────────────────────
          TOP APP BAR
      ───────────────────────────────────────── */}
      <View style={styles.topAppBar}>
        <View style={styles.topAppBarLeft}>
          <View ref={tour.register("menu-btn")} collapsable={false}>
            <TouchableOpacity
              style={styles.menuIconButton}
              onPress={() => setSidebarOpen(true)}
              accessibilityLabel="Open navigation menu"
              activeOpacity={0.7}
            >
              <Menu size={22} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <View style={styles.appBarTitleGroup}>
            <View style={styles.brandRow}>
              <View style={styles.assistantBadgeMini}>
                <ShieldCheck size={12} color="#047857" />
                <Text style={styles.assistantBadgeMiniText}>ASSISTANT</Text>
              </View>
            </View>
            <Text style={styles.appBarSubTitle} numberOfLines={1}>
              {clinic?.clinic_name || "SmileGuard Dental Clinic"}
            </Text>
          </View>
        </View>

        <View style={styles.topAppBarRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleRestartTour}
            accessibilityLabel="App Guide"
            activeOpacity={0.7}
          >
            <Sparkles size={19} color="#047857" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={async () => {
              setIsRefreshing(true);
              await refreshDashboardData();
            }}
            accessibilityLabel="Refresh data"
            activeOpacity={0.7}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#047857" />
            ) : (
              <RefreshCw size={18} color="#475569" />
            )}
          </TouchableOpacity>

          <NotificationBell
            unreadCount={totalUnreadCount}
            onPress={() => setShowNotificationCenter(true)}
          />
        </View>
      </View>

      {/* ─────────────────────────────────────────
          MAIN CONTENT AREA / TABS
      ───────────────────────────────────────── */}
      <View style={styles.contentArea}>
        {activeTab === "dashboard" ? (
          <ScrollView ref={dashboardScrollRef} contentContainerStyle={styles.scrollContent}>
            <View style={styles.container}>
              {/* Friendly Assistant Header Banner */}
              <View style={styles.clinicBanner}>
                <View style={styles.clinicBannerBevel} />
                <View style={styles.clinicBannerContent}>
                  <View style={styles.clinicBannerIconBox}>
                    <Stethoscope size={24} color="#A7F3D0" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.clinicBannerBadgeRow}>
                      <View style={styles.clinicBannerBadge}>
                        <ShieldCheck size={11} color="#022C22" style={{ marginRight: 4 }} />
                        <Text style={styles.clinicBannerBadgeText}>
                          SMILEGUARD ASSISTANT
                        </Text>
                      </View>
                      <View style={styles.liveDutyBadge}>
                        <View style={styles.liveDutyDot} />
                        <Text style={styles.liveDutyText}>ACTIVE TODAY</Text>
                      </View>
                    </View>

                    <Text style={styles.clinicBannerDoctorName} numberOfLines={1}>
                      Assistant {assistantDisplayName}
                    </Text>
                    <Text style={styles.clinicBannerSubtitle} numberOfLines={1}>
                      Clinic Assistant • Helping Patients & Dentists
                    </Text>
                  </View>
                </View>
              </View>

              {/* QUICK ACTIONS (Simple, easy shortcuts) */}
              <View
                ref={tour.register("task-hub")}
                collapsable={false}
                style={styles.taskHubContainer}
              >
                <View style={styles.taskHubHeader}>
                  <Text style={styles.taskHubTitle}>QUICK ACTIONS</Text>
                  <Text style={styles.taskHubSubtitle}>Things you can do right away</Text>
                </View>

                <View style={styles.taskHubGrid}>
                  <TouchableOpacity
                    style={[styles.taskHubCard, { borderColor: "#F59E0B" }]}
                      activeOpacity={0.8}
                  >
                    <View style={[styles.taskHubIconWrap, { backgroundColor: "#FEF3C7" }]}>
                      <Inbox size={18} color="#D97706" />
                    </View>
                    <View style={styles.taskHubTextWrap}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={styles.taskHubCardTitle}>New Bookings</Text>
                        {appointmentRequests.length > 0 && (
                          <View style={styles.taskHubCountBadge}>
                            <Text style={styles.taskHubCountText}>
                              {appointmentRequests.length}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.taskHubCardDesc}>Check and accept new patient requests</Text>
                    </View>
                    <ChevronRight size={15} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.taskHubCard, { borderColor: "#10B981" }]}
                    onPress={() => {
                      setQueueFilter("scheduled");
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.taskHubIconWrap, { backgroundColor: "#ECFDF5" }]}>
                      <Clock size={18} color="#059669" />
                    </View>
                    <View style={styles.taskHubTextWrap}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={styles.taskHubCardTitle}>Today's Patients</Text>
                        <View
                          style={[styles.taskHubCountBadge, { backgroundColor: "#D1FAE5" }]}
                        >
                          <Text style={[styles.taskHubCountText, { color: "#065F46" }]}>
                            {todayScheduledCount}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.taskHubCardDesc}>See patients arriving today</Text>
                    </View>
                    <ChevronRight size={15} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.taskHubCard, { borderColor: "#3B82F6" }]}
                    onPress={() => setShowQuickPatientSearch(true)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.taskHubIconWrap, { backgroundColor: "#EFF6FF" }]}>
                      <Search size={18} color="#2563EB" />
                    </View>
                    <View style={styles.taskHubTextWrap}>
                      <Text style={styles.taskHubCardTitle}>Find a Patient</Text>
                      <Text style={styles.taskHubCardDesc}>Look up patient details and records</Text>
                    </View>
                    <ChevronRight size={15} color="#94A3B8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.taskHubCard, { borderColor: "#8B5CF6" }]}
                    onPress={() => navigateToTab("appointments")}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.taskHubIconWrap, { backgroundColor: "#F5F3FF" }]}>
                      <Calendar size={18} color="#7C3AED" />
                    </View>
                    <View style={styles.taskHubTextWrap}>
                      <Text style={styles.taskHubCardTitle}>Calendar</Text>
                      <Text style={styles.taskHubCardDesc}>See dentist schedules and open times</Text>
                    </View>
                    <ChevronRight size={15} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* TODAY'S OVERVIEW STATS */}
              <View
                ref={tour.register("stats-panel")}
                collapsable={false}
                style={styles.firstPanel}
              >
                <StatCard
                  number={appointmentRequests.length}
                  label="Booking Requests"
                  icon={<Inbox size={20} color="#D97706" />}
                  accentColor="#B45309"
                  bgTint="#FEF3C7"
                />
                <StatCard
                  number={rescheduleRequests.length}
                  label="Reschedule Requests"
                  icon={<CalendarDays size={20} color="#2563EB" />}
                  accentColor="#1D4ED8"
                  bgTint="#EFF6FF"
                />
                <StatCard
                  number={todayCompletedCount}
                  label="Done Today"
                  icon={<CheckCircle2 size={20} color="#047857" />}
                  accentColor="#047857"
                  bgTint="#ECFDF5"
                />

              </View>

              {/* MAIN 2-COLUMN DASHBOARD LAYOUT */}
              <View
                style={styles.dashboardColumns}
                onLayout={(e) => {
                  dashboardColumnsLayoutY.current = e.nativeEvent.layout.y;
                }}
              >
                                {/* ─────────────────────────────────────────────────────────────
                    LEFT COLUMN: APPOINTMENT REQUESTS & TODAY'S APPOINTMENTS
                ───────────────────────────────────────────────────────────── */}
                <View
                  ref={tour.register("today-queue")}
                  collapsable={false}
                  style={styles.column}
                >
                  {/* SECTION 1: APPOINTMENT REQUESTS */}
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleGroup}>
                      <Inbox size={16} color="#D97706" />
                      <Text style={styles.sectionHeaderTitle}>APPOINTMENT REQUESTS</Text>
                      <View style={[styles.pillCountBadge, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                        <Text style={[styles.pillCountText, { color: "#B45309" }]}>
                          {appointmentRequests.length}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => navigateToTab("appointment-requests")}
                      style={styles.seeAllBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.seeAllBtnText}>View all</Text>
                      <ChevronRight size={14} color="#047857" />
                    </TouchableOpacity>
                  </View>

                  {/* Search Bar & Sort Order Controls */}
                  <View style={styles.requestControlRow}>
                    <View style={styles.requestSearchBox}>
                      <Search size={13} color="#64748B" style={{ marginRight: 6 }} />
                      <TextInput
                        style={styles.requestSearchInput}
                        value={requestSearchQuery}
                        onChangeText={setRequestSearchQuery}
                        placeholder="Search patient name..."
                        placeholderTextColor="#94A3B8"
                      />
                      {requestSearchQuery.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setRequestSearchQuery("")}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <X size={13} color="#64748B" />
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.requestSortBtn}
                      onPress={() => setRequestSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                      activeOpacity={0.7}
                    >
                      <ArrowUpDown size={12} color="#047857" style={{ marginRight: 4 }} />
                      <Text style={styles.requestSortBtnText}>
                        {requestSortOrder === "desc" ? "Descending (Newest)" : "Ascending (Oldest)"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Swipe gesture helper hint */}
                  {filteredRequests.length > 0 && (
                    <View style={styles.swipeHintRow}>
                      <Text style={styles.swipeHintText}>
                        Swipe ← left to Accept  •  Swipe right → to Decline
                      </Text>
                    </View>
                  )}

                  {/* List of Appointment Requests - Scrollable if > 3 */}
                  {filteredRequests.length === 0 ? (
                    <View style={styles.emptyQueueBox}>
                      <Inbox size={26} color="#94A3B8" style={{ marginBottom: 6 }} />
                      <Text style={styles.emptyQueueTitle}>
                        {requestSearchQuery ? "No matching requests" : "No Pending Requests"}
                      </Text>
                      <Text style={styles.emptyQueueSubtitle}>
                        {requestSearchQuery
                          ? `No appointment requests found for "${requestSearchQuery}".`
                          : "New patient booking requests will appear here for you to accept or decline."}
                      </Text>
                    </View>
                  ) : filteredRequests.length > 3 ? (
                    <ScrollView
                      nestedScrollEnabled
                      style={styles.requestsScrollList}
                      contentContainerStyle={{ paddingBottom: 6 }}
                      showsVerticalScrollIndicator={true}
                    >
                      {filteredRequests.map((req) => (
                        <SwipeableRequestCard
                          key={req.id}
                          request={req}
                          isSelected={selectedPatient?.id === req.id}
                          onSelect={() => setSelectedPatient(req)}
                          onAccept={() => handleAcceptAppointmentRequest(req)}
                          onDecline={() => {
                            setPromptAppointment(req);
                            setShowPromptModal(true);
                          }}
                        />
                      ))}
                    </ScrollView>
                  ) : (
                    filteredRequests.map((req) => (
                      <SwipeableRequestCard
                        key={req.id}
                        request={req}
                        isSelected={selectedPatient?.id === req.id}
                        onSelect={() => setSelectedPatient(req)}
                        onAccept={() => handleAcceptAppointmentRequest(req)}
                        onDecline={() => {
                          setPromptAppointment(req);
                          setShowPromptModal(true);
                        }}
                      />
                    ))
                  )}

                  {/* ─────────────────────────────────────────────────────────────
                      SECTION 2: TODAY'S APPOINTMENTS (BELOW APPOINTMENT REQUESTS)
                  ───────────────────────────────────────────────────────────── */}
                  <View style={[styles.sectionHeaderRow, { marginTop: 20, marginBottom: 8 }]}>
                    <View style={styles.sectionTitleGroup}>
                      <Calendar size={16} color="#047857" />
                      <Text style={styles.sectionHeaderTitle}>TODAY'S APPOINTMENTS</Text>
                      <View style={styles.pillCountBadge}>
                        <Text style={styles.pillCountText}>{todayAppointments.length}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => navigateToTab("appointments")}
                      style={styles.seeAllBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.seeAllBtnText}>View all</Text>
                      <ChevronRight size={14} color="#047857" />
                    </TouchableOpacity>
                  </View>

                  {/* Queue Filter Tabs: All, Scheduled, Done */}
                  <View style={styles.queueFilterRow}>
                    <TouchableOpacity
                      style={[styles.queueFilterPill, queueFilter === "all" && styles.queueFilterPillActive]}
                      onPress={() => setQueueFilter("all")}
                    >
                      <Text style={[styles.queueFilterPillText, queueFilter === "all" && styles.queueFilterPillTextActive]}>
                        All ({todayAppointments.length})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.queueFilterPill, queueFilter === "scheduled" && styles.queueFilterPillActive]}
                      onPress={() => setQueueFilter("scheduled")}
                    >
                      <Text style={[styles.queueFilterPillText, queueFilter === "scheduled" && styles.queueFilterPillTextActive]}>
                        Scheduled ({todayScheduledCount})
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.queueFilterPill, queueFilter === "completed" && styles.queueFilterPillActive]}
                      onPress={() => setQueueFilter("completed")}
                    >
                      <Text style={[styles.queueFilterPillText, queueFilter === "completed" && styles.queueFilterPillTextActive]}>
                        Done ({todayCompletedCount})
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Today's Appointments List */}
                  {filteredQueueAppointments.length === 0 ? (
                    <View style={styles.emptyQueueBox}>
                      <Calendar size={26} color="#94A3B8" style={{ marginBottom: 6 }} />
                      <Text style={styles.emptyQueueTitle}>No visits scheduled for today</Text>
                      <Text style={styles.emptyQueueSubtitle}>
                        Today's arriving patients will appear here. Tap any patient to view their record on the right.
                      </Text>
                    </View>
                  ) : (
                    filteredQueueAppointments.map((apt) => {
                      const isSelected = selectedPatient?.id === apt.id;
                      return (
                        <TouchableOpacity
                          key={apt.id}
                          activeOpacity={0.8}
                          style={[
                            styles.queueCard,
                            isSelected && styles.queueCardSelected,
                          ]}
                          onPress={() => setSelectedPatient(apt)}
                        >
                          <Image
                            source={
                              typeof apt.imageUrl === "string" && apt.imageUrl.length > 0
                                ? { uri: apt.imageUrl }
                                : require("../../assets/images/user.png")
                            }
                            style={styles.queueAvatar}
                          />

                          <View style={{ flex: 1, marginRight: 8 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={styles.queuePatientName} numberOfLines={1}>
                                {apt.name}
                              </Text>
                              {isSelected && (
                                <View style={styles.activePrepDot}>
                                  <Text style={styles.activePrepDotText}>ACTIVE</Text>
                                </View>
                              )}
                            </View>

                            <Text style={styles.queueService} numberOfLines={1}>
                              {apt.service || "General Dental Consultation"}
                            </Text>

                            <View style={styles.queueMetaRow}>
                              {apt.time ? (
                                <View style={styles.queueMetaItem}>
                                  <Clock size={11} color="#047857" style={{ marginRight: 3 }} />
                                  <Text style={[styles.queueMetaText, { color: "#047857", fontWeight: "700" }]}>
                                    {formatAppointmentTime(apt.time)}
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                          </View>

                          <View
                            style={[
                              styles.queueStatusBadge,
                              {
                                backgroundColor: getStatusBgColor(apt.status || "scheduled"),
                                borderColor: getStatusColor(apt.status || "scheduled"),
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.queueStatusText,
                                { color: getStatusColor(apt.status || "scheduled") },
                              ]}
                            >
                              {apt.status === "completed"
                                ? "DONE"
                                : apt.status === "no-show"
                                ? "MISSED"
                                : (apt.status || "SCHEDULED").toUpperCase()}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>

                {/* ─────────────────────────────────────────
                    RIGHT COLUMN: SELECTED PATIENT DETAILS
                ───────────────────────────────────────── */}
                <View style={styles.column}>
                  <View
                    ref={tour.register("chairside-prep")}
                    collapsable={false}
                    onLayout={(e) => {
                      patientDetailsLayoutY.current = e.nativeEvent.layout.y;
                    }}
                  >
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionTitleGroup}>
                        <HeartPulse size={15} color="#047857" />
                        <Text style={styles.sectionHeaderTitle}>PATIENT DETAILS</Text>
                      </View>
                    </View>

                    {!selectedPatient ? (
                      <View style={styles.emptyPrepCard}>
                        <View style={styles.emptyPrepIconBox}>
                          <Users size={22} color="#047857" />
                        </View>
                        <Text style={styles.emptyPrepTitle}>NO PATIENT SELECTED</Text>
                        <Text style={styles.emptyPrepDesc}>
                          Tap any patient from the list on the left to see their details, notes, and medical alerts.
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.detailsCard, styles.shadow]}>
                        {/* Status Badge in Corner */}
                        <View
                          style={{
                            position: "absolute",
                            top: 12,
                            right: 12,
                            paddingHorizontal: 8,
                            paddingVertical: 3.5,
                            borderRadius: 4,
                            borderWidth: 1,
                            borderColor: getStatusColor(selectedPatient.status || "scheduled"),
                            backgroundColor: getStatusBgColor(
                              selectedPatient.status || "scheduled"
                            ),
                            zIndex: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: "bold",
                              color: getStatusColor(selectedPatient.status || "scheduled"),
                              fontSize: 10,
                              letterSpacing: 0.6,
                            }}
                          >
                            {selectedPatient.status === "completed"
                              ? "DONE"
                              : selectedPatient.status === "no-show"
                              ? "MISSED"
                              : (selectedPatient.status || "scheduled").toUpperCase()}
                          </Text>
                        </View>

                        {/* Patient Header */}
                        <View style={styles.prepPatientHeader}>
                          <Image
                            source={
                              typeof selectedPatient.imageUrl === "string" &&
                              selectedPatient.imageUrl.length > 0
                                ? { uri: selectedPatient.imageUrl }
                                : require("../../assets/images/user.png")
                            }
                            style={styles.prepAvatar}
                          />
                          <Text style={styles.prepPatientName}>{selectedPatient.name}</Text>

                          {/* Contact & Phone call button */}
                          <View style={styles.prepContactRow}>
                            {selectedPatient.contact ? (
                              <TouchableOpacity
                                style={styles.prepCallBtn}
                                onPress={() => {
                                  Linking.openURL(`tel:${selectedPatient.contact}`);
                                }}
                                activeOpacity={0.8}
                              >
                                <Phone size={12} color="#047857" style={{ marginRight: 4 }} />
                                <Text style={styles.prepCallBtnText}>
                                  Call {selectedPatient.contact}
                                </Text>
                              </TouchableOpacity>
                            ) : selectedPatient.email ? (
                              <Text style={styles.prepEmailText}>{selectedPatient.email}</Text>
                            ) : null}
                          </View>

                          {/* Senior / PWD Tag */}
                          {((selectedPatient as any).pwd_status === "approved" ||
                            (selectedPatient as any).medicalIntake?.pwd_status === "approved") && (
                            <View style={styles.pwdApprovedBadge}>
                              <Text style={styles.pwdApprovedText}>
                                ✓ {(selectedPatient as any).pwd_type === "senior"
                                  ? "Senior Citizen"
                                  : "PWD"}
                              </Text>
                            </View>
                          )}
                          {((selectedPatient as any).pwd_status === "pending" ||
                            (selectedPatient as any).medicalIntake?.pwd_status === "pending") && (
                            <View style={styles.pwdPendingBadge}>
                              <Text style={styles.pwdPendingText}>
                                ⚠️ Senior / PWD Under Review
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* IMPORTANT HEALTH ALERTS */}
                        <View style={styles.medicalAlertBox}>
                          <View style={styles.alertBoxHeader}>
                            <AlertTriangle size={14} color="#B45309" />
                            <Text style={styles.alertBoxTitle}>
                              IMPORTANT HEALTH ALERTS
                            </Text>
                          </View>

                          {/* Allergies Alert */}
                          {selectedPatient.medicalIntake?.allergies ? (
                            <View style={styles.allergyWarningCard}>
                              <Text style={styles.allergyWarningLabel}>⚠️ ALLERGIES:</Text>
                              <Text style={styles.allergyWarningValue}>
                                {selectedPatient.medicalIntake.allergies}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.safeIntakeRow}>
                              <CheckCircle2 size={13} color="#059669" />
                              <Text style={styles.safeIntakeText}>
                                No known allergies reported
                              </Text>
                            </View>
                          )}

                          {/* Medical conditions */}
                          {selectedPatient.medicalIntake?.medicalConditions ? (
                            <View style={{ marginTop: 6 }}>
                              <Text style={styles.conditionLabel}>Medical Conditions:</Text>
                              <Text style={styles.conditionValue}>
                                {selectedPatient.medicalIntake.medicalConditions}
                              </Text>
                            </View>
                          ) : null}

                          {/* Emergency Contact */}
                          {selectedPatient.medicalIntake?.emergencyContactName ||
                          selectedPatient.medicalIntake?.emergencyContactPhone ? (
                            <View style={styles.emergencyContactRow}>
                              <Text style={styles.emergencyLabel}>Emergency Contact:</Text>
                              <Text style={styles.emergencyValue}>
                                {selectedPatient.medicalIntake.emergencyContactName || "Family Member"}{" "}
                                ({selectedPatient.medicalIntake.emergencyContactPhone || "No number"})
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        {/* APPOINTMENT DETAILS */}
                        <View style={styles.appointmentDetailsBox}>
                          <View style={styles.detailsBoxHeader}>
                            <Calendar size={13} color="#047857" />
                            <Text style={styles.detailsBoxTitle}>APPOINTMENT DETAILS</Text>
                          </View>

                          <DetailRow
                            label="Service"
                            value={selectedPatient.service || "General Dental"}
                          />
                          <DetailRow
                            label="Time"
                            value={
                              selectedPatient.time
                                ? formatAppointmentTime(selectedPatient.time)
                                : "Not set"
                            }
                            isHighlight={true}
                          />
                          <DetailRow
                            label="Date"
                            value={
                              formatAppointmentDate(selectedPatient.date) || "Not set"
                            }
                          />
                          {selectedPatient.notes ? (
                            <DetailRow label="Notes" value={selectedPatient.notes} />
                          ) : null}
                        </View>

                        {/* ACTION BUTTONS: DEDICATED ACCEPT OR DECLINE SECTION */}
                        {selectedPatient.status === "pending" ? (
                          <View style={styles.decisionSectionCard}>
                            <View style={styles.decisionHeader}>
                              <ShieldCheck size={15} color="#047857" style={{ marginRight: 6 }} />
                              <Text style={styles.decisionTitle}>CONFIRM OR DECLINE REQUEST</Text>
                            </View>
                            <Text style={styles.decisionSubtitle}>
                              Confirm booking for {selectedPatient.name} or decline with a note.
                            </Text>

                            <View style={styles.decisionBtnRow}>
                              <TouchableOpacity
                                style={styles.decisionAcceptBtn}
                                onPress={() => handleAcceptAppointmentRequest(selectedPatient)}
                                activeOpacity={0.85}
                              >
                                <Check size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
                                <Text style={styles.decisionAcceptText}>Accept Booking</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.decisionDeclineBtn}
                                onPress={() => {
                                  setPromptAppointment(selectedPatient);
                                  setShowPromptModal(true);
                                }}
                                activeOpacity={0.85}
                              >
                                <X size={14} color="#E11D48" style={{ marginRight: 5 }} />
                                <Text style={styles.decisionDeclineText}>Decline</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <>
                            <View style={styles.actionButtonRow}>
                              <TouchableOpacity
                                style={styles.fullRecordBtn}
                                onPress={() => handleOpenPatientDetails(selectedPatient)}
                                activeOpacity={0.8}
                              >
                                <FileText size={13} color="#FFFFFF" />
                                <Text style={styles.fullRecordBtnText}>VIEW FULL RECORD</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.updateStatusBtn}
                                onPress={() => handleOpenStatusModal(selectedPatient)}
                                activeOpacity={0.8}
                              >
                                <Clock size={13} color="#1E293B" />
                                <Text style={styles.updateStatusBtnText}>CHANGE STATUS</Text>
                              </TouchableOpacity>
                            </View>

                            {/* FAST 1-TAP STATUS BUTTONS */}
                            <View style={styles.quickStatusRow}>
                              <TouchableOpacity
                                style={[styles.quickStatusBtn, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}
                                onPress={() => handleQuickStatusChange(selectedPatient, "completed")}
                                activeOpacity={0.8}
                              >
                                <CheckCircle2 size={12} color="#047857" />
                                <Text style={[styles.quickStatusBtnText, { color: "#047857" }]}>
                                  Mark as Done
                                </Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={[styles.quickStatusBtn, { backgroundColor: "#FFF1F2", borderColor: "#FECDD3" }]}
                                onPress={() => handleQuickStatusChange(selectedPatient, "no-show")}
                                activeOpacity={0.8}
                              >
                                <AlertCircle size={12} color="#E11D48" />
                                <Text style={[styles.quickStatusBtnText, { color: "#E11D48" }]}>
                                  Did Not Show
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </>
                        )}
                      </View>
                    )}
                  </View>

                                    {/* ─────────────────────────────────────────────────────────────
                      RESCHEDULE REQUESTS SECTION
                  ───────────────────────────────────────────────────────────── */}
                  <View style={[styles.sectionHeaderRow, { marginTop: 22, marginBottom: 10 }]}>
                    <View style={styles.sectionTitleGroup}>
                      <CalendarDays size={16} color="#D97706" />
                      <Text style={styles.sectionHeaderTitle}>RESCHEDULE REQUESTS</Text>
                      <View style={[styles.pillCountBadge, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                        <Text style={[styles.pillCountText, { color: "#B45309" }]}>{rescheduleRequests.length}</Text>
                      </View>
                    </View>
                  </View>

                  {rescheduleRequests.length > 0 ? (
                    rescheduleRequests.map((req) => (
                      <View key={req.id} style={styles.rescheduleCard}>
                        {/* Card Top: Patient & Rescheduled By */}
                        <View style={styles.rescheduleCardTop}>
                          <Image
                            source={
                              typeof req.imageUrl === "string" && req.imageUrl.length > 0
                                ? { uri: req.imageUrl }
                                : require("../../assets/images/user.png")
                            }
                            style={styles.rescheduleAvatar}
                          />
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.reschedulePatientName}>{req.name}</Text>
                            <Text style={styles.rescheduleService}>{req.service || "Dental Visit"}</Text>
                            <View style={styles.rescheduleSlotRow}>
                              <Calendar size={12} color="#047857" style={{ marginRight: 4 }} />
                              <Text style={styles.rescheduleSlotText}>
                                {formatAppointmentDate(req.date)} • {formatAppointmentTime(req.time)}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.rescheduledByBadge}>
                            <Text style={styles.rescheduledByBadgeText}>
                              {req.rescheduled_by ? `By ${req.rescheduled_by}` : "Requested"}
                            </Text>
                          </View>
                        </View>

                        {/* Reason / Notes */}
                        {req.notes ? (
                          <View style={styles.rescheduleNotesBox}>
                            <Text style={styles.rescheduleNotesLabel}>Reason for Rescheduling:</Text>
                            <Text style={styles.rescheduleNotesText} numberOfLines={3}>
                              "{req.notes}"
                            </Text>
                          </View>
                        ) : null}

                        {/* Request timestamp if available */}
                        {(req.rescheduled_at || req.reschedule_at) && (
                          <Text style={styles.rescheduleTimestampText}>
                            Requested on: {formatAppointmentDate(req.rescheduled_at || req.reschedule_at || "")}
                          </Text>
                        )}

                        {/* Actions */}
                        <View style={styles.rescheduleActionRow}>
                          <TouchableOpacity
                            style={styles.rescheduleConfirmBtn}
                            onPress={() => {
                              setConfirmingReschedule(req);
                              setShowRescheduleConfirmModal(true);
                            }}
                            activeOpacity={0.8}
                          >
                            <Check size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                            <Text style={styles.rescheduleConfirmBtnText}>Confirm Time</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.rescheduleReviewBtn}
                            onPress={() => handleOpenStatusModal(req)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.rescheduleReviewBtnText}>Change Status</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyRescheduleCard}>
                      <Clock size={16} color="#94A3B8" style={{ marginBottom: 4 }} />
                      <Text style={styles.emptyRescheduleText}>No pending reschedule requests</Text>
                    </View>
                  )}


                </View>
              </View>

              
            </View>
          </ScrollView>
        ) : activeTab === "records" ? (
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
          />
        ) : activeTab === "appointments" ? (
          <AppointmentsTab
            startTourTrigger={appointmentsTourTrigger}
            appointments={appointments}
            onUpdateAppointmentStatus={async (appointmentId, status) => {
              if (user?.id) {
                await updateDoctorAppointmentStatus(appointmentId, status, user.id);
                await refreshDashboardData();
              }
            }}
            styles={styles}
            doctorId={user?.id || ""}
            userRole="assistant"
            onAppointmentStatusUpdated={() => {
              refreshDashboardData();
            }}
          />
        ) : activeTab === "appointment-requests" ? (
          <AppointmentsRequestTab
            userId={user?.id || ""}
            onRequestAccepted={async () => {
              await refreshDashboardData();
            }}
            styles={styles}
          />
        ) : null}
      </View>

      {/* ─────────────────────────────────────────
          MODALS & OVERLAYS
      ───────────────────────────────────────── */}

      {/* Notifications Modal */}
      <Modal
        visible={showNotificationCenter}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNotificationCenter(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
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
              onNavigateToTab={(tab: any) => {
                setShowNotificationCenter(false);
                if (
                  tab === "appointments" ||
                  tab === "records" ||
                  tab === "appointment-requests"
                ) {
                  navigateToTab(tab);
                }
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* Reschedule Confirmation Success Modal */}
      <Modal
        visible={showRescheduleSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowRescheduleSuccessModal(false);
          setRescheduleSuccessData(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successIconOuter}>
              <View style={styles.successIconInner}>
                <CheckCircle2 size={36} color="#059669" />
              </View>
            </View>

            <Text style={styles.successModalTitle}>Reschedule Confirmed!</Text>
            <Text style={styles.successModalSubtitle}>
              The appointment has been successfully updated and locked in the schedule.
            </Text>

            {rescheduleSuccessData && (
              <View style={styles.successDetailsBox}>
                <View style={styles.successPatientRow}>
                  <Image
                    source={
                      typeof rescheduleSuccessData.imageUrl === "string" && rescheduleSuccessData.imageUrl.length > 0
                        ? { uri: rescheduleSuccessData.imageUrl }
                        : require("../../assets/images/user.png")
                    }
                    style={styles.successPatientAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.successPatientName}>{rescheduleSuccessData.patientName}</Text>
                    <Text style={styles.successServiceText}>{rescheduleSuccessData.service}</Text>
                  </View>
                </View>

                <View style={styles.successSlotRow}>
                  <Calendar size={14} color="#047857" style={{ marginRight: 6 }} />
                  <Text style={styles.successSlotDate}>
                    {formatAppointmentDate(rescheduleSuccessData.date)}
                  </Text>
                  <Text style={styles.successSlotDot}>•</Text>
                  <Clock size={14} color="#047857" style={{ marginRight: 4 }} />
                  <Text style={styles.successSlotTime}>
                    {formatAppointmentTime(rescheduleSuccessData.time)}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.successDoneBtn}
              onPress={() => {
                setShowRescheduleSuccessModal(false);
                setRescheduleSuccessData(null);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.successDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reschedule Confirmation Modal Screen */}
      <Modal
        visible={showRescheduleConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!confirmingLoading) setShowRescheduleConfirmModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            {/* Header */}
            <View style={styles.confirmModalHeader}>
              <View style={styles.confirmModalTitleGroup}>
                <View style={styles.confirmModalIconWrap}>
                  <CalendarDays size={18} color="#047857" />
                </View>
                <View>
                  <Text style={styles.confirmModalTitle}>Confirm Reschedule</Text>
                  <Text style={styles.confirmModalSubtitle}>Review requested schedule changes</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setShowRescheduleConfirmModal(false)}
                disabled={confirmingLoading}
                style={styles.confirmModalCloseBtn}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {confirmingReschedule && (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {/* Patient Overview */}
                <View style={styles.confirmPatientRow}>
                  <Image
                    source={
                      typeof confirmingReschedule.imageUrl === "string" && confirmingReschedule.imageUrl.length > 0
                        ? { uri: confirmingReschedule.imageUrl }
                        : require("../../assets/images/user.png")
                    }
                    style={styles.confirmPatientAvatar}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.confirmPatientName}>{confirmingReschedule.name}</Text>
                    <Text style={styles.confirmServiceText}>
                      {confirmingReschedule.service || "General Dental Consultation"}
                    </Text>
                    {confirmingReschedule.contact ? (
                      <Text style={styles.confirmContactText}>{confirmingReschedule.contact}</Text>
                    ) : null}
                  </View>
                </View>

                {/* Requested Schedule Changes Box */}
                <View style={styles.scheduleChangesBox}>
                  <Text style={styles.scheduleChangesBoxTitle}>NEW REQUESTED APPOINTMENT TIME</Text>

                  <View style={styles.scheduleNewSlotCard}>
                    <View style={styles.slotDetailRow}>
                      <Calendar size={15} color="#047857" style={{ marginRight: 6 }} />
                      <Text style={styles.slotDetailLabel}>Date:</Text>
                      <Text style={styles.slotDetailValue}>
                        {formatAppointmentDate(confirmingReschedule.date)}
                      </Text>
                    </View>

                    <View style={[styles.slotDetailRow, { marginTop: 6 }]}>
                      <Clock size={15} color="#047857" style={{ marginRight: 6 }} />
                      <Text style={styles.slotDetailLabel}>Time:</Text>
                      <Text style={styles.slotDetailValue}>
                        {confirmingReschedule.time ? formatAppointmentTime(confirmingReschedule.time) : "Not specified"}
                      </Text>
                    </View>
                  </View>

                  {/* Rescheduling Meta: Who requested and when */}
                  <View style={styles.rescheduleMetaBlock}>
                    <View style={styles.metaRowItem}>
                      <Text style={styles.metaRowLabel}>Requested by:</Text>
                      <View style={styles.requestedByPill}>
                        <Text style={styles.requestedByPillText}>
                          {confirmingReschedule.rescheduled_by ? confirmingReschedule.rescheduled_by.toUpperCase() : "PATIENT"}
                        </Text>
                      </View>
                    </View>

                    {(confirmingReschedule.rescheduled_at || confirmingReschedule.reschedule_at) && (
                      <View style={[styles.metaRowItem, { marginTop: 6 }]}>
                        <Text style={styles.metaRowLabel}>Request submitted:</Text>
                        <Text style={styles.metaRowTimestamp}>
                          {formatAppointmentDate(confirmingReschedule.rescheduled_at || confirmingReschedule.reschedule_at || "")}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Reason for Rescheduling ("notes" column) */}
                  <View style={styles.reasonCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                      <FileText size={13} color="#C2410C" style={{ marginRight: 4 }} />
                      <Text style={styles.reasonTitle}>REASON FOR RESCHEDULING</Text>
                    </View>
                    <Text style={styles.reasonText}>
                      "{confirmingReschedule.notes || "No specific reason provided by patient."}"
                    </Text>
                  </View>
                </View>

                {/* Prompt/Notice text */}
                <Text style={styles.confirmNoticeText}>
                  Confirming will lock this new appointment schedule on the clinic calendar and update the patient's record.
                </Text>
              </ScrollView>
            )}

            {/* Modal Actions */}
            <View style={styles.confirmModalActionRow}>
              <TouchableOpacity
                style={styles.confirmModalCancelBtn}
                onPress={() => setShowRescheduleConfirmModal(false)}
                disabled={confirmingLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmModalSubmitBtn}
                onPress={async () => {
                  if (!confirmingReschedule) return;
                  const itemToConfirm = confirmingReschedule;
                  setShowRescheduleConfirmModal(false);
                  setConfirmingReschedule(null);
                  try {
                    setConfirmingLoading(true);
                    await handleConfirmReschedule(itemToConfirm);
                  } finally {
                    setConfirmingLoading(false);
                  }
                }}
                disabled={confirmingLoading}
                activeOpacity={0.8}
              >
                {confirmingLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.confirmModalSubmitText}>Confirm & Lock Time</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Patient Details & History */}
      <PatientDetailsView
        visible={showPatientDetails}
        patient={viewingPatient}
        doctorId={user?.id || ""}
        onClose={() => {
          setShowPatientDetails(false);
          setViewingPatient(null);
        }}
        onAppointmentStatusUpdated={() => {
          refreshDashboardData();
        }}
      />

      {/* Status & Reschedule Modal */}
      {editingAppointment && (
        <AppointmentEdit
          visible={showEditModal}
          appointment={editingAppointment}
          doctorId={user?.id || ""}
          userRole="assistant"
          onClose={() => {
            setShowEditModal(false);
            setEditingAppointment(null);
          }}
          onSave={async () => {
            await refreshDashboardData();
          }}
          onAppointmentStatusUpdated={() => {
            refreshDashboardData();
          }}
        />
      )}

      {/* Review Request Modal */}
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

      {/* Find Patient Modal */}
      <Modal
        visible={showQuickPatientSearch}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuickPatientSearch(false)}
      >
        <View style={styles.quickSearchOverlay}>
          <View style={styles.quickSearchBox}>
            <View style={styles.quickSearchHeader}>
              <Text style={styles.quickSearchTitle}>FIND A PATIENT</Text>
              <TouchableOpacity
                onPress={() => setShowQuickPatientSearch(false)}
                style={styles.quickSearchCloseBtn}
              >
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.quickSearchInputRow}>
              <Search size={18} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.quickSearchInput}
                placeholder="Type name, email, or phone..."
                placeholderTextColor="#94A3B8"
                value={quickSearchQuery}
                onChangeText={setQuickSearchQuery}
                autoFocus
              />
            </View>

            <ScrollView style={{ maxHeight: 260 }}>
              {patients
                .filter(
                  (p) =>
                    !quickSearchQuery ||
                    p.name.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                    p.email.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                    p.contact.includes(quickSearchQuery)
                )
                .slice(0, 8)
                .map((patient) => (
                  <TouchableOpacity
                    key={patient.id}
                    style={styles.quickSearchResultItem}
                    onPress={() => {
                      setShowQuickPatientSearch(false);
                      handleOpenPatientDetails(patient);
                    }}
                  >
                    <Image
                      source={
                        typeof patient.imageUrl === "string" && patient.imageUrl.length > 0
                          ? { uri: patient.imageUrl }
                          : require("../../assets/images/user.png")
                      }
                      style={{ width: 36, height: 36, borderRadius: 6, marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "bold", fontSize: 13, color: "#0F172A" }}>
                        {patient.name}
                      </Text>
                      <Text style={{ fontSize: 11, color: "#64748B" }}>
                        {patient.email || patient.contact || "No contact info"}
                      </Text>
                    </View>
                    <ChevronRight size={14} color="#94A3B8" />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─────────────────────────────────────────
          SIDEBAR MENU & BACKDROP
      ───────────────────────────────────────── */}
      {sidebarOpen && (
        <TouchableOpacity
          style={styles.backdropOverlay}
          onPress={() => setSidebarOpen(false)}
          activeOpacity={1}
        />
      )}

      <Animated.View
        pointerEvents={sidebarOpen ? "auto" : "none"}
        style={[
          styles.sidebarDrawer,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 20),
            transform: [{ translateX: sidebarAnimatedValue }],
          },
        ]}
      >
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarBrandRow}>
            {clinic?.logo_url === "APP_LOGO" ? (
              <Image
                source={APP_LOGO}
                style={[styles.sidebarBrandLogo, { backgroundColor: "rgba(255, 255, 255, 0.15)" }]}
                resizeMode="contain"
              />
            ) : clinic?.logo_url ? (
              <Image
                source={{ uri: clinic.logo_url }}
                style={styles.sidebarBrandLogo}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.sidebarBrandIcon}>
                <Stethoscope size={22} color="#A7F3D0" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.logoTitle} numberOfLines={1}>
                {clinic?.clinic_name || "SmileGuard"}
              </Text>
              <Text style={styles.sidebarSubtitle} numberOfLines={1}>
                Assistant Portal
              </Text>
            </View>
            <TouchableOpacity
              style={styles.sidebarCloseButton}
              onPress={() => setSidebarOpen(false)}
              accessibilityLabel="Close menu"
              activeOpacity={0.7}
            >
              <X size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.navItems}>
          <View style={styles.navItemsList}>
            <TouchableOpacity
              style={[styles.navItem, activeTab === "dashboard" && styles.navItemActive]}
              onPress={() => {
                setActiveTab("dashboard");
                setTabHistory([]);
                setSidebarOpen(false);
              }}
            >
              <LayoutDashboard
                size={20}
                color={activeTab === "dashboard" ? "#A7F3D0" : "#FFFFFF"}
              />
              <Text style={styles.navLabel}>Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, activeTab === "records" && styles.navItemActive]}
              onPress={() => {
                navigateToTab("records");
                setSidebarOpen(false);
              }}
            >
              <Users size={20} color={activeTab === "records" ? "#A7F3D0" : "#FFFFFF"} />
              <Text style={styles.navLabel}>Records</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, activeTab === "appointments" && styles.navItemActive]}
              onPress={() => {
                navigateToTab("appointments");
                setSidebarOpen(false);
              }}
            >
              <Calendar size={20} color={activeTab === "appointments" ? "#A7F3D0" : "#FFFFFF"} />
              <Text style={styles.navLabel}>Appointments</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, activeTab === "appointment-requests" && styles.navItemActive]}
              onPress={() => {
                navigateToTab("appointment-requests");
                setSidebarOpen(false);
              }}
            >
              <Clock
                size={20}
                color={activeTab === "appointment-requests" ? "#A7F3D0" : "#FFFFFF"}
              />
              <Text style={styles.navLabel}>Requests</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ gap: 8, marginTop: 12 }}>
          <TouchableOpacity
            style={styles.sidebarTourBtn}
            onPress={() => {
              setSidebarOpen(false);
              setTimeout(() => handleRestartTour(), 300);
            }}
            activeOpacity={0.8}
          >
            <Compass size={18} color="#A7F3D0" style={{ marginRight: 8 }} />
            <Text style={styles.sidebarTourText}>App Guide</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sidebarLogoutBtn}
            onPress={() => {
              Alert.alert("Confirm Logout", "Are you sure you want to log out?", [
                { text: "Cancel", style: "cancel" },
                { text: "Logout", style: "destructive", onPress: onLogout },
              ]);
            }}
          >
            <LogOut size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.sidebarLogoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Walkthrough Tour */}
      <AppTour
        visible={tourVisible}
        steps={tourSteps}
        index={tourIndex}
        onIndexChange={setTourIndex}
        measureTarget={tour.measure}
        onFinish={handleFinishTour}
        onSkip={handleSkipTour}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────
// HELPER DETAIL ROW
// ─────────────────────────────────────────
function DetailRow({
  label,
  value,
  isHighlight,
}: {
  label: string;
  value: string;
  isHighlight?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailRowLabel}>{label}</Text>
      <Text
        style={[
          styles.detailRowValue,
          isHighlight && { color: "#047857", fontWeight: "800" },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────
const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topAppBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  topAppBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuIconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  appBarTitleGroup: {
    flex: 1,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  assistantBadgeMini: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 4,
  },
  assistantBadgeMiniText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#047857",
    letterSpacing: 0.5,
  },
  appBarSubTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  topAppBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  contentArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  /* Clinic Banner */
  clinicBanner: {
    backgroundColor: "#064E3B",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#047857",
    shadowColor: "#022C22",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    position: "relative",
    overflow: "hidden",
  },
  clinicBannerBevel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  clinicBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  clinicBannerIconBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  clinicBannerBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  clinicBannerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#A7F3D0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  clinicBannerBadgeText: {
    color: "#022C22",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  liveDutyBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  liveDutyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34D399",
  },
  liveDutyText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  clinicBannerDoctorName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  clinicBannerSubtitle: {
    fontSize: 12,
    color: "#D1FAE5",
    fontWeight: "500",
    marginTop: 1,
  },

  /* Quick Actions */
  taskHubContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  taskHubHeader: {
    marginBottom: 10,
  },
  taskHubTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.7,
  },
  taskHubSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  taskHubGrid: {
    gap: 8,
  },
  taskHubCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  taskHubIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  taskHubTextWrap: {
    flex: 1,
  },
  taskHubCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  taskHubCardDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  taskHubCountBadge: {
    backgroundColor: "#FDE68A",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  taskHubCountText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400E",
  },

  /* Stats Panel */
  firstPanel: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },

  /* Dashboard Columns */
  dashboardColumns: {
    flexDirection: "column",
    gap: 16,
  },
  column: {
    flex: 1,
  },

  /* Section Headers */
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.7,
  },
  pillCountBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  pillCountText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#334155",
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },

  /* Filter Pills */
  queueFilterRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  queueFilterPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  queueFilterPillActive: {
    backgroundColor: "#047857",
    borderColor: "#064E3B",
  },
  queueFilterPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  queueFilterPillTextActive: {
    color: "#FFFFFF",
  },

  /* Queue Card */
  emptyQueueBox: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  emptyQueueTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 4,
    textAlign: "center",
  },
  emptyQueueSubtitle: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
  },
  queueCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  queueCardSelected: {
    borderColor: "#10B981",
    borderWidth: 1.5,
    backgroundColor: "#F0FDF4",
  },
  queueAvatar: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginRight: 10,
  },
  queuePatientName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  activePrepDot: {
    backgroundColor: "#10B981",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activePrepDotText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  queueService: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  queueMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  queueMetaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  queueMetaText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  queueDoctorTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  queueDoctorTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0369A1",
  },
  queueStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  queueStatusText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  /* Empty Details */
  emptyPrepCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
  },
  emptyPrepIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#EDF2F7",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyPrepTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  emptyPrepDesc: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    maxWidth: 240,
  },

  /* Details Card */
  detailsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    position: "relative",
  },
  shadow: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  prepPatientHeader: {
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  prepAvatar: {
    width: 62,
    height: 62,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    marginBottom: 8,
  },
  prepPatientName: {
    fontSize: 17,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  prepContactRow: {
    marginTop: 4,
  },
  prepCallBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  prepCallBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
  },
  prepEmailText: {
    fontSize: 11,
    color: "#64748B",
  },
  pwdApprovedBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#ECFDF5",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  pwdApprovedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  pwdPendingBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#FFFBEB",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  pwdPendingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#B45309",
  },

  /* Health Alerts Box */
  medicalAlertBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 10,
    marginBottom: 12,
  },
  alertBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  alertBoxTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: "#92400E",
    letterSpacing: 0.6,
  },
  allergyWarningCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FECDD3",
    padding: 8,
    marginTop: 4,
  },
  allergyWarningLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#BE123C",
    letterSpacing: 0.5,
  },
  allergyWarningValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#9F1239",
    marginTop: 2,
  },
  safeIntakeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 2,
  },
  safeIntakeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
  },
  conditionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#78350F",
  },
  conditionValue: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400E",
    marginTop: 1,
  },
  emergencyContactRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#FEF3C7",
  },
  emergencyLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#78350F",
  },
  emergencyValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },

  /* Appointment Details Box */
  appointmentDetailsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
    marginBottom: 12,
  },
  detailsBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  detailsBoxTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.6,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3,
  },
  detailRowLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  detailRowValue: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "600",
    maxWidth: 160,
    textAlign: "right",
  },

  /* Action Buttons */
  actionButtonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  fullRecordBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: "#047857",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#064E3B",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  fullRecordBtnText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  updateStatusBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  updateStatusBtnText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#1E293B",
    letterSpacing: 0.4,
  },

  /* Quick status row */
  quickStatusRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  quickStatusBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  quickStatusBtnText: {
    fontSize: 10,
    fontWeight: "800",
  },

  /* Patient Card */
  patientCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  patientAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginRight: 10,
  },
  patientCardName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  patientCardSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  patientCreatedText: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 2,
  },

  /* Requests Section */
  requestsSection: {
    marginTop: 22,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  requestsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  requestsHeaderTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  requestsHeaderTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.7,
  },
  requestCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 10,
  },
  requestCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  requestAvatar: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginRight: 10,
  },
  requestPatientName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  requestService: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  requestTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  requestTimeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#047857",
  },
  requestPendingBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  requestPendingBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#92400E",
  },
  requestNotesBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  requestNotesText: {
    fontSize: 11,
    color: "#475569",
    fontStyle: "italic",
  },
  requestActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  requestAcceptBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#047857",
    paddingVertical: 8,
    borderRadius: 6,
  },
  requestAcceptBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  requestDeclineBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 8,
    borderRadius: 6,
  },
  requestDeclineBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },

  /* Quick Search Modal */
  quickSearchOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    padding: 20,
  },
  quickSearchBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  quickSearchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  quickSearchTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: 0.6,
  },
  quickSearchCloseBtn: {
    padding: 4,
  },
  quickSearchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginBottom: 12,
  },
  quickSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    paddingVertical: 4,
  },
  quickSearchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  /* Sidebar */
  backdropOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    zIndex: 998,
  },
  sidebarDrawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 280,
    backgroundColor: "#064E3B",
    zIndex: 999,
    paddingHorizontal: 16,
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  sidebarHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.15)",
    paddingBottom: 16,
  },
  sidebarBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sidebarBrandLogo: {
    width: 38,
    height: 38,
    borderRadius: 8,
  },
  sidebarBrandIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  sidebarSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#A7F3D0",
  },
  sidebarCloseButton: {
    padding: 6,
  },
  navItems: {
    flex: 1,
    marginTop: 20,
  },
  navItemsList: {
    gap: 6,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 12,
  },
  navItemActive: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  navLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sidebarTourBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  sidebarTourText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#A7F3D0",
  },
  sidebarLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    paddingVertical: 10,
    borderRadius: 8,
  },
  sidebarLogoutText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
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
  // Request controls: Search & Sort
  requestControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  requestSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
  },
  requestSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    paddingVertical: 0,
  },
  requestSortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
  },
  requestSortBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  requestsScrollList: {
    maxHeight: 390,
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
  // Request Card Styles with Accept/Decline
  requestCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  requestCardContainerSelected: {
    borderColor: '#047857',
    borderWidth: 1.5,
    backgroundColor: '#F0FDF4',
  },
  // Dedicated Decision Card in Details
  decisionSectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginTop: 12,
  },
  decisionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  decisionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  decisionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  decisionBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  decisionAcceptBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047857',
    paddingVertical: 10,
    borderRadius: 8,
    borderBottomWidth: 2.5,
    borderBottomColor: '#064E3B',
  },
  decisionAcceptText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  decisionDeclineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingVertical: 10,
    borderRadius: 8,
  },
  decisionDeclineText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#E11D48',
  },
  // Swipe Actions & Hint Styles
  swipeContainer: {
    position: 'relative',
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  swipeBackgroundFull: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    justifyContent: 'center',
  },
  swipeBackgroundAccept: {
    backgroundColor: '#059669',
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  swipeBackgroundDecline: {
    backgroundColor: '#DC2626',
    alignItems: 'flex-start',
    paddingLeft: 16,
  },
  swipeActionIndicatorRight: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  swipeActionIndicatorLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  swipeIconCircleAccept: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  swipeIconCircleDecline: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  swipeActionLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  swipeHintRow: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeHintText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
});
