import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  X,
  Calendar,
  Clock,
  User,
  Search,
  Check,
  Stethoscope,
  Sparkles,
  AlertCircle,
  Plus,
  ShieldCheck,
  ChevronDown,
  CheckCircle2,
  Mail,
  ChevronLeft,
  ChevronRight,
  Ban,
  AlertTriangle,
  CalendarDays,
} from "lucide-react-native";
import { supabase } from "@smileguard/supabase-client";
import { createDirectAppointment, getDoctorAppointmentsByDate } from "../../lib/appointmentService";
import { useClinic } from "../../contexts/ClinicContext";

interface AddAppointmentModalProps {
  visible: boolean;
  onClose: () => void;
  onAppointmentAdded?: () => void;
  initialDate?: string;
  defaultDoctorId?: string | null;
  clinicSchedule?: any;
  blockoutDates?: any[];
  existingAppointments?: any[];
}

const DEFAULT_SERVICES = [
  "General Consultation",
  "Oral Prophylaxis (Cleaning)",
  "Tooth Extraction",
  "Dental Filling (Pasta)",
  "Root Canal Treatment",
  "Orthodontic Consultation",
  "Teeth Whitening",
  "Dentures / Prosthetics",
];

// Standard fallback times (both hourly and 30-minute intervals)
const STANDARD_TIMES = [
  "08:00 AM",
  "08:30 AM",
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "01:00 PM",
  "01:30 PM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
  "03:30 PM",
  "04:00 PM",
  "04:30 PM",
  "05:00 PM",
];

// Service duration dictionary derived from website
const SERVICE_DURATIONS: Record<string, number> = {
  Cleaning: 30,
  Whitening: 60,
  Fillings: 60,
  Filling: 60,
  "Root Canal": 90,
  Extraction: 30,
  "Braces Consultation": 60,
  Braces: 60,
  "Implants Consultation": 60,
  Implants: 60,
  "X-Ray": 30,
  "Check-up": 30,
  Checkup: 30,
  Consultation: 30,
};

function getServiceDuration(name?: string | null): number {
  if (!name) return 30;
  const norm = name.trim().toLowerCase();
  for (const [k, d] of Object.entries(SERVICE_DURATIONS)) {
    if (norm === k.toLowerCase() || norm.includes(k.toLowerCase()) || k.toLowerCase().includes(norm)) {
      return d;
    }
  }
  return 30; // default 30 minutes
}

function formatDuration(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return "30 mins";
  if (minutes < 60) return `${minutes} mins`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  return `${hrs} hr${hrs > 1 ? "s" : ""} ${rem} mins`;
}

