import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  Button,
  TextInput,
  Animated,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AppointmentCard from "./AppointmentCard";
import StatCard from "./StatCard";
import PatientDetailsView from "../patientrecord/PatientDetailsView";
import RecordsTab from "../navigation/RecordsTab";
import AppointmentsTab from "../navigation/AppointmentsTab";
import SettingsTab from "../navigation/SettingsTab";
import { updateDoctorAppointmentStatus } from "../../lib/appointmentService";
import { CurrentUser } from "@smileguard/shared-types";
import {
  Appointment,
  SERVICE_OPTIONS,
  GENDER_OPTIONS,
  TIME_OPTIONS,
  getToday,
  SAMPLE_APPOINTMENTS,
  SAMPLE_REQUESTS,
  SAMPLE_PATIENTS,
} from "../../data/dashboardData";

// Type alias for backwards compatibility
export type AppointmentType = Appointment;

interface DoctorDashboardProps {
  user: CurrentUser;
  onLogout: () => void;
}

export default function DoctorDashboard({ user, onLogout }: DoctorDashboardProps) {
  // Get safe area insets to respect status bar and notches
  const insets = useSafeAreaInsets();
  
  // Doctor profile state
  const [doctorProfile, setDoctorProfile] = useState<CurrentUser>(user);
  
  // Handle profile updates
  const handleUpdateProfile = (updatedData: Partial<CurrentUser>) => {
    setDoctorProfile(prev => ({ ...prev, ...updatedData }));
  };
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarAnimatedValue = useRef(new Animated.Value(0)).current;
  
  // Animate sidebar position when open/closed
  useEffect(() => {
    Animated.timing(sidebarAnimatedValue, {
      toValue: sidebarOpen ? 0 : -260,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [sidebarOpen, sidebarAnimatedValue]);
  
  // Appointments state
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [editedPatient, setEditedPatient] = useState<AppointmentType | null>(null);
  const [originalPatient, setOriginalPatient] = useState<AppointmentType | null>(null);
  const [patientSortBy, setPatientSortBy] = useState<'name' | 'date' | 'service'>('name');
  const [patientSortOrder, setPatientSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showPatientDetails, setShowPatientDetails] = useState(false);
  const [viewingPatient, setViewingPatient] = useState<AppointmentType | null>(null);
  const [showQuickPatientSearch, setShowQuickPatientSearch] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'dashboard' | 'records' | 'appointments' | 'settings'>('dashboard');
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const today = getToday();
  const [appointments, setAppointments] = useState<AppointmentType[]>(SAMPLE_APPOINTMENTS);
  const [requests, setRequests] = useState<AppointmentType[]>(SAMPLE_REQUESTS);
  const [patients, setPatients] = useState<AppointmentType[]>(SAMPLE_PATIENTS);

  const todayAppointments = appointments.filter(apt => apt.date === today);

  // If there are appointments today, pick the first one, otherwise fallback
  const [selectedPatient, setSelectedPatient] = useState<AppointmentType>(
    todayAppointments.length > 0 ? todayAppointments[0] : appointments[0]
  );

  const handlePress = (apt: AppointmentType) => {
    setSelectedPatient(apt);
  };

  // Accept request: add to appointments, remove from requests
  const handleAcceptRequest = (req: AppointmentType) => {
    setAppointments((prev: AppointmentType[]) => [...prev, { ...req, id: `apt-${Date.now()}` }]);
    setRequests((prev: AppointmentType[]) => prev.filter((r) => r.id !== req.id));
  };

  // Decline request: remove from requests
  const handleDeclineRequest = (req: AppointmentType) => {
    setRequests((prev: AppointmentType[]) => prev.filter((r) => r.id !== req.id));
  };

  const handleEditPatient = () => {
    setOriginalPatient({ ...selectedPatient });
    setEditedPatient({ ...selectedPatient });
    setIsEditingPatient(true);
  };

  const isFieldChanged = (fieldName: keyof AppointmentType): boolean => {
    if (!originalPatient || !editedPatient) return false;
    return originalPatient[fieldName] !== editedPatient[fieldName];
  };

  const sortPatients = (patientsToSort: AppointmentType[]): AppointmentType[] => {
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

  const handleSavePatient = () => {
    if (editedPatient) {
      // Update patients list
      setPatients((prev: AppointmentType[]) =>
        prev.map((p) => (p.id === editedPatient.id ? editedPatient : p))
      );
      
      // Check if status was changed to non-scheduled and it's for today
      // Remove from dashboard if status is not 'scheduled' (i.e., completed, cancelled, no-show)
      if (editedPatient.status !== 'scheduled' && editedPatient.date === today) {
        // Remove the appointment from the list
        const updatedAppointments = appointments.filter(apt => apt.id !== editedPatient.id);
        setAppointments(updatedAppointments);
        
        // Update selected patient to the next available
        const remainingTodayAppointments = updatedAppointments.filter(apt => apt.date === today);
        if (remainingTodayAppointments.length > 0) {
          setSelectedPatient(remainingTodayAppointments[0]);
        } else {
          setSelectedPatient(updatedAppointments.length > 0 ? updatedAppointments[0] : selectedPatient);
        }
      } else {
        // Otherwise, just update the appointment
        setAppointments((prev: AppointmentType[]) =>
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

  const handleUpdateAppointmentStatus = async (appointmentId: string, status: 'scheduled' | 'completed' | 'cancelled' | 'no-show', shouldRemoveFromDashboard: boolean = false) => {
    try {
      // Ensure we have a doctor ID
      if (!user?.id) {
        console.error('❌ No doctor ID available');
        Alert.alert('Error', 'Doctor ID not found');
        return;
      }

      console.log(`📝 Updating appointment ${appointmentId} status: ${status}`);
      console.log(`👤 Doctor ID: ${user.id}`);
      
      // Update in Supabase with doctor ID
      const result = await updateDoctorAppointmentStatus(appointmentId, status, user.id);
      
      console.log('📊 Update result:', result);
      
      if (!result.success) {
        console.error('❌ Update failed:', result.message);
        Alert.alert('Error', result.message);
        return;
      }
      
      console.log('✅ Update successful in Supabase');

      // Just update the status - keep all appointments visible
      setAppointments((prev) =>
        prev.map((apt) => (apt.id === appointmentId ? { ...apt, status } : apt))
      );
    } catch (error) {
      console.error('Error updating appointment status:', error);
      Alert.alert('Error', 'Failed to update appointment status');
    }
  };

  const getStatusBgColor = (status?: string) => {
    if (status === 'scheduled') return '#FFC107';
    if (status === 'completed') return '#4CAF50';
    if (status === 'cancelled') return '#F44336';
    if (status === 'no-show') return '#9C27B0';
    return '#999';
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f8ff" }}>
        <View style={styles.mainContainer}>
          {/* Toggle Button - Always Visible */}
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

          {/* Main Content Area - Full Width */}
          <View style={styles.contentArea}>
        {activeTab === 'dashboard' ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.container}>
            <Text style={[styles.header, { marginBottom: 20 }]}>
              Welcome, {doctorProfile.name}
            </Text>

            {/* Stats Panel */}
            <View style={styles.firstPanel}>
              <StatCard number={67} label="Patients" />
              <StatCard number={21} label="Appointments" />
              <StatCard number={911} label="Treatments" />
            </View>

            {/* Quick Actions Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.header}>Quick Actions</Text>
            </View>

            {/* Dashboard Columns */}
            <View style={styles.dashboardColumns}>
              {/* Left Column: Appointments */}
              <View style={styles.column}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.subHeader}>Today Appointments:</Text>
                  <TouchableOpacity onPress={() => setActiveTab('appointments')}>
                    <Text style={{ color: '#0b7fab', fontWeight: 'bold', fontSize: 12 }}>See more</Text>
                  </TouchableOpacity>
                </View>
                {todayAppointments.length === 0 ? (
                  <View style={{ padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0', borderRadius: 8, minHeight: 100 }}>
                    <Text style={{ color: '#999', fontSize: 16, textAlign: 'center' }}>No appointments scheduled for today</Text>
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
                  <Text style={styles.subHeader}>Patient Details:</Text>
                  {todayAppointments.length > 0 && (
                    <TouchableOpacity onPress={handleEditPatient}>
                      <Text style={{ color: '#0b7fab', fontWeight: 'bold', fontSize: 12 }}>Edit</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {todayAppointments.length === 0 ? (
                  <View style={[styles.detailsCard, styles.shadow, { alignItems: 'center', justifyContent: 'center', minHeight: 150 }]}>
                    <Text style={{ color: '#999', fontSize: 16, textAlign: 'center' }}>Select an appointment to view patient details</Text>
                  </View>
                ) : (
                  <View style={[styles.detailsCard, styles.shadow]}>
                    <Image
                      source={typeof selectedPatient.imageUrl === "string" ? { uri: selectedPatient.imageUrl } : selectedPatient.imageUrl}
                      style={{ width: 60, height: 60, borderRadius: 30, marginBottom: 10 }}
                    />
                    <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 4 }}>
                      {selectedPatient.name}
                    </Text>
                    <Text style={{ color: "#555", marginBottom: 2 }}>
                      <Text style={{ fontWeight: "bold" }}>Service:</Text> {selectedPatient.service}
                    </Text>
                    <Text style={{ color: "#555", marginBottom: 2 }}>
                      <Text style={{ fontWeight: "bold" }}>Time:</Text> {selectedPatient.time}
                    </Text>
                    <Text style={{ color: "#555", marginBottom: 2 }}>
                      <Text style={{ fontWeight: "bold" }}>Age:</Text> {selectedPatient.age}
                    </Text>
                    <Text style={{ color: "#555", marginBottom: 2 }}>
                      <Text style={{ fontWeight: "bold" }}>Gender:</Text> {selectedPatient.gender}
                    </Text>
                    <Text style={{ color: "#555", marginBottom: 2 }}>
                      <Text style={{ fontWeight: "bold" }}>Contact:</Text> {selectedPatient.contact}
                    </Text>
                    <Text style={{ color: "#555", marginBottom: 2 }}>
                      <Text style={{ fontWeight: "bold" }}>Email:</Text> {selectedPatient.email}
                    </Text>
                    <Text style={{ color: "#555", marginTop: 6 }}>
                      <Text style={{ fontWeight: "bold" }}>Notes:</Text> {selectedPatient.notes}
                    </Text>
                    <View style={{ marginTop: 12, alignItems: 'center' }}>
                      <Text style={{ fontWeight: "bold", marginBottom: 6 }}>Appointment Status:</Text>
                      <View style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        backgroundColor: getStatusBgColor(selectedPatient.status || 'scheduled')
                      }}>
                        <Text style={{ fontWeight: 'bold', color: '#fff', fontSize: 12 }}>
                          {(selectedPatient.status || 'scheduled').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Edit Patient Modal */}
                <Modal
                  visible={isEditingPatient}
                  animationType="slide"
                  onRequestClose={handleCancelEdit}
                >
                  <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
                    <ScrollView style={{ padding: 20, paddingTop: 10 }} contentContainerStyle={{ paddingBottom: 20 }}>
                      <Text style={styles.editHeader}>Edit Patient Information</Text>
                      {editedPatient && (
                        <View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Name:</Text>
                            <TextInput
                              style={[styles.editInput, { backgroundColor: isFieldChanged('name') ? '#fffacd' : '#fff' }]}
                              value={editedPatient.name}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, name: text })}
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Service:</Text>
                            <TouchableOpacity
                              style={[styles.editInput, { justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#d0d0d0', backgroundColor: isFieldChanged('service') ? '#fffacd' : '#fff' }]}
                              onPress={() => setShowServiceDropdown(!showServiceDropdown)}
                            >
                              <Text style={{ color: editedPatient.service ? '#000' : '#999' }}>
                                {editedPatient.service || 'Select a service'}
                              </Text>
                            </TouchableOpacity>
                            {showServiceDropdown && (
                              <View style={{ backgroundColor: '#f5f5f5', borderRadius: 4, marginTop: 4, borderWidth: 1, borderColor: '#d0d0d0' }}>
                                <ScrollView
                                  style={{ maxHeight: 150 }}
                                  nestedScrollEnabled={true}>
                                  {SERVICE_OPTIONS.map((service) => (
                                    <TouchableOpacity
                                      key={service}
                                      onPress={() => {
                                        setEditedPatient({ ...editedPatient, service });
                                        setShowServiceDropdown(false);
                                      }}
                                      style={{
                                        paddingHorizontal: 15,
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: '#e0e0e0',
                                        backgroundColor: editedPatient.service === service ? '#e3f2fd' : 'transparent',
                                      }}
                                    >
                                      <Text style={{ color: editedPatient.service === service ? '#1976d2' : '#333' }}>
                                        {service}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </View>
                            )}
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Time:</Text>
                            <TouchableOpacity
                              style={[styles.editInput, { justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#d0d0d0', backgroundColor: isFieldChanged('time') ? '#fffacd' : '#fff' }]}
                              onPress={() => setShowTimeDropdown(!showTimeDropdown)}
                            >
                              <Text style={{ color: editedPatient.time ? '#000' : '#999' }}>
                                {editedPatient.time || 'Select a time'}
                              </Text>
                            </TouchableOpacity>
                            {showTimeDropdown && (
                              <View style={{ backgroundColor: '#f5f5f5', borderRadius: 4, marginTop: 4, borderWidth: 1, borderColor: '#d0d0d0' }}>
                                <ScrollView
                                  style={{ maxHeight: 150 }}
                                  nestedScrollEnabled={true}>
                                  {TIME_OPTIONS.map((time) => (
                                    <TouchableOpacity
                                      key={time}
                                      onPress={() => {
                                        setEditedPatient({ ...editedPatient, time });
                                        setShowTimeDropdown(false);
                                      }}
                                      style={{
                                        paddingHorizontal: 15,
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: '#e0e0e0',
                                        backgroundColor: editedPatient.time === time ? '#e3f2fd' : 'transparent',
                                      }}
                                    >
                                      <Text style={{ color: editedPatient.time === time ? '#1976d2' : '#333' }}>
                                        {time}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </View>
                            )}
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Age:</Text>
                            <TextInput
                              style={[styles.editInput, { backgroundColor: isFieldChanged('age') ? '#fffacd' : '#fff' }]}
                              value={editedPatient.age.toString()}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, age: parseInt(text) || 0 })}
                              keyboardType="numeric"
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Gender:</Text>
                            <TouchableOpacity
                              style={[styles.editInput, { justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderColor: '#d0d0d0', backgroundColor: isFieldChanged('gender') ? '#fffacd' : '#fff' }]}
                              onPress={() => setShowGenderDropdown(!showGenderDropdown)}
                            >
                              <Text style={{ color: editedPatient.gender ? '#000' : '#999' }}>
                                {editedPatient.gender || 'Select a gender'}
                              </Text>
                            </TouchableOpacity>
                            {showGenderDropdown && (
                              <View style={{ backgroundColor: '#f5f5f5', borderRadius: 4, marginTop: 4, borderWidth: 1, borderColor: '#d0d0d0' }}>
                                <ScrollView
                                  style={{ maxHeight: 150 }}
                                  nestedScrollEnabled={true}>
                                  {GENDER_OPTIONS.map((gender) => (
                                    <TouchableOpacity
                                      key={gender}
                                      onPress={() => {
                                        setEditedPatient({ ...editedPatient, gender });
                                        setShowGenderDropdown(false);
                                      }}
                                      style={{
                                        paddingHorizontal: 15,
                                        paddingVertical: 12,
                                        borderBottomWidth: 1,
                                        borderBottomColor: '#e0e0e0',
                                        backgroundColor: editedPatient.gender === gender ? '#e3f2fd' : 'transparent',
                                      }}
                                    >
                                      <Text style={{ color: editedPatient.gender === gender ? '#1976d2' : '#333' }}>
                                        {gender}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>
                              </View>
                            )}
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Contact:</Text>
                            <TextInput
                              style={[styles.editInput, { backgroundColor: isFieldChanged('contact') ? '#fffacd' : '#fff' }]}
                              value={editedPatient.contact}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, contact: text })}
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Email:</Text>
                            <TextInput
                              style={[styles.editInput, { backgroundColor: isFieldChanged('email') ? '#fffacd' : '#fff' }]}
                              value={editedPatient.email}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, email: text })}
                            />
                          </View>
                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Notes:</Text>
                            <TextInput
                              style={[styles.editInput, { height: 80, textAlignVertical: 'top', backgroundColor: isFieldChanged('notes') ? '#fffacd' : '#fff' }]}
                              value={editedPatient.notes}
                              onChangeText={(text) => setEditedPatient({ ...editedPatient, notes: text })}
                              multiline
                            />
                          </View>

                          <View style={styles.editField}>
                            <Text style={styles.editLabel}>Appointment Status:</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                              {(['scheduled', 'completed', 'cancelled', 'no-show'] as const).map((st) => (
                                <TouchableOpacity
                                  key={st}
                                  style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 20,
                                    backgroundColor: editedPatient.status === st ? getStatusBgColor(st) : '#e0e0e0',
                                    borderWidth: (editedPatient.status === st && isFieldChanged('status')) ? 3 : editedPatient.status === st ? 2 : 0,
                                    borderColor: (editedPatient.status === st && isFieldChanged('status')) ? '#FFD700' : editedPatient.status === st ? '#0b7fab' : 'transparent'
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

                <Text style={[styles.subHeader, { marginTop: 20 }]}> Appointment Requests:</Text>
                {requests.length === 0 && (
                  <Text style={{ color: '#888', textAlign: 'center', marginVertical: 10 }}>No pending requests.</Text>
                )}
                {requests.map((req) => (
                  <View style={styles.card} key={req.id}>
                    <View style={styles.avatar}>
                      <Image
                        source={typeof req.imageUrl === "string" ? { uri: req.imageUrl } : req.imageUrl}
                        style={{ width: 40, height: 40, borderRadius: 20 }}
                      />
                    </View>
                    <View style={styles.cardText}>
                      <Text style={styles.cardTitle}>{req.name}</Text>
                      <Text style={styles.cardSubtitle}>Service: {req.service}</Text>
                      <Text style={styles.cardDate}>
                        Appointment Date: {new Date(req.date).toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                    </View>
                    {/* Action Buttons */}
                    <View style={{ flexDirection: "row", gap: 5 }}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#0b7fab" }]}
                        onPress={() => {
                          Alert.alert(
                            "Accept Request",
                            `Are you sure you want to accept the appointment request from ${req.name}?`,
                            [
                              { text: "Cancel", style: "cancel" },
                              { text: "Accept", style: "default", onPress: () => handleAcceptRequest(req) },
                            ]
                          );
                        }}
                        accessibilityLabel={`Accept request from ${req.name}`}
                        accessibilityRole="button"
                      >
                        <Text style={styles.actionBtnText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#6b7280" }]}
                        onPress={() => {
                          Alert.alert(
                            "Decline Request",
                            `Are you sure you want to decline the appointment request from ${req.name}?`,
                            [
                              { text: "Cancel", style: "cancel" },
                              { text: "Decline", style: "destructive", onPress: () => handleDeclineRequest(req) },
                            ]
                          );
                        }}
                        accessibilityLabel={`Decline request from ${req.name}`}
                        accessibilityRole="button"
                      >
                        <Text style={styles.actionBtnText}>✗</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <Text style={[styles.subHeader, { marginTop: 20 }]}>Patients List:</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, color: '#999' }}>Showing {Math.min(3, patients.length)} of {patients.length} patients</Text>
                  <TouchableOpacity onPress={() => setActiveTab('records')}>
                    <Text style={{ color: '#0b7fab', fontWeight: 'bold', fontSize: 12 }}>See more</Text>
                  </TouchableOpacity>
                </View>
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
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Image
                          source={typeof patient.imageUrl === "string" ? { uri: patient.imageUrl } : patient.imageUrl}
                          style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#333' }}>{patient.name}</Text>
                          <Text style={{ fontSize: 12, color: '#555' }}>{patient.email}</Text>
                          <Text style={{ fontSize: 11, color: '#999' }}>{patient.contact}</Text>
                        </View>
                        <Text style={{ fontSize: 14, color: '#0b7fab' }}>→</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}



              </View>
            </View>
          </View>
        </ScrollView>
        ) : activeTab === 'records' ? (
        // Records Tab Content
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
        // Appointments Tab Content
        <AppointmentsTab
          appointments={appointments}
          onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
          styles={styles}
        />
        ) : (
        // Settings Tab Content
        <SettingsTab user={doctorProfile} onUpdateProfile={handleUpdateProfile} styles={styles} />
        )}
          </View>

          {/* Patient Details Modal */}
          <PatientDetailsView
            visible={showPatientDetails}
            patient={viewingPatient}
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

          {/* Quick Patient Search Modal */}
          <Modal
            visible={showQuickPatientSearch}
            animationType="slide"
            onRequestClose={() => {
              setShowQuickPatientSearch(false);
              setQuickSearchQuery("");
            }}
          >
            <SafeAreaView style={{ flex: 1, backgroundColor: "#f0f8ff" }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomColor: '#ddd', borderBottomWidth: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#0b7fab' }}>Search Patient Records</Text>
                <TouchableOpacity onPress={() => {
                  setShowQuickPatientSearch(false);
                  setQuickSearchQuery("");
                }}>
                  <Text style={{ fontSize: 24, color: '#0b7fab', fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
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
                  }}
                  placeholder="Search by name, service, email, contact..."
                  placeholderTextColor="#999"
                  value={quickSearchQuery}
                  onChangeText={setQuickSearchQuery}
                />
              </View>
              <ScrollView style={{ flex: 1, padding: 16 }}>
                {patients
                  .filter((patient) =>
                    patient.name.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                    patient.service.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                    patient.email.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                    patient.contact.includes(quickSearchQuery)
                  )
                  .length === 0 ? (
                  <Text style={{ textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }}>
                    {quickSearchQuery ? `No patients found matching "${quickSearchQuery}"` : 'Enter a search query to find patients'}
                  </Text>
                ) : (
                  patients
                    .filter((patient) =>
                      patient.name.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                      patient.service.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                      patient.email.toLowerCase().includes(quickSearchQuery.toLowerCase()) ||
                      patient.contact.includes(quickSearchQuery)
                    )
                    .map((patient) => (
                      <TouchableOpacity
                        key={patient.id}
                        style={[styles.card, styles.shadow, { marginBottom: 12, padding: 12 }]}
                        onPress={() => {
                          setViewingPatient(patient);
                          setShowPatientDetails(true);
                          setShowQuickPatientSearch(false);
                          setQuickSearchQuery("");
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Image
                            source={typeof patient.imageUrl === "string" ? { uri: patient.imageUrl } : patient.imageUrl}
                            style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#333', marginBottom: 2 }}>{patient.name}</Text>
                            <Text style={{ fontSize: 12, color: '#666' }}>{patient.service} • {patient.contact}</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: '#0b7fab', fontWeight: 'bold' }}>→</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                )}
              </ScrollView>
            </SafeAreaView>
          </Modal>
        </View>

        {/* Left Sidebar Navigation - Overlaying */}
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
          {/* Toggle Button in Sidebar */}
          <TouchableOpacity
            style={styles.sidebarToggleButton}
            onPress={() => setSidebarOpen(false)}
            accessibilityLabel="Close sidebar"
            accessibilityRole="button"
          >
            <Text style={styles.sidebarToggleIcon}>✕</Text>
          </TouchableOpacity>

          {sidebarOpen && (
            <View style={styles.logoSection}>
              <Text style={styles.logoText}>🦷</Text>
              <Text style={styles.logoTitle}>SmileGuard</Text>
            </View>
          )}

          {/* Navigation Items */}
          <View style={styles.navItems}>
            <TouchableOpacity
              style={[styles.navItem, activeTab === 'dashboard' && styles.navItemActive]}
              onPress={() => {
                setActiveTab('dashboard');
                setQuickSearchQuery("");
              }}
              accessibilityLabel="Dashboard"
              accessibilityRole="button"
            >
              <Text style={styles.navIcon}>🏠</Text>
              {sidebarOpen && <Text style={[styles.navLabel, activeTab === 'dashboard' && styles.navLabelActive]}>Dashboard</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, activeTab === 'records' && styles.navItemActive]}
              onPress={() => setActiveTab('records')}
              accessibilityLabel="Records"
              accessibilityRole="button"
            >
              <Text style={styles.navIcon}>📋</Text>
              {sidebarOpen && <Text style={[styles.navLabel, activeTab === 'records' && styles.navLabelActive]}>Records</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, activeTab === 'appointments' && styles.navItemActive]}
              onPress={() => setActiveTab('appointments')}
              accessibilityLabel="Appointments"
              accessibilityRole="button"
            >
              <Text style={styles.navIcon}>📅</Text>
              {sidebarOpen && <Text style={[styles.navLabel, activeTab === 'appointments' && styles.navLabelActive]}>Appointments</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navItem, activeTab === 'settings' && styles.navItemActive]}
              onPress={() => setActiveTab('settings')}
              accessibilityLabel="Settings"
              accessibilityRole="button"
            >
              <Text style={styles.navIcon}>⚙️</Text>
              {sidebarOpen && <Text style={[styles.navLabel, activeTab === 'settings' && styles.navLabelActive]}>Settings</Text>}
            </TouchableOpacity>
          </View>

          {/* Logout Button at Bottom */}
          <TouchableOpacity
            style={styles.sidebarLogoutBtn}
            onPress={onLogout}
            accessibilityLabel="Logout"
            accessibilityRole="button"
          >
            <Text style={styles.sidebarLogoutIcon}>🚪</Text>
            {sidebarOpen && <Text style={styles.sidebarLogoutText}>Logout</Text>}
          </TouchableOpacity>
        </Animated.View>

        {/* Backdrop Overlay - Closes sidebar when tapped */}
        {sidebarOpen && (
          <TouchableOpacity
            style={styles.backdropOverlay}
            onPress={() => setSidebarOpen(false)}
            activeOpacity={0}
            accessibilityLabel="Close sidebar"
            accessibilityRole="button"
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  // Main Container
  mainContainer: {
    flex: 1,
    backgroundColor: '#f0f8ff',
    position: 'relative',
  },
  
  // Sidebar Styles
  sidebar: {
    width: 260,
    backgroundColor: '#0b7fab',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderRightWidth: 1,
    borderRightColor: '#0a5f8f',
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
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
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
    justifyContent: 'flex-start',
  },

  navItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderLeftWidth: 4,
    borderLeftColor: '#fff',
  },

  navIcon: {
    fontSize: 20,
    marginRight: 12,
  },

  navLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },

  navLabelActive: {
    color: '#fff',
    fontWeight: '600',
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

  sidebarLogoutIcon: {
    fontSize: 18,
    marginRight: 8,
  },

  sidebarLogoutText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Content Area
  contentArea: {
    flex: 1,
    backgroundColor: '#f0f8ff',
  },

  scrollViewContent: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    alignItems: "center",
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

  // Stats Panel
  firstPanel: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
    flexWrap: "wrap",
  },

  // Dashboard Columns
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

  // Cards
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  detailsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    minHeight: 150,
    justifyContent: "center",
    alignItems: "center",
  },
  cardText: {
    flex: 1,
    marginLeft: 10,
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#333",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#777",
  },
  cardDate: {
    fontSize: 12,
    color: "#555",
    fontWeight: "bold",
    marginTop: 4,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eee",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0b7fab",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  actionBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  },
  editContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  editModal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  editHeader: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
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
    paddingBottom: 20,
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

  // Settings Styles
  settingsSection: {
    marginBottom: 24,
  },

  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0b7fab',
    marginBottom: 12,
  },

  settingsCard: {
    backgroundColor: '#fff',
    borderRadius: 0,
    marginBottom: 8,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },

  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  settingsToggleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  settingsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },

  settingsValue: {
    fontSize: 14,
    color: '#0b7fab',
    fontWeight: '500',
  },

  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },

  toggleButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 2,
    elevation: 2,
  },
});