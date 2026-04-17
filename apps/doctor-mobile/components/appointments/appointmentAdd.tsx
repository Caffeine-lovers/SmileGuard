import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Image,
  TextInput,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@smileguard/supabase-client';
import AddPatient from '../patientrecord/AddPatient';
import { HeroIcon } from '../ui/HeroIcon';

interface AppointmentAddProps {
  visible: boolean;
  doctorId: string;
  onClose: () => void;
  onSave: () => void;
  onAppointmentCreated?: (patientName: string, service: string, time: string, appointmentId: string, patientId: string, doctorId: string) => void;
}

interface Patient {
  id: string;
  name: string;
  email: string;
  accountType: 'Patient' | 'Dummy';
}

interface Schedule {
  sunday: { isOpen: boolean; opening_time: string; closing_time: string };
  monday: { isOpen: boolean; opening_time: string; closing_time: string };
  tuesday: { isOpen: boolean; opening_time: string; closing_time: string };
  wednesday: { isOpen: boolean; opening_time: string; closing_time: string };
  thursday: { isOpen: boolean; opening_time: string; closing_time: string };
  friday: { isOpen: boolean; opening_time: string; closing_time: string };
  saturday: { isOpen: boolean; opening_time: string; closing_time: string };
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const SERVICES = [
  "Cleaning", "Whitening", "Fillings", "Root Canal", "Extraction", "Braces Consultation", "Implants Consultation",
    "X-Ray", "Checkup"
];

const STATUS_OPTIONS = ['scheduled', 'completed', 'cancelled', 'no-show'] as const;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function AppointmentAdd({
  visible,
  doctorId,
  onClose,
  onSave,
  onAppointmentCreated,
}: AppointmentAddProps) {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [appointmentDate, setAppointmentDate] = useState<string>('');
  const [appointmentTime, setAppointmentTime] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<'scheduled' | 'completed' | 'cancelled' | 'no-show'>('scheduled');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetchingPatients, setFetchingPatients] = useState(false);
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [selectedHour, setSelectedHour] = useState(10);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [dayAppointmentCounts, setDayAppointmentCounts] = useState<{ [key: string]: number }>({});
  const [currentScrollSection, setCurrentScrollSection] = useState<string>('A');
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [clinicSchedule, setClinicSchedule] = useState<Schedule | null>(null);
  const [blockoutDates, setBlockoutDates] = useState<any[]>([]);

  // Organize patients by first letter
  const groupPatientsByLetter = () => {
    const grouped: { [key: string]: Patient[] } = {};
    patients.forEach((patient) => {
      const firstLetter = patient.name.charAt(0).toUpperCase();
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(patient);
    });
    return Object.keys(grouped).sort();
  };

  // Fetch patients on mount or when modal becomes visible
  useEffect(() => {
    if (visible) {
      fetchPatients();
      // Reset form fields when modal opens
      setSelectedPatient('');
      setAppointmentDate('');
      setAppointmentTime('');
      setSelectedService('');
      setSelectedStatus('scheduled');
      setNotes('');
      // Initialize date picker with tomorrow as default (1 day advance)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setSelectedYear(tomorrow.getFullYear());
      setSelectedMonth(tomorrow.getMonth() + 1);
      setSelectedDay(tomorrow.getDate());
      setSelectedHour(10);
      setSelectedMinute(0);
      
      // Load clinic schedule and blockout dates
      loadClinicSchedule();
      loadBlockoutDates();
    }
  }, [visible]);

  // Load clinic schedule from clinic_setup table
  const loadClinicSchedule = async () => {
    try {
      if (!doctorId) {
        console.warn('⚠️ Cannot load clinic schedule: doctorId is empty');
        return;
      }
      
      console.log('🔄 Loading clinic schedule for doctorId:', doctorId);
      
      const { data, error } = await supabase
        .from('clinic_setup')
        .select('schedule')
        .eq('user_id', doctorId);
      
      if (error) {
        console.error('❌ Error loading clinic schedule:', error.message);
        return;
      }
      
      console.log('📊 Schedule query result - data:', data, 'error:', error);
      
      if (data && data.length > 0 && data[0].schedule) {
        console.log('✅ Loaded clinic schedule:', JSON.stringify(data[0].schedule, null, 2));
        setClinicSchedule(data[0].schedule);
      } else {
        console.warn('⚠️ No clinic schedule found, data length:', data?.length);
        // Log each day to see what we're getting
        if (data && data.length > 0) {
          console.log('📋 Full record:', JSON.stringify(data[0], null, 2));
        }
      }
    } catch (error) {
      console.error('❌ Error loading clinic schedule:', error);
    }
  };

  // Load blockout dates from clinic_blockout_dates table
  const loadBlockoutDates = async () => {
    try {
      console.log('[AppointmentAdd] Loading blockout dates...');
      
      // Get current authenticated user to ensure RLS policy passes
      const { data: { user } } = await supabase.auth.getUser();
      const authUserId = user?.id;
      
      if (!authUserId) {
        console.warn('⚠️ Cannot load blockout dates: user not authenticated');
        return;
      }
      
      const { data: blockoutData, error: blockoutError } = await supabase
        .from('clinic_blockout_dates')
        .select('*')
        .eq('user_id', authUserId);
      
      if (blockoutError) {
        console.error('❌ Error loading blockout dates:', blockoutError.message);
        return;
      }
      
      if (blockoutData) {
        setBlockoutDates(blockoutData);
        console.log('✅ Loaded', blockoutData.length, 'blockout dates');
        blockoutData.forEach(b => {
          console.log(`   📌 Blockout: ${b.blockout_date} - is_blocked: ${b.is_blocked}`);
        });
      }
    } catch (error) {
      console.error('❌ Error loading blockout dates:', error);
    }
  };