function formatMinutes(totalMins: number): string {
  const h24 = Math.floor(totalMins / 60) % 24;
  const min = totalMins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(min).padStart(2, "0")} ${period}`;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function formatDateLong(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr || "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!m || m < 1 || m > 12 || !d) return dateStr;
  return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

function getTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMaxDate(): { date: Date; dateStr: string } {
  const max = new Date();
  max.setMonth(max.getMonth() + 6);
  const y = max.getFullYear();
  const m = String(max.getMonth() + 1).padStart(2, "0");
  const d = String(max.getDate()).padStart(2, "0");
  return { date: max, dateStr: `${y}-${m}-${d}` };
}

function getDayName(dateStr: string): typeof DAY_KEYS[number] {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dayIdx = new Date(y, m - 1, d).getDay();
  return DAY_KEYS[dayIdx];
}

function parse12HourTime(timeStr: string): { hour: number; minute: number } {
  if (!timeStr) return { hour: 9, minute: 0 };
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return { hour: 9, minute: 0 };
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && hour < 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return { hour, minute };
}

function format12HourTime(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = String(minute).padStart(2, "0");
  return `${String(displayHour).padStart(2, "0")}:${displayMinute} ${period}`;
}

function toMinutes(t: string): number {
  if (!t) return NaN;
  const cleaned = t.trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return NaN;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + m;
}

function getEndTimeLabel(timeStr: string, serviceName: string): string {
  const startMin = toMinutes(timeStr);
  if (isNaN(startMin)) return "";
  const duration = getServiceDuration(serviceName);
  return formatMinutes(startMin + duration);
}

function normalizeTimeString(t: string): string {
  if (!t) return "";
  const cleaned = t.trim().toUpperCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return cleaned;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = match[3];
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
}

export default function AddAppointmentModal({
  visible,
  onClose,
  onAppointmentAdded,
  initialDate,
  defaultDoctorId,
  clinicSchedule: propClinicSchedule,
  blockoutDates: propBlockoutDates,
}: AddAppointmentModalProps) {
  const insets = useSafeAreaInsets();
  const statusBarHeight = insets.top || (Platform.OS === "android" ? StatusBar.currentHeight || 0 : 0);

  // Clinic Context
  const { clinic, refetch: refetchClinic } = useClinic();
  const clinicSchedule = propClinicSchedule || clinic?.schedule;

  // Clinic hours may not have been readable when the app first started
  useEffect(() => {
    if (visible && !clinicSchedule) {
      refetchClinic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Form Fields
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    email?: string;
    contact?: string;
    dummy?: boolean;
    avatar_url?: string;
  } | null>(null);

  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(defaultDoctorId || null);
  const [service, setService] = useState<string>("");
  const [appointmentDate, setAppointmentDate] = useState(() => {
    const today = getTodayStr();
    if (initialDate && initialDate >= today) {
      return initialDate;
    }
    return today;
  });
  const [appointmentTime, setAppointmentTime] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Blockout Dates state
  const [blockoutDates, setBlockoutDates] = useState<any[]>(propBlockoutDates || []);

  // Patients Picker State (ALL PATIENTS: Registered & Walk-in Records)
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [patientPage, setPatientPage] = useState(1);
  const PATIENTS_PER_PAGE = 5;

  // Doctors list
  const [doctorsList, setDoctorsList] = useState<any[]>([]);

  // Appointments on selected date
  const [dayAppointments, setDayAppointments] = useState<any[]>([]);

  const [loadingDayAppointments, setLoadingDayAppointments] = useState(false);

  // Date Picker Modal state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerCalendarMonth, setPickerCalendarMonth] = useState<Date>(() => {
    const today = getTodayStr();
    const valid = initialDate && initialDate >= today ? initialDate : today;
    const [y, m] = valid.split("-").map(Number);
    return new Date(y, m - 1, 1);
  });
  const [monthAppointments, setMonthAppointments] = useState<any[]>([]);

  // Submission State
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successCreatedAppointment, setSuccessCreatedAppointment] = useState<{
    patientName: string;
    patientEmail?: string;
    date: string;
    time: string;
    service: string;
    doctorName?: string;
  } | null>(null);

  // Connect Dental Services from Clinic Setup
  const availableServices = useMemo(() => {
    if (!clinic?.services) return DEFAULT_SERVICES;
    let list: any[] = [];
    if (Array.isArray(clinic.services)) {
      list = clinic.services;
    } else if (typeof clinic.services === "string") {
      try {
        list = JSON.parse(clinic.services);
      } catch {
        list = [];
      }
    }
    const names = list
      .map((s: any) => {
        if (typeof s === "string") return s.trim();
        return (s.name || s.service_name || s.title || "").trim();
      })
      .filter(Boolean);
    return names.length > 0 ? names : DEFAULT_SERVICES;
  }, [clinic?.services]);

  // Set default service once available services load
  useEffect(() => {
    if (!service && availableServices.length > 0) {
      setService(availableServices[0]);
    }
  }, [availableServices, service]);

  // Reset initial date whenever prop updates (ensuring not in the past)
  useEffect(() => {
    if (initialDate) {
      const today = getTodayStr();
      const valid = initialDate >= today ? initialDate : today;
      setAppointmentDate(valid);
      setAppointmentTime("");
      if (/^\d{4}-\d{2}-\d{2}$/.test(valid)) {
        const [y, m] = valid.split("-").map(Number);
        setPickerCalendarMonth(new Date(y, m - 1, 1));
      }
    }
  }, [initialDate]);

  // Fetch blockout dates from clinic_blockout_dates
  const fetchBlockoutDates = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("clinic_blockout_dates").select("*");
      if (!error && data) {
        setBlockoutDates(data);
      }
    } catch (err) {
      console.error("[AddAppointmentModal] Error fetching blockouts:", err);
    }
  }, []);

  // Fetch ALL Patients: Registered Patients (profiles) + Walk-in Records (dummy_patients)
  const fetchAllPatientsList = useCallback(async () => {
    setLoadingPatients(true);
    try {
      // 1. Fetch registered patients from profiles table
      const { data: profilePatients, error: profError } = await supabase
        .from("profiles")
        .select("id, name, email, role, created_at, avatar_url")
        .eq("role", "patient")
        .order("name", { ascending: true });

      if (profError) {
        console.warn("[AddAppointmentModal] Error fetching profile patients:", profError);
      }

      // 2. Fetch medical intake for additional contact details
      const { data: medicalData } = await supabase
        .from("medical_intake")
        .select("patient_id, phone, allergies, gender");

      const medicalMap = (medicalData || []).reduce((acc: any, m: any) => {
        if (m.patient_id) {
          acc[m.patient_id] = m;
        }
        return acc;
      }, {});

      // 3. Fetch walk-in / dummy patients
      let walkIns: any[] = [];
      try {
        const { data: dummyData } = await supabase
          .from("dummy_patients")
          .select("*")
          .order("name", { ascending: true });
        if (dummyData) {
          walkIns = dummyData;
        }
      } catch {
        // Fallback if table unavailable
      }

      const registeredList = (profilePatients || []).map((p: any) => {
        const med = medicalMap[p.id] || {};
        return {
          id: p.id,
          name: p.name || "Patient",
          email: p.email || "",
          contact: med.phone || "",
          allergies: med.allergies || "None",
          dummy: false,
          avatar_url: p.avatar_url,
          created_at: p.created_at,
        };
      });

      const walkInList = (walkIns || []).map((w: any) => ({
        id: w.id,
        name: w.name || "Walk-in Patient",
        email: w.email || "",
        contact: w.phone || "",
        allergies: w.allergies || "None",
        dummy: true,
        created_at: w.created_at,
      }));

      const combined = [...registeredList, ...walkInList].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "")
      );

      setPatientsList(combined);
      return combined;
    } catch (err) {
      console.error("[AddAppointmentModal] Error fetching patients:", err);
      return [];
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  // Fetch Doctors
  const fetchDoctors = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("doctors")
        .select("id, user_id, first_name, last_name")
        .limit(20);
      setDoctorsList(data || []);
      // dentist_id must be a doctor's account id. The assistant's own id (passed in as the
      // default) is not a dentist, so fall back to the clinic's doctor.
      const doctorUserIds = (data || []).map((d: any) => d.user_id).filter(Boolean);
      setSelectedDoctorId((prev) => (prev && doctorUserIds.includes(prev) ? prev : doctorUserIds[0] || null));
    } catch (err) {
      console.error("[AddAppointmentModal] Error fetching doctors:", err);
    }
  }, []);

  // Fetch Appointments on appointmentDate
  // Every booking on the date blocks time, whichever dentist it is assigned to
  // (including unassigned patient requests) — same rule as the patient website.
  const loadAppointmentsForDate = useCallback(async (targetDate: string): Promise<any[] | null> => {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("appointment_date", targetDate);
    if (!error && data) return data;

    try {
      return await getDoctorAppointmentsByDate(null, targetDate);
    } catch {
      return null;
    }
  }, []);

  const fetchDayAppointments = useCallback(async (targetDate: string) => {
    if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return;
    setLoadingDayAppointments(true);
    try {
      const rows = await loadAppointmentsForDate(targetDate);
      if (rows) setDayAppointments(rows);
    } catch (err) {
      console.error("[AddAppointmentModal] Error fetching day appointments:", err);
    } finally {
      setLoadingDayAppointments(false);
    }
  }, [loadAppointmentsForDate]);

  // Fetch Month Appointments for the Calendar Date Picker
  const fetchMonthAppointments = useCallback(async (calendarMonth: Date) => {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth() + 1;
    const startStr = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endStr = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    try {
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .gte("appointment_date", startStr)
        .lte("appointment_date", endStr);

      if (data) {
        setMonthAppointments(data);
      }
    } catch (err) {
      console.error("[AddAppointmentModal] Error fetching month appointments:", err);
    }
  }, []);

  // On modal open
  useEffect(() => {
    if (visible) {
      fetchAllPatientsList();
      fetchDoctors();
      fetchBlockoutDates();
      fetchDayAppointments(appointmentDate);
      fetchMonthAppointments(pickerCalendarMonth);
    }
  }, [
    visible,
    fetchAllPatientsList,
    fetchDoctors,
    fetchBlockoutDates,
    fetchDayAppointments,
    fetchMonthAppointments,
    appointmentDate,
    pickerCalendarMonth,
  ]);

  // Refresh day appointments when appointmentDate changes
  useEffect(() => {
    if (visible && appointmentDate) {
      fetchDayAppointments(appointmentDate);
    }
  }, [visible, appointmentDate, fetchDayAppointments]);

  // Re-fetch month appointments when picker calendar month changes
  useEffect(() => {
    if (visible && showDatePicker) {
      fetchMonthAppointments(pickerCalendarMonth);
    }
  }, [visible, showDatePicker, pickerCalendarMonth, fetchMonthAppointments]);

  // Compute Time Slots in 30-minute intervals (hourly and 30-minute interval from website)
  const availableTimeSlots = useMemo(() => {
    if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      return STANDARD_TIMES;
    }
    const dayName = getDayName(appointmentDate);
    const sched = clinicSchedule?.[dayName];

    if (!sched || sched.isOpen === false) {
      return [];
    }

    const openTime = parse12HourTime(sched.opening_time || "08:00 AM");
    const closeTime = parse12HourTime(sched.closing_time || "05:00 PM");

    const slots: string[] = [];
    const openMin = openTime.hour * 60 + openTime.minute;
    const closeMin = closeTime.hour * 60 + closeTime.minute;

    // Generate slots in 30-minute intervals down to closing time
    for (let t = openMin; t + 30 <= closeMin; t += 30) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      slots.push(format12HourTime(h, m));
    }

    if (slots.length === 0) {
      return STANDARD_TIMES;
    }
    return slots;
  }, [appointmentDate, clinicSchedule]);

  // Service duration in minutes (e.g. 30, 60, 90 mins)
  const currentDuration = useMemo(() => {
    return getServiceDuration(service);
  }, [service]);

  // ─────────────────────────────────────────
  // VALIDATION & CLINIC CONNECTIVITY RULES
  // ─────────────────────────────────────────

  // 1. Check if date is blocked in clinic_blockout_dates
  const blockoutEntry = useMemo(() => {
    return blockoutDates.find(
      (b) => b.blockout_date === appointmentDate && b.is_blocked
    );
  }, [blockoutDates, appointmentDate]);

  const isDateBlockedOut = !!blockoutEntry;
  const blockoutReason = blockoutEntry?.reason || "Clinic blockout date";

  // 2. Check if day of week is closed in weekly clinic schedule
  const isDayClosed = useMemo(() => {
    if (!appointmentDate || !clinicSchedule) return false;
    const dayName = getDayName(appointmentDate);
    const daySched = clinicSchedule[dayName];
    return daySched ? daySched.isOpen === false : false;
  }, [appointmentDate, clinicSchedule]);

  // 3. ONLY 3 SCHEDULED should be counted to blockout that date (FULL)
  const scheduledCountOnDate = useMemo(() => {
    return (dayAppointments || []).filter((a) => {
      const apptDate = (a.appointment_date || a.date || "").split("T")[0].split(" ")[0];
      if (apptDate && appointmentDate && apptDate !== appointmentDate) {
        return false;
      }
      return (a.status || "").toLowerCase().trim() === "scheduled";
    }).length;
  }, [dayAppointments, appointmentDate]);

  const isDateFull = scheduledCountOnDate >= 3;

  const isCancelledOrDeclined = (status: string | null | undefined): boolean => {
    if (!status) return false;
    const s = String(status).toLowerCase().trim();
    return (
      s === "cancelled" ||
      s === "canceled" ||
      s === "declined" ||
      s.includes("cancel") ||
      s.includes("decline") ||
      s.includes("reject") ||
      s === "no-show" ||
      s === "noshow" ||
      s === "void"
    );
  };

  // 4. Block out if patient is already scheduled on this date
  const patientExistingAppointment = useMemo(() => {
    if (!selectedPatient || !dayAppointments || dayAppointments.length === 0) return null;
    return dayAppointments.find((a) => {
      const apptDate = (a.appointment_date || a.date || "").split("T")[0].split(" ")[0];
      if (apptDate && appointmentDate && apptDate !== appointmentDate) {
        return false;
      }
      const matchId =
        (selectedPatient.dummy && (a.dummy_patient_id === selectedPatient.id || a.dummy_account_id === selectedPatient.id)) ||
        a.patient_id === selectedPatient.id;
      const isActive = !isCancelledOrDeclined(a.status);
      return matchId && isActive;
    });
  }, [selectedPatient, dayAppointments, appointmentDate]);

  const isPatientScheduledOnDate = !!patientExistingAppointment;

  // 5. Booked Time Intervals & Duration-Aware Collision Check (derived from website)
  const busyIntervals = useMemo(() => {
    const intervals: Array<{ start: number; end: number; timeStr: string }> = [];
    (dayAppointments || []).forEach((a) => {
      const apptDate = (a.appointment_date || a.date || "").split("T")[0].split(" ")[0];
      if (apptDate && appointmentDate && apptDate !== appointmentDate) {
        return;
      }
      if (isCancelledOrDeclined(a.status)) {
        return;
      }
      const status = String(a.status || "").toLowerCase().trim();
      if (status && status !== "scheduled" && status !== "pending" && status !== "confirmed" && status !== "completed") {
        return;
      }
      const rawTime = a.appointment_time || a.time;
      if (!rawTime) return;
      const startMin = toMinutes(rawTime);
      if (isNaN(startMin)) return;
      const duration = a.duration || getServiceDuration(a.service);
      intervals.push({ start: startMin, end: startMin + duration, timeStr: rawTime });
    });
    return intervals;
  }, [dayAppointments, appointmentDate]);

  // Closing time in minutes from clinicSchedule
  const closingMinutes = useMemo(() => {
    if (!appointmentDate || !clinicSchedule) return NaN;
    const dayName = getDayName(appointmentDate);
    const sched = clinicSchedule[dayName];
    if (!sched || sched.isOpen === false || !sched.closing_time) return NaN;
    const closing = parse12HourTime(sched.closing_time);
    return closing.hour * 60 + closing.minute;
  }, [appointmentDate, clinicSchedule]);

  // 1. Is a specific 30-min slot occupied by an existing booking?
  const isSlotOccupied = useCallback(
    (slotStr: string) => {
      const slotMin = toMinutes(slotStr);
      if (isNaN(slotMin)) return false;
      for (const b of busyIntervals) {
        if (slotMin >= b.start && slotMin < b.end) {
          return true;
        }
      }
      return false;
    },
    [busyIntervals]
  );

  // 2. Does scheduling current service starting at slotStr fit before closing and overlap NO booking?
  const doesSlotFitService = useCallback(
    (slotStr: string) => {
      const slotMin = toMinutes(slotStr);
      if (isNaN(slotMin)) return false;
      const endMin = slotMin + currentDuration;

      // Same-day bookings cannot start at a time that has already passed
      if (appointmentDate === getTodayStr()) {
        const now = new Date();
        if (slotMin <= now.getHours() * 60 + now.getMinutes()) {
          return false;
        }
      }

      // Cannot start inside an existing booking
      for (const b of busyIntervals) {
        if (slotMin >= b.start && slotMin < b.end) {
          return false;
        }
      }

      // Cannot overlap an existing booking
      for (const b of busyIntervals) {
        if (slotMin < b.end && endMin > b.start) {
          return false;
        }
      }

      // Cannot exceed clinic closing time
      if (Number.isFinite(closingMinutes) && endMin > closingMinutes) {
        return false;
      }

      return true;
    },
    [busyIntervals, currentDuration, closingMinutes, appointmentDate]
  );

  // 3. Is slot covered by the currently selected appointment start time & estimated duration?
  const isSlotCovered = useCallback(
    (slotStr: string) => {
      if (!appointmentTime) return false;
      const slotMin = toMinutes(slotStr);
      const startMin = toMinutes(appointmentTime);
      if (isNaN(slotMin) || isNaN(startMin)) return false;
      return slotMin > startMin && slotMin < startMin + currentDuration;
    },
    [appointmentTime, currentDuration]
  );

  const isTimeSlotBooked = useCallback(
    (slotStr: string) => {
      return isSlotOccupied(slotStr) || !doesSlotFitService(slotStr);
    },
    [isSlotOccupied, doesSlotFitService]
  );

  const isSelectedTimeBooked = useMemo(() => {
    if (!appointmentTime) return false;
    return isSlotOccupied(appointmentTime) || !doesSlotFitService(appointmentTime);
  }, [appointmentTime, isSlotOccupied, doesSlotFitService]);

  // When availableTimeSlots change or service duration changes, clear appointmentTime if it no longer fits
  useEffect(() => {
    if (appointmentTime) {
      if (!availableTimeSlots.includes(appointmentTime) || !doesSlotFitService(appointmentTime)) {
        setAppointmentTime("");
      }
    }
  }, [availableTimeSlots, doesSlotFitService, appointmentTime]);

  // Patient records pagination state & filtering
  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patientsList;
    const q = patientSearch.toLowerCase().trim();
    return patientsList.filter((p) => {
      const nameMatch = p.name?.toLowerCase().includes(q);
      const emailMatch = p.email?.toLowerCase().includes(q);
      const phoneMatch = (p.contact || p.phone)?.includes(q);
      return nameMatch || emailMatch || phoneMatch;
    });
  }, [patientsList, patientSearch]);

  const totalPatientPages = Math.max(1, Math.ceil(filteredPatients.length / PATIENTS_PER_PAGE));
  const paginatedPatients = useMemo(() => {
    const start = (patientPage - 1) * PATIENTS_PER_PAGE;
    return filteredPatients.slice(start, start + PATIENTS_PER_PAGE);
  }, [filteredPatients, patientPage]);

  // Keep patientPage within bounds
  useEffect(() => {
    if (patientPage > totalPatientPages) {
      setPatientPage(totalPatientPages);
    }
  }, [totalPatientPages, patientPage]);

  // 6. Master Validation Rule: Is OK to Schedule Appointment
  const isOkToSchedule = useMemo(() => {
    if (!selectedPatient) return false;
    const finalService = service.trim();
    if (!finalService) return false;
    if (!appointmentDate || !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) return false;
    const today = getTodayStr();
    const max = getMaxDate().dateStr;
    if (appointmentDate < today || appointmentDate > max) return false; // No past dates & max 6 months ahead
    if (isDateBlockedOut) return false;
    if (isDayClosed) return false;
    if (isDateFull) return false; // 3 scheduled count reached!
    if (isPatientScheduledOnDate) return false; // Patient scheduled on date
    if (!appointmentTime) return false;
    if (isSelectedTimeBooked) return false; // Time slot taken
    return true;
  }, [
    selectedPatient,
    service,
    appointmentDate,
    isDateBlockedOut,
    isDayClosed,
    isDateFull,
    isPatientScheduledOnDate,
    appointmentTime,
    isSelectedTimeBooked,
  ]);
  const resetForm = () => {
    setSelectedPatient(null);
    setService(availableServices[0] || DEFAULT_SERVICES[0]);
    setAppointmentDate(initialDate && initialDate >= getTodayStr() ? initialDate : getTodayStr());
    setAppointmentTime("");
    setNotes("");
    setErrorMessage(null);
    setShowPatientPicker(false);
    setShowDatePicker(false);
    setPatientSearch("");
    setPatientPage(1);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedPatient) {
      setErrorMessage("Please select a patient for this appointment.");
      return;
    }
    const finalDate = appointmentDate.trim();
    if (!finalDate || !/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
      setErrorMessage("Please choose a valid appointment date.");
      return;
    }
    const today = getTodayStr();
    const max = getMaxDate().dateStr;
    if (finalDate < today) {
      setErrorMessage("Cannot schedule: You cannot book an appointment for previous days.");
      return;
    }
    if (finalDate > max) {
      setErrorMessage("Cannot schedule: Appointments can only be booked up to 6 months in advance.");
      return;
    }
    if (isDateBlockedOut) {
      setErrorMessage(`Cannot schedule: This date is blocked out (${blockoutReason}).`);
      return;
    }
    if (isDayClosed) {
      setErrorMessage("Cannot schedule: The clinic is closed on this day.");
      return;
    }
    if (isDateFull) {
      setErrorMessage("Cannot schedule: This date is FULL (maximum 3 appointments scheduled).");
      return;
    }
    if (isPatientScheduledOnDate) {
      setErrorMessage(
        `Cannot schedule: ${selectedPatient.name} is already scheduled on this date at ${patientExistingAppointment?.appointment_time}.`
      );
      return;
    }
    if (!appointmentTime || isSelectedTimeBooked) {
      setErrorMessage("Please choose an available time slot that is not already booked.");
      return;
    }

    const finalService = service.trim();
    if (!finalService) {
      setErrorMessage("Please select a dental service.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // Re-check against the database right before saving, in case a patient or another
      // staff member booked the same time while this form was open
      const fresh = await loadAppointmentsForDate(finalDate);
      if (fresh) {
        setDayAppointments(fresh);
        const startMin = toMinutes(appointmentTime);
        const endMin = startMin + currentDuration;
        const clash = fresh.some((a: any) => {
          if (isCancelledOrDeclined(a.status)) return false;
          const s = toMinutes(a.appointment_time || a.time || "");
          if (isNaN(s)) return false;
          return startMin < s + getServiceDuration(a.service) && s < endMin;
        });
        if (clash) {
          setAppointmentTime("");
          setErrorMessage("That time was just booked by someone else. Please pick another time.");
          return;
        }
      }

      const result = await createDirectAppointment({
        patient_id: selectedPatient.id,
        is_dummy: !!selectedPatient.dummy,
        dentist_id: selectedDoctorId || null,
        service: finalService,
        appointment_date: finalDate,
        appointment_time: appointmentTime,
        status: "scheduled",
        notes: notes.trim() || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to schedule appointment.");
      }

      const assignedDoc = doctorsList.find(
        (d: any) => d.id === selectedDoctorId || d.user_id === selectedDoctorId
      );
      const doctorDisplayName = assignedDoc
        ? `Dr. ${assignedDoc.first_name || ""} ${assignedDoc.last_name || ""}`.trim()
        : undefined;

      setSuccessCreatedAppointment({
        patientName: selectedPatient.name,
        patientEmail: selectedPatient.email,
        date: formatDateLong(finalDate),
        time: appointmentTime,
        service: finalService,
        doctorName: doctorDisplayName || "Assigned Clinic Dentist",
      });
    } catch (err: any) {
      console.error("[AddAppointmentModal] Submission error:", err);
      setErrorMessage(err.message || "Failed to schedule appointment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView
        style={[styles.container, { paddingTop: Platform.OS === "android" ? statusBarHeight : 0 }]}
        edges={["bottom", "left", "right"]}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" animated />

        {/* Modal Header */}
        <View style={styles.header}>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.title}>NEW APPOINTMENT</Text>
              <View style={styles.assistantBadge}>
                <Stethoscope size={11} color="#047857" />
                <Text style={styles.assistantBadgeText}>CLINIC BOOKING</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>Directly schedule appointments for patients</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClose}
            disabled={loading}
            accessibilityLabel="Close modal"
          >
            <X size={18} color="#475569" />
          </TouchableOpacity>
        </View>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <AlertCircle size={15} color="#DC2626" style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ───────────────────────────────────────── */}
            {/* 1. PATIENT SELECTION                      */}
            {/* ───────────────────────────────────────── */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.labelGroup}>
                  <User size={15} color="#047857" />
                  <Text style={styles.label}>
                    Patient <Text style={styles.required}>*</Text>
                  </Text>
                </View>
                {/* Notice: "+ New dummy" button removed per requirement */}
              </View>

              <TouchableOpacity
                style={[styles.patientPickerTrigger, !selectedPatient && styles.patientPickerTriggerEmpty]}
                onPress={() => setShowPatientPicker(true)}
                activeOpacity={0.7}
              >
                {selectedPatient ? (
                  <View style={styles.selectedPatientBox}>
                    <View style={styles.patientAvatarBox}>
                      <Text style={styles.patientAvatarText}>
                        {selectedPatient.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.selectedPatientName} numberOfLines={1}>
                          {selectedPatient.name}
                        </Text>
                        <View style={selectedPatient.dummy ? styles.walkInBadge : styles.patientBadge}>
                          <Text style={selectedPatient.dummy ? styles.walkInBadgeText : styles.patientBadgeText}>
                            {selectedPatient.dummy ? "WALK-IN" : "PATIENT"}
                          </Text>
                        </View>
                      </View>

                      {/* Display Email Prominently */}
                      <View style={styles.patientEmailRow}>
                        <Mail size={12} color="#047857" style={{ marginRight: 4 }} />
                        <Text style={styles.selectedPatientEmail} numberOfLines={1}>
                          {selectedPatient.email || "No email registered"}
                        </Text>
                      </View>

                      {selectedPatient.contact ? (
                        <Text style={styles.selectedPatientContact}>
                          Phone: {selectedPatient.contact}
                        </Text>
                      ) : null}
                    </View>
                    <ChevronDown size={18} color="#047857" />
                  </View>
                ) : (
                  <View style={styles.emptyPatientRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <User size={16} color="#047857" />
                      <Text style={styles.emptyPatientText}>Choose existing patient</Text>
                    </View>
                    <ChevronDown size={18} color="#94A3B8" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* ───────────────────────────────────────── */}
            {/* 2. DENTAL SERVICES (FROM CLINIC SETUP)    */}
            {/* ───────────────────────────────────────── */}
            <View style={[styles.card, { marginTop: 14 }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.labelGroup}>
                  <Sparkles size={15} color="#047857" />
                  <Text style={styles.label}>
                    Dental Service <Text style={styles.required}>*</Text>
                  </Text>
                </View>
                <View style={styles.clinicSourceBadge}>
                  <ShieldCheck size={11} color="#047857" />
                  <Text style={styles.clinicSourceBadgeText}>CLINIC SETUP</Text>
                </View>
              </View>

              <View style={styles.servicesGrid}>
                {availableServices.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.servicePill, service === s && styles.servicePillActive]}
                    onPress={() => setService(s)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.servicePillText, service === s && styles.servicePillTextActive]}
                      numberOfLines={2}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ───────────────────────────────────────── */}
            {/* 3. SCHEDULE DATE & TIME (CONNECT CLINIC)  */}
            {/* ───────────────────────────────────────── */}
            <View style={[styles.card, { marginTop: 14 }]}>
              {/* Date Header & Trigger */}
              <View style={styles.cardHeaderRow}>
                <View style={styles.labelGroup}>
                  <Calendar size={15} color="#047857" />
                  <Text style={styles.label}>
                    Appointment Date <Text style={styles.required}>*</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={styles.changeDateBtn}
                  activeOpacity={0.7}
                >
                  <Text style={styles.changeDateBtnText}>Change Date</Text>
                </TouchableOpacity>
              </View>

              {/* Formatted Date Hero Display: e.g. November 19, 2003 */}
              <TouchableOpacity
                style={[
                  styles.dateHeroCard,
                  (isDateFull || isDateBlockedOut || isDayClosed || isPatientScheduledOnDate) &&
                    styles.dateHeroCardWarning,
                ]}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.dateHeroLabel}>SELECTED DATE</Text>
                  <Text style={styles.dateHeroValue}>
                    {formatDateLong(appointmentDate) || "No date selected"}
                  </Text>
                  <Text style={styles.dateHeroWeekday}>
                    {appointmentDate ? getDayName(appointmentDate).toUpperCase() : ""}
                  </Text>
                </View>

                {/* Status Badge */}
                {isDateBlockedOut ? (
                  <View style={styles.badgeBlocked}>
                    <Ban size={12} color="#DC2626" />
                    <Text style={styles.badgeBlockedText}>BLOCKED</Text>
                  </View>
                ) : isDayClosed ? (
                  <View style={styles.badgeClosed}>
                    <Text style={styles.badgeClosedText}>CLOSED</Text>
                  </View>
                ) : isDateFull ? (
                  <View style={styles.badgeFull}>
                    <Ban size={12} color="#DC2626" />
                    <Text style={styles.badgeFullText}>FULL (3/3)</Text>
                  </View>
                ) : isPatientScheduledOnDate ? (
                  <View style={styles.badgeConflict}>
                    <AlertTriangle size={12} color="#D97706" />
                    <Text style={styles.badgeConflictText}>PATIENT SCHEDULED</Text>
                  </View>
                ) : (
                  <View style={styles.badgeAvailable}>
                    <Check size={12} color="#047857" />
                    <Text style={styles.badgeAvailableText}>
                      {scheduledCountOnDate}/3 Scheduled
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Conflict / Blockout Alerts */}
              {isDateBlockedOut && (
                <View style={styles.dateWarningBox}>
                  <AlertCircle size={14} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.dateWarningText}>
                    Date is blocked out in clinic setup: {blockoutReason}
                  </Text>
                </View>
              )}

              {isDayClosed && (
                <View style={styles.dateWarningBox}>
                  <AlertCircle size={14} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.dateWarningText}>
                    The clinic is closed on {getDayName(appointmentDate)}s according to clinic setup.
                  </Text>
                </View>
              )}

              {isDateFull && (
                <View style={styles.dateWarningBox}>
                  <AlertCircle size={14} color="#DC2626" style={{ marginRight: 6 }} />
                  <Text style={styles.dateWarningText}>
                    This date has reached maximum capacity (3/3 scheduled). Date is FULL.
                  </Text>
                </View>
              )}

              {isPatientScheduledOnDate && (
                <View style={[styles.dateWarningBox, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                  <AlertTriangle size={14} color="#D97706" style={{ marginRight: 6 }} />
                  <Text style={[styles.dateWarningText, { color: "#B45309" }]}>
                    {selectedPatient?.name} is already scheduled on this date (at {patientExistingAppointment?.appointment_time}).
                  </Text>
                </View>
              )}

              {/* Time Slots (Operating Hours & 30-Minute/Hourly Intervals) */}
              <View style={[styles.cardHeaderRow, { marginTop: 16 }]}>
                <View style={styles.labelGroup}>
                  <Clock size={15} color="#047857" />
                  <Text style={styles.label}>
                    Time Slot <Text style={styles.required}>*</Text>
                  </Text>
                </View>
                <Text style={styles.timeSlotsHeaderHint}>
                  {clinicSchedule?.[getDayName(appointmentDate)]
                    ? `${clinicSchedule[getDayName(appointmentDate)].opening_time} - ${clinicSchedule[getDayName(appointmentDate)].closing_time}`
                    : "Clinic Hours"}
                </Text>
              </View>

              {/* Selected Time & Duration Summary Banner */}
              {appointmentTime && service ? (
                <View style={styles.selectedTimeSummaryBanner}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 8 }}>
                      <Clock size={14} color="#047857" style={{ marginRight: 6 }} />
                      <Text style={styles.selectedTimeSummaryText}>
                        Selected: {appointmentTime} – {getEndTimeLabel(appointmentTime, service)}
                      </Text>
                    </View>
                    <View style={styles.serviceDurationBadge}>
                      <Text style={styles.serviceDurationBadgeText}>{formatDuration(currentDuration)}</Text>
                    </View>
                  </View>
                  {currentDuration > 30 ? (
                    <Text style={styles.selectedTimeSlotsSubtext}>
                      Estimated visit covers {Math.ceil(currentDuration / 30)} consecutive 30-minute slots starting at {appointmentTime}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {!isDayClosed && availableTimeSlots.length > 0 && !appointmentTime && (
                <Text style={styles.timeSelectHintText}>
                  Tap an available start time (30-min intervals • {formatDuration(currentDuration)} needed):
                </Text>
              )}

              {isDayClosed ? (
                <View style={styles.noSlotsBox}>
                  <Text style={styles.noSlotsText}>Clinic is closed on this day.</Text>
                </View>
              ) : availableTimeSlots.length === 0 ? (
                <View style={styles.noSlotsBox}>
                  <Text style={styles.noSlotsText}>
                    {clinicSchedule
                      ? "No time slots available for this day."
                      : "Couldn't load the clinic hours. Check your connection and reopen this screen. If it keeps happening, ask your dentist to confirm the hours are saved in Settings > Clinic Setup."}
                  </Text>
                </View>
              ) : (
                <View style={styles.pillGroup}>
                  {availableTimeSlots.map((t) => {
                    const isSelected = appointmentTime === t;
                    const covered = isSlotCovered(t);
                    const occupied = isSlotOccupied(t);
                    const fits = doesSlotFitService(t);
                    const disabled = occupied || (!fits && !covered);
                    const isPatientSlot =
                      isPatientScheduledOnDate &&
                      normalizeTimeString(patientExistingAppointment?.appointment_time || patientExistingAppointment?.time) ===
                        normalizeTimeString(t);

                    return (
                      <TouchableOpacity
                        key={t}
                        style={[
                          styles.timePill,
                          isSelected && styles.timePillActive,
                          covered && styles.timePillCovered,
                          occupied && !isSelected && styles.timePillBooked,
                          !occupied && !fits && !covered && styles.timePillDisabled,
                        ]}
                        onPress={() => {
                          if (!occupied && fits) {
                            setAppointmentTime(t);
                          }
                        }}
                        disabled={disabled}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.timePillText,
                            isSelected && styles.timePillTextActive,
                            covered && styles.timePillTextCovered,
                            occupied && styles.timePillTextBooked,
                            !occupied && !fits && !covered && styles.timePillTextDisabled,
                          ]}
                        >
                          {t}
                        </Text>
                        {isSelected ? (
                          <Text style={styles.timePillActiveTag}>Start</Text>
                        ) : covered ? (
                          <Text style={styles.timePillCoveredTag}>Covered</Text>
                        ) : occupied ? (
                          <Text style={styles.timePillBookedTag}>
                            {isPatientSlot ? "Patient" : "Booked"}
                          </Text>
                        ) : !fits ? (
                          <Text style={styles.timePillDisabledTag}>Unavailable</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* ───────────────────────────────────────── */}
            {/* 4. DOCTOR / DENTIST SELECTION (Optional)  */}
            {/* ───────────────────────────────────────── */}
            {doctorsList.length > 0 && (
              <View style={[styles.card, { marginTop: 14 }]}>
                <View style={styles.labelGroup}>
                  <Stethoscope size={15} color="#047857" />
                  <Text style={styles.label}>Assigned Dentist</Text>
                </View>

                <View style={styles.pillGroup}>
                  {doctorsList.map((doc) => {
                    const docId = doc.user_id || doc.id;
                    const docName =
                      `Dr. ${doc.first_name || ""} ${doc.last_name || ""}`.trim();
                    const isSelected = selectedDoctorId === docId;
                    return (
                      <TouchableOpacity
                        key={docId}
                        style={[styles.pillBtn, isSelected && styles.pillBtnActive]}
                        onPress={() => setSelectedDoctorId(docId)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.pillBtnText, isSelected && styles.pillBtnTextActive]}>
                          {docName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ───────────────────────────────────────── */}
            {/* 5. NOTES                                  */}
            {/* ───────────────────────────────────────── */}
            <View style={[styles.card, { marginTop: 14 }]}>
              <Text style={styles.label}>Internal Notes / Patient Request Details</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add special notes, reminders, or reasons for visit..."
                placeholderTextColor="#94A3B8"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* ───────────────────────────────────────── */}
        {/* ACTION FOOTER & ENABLED BUTTON VALIDATION */}
        {/* ───────────────────────────────────────── */}
        <View style={styles.footerContainer}>
          {!isOkToSchedule ? (
            <View style={styles.validationNoticeBox}>
              <AlertCircle size={14} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.validationNoticeText}>
                {!selectedPatient
                  ? "Please choose a patient."
                  : isDateBlockedOut
                  ? `Cannot schedule: Date is blocked (${blockoutReason}).`
                  : isDayClosed
                  ? "Cannot schedule: Clinic is closed on this day."
                  : isDateFull
                  ? "Cannot schedule: Date is FULL (3/3 scheduled)."
                  : isPatientScheduledOnDate
                  ? "Cannot schedule: Patient already scheduled on this date."
                  : !appointmentTime || isSelectedTimeBooked
                  ? "Please select an available time slot."
                  : "Please complete all required fields."}
              </Text>
            </View>
          ) : (
            <View style={styles.readyNoticeBox}>
              <CheckCircle2 size={14} color="#059669" style={{ marginRight: 6 }} />
              <Text style={styles.readyNoticeText}>
                Ready: {formatDateLong(appointmentDate)} at {appointmentTime}
              </Text>
            </View>
          )}

          <View style={styles.footerBtnRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={handleClose}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (!isOkToSchedule || loading) && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!isOkToSchedule || loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>Schedule Appointment</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ───────────────────────────────────────── */}
        {/* MODAL: CHOOSE EXISTING PATIENT            */}
        {/* ───────────────────────────────────────── */}
        <Modal
          visible={showPatientPicker}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowPatientPicker(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }} edges={["top", "bottom"]}>
            <View style={styles.pickerHeader}>
              <View>
                <Text style={styles.pickerTitle}>CHOOSE EXISTING PATIENT</Text>
                <Text style={styles.pickerSubtitle}>Select an existing patient profile for this appointment</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowPatientPicker(false)}
              >
                <X size={18} color="#475569" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBarBox}>
              <Search size={16} color="#94A3B8" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchBarInput}
                placeholder="Search by name, email, or phone..."
                placeholderTextColor="#94A3B8"
                value={patientSearch}
                onChangeText={(text) => {
                  setPatientSearch(text);
                  setPatientPage(1);
                }}
                autoFocus
              />
              {patientSearch ? (
                <TouchableOpacity
                  onPress={() => {
                    setPatientSearch("");
                    setPatientPage(1);
                  }}
                >
                  <X size={16} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Patients Count & Pagination Meta Header */}
            <View style={styles.patientMetaHeader}>
              <Text style={styles.patientMetaText}>
                {filteredPatients.length} patient{filteredPatients.length === 1 ? "" : "s"} found
                {filteredPatients.length > 0 ? ` • Page ${patientPage} of ${totalPatientPages}` : ""}
              </Text>
            </View>

            {loadingPatients ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#047857" />
                <Text style={{ marginTop: 10, fontSize: 13, color: "#64748B" }}>Loading patients...</Text>
              </View>
            ) : filteredPatients.length === 0 ? (
              <View style={styles.centerContainer}>
                <User size={36} color="#CBD5E1" />
                <Text style={{ marginTop: 10, fontSize: 14, fontWeight: "700", color: "#64748B" }}>
                  No patients found
                </Text>
                <Text style={{ marginTop: 4, fontSize: 12, color: "#94A3B8" }}>
                  Try a different search query
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                  {paginatedPatients.map((p) => {
                    const isCurrent = selectedPatient?.id === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.patientItemRow, isCurrent && styles.patientItemRowSelected]}
                        onPress={() => {
                          setSelectedPatient({
                            id: p.id,
                            name: p.name || "Patient",
                            email: p.email || "",
                            contact: p.contact || p.phone,
                            dummy: !!p.dummy,
                          });
                          setShowPatientPicker(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.patientItemAvatar}>
                          <Text style={styles.patientItemAvatarText}>
                            {(p.name || "P").charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={styles.patientItemName}>{p.name}</Text>
                            <View style={p.dummy ? styles.walkInBadge : styles.patientBadge}>
                              <Text style={p.dummy ? styles.walkInBadgeText : styles.patientBadgeText}>
                                {p.dummy ? "WALK-IN" : "PATIENT"}
                              </Text>
                            </View>
                          </View>

                          {/* Display Email Prominently */}
                          <View style={styles.patientEmailRow}>
                            <Mail size={12} color="#047857" style={{ marginRight: 4 }} />
                            <Text style={styles.patientItemEmail} numberOfLines={1}>
                              {p.email ? p.email : "No email registered"}
                            </Text>
                          </View>

                          {p.contact || p.phone ? (
                            <Text style={styles.patientItemMeta}>Phone: {p.contact || p.phone}</Text>
                          ) : null}
                        </View>
                        {isCurrent ? (
                          <Check size={18} color="#047857" strokeWidth={2.5} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Pagination Controls */}
                {totalPatientPages > 1 && (
                  <View style={styles.paginationRow}>
                    <TouchableOpacity
                      style={[styles.pageNavBtn, patientPage === 1 && styles.pageNavBtnDisabled]}
                      onPress={() => setPatientPage((prev) => Math.max(1, prev - 1))}
                      disabled={patientPage === 1}
                      activeOpacity={0.7}
                    >
                      <ChevronLeft size={16} color={patientPage === 1 ? "#94A3B8" : "#047857"} />
                      <Text style={[styles.pageNavBtnText, patientPage === 1 && styles.pageNavBtnTextDisabled]}>
                        Prev
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.pageNumbersRow}>
                      {Array.from({ length: totalPatientPages }).map((_, idx) => {
                        const pageNum = idx + 1;
                        if (
                          totalPatientPages > 6 &&
                          Math.abs(pageNum - patientPage) > 2 &&
                          pageNum !== 1 &&
                          pageNum !== totalPatientPages
                        ) {
                          if (pageNum === 2 || pageNum === totalPatientPages - 1) {
                            return (
                              <Text key={`dot-${pageNum}`} style={styles.pageEllipsis}>
                                •••
                              </Text>
                            );
                          }
                          return null;
                        }

                        const isSelected = pageNum === patientPage;
                        return (
                          <TouchableOpacity
                            key={pageNum}
                            style={[styles.pageNumberBtn, isSelected && styles.pageNumberBtnActive]}
                            onPress={() => setPatientPage(pageNum)}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                styles.pageNumberText,
                                isSelected && styles.pageNumberTextActive,
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
                        styles.pageNavBtn,
                        patientPage === totalPatientPages && styles.pageNavBtnDisabled,
                      ]}
                      onPress={() => setPatientPage((prev) => Math.min(totalPatientPages, prev + 1))}
                      disabled={patientPage === totalPatientPages}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.pageNavBtnText,
                          patientPage === totalPatientPages && styles.pageNavBtnTextDisabled,
                        ]}
                      >
                        Next
                      </Text>
                      <ChevronRight
                        size={16}
                        color={patientPage === totalPatientPages ? "#94A3B8" : "#047857"}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </SafeAreaView>
        </Modal>

        {/* ───────────────────────────────────────── */}
        {/* MODAL: INTERACTIVE DATE PICKER CALENDAR   */}
        {/* ───────────────────────────────────────── */}
        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerModalCard}>
              {/* Header with Month Navigator (constrained to [Current Month .. +6 Months]) */}
              {(() => {
                const now = new Date();
                const currentMonthIdx = now.getFullYear() * 12 + now.getMonth();
                const pickerMonthIdx = pickerCalendarMonth.getFullYear() * 12 + pickerCalendarMonth.getMonth();
                const canGoPrevMonth = pickerMonthIdx > currentMonthIdx;
                const canGoNextMonth = pickerMonthIdx < currentMonthIdx + 6;

                return (
                  <View style={styles.datePickerHeader}>
                    <TouchableOpacity
                      onPress={() => {
                        if (canGoPrevMonth) {
                          const prev = new Date(
                            pickerCalendarMonth.getFullYear(),
                            pickerCalendarMonth.getMonth() - 1,
                            1
                          );
                          setPickerCalendarMonth(prev);
                        }
                      }}
                      disabled={!canGoPrevMonth}
                      style={[styles.dateNavBtn, !canGoPrevMonth && { opacity: 0.35, backgroundColor: "#F1F5F9" }]}
                      activeOpacity={0.7}
                    >
                      <ChevronLeft size={18} color={canGoPrevMonth ? "#047857" : "#94A3B8"} />
                    </TouchableOpacity>

                    <View style={{ alignItems: "center" }}>
                      <Text style={styles.datePickerMonthTitle}>
                        {MONTH_NAMES[pickerCalendarMonth.getMonth()]}{" "}
                        {pickerCalendarMonth.getFullYear()}
                      </Text>
                      <Text style={styles.datePickerSubtitle}>Available: today up to 6 months ahead</Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => {
                        if (canGoNextMonth) {
                          const next = new Date(
                            pickerCalendarMonth.getFullYear(),
                            pickerCalendarMonth.getMonth() + 1,
                            1
                          );
                          setPickerCalendarMonth(next);
                        }
                      }}
                      disabled={!canGoNextMonth}
                      style={[styles.dateNavBtn, !canGoNextMonth && { opacity: 0.35, backgroundColor: "#F1F5F9" }]}
                      activeOpacity={0.7}
                    >
                      <ChevronRight size={18} color={canGoNextMonth ? "#047857" : "#94A3B8"} />
                    </TouchableOpacity>
                  </View>
                );
              })()}

              {/* Day of week headers */}
              <View style={styles.weekdaysRow}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => {
                  const dayName = DAY_KEYS[idx];
                  const daySched = clinicSchedule?.[dayName];
                  const isClosed = daySched ? daySched.isOpen === false : false;
                  return (
                    <Text
                      key={day}
                      style={[styles.weekdayText, isClosed && { color: "#EF4444", opacity: 0.8 }]}
                    >
                      {day}
                    </Text>
                  );
                })}
              </View>

              {/* Days Grid */}
              <View style={styles.daysGrid}>
                {/* Empty slots for starting day of month */}
                {Array.from({
                  length: new Date(
                    pickerCalendarMonth.getFullYear(),
                    pickerCalendarMonth.getMonth(),
                    1
                  ).getDay(),
                }).map((_, idx) => (
                  <View key={`empty-${idx}`} style={styles.dayCellEmpty} />
                ))}

                {/* Day buttons */}
                {Array.from({
                  length: new Date(
                    pickerCalendarMonth.getFullYear(),
                    pickerCalendarMonth.getMonth() + 1,
                    0
                  ).getDate(),
                }).map((_, idx) => {
                  const day = idx + 1;
                  const dateStr = `${pickerCalendarMonth.getFullYear()}-${String(
                    pickerCalendarMonth.getMonth() + 1
                  ).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

                  const isSelected = appointmentDate === dateStr;
                  const dayName = getDayName(dateStr);
                  const daySched = clinicSchedule?.[dayName];
                  const isClosed = daySched ? daySched.isOpen === false : false;

                  const isBlocked = blockoutDates.some(
                    (b) => b.blockout_date === dateStr && b.is_blocked
                  );

                  // Count ONLY scheduled appointments for FULL blockout
                  const scheduledCount = monthAppointments.filter(
                    (a) =>
                      a.appointment_date === dateStr &&
                      (a.status || "").toLowerCase() === "scheduled"
                  ).length;
                  const isFull = scheduledCount >= 3;

                  // Date limits: cannot book previous days and max 6 months ahead
                  const todayStr = getTodayStr();
                  const maxDateStr = getMaxDate().dateStr;
                  const isPast = dateStr < todayStr;
                  const isBeyondLimit = dateStr > maxDateStr;

                  const isUnavailable = isPast || isBeyondLimit || isClosed || isBlocked || isFull;

                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                        isFull && !isSelected && styles.dayCellFull,
                        isBlocked && !isSelected && styles.dayCellBlocked,
                        isClosed && !isSelected && styles.dayCellClosed,
                        (isPast || isBeyondLimit) && !isSelected && styles.dayCellPast,
                      ]}
                      onPress={() => {
                        if (!isUnavailable) {
                          setAppointmentDate(dateStr);
                          setAppointmentTime("");
                          setShowDatePicker(false);
                        }
                      }}
                      disabled={isUnavailable}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isSelected && styles.dayTextSelected,
                          isFull && styles.dayTextFull,
                          isBlocked && styles.dayTextBlocked,
                          isClosed && styles.dayTextClosed,
                          (isPast || isBeyondLimit) && styles.dayTextPast,
                        ]}
                      >
                        {day}
                      </Text>

                      {/* Status Badges */}
                      {isFull ? (
                        <View style={styles.dayMiniBadgeFull}>
                          <Text style={styles.dayMiniBadgeFullText}>FULL</Text>
                        </View>
                      ) : isBlocked ? (
                        <View style={styles.dayMiniBadgeBlocked}>
                          <Text style={styles.dayMiniBadgeBlockedText}>X</Text>
                        </View>
                      ) : isClosed ? (
                        <View style={styles.dayMiniBadgeClosed}>
                          <Text style={styles.dayMiniBadgeClosedText}>OFF</Text>
                        </View>
                      ) : scheduledCount > 0 ? (
                        <View style={styles.dayMiniBadgeCount}>
                          <Text style={styles.dayMiniBadgeCountText}>{scheduledCount}</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Legend */}
              <View style={styles.calendarLegendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
                  <Text style={styles.legendText}>FULL (3/3)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
                  <Text style={styles.legendText}>Blocked</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#94A3B8" }]} />
                  <Text style={styles.legendText}>Closed</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#CBD5E1" }]} />
                  <Text style={styles.legendText}>Past / Max</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeDatePickerBtn}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.closeDatePickerBtnText}>Close Calendar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ───────────────────────────────────────── */}
        {/* SUCCESS CONFIRMATION MODAL                */}
        {/* ───────────────────────────────────────── */}
        <Modal
          visible={successCreatedAppointment !== null}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setSuccessCreatedAppointment(null);
            handleClose();
            onAppointmentAdded?.();
          }}
        >
          <View style={styles.successOverlay}>
            <View style={styles.successModalCard}>
              <View style={styles.successIconBadge}>
                <CheckCircle2 size={36} color="#059669" strokeWidth={2.5} />
              </View>
              <Text style={styles.successTitle}>Appointment Scheduled!</Text>
              <Text style={styles.successSubtitle}>
                The appointment has been confirmed and placed on the clinic calendar.
              </Text>

              <View style={styles.successSummaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Patient</Text>
                  <Text style={styles.summaryValue}>{successCreatedAppointment?.patientName}</Text>
                </View>
                {successCreatedAppointment?.patientEmail ? (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Email</Text>
                    <Text style={styles.summaryValue}>{successCreatedAppointment?.patientEmail}</Text>
                  </View>
                ) : null}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Date & Time</Text>
                  <Text style={styles.summaryValue}>
                    {formatDateLong(successCreatedAppointment?.date || "")} at {successCreatedAppointment?.time}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Service</Text>
                  <Text style={styles.summaryValue}>{successCreatedAppointment?.service}</Text>
                </View>
                <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.summaryLabel}>Dentist</Text>
                  <Text style={styles.summaryValue}>{successCreatedAppointment?.doctorName}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.successDoneBtn}
                onPress={() => {
                  setSuccessCreatedAppointment(null);
                  handleClose();
                  onAppointmentAdded?.();
                }}
                activeOpacity={0.8}
              >
                <Check size={18} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.successDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.3,
  },
  assistantBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    gap: 4,
  },
  assistantBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#FECACA",
  },
  errorText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  labelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  required: {
    color: "#EF4444",
  },
  clinicSourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  clinicSourceBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.3,
  },
  quickAddPatientBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  quickAddPatientBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  patientPickerTrigger: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 12,
  },
  patientPickerTriggerEmpty: {
    borderStyle: "dashed",
  },
  emptyPatientRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emptyPatientText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  selectedPatientBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  patientAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#047857",
    alignItems: "center",
    justifyContent: "center",
  },
  patientAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  selectedPatientName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  patientBadge: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  patientBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#047857",
    letterSpacing: 0.3,
  },
  walkInBadge: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  walkInBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.3,
  },
  patientEmailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  selectedPatientEmail: {
    fontSize: 12,
    fontWeight: "600",
    color: "#047857",
  },
  selectedPatientContact: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  changeDateBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
  },
  changeDateBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
  },
  dateHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 14,
  },
  dateHeroCardWarning: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  dateHeroLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dateHeroValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  dateHeroWeekday: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
    marginTop: 2,
  },
  badgeAvailable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeAvailableText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
  },
  badgeFull: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeFullText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#DC2626",
  },
  badgeBlocked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeBlockedText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#DC2626",
  },
  badgeClosed: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeClosedText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  badgeConflict: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeConflictText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B45309",
  },
  dateWarningBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  dateWarningText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#DC2626",
    flex: 1,
  },
  timeSlotsHeaderHint: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  timeSelectHintText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#D97706",
    marginBottom: 8,
  },
  noSlotsBox: {
    padding: 14,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    alignItems: "center",
  },
  noSlotsText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#0F172A",
  },
  textArea: {
    minHeight: 65,
    textAlignVertical: "top",
  },
  pillGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  servicePill: {
    width: "48.5%",
    minHeight: 52,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#E2E8F0",
    borderRightColor: "#CBD5E1",
    borderBottomColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  servicePillActive: {
    backgroundColor: "#047857",
    borderColor: "#064E3B",
    borderBottomWidth: 3,
    borderBottomColor: "#022C22",
  },
  servicePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
    lineHeight: 16,
  },
  servicePillTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  intervalFilterRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  intervalFilterTab: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  intervalFilterTabActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  intervalFilterTabText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  intervalFilterTabTextActive: {
    color: "#047857",
    fontWeight: "800",
  },
  selectedTimeSummaryBanner: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  selectedTimeSummaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  serviceDurationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#D1FAE5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  serviceDurationBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#047857",
  },
  selectedTimeSlotsSubtext: {
    fontSize: 11,
    color: "#059669",
    marginTop: 4,
    fontWeight: "600",
  },
  timePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    minWidth: 72,
  },
  timePillActive: {
    backgroundColor: "#047857",
    borderColor: "#047857",
  },
  timePillCovered: {
    backgroundColor: "#ECFDF5",
    borderColor: "#10B981",
    borderWidth: 1.5,
  },
  timePillBooked: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
    opacity: 0.6,
  },
  timePillDisabled: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    opacity: 0.45,
  },
  timePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  timePillTextActive: {
    color: "#FFFFFF",
  },
  timePillTextCovered: {
    color: "#047857",
    fontWeight: "700",
  },
  timePillTextBooked: {
    color: "#DC2626",
    textDecorationLine: "line-through",
  },
  timePillTextDisabled: {
    color: "#94A3B8",
  },
  timePillActiveTag: {
    fontSize: 8,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  timePillCoveredTag: {
    fontSize: 8,
    fontWeight: "800",
    color: "#059669",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  timePillBookedTag: {
    fontSize: 8,
    fontWeight: "800",
    color: "#DC2626",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  timePillDisabledTag: {
    fontSize: 8,
    fontWeight: "700",
    color: "#94A3B8",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pillBtnActive: {
    backgroundColor: "#047857",
    borderColor: "#047857",
  },
  pillBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  pillBtnTextActive: {
    color: "#FFFFFF",
  },
  footerContainer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  validationNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  validationNoticeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
    flex: 1,
  },
  readyNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  readyNoticeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
    flex: 1,
  },
  footerBtnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  submitBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#047857",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#047857",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  submitBtnDisabled: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  pickerSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  searchBarBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  searchBarInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
  },
  patientMetaHeader: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: "#F1F5F9",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  patientMetaText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  pageNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pageNavBtnDisabled: {
    opacity: 0.4,
  },
  pageNavBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#047857",
  },
  pageNavBtnTextDisabled: {
    color: "#94A3B8",
  },
  pageNumbersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pageNumberBtn: {
    minWidth: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
  },
  pageNumberBtnActive: {
    backgroundColor: "#047857",
  },
  pageNumberText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  pageNumberTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  pageEllipsis: {
    fontSize: 10,
    color: "#94A3B8",
    paddingHorizontal: 2,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  patientItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  patientItemRowSelected: {
    backgroundColor: "#F0FDF4",
  },
  patientItemAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  patientItemAvatarText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#475569",
  },
  patientItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  patientItemEmail: {
    fontSize: 12,
    fontWeight: "600",
    color: "#047857",
  },
  patientItemMeta: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  datePickerModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  datePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  dateNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  datePickerMonthTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  datePickerSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  weekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    marginBottom: 8,
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    width: "14.28%",
    textAlign: "center",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCellEmpty: {
    width: "14.28%",
    height: 48,
  },
  dayCell: {
    width: "14.28%",
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginVertical: 1,
  },
  dayCellSelected: {
    backgroundColor: "#047857",
  },
  dayCellFull: {
    backgroundColor: "#FEF2F2",
    opacity: 0.7,
  },
  dayCellBlocked: {
    backgroundColor: "#FEF3C7",
    opacity: 0.7,
  },
  dayCellClosed: {
    backgroundColor: "#F1F5F9",
    opacity: 0.5,
  },
  dayCellPast: {
    backgroundColor: "#F8FAFC",
    opacity: 0.35,
  },
  dayText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  dayTextSelected: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  dayTextFull: {
    color: "#DC2626",
    textDecorationLine: "line-through",
  },
  dayTextBlocked: {
    color: "#D97706",
  },
  dayTextClosed: {
    color: "#94A3B8",
  },
  dayTextPast: {
    color: "#94A3B8",
    textDecorationLine: "line-through",
  },
  dayMiniBadgeFull: {
    position: "absolute",
    bottom: 2,
    backgroundColor: "#EF4444",
    paddingHorizontal: 3,
    borderRadius: 3,
  },
  dayMiniBadgeFullText: {
    fontSize: 7,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  dayMiniBadgeBlocked: {
    position: "absolute",
    bottom: 2,
    backgroundColor: "#F59E0B",
    width: 10,
    height: 10,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  dayMiniBadgeBlockedText: {
    fontSize: 7,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  dayMiniBadgeClosed: {
    position: "absolute",
    bottom: 2,
    backgroundColor: "#94A3B8",
    paddingHorizontal: 3,
    borderRadius: 3,
  },
  dayMiniBadgeClosedText: {
    fontSize: 7,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  dayMiniBadgeCount: {
    position: "absolute",
    bottom: 2,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  dayMiniBadgeCountText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#047857",
  },
  calendarLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: "#64748B",
    fontWeight: "600",
  },
  closeDatePickerBtn: {
    marginTop: 14,
    backgroundColor: "#F1F5F9",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  closeDatePickerBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  successModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 10,
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ECFDF5",
    borderWidth: 2,
    borderColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  successSummaryCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 12,
    color: "#0F172A",
    fontWeight: "700",
    maxWidth: "58%",
    textAlign: "right",
  },
  successDoneBtn: {
    width: "100%",
    flexDirection: "row",
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  successDoneBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
