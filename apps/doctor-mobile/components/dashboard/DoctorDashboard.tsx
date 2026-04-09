import React, { useState, useEffect, useRef, useCallback } from "react";
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
} from "react-native";
import { useFocusEffect } from "expo-router";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AppointmentCard from "./AppointmentCard";
import StatCard from "./StatCard";
import PatientDetailsView from "../patientrecord/PatientDetailsView";
import RecordsTab from "../navigation/RecordsTab";
import AppointmentsTab from "../navigation/AppointmentsTab";
import SettingsTab from "../navigation/SettingsTab";
import { updateDoctorAppointmentStatus, getDoctorAppointments } from "../../lib/appointmentService";
import * as dashboardService from "../../lib/dashboardService";
import { getDoctorProfile } from "../../lib/doctorService";
import { updatePatientMedicalIntake } from "../../lib/profilesPatients";
import { getStatusColor, getStatusBgColor } from "../../lib/statusHelpers";
import { formatDateOfBirth, formatAppointmentDate } from "../../lib/dateFormatters";
import { CurrentUser, Appointment as SupabaseAppointment } from "@smileguard/shared-types";
import {
  SERVICE_OPTIONS,
  GENDER_OPTIONS,
  TIME_OPTIONS,
  getToday,
} from "../../data/dashboardData";

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
  status?: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  patient_id?: string;
  dentist_id?: string | null;
  medicalIntake?: any;
}

interface DoctorDashboardProps {
  user: CurrentUser;
  onLogout: () => void;
}