  // Handle return from AddPatient modal
  useEffect(() => {
    const handleNewPatientCreated = async () => {
      if (!visible || showAddPatientModal) return;

      try {
        // Check if a new patient was added
        const newPatientId = await AsyncStorage.getItem('newlyAddedPatientId');
        
        if (newPatientId) {
          console.log('📱 New patient detected, ID:', newPatientId);
          // Refresh the patient list
          await fetchPatients(() => {
            // Auto-select the newly added patient
            setSelectedPatient(newPatientId);
            console.log('✅ Auto-selected new patient:', newPatientId);
            // Close the patient picker modal after selection
            setShowPatientPicker(false);
          });
          
          // Clear the stored ID
          await AsyncStorage.removeItem('newlyAddedPatientId');
        }
      } catch (error) {
        console.error('Error handling new patient creation:', error);
      }
    };

    handleNewPatientCreated();
  }, [visible, showAddPatientModal]);

  // Adjust selectedMonth and selectedDay based on selected year and month
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowYear = tomorrow.getFullYear();
    const tomorrowMonth = tomorrow.getMonth() + 1;
    const tomorrowDay = tomorrow.getDate();

    // If selected year is current year and selected month is before tomorrow's month, reset to tomorrow's month
    if (selectedYear === tomorrowYear && selectedMonth < tomorrowMonth) {
      setSelectedMonth(tomorrowMonth);
    }

    // If selected year and month are tomorrow's year/month and selected day is before tomorrow, reset to tomorrow
    if (selectedYear === tomorrowYear && selectedMonth === tomorrowMonth && selectedDay < tomorrowDay) {
      setSelectedDay(tomorrowDay);
    }