export default function DoctorDashboard({ user, onLogout }: DoctorDashboardProps) {
  const insets = useSafeAreaInsets();
  
  // Doctor profile state
  const [doctorProfile, setDoctorProfile] = useState<CurrentUser & { doctor_name?: string }>(user);
  
  // Loading states
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingOnTabSwitch, setLoadingOnTabSwitch] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Handle profile updates
  const handleUpdateProfile = (updatedData: Partial<CurrentUser>) => {
    setDoctorProfile(prev => ({ ...prev, ...updatedData }));
  };
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarAnimatedValue = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.timing(sidebarAnimatedValue, {
      toValue: sidebarOpen ? 0 : -260,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [sidebarOpen, sidebarAnimatedValue]);
  
  // Appointment editing state
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editedPatient, setEditedPatient] = useState<DashboardAppointment | null>(null);
  const [originalPatient, setOriginalPatient] = useState<DashboardAppointment | null>(null);
  const [patientSortBy, setPatientSortBy] = useState<'name' | 'date' | 'service'>('name');
  const [patientSortOrder, setPatientSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const [expandPatientDetails, setExpandPatientDetails] = useState(false);
  const [viewingPatient, setViewingPatient] = useState<DashboardAppointment | null>(null);
  const [showQuickPatientSearch, setShowQuickPatientSearch] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'appointments' | 'settings'>('dashboard');
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  
  const today = getToday();
  const [appointments, setAppointments] = useState<DashboardAppointment[]>([]);
  const [requests, setRequests] = useState<DashboardAppointment[]>([]);
  const [patients, setPatients] = useState<DashboardAppointment[]>([]);
  const [stats, setStats] = useState({ total: 0, scheduled: 0, completed: 0, cancelled: 0, noShow: 0 });

  // Filter today's appointments - exclude completed and cancelled ones
  const todayAppointments = appointments
    .filter(apt => 
      apt.date === today && 
      apt.status !== 'completed' && 
      apt.status !== 'cancelled' && 
      apt.status !== 'no-show'
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
    if (todayAppointments.length > 0 && !selectedPatient) {
      setSelectedPatient(todayAppointments[0]);
    }
  }, [todayAppointments, selectedPatient]);

  // Auto-show patient details when a patient is selected
  useEffect(() => {
    if (selectedPatient) {
      setShowPatientDetails(true);
    }
  }, [selectedPatient]);

  // ─────────────────────────────────────────
  // FETCH DOCTOR PROFILE FROM DOCTORS TABLE
  // ─────────────────────────────────────────
  
  useEffect(() => {
    const fetchDoctorInfo = async () => {
      if (!user?.id) return;
      
      try {
        const doctorProfile = await getDoctorProfile(user.id);
        if (doctorProfile) {
          setDoctorProfile(prev => ({
            ...prev,
            doctor_name: doctorProfile.doctor_name || doctorProfile.doctor_name,
          }));
        }
      } catch (error) {
        console.error("Error fetching doctor profile:", error);
      }
    };
    
    fetchDoctorInfo();
  }, [user?.id]);

  // ─────────────────────────────────────────
  // FETCH DATA FROM SUPABASE
  // ─────────────────────────────────────────
  
  const refreshDashboardData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoadingAppointments(true);
      setLoadingPatients(true);
      setErrorMessage(null);

      // Use RPC function to get ALL appointments including cancelled (bypasses RLS)
      const rpcAppointments = await getDoctorAppointments(user.id);
      
      if (rpcAppointments && rpcAppointments.length > 0) {
        const transformedAppointments = rpcAppointments.map((apt: any) => ({
          id: apt.id || '',
          name: apt.patient_name || 'Patient',
          service: apt.service || '',
          time: apt.appointment_time || '',
          date: apt.appointment_date || '',
          age: 0,
          gender: apt.patient_profile?.gender || '',
          contact: apt.patient_profile?.phone || '',
          email: apt.profiles?.email || '',
          notes: apt.notes || '',
          imageUrl: apt.patient_avatar || require('../../assets/images/user.png'),
          status: (apt.status || 'scheduled') as 'scheduled' | 'completed' | 'cancelled' | 'no-show',
          patient_id: apt.patient_id,
          dentist_id: apt.dentist_id,
          medicalIntake: apt.patient_profile ? {
            gender: apt.patient_profile.gender || '',
            phone: apt.patient_profile.phone || '',
            address: apt.patient_profile.address || '',
            dateOfBirth: apt.patient_profile.date_of_birth || '',
            emergencyContactName: apt.patient_profile.emergency_contact_name || '',
            emergencyContactPhone: apt.patient_profile.emergency_contact_phone || '',
            allergies: apt.patient_profile.allergies || '',
            currentMedications: apt.patient_profile.current_medications || '',
            medicalConditions: apt.patient_profile.medical_conditions || '',
            pastSurgeries: apt.patient_profile.past_surgeries || '',
            smokingStatus: apt.patient_profile.smoking_status || '',
            pregnancyStatus: apt.patient_profile.pregnancy_status || '',
          } : null,
        }));
        setAppointments(transformedAppointments);
        
        // Calculate stats from the actual appointments data - COUNT ALL REGARDLESS OF STATUS
        const calculatedStats = {
          total: transformedAppointments.length,
          scheduled: transformedAppointments.filter(a => a.status === 'scheduled').length,
          completed: transformedAppointments.filter(a => a.status === 'completed').length,
          cancelled: transformedAppointments.filter(a => a.status === 'cancelled').length,
          noShow: transformedAppointments.filter(a => a.status === 'no-show').length,
        };
        setStats(calculatedStats);

      } else {
        setAppointments([]);
        setStats({ total: 0, scheduled: 0, completed: 0, cancelled: 0, noShow: 0 });

      }

      const { success: patSuccess, data: patientData } = await dashboardService.fetchDoctorPatients(user.id!);
      
      if (patSuccess && patientData.length > 0) {
        const transformedPatients = patientData.map((patient: any) => ({
          id: patient.id,
          name: patient.name || 'Unknown',
          email: patient.email || '',
          contact: patient.phone || '',
          service: patient.service || '',
          time: '',
          date: today,
          age: 0,
          gender: '',
          notes: '',
          imageUrl: require('../../assets/images/user.png'),
          status: 'scheduled' as const,
          patient_id: patient.id,
        }));
        setPatients(transformedPatients);

      } else {
        setPatients([]);

      }
    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      setErrorMessage('Failed to load dashboard data');
    } finally {
      setLoadingAppointments(false);
      setLoadingPatients(false);
      setIsRefreshing(false);
    }
  }, [user?.id, today]);

  useEffect(() => {
    if (!user?.id) return;
    refreshDashboardData();
  }, [user?.id]);

  // ─────────────────────────────────────────
  // UPDATE DASHBOARD WHEN COMPONENT OPENS
  // ─────────────────────────────────────────
  
  useFocusEffect(
    useCallback(() => {
      setLoadingOnTabSwitch(true);
      refreshDashboardData();
      setExpandPatientDetails(false);
      
      // Hide loading indicator after a short delay to show the content
      const timer = setTimeout(() => {
        setLoadingOnTabSwitch(false);
      }, 500);
      
      return () => {
        clearTimeout(timer);
      };
    }, [refreshDashboardData])
  );

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

  const handleEditPatient = () => {
    if (selectedPatient) {
      setOriginalPatient({ ...selectedPatient });
      setEditedPatient({ ...selectedPatient });
      setIsEditingPatient(true);
    }
  };

  const isFieldChanged = (fieldName: keyof DashboardAppointment): boolean => {
    if (!originalPatient || !editedPatient) return false;
    return originalPatient[fieldName] !== editedPatient[fieldName];
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

  const handleSavePatient = async () => {
    if (editedPatient) {
      // Save to Supabase first
      const result = await updatePatientMedicalIntake(editedPatient.patient_id || '', {
        gender: editedPatient.gender,
        phone: editedPatient.contact,
        address: editedPatient.medicalIntake?.address,
        dateOfBirth: editedPatient.medicalIntake?.dateOfBirth,
        emergencyContactName: editedPatient.medicalIntake?.emergencyContactName,
        emergencyContactPhone: editedPatient.medicalIntake?.emergencyContactPhone,
        allergies: editedPatient.medicalIntake?.allergies,
        currentMedications: editedPatient.medicalIntake?.currentMedications,
        medicalConditions: editedPatient.medicalIntake?.medicalConditions,
        pastSurgeries: editedPatient.medicalIntake?.pastSurgeries,
        smokingStatus: editedPatient.medicalIntake?.smokingStatus,
        pregnancyStatus: editedPatient.medicalIntake?.pregnancyStatus,
      });

      if (!result.success) {
        Alert.alert('Error', result.message);
        return;
      }

      setPatients((prev) =>
        prev.map((p) => (p.id === editedPatient.id ? editedPatient : p))
      );
      
      if (editedPatient.status !== 'scheduled' && editedPatient.date === today) {
        const updatedAppointments = appointments.filter(apt => apt.id !== editedPatient.id);
        setAppointments(updatedAppointments);
        
        const remainingTodayAppointments = updatedAppointments.filter(apt => apt.date === today);
        if (remainingTodayAppointments.length > 0) {
          setSelectedPatient(remainingTodayAppointments[0]);
        } else {
          setSelectedPatient(updatedAppointments.length > 0 ? updatedAppointments[0] : null);
        }
      } else {
        setAppointments((prev) =>
          prev.map((apt) => (apt.id === editedPatient.id ? editedPatient : apt))
        );
        setSelectedPatient(editedPatient);
      }
      
      setIsEditingPatient(false);
      setEditedPatient(null);
      setOriginalPatient(null);
      Alert.alert("Success", "Patient information updated successfully.");
    }
  };

  const handleCancelEdit = () => {
    setIsEditingPatient(false);
    setEditedPatient(null);
    setOriginalPatient(null);
  };

  const handleUpdateAppointmentStatus = async (appointmentId: string, status: 'scheduled' | 'completed' | 'cancelled' | 'no-show') => {
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
      
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === appointmentId ? { ...apt, status } : apt))
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update appointment status');
    }
  };

  // Loading indicator
  if (loadingAppointments || loadingPatients) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f8ff", justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#0b7fab" />
          <Text style={{ marginTop: 16, color: '#0b7fab', fontSize: 16 }}>Loading dashboard...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f8ff" }}>
        <View style={styles.mainContainer}>
          {!sidebarOpen && (
            <TouchableOpacity
              style={styles.floatingToggleButton}
              onPress={() => setSidebarOpen(true)}
              accessibilityLabel="Open sidebar"
              accessibilityRole="button"
            >
              <Text style={styles.floatingToggleIcon}>☰</Text>
            </TouchableOpacity>
          )}

          <View style={styles.contentArea}>
            {activeTab === 'dashboard' ? (
              <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.container}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={[styles.header, { marginBottom: 0 }]}>
                      Welcome, {doctorProfile.doctor_name || doctorProfile.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setIsRefreshing(true);
                        refreshDashboardData();
                      }}
                      disabled={isRefreshing}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        backgroundColor: '#E3F2FD',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: '#0b7fab',
                      }}
                      activeOpacity={0.7}
                    >
                      {isRefreshing ? (
                        <ActivityIndicator size="small" color="#0b7fab" />
                      ) : (
                        <Image
                          source={require('../../assets/images/icon/refresh.png')}
                          style={{ width: 24, height: 24, resizeMode: 'contain' }}
                        />
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Stats Panel - from Supabase */}
                  <View style={styles.firstPanel}>
                    <StatCard number={patients.length} label="Patients" />
                    <StatCard number={stats.total} label="Appointments" />
                    <StatCard number={67} label="Treatments" />
                  </View>

                  <View style={styles.sectionHeader}>
                    <Text style={styles.header}>Quick Actions</Text>
                  </View>

                  <View style={styles.dashboardColumns}>
                    {/* Left Column: Today's Appointments */}
                    <View style={styles.column}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.subHeader}>Today's Appointments ({todayAppointments.length}):</Text>
                        <TouchableOpacity 
                          onPress={() => setActiveTab('appointments')}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        >
                          <Text style={{ color: '#0b7fab', fontWeight: 'bold', fontSize: 12 }}>See all</Text>
                          <Image
                            source={require('../../assets/images/icon/open.png')}
                            style={{ width: 16, height: 16, resizeMode: 'contain' }}
                          />
                        </TouchableOpacity>
                      </View>
                      {todayAppointments.length === 0 ? (
                        <View style={{ padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, minHeight: 100 }}>
                          <Text style={{ color: '#999', fontSize: 16, textAlign: 'center' }}>No appointments for today</Text>
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
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.subHeader}>Details:</Text>
                        {selectedPatient && (
                          <TouchableOpacity 
                            onPress={handleEditPatient}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                          >
                            <Text style={{ color: '#0b7fab', fontWeight: 'bold', fontSize: 12 }}>Edit</Text>
                            <Image
                              source={require('../../assets/images/icon/open.png')}
                              style={{ width: 16, height: 16, resizeMode: 'contain' }}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                      {!selectedPatient ? (
                        <View style={[styles.detailsCard, styles.shadow, { alignItems: 'center', justifyContent: 'center', minHeight: 150 }]}>
                          <Text style={{ color: '#999', fontSize: 16, textAlign: 'center' }}>No appointment selected</Text>
                        </View>
                      ) : (
                        <View style={[styles.detailsCard, styles.shadow, { position: 'relative' }]}>
                          {/* Status Badge - Top Right Corner */}
                          <View style={{
                            position: 'absolute',
                            top: 12,
                            right: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                            backgroundColor: getStatusBgColor(selectedPatient.status || 'scheduled'),
                            zIndex: 10,
                          }}>
                            <Text style={{ fontWeight: 'bold', color: '#fff', fontSize: 12 }}>
                              {(selectedPatient.status || 'scheduled').toUpperCase()}
                            </Text>
                          </View>

                          {/* Patient Header */}
                          <View style={{ alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
                            <Image
                              source={typeof selectedPatient.imageUrl === "string" ? { uri: selectedPatient.imageUrl } : selectedPatient.imageUrl}
                              style={{ width: 60, height: 60, borderRadius: 30, marginBottom: 10 }}
                            />
                            <Text style={{ fontWeight: "bold", fontSize: 18 }}>
                              {selectedPatient.name}
                            </Text>
                          </View>

                          {/* Appointment Details */}
                          <View style={{ marginBottom: 24, marginHorizontal: 0 }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#0b7fab', marginBottom: 12 }}>APPOINTMENT DETAILS</Text>
                            <DetailRow label="Service" value={selectedPatient.service || "Not specified"} />
                            <DetailRow label="Time" value={selectedPatient.time || "Not specified"} />
                            <DetailRow label="Date" value={formatAppointmentDate(selectedPatient.date) || "Not specified"} />
                          </View>

                          {/* See More Button */}
                          <TouchableOpacity 
                            style={{
                              paddingVertical: 14,
                              paddingHorizontal: 16,
                              marginBottom: 24,
                              backgroundColor: expandPatientDetails ? '#E3F2FD' : '#f5f5f5',
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: expandPatientDetails ? '#0b7fab' : '#ddd',
                              flexDirection: 'row',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: 8,
                            }}
                            onPress={() => setExpandPatientDetails(!expandPatientDetails)}
                          >
                            <Text style={{
                              fontSize: 13,
                              fontWeight: '600',
                              color: expandPatientDetails ? '#0b7fab' : '#666',
                            }}>
                              {expandPatientDetails ? 'Show Less' : 'See More'}
                            </Text>
                            <Image
                              source={require('../../assets/images/icon/open.png')}
                              style={{
                                width: 16,
                                height: 16,
                                resizeMode: 'contain',
                                transform: [{ rotate: expandPatientDetails ? '180deg' : '0deg' }]
                              }}
                            />
                          </TouchableOpacity>

                          {/* Contact Information - Expanded */}
                          {expandPatientDetails && (
                            <>
                              <View style={{ marginBottom: 24, marginHorizontal: 0 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#0b7fab', marginBottom: 12 }}>CONTACT INFORMATION</Text>
                                <DetailRow label="Email" value={selectedPatient.email || "Not provided"} />
                                <DetailRow label="Phone" value={selectedPatient.contact || "Not provided"} />
                              </View>

                              {/* Personal Details */}
                              {selectedPatient.medicalIntake && (
                                <>
                                  <View style={{ marginBottom: 24, marginHorizontal: 0 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#0b7fab', marginBottom: 12 }}>PERSONAL DETAILS</Text>
                                    <DetailRow label="Gender" value={selectedPatient.medicalIntake.gender || "Not specified"} />
                                    <DetailRow label="Date of Birth" value={formatDateOfBirth(selectedPatient.medicalIntake.dateOfBirth)} />
                                    <DetailRow label="Address" value={selectedPatient.medicalIntake.address || "Not provided"} />
                                  </View>

                                  {/* Emergency Contact */}
                                  <View style={{ marginBottom: 24, marginHorizontal: 0 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#0b7fab', marginBottom: 12 }}>EMERGENCY CONTACT</Text>
                                    <DetailRow label="Contact Name" value={selectedPatient.medicalIntake.emergencyContactName || "Not provided"} />
                                    <DetailRow label="Contact Phone" value={selectedPatient.medicalIntake.emergencyContactPhone || "Not provided"} />
                                  </View>

                                  {/* Medical History */}
                                  <View style={{ marginHorizontal: 0 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#0b7fab', marginBottom: 12 }}>MEDICAL HISTORY</Text>
                                    <DetailRow label="Allergies" value={selectedPatient.medicalIntake.allergies || "None"} />
                                    <DetailRow label="Current Medications" value={selectedPatient.medicalIntake.currentMedications || "None"} />
                                    <DetailRow label="Medical Conditions" value={selectedPatient.medicalIntake.medicalConditions || "None"} />
                                    <DetailRow label="Past Surgeries" value={selectedPatient.medicalIntake.pastSurgeries || "None"} />
                                    <DetailRow label="Smoking Status" value={selectedPatient.medicalIntake.smokingStatus || "Not specified"} />
                                  </View>
                                </>
                              )}
                            </>
                          )}
                        </View>
                      )}

                      {/* Edit Patient Modal */}
                      <Modal
                        visible={isEditingPatient}
                        animationType="slide"
                        onRequestClose={handleCancelEdit}
                      >
                        <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
                            <TouchableOpacity onPress={handleCancelEdit} style={{ marginRight: 12 }}>
                              <Image
                                source={require('../../assets/images/icon/back.png')}
                                style={{ width: 24, height: 24, resizeMode: 'contain' }}
                              />
                            </TouchableOpacity>
                            <Text style={styles.editHeader}>Edit Appointment</Text>
                          </View>
                          <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 20 }}>
                            {editedPatient && (
                              <View>
                                <View style={styles.editField}>
                                  <Text style={styles.editLabel}>Service:</Text>
                                  <TouchableOpacity
                                    style={[styles.editInput, { justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#d0d0d0' }]}
                                    onPress={() => setShowServiceDropdown(!showServiceDropdown)}
                                  >
                                    <Text style={{ color: editedPatient.service ? '#000' : '#999' }}>
                                      {editedPatient.service || 'Select a service'}
                                    </Text>
                                  </TouchableOpacity>
                                  {showServiceDropdown && (
                                    <View style={{ backgroundColor: '#f5f5f5', borderRadius: 4, marginTop: 4 }}>
                                      <RNScrollView style={{ maxHeight: 150 }}>
                                        {SERVICE_OPTIONS.map((service) => (
                                          <TouchableOpacity
                                            key={service}
                                            onPress={() => {
                                              setEditedPatient({ ...editedPatient, service });
                                              setShowServiceDropdown(false);
                                            }}
                                            style={{ paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}
                                          >
                                            <Text>{service}</Text>
                                          </TouchableOpacity>
                                        ))}
                                      </RNScrollView>
                                    </View>
                                  )}
                                </View>

                                <View style={styles.editField}>
                                  <Text style={styles.editLabel}>Status:</Text>
                                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {(['scheduled', 'completed', 'cancelled', 'no-show'] as const).map((st) => (
                                      <TouchableOpacity
                                        key={st}
                                        style={{
                                          paddingHorizontal: 14,
                                          paddingVertical: 8,
                                          borderRadius: 20,
                                          backgroundColor: editedPatient.status === st ? getStatusBgColor(st) : '#e0e0e0',
                                        }}
                                        onPress={() => setEditedPatient({ ...editedPatient, status: st })}
                                      >
                                        <Text style={{
                                          fontWeight: 'bold',
                                          color: editedPatient.status === st ? '#fff' : '#333',
                                          fontSize: 12
                                        }}>
                                          {st.toUpperCase()}
                                        </Text>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                </View>

                                <View style={styles.editButtonContainer}>
                                  <TouchableOpacity style={[styles.editButton, styles.editButtonSave]} onPress={handleSavePatient}>
                                    <Text style={styles.editButtonText}>Save</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity style={[styles.editButton, styles.editButtonCancel]} onPress={handleCancelEdit}>
                                    <Text style={[styles.editButtonText, styles.editButtonCancelText]}>Cancel</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </ScrollView>
                        </SafeAreaView>
                      </Modal>

                      {/* Patients List */}
                      <Text style={[styles.subHeader, { marginTop: 20 }]}>Patients ({patients.length}):</Text>
                      {patients.length > 0 ? (
                        <>
                          {patients.slice(0, 3).map((patient) => (
                            <TouchableOpacity
                              key={patient.id}
                              onPress={() => {
                                setViewingPatient(patient);
                                setShowPatientDetails(true);
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={[styles.card, styles.shadow, { marginBottom: 10 }]}>
                                <Image
                                  source={typeof patient.imageUrl === "string" ? { uri: patient.imageUrl } : patient.imageUrl}
                                  style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }}
                                />
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#333' }}>{patient.name}</Text>
                                  <Text style={{ fontSize: 12, color: '#555' }}>{patient.email}</Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          ))}
                          {patients.length > 3 && (
                            <TouchableOpacity 
                              onPress={() => setActiveTab('records')}
                              style={{ 
                                paddingVertical: 12, 
                                paddingHorizontal: 16,
                                alignItems: 'center', 
                                justifyContent: 'center',
                                flexDirection: 'row',
                                gap: 8,
                                marginTop: 10,
                                backgroundColor: '#f0f0f0',
                                borderRadius: 8,
                              }}
                            >
                              <Text style={{ color: '#0b7fab', fontWeight: 'bold', fontSize: 14 }}>
                                See more patients ({patients.length - 3} more)
                              </Text>
                              <Image
                                source={require('../../assets/images/icon/open.png')}
                                style={{ width: 16, height: 16, resizeMode: 'contain' }}
                              />
                            </TouchableOpacity>
                          )}
                        </>
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
              />
            ) : activeTab === 'appointments' ? (
              <AppointmentsTab
                appointments={appointments}
                onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
                styles={styles}
                doctorId={user.id}
              />
            ) : (
              <SettingsTab user={doctorProfile} onUpdateProfile={handleUpdateProfile} styles={styles} />
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
            onEdit={() => {
              if (viewingPatient) {
                setOriginalPatient({ ...viewingPatient });
                setEditedPatient({ ...viewingPatient });
                setIsEditingPatient(true);
              }
            }}
          />

          {/* Sidebar */}
          <Animated.View
            style={[
              styles.sidebarOverlay,
              {
                transform: [{ translateX: sidebarAnimatedValue }],
                top: insets.top,
                bottom: insets.bottom,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.sidebarToggleButton}
              onPress={() => setSidebarOpen(false)}
            >
              <Text style={styles.sidebarToggleIcon}>✕</Text>
            </TouchableOpacity>

            {sidebarOpen && (
              <View style={styles.logoSection}>
                <Text style={styles.logoText}>🦷</Text>
                <Text style={styles.logoTitle}>SmileGuard</Text>
              </View>
            )}

            <View style={styles.navItems}>
              <TouchableOpacity
                style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
                onPress={() => setActiveTab('dashboard')}
              >
                <Image
                  source={require('../../assets/images/icon/dashboard.png')}
                  style={styles.navIcon}
                />
                {sidebarOpen && <Text style={styles.navLabel}>Dashboard</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navItem, activeTab === 'records' && styles.navItemActive]}
                onPress={() => setActiveTab('records')}
              >
                <Image
                  source={require('../../assets/images/icon/records.png')}
                  style={styles.navIcon}
                />
                {sidebarOpen && <Text style={styles.navLabel}>Records</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navItem, activeTab === 'appointments' && styles.navItemActive]}
                onPress={() => setActiveTab('appointments')}
              >
                <Image
                  source={require('../../assets/images/icon/appointment.png')}
                  style={styles.navIcon}
                />
                {sidebarOpen && <Text style={styles.navLabel}>Appointments</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navItem, activeTab === 'settings' && styles.navItemActive]}
                onPress={() => setActiveTab('settings')}
              >
                <Image
                  source={require('../../assets/images/icon/settings.png')}
                  style={styles.navIcon}
                />
                {sidebarOpen && <Text style={styles.navLabel}>Settings</Text>}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.sidebarLogoutBtn}
              onPress={() => {
                Alert.alert("Confirm Logout", "Are you sure?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Logout", style: "destructive", onPress: onLogout },
                ]);
              }}
            >
              <Image
                source={require('../../assets/images/icon/logout.png')}
                style={styles.navIcon}
              />
              {sidebarOpen && <Text style={styles.sidebarLogoutText}>Logout</Text>}
            </TouchableOpacity>
          </Animated.View>

          {sidebarOpen && (
            <TouchableOpacity
              style={styles.backdropOverlay}
              onPress={() => setSidebarOpen(false)}
              activeOpacity={0}
            />
          )}

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
              <ActivityIndicator size="large" color="#0b7fab" />
              <Text style={{ marginTop: 16, color: '#0b7fab', fontSize: 14, fontWeight: '600' }}>Loading...</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f0f8ff',
    position: 'relative',
  },
  
  sidebarOverlay: {
    position: 'absolute',
    left: 0,
    width: 260,
    backgroundColor: '#0b7fab',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderRightWidth: 1,
    borderRightColor: '#0a5f8f',
    zIndex: 50,
  },

  floatingToggleButton: {
    position: 'absolute',
    left: 12,
    top: 12,
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#0b7fab',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },

  floatingToggleIcon: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
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

  sidebarToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  sidebarToggleIcon: {
    fontSize: 20,
    color: '#fff',
    fontWeight: 'bold',
  },

  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },

  logoText: {
    fontSize: 32,
    marginBottom: 8,
  },

  logoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },

  navItems: {
    flex: 1,
    gap: 8,
  },

  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  navItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },

  navIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
    resizeMode: 'contain',
  },

  navLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },

  sidebarLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    marginTop: 16,
  },

  sidebarLogoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  contentArea: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 40,
  },

  container: {
    padding: 20,
  },

  header: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0b7fab",
    textAlign: "center",
  },

  subHeader: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },

  sectionHeader: {
    width: "100%",
    marginTop: 30,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingBottom: 10,
  },

  firstPanel: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
    flexWrap: "wrap",
  },

  dashboardColumns: {
    flexDirection: "row",
    width: "100%",
    flexWrap: "wrap",
    gap: 20,
  },

  column: {
    flex: 1,
    minWidth: 300,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  detailsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    minHeight: 150,
    justifyContent: "center",
    alignItems: "center",
  },

  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  },

  editHeader: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },

  editField: {
    marginBottom: 20,
  },

  editLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#555",
  },

  editInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
  },

  editButtonContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },

  editButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },

  editButtonSave: {
    backgroundColor: "#0b7fab",
  },

  editButtonCancel: {
    backgroundColor: "#ddd",
  },

  editButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },

  editButtonCancelText: {
    color: "#333",
  },
});

// ─────────────────────────────────────────
// HELPER COMPONENT
// ─────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: 18,
      paddingHorizontal: 8,
      borderBottomColor: '#f0f0f0',
      borderBottomWidth: 1,
      gap: 20,
    }}>
      <Text style={{
        fontSize: 13,
        fontWeight: '600',
        color: '#666',
        flexShrink: 1,
      }}>
        {label}
      </Text>
      <Text style={{
        fontSize: 13,
        color: '#333',
        textAlign: 'right',
        fontWeight: '500',
        flexShrink: 1,
      }}>
        {value}
      </Text>
    </View>
  );
}