    // Adjust selectedDay if it exceeds max days in the selected month
    const maxDays = getDaysInMonth(selectedYear, selectedMonth);
    if (selectedDay > maxDays) {
      setSelectedDay(maxDays);
    }
  }, [selectedYear, selectedMonth]);

  // Load appointment counts for the selected month
  useEffect(() => {
    const loadAppointmentCounts = async () => {
      if (!showDatePicker) return;

      try {
        console.log('📅 Loading appointment counts for', `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`);

        // Also reload blockout dates for the selected month
        await loadBlockoutDates();

        // OPTIMIZATION: Fetch ALL appointments for the month in ONE query
        const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);
        const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        const { data: allMonthAppointments, error } = await supabase
          .from('appointments')
          .select('appointment_date')
          .gte('appointment_date', startDate)
          .lte('appointment_date', endDate);

        if (error) {
          console.error('❌ Error fetching month appointments:', error);
          return;
        }

        // Now calculate counts locally (no more database queries!)
        const counts: { [key: string]: number } = {};
        
        for (let day = 1; day <= daysInMonth; day++) {
          const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const count = (allMonthAppointments || []).filter(apt => apt.appointment_date === dateKey).length;
          counts[dateKey] = count;
        }

        console.log('✅ Appointment counts loaded (1 query for all days):', counts);
        setDayAppointmentCounts(counts);
      } catch (error) {
        console.error('❌ Exception loading appointment counts:', error);
      }
    };

    loadAppointmentCounts();
  }, [showDatePicker, selectedYear, selectedMonth]);

  // Load booked times for the selected date
  useEffect(() => {
    const loadBookedTimes = async () => {
      if (!showTimePicker || !appointmentDate) {
        setBookedTimes([]);
        return;
      }

      try {
        console.log('⏰ Loading booked times for', appointmentDate);

        const { data: appointments, error } = await supabase
          .from('appointments')
          .select('appointment_time')
          .eq('appointment_date', appointmentDate);

        if (error) {
          console.error('❌ Error fetching booked times:', error);
          return;
        }

        const times = (appointments || []).map(apt => apt.appointment_time);
        console.log('✅ Booked times:', times);
        setBookedTimes(times);
      } catch (error) {
        console.error('❌ Exception loading booked times:', error);
      }
    };

    loadBookedTimes();
  }, [showTimePicker, appointmentDate]);

  // Auto-adjust minute when hour changes (pick first available slot)
  useEffect(() => {
    if (!showTimePicker) return;
    
    const slot00Available = !bookedTimes.includes(`${String(selectedHour).padStart(2, '0')}:00`) && isTimeAvailable(selectedHour, 0);
    
    // If slot is unavailable, don't adjust
    if (!slot00Available) return;
    
    // Select minute 0 (only 1-hour intervals)
    setSelectedMinute(0);
  }, [selectedHour, bookedTimes, showTimePicker, clinicSchedule]);

  // Validate selected hour when date changes (ensure it's within clinic hours for that date)
  useEffect(() => {
    if (!showTimePicker) return;
    
    const availableHours = getAvailableHours();
    if (availableHours.length === 0) {
      console.warn('⚠️ No available hours on selected date');
      return;
    }
    
    // If selected hour is not in available hours, reset to first available hour
    if (!availableHours.includes(selectedHour)) {
      console.log(`🔄 Selected hour ${selectedHour} not available. Resetting to ${availableHours[0]}`);
      setSelectedHour(availableHours[0]);
      setSelectedMinute(0);
    }
  }, [selectedYear, selectedMonth, selectedDay, showTimePicker, clinicSchedule]);

  const fetchPatients = async (onComplete?: () => void) => {
    try {
      setFetchingPatients(true);
      
      // Fetch from profiles table
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('role', 'patient')
        .order('name', { ascending: true });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Fetch from dummy_accounts table
      const { data: dummyData, error: dummyError } = await supabase
        .from('dummy_accounts')
        .select('id, patient_name, email')
        .order('patient_name', { ascending: true });

      if (dummyError) {
        console.error('Error fetching dummy accounts:', dummyError);
      }

      // Combine and label the data
      const patients: Patient[] = [];
      
      if (profilesData) {
        patients.push(
          ...profilesData.map((p) => ({
            ...p,
            accountType: 'Patient' as const,
          }))
        );
      }
      
      if (dummyData) {
        patients.push(
          ...dummyData.map((d) => ({
            id: d.id,
            name: d.patient_name,
            email: d.email,
            accountType: 'Dummy' as const,
          }))
        );
      }

      // Sort combined list by name
      patients.sort((a, b) => a.name.localeCompare(b.name));

      setPatients(patients);
      
      // Call the callback if provided (e.g., to select newly added patient)
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Exception fetching patients:', error);
      Alert.alert('Error', 'Failed to load patients');
    } finally {
      setFetchingPatients(false);
    }
  };

  const handleDateChange = (text: string) => {
    // Basic validation: YYYY-MM-DD format
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    if (dateRegex.test(text) || text === '') {
      setAppointmentDate(text);
    }
  };

  const handleTimeChange = (text: string) => {
    // Basic validation: HH:MM format
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]?$/;
    if (timeRegex.test(text) || text === '') {
      setAppointmentTime(text);
    }
  };

  const handleDatePickerConfirm = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowYear = tomorrow.getFullYear();
    const tomorrowMonth = tomorrow.getMonth() + 1;
    const tomorrowDay = tomorrow.getDate();

    if (isUnavailableDay(selectedYear, selectedMonth, selectedDay)) {
      Alert.alert('Clinic Closed', 'The clinic is closed on Sundays and Tuesdays. Please select another day.');
      return;
    }

    // Ensure month is valid for selected year
    let validMonth = selectedMonth;
    if (selectedYear === tomorrowYear && validMonth < tomorrowMonth) {
      validMonth = tomorrowMonth;
    }

    // Ensure day is valid for the selected month
    const maxDays = getDaysInMonth(selectedYear, validMonth);
    let validDay = Math.min(selectedDay, maxDays);

    // Ensure day is not in the past for tomorrow's year/month (1 day advance)
    if (selectedYear === tomorrowYear && validMonth === tomorrowMonth && validDay < tomorrowDay) {
      validDay = tomorrowDay;
    }

    const dateString = `${selectedYear}-${String(validMonth).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
    setAppointmentDate(dateString);
    setShowDatePicker(false);
  };

  const handleTimePickerConfirm = () => {
    const timeString = `${String(selectedHour).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
    setAppointmentTime(timeString);
    setShowTimePicker(false);
  };

  const getPatientName = (patientId: string): string => {
    const patient = patients.find((p) => p.id === patientId);
    return patient?.name || 'Select Patient';
  };

  // Get day abbreviation from date
  const getDayAbbreviation = (year: number, month: number, day: number): string => {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const dayAbbreviations = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return dayAbbreviations[dayOfWeek];
  };

  const isUnavailableDay = (year: number, month: number, day: number): boolean => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // 1. Check specific blockout dates first (highest priority)
    const blockout = blockoutDates.find(b => b.blockout_date === dateStr);
    if (blockout) {
      if (blockout.is_blocked) {
        console.log(`[AppointmentAdd] Date ${dateStr} is BLOCKED (specific blockout)`);
        return true;
      } else {
        console.log(`[AppointmentAdd] Date ${dateStr} is AVAILABLE (blockout override)`);
        return false;
      }
    }
    
    // 2. Check clinic schedule
    if (clinicSchedule) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      const dayName = DAY_NAMES[dayOfWeek];
      const daySchedule = clinicSchedule[dayName as keyof Schedule];
      
      if (daySchedule && daySchedule.isOpen === false) {
        return true;
      }
    }
    
    return false;
  };

  const getDayAppointmentCount = async (year: number, month: number, day: number): Promise<number> => {
    try {
      const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Count ALL appointments on this day (clinic-wide, all doctors)
      const { data, error } = await supabase
        .from('appointments')
        .select('id, status, dentist_id')
        .eq('appointment_date', dateString);

      if (error) {
        console.error(`❌ Error fetching appointment count for ${dateString}:`, error);
        return 0;
      }

      const count = data?.length || 0;
      if (count >= 3) {
        console.log(`🔴 ${dateString}: ${count} appointments - FULL (clinic-wide)`, data?.map(a => a.status));
      }
      return count;
    } catch (error) {
      console.error('Exception fetching appointment count:', error);
      return 0;
    }
  };

  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month, 0).getDate();
  };

  // Parse time in 12-hour format (e.g., "10:00 AM" or "3:00 PM") to 24-hour format
  const parse12HourTime = (timeString: string): { hour: number; minute: number } => {
    console.log(`🔄 Parsing time string: "${timeString}"`);
    
    // Match format like "10:00 AM" or "3:00 PM"
    const match = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    
    if (!match) {
      console.error(`❌ Invalid time format: "${timeString}". Expected format: "HH:MM AM/PM"`);
      return { hour: 10, minute: 0 }; // Fallback
    }
    
    let hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const period = match[3].toUpperCase();
    
    // Convert 12-hour to 24-hour format
    if (period === 'PM' && hour !== 12) {
      hour += 12; // 1 PM = 13, 2 PM = 14, etc.
    } else if (period === 'AM' && hour === 12) {
      hour = 0; // 12 AM = 00:00
    }
    
    console.log(`✅ Converted "${timeString}" to ${hour}:${String(minute).padStart(2, '0')} (24-hour format)`);
    
    return { hour, minute };
  };

  // Get clinic hours for a specific date
  const getClinicHoursForDate = (year: number, month: number, day: number) => {
    if (!clinicSchedule) {
      console.warn('⚠️ clinicSchedule is null/undefined');
      return null;
    }
    
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const dayName = DAY_NAMES[dayOfWeek];
    
    console.log(`[AppointmentAdd] Getting hours for ${dayName} (date: ${year}-${month}-${day})`, {
      dayOfWeek,
      dayName,
      availableDays: Object.keys(clinicSchedule),
      schedule: clinicSchedule[dayName as keyof Schedule],
    });
    
    const daySchedule = clinicSchedule[dayName as keyof Schedule];
    if (!daySchedule) {
      console.warn(`⚠️ No schedule entry for ${dayName}`);
      return null;
    }
    
    if (!daySchedule.isOpen) {
      console.log(`🚫 ${dayName} is closed (isOpen = false)`);
      return null;
    }
    
    // Parse opening and closing times (format: "HH:MM")
    console.log(`⏰ ${dayName} times - opening: ${daySchedule.opening_time}, closing: ${daySchedule.closing_time}`);
    const openingTime = parse12HourTime(daySchedule.opening_time);
    const closingTime = parse12HourTime(daySchedule.closing_time);
    const openHour = openingTime.hour;
    const openMin = openingTime.minute;
    const closeHour = closingTime.hour;
    const closeMin = closingTime.minute;
    
    console.log(`✅ Parsed hours - open: ${openHour}:${String(openMin).padStart(2, '0')}, close: ${closeHour}:${String(closeMin).padStart(2, '0')}`);
    
    return { openHour, openMin, closeHour, closeMin };
  };

  // Check if a specific hour is available on the selected date
  const isHourAvailable = (hour: number): boolean => {
    const clinicHours = getClinicHoursForDate(selectedYear, selectedMonth, selectedDay);
    if (!clinicHours) {
      console.warn(`⚠️ Hour ${hour} unavailable - no clinic hours found`);
      return false; // Clinic is closed
    }
    
    const { openHour, closeHour } = clinicHours;
    // Allow hours from opening up to one hour before closing
    const isAvailable = hour >= openHour && hour < closeHour;
    
    console.log(`🕐 Hour ${hour} check: openHour=${openHour}, closeHour=${closeHour}, available=${isAvailable}`);
    
    return isAvailable;
  };

  // Check if a specific time is available on the selected date
  const isTimeAvailable = (hour: number, minute: number): boolean => {
    const clinicHours = getClinicHoursForDate(selectedYear, selectedMonth, selectedDay);
    if (!clinicHours) {
      console.warn(`⚠️ Time ${hour}:${minute} unavailable - no clinic hours found`);
      return false; // Clinic is closed
    }
    
    const { openHour, openMin, closeHour, closeMin } = clinicHours;
    
    // Create comparable time values
    const selectedTime = hour * 60 + minute;
    const openTime = openHour * 60 + openMin;
    // Allow times up to one hour before closing
    const closeTime = (closeHour - 1) * 60 + closeMin;
    
    const isAvailable = selectedTime >= openTime && selectedTime <= closeTime;
    
    console.log(`⏱️ Time ${hour}:${String(minute).padStart(2, '0')} check:`, {
      selectedTime,
      openTime: `${openHour}:${String(openMin).padStart(2, '0')}`,
      closeTime: `${closeHour}:${String(closeMin).padStart(2, '0')}`,
      available: isAvailable,
    });
    
    return isAvailable;
  };

  // Get available hours for the selected date based on clinic schedule
  const getAvailableHours = (): number[] => {
    const clinicHours = getClinicHoursForDate(selectedYear, selectedMonth, selectedDay);
    if (!clinicHours) {
      console.warn('⚠️ No clinic hours available for selected date');
      return []; // No hours available
    }
    
    const { openHour, closeHour } = clinicHours;
    const hours: number[] = [];
    
    // Generate all hours from opening to one hour before closing
    for (let hour = openHour; hour < closeHour; hour++) {
      hours.push(hour);
    }
    
    console.log(`📊 Available hours: ${hours.join(', ')} (open: ${openHour}, close: ${closeHour})`);
    return hours;
  };

  const validateForm = (): boolean => {
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!selectedPatient) {
      Alert.alert('Error', 'Please select a patient');
      return false;
    }
    if (!appointmentDate || !dateRegex.test(appointmentDate)) {
      Alert.alert('Error', 'Please enter a valid date (YYYY-MM-DD)');
      return false;
    }
    if (!appointmentTime || !timeRegex.test(appointmentTime)) {
      Alert.alert('Error', 'Please enter a valid time (HH:MM)');
      return false;
    }
    if (!selectedService) {
      Alert.alert('Error', 'Please select a service');
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setSelectedPatient('');
    setAppointmentDate('');
    setAppointmentTime('');
    setSelectedService('');
    setSelectedStatus('scheduled');
    setNotes('');
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const selectedPatientData = patients.find(p => p.id === selectedPatient);
      const isDummyAccount = selectedPatientData?.accountType === 'Dummy';

      const appointmentData: any = {
        dentist_id: doctorId,
        service: selectedService,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        status: selectedStatus,
        notes: notes || null,
      };

      // Use appropriate column based on account type
      if (isDummyAccount) {
        appointmentData.patient_id = null;
        appointmentData.dummy_account_id = selectedPatient;
      } else {
        appointmentData.patient_id = selectedPatient;
        appointmentData.dummy_account_id = null;
      }

      console.log('📝 Creating appointment:', appointmentData);

      const { data, error } = await supabase
        .from('appointments')
        .insert([appointmentData])
        .select();

      if (error) {
        console.error('Error creating appointment:', error);
        Alert.alert('Error', error.message || 'Failed to create appointment');
        return;
      }

      console.log('✅ Appointment created successfully:', data);
      
      // Trigger notification callback if provided
      if (onAppointmentCreated && data && data.length > 0) {
        const appointment = data[0];
        const patientName = selectedPatientData?.name || 'Patient';
        const patientId = selectedPatient;
        onAppointmentCreated(
          patientName,
          selectedService,
          appointmentTime,
          appointment.id,
          patientId,
          doctorId
        );
      }
      
      Alert.alert('Success', 'Appointment created successfully');
      onSave();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Exception creating appointment:', error);
      Alert.alert('Error', 'Failed to create appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f9f9f9' }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={loading}>
            <Image
              source={require('../../assets/images/icon/back.png')}
              style={styles.backIcon}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Appointment</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* Content */}
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }}>
          {fetchingPatients ? (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
              <ActivityIndicator size="large" color="#0b7fab" />
              <Text style={{ marginTop: 12, color: '#666' }}>Loading patients...</Text>
            </View>
          ) : (
            <>
              {/* Step Indicator */}
              <View style={styles.stepIndicator}>
                <Text style={styles.stepText}>Fill in order to proceed</Text>
                <View style={styles.stepProgress}>
                  <View style={[styles.stepDot, selectedPatient && styles.stepDotActive]}>
                    <Text style={[styles.stepNumber, selectedPatient && styles.stepNumberActive]}>1</Text>
                  </View>
                  <View style={[styles.stepDot, appointmentDate && styles.stepDotActive]}>
                    <Text style={[styles.stepNumber, appointmentDate && styles.stepNumberActive]}>2</Text>
                  </View>
                  <View style={[styles.stepDot, appointmentTime && styles.stepDotActive]}>
                    <Text style={[styles.stepNumber, appointmentTime && styles.stepNumberActive]}>3</Text>
                  </View>
                  <View style={[styles.stepDot, selectedService && styles.stepDotActive]}>
                    <Text style={[styles.stepNumber, selectedService && styles.stepNumberActive]}>4</Text>
                  </View>
                </View>
              </View>

              {/* Patient Selection */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.stepBadge}>1</Text>
                  <Text style={styles.sectionTitle}>Patient Information</Text>
                </View>

                <TouchableOpacity
                  style={[styles.dropdown, selectedPatient && styles.dropdownSelected]}
                  onPress={() => setShowPatientPicker(!showPatientPicker)}
                >
                  <Text style={[styles.dropdownText, selectedPatient && styles.dropdownTextSelected, { color: selectedPatient ? '#0b7fab' : '#999' }]}>
                    {selectedPatient ? getPatientName(selectedPatient) : 'Select Patient'}
                  </Text>
                  <Text style={{ color: selectedPatient ? '#0b7fab' : '#999' }}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* Patient Picker Modal */}
              {showPatientPicker && (
                <Modal transparent={true} animationType="fade" visible={showPatientPicker}>
                  <View style={styles.datePickerOverlay}>
                    <View style={[styles.datePickerContainer, { flex: 1, maxHeight: '80%' }]}>
                      <View style={styles.datePickerHeader}>
                        <TouchableOpacity onPress={() => setShowPatientPicker(false)}>
                          <Text style={styles.datePickerCancel}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.datePickerTitle}>Select Patient</Text>
                        <View style={{ width: 50 }} />
                      </View>

                      <View style={{ flex: 1, flexDirection: 'row' }}>
                        <ScrollView 
                          style={{ flex: 1 }} 
                          scrollEnabled={true}
                          onScroll={(event) => {
                            const offsetY = event.nativeEvent.contentOffset.y;
                            const itemHeight = 70; // approximate height of each item
                            const index = Math.max(0, Math.floor(offsetY / itemHeight));
                            
                            // Get the letter of the current patient
                            if (patients[index]) {
                              const letter = patients[index].name.charAt(0).toUpperCase();
                              setCurrentScrollSection(letter);
                            }
                          }}
                          scrollEventThrottle={16}
                        >
                          {patients.length === 0 ? (
                            <Text style={styles.emptyText}>No patients found</Text>
                          ) : (
                            patients.map((patient) => (
                              <TouchableOpacity
                                key={patient.id}
                                style={[
                                  styles.pickerItem,
                                  selectedPatient === patient.id && styles.pickerItemSelected,
                                ]}
                                onPress={() => {
                                  setSelectedPatient(patient.id);
                                  setShowPatientPicker(false);
                                }}
                              >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                  <Text
                                    style={[
                                      styles.pickerItemText,
                                      selectedPatient === patient.id && styles.pickerItemTextSelected,
                                      { flex: 1 }
                                    ]}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                  >
                                    {patient.name}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.accountTypeLabel,
                                      patient.accountType === 'Dummy' ? styles.dummyLabel : styles.patientLabel,
                                    ]}
                                  >
                                    {patient.accountType}
                                  </Text>
                                </View>
                                <Text style={styles.pickerItemSubText}>{patient.email}</Text>
                              </TouchableOpacity>
                            ))
                          )}
                        </ScrollView>

                        {/* Letter Index */}
                        <View style={styles.letterIndex}>
                          {groupPatientsByLetter().map((letter) => (
                            <View key={letter} style={styles.letterIndexItem}>
                              <Text style={[styles.letterIndexText, letter === currentScrollSection && styles.letterIndexTextActive]}>
                                {letter}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      {/* Add Patient Button */}
                      <View style={{ borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingHorizontal: 16, paddingVertical: 12 }}>
                        <TouchableOpacity
                          style={{
                            backgroundColor: '#0b7fab',
                            paddingVertical: 12,
                            borderRadius: 8,
                            alignItems: 'center',
                          }}
                          onPress={() => {
                            console.log('🔽 Opening AddPatient modal...');
                            setShowAddPatientModal(true);
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Add New Patient</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Modal>
              )}

              {/* Date & Time Selection */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.stepBadge, !selectedPatient && styles.stepBadgeDisabled]}>2</Text>
                  <Text style={[styles.sectionTitle, !selectedPatient && styles.sectionTitleDisabled]}>Appointment Time</Text>
                </View>

                {/* Date Picker Button */}
                <TouchableOpacity
                  style={[
                    styles.dropdown,
                    appointmentDate && styles.dropdownSelected,
                    !selectedPatient && styles.dropdownDisabled,
                  ]}
                  onPress={() => selectedPatient && setShowDatePicker(true)}
                  disabled={!selectedPatient}
                >
                  <Text style={[styles.dropdownText, appointmentDate && styles.dropdownTextSelected, { color: appointmentDate ? '#0b7fab' : !selectedPatient ? '#ccc' : '#999' }]}>
                    {appointmentDate || 'Select Date'}
                  </Text>
                </TouchableOpacity>

                {/* Time Picker Button */}
                <TouchableOpacity
                  style={[
                    styles.dropdown,
                    { marginTop: 12 },
                    appointmentTime && styles.dropdownSelected,
                    !appointmentDate && styles.dropdownDisabled,
                  ]}
                  onPress={() => appointmentDate && setShowTimePicker(true)}
                  disabled={!appointmentDate}
                >
                  <Text style={[styles.dropdownText, appointmentTime && styles.dropdownTextSelected, { color: appointmentTime ? '#0b7fab' : !appointmentDate ? '#ccc' : '#999' }]}>
                    {appointmentTime || 'Select Time'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Service Selection */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.stepBadge, !appointmentTime && styles.stepBadgeDisabled]}>3</Text>
                  <Text style={[styles.sectionTitle, !appointmentTime && styles.sectionTitleDisabled]}>Service</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.dropdown,
                    selectedService && styles.dropdownSelected,
                    !appointmentTime && styles.dropdownDisabled,
                  ]}
                  onPress={() => appointmentTime && setShowServicePicker(!showServicePicker)}
                  disabled={!appointmentTime}
                >
                  <Text style={[styles.dropdownText, selectedService && styles.dropdownTextSelected, { color: selectedService ? '#0b7fab' : !appointmentTime ? '#ccc' : '#999' }]}>
                    {selectedService || 'Select Service'}
                  </Text>
                  <Text style={{ color: selectedService ? '#0b7fab' : !appointmentTime ? '#ccc' : '#999' }}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* Service Picker Modal */}
              {showServicePicker && (
                <Modal transparent={true} animationType="fade" visible={showServicePicker}>
                  <View style={styles.datePickerOverlay}>
                    <View style={[styles.datePickerContainer, { flex: 1, maxHeight: '80%' }]}>
                      <View style={styles.datePickerHeader}>
                        <TouchableOpacity onPress={() => setShowServicePicker(false)}>
                          <Text style={styles.datePickerCancel}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.datePickerTitle}>Select Service</Text>
                        <View style={{ width: 50 }} />
                      </View>

                      <ScrollView style={{ flex: 1 }} scrollEnabled={true}>
                        {SERVICES.map((service) => (
                          <TouchableOpacity
                            key={service}
                            style={[
                              styles.pickerItem,
                              selectedService === service && styles.pickerItemSelected,
                            ]}
                            onPress={() => {
                              setSelectedService(service);
                              setShowServicePicker(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.pickerItemText,
                                selectedService === service && styles.pickerItemTextSelected,
                              ]}
                            >
                              {service}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </Modal>
              )}

              {/* Status Selection */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.stepBadge, !selectedService && styles.stepBadgeDisabled]}>4</Text>
                  <Text style={[styles.sectionTitle, !selectedService && styles.sectionTitleDisabled]}>Status</Text>
                </View>

                <View style={[styles.statusContainer, !selectedService && styles.statusContainerDisabled]}>
                  {STATUS_OPTIONS.map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusButton,
                        selectedStatus === status && styles.statusButtonSelected,
                        !selectedService && styles.statusButtonDisabled,
                      ]}
                      onPress={() => selectedService && setSelectedStatus(status)}
                      disabled={!selectedService}
                    >
                      <Text
                        style={[
                          styles.statusButtonText,
                          selectedStatus === status && styles.statusButtonTextSelected,
                          !selectedService && styles.statusButtonTextDisabled,
                        ]}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Notes */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.stepBadge, styles.stepBadgeOptional]}>5</Text>
                  <Text style={[styles.sectionTitle]}>Notes</Text>
                  <Text style={styles.optionalLabel}>(Optional)</Text>
                </View>
                <TextInput
                  style={[styles.notesInput, !selectedService && styles.notesInputDisabled]}
                  placeholder="Add any notes or special instructions..."
                  placeholderTextColor="#999"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={selectedService !== ''}
                />
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer */}
        {!fetchingPatients && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={loading || !selectedPatient}
            >
              <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Appointment'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Date Picker Modal */}
        {showDatePicker && (
          <Modal transparent={true} animationType="slide" visible={showDatePicker}>
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.datePickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Select Date</Text>
                  <TouchableOpacity onPress={handleDatePickerConfirm}>
                    <Text style={styles.datePickerConfirm}>Done</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.datePickerBody}>
                  {/* Year Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Year</Text>
                    <ScrollView style={styles.pickerScroll}>
                      {Array.from({ length: 2 }, (_, i) => new Date().getFullYear() + i).map((year) => (
                        <TouchableOpacity
                          key={year}
                          style={[styles.pickerItem, selectedYear === year && styles.pickerItemSelected]}
                          onPress={() => setSelectedYear(year)}
                        >
                          <Text style={[styles.pickerItemText, selectedYear === year && styles.pickerItemTextSelected]}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Month Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Month</Text>
                    <ScrollView style={styles.pickerScroll}>
                      {Array.from({ length: 12 }, (_, i) => i + 1)
                        .filter((month) => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          const tomorrowYear = tomorrow.getFullYear();
                          const tomorrowMonth = tomorrow.getMonth() + 1;
                          // If selected year is tomorrow's year, only show months from tomorrow onwards
                          if (selectedYear === tomorrowYear) {
                            return month >= tomorrowMonth;
                          }
                          // If selected year is in the future, show all months
                          return true;
                        })
                        .map((month) => (
                          <TouchableOpacity
                            key={month}
                            style={[styles.pickerItem, selectedMonth === month && styles.pickerItemSelected]}
                            onPress={() => setSelectedMonth(month)}
                          >
                            <Text style={[styles.pickerItemText, selectedMonth === month && styles.pickerItemTextSelected]}>
                              {MONTH_NAMES[month - 1]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>

                  {/* Day Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Day</Text>
                    <ScrollView style={styles.pickerScroll}>
                      {Array.from({ length: getDaysInMonth(selectedYear, selectedMonth) }, (_, i) => i + 1)
                        .filter((day) => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          const tomorrowYear = tomorrow.getFullYear();
                          const tomorrowMonth = tomorrow.getMonth() + 1;
                          const tomorrowDay = tomorrow.getDate();
                          // If selected year is tomorrow's year and selected month is tomorrow's month, only show days from tomorrow onwards
                          if (selectedYear === tomorrowYear && selectedMonth === tomorrowMonth) {
                            return day >= tomorrowDay;
                          }
                          // Otherwise show all days in that month
                          return true;
                        })
                        .map((day) => {
                          const isUnavailable = isUnavailableDay(selectedYear, selectedMonth, day);
                          const dateKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const appointmentCount = dayAppointmentCounts[dateKey] || 0;
                          const isFull = appointmentCount >= 3;
                          const isDisabled = isUnavailable || isFull;

                          if (day === 10 && selectedMonth === 4) {
                            console.log(`April 10 - Count: ${appointmentCount}, isFull: ${isFull}, isDisabled: ${isDisabled}`);
                          }

                          return (
                            <TouchableOpacity
                              key={day}
                              style={[
                                styles.pickerItem,
                                selectedDay === day && styles.pickerItemSelected,
                                isDisabled && styles.pickerItemDisabled,
                              ]}
                              onPress={() => !isDisabled && setSelectedDay(day)}
                              disabled={isDisabled}
                            >
                              <Text
                                style={[
                                  styles.pickerItemText,
                                  selectedDay === day && styles.pickerItemTextSelected,
                                  isDisabled && styles.pickerItemTextDisabled,
                                ]}
                              >
                                {String(day).padStart(2, '0')} {getDayAbbreviation(selectedYear, selectedMonth, day)}
                              </Text>
                              {appointmentCount > 0 && (
                                <View style={styles.appointmentCountBadge}>
                                  <Text style={styles.appointmentCountText}>{appointmentCount}</Text>
                                </View>
                              )}
                              {isUnavailable && (
                                <View style={styles.statusBadge}>
                                  <HeroIcon name="xmark" size="sm" color="#fff" />
                                </View>
                              )}
                              {isFull && !isUnavailable && (
                                <View style={styles.fullBadge}>
                                  <HeroIcon name="check" size="sm" color="#fff" />
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                    </ScrollView>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Time Picker Modal */}
        {showTimePicker && (
          <Modal transparent={true} animationType="slide" visible={showTimePicker}>
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.datePickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.datePickerTitle}>Select Time</Text>
                  <TouchableOpacity onPress={handleTimePickerConfirm}>
                    <Text style={styles.datePickerConfirm}>Done</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.datePickerBody}>
                  {/* Hour Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Hour</Text>
                    <ScrollView style={styles.pickerScroll}>
                      {getAvailableHours().map((hour) => {
                        const slot00 = bookedTimes.includes(`${String(hour).padStart(2, '0')}:00`);
                        const isHourFull = slot00;
                        
                        // Check if hour is within clinic operating hours
                        const withinClinicHours = isHourAvailable(hour);
                        const isDisabled = !withinClinicHours || isHourFull;
                        
                        return (
                          <TouchableOpacity
                            key={hour}
                            style={[
                              styles.pickerItem,
                              selectedHour === hour && styles.pickerItemSelected,
                              isDisabled && styles.pickerItemDisabled,
                            ]}
                            onPress={() => !isDisabled && setSelectedHour(hour)}
                            disabled={isDisabled}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text
                                style={[
                                  styles.pickerItemText,
                                  selectedHour === hour && styles.pickerItemTextSelected,
                                  isDisabled && styles.pickerItemTextDisabled,
                                ]}
                              >
                                {String(hour).padStart(2, '0')}
                              </Text>
                              {!withinClinicHours && (
                                <Text style={{ fontSize: 10, color: '#999', fontWeight: '700' }}>CLOSED</Text>
                              )}
                              {isHourFull && withinClinicHours && (
                                <Text style={{ fontSize: 10, color: '#ff6b6b', fontWeight: '700' }}>FULL</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Minute Picker */}
                  <View style={styles.pickerColumn}>
                    <Text style={styles.pickerLabel}>Minute</Text>
                    <ScrollView style={styles.pickerScroll}>
                      {[0].map((minute) => {
                        const timeString = `${String(selectedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                        const isBooked = bookedTimes.includes(timeString);
                        
                        // Check if this time is within clinic operating hours
                        const withinClinicHours = isTimeAvailable(selectedHour, minute);
                        const isDisabled = isBooked || !withinClinicHours;
                        
                        return (
                          <TouchableOpacity
                            key={minute}
                            style={[
                              styles.pickerItem,
                              selectedMinute === minute && styles.pickerItemSelected,
                              isDisabled && styles.pickerItemDisabled,
                            ]}
                            onPress={() => !isDisabled && setSelectedMinute(minute)}
                            disabled={isDisabled}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text
                                style={[
                                  styles.pickerItemText,
                                  selectedMinute === minute && styles.pickerItemTextSelected,
                                  isDisabled && styles.pickerItemTextDisabled,
                                ]}
                              >
                                {String(minute).padStart(2, '0')}
                              </Text>
                              {isBooked && (
                                <Text style={{ fontSize: 10, color: '#ff6b6b', fontWeight: '700' }}>BOOKED</Text>
                              )}
                              {!withinClinicHours && (
                                <Text style={{ fontSize: 10, color: '#999', fontWeight: '700' }}>CLOSED</Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Add Patient Modal */}
        {showAddPatientModal && (
          <Modal visible={showAddPatientModal} transparent={false} animationType="slide">
            <AddPatient 
              onPatientAdded={(patientId) => {
                if (patientId === '') {
                  // User cancelled
                  console.log('❌ Add patient cancelled');
                  setShowAddPatientModal(false);
                } else {
                  // Patient was successfully added
                  console.log('👤 Patient added successfully:', patientId);
                  setShowAddPatientModal(false);
                  // The useEffect hook will detect and handle the newly added patient
                }
              }}
            />
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0b7fab',
  },
  backIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  stepIndicator: {
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#0b7fab',
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0b7fab',
    marginBottom: 8,
  },
  stepProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  stepDotActive: {
    backgroundColor: '#0b7fab',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
  },
  stepNumberActive: {
    color: '#fff',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0b7fab',
    justifyContent: 'center',
    alignItems: 'center',
    fontWeight: '700',
    color: '#fff',
    fontSize: 12,
    textAlignVertical: 'center',
    textAlign: 'center',
  },
  stepBadgeDisabled: {
    backgroundColor: '#ccc',
    color: '#999',
  },
  stepBadgeOptional: {
    backgroundColor: '#ff9800',
  },
  optionalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ff9800',
    marginLeft: 'auto',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b7fab',
    flex: 1,
  },
  sectionTitleDisabled: {
    color: '#ccc',
  },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dropdownSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#0b7fab',
    borderWidth: 2,
  },
  dropdownDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    opacity: 0.6,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  dropdownTextSelected: {
    color: '#0b7fab',
    fontWeight: '700',
  },
  dropdownIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: '#0b7fab',
  },
  pickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginTop: 8,
    maxHeight: 300,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    position: 'relative',
  },
  pickerItemSelected: {
    backgroundColor: '#e3f2fd',
  },
  pickerItemText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  pickerItemTextSelected: {
    color: '#0b7fab',
    fontWeight: '700',
  },
  pickerItemSubText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    paddingVertical: 20,
  },
  inputField: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0b7fab',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
  },
  inputValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusContainerDisabled: {
    opacity: 0.6,
  },
  statusButton: {
    flex: 1,
    minWidth: '48%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  statusButtonSelected: {
    borderColor: '#0b7fab',
    backgroundColor: '#e3f2fd',
  },
  statusButtonDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  statusButtonTextSelected: {
    color: '#0b7fab',
  },
  statusButtonTextDisabled: {
    color: '#ccc',
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 100,
  },
  notesInputDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    color: '#ccc',
    opacity: 0.6,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 8,
    borderTopColor: '#ddd',
    borderTopWidth: 1,
    backgroundColor: '#fff',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#0b7fab',
  },
  cancelButton: {
    borderWidth: 2,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#fff',
  },
  cancelButtonText: {
    color: '#666',
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 0,
    maxHeight: '80%',
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  datePickerCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b7fab',
  },
  datePickerConfirm: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0b7fab',
  },
  datePickerBody: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  pickerColumn: {
    flex: 1,
    height: 300,
  },
  pickerLabel: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#0b7fab',
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
  },
  pickerScroll: {
    flex: 1,
  },
  pickerItemDisabled: {
    backgroundColor: '#f5f5f5',
    opacity: 0.5,
  },
  pickerItemTextDisabled: {
    color: '#ccc',
    fontWeight: '400',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fullBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  appointmentCountBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0b7fab',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  appointmentCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  accountTypeLabel: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  patientLabel: {
    backgroundColor: '#e3f2fd',
    color: '#0b7fab',
  },
  dummyLabel: {
    backgroundColor: '#fff3e0',
    color: '#f57c00',
  },
  letterIndex: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    minWidth: 30,
    backgroundColor: '#f9f9f9',
    borderLeftWidth: 1,
    borderLeftColor: '#e0e0e0',
  },
  letterIndexItem: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
    minHeight: 22,
  },
  letterIndexText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#999',
  },
  letterIndexTextActive: {
    color: '#0b7fab',
    fontWeight: '700',
  },
});

